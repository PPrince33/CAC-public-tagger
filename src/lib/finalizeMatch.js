import { supabase } from '../supabase'

// Shared "process a match" step used by the QC portal, the tagger and the
// admin backfill. Reads raw match_events straight from the database and
// rewrites processed_match_events for that match.

const PERIOD_OFFSETS_DEFAULT = { '1st Half': 0, '2nd Half': 45, '1st Extra Time': 90, '2nd Extra Time': 105 }

async function fetchAllRawEvents(matchId) {
    let all = [], from = 0
    while (true) {
        const { data, error } = await supabase.from('match_events').select('*')
            .eq('match_id', matchId).order('match_time_seconds', { ascending: true })
            .range(from, from + 999)
        if (error) throw error
        all = all.concat(data || [])
        if (!data || data.length < 1000) break
        from += 1000
    }
    return all
}

// Which team each player played for in this match. Lineups carry the
// per-match team; players.team_id (the player's current team) is a fallback.
async function teamByPlayer(matchId, match) {
    const map = {}
    const { data: pl } = await supabase.from('players').select('player_id, team_id')
        .in('team_id', [match.home_team_id, match.away_team_id])
    ;(pl || []).forEach(p => { map[p.player_id] = p.team_id })
    const { data: lu } = await supabase.from('lineups').select('player_id, team_id').eq('match_id', matchId)
    ;(lu || []).forEach(l => { if (l.team_id) map[l.player_id] = l.team_id })
    return map
}

/**
 * Process a match into processed_match_events.
 * @param {string} matchId
 * @param {object} opts
 *   offsets      – minute offsets per period (QC modal values)
 *   computeScore – true for full matches; updates matches.home/away_team_score
 *   markDone     – set matches.status = 'Done' (QC passes true; tagger passes false)
 * @returns {{ count, warnings, homeScore?, awayScore? }}
 */
export async function finalizeMatch(matchId, opts = {}) {
    if (!matchId) throw new Error('No match selected.')
    const offsets = { ...PERIOD_OFFSETS_DEFAULT, ...(opts.offsets || {}) }
    const warnings = []

    const { data: match, error: me } = await supabase.from('matches')
        .select('match_id, home_team_id, away_team_id, is_futsal').eq('match_id', matchId).single()
    if (me) throw me

    const raw = await fetchAllRawEvents(matchId)
    if (!raw.length) throw new Error('No events to process.')
    const isFutsal = raw[0].is_futsal != null ? raw[0].is_futsal === true : match.is_futsal === true
    const pLen = isFutsal ? 40 : 120, pWid = isFutsal ? 20 : 80

    const isMT = (r, type) => r.action === 'Match Time' && r.type === type

    // Pass 1: periods
    const hasKickOff = raw.some(r => isMT(r, 'Kick-Off'))
    const hasEnd = raw.some(r => isMT(r, 'Match End'))
    if (!hasKickOff) warnings.push('No Kick-Off event: all events treated as 1st Half, minutes counted from first event.')
    if (!hasEnd) warnings.push('No Match End event logged.')

    let cur = hasKickOff ? null : '1st Half'
    const koTimes = hasKickOff ? {} : { '1st Half': raw[0].match_time_seconds }
    raw.forEach(r => {
        if (isMT(r, 'Kick-Off')) {
            cur = r.outcome
            if (koTimes[cur] == null) koTimes[cur] = r.match_time_seconds
        } else if (r.action === 'Match Time' && r.outcome === 'Penalty shootout') cur = 'Penalty shootout'
        r._half = cur
        if (hasKickOff && (isMT(r, 'Half Break') || isMT(r, 'Match End'))) cur = null
    })
    const unassigned = raw.filter(r => !r._half && r.action !== 'Match Time').length
    if (unassigned) warnings.push(`${unassigned} event(s) fall outside any period (before Kick-Off or after a break) and have no half or minute.`)

    // Pass 2: payloads
    const num = v => (v != null ? parseFloat(v) : null)
    const payloads = raw.map(r => {
        const half = r._half
        let min = null
        if (half && half !== 'Penalty shootout' && koTimes[half] != null)
            min = Math.round((r.match_time_seconds - koTimes[half]) / 60) + (offsets[half] ?? 0)
        let sx = num(r.start_x), sy = num(r.start_y), ex = num(r.end_x), ey = num(r.end_y)
        let gkx = num(r.gk_x), gky = num(r.gk_y)
        if (r.team_direction === 'R2L' && half !== 'Penalty shootout') {
            if (sx != null) sx = pLen - sx; if (ex != null) ex = pLen - ex
            if (sy != null) sy = pWid - sy; if (ey != null) ey = pWid - ey
            if (gkx != null) gkx = pLen - gkx; if (gky != null) gky = pWid - gky
        }
        return {
            match_event_id: r.match_event_id, match_id: matchId,
            half: half || null, match_minute: min, match_time_seconds: r.match_time_seconds,
            start_x: sx, start_y: sy, end_x: ex, end_y: ey, end_z: num(r.end_z),
            gk_x: gkx, gk_y: gky,
            team_direction: 'L2R', original_team_direction: r.team_direction || 'L2R',
            action: r.action || 'Unknown', outcome: r.outcome || 'Unknown',
            type: r.type || null, body_part: r.body_part || null,
            player_id: r.player_id, reaction_player_id: r.reaction_player_id || null,
            is_futsal: isFutsal, pressure_on: r.pressure_on === true,
            shot_technique: r.shot_technique || null,
            first_time_shot: r.first_time_shot != null ? parseInt(r.first_time_shot) : null,
            assist_type: r.assist_type || null
        }
    })

    // Replace processed rows
    const { error: de } = await supabase.from('processed_match_events').delete().eq('match_id', matchId)
    if (de) throw de
    for (let i = 0; i < payloads.length; i += 1000) {
        const { error } = await supabase.from('processed_match_events').insert(payloads.slice(i, i + 1000))
        if (error) throw error
    }

    const result = { count: payloads.length, warnings }
    const update = { processed_at: new Date().toISOString() }

    if (opts.computeScore) {
        const teamOf = await teamByPlayer(matchId, match)
        let home = 0, away = 0
        raw.forEach(r => {
            if (r._half === 'Penalty shootout') return
            const own = r.outcome === 'Own Goal' || r.type === 'Own Goal'
            if (r.outcome !== 'Goal' && !own) return
            const t = teamOf[r.player_id]; if (!t) return
            const credit = own ? (t === match.home_team_id ? match.away_team_id : match.home_team_id) : t
            if (credit === match.home_team_id) home++; else if (credit === match.away_team_id) away++
        })
        update.home_team_score = home; update.away_team_score = away
        result.homeScore = home; result.awayScore = away
    }
    if (opts.markDone) update.status = 'Done'

    let { error: ue } = await supabase.from('matches').update(update).eq('match_id', matchId)
    if (ue && /processed_at/.test(ue.message || '')) {
        // add_processed_at.sql not run yet: save everything else
        delete update.processed_at
        if (Object.keys(update).length) ({ error: ue } = await supabase.from('matches').update(update).eq('match_id', matchId))
        else ue = null
        warnings.push('matches.processed_at column missing: run supabase/add_processed_at.sql.')
    }
    if (ue) throw ue
    return result
}

/** Process every match that has raw events but no processed rows yet. */
export async function backfillUnprocessed(onProgress = () => {}) {
    const { data: ms, error } = await supabase.from('matches').select('match_id, match_name')
    if (error) throw error
    const done = [], skipped = [], failed = []
    for (const m of ms || []) {
        const { count } = await supabase.from('processed_match_events')
            .select('*', { count: 'exact', head: true }).eq('match_id', m.match_id)
        if (count) { skipped.push(m); continue }
        try {
            const r = await finalizeMatch(m.match_id, { computeScore: false, markDone: false })
            done.push({ ...m, ...r })
        } catch (e) { failed.push({ ...m, error: e.message }) }
        onProgress({ done: done.length, failed: failed.length, total: ms.length })
    }
    return { done, skipped, failed }
}

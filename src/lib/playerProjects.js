import { supabase } from '../supabase'
import { currentUser, getOrCreateTeam, getOrCreatePlayer, createMatchRecord, addLineupRow } from './matchFactory'
import { ensurePlaceholders } from './placeholders'

// Data helpers for Player Projects (one player's matches bundled into one report).

export const FREE_AGENT_TEAM = 'Free agent'

/** Base URL of the CAC-Match-Report app (report pages + AI summary API). */
export const REPORT_BASE = (import.meta.env.VITE_REPORT_BASE_URL || 'https://calcioac.com/match-reports').replace(/\/$/, '')

/** Public, read-only client link for a project (summary shows once approved). */
export function reportUrl(project) {
    return `${REPORT_BASE}/player/share/${project.share_token}`
}

/** Ask the report app to draft a scout summary from this project's processed stats. */
export async function generateSummary(project) {
    const res = await fetch(`${REPORT_BASE}/api/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'player', playerId: project.player_id, matchIds: project.matches.map(m => m.match_id) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.analysis) throw new Error(data.error || `Report app answered ${res.status}`)
    return data.analysis.trim()
}

export async function saveSummary(projectId, text, approved) {
    const { error } = await supabase.from('player_projects')
        .update({ scout_summary: text, summary_approved: approved, summary_updated_at: new Date().toISOString() })
        .eq('project_id', projectId)
    if (error) throw error
}

/** Optional player details (player_profiles); every field may be empty. */
export async function loadProfile(playerId) {
    const { data } = await supabase.from('player_profiles').select('*').eq('player_id', playerId).maybeSingle()
    return data || null
}

export async function saveProfile(playerId, f) {
    const row = {
        player_id: playerId,
        date_of_birth: f.date_of_birth || null,
        preferred_foot: f.preferred_foot || null,
        height_cm: f.height_cm === '' || f.height_cm == null ? null : Number(f.height_cm),
        weight_kg: f.weight_kg === '' || f.weight_kg == null ? null : Number(f.weight_kg),
        nationality: (f.nationality || '').trim() || null,
        updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('player_profiles').upsert(row)
    if (error) throw error
}

/** Has this match got rows in processed_match_events? */
async function isProcessed(matchId) {
    const { count } = await supabase.from('processed_match_events')
        .select('match_event_id', { count: 'exact', head: true }).eq('match_id', matchId)
    return (count || 0) > 0
}

/** Matches of a project, oldest first, each with a `processed` flag. */
export async function projectMatches(projectId) {
    const { data: links, error } = await supabase.from('player_project_matches').select('match_id').eq('project_id', projectId)
    if (error) throw error
    const ids = (links || []).map(l => l.match_id)
    if (!ids.length) return []
    const { data: ms, error: me } = await supabase.from('matches')
        .select('match_id, match_name, match_date, tagging_mode, status, video_url, home_team:teams!home_team_id(team_name), away_team:teams!away_team_id(team_name)')
        .in('match_id', ids)
    if (me) throw me
    const flags = await Promise.all((ms || []).map(m => isProcessed(m.match_id)))
    return (ms || []).map((m, i) => ({ ...m, processed: flags[i] }))
        .sort((a, b) => String(a.match_date || '').localeCompare(String(b.match_date || '')))
}

/** All projects the user can see, with match counts. */
export async function listProjects() {
    const { data, error } = await supabase.from('player_projects')
        .select('project_id, player_id, title, client_type, status, share_token, scout_summary, summary_approved, created_at, players(player_name, position, teams(team_name))')
        .order('created_at', { ascending: false })
    if (error) throw error
    return Promise.all((data || []).map(async p => {
        const ms = await projectMatches(p.project_id)
        return { ...p, matches: ms, processedCount: ms.filter(m => m.processed).length }
    }))
}

/** Projects that contain this match. */
export async function projectsForMatch(matchId) {
    const { data } = await supabase.from('player_project_matches').select('project_id').eq('match_id', matchId)
    return (data || []).map(d => d.project_id)
}

/** Recompute 'tagging' / 'ready' on the server. Returns the new status. */
export async function refreshProjectStatus(projectId) {
    const { data, error } = await supabase.rpc('refresh_player_project_status', { pid: projectId })
    if (error) throw error
    return data
}

/** Matches this player appears in (via lineups) that are already processed. */
export async function existingProcessedMatchesFor(playerId) {
    const { data: lu } = await supabase.from('lineups').select('match_id').eq('player_id', playerId)
    const ids = [...new Set((lu || []).map(l => l.match_id))]
    if (!ids.length) return []
    const { data: ms } = await supabase.from('matches')
        .select('match_id, match_name, match_date, tagging_mode, home_team:teams!home_team_id(team_name), away_team:teams!away_team_id(team_name)')
        .in('match_id', ids).order('match_date', { ascending: false })
    const flags = await Promise.all((ms || []).map(m => isProcessed(m.match_id)))
    return (ms || []).filter((_, i) => flags[i])
}

/**
 * Create a project and its player-mode matches.
 * @param {object} p
 *   player:   { player_id } for an existing player, or { newName, position, teamName } (teamName '' = Free agent)
 *   title, clientType
 *   rows:     [{ videoUrl, teamName, opponent, date, competition, isFutsal, isHome }]
 *   existingMatchIds: already-tagged matches to include
 * @returns {Promise<string>} project_id
 */
export async function createProject({ player, title, clientType, rows, existingMatchIds = [] }) {
    const user = await currentUser()

    let playerId = player.player_id, position = player.position || null, playerName = player.player_name
    if (!playerId) {
        const teamId = await getOrCreateTeam(player.teamName || FREE_AGENT_TEAM)
        playerId = await getOrCreatePlayer({ playerName: player.newName, teamId, position })
        playerName = player.newName
    }

    const { data: project, error } = await supabase.from('player_projects')
        .insert({ player_id: playerId, title: title || null, client_type: clientType || null, created_by: user.id })
        .select('project_id').single()
    if (error) throw error
    const projectId = project.project_id

    const matchIds = [...existingMatchIds]
    for (const r of rows) {
        const teamId = await getOrCreateTeam(r.teamName || FREE_AGENT_TEAM)
        const oppId = r.opponent ? await getOrCreateTeam(r.opponent) : null
        const matchId = await createMatchRecord({
            match_name: `${playerName} vs ${r.opponent || 'Opponent'}`,
            tournament_name: r.competition || 'Player Project',
            match_date: r.date,
            is_futsal: r.isFutsal,
            video_url: r.videoUrl || null,
            home_team_id: r.isHome ? teamId : (oppId || teamId),
            away_team_id: r.isHome ? (oppId || teamId) : teamId,
            tagging_mode: 'player',
            focus_team_id: teamId,
            focus_player_id: playerId,
            player_project_id: projectId,
        })
        await addLineupRow({ match_id: matchId, team_id: teamId, player_id: playerId, jersey_no: null, position, starting_xi: true })
        await ensurePlaceholders(matchId, 'player')
        matchIds.push(matchId)
    }

    if (matchIds.length) {
        const { error: le } = await supabase.from('player_project_matches')
            .insert([...new Set(matchIds)].map(match_id => ({ project_id: projectId, match_id })))
        if (le) throw le
    }
    await refreshProjectStatus(projectId)
    return projectId
}

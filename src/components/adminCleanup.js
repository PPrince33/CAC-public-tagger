import { supabase } from '../supabase'
import { finalizeMatch } from '../lib/finalizeMatch'
import { getOrCreateOpponentPlayer } from '../lib/placeholders'

// Admin portal → "Duplicates" and "One-team cleanup" tabs (Phase 5).
// Keeps one player_id / team_id per real player / team so player reports
// see a player's whole history, and turns opponents that old one-team
// matches used as stand-ins into the shared "Opponent" placeholder.

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/** Lowercase, strip accents (incl. Polish ł), drop punctuation, sort words. */
export function normName(s) {
    return String(s || '').replace(/[łŁ]/g, 'l').normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ')
}

function levenshtein(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        let prev = dp[0]; dp[0] = i
        for (let j = 1; j <= b.length; j++) {
            const tmp = dp[j]
            dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
            prev = tmp
        }
    }
    return dp[b.length]
}

/** Near-identical names (typos), but never different numbers or different initials. */
function fuzzySame(a, b) {
    const digits = k => k.replace(/\D/g, '')
    const initials = k => k.split(' ').filter(t => t.length <= 2).join(' ')
    return digits(a) === digits(b) && initials(a) === initials(b) && levenshtein(a, b) <= 2
}

async function fetchAll(table, select, order) {
    let out = [], from = 0
    while (true) {
        const { data, error } = await supabase.from(table).select(select).order(order).range(from, from + 999)
        if (error) throw error
        out = out.concat(data || [])
        if (!data || data.length < 1000) return out
        from += 1000
    }
}

/* ══════════════════ Markup ══════════════════ */
export const CLEANUP_TABS = `
    <button class="admin-tab" data-tab="duplicates">Duplicates</button>
    <button class="admin-tab" data-tab="oneteam">One-team cleanup</button>`

export const CLEANUP_SECTIONS = `
    <section id="admin-tab-duplicates" class="admin-section">
        <div class="card" style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                <div>
                    <h3 style="margin: 0 0 4px;">Duplicate finder</h3>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Names compared case-insensitively with accents stripped and word order ignored. Merge <strong>teams first</strong>, then players. Merging cannot be undone.</p>
                </div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <label style="font-size: 0.8rem; display: flex; gap: 6px; align-items: center;"><input type="checkbox" id="dup-other-teams"> Include players on unrelated teams</label>
                    <button class="dl-btn" id="dup-refresh">Scan</button>
                </div>
            </div>
        </div>
        <div class="card" style="margin-bottom: 24px;"><h4 style="margin: 0 0 12px;">Teams</h4><div id="dup-teams" style="font-size: 0.85rem; color: var(--text-muted);">Press Scan.</div></div>
        <div class="card"><h4 style="margin: 0 0 12px;">Players</h4><div id="dup-players" style="font-size: 0.85rem; color: var(--text-muted);">Press Scan.</div></div>
    </section>

    <section id="admin-tab-oneteam" class="admin-section">
        <div class="card" style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 4px;">Old one-team matches</h3>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0 0 12px;">
                Finds full-mode matches where almost every action belongs to one team. Converting a match sets it to one-team mode,
                moves every event that uses an opponent player (as action or reaction player) onto that team's shared <strong>Opponent</strong>
                stand-in, and re-processes the match. Opponent players themselves are not deleted.
            </p>
            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                <button class="dl-btn" id="ot-scan">Scan matches</button>
                <label style="font-size: 0.8rem; display: flex; gap: 6px; align-items: center;"><input type="checkbox" id="ot-drop-lineups"> Also remove the opponent players from these matches' lineups</label>
                <button class="dl-btn" id="ot-apply" style="display: none; background: var(--warning); color: black;">Convert selected</button>
                <span id="ot-status" style="font-size: 0.8rem; color: var(--text-muted);"></span>
            </div>
        </div>
        <div class="card"><div id="ot-list" style="font-size: 0.85rem; color: var(--text-muted);">Press Scan matches.</div></div>
    </section>`

/* ══════════════════ Duplicates ══════════════════ */
async function scanDuplicates() {
    const teamsEl = document.getElementById('dup-teams'), playersEl = document.getElementById('dup-players')
    teamsEl.innerText = playersEl.innerText = 'Scanning...'
    const [teams, players, lineups] = await Promise.all([
        fetchAll('teams', 'team_id, team_name', 'team_id'),
        fetchAll('players', 'player_id, player_name, position, team_id, is_placeholder', 'player_id'),
        fetchAll('lineups', 'match_id, player_id, team_id', 'match_id'),
    ])
    const teamName = Object.fromEntries(teams.map(t => [t.team_id, t.team_name]))
    const teamKey = Object.fromEntries(teams.map(t => [t.team_id, normName(t.team_name)]))
    const matchesOfPlayer = {}, matchesOfTeam = {}, playersOfTeam = {}
    lineups.forEach(l => {
        (matchesOfPlayer[l.player_id] ||= new Set()).add(l.match_id)
        ;(matchesOfTeam[l.team_id] ||= new Set()).add(l.match_id)
    })
    players.forEach(p => { playersOfTeam[p.team_id] = (playersOfTeam[p.team_id] || 0) + 1 })

    // Teams: same normalised name
    const tGroups = {}
    teams.forEach(t => { (tGroups[teamKey[t.team_id]] ||= []).push(t) })
    const teamDupes = Object.values(tGroups).filter(g => g.length > 1)
    renderGroups(teamsEl, teamDupes.map(g => g.map(t => ({
        id: t.team_id, name: t.team_name, sub: `${playersOfTeam[t.team_id] || 0} players`,
        matches: matchesOfTeam[t.team_id]?.size || 0,
    }))), 'merge_teams', 'No duplicate teams found.')

    // Players: same normalised name, or 1–2 letters apart; on the same or a same-named team
    const includeOther = document.getElementById('dup-other-teams').checked
    const real = players.filter(p => !p.is_placeholder)
    const related = (a, b) => includeOther || a.team_id === b.team_id || teamKey[a.team_id] === teamKey[b.team_id]
    const keyOf = Object.fromEntries(real.map(p => [p.player_id, normName(p.player_name)]))
    const parent = Object.fromEntries(real.map(p => [p.player_id, p.player_id]))
    const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])))
    const union = (a, b) => { parent[find(a)] = find(b) }
    const byKey = {}
    real.forEach(p => { (byKey[keyOf[p.player_id]] ||= []).push(p) })
    Object.values(byKey).forEach(g => g.forEach(a => g.forEach(b => { if (a !== b && related(a, b)) union(a.player_id, b.player_id) })))
    const keys = Object.keys(byKey).filter(k => k.replace(/ /g, '').length >= 6 && !/^\d+$/.test(k))
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        if (fuzzySame(keys[i], keys[j]))
            byKey[keys[i]].forEach(a => byKey[keys[j]].forEach(b => { if (related(a, b)) union(a.player_id, b.player_id) }))
    }
    const pGroups = {}
    real.forEach(p => { (pGroups[find(p.player_id)] ||= []).push(p) })
    const playerDupes = Object.values(pGroups).filter(g => g.length > 1)
        .sort((a, b) => keyOf[a[0].player_id].localeCompare(keyOf[b[0].player_id]))
    renderGroups(playersEl, playerDupes.map(g => g.map(p => ({
        id: p.player_id, name: p.player_name, sub: `${teamName[p.team_id] || 'No team'}${p.position ? ' · ' + p.position : ''}`,
        matches: matchesOfPlayer[p.player_id]?.size || 0,
    }))), 'merge_players', 'No duplicate players found.')
}

function renderGroups(el, groups, rpc, emptyMsg) {
    if (!groups.length) { el.innerHTML = emptyMsg; return }
    el.innerHTML = `<p style="margin: 0 0 12px;">${groups.length} group(s). Pick the one to <strong>keep</strong> (default: most matches); the others are merged into it.</p>` +
        groups.map((g, gi) => {
            const keep = g.reduce((a, b) => (b.matches > a.matches ? b : a))
            return `<div class="dup-group" data-gi="${gi}" style="border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px 12px; margin-bottom: 10px; color: var(--text-main);">
                ${g.map(x => `<label style="display: flex; gap: 10px; align-items: center; padding: 3px 0; font-size: 0.85rem;">
                    <input type="radio" name="${rpc}-${gi}" value="${x.id}" ${x === keep ? 'checked' : ''}>
                    <strong>${esc(x.name)}</strong><span style="color: var(--text-muted);">${esc(x.sub)}</span>
                    <span style="margin-left: auto; font-family: var(--font-mono); font-size: 0.75rem;">${x.matches} match(es)</span>
                </label>`).join('')}
                <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px;">
                    <button class="dl-btn dup-merge" data-gi="${gi}">Merge into selected</button><span class="dup-msg" style="font-size: 0.75rem; color: var(--text-muted);"></span>
                </div>
            </div>`
        }).join('')
    el.querySelectorAll('.dup-merge').forEach(btn => btn.onclick = async () => {
        const gi = +btn.dataset.gi, g = groups[gi]
        const target = el.querySelector(`input[name="${rpc}-${gi}"]:checked`).value
        const keepName = g.find(x => x.id === target).name
        const sources = g.filter(x => x.id !== target)
        if (!confirm(`Merge ${sources.map(s => `"${s.name}"`).join(', ')} into "${keepName}"?\n\nEvents, lineups and references move to "${keepName}"; the others are deleted. This cannot be undone.`)) return
        btn.disabled = true
        const msg = btn.nextElementSibling
        try {
            for (const s of sources) {
                const { error } = await supabase.rpc(rpc, { source_id: s.id, target_id: target })
                if (error) throw error
            }
            msg.innerText = 'Merged.'; msg.style.color = 'var(--success)'
            btn.closest('.dup-group').style.opacity = '0.45'
        } catch (e) {
            msg.innerText = 'Failed: ' + e.message; msg.style.color = 'var(--danger)'; btn.disabled = false
        }
    })
}

/* ══════════════════ One-team cleanup ══════════════════ */
let otCandidates = []

async function scanOneTeam() {
    const list = document.getElementById('ot-list'), applyBtn = document.getElementById('ot-apply')
    list.innerText = 'Scanning events...'; applyBtn.style.display = 'none'
    const [matches, lineups, players, events] = await Promise.all([
        fetchAll('matches', 'match_id, match_name, match_date, status, tagging_mode, home_team_id, away_team_id, home_team:teams!home_team_id(team_name), away_team:teams!away_team_id(team_name)', 'match_id'),
        fetchAll('lineups', 'match_id, player_id, team_id', 'match_id'),
        fetchAll('players', 'player_id, player_name, team_id, is_placeholder', 'player_id'),
        fetchAll('match_events', 'match_event_id, match_id, player_id, reaction_player_id, action', 'match_event_id'),
    ])
    const pl = Object.fromEntries(players.map(p => [p.player_id, p]))
    const luTeam = {}
    lineups.forEach(l => { luTeam[`${l.match_id}|${l.player_id}`] = l.team_id })
    const evByMatch = {}
    events.forEach(e => { (evByMatch[e.match_id] ||= []).push(e) })

    otCandidates = []
    matches.filter(m => (m.tagging_mode || 'full') === 'full').forEach(m => {
        const ev = (evByMatch[m.match_id] || []).filter(e => e.action !== 'Match Time')
        if (ev.length < 50) return
        const teamOf = pid => luTeam[`${m.match_id}|${pid}`] || pl[pid]?.team_id
        const home = ev.filter(e => teamOf(e.player_id) === m.home_team_id).length
        const away = ev.filter(e => teamOf(e.player_id) === m.away_team_id).length
        const share = Math.max(home, away) / ev.length
        if (share < 0.98) return
        const focus = home >= away ? m.home_team_id : m.away_team_id
        const opp = focus === m.home_team_id ? m.away_team_id : m.home_team_id
        const isOpp = pid => pid && teamOf(pid) === opp && !pl[pid]?.is_placeholder
        const oppIds = new Set()
        let asActor = 0, asReaction = 0
        ev.forEach(e => {
            if (isOpp(e.player_id)) { asActor++; oppIds.add(e.player_id) }
            if (isOpp(e.reaction_player_id)) { asReaction++; oppIds.add(e.reaction_player_id) }
        })
        otCandidates.push({
            match: m, focus, opp, share, events: ev.length, asActor, asReaction,
            oppIds: [...oppIds], oppNames: [...oppIds].map(id => pl[id]?.player_name || '?'),
            lineupOppIds: lineups.filter(l => l.match_id === m.match_id && l.team_id === opp && !pl[l.player_id]?.is_placeholder).map(l => l.player_id),
            focusName: focus === m.home_team_id ? m.home_team?.team_name : m.away_team?.team_name,
            oppName: opp === m.home_team_id ? m.home_team?.team_name : m.away_team?.team_name,
        })
    })
    otCandidates.sort((a, b) => String(a.match.match_date).localeCompare(String(b.match.match_date)))

    if (!otCandidates.length) { list.innerHTML = 'No full-mode matches look like one-team matches.'; return }
    list.innerHTML = `<table class="admin-table"><thead><tr>
            <th></th><th>Date</th><th>Match</th><th>Tagged team</th><th>Opponent</th><th>Share</th><th>Events to move</th><th>Opponent players used</th>
        </tr></thead><tbody>${otCandidates.map((c, i) => `
        <tr>
            <td><input type="checkbox" class="ot-cb" data-i="${i}" checked></td>
            <td>${esc(c.match.match_date)}</td>
            <td>${esc(c.match.match_name)}<br><span style="color: var(--text-muted); font-size: 0.7rem;">${esc(c.match.status)} · ${c.events} events</span></td>
            <td>${esc(c.focusName)}</td><td>${esc(c.oppName)}</td>
            <td>${Math.round(c.share * 100)}%</td>
            <td>${c.asActor + c.asReaction}<br><span style="color: var(--text-muted); font-size: 0.7rem;">${c.asReaction} reaction · ${c.asActor} action</span></td>
            <td style="max-width: 280px; white-space: normal; font-size: 0.75rem;">${c.oppIds.length}: ${esc(c.oppNames.slice(0, 8).join(', '))}${c.oppNames.length > 8 ? '…' : ''}<br><span style="color: var(--text-muted);">${c.lineupOppIds.length} in lineup</span></td>
        </tr>`).join('')}</tbody></table>`
    applyBtn.style.display = 'inline-block'
}

async function applyOneTeam() {
    const status = document.getElementById('ot-status')
    const dropLineups = document.getElementById('ot-drop-lineups').checked
    const chosen = [...document.querySelectorAll('.ot-cb:checked')].map(cb => otCandidates[+cb.dataset.i])
    if (!chosen.length) return
    const moved = chosen.reduce((a, c) => a + c.asActor + c.asReaction, 0)
    if (!confirm(`Convert ${chosen.length} match(es) to one-team mode?\n\n• ${moved} event references move to the Opponent stand-in\n${dropLineups ? '• opponent players are removed from these lineups\n' : ''}• each match is re-processed\n\nThis cannot be undone automatically.`)) return

    const btn = document.getElementById('ot-apply')
    btn.disabled = true
    const results = []
    for (const [i, c] of chosen.entries()) {
        const id = c.match.match_id
        status.innerText = `Converting ${i + 1}/${chosen.length}: ${c.match.match_name}...`
        try {
            let { error } = await supabase.from('matches').update({ tagging_mode: 'team', focus_team_id: c.focus }).eq('match_id', id)
            if (error) throw error
            const ph = await getOrCreateOpponentPlayer(id)
            if (c.oppIds.length) {
                ;({ error } = await supabase.from('match_events').update({ player_id: ph }).eq('match_id', id).in('player_id', c.oppIds))
                if (error) throw error
                ;({ error } = await supabase.from('match_events').update({ reaction_player_id: ph }).eq('match_id', id).in('reaction_player_id', c.oppIds))
                if (error) throw error
            }
            if (dropLineups && c.lineupOppIds.length) {
                ;({ error } = await supabase.from('lineups').delete().eq('match_id', id).in('player_id', c.lineupOppIds))
                if (error) throw error
            }
            const r = await finalizeMatch(id, { computeScore: false, markDone: false })
            results.push(`✓ ${c.match.match_name}: ${r.count} events processed`)
        } catch (e) {
            results.push(`✗ ${c.match.match_name}: ${e.message}`)
        }
    }
    btn.disabled = false
    status.innerText = 'Done.'
    alert(results.join('\n'))
    scanOneTeam()
}

export function initCleanupTabs() {
    document.getElementById('dup-refresh')?.addEventListener('click', () => scanDuplicates().catch(e => alert('Scan failed: ' + e.message)))
    document.getElementById('dup-other-teams')?.addEventListener('change', () => scanDuplicates().catch(() => {}))
    document.getElementById('ot-scan')?.addEventListener('click', () => scanOneTeam().catch(e => alert('Scan failed: ' + e.message)))
    document.getElementById('ot-apply')?.addEventListener('click', applyOneTeam)
}

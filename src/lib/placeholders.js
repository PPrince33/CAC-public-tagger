import { supabase } from '../supabase'
import { currentUser, getOrCreateTeam, addLineupRow } from './matchFactory'

// Stand-in players for one-team and one-player tagging.
// "Opponent": one per opponent team, used as the reaction player for tackles,
//             duels, fouls etc. against our player.
// "Teammate": one per focus team (player mode), receiver of passes to
//             teammates who are not in the lineup.
// Both have players.is_placeholder = true and jersey 0 in the match lineup.

export const OPPONENT_NAME = 'Opponent'
export const TEAMMATE_NAME = 'Teammate'

async function getOrCreatePlaceholder(teamId, name) {
    const { data: found } = await supabase.from('players').select('player_id')
        .eq('team_id', teamId).eq('player_name', name).eq('is_placeholder', true).limit(1)
    if (found?.length) return found[0].player_id
    const user = await currentUser()
    const { data, error } = await supabase.from('players')
        .insert({ player_name: name, team_id: teamId, position: null, is_placeholder: true, created_by: user.id })
        .select('player_id').single()
    if (error) throw error
    return data.player_id
}

async function loadMatch(matchId) {
    const { data, error } = await supabase.from('matches')
        .select('match_id, match_date, home_team_id, away_team_id, tagging_mode, focus_team_id, focus_player_id')
        .eq('match_id', matchId).single()
    if (error) throw error
    return data
}

/** The team we are tagging: focus_team_id, else the focus player's team in this match's lineup. */
export async function focusTeamOf(match) {
    if (match.focus_team_id) return match.focus_team_id
    if (match.focus_player_id) {
        const { data } = await supabase.from('lineups').select('team_id')
            .eq('match_id', match.match_id).eq('player_id', match.focus_player_id).maybeSingle()
        if (data?.team_id) return data.team_id
    }
    return match.home_team_id
}

/**
 * Find or create the "Opponent" stand-in for this match and put it in the lineup (jersey 0).
 * If the match has no separate opponent team yet, creates "Opponent – <date>" and links it.
 * @returns {Promise<string>} player_id of the stand-in
 */
export async function getOrCreateOpponentPlayer(matchId) {
    const match = await loadMatch(matchId)
    const focus = await focusTeamOf(match)
    let opp = match.home_team_id === focus ? match.away_team_id : match.home_team_id

    if (!opp || opp === focus) {
        opp = await getOrCreateTeam(`Opponent – ${match.match_date || matchId.slice(0, 8)}`)
        const side = match.home_team_id === focus ? 'away_team_id' : 'home_team_id'
        const { error } = await supabase.from('matches').update({ [side]: opp }).eq('match_id', matchId)
        if (error) throw error
    }

    const playerId = await getOrCreatePlaceholder(opp, OPPONENT_NAME)
    await addLineupRow({ match_id: matchId, team_id: opp, player_id: playerId, jersey_no: '0', position: null, starting_xi: true })
    return playerId
}

/** Find or create the "Teammate" stand-in on the focus team and put it in the lineup (jersey 0). */
export async function getOrCreateTeammatePlayer(matchId) {
    const match = await loadMatch(matchId)
    const focus = await focusTeamOf(match)
    const playerId = await getOrCreatePlaceholder(focus, TEAMMATE_NAME)
    await addLineupRow({ match_id: matchId, team_id: focus, player_id: playerId, jersey_no: '0', position: null, starting_xi: true })
    return playerId
}

/** Make sure a team/player-mode match has its stand-ins. Safe to call repeatedly. */
export async function ensurePlaceholders(matchId, mode) {
    if (mode !== 'team' && mode !== 'player') return
    await getOrCreateOpponentPlayer(matchId)
    if (mode === 'player') await getOrCreateTeammatePlayer(matchId)
}

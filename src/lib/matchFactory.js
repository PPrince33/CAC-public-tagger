import { supabase } from '../supabase'

// Shared insert helpers for Create Match and (Phase 3) Player Projects.

let _user = null
export async function currentUser() {
    if (!_user) {
        const { data: { user } } = await supabase.auth.getUser()
        _user = user
    }
    return _user
}

/** Find a team by exact name, or create it. Returns team_id. */
export async function getOrCreateTeam(teamName) {
    const name = teamName.trim()
    const { data: team } = await supabase.from('teams').select('team_id').eq('team_name', name).maybeSingle()
    if (team) return team.team_id
    const user = await currentUser()
    const { data: created, error } = await supabase.from('teams')
        .insert({ team_name: name, created_by: user.id }).select('team_id').single()
    if (error) throw error
    return created.team_id
}

/** Find a real (non-placeholder) player by name + team, or create one. Returns player_id. */
export async function getOrCreatePlayer({ playerName, teamId, position = null }) {
    const { data: found } = await supabase.from('players').select('player_id')
        .eq('player_name', playerName).eq('team_id', teamId).eq('is_placeholder', false).maybeSingle()
    if (found) return found.player_id
    const user = await currentUser()
    const { data: created, error } = await supabase.from('players')
        .insert({ player_name: playerName, team_id: teamId, position, created_by: user.id })
        .select('player_id').single()
    if (error) throw error
    return created.player_id
}

/** Insert a matches row. `fields` uses DB column names; status/created_by are filled in. */
export async function createMatchRecord(fields) {
    const user = await currentUser()
    const { data, error } = await supabase.from('matches')
        .insert({ status: 'Doing', created_by: user.id, ...fields })
        .select('match_id').single()
    if (error) throw error
    return data.match_id
}

/** Add a lineup row unless that player is already in this match's lineup. */
export async function addLineupRow(row) {
    const { data: existing } = await supabase.from('lineups').select('player_id')
        .eq('match_id', row.match_id).eq('player_id', row.player_id).maybeSingle()
    if (existing) return
    const { error } = await supabase.from('lineups').insert(row)
    if (error) throw error
}

import { supabase } from '../supabase'

export function MatchesView() {
    return `
        <div class="fade-in">
            <header class="page-header">
                <h1 class="page-title">My Matches</h1>
                <p class="page-subtitle">Matches you created or were assigned to tag</p>
            </header>

            <div id="matches-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 24px;">
                <div style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--text-muted);">
                    Loading matches...
                </div>
            </div>
        </div>
    `;
}

export async function initMatches() {
    const grid = document.getElementById('matches-grid');

    try {
        const { data: { user } } = await supabase.auth.getUser();

        // Fetch matches created by user OR assigned to user
        const { data: matches, error } = await supabase
            .from('matches')
            .select(`
                match_id, match_name, match_date, status, video_url, locked_by, locked_at, assigned_to, created_by,
                home_team:teams!home_team_id(team_name),
                away_team:teams!away_team_id(team_name)
            `)
            .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch all analysts for assignment dropdown
        const { data: analysts } = await supabase.from('profiles').select('id, username').order('username');
        const analystList = analysts || [];

        // Get lock usernames
        const lockUserIds = [...new Set(matches?.filter(m => m.locked_by).map(m => m.locked_by) || [])];
        let lockUsernames = {};
        if (lockUserIds.length > 0) {
            const { data: lockUsers } = await supabase.from('profiles').select('id, username').in('id', lockUserIds);
            (lockUsers || []).forEach(u => { lockUsernames[u.id] = u.username; });
        }

        if (!matches || matches.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 80px; background: var(--primary-light); border-radius: var(--radius-xl); border: 1px dashed var(--border);">
                    <p style="color: var(--text-muted); margin-bottom: 24px;">No matches found. Create your first match to get started.</p>
                    <a href="#create-match" class="btn btn-primary" style="width: auto; padding: 12px 32px;">+ Create New Match</a>
                </div>
            `;
            return;
        }

        grid.innerHTML = matches.map(m => {
            const isLocked = m.locked_by && m.locked_by !== user.id &&
                (Date.now() - new Date(m.locked_at).getTime() < 10 * 60 * 1000);
            const lockerName = lockUsernames[m.locked_by] || 'Someone';
            const isAssigned = m.assigned_to && m.created_by === user.id;
            const isReceivedAssignment = m.assigned_to === user.id && m.created_by !== user.id;

            // Assignment dropdown options
            const assignOptions = analystList
                .filter(a => a.id !== user.id)
                .map(a => `<option value="${a.id}" ${m.assigned_to === a.id ? 'selected' : ''}>${a.username || 'Unnamed'}</option>`)
                .join('');

            return `
            <div class="card" style="display: flex; flex-direction: column; gap: 16px; border-top: 4px solid ${m.status === 'Done' ? 'var(--success)' : m.status === 'QC' ? 'var(--warning)' : 'var(--accent)'}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h4 style="margin-bottom: 4px; font-size: 1.125rem;">${m.match_name}</h4>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
                            ${new Date(m.match_date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                        </div>
                        ${isReceivedAssignment ? '<div style="font-size: 0.65rem; color: var(--warning); margin-top: 4px; font-weight: 600;">ASSIGNED TO YOU</div>' : ''}
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                        <span style="background: ${getStatusColor(m.status)}; color: white; padding: 4px 10px; border-radius: 99px; font-size: 0.625rem; font-weight: 700; text-transform: uppercase;">
                            ${m.status === 'Doing' ? 'Tagging' : m.status}
                        </span>
                        ${isLocked ? `<span style="font-size: 0.6rem; color: var(--danger); font-weight: 600;">LOCKED by ${lockerName}</span>` : ''}
                    </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--primary-light); border-radius: var(--radius-md);">
                    <div style="text-align: center; flex: 1;">
                        <div style="font-weight: 600; font-size: 0.875rem;">${m.home_team.team_name}</div>
                        <div style="font-size: 0.625rem; color: var(--text-muted);">HOME</div>
                    </div>
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); padding: 0 12px;">VS</div>
                    <div style="text-align: center; flex: 1;">
                        <div style="font-weight: 600; font-size: 0.875rem;">${m.away_team.team_name}</div>
                        <div style="font-size: 0.625rem; color: var(--text-muted);">AWAY</div>
                    </div>
                </div>

                ${m.created_by === user.id ? `
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                    <label style="font-weight: 600; display: block; margin-bottom: 4px;">Assign to analyst:</label>
                    <select class="form-input assign-match-select" data-match-id="${m.match_id}" style="padding: 6px 10px; font-size: 0.75rem;">
                        <option value="">None (myself)</option>
                        ${assignOptions}
                    </select>
                </div>
                ` : ''}

                <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
                    ${getActionBtn(m, isLocked)}
                </div>
            </div>
        `}).join('');

        // Assign match event handlers
        grid.querySelectorAll('.assign-match-select').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const matchId = e.target.dataset.matchId;
                const assigneeId = e.target.value || null;
                const { error } = await supabase.from('matches').update({ assigned_to: assigneeId }).eq('match_id', matchId);
                if (error) {
                    alert('Assignment failed: ' + error.message);
                }
            });
        });

    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div style="grid-column: 1/-1; color: var(--danger); text-align: center;">Error loading matches: ${err.message}</div>`;
    }
}

function getStatusColor(status) {
    if (status === 'Done') return 'var(--success)';
    if (status === 'QC') return 'var(--warning)';
    return 'var(--accent)';
}

function getActionBtn(match, isLocked) {
    const lockWarning = isLocked ? ' (LOCKED)' : '';

    if (match.status === 'Doing') {
        return `<a href="#tagger?id=${match.match_id}" class="btn btn-primary">Start Tagging${lockWarning}</a>`;
    }
    if (match.status === 'QC') {
        return `
            <a href="#tagger?id=${match.match_id}" class="btn btn-ghost" style="border: 1px solid var(--border);">Edit Tags${lockWarning}</a>
            <a href="#qc?id=${match.match_id}" class="btn btn-primary" style="background: var(--warning);">Open QC Portal</a>
        `;
    }
    if (match.status === 'Done') {
        return `
            <a href="#qc?id=${match.match_id}" class="btn btn-primary" style="background: var(--success);">View Analysis & Export</a>
        `;
    }
    return '';
}

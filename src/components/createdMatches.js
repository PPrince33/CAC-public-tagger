import { supabase } from '../supabase'

export function MatchesView() {
    return `
        <div class="fade-in">
            <header class="page-header">
                <h1 class="page-title">My Created Matches</h1>
                <p class="page-subtitle">Select a match to start or resume tagging</p>
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
        const { data: matches, error } = await supabase
            .from('matches')
            .select(`
                match_id, match_name, match_date, status, video_url,
                home_team:teams!home_team_id(team_name),
                away_team:teams!away_team_id(team_name)
            `)
            .eq('created_by', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!matches || matches.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 80px; background: var(--primary-light); border-radius: var(--radius-xl); border: 1px dashed var(--border);">
                    <p style="color: var(--text-muted); margin-bottom: 24px;">No matches found. Create your first match to get started.</p>
                    <a href="#create-match" class="btn btn-primary" style="width: auto; padding: 12px 32px;">➕ Create New Match</a>
                </div>
            `;
            return;
        }

        grid.innerHTML = matches.map(m => `
            <div class="card" style="display: flex; flex-direction: column; gap: 16px; border-top: 4px solid ${m.status === 'Done' ? 'var(--success)' : m.status === 'QC' ? 'var(--warning)' : 'var(--accent)'}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h4 style="margin-bottom: 4px; font-size: 1.125rem;">${m.match_name}</h4>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
                            ${new Date(m.match_date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                        </div>
                    </div>
                    <span style="background: ${getStatusColor(m.status)}; color: white; padding: 4px 10px; border-radius: 99px; font-size: 0.625rem; font-weight: 700; text-transform: uppercase;">
                        ${m.status === 'Doing' ? 'Tagging' : m.status}
                    </span>
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

                <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
                    ${getActionBtn(m)}
                </div>
            </div>
        `).join('');

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

function getActionBtn(match) {
    if (match.status === 'Doing') {
        return `<a href="#tagger?id=${match.match_id}" class="btn btn-primary">🎬 Start Tagging</a>`;
    }
    if (match.status === 'QC') {
        return `
            <a href="#tagger?id=${match.match_id}" class="btn btn-ghost" style="border: 1px solid var(--border);">📝 Edit Tags</a>
            <a href="#qc?id=${match.match_id}" class="btn btn-primary" style="background: var(--warning);">🔍 Open QC Portal</a>
        `;
    }
    if (match.status === 'Done') {
        return `
            <a href="#qc?id=${match.match_id}" class="btn btn-primary" style="background: var(--success);">📊 View Analysis & Export</a>
        `;
    }
    return '';
}

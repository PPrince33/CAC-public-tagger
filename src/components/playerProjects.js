import { supabase } from '../supabase'
import { listProjects, createProject, existingProcessedMatchesFor, refreshProjectStatus, reportUrl, FREE_AGENT_TEAM } from '../lib/playerProjects'

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const STATUS_COLOR = { tagging: 'var(--warning)', ready: 'var(--success)', delivered: 'var(--accent)' }

export function PlayerProjectsView() {
    return `
        <div class="fade-in">
            <header class="page-header" style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px;">
                <div>
                    <h1 class="page-title">Player Projects</h1>
                    <p class="page-subtitle">One player, several matches, one report</p>
                </div>
                <button id="pp-new-btn" class="btn btn-primary" style="width: auto; padding: 10px 24px;">+ New Project</button>
            </header>

            <section id="pp-form-card" class="card" style="display: none; margin-bottom: 32px;">
                <h3 style="margin-bottom: 20px;">New Player Project</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
                    <div>
                        <h4 style="margin-bottom: 12px;">1. Player</h4>
                        <div class="form-group">
                            <label class="form-label">Search existing players</label>
                            <input type="text" id="pp-search" class="form-input" placeholder="Type at least 2 letters...">
                            <div id="pp-results" style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px; max-height: 200px; overflow-y: auto;"></div>
                        </div>
                        <div id="pp-selected" style="display: none; padding: 10px 12px; background: var(--primary-light); border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 12px;"></div>
                        <details id="pp-new-player">
                            <summary style="cursor: pointer; font-size: 0.875rem; font-weight: 600;">+ Create a new player</summary>
                            <div style="margin-top: 12px;">
                                <div class="form-group"><label class="form-label">Name</label><input type="text" id="pp-new-name" class="form-input"></div>
                                <div class="form-group"><label class="form-label">Position</label>
                                    <select id="pp-new-position" class="form-input"><option value="">—</option><option>GK</option><option>DF</option><option>MF</option><option>FW</option></select></div>
                                <div class="form-group"><label class="form-label">Current team <span style="font-weight: 400; color: var(--text-muted);">(blank = Free agent)</span></label>
                                    <input type="text" id="pp-new-team" class="form-input" placeholder="${FREE_AGENT_TEAM}"></div>
                            </div>
                        </details>
                    </div>
                    <div>
                        <h4 style="margin-bottom: 12px;">Project</h4>
                        <div class="form-group"><label class="form-label">Title <span style="font-weight: 400; color: var(--text-muted);">(optional)</span></label>
                            <input type="text" id="pp-title" class="form-input" placeholder="e.g. Scouting report – spring 2026"></div>
                        <div class="form-group"><label class="form-label">Client</label>
                            <select id="pp-client" class="form-input"><option value="player">Player</option><option value="club">Club</option><option value="academy">Academy</option></select></div>
                    </div>
                </div>

                <h4 style="margin: 24px 0 12px;">2. Matches to tag <span style="font-weight: 400; font-size: 0.8rem; color: var(--text-muted);">(one row per video)</span></h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8125rem;">
                        <thead><tr style="text-align: left; color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">
                            <th style="padding: 4px;">Video URL</th><th style="padding: 4px;">Player's team</th><th style="padding: 4px;">Opponent</th>
                            <th style="padding: 4px;">Date</th><th style="padding: 4px;">Competition</th><th style="padding: 4px;">Format</th><th style="padding: 4px;">Side</th><th></th>
                        </tr></thead>
                        <tbody id="pp-rows"></tbody>
                    </table>
                </div>
                <button id="pp-add-row" class="btn btn-ghost" style="width: auto; padding: 4px 12px; margin-top: 8px; border: 1px solid var(--border); font-size: 0.8rem;">+ Add match</button>

                <h4 style="margin: 24px 0 8px;">3. Add existing matches <span style="font-weight: 400; font-size: 0.8rem; color: var(--text-muted);">(already processed, player in lineup)</span></h4>
                <div id="pp-existing" style="font-size: 0.8125rem; color: var(--text-muted);">Pick a player first.</div>

                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; align-items: center;">
                    <span id="pp-status" style="font-size: 0.875rem;"></span>
                    <button id="pp-cancel" class="btn btn-ghost" style="width: auto; padding: 10px 20px; border: 1px solid var(--border);">Cancel</button>
                    <button id="pp-save" class="btn btn-primary" style="width: auto; padding: 10px 32px;">Create Project</button>
                </div>
            </section>

            <div id="pp-list" style="display: flex; flex-direction: column; gap: 16px;">
                <div style="text-align: center; padding: 48px; color: var(--text-muted);">Loading projects...</div>
            </div>
        </div>
    `;
}

let selectedPlayer = null;

export async function initPlayerProjects() {
    selectedPlayer = null;
    const card = document.getElementById('pp-form-card');
    document.getElementById('pp-new-btn').onclick = () => {
        card.style.display = 'block';
        if (!document.querySelector('#pp-rows tr')) { addRow(); addRow(); addRow(); }
    };
    document.getElementById('pp-cancel').onclick = () => { card.style.display = 'none'; };
    document.getElementById('pp-add-row').onclick = () => addRow();
    document.getElementById('pp-save').onclick = saveProject;
    initPlayerSearch();
    await renderList();
}

/* ── Project list ───────────────────────────────── */
async function renderList() {
    const list = document.getElementById('pp-list');
    try {
        const projects = await listProjects();
        if (!projects.length) {
            list.innerHTML = `<div class="card" style="text-align: center; padding: 48px; color: var(--text-muted);">No player projects yet. Click <strong>+ New Project</strong> to start one.</div>`;
            return;
        }
        list.innerHTML = projects.map(p => {
            const total = p.matches.length, done = p.processedCount;
            const allDone = total > 0 && done === total;
            const next = p.matches.find(m => !m.processed);
            const pl = p.players || {};
            return `
            <div class="card" style="border-left: 4px solid ${STATUS_COLOR[p.status] || 'var(--border)'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 1.05rem; font-weight: 700;">${esc(pl.player_name || 'Unknown player')}
                            <span style="font-weight: 400; color: var(--text-muted); font-size: 0.8rem;">${esc(pl.position || '')} · ${esc(pl.teams?.team_name || '')}</span></div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${esc(p.title || 'Untitled project')} · ${esc(p.client_type || '—')} client</div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <span style="font-family: var(--font-mono); font-size: 0.8rem;">${done}/${total} processed</span>
                        <span style="background: ${STATUS_COLOR[p.status] || 'var(--border)'}; color: #fff; padding: 3px 10px; border-radius: 99px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase;">${esc(p.status)}</span>
                        ${next ? `<a href="#tagger?id=${next.match_id}&project=${p.project_id}" class="btn btn-primary" style="width: auto; padding: 6px 14px; font-size: 0.8rem;">Tag next match</a>` : ''}
                        ${allDone ? `<button class="btn btn-ghost pp-copy" data-url="${esc(reportUrl(p))}" style="width: auto; padding: 6px 14px; font-size: 0.8rem; border: 1px solid var(--border);">Report link</button>` : ''}
                    </div>
                </div>
                <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem;">
                    ${p.matches.map(m => `
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${m.processed ? 'var(--success)' : 'var(--border)'}; flex-shrink: 0;" title="${m.processed ? 'Processed' : 'Not processed yet'}"></span>
                            <span style="font-family: var(--font-mono); color: var(--text-muted);">${esc(m.match_date || '')}</span>
                            <a href="#tagger?id=${m.match_id}&project=${p.project_id}" style="color: inherit;">${esc(m.home_team?.team_name)} vs ${esc(m.away_team?.team_name)}</a>
                            <span style="color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">${esc(m.tagging_mode || 'full')}</span>
                        </div>`).join('')}
                </div>
            </div>`;
        }).join('');

        list.querySelectorAll('.pp-copy').forEach(b => b.onclick = async () => {
            try { await navigator.clipboard.writeText(b.dataset.url); b.innerText = 'Copied!'; }
            catch { prompt('Copy the report link:', b.dataset.url); }
            setTimeout(() => { b.innerText = 'Report link'; }, 1500);
        });

        // Keep server-side status in sync (e.g. matches processed from QC)
        projects.forEach(p => {
            const ready = p.matches.length > 0 && p.processedCount === p.matches.length;
            if ((ready && p.status === 'tagging') || (!ready && p.status === 'ready')) refreshProjectStatus(p.project_id).catch(() => {});
        });
    } catch (err) {
        list.innerHTML = `<div class="card" style="color: var(--danger);">Could not load projects: ${esc(err.message)}<br><span style="color: var(--text-muted); font-size: 0.8rem;">Has supabase/player_projects.sql been run?</span></div>`;
    }
}

/* ── New project form ───────────────────────────── */
function addRow() {
    const tr = document.createElement('tr');
    const team = selectedPlayer?.team_name && selectedPlayer.team_name !== FREE_AGENT_TEAM ? selectedPlayer.team_name : (document.getElementById('pp-new-team')?.value || '');
    tr.innerHTML = `
        <td style="padding: 4px;"><input type="url" class="form-input pp-url" placeholder="https://youtube.com/..." style="min-width: 220px; margin: 0;"></td>
        <td style="padding: 4px;"><input type="text" class="form-input pp-team" value="${esc(team)}" placeholder="${FREE_AGENT_TEAM}" style="min-width: 140px; margin: 0;"></td>
        <td style="padding: 4px;"><input type="text" class="form-input pp-opp" placeholder="Opponent" style="min-width: 140px; margin: 0;"></td>
        <td style="padding: 4px;"><input type="date" class="form-input pp-date" style="margin: 0;"></td>
        <td style="padding: 4px;"><input type="text" class="form-input pp-comp" placeholder="optional" style="min-width: 110px; margin: 0;"></td>
        <td style="padding: 4px;"><select class="form-input pp-futsal" style="margin: 0;"><option value="false">11-a-side</option><option value="true">Futsal</option></select></td>
        <td style="padding: 4px;"><select class="form-input pp-home" style="margin: 0;"><option value="true">Home</option><option value="false">Away</option></select></td>
        <td style="padding: 4px;"><button type="button" class="btn btn-ghost pp-del" style="width: auto; padding: 4px 8px;" title="Remove row">✕</button></td>`;
    tr.querySelector('.pp-del').onclick = () => tr.remove();
    document.getElementById('pp-rows').appendChild(tr);
}

function initPlayerSearch() {
    const search = document.getElementById('pp-search');
    const results = document.getElementById('pp-results');
    let timer = null, seq = 0;
    search.addEventListener('input', () => {
        clearTimeout(timer);
        const q = search.value.trim();
        if (q.length < 2) { results.innerHTML = ''; return; }
        timer = setTimeout(async () => {
            const mySeq = ++seq;
            const { data, error } = await supabase.from('players')
                .select('player_id, player_name, position, teams(team_name)')
                .ilike('player_name', `%${q}%`).eq('is_placeholder', false).order('player_name').limit(20);
            if (mySeq !== seq) return;
            if (error) { results.innerHTML = `<span style="color: var(--danger);">${esc(error.message)}</span>`; return; }
            results.innerHTML = (data || []).length ? '' : '<span style="color: var(--text-muted); font-size: 0.8rem;">No players found. Create a new one below.</span>';
            (data || []).forEach(p => {
                const b = document.createElement('button');
                b.type = 'button'; b.className = 'btn btn-ghost';
                b.style.cssText = 'text-align: left; padding: 6px 10px; font-size: 0.8125rem; border: 1px solid var(--border);';
                b.innerHTML = `<strong>${esc(p.player_name)}</strong> ${p.position ? '· ' + esc(p.position) : ''} <span style="color: var(--text-muted);">· ${esc(p.teams?.team_name || 'No team')}</span>`;
                b.onclick = () => selectPlayer({ player_id: p.player_id, player_name: p.player_name, position: p.position, team_name: p.teams?.team_name });
                results.appendChild(b);
            });
        }, 250);
    });
}

async function selectPlayer(p) {
    selectedPlayer = p;
    document.getElementById('pp-results').innerHTML = '';
    document.getElementById('pp-search').value = '';
    const box = document.getElementById('pp-selected');
    if (!p) { box.style.display = 'none'; document.getElementById('pp-existing').innerHTML = 'Pick a player first.'; return; }
    box.style.display = 'block';
    box.innerHTML = `Selected: <strong>${esc(p.player_name)}</strong> ${p.position ? '(' + esc(p.position) + ')' : ''} <span style="color: var(--text-muted);">${esc(p.team_name || '')}</span>
        <button type="button" id="pp-clear" class="btn btn-ghost" style="width: auto; padding: 2px 8px; font-size: 0.75rem; margin-left: 8px;">Change</button>`;
    document.getElementById('pp-clear').onclick = () => selectPlayer(null);

    // Pre-fill empty team cells with the player's current team
    if (p.team_name && p.team_name !== FREE_AGENT_TEAM)
        document.querySelectorAll('#pp-rows .pp-team').forEach(i => { if (!i.value) i.value = p.team_name; });

    const wrap = document.getElementById('pp-existing');
    wrap.innerHTML = 'Loading...';
    const ms = await existingProcessedMatchesFor(p.player_id);
    if (selectedPlayer !== p) return;
    wrap.innerHTML = ms.length ? ms.map(m => `
        <label style="display: flex; gap: 8px; align-items: center; padding: 3px 0; color: var(--text-main);">
            <input type="checkbox" class="pp-existing-cb" value="${m.match_id}">
            <span style="font-family: var(--font-mono); color: var(--text-muted);">${esc(m.match_date || '')}</span>
            ${esc(m.home_team?.team_name)} vs ${esc(m.away_team?.team_name)}
            <span style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted);">${esc(m.tagging_mode || 'full')}</span>
        </label>`).join('') : 'No processed matches with this player yet.';
}

async function saveProject() {
    const status = document.getElementById('pp-status');
    const btn = document.getElementById('pp-save');
    const newName = document.getElementById('pp-new-name').value.trim();
    const rows = [...document.querySelectorAll('#pp-rows tr')].map(tr => ({
        videoUrl: tr.querySelector('.pp-url').value.trim(),
        teamName: tr.querySelector('.pp-team').value.trim(),
        opponent: tr.querySelector('.pp-opp').value.trim(),
        date: tr.querySelector('.pp-date').value,
        competition: tr.querySelector('.pp-comp').value.trim(),
        isFutsal: tr.querySelector('.pp-futsal').value === 'true',
        isHome: tr.querySelector('.pp-home').value === 'true',
    })).filter(r => r.videoUrl || r.opponent || r.date);
    const existingMatchIds = [...document.querySelectorAll('.pp-existing-cb:checked')].map(c => c.value);

    const problems = [];
    if (!selectedPlayer && !newName) problems.push('Pick or create a player.');
    rows.forEach((r, i) => {
        if (!r.videoUrl) problems.push(`Row ${i + 1}: video URL is missing.`);
        if (!r.date) problems.push(`Row ${i + 1}: date is missing.`);
        if (!r.opponent) problems.push(`Row ${i + 1}: opponent is missing.`);
    });
    if (!rows.length && !existingMatchIds.length) problems.push('Add at least one match.');
    if (problems.length) { alert(problems.join('\n')); return; }

    btn.disabled = true; btn.innerText = 'Creating...';
    status.style.color = 'var(--text-muted)'; status.innerText = `Creating ${rows.length} match(es)...`;
    try {
        const player = selectedPlayer || {
            newName,
            position: document.getElementById('pp-new-position').value || null,
            teamName: document.getElementById('pp-new-team').value.trim(),
        };
        await createProject({
            player,
            title: document.getElementById('pp-title').value.trim(),
            clientType: document.getElementById('pp-client').value,
            rows, existingMatchIds,
        });
        status.style.color = 'var(--success)'; status.innerText = 'Project created.';
        document.getElementById('pp-form-card').style.display = 'none';
        document.getElementById('pp-rows').innerHTML = '';
        selectPlayer(null);
        await renderList();
    } catch (err) {
        console.error(err);
        status.style.color = 'var(--danger)'; status.innerText = 'Error: ' + err.message;
    } finally { btn.disabled = false; btn.innerText = 'Create Project'; }
}

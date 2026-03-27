import { supabase } from '../supabase'
import { exportToExcel, exportToCSV } from '../lib/excelExport'

/* ──────────────────────────────────────────
   MODULE STATE
   ────────────────────────────────────────── */
let allMatches = [];
let allTeams = [];
let allPlayers = [];
let allUsers = [];
let teamStats = {};
let playerStats = {};
let mergeTeamSource = null;
let mergeTeamTarget = null;
let mergePlayerSource = null;
let mergePlayerTarget = null;
let selectedMatchIds = new Set();

/* ──────────────────────────────────────────
   VIEW
   ────────────────────────────────────────── */
export function AdminPortalView() {
    return `
    <style>
        .admin-tabs { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 2px solid var(--border); padding-bottom: 0; flex-wrap: wrap; }
        .admin-tab { padding: 10px 20px; border: 1px solid transparent; border-bottom: none; border-radius: var(--radius-md) var(--radius-md) 0 0; background: transparent; cursor: pointer; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); font-family: inherit; transition: all 0.15s; }
        .admin-tab:hover { color: var(--text-main); background: var(--row-hover); }
        .admin-tab.active { color: var(--text-main); background: var(--bg-card); border-color: var(--border); margin-bottom: -2px; border-bottom: 2px solid var(--bg-card); }
        .admin-section { display: none; }
        .admin-section.visible { display: block; }

        .admin-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; font-family: var(--font-mono); }
        .admin-table th { padding: 10px 12px; text-align: left; background: var(--primary-light); color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid var(--border); white-space: nowrap; }
        .admin-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
        .admin-table tr:hover { background: var(--row-hover); }

        .admin-status { padding: 3px 10px; border-radius: 99px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; display: inline-block; }

        .admin-search { margin-bottom: 16px; }

        .merge-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .merge-col h4 { margin-bottom: 8px; font-size: 0.85rem; }
        .merge-list { max-height: 280px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-md); }
        .merge-item { padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border); font-size: 0.8rem; transition: background 0.1s; }
        .merge-item:last-child { border-bottom: none; }
        .merge-item:hover { background: var(--row-hover); }
        .merge-item.selected { background: var(--row-selected); border-left: 3px solid var(--accent); }
        .merge-item .merge-meta { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }

        .merge-summary { padding: 12px 16px; background: var(--primary-light); border: 1px solid var(--border); border-radius: var(--radius-md); margin: 16px 0; font-size: 0.8rem; }

        .dl-btn { background: none; border: 1px solid var(--border); color: var(--text-main); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: 600; font-family: inherit; transition: all 0.15s; }
        .dl-btn:hover { background: var(--hover-bg); border-color: var(--hover-border); }
        .dl-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .bulk-bar { display: flex; gap: 8px; align-items: center; padding: 10px 16px; background: var(--primary-light); border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 16px; flex-wrap: wrap; }
        .bulk-bar .bulk-count { font-size: 0.8rem; font-weight: 700; color: var(--accent); }

        .assign-select { padding: 4px 8px; font-size: 0.7rem; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-input); color: var(--text-main); font-family: inherit; }

        @media (max-width: 768px) {
            .merge-columns { grid-template-columns: 1fr; }
        }
    </style>

    <div class="fade-in">
        <header class="page-header">
            <h1 class="page-title">Admin Portal</h1>
            <p class="page-subtitle">Global data management, downloads, and cleanup tools</p>
        </header>

        <div class="admin-tabs">
            <button class="admin-tab active" data-tab="matches">Matches</button>
            <button class="admin-tab" data-tab="users">Users</button>
            <button class="admin-tab" data-tab="teams">Merge Teams</button>
            <button class="admin-tab" data-tab="players">Merge Players</button>
        </div>

        <!-- MATCHES TAB -->
        <section id="admin-tab-matches" class="admin-section visible">
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
                    <h3 style="margin: 0;">All Matches</h3>
                    <input id="admin-match-search" class="form-input admin-search" style="width: 280px; margin: 0;" type="text" placeholder="Search matches...">
                </div>

                <!-- Bulk Operations Bar -->
                <div id="bulk-bar" class="bulk-bar" style="display: none;">
                    <span class="bulk-count" id="bulk-count">0 selected</span>
                    <button class="dl-btn" id="bulk-status-doing">Set: Doing</button>
                    <button class="dl-btn" id="bulk-status-qc">Set: QC</button>
                    <button class="dl-btn" id="bulk-status-done">Set: Done</button>
                    <button class="dl-btn" id="bulk-export-xlsx">Export XLSX</button>
                    <button class="dl-btn" id="bulk-export-csv">Export CSV</button>
                    <button class="dl-btn" id="bulk-delete" style="color: var(--danger); border-color: var(--danger);">Delete</button>
                    <button class="dl-btn" id="bulk-clear">Clear Selection</button>
                </div>

                <div style="overflow-x: auto;">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th style="width: 30px;"><input type="checkbox" id="select-all-matches" title="Select all"></th>
                                <th>Match</th>
                                <th>Home</th>
                                <th>Away</th>
                                <th>Creator</th>
                                <th>Assigned To</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Events</th>
                                <th>Type</th>
                                <th>Download</th>
                            </tr>
                        </thead>
                        <tbody id="admin-matches-tbody">
                            <tr><td colspan="11" style="text-align: center; padding: 40px; color: var(--text-muted);">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>

        <!-- USERS TAB -->
        <section id="admin-tab-users" class="admin-section">
            <div class="card">
                <h3 style="margin-bottom: 16px;">User Management</h3>
                <div style="overflow-x: auto;">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Role</th>
                                <th style="text-align: center;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="admin-users-tbody"></tbody>
                    </table>
                </div>
            </div>
        </section>

        <!-- TEAM MERGE TAB -->
        <section id="admin-tab-teams" class="admin-section">
            <div class="card">
                <h3 style="margin-bottom: 8px;">Merge Teams</h3>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 20px;">
                    Combine duplicate teams. All matches, players, and events from Source will be reassigned to Target, then Source is deleted.
                </p>
                <input id="admin-team-search" class="form-input" type="text" placeholder="Search teams..." style="margin-bottom: 16px;">
                <div class="merge-columns">
                    <div class="merge-col">
                        <h4 style="color: var(--danger);">Source (to delete)</h4>
                        <div class="merge-list" id="merge-team-source-list"></div>
                    </div>
                    <div class="merge-col">
                        <h4 style="color: var(--success);">Target (to keep)</h4>
                        <div class="merge-list" id="merge-team-target-list"></div>
                    </div>
                </div>
                <div class="merge-summary" id="merge-team-summary" style="display: none;"></div>
                <button id="btn-merge-teams" class="btn btn-primary" style="background: var(--warning); color: black; margin-top: 8px;" disabled>Merge Teams</button>
            </div>
        </section>

        <!-- PLAYER MERGE TAB -->
        <section id="admin-tab-players" class="admin-section">
            <div class="card">
                <h3 style="margin-bottom: 8px;">Merge Players</h3>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 20px;">
                    Combine duplicate players. All events and lineups from Source will be reassigned to Target, then Source is deleted.
                </p>
                <input id="admin-player-search" class="form-input" type="text" placeholder="Search players..." style="margin-bottom: 16px;">
                <div class="merge-columns">
                    <div class="merge-col">
                        <h4 style="color: var(--danger);">Source (to delete)</h4>
                        <div class="merge-list" id="merge-player-source-list"></div>
                    </div>
                    <div class="merge-col">
                        <h4 style="color: var(--success);">Target (to keep)</h4>
                        <div class="merge-list" id="merge-player-target-list"></div>
                    </div>
                </div>
                <div class="merge-summary" id="merge-player-summary" style="display: none;"></div>
                <button id="btn-merge-players" class="btn btn-primary" style="background: var(--warning); color: black; margin-top: 8px;" disabled>Merge Players</button>
            </div>
        </section>
    </div>
    `;
}

/* ──────────────────────────────────────────
   INIT
   ────────────────────────────────────────── */
export async function initAdminPortal() {
    // Tab switching
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('visible'));
            tab.classList.add('active');
            document.getElementById(`admin-tab-${tab.dataset.tab}`).classList.add('visible');
        });
    });

    // Load all sections in parallel
    await Promise.all([
        fetchAdminMatches(),
        fetchAdminUsers(),
        fetchTeamMergeData(),
        fetchPlayerMergeData(),
    ]);

    // Search handlers
    document.getElementById('admin-match-search').addEventListener('input', renderMatchRows);
    document.getElementById('admin-team-search').addEventListener('input', () => renderTeamMergeLists());
    document.getElementById('admin-player-search').addEventListener('input', () => renderPlayerMergeLists());

    // Merge buttons
    document.getElementById('btn-merge-teams').addEventListener('click', () => handleMerge('teams'));
    document.getElementById('btn-merge-players').addEventListener('click', () => handleMerge('players'));

    // Download / action delegation
    document.getElementById('admin-matches-tbody').addEventListener('click', handleMatchAction);

    // Select all checkbox
    document.getElementById('select-all-matches').addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (checked) {
            allMatches.forEach(m => selectedMatchIds.add(m.match_id));
        } else {
            selectedMatchIds.clear();
        }
        renderMatchRows();
        updateBulkBar();
    });

    // Bulk operation buttons
    document.getElementById('bulk-status-doing').addEventListener('click', () => bulkChangeStatus('Doing'));
    document.getElementById('bulk-status-qc').addEventListener('click', () => bulkChangeStatus('QC'));
    document.getElementById('bulk-status-done').addEventListener('click', () => bulkChangeStatus('Done'));
    document.getElementById('bulk-export-xlsx').addEventListener('click', () => bulkExport('xlsx'));
    document.getElementById('bulk-export-csv').addEventListener('click', () => bulkExport('csv'));
    document.getElementById('bulk-delete').addEventListener('click', bulkDelete);
    document.getElementById('bulk-clear').addEventListener('click', () => {
        selectedMatchIds.clear();
        document.getElementById('select-all-matches').checked = false;
        renderMatchRows();
        updateBulkBar();
    });
}

/* ──────────────────────────────────────────
   MATCHES
   ────────────────────────────────────────── */
async function fetchAdminMatches() {
    const [matchRes, countRes, userRes] = await Promise.all([
        supabase.from('matches').select(`
            *, home_team:teams!home_team_id(team_name),
            away_team:teams!away_team_id(team_name),
            creator:profiles!created_by(username)
        `).order('created_at', { ascending: false }),
        supabase.from('match_events').select('match_id'),
        supabase.from('profiles').select('id, username, role'),
    ]);

    if (matchRes.error) {
        document.getElementById('admin-matches-tbody').innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: var(--danger);">${matchRes.error.message}</td></tr>`;
        return;
    }

    allUsers = userRes.data || [];

    const eventCounts = {};
    (countRes.data || []).forEach(e => { eventCounts[e.match_id] = (eventCounts[e.match_id] || 0) + 1; });

    allMatches = (matchRes.data || []).map(m => ({
        ...m,
        homeName: m.home_team?.team_name || '?',
        awayName: m.away_team?.team_name || '?',
        creatorName: m.creator?.username || 'Unknown',
        eventCount: eventCounts[m.match_id] || 0,
    }));

    renderMatchRows();
}

function renderMatchRows() {
    const tbody = document.getElementById('admin-matches-tbody');
    const q = (document.getElementById('admin-match-search')?.value || '').toLowerCase();

    const filtered = q ? allMatches.filter(m =>
        m.match_name.toLowerCase().includes(q) ||
        m.homeName.toLowerCase().includes(q) ||
        m.awayName.toLowerCase().includes(q) ||
        m.creatorName.toLowerCase().includes(q)
    ) : allMatches;

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: var(--text-muted);">${q ? 'No matches found.' : 'No matches in the system.'}</td></tr>`;
        return;
    }

    // Build assign-to dropdown options
    const userOptions = allUsers.map(u => `<option value="${u.id}">${u.username || 'Unnamed'}</option>`).join('');

    tbody.innerHTML = filtered.map(m => {
        const sc = statusStyle(m.status);
        const date = m.match_date ? new Date(m.match_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '-';
        const isChecked = selectedMatchIds.has(m.match_id) ? 'checked' : '';
        const assignedUser = allUsers.find(u => u.id === m.assigned_to);
        const assignedName = assignedUser?.username || '-';

        return `
        <tr>
            <td><input type="checkbox" class="match-checkbox" data-match-id="${m.match_id}" ${isChecked}></td>
            <td><strong>${m.match_name}</strong></td>
            <td>${m.homeName}</td>
            <td>${m.awayName}</td>
            <td>${m.creatorName}</td>
            <td>
                <select class="assign-select" data-assign-match="${m.match_id}">
                    <option value="">Unassigned</option>
                    ${userOptions}
                </select>
            </td>
            <td style="white-space: nowrap;">${date}</td>
            <td><span class="admin-status" style="background: ${sc.bg}; color: ${sc.color};">${m.status}</span></td>
            <td style="text-align: center;">${m.eventCount}</td>
            <td>${m.is_futsal ? 'Futsal' : '11v11'}</td>
            <td style="white-space: nowrap;">
                <button class="dl-btn" data-action="xlsx" data-id="${m.match_id}" data-name="${m.match_name}">XLSX</button>
                <button class="dl-btn" data-action="csv" data-id="${m.match_id}" data-name="${m.match_name}">CSV</button>
            </td>
        </tr>`;
    }).join('');

    // Checkbox event delegation
    tbody.querySelectorAll('.match-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const matchId = e.target.dataset.matchId;
            if (e.target.checked) {
                selectedMatchIds.add(matchId);
            } else {
                selectedMatchIds.delete(matchId);
            }
            updateBulkBar();
        });
    });

    // Assign-to dropdowns
    tbody.querySelectorAll('.assign-select').forEach(sel => {
        // Set current value
        const matchId = sel.dataset.assignMatch;
        const match = allMatches.find(m => m.match_id === matchId);
        if (match?.assigned_to) sel.value = match.assigned_to;

        sel.addEventListener('change', async (e) => {
            const newAssignee = e.target.value || null;
            const { error } = await supabase.from('matches').update({ assigned_to: newAssignee }).eq('match_id', matchId);
            if (error) {
                alert('Failed to assign: ' + error.message);
            }
        });
    });
}

function updateBulkBar() {
    const bar = document.getElementById('bulk-bar');
    const count = document.getElementById('bulk-count');
    if (selectedMatchIds.size > 0) {
        bar.style.display = 'flex';
        count.textContent = `${selectedMatchIds.size} selected`;
    } else {
        bar.style.display = 'none';
    }
}

function statusStyle(status) {
    if (status === 'Done') return { bg: 'var(--success)', color: 'white' };
    if (status === 'QC') return { bg: 'var(--warning)', color: 'black' };
    return { bg: 'var(--accent)', color: 'white' };
}

/* ──────────────────────────────────────────
   BULK OPERATIONS
   ────────────────────────────────────────── */
async function bulkChangeStatus(newStatus) {
    if (selectedMatchIds.size === 0) return;
    if (!confirm(`Change ${selectedMatchIds.size} matches to "${newStatus}"?`)) return;

    const ids = [...selectedMatchIds];
    const { error } = await supabase.from('matches').update({ status: newStatus }).in('match_id', ids);
    if (error) {
        alert('Bulk status change failed: ' + error.message);
    } else {
        selectedMatchIds.clear();
        document.getElementById('select-all-matches').checked = false;
        await fetchAdminMatches();
        updateBulkBar();
    }
}

async function bulkExport(format) {
    if (selectedMatchIds.size === 0) return;
    const ids = [...selectedMatchIds];

    for (const id of ids) {
        const match = allMatches.find(m => m.match_id === id);
        if (!match) continue;
        try {
            const enriched = await fetchEnrichedEvents(id);
            if (!enriched || !enriched.length) continue;
            const filename = `Bulk_${match.match_name.replace(/\s+/g, '_')}`;
            if (format === 'xlsx') exportToExcel(enriched, filename);
            else exportToCSV(enriched, filename);
        } catch (err) {
            console.error(`Export failed for ${id}:`, err);
        }
    }
}

async function bulkDelete() {
    if (selectedMatchIds.size === 0) return;
    if (!confirm(`PERMANENTLY DELETE ${selectedMatchIds.size} matches and all their events? This cannot be undone!`)) return;
    if (!confirm(`Are you REALLY sure? Type the number of matches to confirm.`)) return;

    const ids = [...selectedMatchIds];
    for (const id of ids) {
        // Delete events first, then lineups, then match
        await supabase.from('match_events').delete().eq('match_id', id);
        await supabase.from('processed_match_events').delete().eq('match_id', id);
        await supabase.from('lineups').delete().eq('match_id', id);
        await supabase.from('matches').delete().eq('match_id', id);
    }

    selectedMatchIds.clear();
    document.getElementById('select-all-matches').checked = false;
    await fetchAdminMatches();
    updateBulkBar();
    alert(`${ids.length} matches deleted.`);
}

/* ──────────────────────────────────────────
   DOWNLOAD
   ────────────────────────────────────────── */
async function handleMatchAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const { action, id, name } = btn.dataset;
    if (action !== 'xlsx' && action !== 'csv') return;

    btn.disabled = true;
    btn.textContent = '...';

    try {
        const enriched = await fetchEnrichedEvents(id);
        if (!enriched || !enriched.length) {
            alert('No processed data found. Process this match in the QC portal first.');
            return;
        }
        const filename = `Admin_${name.replace(/\s+/g, '_')}`;
        if (action === 'xlsx') exportToExcel(enriched, filename);
        else exportToCSV(enriched, filename);
    } catch (err) {
        alert('Download failed: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = btn.dataset.action.toUpperCase();
    }
}

async function fetchEnrichedEvents(matchId) {
    const [evRes, mdRes] = await Promise.all([
        supabase.from('processed_match_events').select('*').eq('match_id', matchId).order('match_time_seconds'),
        supabase.from('matches').select('home_team_id, away_team_id').eq('match_id', matchId).single(),
    ]);

    const events = evRes.data;
    if (!events || !events.length) return null;
    if (!mdRes.data) return events;

    const [plRes, luRes] = await Promise.all([
        supabase.from('players').select('player_id, player_name, team_id, teams(team_name)').in('team_id', [mdRes.data.home_team_id, mdRes.data.away_team_id]),
        supabase.from('lineups').select('player_id, jersey_no').eq('match_id', matchId),
    ]);

    const playerMap = {};
    (plRes.data || []).forEach(p => {
        const lu = (luRes.data || []).find(l => l.player_id === p.player_id);
        playerMap[p.player_id] = {
            player_name: p.player_name,
            jersey_no: lu?.jersey_no ?? '',
            team_name: p.teams?.team_name || '',
        };
    });

    return events.map(e => ({
        ...e,
        act_player_name: playerMap[e.player_id]?.player_name || '',
        act_jersey_no: playerMap[e.player_id]?.jersey_no ?? '',
        act_team_name: playerMap[e.player_id]?.team_name || '',
        react_player_name: playerMap[e.reaction_player_id]?.player_name || '',
        react_jersey_no: playerMap[e.reaction_player_id]?.jersey_no ?? '',
        react_team_name: playerMap[e.reaction_player_id]?.team_name || '',
    }));
}

/* ──────────────────────────────────────────
   USERS
   ────────────────────────────────────────── */
async function fetchAdminUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    const { data: users, error } = await supabase.from('profiles').select('*').order('username');

    if (error) {
        tbody.innerHTML = `<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--danger);">Error: ${error.message}</td></tr>`;
        return;
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser();

    tbody.innerHTML = users.map(u => `
        <tr>
            <td><strong>${u.username || 'Unnamed'}</strong></td>
            <td>
                <span class="admin-status" style="background: ${u.role === 'admin' ? 'var(--accent)' : 'var(--hover-bg)'}; color: ${u.role === 'admin' ? 'white' : 'var(--text-main)'};">
                    ${u.role.toUpperCase()}
                </span>
            </td>
            <td style="text-align: center;">
                ${u.id === currentUser.id
                    ? '<span style="font-size: 0.75rem; color: var(--text-muted);">You</span>'
                    : `<button class="dl-btn" data-toggle-role="${u.id}" data-current-role="${u.role}">
                        Make ${u.role === 'admin' ? 'Analyst' : 'Admin'}
                    </button>`
                }
            </td>
        </tr>
    `).join('');

    tbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-toggle-role]');
        if (!btn) return;
        const userId = btn.dataset.toggleRole;
        const currentRole = btn.dataset.currentRole;
        const newRole = currentRole === 'admin' ? 'analyst' : 'admin';

        if (!confirm(`Change role to ${newRole.toUpperCase()}?`)) return;

        const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
        if (error) {
            alert('Error updating role: ' + error.message);
        } else {
            fetchAdminUsers();
        }
    });
}

/* ──────────────────────────────────────────
   TEAM MERGE
   ────────────────────────────────────────── */
async function fetchTeamMergeData() {
    const [teamRes, matchRes, playerRes] = await Promise.all([
        supabase.from('teams').select('team_id, team_name').order('team_name'),
        supabase.from('matches').select('home_team_id, away_team_id'),
        supabase.from('players').select('team_id'),
    ]);

    allTeams = teamRes.data || [];
    teamStats = {};
    allTeams.forEach(t => { teamStats[t.team_id] = { matchCount: 0, playerCount: 0 }; });
    (matchRes.data || []).forEach(m => {
        if (teamStats[m.home_team_id]) teamStats[m.home_team_id].matchCount++;
        if (teamStats[m.away_team_id]) teamStats[m.away_team_id].matchCount++;
    });
    (playerRes.data || []).forEach(p => {
        if (teamStats[p.team_id]) teamStats[p.team_id].playerCount++;
    });

    mergeTeamSource = null;
    mergeTeamTarget = null;
    renderTeamMergeLists();
}

function renderTeamMergeLists() {
    const q = (document.getElementById('admin-team-search')?.value || '').toLowerCase();
    const filtered = q ? allTeams.filter(t => t.team_name.toLowerCase().includes(q)) : allTeams;

    const sourceList = document.getElementById('merge-team-source-list');
    const targetList = document.getElementById('merge-team-target-list');

    const buildItems = (selectedId, role) => filtered.map(t => {
        const s = teamStats[t.team_id] || { matchCount: 0, playerCount: 0 };
        return `<div class="merge-item ${selectedId === t.team_id ? 'selected' : ''}" data-merge-role="${role}" data-id="${t.team_id}">
            <strong>${t.team_name}</strong>
            <div class="merge-meta">${s.matchCount} match${s.matchCount !== 1 ? 'es' : ''}, ${s.playerCount} player${s.playerCount !== 1 ? 's' : ''}</div>
        </div>`;
    }).join('');

    sourceList.innerHTML = buildItems(mergeTeamSource, 'source') || '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No teams found</div>';
    targetList.innerHTML = buildItems(mergeTeamTarget, 'target') || '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No teams found</div>';

    sourceList.onclick = (e) => {
        const item = e.target.closest('[data-id]');
        if (!item) return;
        mergeTeamSource = item.dataset.id;
        renderTeamMergeLists();
        updateTeamMergeSummary();
    };
    targetList.onclick = (e) => {
        const item = e.target.closest('[data-id]');
        if (!item) return;
        mergeTeamTarget = item.dataset.id;
        renderTeamMergeLists();
        updateTeamMergeSummary();
    };
}

function updateTeamMergeSummary() {
    const summary = document.getElementById('merge-team-summary');
    const btn = document.getElementById('btn-merge-teams');

    if (mergeTeamSource && mergeTeamTarget && mergeTeamSource !== mergeTeamTarget) {
        const src = allTeams.find(t => t.team_id === mergeTeamSource);
        const tgt = allTeams.find(t => t.team_id === mergeTeamTarget);
        const ss = teamStats[mergeTeamSource] || {};
        summary.innerHTML = `Merge <strong style="color: var(--danger);">${src?.team_name}</strong> (${ss.matchCount || 0} matches, ${ss.playerCount || 0} players) <strong>INTO</strong> <strong style="color: var(--success);">${tgt?.team_name}</strong>`;
        summary.style.display = 'block';
        btn.disabled = false;
    } else {
        summary.style.display = 'none';
        btn.disabled = true;
    }
}

/* ──────────────────────────────────────────
   PLAYER MERGE
   ────────────────────────────────────────── */
async function fetchPlayerMergeData() {
    const [playerRes, eventRes] = await Promise.all([
        supabase.from('players').select('player_id, player_name, team_id, teams(team_name)').order('player_name'),
        supabase.from('match_events').select('player_id, reaction_player_id'),
    ]);

    allPlayers = (playerRes.data || []).map(p => ({
        player_id: p.player_id,
        player_name: p.player_name,
        team_name: p.teams?.team_name || 'No Team',
    }));

    playerStats = {};
    (eventRes.data || []).forEach(e => {
        if (e.player_id) playerStats[e.player_id] = (playerStats[e.player_id] || 0) + 1;
        if (e.reaction_player_id) playerStats[e.reaction_player_id] = (playerStats[e.reaction_player_id] || 0) + 1;
    });

    mergePlayerSource = null;
    mergePlayerTarget = null;
    renderPlayerMergeLists();
}

function renderPlayerMergeLists() {
    const q = (document.getElementById('admin-player-search')?.value || '').toLowerCase();
    const filtered = q ? allPlayers.filter(p =>
        p.player_name.toLowerCase().includes(q) || p.team_name.toLowerCase().includes(q)
    ) : allPlayers;

    const sourceList = document.getElementById('merge-player-source-list');
    const targetList = document.getElementById('merge-player-target-list');

    const buildItems = (selectedId, role) => filtered.map(p => {
        const count = playerStats[p.player_id] || 0;
        return `<div class="merge-item ${selectedId === p.player_id ? 'selected' : ''}" data-merge-role="${role}" data-id="${p.player_id}">
            <strong>${p.player_name}</strong>
            <div class="merge-meta">${p.team_name} | ${count} event${count !== 1 ? 's' : ''}</div>
        </div>`;
    }).join('');

    sourceList.innerHTML = buildItems(mergePlayerSource, 'source') || '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No players found</div>';
    targetList.innerHTML = buildItems(mergePlayerTarget, 'target') || '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No players found</div>';

    sourceList.onclick = (e) => {
        const item = e.target.closest('[data-id]');
        if (!item) return;
        mergePlayerSource = item.dataset.id;
        renderPlayerMergeLists();
        updatePlayerMergeSummary();
    };
    targetList.onclick = (e) => {
        const item = e.target.closest('[data-id]');
        if (!item) return;
        mergePlayerTarget = item.dataset.id;
        renderPlayerMergeLists();
        updatePlayerMergeSummary();
    };
}

function updatePlayerMergeSummary() {
    const summary = document.getElementById('merge-player-summary');
    const btn = document.getElementById('btn-merge-players');

    if (mergePlayerSource && mergePlayerTarget && mergePlayerSource !== mergePlayerTarget) {
        const src = allPlayers.find(p => p.player_id === mergePlayerSource);
        const tgt = allPlayers.find(p => p.player_id === mergePlayerTarget);
        const sc = playerStats[mergePlayerSource] || 0;
        summary.innerHTML = `Merge <strong style="color: var(--danger);">${src?.player_name}</strong> (${src?.team_name}, ${sc} events) <strong>INTO</strong> <strong style="color: var(--success);">${tgt?.player_name}</strong>`;
        summary.style.display = 'block';
        btn.disabled = false;
    } else {
        summary.style.display = 'none';
        btn.disabled = true;
    }
}

/* ──────────────────────────────────────────
   MERGE HANDLER
   ────────────────────────────────────────── */
async function handleMerge(type) {
    const isTeam = type === 'teams';
    const sourceId = isTeam ? mergeTeamSource : mergePlayerSource;
    const targetId = isTeam ? mergeTeamTarget : mergePlayerTarget;

    if (!sourceId || !targetId) return;
    if (sourceId === targetId) return alert('Source and Target cannot be the same.');
    if (!confirm(`Are you sure you want to merge these ${type}? This action is permanent and cannot be undone.`)) return;

    const rpcName = isTeam ? 'merge_teams' : 'merge_players';
    const { error } = await supabase.rpc(rpcName, { source_id: sourceId, target_id: targetId });

    if (error) {
        alert(`Merge failed: ${error.message}\n\nMake sure the '${rpcName}' RPC function exists in your Supabase SQL editor.`);
    } else {
        alert('Merge successful!');
        if (isTeam) await fetchTeamMergeData();
        else await fetchPlayerMergeData();
        await fetchAdminMatches();
    }
}

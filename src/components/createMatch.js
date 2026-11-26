import * as XLSX from 'xlsx'
import { supabase } from '../supabase'
import { getOrCreateTeam, getOrCreatePlayer, createMatchRecord, addLineupRow } from '../lib/matchFactory'
import { ensurePlaceholders } from '../lib/placeholders'

export function CreateMatchView() {
    return `
        <div class="fade-in">
            <header class="page-header">
                <h1 class="page-title">Initialize New Match</h1>
                <p class="page-subtitle">Set up match metadata and upload players roster</p>
            </header>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
                <section class="card">
                    <h3 style="margin-bottom: 24px;">Match Metadata</h3>
                    <form id="match-meta-form">
                        <div class="form-group">
                            <label class="form-label">Tagging Mode</label>
                            <select id="tagging-mode" class="form-input">
                                <option value="full">Full match (both teams)</option>
                                <option value="team">One team only</option>
                                <option value="player">One player only</option>
                            </select>
                            <p id="tagging-mode-help" style="font-size: 0.75rem; color: var(--text-muted); margin: 6px 0 0;"></p>
                        </div>
                        <div id="team-mode-fields" style="display: none;">
                            <div class="form-group">
                                <label class="form-label">Focus Team (the team we tag)</label>
                                <select id="focus-team-select" class="form-input"><option value="">Upload a roster first</option></select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Opponent Team Name <span style="font-weight: 400; color: var(--text-muted);">(only if the roster has one team)</span></label>
                                <input type="text" id="team-opponent-name" class="form-input" placeholder="e.g. Legia Warszawa U17">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Tournament Name</label>
                            <input type="text" id="tournament-name" class="form-input" required placeholder="e.g. Futsal Champions League 2024">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Match Name / ID</label>
                            <input type="text" id="match-name" class="form-input" required placeholder="e.g. Final: Team A vs Team B">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Match Date</label>
                            <input type="date" id="match-date" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Video Source Type</label>
                            <select id="video-type" class="form-input">
                                <option value="youtube">YouTube URL</option>
                                <option value="local">Local File (Upload later in Tagger)</option>
                            </select>
                        </div>
                        <div class="form-group" id="yt-url-group">
                            <label class="form-label">YouTube URL</label>
                            <input type="url" id="yt-url" class="form-input" placeholder="https://www.youtube.com/watch?v=...">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Pitch Format</label>
                            <select id="is-futsal" class="form-input">
                                <option value="true">Futsal (40m x 20m)</option>
                                <option value="false">Standard Football (120m x 80m)</option>
                            </select>
                        </div>

                    </form>
                </section>

                <section class="card" id="player-mode-card" style="display: none;">
                    <h3 style="margin-bottom: 16px;">Focus Player</h3>
                    <div class="form-group">
                        <label class="form-label">Search existing players</label>
                        <input type="text" id="pm-search" class="form-input" placeholder="Type at least 2 letters...">
                        <div id="pm-results" style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px; max-height: 220px; overflow-y: auto;"></div>
                    </div>
                    <div id="pm-selected" style="display: none; padding: 10px 12px; background: var(--primary-light); border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 16px;"></div>
                    <details id="pm-new" style="margin-bottom: 16px;">
                        <summary style="cursor: pointer; font-size: 0.875rem; font-weight: 600;">+ Create a new player</summary>
                        <div style="margin-top: 12px;">
                            <div class="form-group">
                                <label class="form-label">Player Name</label>
                                <input type="text" id="pm-new-name" class="form-input" placeholder="Full name">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Position</label>
                                <select id="pm-new-position" class="form-input">
                                    <option value="">—</option><option>GK</option><option>DF</option><option>MF</option><option>FW</option>
                                </select>
                            </div>
                        </div>
                    </details>
                    <div class="form-group">
                        <label class="form-label">Player's Team in this Match</label>
                        <input type="text" id="pm-team-name" class="form-input" placeholder="e.g. MKS Podlasie U19">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Jersey Number <span style="font-weight: 400; color: var(--text-muted);">(optional)</span></label>
                        <input type="number" id="pm-jersey" class="form-input" min="1" max="99" placeholder="e.g. 10">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Home or Away</label>
                        <select id="pm-is-home" class="form-input"><option value="true">Home</option><option value="false">Away</option></select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Opponent Team Name <span style="font-weight: 400; color: var(--text-muted);">(optional)</span></label>
                        <input type="text" id="pm-opponent-name" class="form-input" placeholder="Leave blank for a generic Opponent">
                    </div>
                    <div id="pm-status" style="font-size: 0.875rem;"></div>
                </section>

                <section class="card" id="roster-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h3 style="margin-bottom: 0;">Roster Upload</h3>
                        <button id="download-template-btn" class="btn btn-ghost" style="width: auto; padding: 4px 12px; font-size: 0.75rem; border: 1px solid var(--border);">📥 Download Template</button>
                    </div>
                    
                    <div id="upload-zone" style="border: 2px dashed var(--border); border-radius: var(--radius-lg); padding: 40px; text-align: center; cursor: pointer; transition: all 0.2s ease;">
                        <span style="font-size: 2rem; display: block; margin-bottom: 12px;">📄</span>
                        <p style="color: var(--text-muted); margin-bottom: 16px;">Drop CSV/Excel here or click to browse</p>
                        <button class="btn btn-ghost" style="width: auto;">Select File</button>
                        <input type="file" id="roster-file" accept=".csv, .xlsx, .xls" style="display: none;">
                    </div>
                    <div id="upload-status" style="margin-top: 16px; font-size: 0.875rem;"></div>

                    <div style="margin-top: 24px; padding: 16px; background: var(--primary-light); border-radius: 8px; font-size: 0.8125rem; color: var(--text-muted);">
                        <strong style="color: var(--text-main); display: block; margin-bottom: 8px;">How to fill the template:</strong>
                        <ul style="margin-left: 20px; margin-bottom: 0; display: flex; flex-direction: column; gap: 4px;">
                            <li><strong>Is_home:</strong> Type <code style="background: var(--hover-bg); padding: 2px 4px; border-radius: 3px;">TRUE</code> for the Home team, <code style="background: var(--hover-bg); padding: 2px 4px; border-radius: 3px;">FALSE</code> for Away.</li>
                            <li><strong>Starting_XI:</strong> Type <code style="background: var(--hover-bg); padding: 2px 4px; border-radius: 3px;">TRUE</code> for starters, <code style="background: var(--hover-bg); padding: 2px 4px; border-radius: 3px;">FALSE</code> for bench.</li>
                            <li><strong>Position:</strong> Optional. Use <code style="background: var(--hover-bg); padding: 2px 4px; border-radius: 3px;">GK, DF, MF, FW</code> or leave it blank.</li>
                        </ul>
                    </div>

                    <div id="preview-section" style="display: none; margin-top: 32px;">
                        <h4 style="margin-bottom: 16px;">Roster Preview</h4>
                        <div id="roster-summary" style="display: flex; gap: 16px; margin-bottom: 16px;"></div>
                        <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-md);">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.8125rem;">
                                <thead style="background: var(--primary-light); position: sticky; top: 0;">
                                    <tr>
                                        <th style="padding: 8px; text-align: left;">Team</th>
                                        <th style="padding: 8px; text-align: left;">#</th>
                                        <th style="padding: 8px; text-align: left;">Name</th>
                                        <th style="padding: 8px; text-align: left;">Pos</th>
                                        <th style="padding: 8px; text-align: left;">Start?</th>
                                    </tr>
                                </thead>
                                <tbody id="roster-preview-body"></tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </div>

            <div style="margin-top: 32px; display: flex; justify-content: flex-end;">
                <button id="create-match-btn" class="btn btn-primary" style="width: auto; padding: 12px 48px;" disabled>
                    Initialize Match Session
                </button>
            </div>
        </div>
    `;
}

let parsedRoster = null;
let matchState = {
    tournament: '',
    name: '',
    date: '',
    videoType: 'youtube',
    ytUrl: '',
    isFutsal: 'true',
    mode: 'full'
};
let focusPlayer = null; // { player_id, player_name, position, team_name } in player mode

const MODE_HELP = {
    full: 'Tag both teams. Upload the full roster.',
    team: 'Tag one team only. Opponent actions go to a shared "Opponent" stand-in; opponent roster is optional.',
    player: 'Tag one player only. No roster needed: the lineup is the player plus "Opponent" and "Teammate" stand-ins.'
};

function applyMode(mode) {
    matchState.mode = mode;
    document.getElementById('tagging-mode-help').innerText = MODE_HELP[mode];
    document.getElementById('team-mode-fields').style.display = mode === 'team' ? 'block' : 'none';
    document.getElementById('player-mode-card').style.display = mode === 'player' ? 'block' : 'none';
    document.getElementById('roster-card').style.display = mode === 'player' ? 'none' : 'block';
    refreshCreateEnabled();
}

function refreshCreateEnabled() {
    const btn = document.getElementById('create-match-btn');
    if (!btn) return;
    if (matchState.mode === 'player') {
        const newName = document.getElementById('pm-new-name')?.value.trim();
        btn.disabled = !(focusPlayer || newName);
    } else btn.disabled = !parsedRoster;
}

function fillFocusTeamOptions() {
    const sel = document.getElementById('focus-team-select');
    if (!sel) return;
    if (!parsedRoster) { sel.innerHTML = '<option value="">Upload a roster first</option>'; return; }
    const teams = [...new Set(parsedRoster.map(p => p.teamName))];
    const prev = sel.value;
    sel.innerHTML = teams.map(t => `<option value="${t.replace(/"/g, '&quot;')}">${t}</option>`).join('');
    if (teams.includes(prev)) sel.value = prev;
}

function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderSelectedPlayer() {
    const box = document.getElementById('pm-selected');
    if (!focusPlayer) { box.style.display = 'none'; refreshCreateEnabled(); return; }
    box.style.display = 'block';
    box.innerHTML = `Selected: <strong>${escapeHtml(focusPlayer.player_name)}</strong> ` +
        `${focusPlayer.position ? '(' + escapeHtml(focusPlayer.position) + ') ' : ''}` +
        `<span style="color: var(--text-muted);">${escapeHtml(focusPlayer.team_name || '')}</span> ` +
        `<button type="button" id="pm-clear" class="btn btn-ghost" style="width: auto; padding: 2px 8px; font-size: 0.75rem; margin-left: 8px;">Change</button>`;
    document.getElementById('pm-clear').onclick = () => { focusPlayer = null; renderSelectedPlayer(); };
    const teamInput = document.getElementById('pm-team-name');
    if (!teamInput.value && focusPlayer.team_name) teamInput.value = focusPlayer.team_name;
    refreshCreateEnabled();
}

function initPlayerMode() {
    const search = document.getElementById('pm-search');
    const results = document.getElementById('pm-results');
    let timer = null, seq = 0;
    search.addEventListener('input', () => {
        clearTimeout(timer);
        const q = search.value.trim();
        if (q.length < 2) { results.innerHTML = ''; return; }
        timer = setTimeout(async () => {
            const mySeq = ++seq;
            const { data, error } = await supabase.from('players')
                .select('player_id, player_name, position, team_id, teams(team_name)')
                .ilike('player_name', `%${q}%`).eq('is_placeholder', false).order('player_name').limit(20);
            if (mySeq !== seq) return;
            if (error) { results.innerHTML = `<span style="color: var(--danger); font-size: 0.8rem;">${escapeHtml(error.message)}</span>`; return; }
            results.innerHTML = (data || []).length ? '' : '<span style="color: var(--text-muted); font-size: 0.8rem;">No players found. Create a new one below.</span>';
            (data || []).forEach(p => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'btn btn-ghost';
                b.style.cssText = 'text-align: left; padding: 6px 10px; font-size: 0.8125rem; border: 1px solid var(--border);';
                b.innerHTML = `<strong>${escapeHtml(p.player_name)}</strong> ${p.position ? '· ' + escapeHtml(p.position) : ''} <span style="color: var(--text-muted);">· ${escapeHtml(p.teams?.team_name || 'No team')}</span>`;
                b.onclick = () => {
                    focusPlayer = { player_id: p.player_id, player_name: p.player_name, position: p.position, team_name: p.teams?.team_name };
                    results.innerHTML = ''; search.value = '';
                    renderSelectedPlayer();
                };
                results.appendChild(b);
            });
        }, 250);
    });
    document.getElementById('pm-new-name').addEventListener('input', refreshCreateEnabled);
    renderSelectedPlayer();
}

export function initCreateMatch() {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('roster-file');
    const videoType = document.getElementById('video-type');
    const ytUrlGroup = document.getElementById('yt-url-group');
    const createBtn = document.getElementById('create-match-btn');
    const templateBtn = document.getElementById('download-template-btn');

    // Setup input elements
    const inputs = {
        tournament: document.getElementById('tournament-name'),
        name: document.getElementById('match-name'),
        date: document.getElementById('match-date'),
        videoType: videoType,
        ytUrl: document.getElementById('yt-url'),
        isFutsal: document.getElementById('is-futsal')
    };

    // Hydrate state
    const today = new Date().toISOString().split('T')[0];
    inputs.tournament.value = matchState.tournament;
    inputs.name.value = matchState.name;
    inputs.date.value = matchState.date || today;
    matchState.date = inputs.date.value; // ensure state stays updated
    
    inputs.videoType.value = matchState.videoType;
    inputs.ytUrl.value = matchState.ytUrl;
    inputs.isFutsal.value = matchState.isFutsal;
    ytUrlGroup.style.display = matchState.videoType === 'youtube' ? 'block' : 'none';

    // Roster Hydration
    if (parsedRoster) {
        document.getElementById('upload-status').innerText = `Successfully loaded ${parsedRoster.length} players.`;
        document.getElementById('upload-status').style.color = 'var(--success)';
        document.getElementById('create-match-btn').disabled = false;
        renderPreview();
    }

    // Bind inputs to state
    Object.keys(inputs).forEach(key => {
        inputs[key].addEventListener('input', (e) => {
            matchState[key] = e.target.value;
        });
    });

    templateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const templateData = [
            ['Team_Name', 'Is_home', 'Jersey_No', 'Player_Name', 'Starting_XI', 'Position', 'Substitution_In_Time', 'Substitution_Off_Time', 'Match_Duration'],
            ['Eagles FC', 'TRUE', '1', 'John Doe', 'TRUE', 'GK', '', '', '90'],
            ['Eagles FC', 'TRUE', '10', 'Jane Smith', 'TRUE', 'FW', '', '', '90'],
            ['Falcons Utd', 'FALSE', '9', 'Mike Johnson', 'TRUE', 'FW', '', '', '90'],
            ['Falcons Utd', 'FALSE', '7', 'Sarah Williams', 'FALSE', 'MF', '60', '90', '90']
        ];
        const ws = XLSX.utils.aoa_to_sheet(templateData);
        ws['!cols'] = [{wch:15}, {wch:10}, {wch:10}, {wch:20}, {wch:10}, {wch:10}, {wch:18}, {wch:18}, {wch:15}];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "CAC_Roster_Template");
        XLSX.writeFile(wb, "CAC_Roster_Template.xlsx");
    });

    videoType.addEventListener('change', () => {
        ytUrlGroup.style.display = videoType.value === 'youtube' ? 'block' : 'none';
        matchState.videoType = videoType.value; // ensure state stays updated
    });

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--accent)';
        uploadZone.style.background = 'var(--hover-bg)';
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.borderColor = 'var(--border)';
        uploadZone.style.background = 'transparent';
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        handleFile(e.target.files[0]);
    });

    createBtn.addEventListener('click', handleCreateMatch);

    const modeSel = document.getElementById('tagging-mode');
    modeSel.value = matchState.mode;
    modeSel.addEventListener('change', () => applyMode(modeSel.value));
    initPlayerMode();
    fillFocusTeamOptions();
    applyMode(matchState.mode);
}

async function handleFile(file) {
    if (!file) return;
    const status = document.getElementById('upload-status');
    status.innerText = 'Parsing file...';
    status.style.color = 'var(--text-muted)';

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(worksheet);

        // Validation
        const requiredHeaders = ['Team_Name', 'Is_home', 'Jersey_No', 'Player_Name', 'Starting_XI', 'Position'];
        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
        
        const missing = requiredHeaders.filter(h => !headers.includes(h));
        if (missing.length > 0) {
            throw new Error(`Missing required columns: ${missing.join(', ')}`);
        }

        parsedRoster = json.map(row => ({
            teamName: String(row.Team_Name).trim(),
            isHome: String(row.Is_home).toLowerCase() === 'true' || row.Is_home === 1,
            jerseyNo: String(row.Jersey_No),
            playerName: String(row.Player_Name).trim(),
            startingXI: String(row.Starting_XI).toLowerCase() === 'true' || row.Starting_XI === 1,
            position: row.Position ? String(row.Position).toUpperCase().trim() : null,
            subTimeIn: row.Substitution_In_Time || null,
            subTimeOff: row.Substitution_Off_Time || null,
            duration: row.Match_Duration || null
        }));

        // Position validation: GK, DF, MF, FW, or null
        const invalidPos = parsedRoster.find(p => p.position && !['GK', 'DF', 'MF', 'FW'].includes(p.position));
        if (invalidPos) {
            throw new Error(`Invalid position found: ${invalidPos.position}. Must be GK, DF, MF, FW, or left blank.`);
        }

        renderPreview();
        fillFocusTeamOptions();
        status.innerText = `Successfully loaded ${parsedRoster.length} players.`;
        status.style.color = 'var(--success)';
        document.getElementById('create-match-btn').disabled = false;

    } catch (err) {
        status.innerText = `Error: ${err.message}`;
        status.style.color = 'var(--danger)';
        parsedRoster = null;
        document.getElementById('create-match-btn').disabled = true;
        document.getElementById('preview-section').style.display = 'none';
    }
}

function renderPreview() {
    const preview = document.getElementById('preview-section');
    const body = document.getElementById('roster-preview-body');
    const summary = document.getElementById('roster-summary');
    
    preview.style.display = 'block';
    body.innerHTML = '';

    const teams = [...new Set(parsedRoster.map(p => p.teamName))];
    summary.innerHTML = teams.map(t => {
        const players = parsedRoster.filter(p => p.teamName === t);
        const xiCount = players.filter(p => p.startingXI).length;
        return `
            <div style="background: var(--primary-light); padding: 8px 12px; border-radius: 6px; font-size: 0.75rem; border: 1px solid var(--border);">
                <strong>${t}</strong>: ${players.length} total (${xiCount} starters)
            </div>
        `;
    }).join('');

    body.innerHTML = parsedRoster.map(p => `
        <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 8px; color: ${p.isHome ? 'var(--accent)' : 'var(--text-main)'}">${p.teamName}</td>
            <td style="padding: 8px;">${p.jerseyNo}</td>
            <td style="padding: 8px; font-weight: 500;">${p.playerName}</td>
            <td style="padding: 8px;"><span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">${p.position}</span></td>
            <td style="padding: 8px;">${p.startingXI ? '✅' : '—'}</td>
        </tr>
    `).join('');
}

async function handleCreateMatch() {
    const btn = document.getElementById('create-match-btn');
    const mode = document.getElementById('tagging-mode').value;
    const status = document.getElementById(mode === 'player' ? 'pm-status' : 'upload-status');

    const tournament = document.getElementById('tournament-name').value.trim();
    const name = document.getElementById('match-name').value.trim();
    const date = document.getElementById('match-date').value;
    const videoType = document.getElementById('video-type').value;
    const ytUrl = document.getElementById('yt-url').value.trim();
    const isFutsal = document.getElementById('is-futsal').value === 'true';

    let missing = [];
    if (!tournament) missing.push('Tournament Name');
    if (!name) missing.push('Match Name / ID');
    if (!date) missing.push('Match Date');
    if (videoType === 'youtube' && !ytUrl) missing.push('YouTube URL');

    if (mode === 'team') {
        const teamNames = [...new Set((parsedRoster || []).map(p => p.teamName))];
        if (!document.getElementById('focus-team-select').value) missing.push('Focus Team');
        if (teamNames.length < 2 && !document.getElementById('team-opponent-name').value.trim()) missing.push('Opponent Team Name (roster has only one team)');
    }
    if (mode === 'player') {
        if (!focusPlayer && !document.getElementById('pm-new-name').value.trim()) missing.push('Focus Player (search or create)');
        if (!document.getElementById('pm-team-name').value.trim()) missing.push("Player's Team in this Match");
    }

    if (missing.length > 0) {
        alert('Please fill in the following missing metadata:\n- ' + missing.join('\n- '));
        return;
    }

    btn.innerText = 'Initializing Match...';
    btn.disabled = true;

    const baseMatch = {
        match_name: name,
        tournament_name: tournament,
        match_date: date,
        is_futsal: isFutsal,
        video_url: videoType === 'youtube' ? ytUrl : null,
        tagging_mode: mode,
    };

    try {
        let matchId;
        if (mode === 'player') matchId = await createPlayerModeMatch(baseMatch);
        else matchId = await createRosterMatch(baseMatch, mode);

        await ensurePlaceholders(matchId, mode);

        status.innerText = 'Match initialized successfully! Redirecting...';
        status.style.color = 'var(--success)';

        setTimeout(() => {
            // Reset state upon successful creation to avoid ghost values on next match
            parsedRoster = null;
            focusPlayer = null;
            matchState = { tournament: '', name: '', date: '', videoType: 'youtube', ytUrl: '', isFutsal: 'true', mode: 'full' };
            window.location.hash = '#matches';
        }, 1500);

    } catch (err) {
        console.error(err);
        status.innerText = `Database Error: ${err.message}`;
        status.style.color = 'var(--danger)';
        btn.innerText = 'Initialize Match Session';
        btn.disabled = false;
    }
}

// Full and one-team modes: teams + lineups come from the uploaded roster.
async function createRosterMatch(baseMatch, mode) {
    const teamsMap = new Map(); // teamName -> teamId
    const teamNames = [...new Set(parsedRoster.map(p => p.teamName))];
    for (const tName of teamNames) teamsMap.set(tName, await getOrCreateTeam(tName));

    let homeTeamName = parsedRoster.find(p => p.isHome)?.teamName || teamNames[0];
    let awayTeamName = teamNames.find(t => t !== homeTeamName) || teamNames[1] || homeTeamName;
    let homeId = teamsMap.get(homeTeamName), awayId = teamsMap.get(awayTeamName);

    const extra = {};
    if (mode === 'team') {
        const focusName = document.getElementById('focus-team-select').value;
        const focusId = teamsMap.get(focusName);
        extra.focus_team_id = focusId;
        if (teamNames.length < 2) {
            // Roster only has our team: the opponent comes from the name field.
            const oppId = await getOrCreateTeam(document.getElementById('team-opponent-name').value);
            const focusIsHome = parsedRoster.some(p => p.teamName === focusName && p.isHome);
            homeId = focusIsHome ? focusId : oppId;
            awayId = focusIsHome ? oppId : focusId;
        }
    }

    const matchId = await createMatchRecord({ ...baseMatch, home_team_id: homeId, away_team_id: awayId, ...extra });

    // Insert Players & Lineups. Look up by name + team to avoid cross-team
    // collisions and to reuse existing player IDs across matches for the same team.
    for (const p of parsedRoster) {
        const teamId = teamsMap.get(p.teamName);
        const playerId = await getOrCreatePlayer({ playerName: p.playerName, teamId, position: p.position });
        await addLineupRow({
            match_id: matchId,
            team_id: teamId,
            player_id: playerId,
            jersey_no: p.jerseyNo,
            position: p.position,
            starting_xi: p.startingXI,
            substitution_in_time: p.subTimeIn,
            substitution_off_time: p.subTimeOff,
            match_duration: p.duration
        });
    }
    return matchId;
}

// One-player mode: the lineup is just the focus player (stand-ins are added after).
async function createPlayerModeMatch(baseMatch) {
    const teamId = await getOrCreateTeam(document.getElementById('pm-team-name').value);
    const oppName = document.getElementById('pm-opponent-name').value.trim();
    const oppId = oppName ? await getOrCreateTeam(oppName) : null;
    const isHome = document.getElementById('pm-is-home').value === 'true';

    let playerId, position;
    if (focusPlayer) {
        playerId = focusPlayer.player_id;
        position = focusPlayer.position || null;
    } else {
        position = document.getElementById('pm-new-position').value || null;
        playerId = await getOrCreatePlayer({ playerName: document.getElementById('pm-new-name').value.trim(), teamId, position });
    }

    // With no opponent name both sides start as our team; ensurePlaceholders()
    // then creates "Opponent – <date>" and links it to the other side.
    const matchId = await createMatchRecord({
        ...baseMatch,
        home_team_id: isHome ? teamId : (oppId || teamId),
        away_team_id: isHome ? (oppId || teamId) : teamId,
        focus_team_id: teamId,
        focus_player_id: playerId,
    });
    await addLineupRow({ match_id: matchId, team_id: teamId, player_id: playerId, jersey_no: document.getElementById('pm-jersey').value.trim() || null, position, starting_xi: true });
    return matchId;
}

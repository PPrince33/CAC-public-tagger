import { supabase } from '../supabase'
import { CAC_LOGIC, ACTION_RULES } from '../lib/cacLogic'
import { PitchCanvas } from '../lib/pitchCanvas'
import { GoalFaceCanvas } from '../lib/goalFace'
import { VideoEngine } from '../lib/videoEngine'

export function TaggerView() {
    return `
        <div class="fade-in tagger-app" style="height: calc(100vh - 32px); display: flex; flex-direction: column; gap: 16px;">
            <header style="display: flex; justify-content: space-between; align-items: center; padding: 0 8px;">
                <div>
                    <h2 id="match-title" style="margin-bottom: 4px;">Loading Match...</h2>
                    <div id="match-subtitle" style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Match ID: ...</div>
                </div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button class="btn btn-ghost" style="width: auto; padding: 8px 16px; border: 1px solid var(--border);" id="toggle-sidebar-btn">👁️ Toggle Sidebar</button>
                    <button class="btn btn-ghost" style="width: auto; padding: 8px 16px;" id="back-to-matches">⬅ Back</button>
                    <button class="btn btn-primary" style="width: auto; padding: 8px 24px; background: var(--success);" id="finish-match-btn">🏁 Finish Match</button>
                </div>
            </header>

            <div style="flex-grow: 1; display: grid; grid-template-columns: 1fr 480px; gap: 16px; min-height: 0;">
                <!-- Left Column: Video & Log -->
                <div style="display: flex; flex-direction: column; gap: 16px; overflow-y: auto; padding-right: 8px;">
                    <!-- Video Source Bar -->
                    <div class="card" style="padding: 12px; flex-shrink: 0;">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <select id="video-source-select" class="form-input" style="width: 120px; padding: 6px 10px; font-size: 0.75rem;">
                                <option value="youtube">YouTube</option>
                                <option value="local">Local File</option>
                            </select>
                            <input type="text" id="video-url-input" class="form-input" style="flex: 1; padding: 6px 10px; font-size: 0.75rem;" placeholder="Paste YouTube URL here...">
                            <button id="load-video-btn" class="btn btn-primary" style="width: auto; padding: 6px 16px; font-size: 0.75rem;">Load</button>
                            <input type="file" id="local-video-file" style="display: none;" accept="video/*">
                            <button id="upload-local-btn" class="btn btn-ghost" style="width: auto; padding: 6px 12px; font-size: 0.75rem; display: none;">📂 Browse</button>
                        </div>
                    </div>

                    <!-- Video Section -->
                    <div id="main-video-card" class="card" style="padding: 0; overflow: hidden; position: relative; flex-shrink: 0;">
                        <div id="video-wrapper" style="aspect-ratio: 16/9; background: #000;">
                            <div id="video-container" style="width: 100%; height: 100%;"></div>
                        </div>
                        <div id="video-controls" style="padding: 12px; display: flex; justify-content: space-between; gap: 8px; background: var(--bg-card); border-top: 1px solid var(--border);">
                            <div style="display: flex; gap: 4px;">
                                <button id="popout-btn" class="btn btn-ghost" style="width: auto; padding: 6px 12px; font-size: 0.75rem;">🪟 Pop Out</button>
                                <button id="ptz-btn" class="btn btn-ghost" style="width: auto; padding: 6px 12px; font-size: 0.75rem;">🔍 PTZ: OFF</button>
                                <button id="reset-ptz-btn" class="btn btn-ghost" style="width: auto; padding: 6px 12px; font-size: 0.75rem;">Reset PTZ</button>
                            </div>
                        </div>
                    </div>

                    <!-- Staging Table -->
                    <div class="card" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 16px; min-height: 300px; flex-shrink: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <h4 style="margin:0;">Event Log</h4>
                            <button id="sync-btn" class="btn btn-ghost" style="width: auto; padding: 4px 12px; font-size: 0.75rem; color: var(--success);">☁ Sync All</button>
                        </div>
                        <div style="flex-grow: 1; overflow-y: auto; font-size: 0.75rem;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background: var(--primary-light); position: sticky; top: 0;">
                                    <tr>
                                        <th style="padding: 6px; text-align: left;">Time</th>
                                        <th style="padding: 6px; text-align: left;">Dir</th>
                                        <th style="padding: 6px; text-align: left;">Action/Out</th>
                                        <th style="padding: 6px; text-align: left;">Type</th>
                                        <th style="padding: 6px; text-align: left;">Body</th>
                                        <th style="padding: 6px; text-align: left;">Press</th>
                                        <th style="padding: 6px; text-align: left;">Players</th>
                                        <th style="padding: 6px; text-align: left;">Coords</th>
                                        <th style="padding: 6px; text-align: left;">Notes</th>
                                        <th style="padding: 6px; text-align: center;">Del</th>
                                    </tr>
                                </thead>
                                <tbody id="staging-body"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Right Column: Pitch, Actions, Lineups -->
                <div style="display: flex; flex-direction: column; gap: 16px; min-height: 0; overflow-y: auto;">
                    <!-- Pitch Canvas -->
                    <div class="card" style="padding: 12px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0;">
                        <canvas id="pitch-canvas" width="480" height="320" style="width: 100%; max-width: 480px; border-radius: var(--radius-sm);"></canvas>
                        <div id="pitch-coords" style="margin-top: 8px; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">Start: None | End: None</div>
                    </div>
                    
                    <!-- Goal Face Overlay (Conditional) -->
                    <div id="goal-face-overlay" class="card" style="display: none; padding: 12px; flex-direction: column; align-items: center; border-color: var(--accent); flex-shrink: 0;">
                         <h4 style="margin-bottom: 8px; font-size: 0.875rem;">Shot Placement (Goal Face)</h4>
                         <canvas id="goal-face-canvas" width="400" height="200" style="width: 100%; max-width: 400px; border-radius: var(--radius-sm);"></canvas>
                         <div id="goal-coords" style="margin-top: 8px; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">End_Z: None | Y_Off: None</div>
                    </div>

                    <!-- Action Controls -->
                    <div class="card" style="padding: 20px; flex-shrink: 0;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                            <div class="form-group">
                                <label class="form-label">Action</label>
                                <select id="action-select" class="form-input"></select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Outcome</label>
                                <select id="outcome-select" class="form-input"></select>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                            <div class="form-group">
                                <label class="form-label">Type</label>
                                <select id="type-select" class="form-input"></select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Body Part</label>
                                <select id="body-part-select" class="form-input">
                                    <option value="Right Leg" selected>Right Leg</option>
                                    <option value="Left Leg">Left Leg</option>
                                    <option value="Head">Head</option>
                                    <option value="Other">Other</option>
                                    <option value="NA">N/A</option>
                                </select>
                            </div>
                        </div>
                        <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center;">
                            <button id="pressure-btn" class="btn btn-ghost" style="width: auto; flex: 1; border: 1px solid var(--border); padding: 8px;">
                                💥 Pressure: OFF
                            </button>
                            <button id="direction-btn" class="btn btn-ghost" style="width: auto; flex: 1; border: 1px solid var(--border); padding: 8px;">
                                ➡ Direct: L2R
                            </button>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Notes</label>
                            <input type="text" id="action-notes" class="form-input" placeholder="Additional details...">
                        </div>
                        <button id="add-event-btn" class="btn btn-primary" style="margin-top: 8px;">Log Event [Enter]</button>
                    </div>

                    <!-- Lineup Grid -->
                    <div class="card" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 16px; min-height: 400px; flex-shrink: 0;">
                        <h4 style="margin-bottom: 12px; margin-top: 0;">Active Players</h4>
                        <div style="flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 20px;">
                            <div>
                                <div id="home-team-name" style="font-size: 0.75rem; font-weight: 700; color: var(--accent); margin-bottom: 8px; text-transform: uppercase;">HOME TEAM</div>
                                <div id="home-player-grid" class="player-grid"></div>
                            </div>
                            <div>
                                <div id="away-team-name" style="font-size: 0.75rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px; text-transform: uppercase;">AWAY TEAM</div>
                                <div id="away-player-grid" class="player-grid"></div>
                            </div>
                        </div>
                        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 0.8125rem;">
                            <div id="selected-players-display">
                                <div><strong>Action:</strong> <span id="action-player-lbl" style="color:var(--brand);font-weight:600;">None</span></div>
                                <div style="margin-top: 4px;"><strong>Reaction:</strong> <span id="reaction-player-lbl" style="color:var(--warning);font-weight:600;">None</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
            
            <!-- Player Suggestion Dial -->
            <div id="player-dial" class="card" style="display: none; position: fixed; z-index: 4000; padding: 12px; width: 280px; box-shadow: var(--shadow-lg);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="font-size: 0.75rem;">Quick Select Player</strong>
                    <button onclick="document.getElementById('player-dial').style.display='none'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;">✖</button>
                </div>
                <div>
                    <div id="dial-home-name" style="font-size: 0.65rem; color: var(--accent); margin-bottom: 4px; font-weight: 700;">HOME</div>
                    <div id="dial-home-players" style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 4px;"></div>
                </div>
                <div style="margin-top: 8px;">
                    <div id="dial-away-name" style="font-size: 0.65rem; color: var(--text-main); margin-bottom: 4px; font-weight: 700;">AWAY</div>
                    <div id="dial-away-players" style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 4px;"></div>
                </div>
            </div>
            
            <!-- Kick-Off Direction Modal -->
            <div id="kickoff-modal" class="card" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 3000; width: 400px; box-shadow: var(--shadow-lg);">
                <h3 style="margin-top: 0; color: var(--success);">⚽ Kick-Off Direction</h3>
                <p>Which direction is <b id="kickoff-team-name" style="color:var(--accent); font-size: 1.125rem;">Home Team</b> playing right now?</p>
                <div style="display: flex; gap: 12px; margin-top: 24px;">
                    <button class="btn btn-primary" id="btn-ko-l2r" style="background: var(--success); flex: 1;">Left ➔ Right</button>
                    <button class="btn btn-primary" id="btn-ko-r2l" style="background: var(--accent); flex: 1;">Right ➔ Left</button>
                </div>
                <button class="btn btn-ghost" onclick="document.getElementById('kickoff-modal').style.display='none'" style="margin-top: 16px; width: 100%;">Cancel Adding Event</button>
            </div>
            
            <style>
                .player-grid {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 6px;
                }
                .player-btn {
                    aspect-ratio: 1;
                    border: 1px solid var(--border);
                    background: var(--primary-light);
                    color: var(--text-main);
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .player-btn:hover { background: var(--hover-bg); }
                .player-btn.action-active { background: var(--accent); color: white; border-color: var(--accent); }
                .player-btn.reaction-active { background: var(--success); color: white; border-color: var(--success); }
                .player-btn.disabled { opacity: 0.3; cursor: not-allowed; }
            </style>
        </div>
    `;
}

// Global engine instances
let pitch = null;
let goalFace = null;
let video = null;
let activeMatch = null;
let activeLineup = [];
let localEvents = [];
let currentState = {
    actionPlayer: null,
    reactionPlayer: null,
    isPressureOn: false,
    homeDirection: 'L2R', // 'L2R' or 'R2L'
};

export async function initTagger() {
    // Maximize viewport for Tagger specifically
    const mainView = document.getElementById('main-view');
    if (mainView) {
        mainView.style.maxWidth = '100%';
        mainView.style.padding = '16px';
    }

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const matchId = urlParams.get('id');
    if (!matchId) return;

    const actionSelect = document.getElementById('action-select');
    const outcomeSelect = document.getElementById('outcome-select');
    const typeSelect = document.getElementById('type-select');
    const addEventBtn = document.getElementById('add-event-btn');
    const syncBtn = document.getElementById('sync-btn');
    const directionBtn = document.getElementById('direction-btn');
    const finishBtn = document.getElementById('finish-match-btn');
    const pressureBtn = document.getElementById('pressure-btn');

    // Remove existing listener to prevent accumulation
    document.removeEventListener('keydown', handleHotkeys);
    document.addEventListener('keydown', handleHotkeys);

    // Re-render local events IMMEDIATELY so they don't vanish while fetching
    renderStaging();
    const { data: match, error } = await supabase
        .from('matches')
        .select(`
            *,
            home_team:teams!home_team_id(team_name),
            away_team:teams!away_team_id(team_name)
        `)
        .eq('match_id', matchId)
        .single();

    if (error) {
        alert("Match not found");
        window.location.hash = '#matches';
        return;
    }

    // Prevent staging data from bleeding into a different match session
    if (activeMatch && activeMatch.match_id !== matchId) {
        localEvents = [];
    }

    activeMatch = match;
    document.getElementById('match-title').innerText = `${match.home_team.team_name} vs ${match.away_team.team_name}`;
    document.getElementById('match-subtitle').innerText = `Match ID: ${match.match_id.split('-')[0]}... | ${match.is_futsal ? 'Futsal' : 'Football'}`;
    document.getElementById('home-team-name').innerText = match.home_team.team_name;
    document.getElementById('away-team-name').innerText = match.away_team.team_name;

    // 2. Initialize Engines
    pitch = new PitchCanvas('pitch-canvas', match.is_futsal);
    goalFace = new GoalFaceCanvas('goal-face-canvas', match.is_futsal);

    const videoSourceSelect = document.getElementById('video-source-select');
    const videoUrlInput = document.getElementById('video-url-input');
    const loadVideoBtn = document.getElementById('load-video-btn');
    const uploadLocalBtn = document.getElementById('upload-local-btn');

    // Determine initial source
    const initialSource = match.video_url ? 'youtube' : 'local';
    videoSourceSelect.value = initialSource;
    if (match.video_url) videoUrlInput.value = match.video_url;

    // Toggle URL input vs local file button based on source
    const updateVideoSourceUI = () => {
        const src = videoSourceSelect.value;
        if (src === 'local') {
            videoUrlInput.style.display = 'none';
            loadVideoBtn.style.display = 'none';
            uploadLocalBtn.style.display = 'inline-flex';
        } else {
            videoUrlInput.style.display = 'block';
            loadVideoBtn.style.display = 'inline-flex';
            uploadLocalBtn.style.display = 'none';
        }
    };
    updateVideoSourceUI();
    videoSourceSelect.addEventListener('change', updateVideoSourceUI);

    video = new VideoEngine('video-container', initialSource);
    if (match.video_url) video.loadYouTube(match.video_url);

    // Load video from URL input
    loadVideoBtn.addEventListener('click', async () => {
        const url = videoUrlInput.value.trim();
        if (!url) return;
        // Reinitialize video engine as youtube
        video = new VideoEngine('video-container', 'youtube');
        video.loadYouTube(url);
        // Save URL to match in DB
        await supabase.from('matches').update({ video_url: url }).eq('match_id', matchId);
    });

    pitch.onCoordsChange = (start, end, e) => {
        document.getElementById('pitch-coords').innerText = `Start: ${start ? start.x+','+start.y : 'None'} | End: ${end ? end.x+','+end.y : 'None'}`;
        
        if (e && e.clientX && e.clientY) {
            const dial = document.getElementById('player-dial');
            dial.style.display = 'block';
            
            let left = e.clientX + 15;
            let top = e.clientY + 15;
            if (left + 280 > window.innerWidth) left = e.clientX - 295;
            if (top + 150 > window.innerHeight) top = e.clientY - 165;
            
            dial.style.left = `${left}px`;
            dial.style.top = `${top}px`;
        }
    };
    
    goalFace.onShotChange = (target) => {
        let teamDir = 'L2R';
        if (currentState.actionPlayer) {
            teamDir = getFinalDirection();
        } else if (pitch.startPoint) {
            teamDir = pitch.startPoint.x > (match.is_futsal ? 20 : 60) ? 'R2L' : 'L2R';
        }

        let yOffset = target.yOffset;
        if (teamDir === 'L2R') yOffset = -yOffset;

        const maxY = match.is_futsal ? 20 : 80;
        const maxX = match.is_futsal ? 40 : 120;
        
        let endY = parseFloat((maxY / 2 + yOffset).toFixed(2));
        let endX = (teamDir === 'L2R') ? maxX : 0;
        
        pitch.endPoint = { x: endX, y: endY };
        pitch.draw();
        
        document.getElementById('goal-coords').innerText = `End_Z: ${target.z}m | End_Y: ${endY}`;
        document.getElementById('pitch-coords').innerText = `Start: ${pitch.startPoint ? pitch.startPoint.x.toFixed(1)+','+pitch.startPoint.y.toFixed(1) : 'None'} | End: ${endX},${endY}`;
    };

    // 3. Setup Dropdowns
    Object.keys(CAC_LOGIC).forEach(act => {
        const opt = new Option(act, act);
        actionSelect.add(opt);
    });

    const updateOutcomes = () => {
        const act = actionSelect.value;
        outcomeSelect.innerHTML = '';
        Object.keys(CAC_LOGIC[act]).forEach(out => outcomeSelect.add(new Option(out, out)));
        updateTypes();
        
        // Toggle Goal Face
        document.getElementById('goal-face-overlay').style.display = act === 'Shoot' ? 'flex' : 'none';
        updateLineupState();
    };

    const updateTypes = () => {
        const act = actionSelect.value;
        const out = outcomeSelect.value;
        typeSelect.innerHTML = '';
        CAC_LOGIC[act][out].forEach(t => {
            if (t !== 'NA') typeSelect.add(new Option(t, t));
        });
    };

    actionSelect.addEventListener('change', updateOutcomes);
    outcomeSelect.addEventListener('change', updateTypes);
    updateOutcomes();

    // 4. Fetch Lineups
    const { data: lineup, error: lErr } = await supabase
        .from('lineups')
        .select(`
            *,
            players (player_name, position)
        `)
        .eq('match_id', matchId);
    
    if (lErr) console.error(lErr);
    activeLineup = lineup;
    renderPlayerGrids();

    // 5. Setup Action Handlers
    // Restore pressure button visual if state persisted
    pressureBtn.innerText = `💥 Pressure: ${currentState.isPressureOn ? 'ON' : 'OFF'}`;
    pressureBtn.style.background = currentState.isPressureOn ? 'var(--danger)' : 'transparent';

    pressureBtn.addEventListener('click', () => {
        currentState.isPressureOn = !currentState.isPressureOn;
        pressureBtn.innerText = `💥 Pressure: ${currentState.isPressureOn ? 'ON' : 'OFF'}`;
        pressureBtn.style.background = currentState.isPressureOn ? 'var(--danger)' : 'transparent';
    });

    directionBtn.addEventListener('click', () => {
        currentState.homeDirection = currentState.homeDirection === 'L2R' ? 'R2L' : 'L2R';
        directionBtn.innerText = `➡ Direct: ${currentState.homeDirection}`;
    });

    document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
        }
    });

    document.getElementById('back-to-matches').addEventListener('click', () => {
        if (mainView) {
            mainView.style.maxWidth = '';
            mainView.style.padding = '';
        }
        window.location.hash = '#matches';
    });

    uploadLocalBtn.addEventListener('click', () => {
        document.getElementById('local-video-file').click();
    });

    document.getElementById('local-video-file').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            video = new VideoEngine('video-container', 'local');
            video.loadLocalFile(e.target.files[0]);
        }
    });

    document.getElementById('popout-btn').addEventListener('click', () => video.togglePopOut());
    
    document.getElementById('ptz-btn').addEventListener('click', (e) => {
        const isActive = video.togglePTZ();
        e.target.innerText = isActive ? "🔍 PTZ: ON" : "🔍 PTZ: OFF";
        e.target.style.background = isActive ? "var(--success)" : "transparent";
    });
    
    document.getElementById('reset-ptz-btn').addEventListener('click', () => {
        video.resetPTZ();
    });

    addEventBtn.addEventListener('click', logEvent);
    syncBtn.addEventListener('click', syncEvents);
    finishBtn.addEventListener('click', async () => {
        if (localEvents.length > 0) {
            if (!confirm("You have unsynced events. Finish match anyway?")) return;
        }
        const { error } = await supabase
            .from('matches')
            .update({ status: 'QC' })
            .eq('match_id', activeMatch.match_id);
        
        if (!error) {
            alert("Match submitted to QC!");
            window.location.hash = '#matches';
        }
    });

    // Modal Events
    document.getElementById('btn-ko-l2r').addEventListener('click', () => {
        document.getElementById('kickoff-modal').style.display = 'none';
        currentState.homeDirection = 'L2R';
        document.getElementById('direction-btn').innerText = `➡ Direct: L2R`;
        logEventWithNote(`Home Direction Set: L2R`);
    });
    document.getElementById('btn-ko-r2l').addEventListener('click', () => {
        document.getElementById('kickoff-modal').style.display = 'none';
        currentState.homeDirection = 'R2L';
        document.getElementById('direction-btn').innerText = `➡ Direct: R2L`;
        logEventWithNote(`Home Direction Set: R2L`);
    });

    // Keyboard Hotkeys
    // (Already handled at start of initTagger)
}

function renderPlayerGrids() {
    const homeGrid = document.getElementById('home-player-grid');
    const awayGrid = document.getElementById('away-player-grid');
    
    const posOrder = { 'GK': 1, 'DF': 2, 'MF': 3, 'FW': 4 };

    const sortPlayers = (a, b) => {
        if (a.starting_xi !== b.starting_xi) return b.starting_xi ? 1 : -1;
        const pA = posOrder[a.players.position] || 99;
        const pB = posOrder[b.players.position] || 99;
        if (pA !== pB) return pA - pB;
        return parseInt(a.jersey_no) - parseInt(b.jersey_no);
    };

    const renderGrid = (gridEl, teamId) => {
        const players = activeLineup.filter(l => l.team_id === teamId).sort(sortPlayers);
        gridEl.innerHTML = players.map(p => `
            <button class="player-btn p-${p.player_id}" 
                title="${p.players.player_name} (${p.players.position})"
                onclick="window.taggerSelectPlayer('${p.player_id}', '${p.team_id}', '${p.players.player_name}', '${p.jersey_no}')">
                ${p.jersey_no}
            </button>
        `).join('');
    };

    const renderDialGrid = (dialEl, teamId) => {
        const players = activeLineup.filter(l => l.team_id === teamId).sort(sortPlayers);
        dialEl.innerHTML = players.map(p => `
            <button class="player-btn p-${p.player_id}" style="width: 26px; height: 26px; min-width: 26px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.65rem;"
                title="${p.players.player_name} (${p.players.position})"
                onclick="window.taggerSelectPlayer('${p.player_id}', '${p.team_id}', '${p.players.player_name}', '${p.jersey_no}'); document.getElementById('player-dial').style.display='none';">
                ${p.jersey_no}
            </button>
        `).join('');
    };

    renderGrid(homeGrid, activeMatch.home_team_id);
    renderGrid(awayGrid, activeMatch.away_team_id);
    
    document.getElementById('dial-home-name').innerText = activeMatch.home_team.team_name;
    document.getElementById('dial-away-name').innerText = activeMatch.away_team.team_name;
    renderDialGrid(document.getElementById('dial-home-players'), activeMatch.home_team_id);
    renderDialGrid(document.getElementById('dial-away-players'), activeMatch.away_team_id);

    // Expose selectPlayer to window for the onclick handler
    window.taggerSelectPlayer = (playerId, teamId, name, jersey) => {
        const isAction = !currentState.actionPlayer || (currentState.actionPlayer.id === playerId);
        
        if (isAction) {
            if (currentState.actionPlayer?.id === playerId) {
                currentState.actionPlayer = null;
            } else {
                currentState.actionPlayer = { id: playerId, teamId, name, jersey };
                // If this is now a response, we might need a reaction player
            }
        } else {
            if (currentState.reactionPlayer?.id === playerId) {
                currentState.reactionPlayer = null;
            } else {
                currentState.reactionPlayer = { id: playerId, teamId, name, jersey };
            }
        }
        updateLineupState();
    };
}

function updateLineupState() {
    const actionSelect = document.getElementById('action-select').value;
    const rule = ACTION_RULES[actionSelect];

    document.querySelectorAll('.player-btn').forEach(btn => {
        btn.classList.remove('action-active', 'reaction-active', 'disabled');
        const pId = btn.className.match(/p-([\w-]+)/)[1];
        const lineupItem = activeLineup.find(l => l.player_id === pId);

        if (currentState.actionPlayer?.id === pId) btn.classList.add('action-active');
        if (currentState.reactionPlayer?.id === pId) btn.classList.add('reaction-active');

        // Validation logic for disabling players based on CAC rules
        if (currentState.actionPlayer) {
            const isSameTeam = lineupItem.team_id === currentState.actionPlayer.teamId;
            const isSamePlayer = pId === currentState.actionPlayer.id;

            if (rule.reaction === "None" && !isSamePlayer) btn.classList.add('disabled');
            if (rule.reaction === "Same" && !isSameTeam && !isSamePlayer) btn.classList.add('disabled');
            if ((rule.reaction === "Opposite" || rule.reaction === "OppositeOrNone") && isSameTeam) btn.classList.add('disabled');
            if (isSamePlayer && currentState.reactionPlayer) btn.classList.add('disabled');
        }
    });

    document.getElementById('action-player-lbl').innerText = currentState.actionPlayer ? `${currentState.actionPlayer.name} (#${currentState.actionPlayer.jersey})` : 'None';
    document.getElementById('reaction-player-lbl').innerText = currentState.reactionPlayer ? `${currentState.reactionPlayer.name} (#${currentState.reactionPlayer.jersey})` : 'None';
}

function handleHotkeys(e) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    
    const key = e.key.toLowerCase();
    const actionSelect = document.getElementById('action-select');
    const outcomeSelect = document.getElementById('outcome-select');

    if (e.code === 'Space') {
        e.preventDefault();
        video.togglePlay();
    } else if (e.code === 'ArrowRight') {
        video.seek(video.getCurrentTime() + 3);
    } else if (e.code === 'ArrowLeft') {
        video.seek(video.getCurrentTime() - 3);
    } else if (e.code === 'Enter') {
        e.preventDefault();
        logEvent();
    } else if (key === 'v') {
        document.getElementById('pressure-btn').click();
    } else if (key === 'c') { 
        actionSelect.value = 'Carry'; 
        actionSelect.dispatchEvent(new Event('change')); 
    } else if (key === 'p') { 
        actionSelect.value = 'Pass Intercept'; 
        actionSelect.dispatchEvent(new Event('change')); 
    } else if (key === 't') { 
        actionSelect.value = 'Through Ball'; 
        actionSelect.dispatchEvent(new Event('change')); 
    } else if (key === 'u') { 
        if (['Pass', 'Through Ball'].includes(actionSelect.value)) {
            outcomeSelect.value = 'Unsuccessful'; 
            outcomeSelect.dispatchEvent(new Event('change'));
        }
    } else if (key === 'l') { 
        document.getElementById('body-part-select').value = 'Left Leg'; 
    } else if (key === 'h') { 
        document.getElementById('body-part-select').value = 'Head'; 
    }
}

async function logEvent() {
    logEventWithNote("");
}

async function logEventWithNote(kickoffNote) {
    if (!currentState.actionPlayer) {
        alert("Select an Action Player");
        return;
    }
    if (!pitch.startPoint) {
        alert("Mark a Start Point on the pitch");
        return;
    }

    const actionVal = document.getElementById('action-select').value;
    const rule = ACTION_RULES[actionVal];

    if (rule.end_point && !pitch.endPoint) {
        alert("Mark an End Point on the pitch");
        return;
    }
    if (rule.reaction === "Same" && currentState.reactionPlayer && currentState.reactionPlayer.teamId !== currentState.actionPlayer.teamId) {
        alert("Reaction Player must be on the SAME team.");
        return;
    }
    if (rule.reaction === "Opposite" && (!currentState.reactionPlayer || currentState.reactionPlayer.teamId === currentState.actionPlayer.teamId)) {
        alert("Reaction Player must be on the OPPONENT team.");
        return;
    }
    if (rule.reaction === "OppositeOrNone" && currentState.reactionPlayer && currentState.reactionPlayer.teamId === currentState.actionPlayer.teamId) {
        alert("Reaction Player must be on the OPPONENT team or None.");
        return;
    }

    const typeVal = document.getElementById('type-select').value || null;
    if (actionVal === 'Match Time' && typeVal === 'Kick-Off' && !kickoffNote) {
        document.getElementById('kickoff-team-name').innerText = activeMatch.home_team.team_name;
        document.getElementById('kickoff-modal').style.display = 'block';
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const outcome = document.getElementById('outcome-select').value;
    
    let autoNote = "";
    if ((actionVal === 'Pass' && ['Assist', 'Key Pass'].includes(outcome)) || ['Shoot', 'Pass Intercept'].includes(actionVal)) {
        autoNote = "Check body part";
    }
    
    let userNotes = document.getElementById('action-notes').value.trim();
    let finalNotes = autoNote ? (userNotes ? `${userNotes} | ${autoNote}` : autoNote) : userNotes;
    if (kickoffNote) finalNotes = finalNotes ? `${finalNotes} | ${kickoffNote}` : kickoffNote;
    
    const event = {
        match_id: activeMatch.match_id,
        analyst_id: user.id,
        match_time_seconds: Math.floor(video.getCurrentTime()),
        start_x: pitch.startPoint.x,
        start_y: pitch.startPoint.y,
        end_x: pitch.endPoint ? pitch.endPoint.x : null,
        end_y: pitch.endPoint ? pitch.endPoint.y : null,
        end_z: goalFace.shotTarget ? goalFace.shotTarget.z : null,
        action: actionVal,
        outcome: outcome,
        type: typeVal,
        body_part: document.getElementById('body-part-select').value === 'NA' ? null : document.getElementById('body-part-select').value,
        player_id: currentState.actionPlayer.id,
        reaction_player_id: currentState.reactionPlayer?.id || null,
        team_direction: getFinalDirection(),
        notes: finalNotes || null,
        is_futsal: activeMatch.is_futsal,
        pressure_on: currentState.isPressureOn,
        _ui_player: `${currentState.actionPlayer.name} (${currentState.actionPlayer.jersey})`,
        _ui_reaction_player: currentState.reactionPlayer ? `${currentState.reactionPlayer.name} (${currentState.reactionPlayer.jersey})` : null
    };

    localEvents.push(event);
    renderStaging();
    
    // Auto-advance logic
    const nextStart = pitch.endPoint || pitch.startPoint;
    pitch.reset();
    pitch.startPoint = nextStart;
    pitch.draw();
    
    goalFace.reset();
    document.getElementById('action-notes').value = '';
    
    // Keep pressure state for next entry (user preference)

    // Reset Action to Pass and Body Part to Right Leg
    const actionSelect = document.getElementById('action-select');
    if (actionSelect.value !== 'Pass') {
        actionSelect.value = 'Pass';
        actionSelect.dispatchEvent(new Event('change'));
    }
    document.getElementById('body-part-select').value = 'Right Leg';

    // If reaction existed, make them the next action player (Possession flow)
    if (currentState.reactionPlayer) {
        const nextAction = { ...currentState.reactionPlayer };
        currentState.actionPlayer = nextAction;
        currentState.reactionPlayer = null;
    } else {
        // Keep current action player for now or clear? 
        // Typically taggers keep the player selected for consecutive actions.
    }
    updateLineupState();
}

function getFinalDirection() {
    if (!currentState.actionPlayer || !activeMatch) return currentState.homeDirection;
    const isHome = currentState.actionPlayer.teamId === activeMatch.home_team_id;
    if (isHome) return currentState.homeDirection;
    return currentState.homeDirection === 'L2R' ? 'R2L' : 'L2R';
}

function renderStaging() {
    const body = document.getElementById('staging-body');
    if (!body) return;
    body.innerHTML = localEvents.map((e, idx) => `
        <tr style="border-bottom: 1px solid var(--border); ${idx % 2 === 0 ? 'background: rgba(0,0,0,0.02);' : ''}">
            <td style="padding: 6px; white-space: nowrap;">${Math.floor(e.match_time_seconds / 60)}:${(e.match_time_seconds % 60).toString().padStart(2, '0')}</td>
            <td style="padding: 6px; font-weight: 600;">${e.team_direction}</td>
            <td style="padding: 6px;"><span style="color:var(--brand);font-weight:600;">${e.action}</span><br><span style="color:var(--text-muted);font-size:0.65rem;">${e.outcome}</span></td>
            <td style="padding: 6px;">${e.type || '-'}</td>
            <td style="padding: 6px;">${e.body_part || '-'}</td>
            <td style="padding: 6px;">${e.pressure_on ? '🔥 Y' : 'N'}</td>
            <td style="padding: 6px; white-space: nowrap;">
                ⚡ ${e._ui_player}<br>
                ${e._ui_reaction_player ? '<span style="color:var(--text-muted);font-size:0.65rem;">🛡 '+e._ui_reaction_player+'</span>' : ''}
            </td>
            <td style="padding: 6px; font-family: var(--font-mono); font-size: 0.65rem; white-space: nowrap;">
                S: ${e.start_x},${e.start_y}<br>
                E: ${e.end_x !== null ? e.end_x+','+e.end_y : '-'}${e.end_z !== null ? ' (z:'+e.end_z+')' : ''}
            </td>
            <td style="padding: 6px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${e.notes || ''}">
                ${e.notes || '-'}
            </td>
            <td style="padding: 6px; text-align: center;">
                <button onclick="window.removeStagedEvent(${idx})" style="background: none; border: none; cursor: pointer; filter: grayscale(1);">❌</button>
            </td>
        </tr>
    `).reverse().join('');
    
    window.removeStagedEvent = (idx) => {
        localEvents.splice(idx, 1);
        renderStaging();
    };
}

async function syncEvents() {
    if (localEvents.length === 0) return;
    const btn = document.getElementById('sync-btn');
    btn.innerText = 'Syncing...';
    btn.disabled = true;

    // Remove UI helper fields
    const payload = localEvents.map(({ _ui_player, _ui_reaction_player, ...rest }) => rest);

    const { error } = await supabase.from('match_events').insert(payload);

    if (error) {
        alert("Sync Error: " + error.message);
        btn.innerText = 'Sync Retry';
        btn.disabled = false;
    } else {
        localEvents = [];
        renderStaging();
        btn.innerText = '☁ Synced';
        setTimeout(() => {
            btn.innerText = '☁ Sync All';
            btn.disabled = false;
        }, 2000);
    }
}

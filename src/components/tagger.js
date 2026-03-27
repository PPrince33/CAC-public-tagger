import { supabase } from '../supabase'
import { CAC_LOGIC, ACTION_RULES } from '../lib/cacLogic'
import { PitchCanvas } from '../lib/pitchCanvas'
import { GoalFaceCanvas } from '../lib/goalFace'
import { VideoEngine } from '../lib/videoEngine'

export function TaggerView() {
    return `
        <div class="fade-in tagger-app" style="height: calc(100vh - 32px); display: flex; flex-direction: column; gap: 16px;">
            <!-- Lock / Collaboration Banner -->
            <div id="lock-banner" class="lock-banner" style="display: none;"></div>

            <header class="tagger-header" style="display: flex; justify-content: space-between; align-items: center; padding: 0 8px; flex-wrap: wrap; gap: 8px;">
                <div>
                    <h2 id="match-title" style="margin-bottom: 4px;">Loading Match...</h2>
                    <div id="match-subtitle" style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Match ID: ...</div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <!-- Progress Indicator -->
                    <div id="progress-indicator" style="display: flex; align-items: center; gap: 6px; font-size: 0.7rem; color: var(--text-muted); padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-card);">
                        <span id="progress-count">0</span> events |
                        <span id="progress-time">0:00</span> tagged
                    </div>
                    <button class="btn btn-ghost" style="width: auto; padding: 6px 12px; border: 1px solid var(--border); font-size: 0.7rem;" id="undo-btn" title="Undo last event (Ctrl+Z)">Undo</button>
                    <button class="btn btn-ghost" style="width: auto; padding: 6px 12px; border: 1px solid var(--border); font-size: 0.7rem;" id="shortcuts-btn" title="Keyboard shortcuts (?)">Keys [?]</button>
                    <button class="btn btn-ghost" style="width: auto; padding: 6px 12px; border: 1px solid var(--border); font-size: 0.7rem;" id="toggle-sidebar-btn">Toggle Sidebar</button>
                    <button class="btn btn-ghost" style="width: auto; padding: 6px 12px; font-size: 0.7rem;" id="back-to-matches">Back</button>
                    <button class="btn btn-primary" style="width: auto; padding: 6px 16px; background: var(--success); font-size: 0.7rem;" id="finish-match-btn">Finish Match</button>
                </div>
            </header>

            <div class="tagger-layout" style="flex-grow: 1; display: grid; grid-template-columns: 1fr 480px; gap: 16px; min-height: 0;">
                <!-- Left Column: Video & Log -->
                <div style="display: flex; flex-direction: column; gap: 16px; overflow-y: auto; padding-right: 8px;">
                    <!-- Video Source Bar -->
                    <div class="card" style="padding: 12px; flex-shrink: 0;">
                        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                            <select id="video-source-select" class="form-input" style="width: 120px; padding: 6px 10px; font-size: 0.75rem;">
                                <option value="youtube">YouTube</option>
                                <option value="local">Local File</option>
                            </select>
                            <input type="text" id="video-url-input" class="form-input" style="flex: 1; min-width: 150px; padding: 6px 10px; font-size: 0.75rem;" placeholder="Paste YouTube URL here...">
                            <button id="load-video-btn" class="btn btn-primary" style="width: auto; padding: 6px 16px; font-size: 0.75rem;">Load</button>
                            <input type="file" id="local-video-file" style="display: none;" accept="video/*">
                            <button id="upload-local-btn" class="btn btn-ghost" style="width: auto; padding: 6px 12px; font-size: 0.75rem; display: none;">Browse</button>
                        </div>
                    </div>

                    <!-- Video Section -->
                    <div id="main-video-card" class="card" style="padding: 0; overflow: hidden; position: relative; flex-shrink: 0;">
                        <div id="video-wrapper" style="aspect-ratio: 16/9; background: #000;">
                            <div id="video-container" style="width: 100%; height: 100%;"></div>
                        </div>
                    </div>

                    <!-- Staging Table -->
                    <div class="card" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 16px; min-height: 300px; flex-shrink: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                            <h4 style="margin:0;">Event Log</h4>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <span id="sync-status" style="font-size: 0.7rem; color: var(--text-muted);"></span>
                                <button id="sync-btn" class="btn btn-ghost" style="width: auto; padding: 4px 12px; font-size: 0.75rem; color: var(--success);">Sync All</button>
                            </div>
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
                <div class="tagger-right-col" style="display: flex; flex-direction: column; gap: 16px; min-height: 0; overflow-y: auto;">
                    <!-- Pitch Canvas -->
                    <div class="card" style="padding: 12px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0;">
                        <canvas id="pitch-canvas" width="480" height="320" style="width: 100%; max-width: 480px; border-radius: var(--radius-sm);"></canvas>
                        <div id="pitch-coords" style="margin-top: 8px; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">Start: None | End: None</div>
                        <div id="pitch-players" style="margin-top: 4px; font-size: 0.75rem; color: var(--text-main); font-weight: 600;"></div>
                        <div style="display: flex; gap: 8px; margin-top: 8px;">
                            <button id="clear-pitch-btn" class="btn btn-ghost" style="width: auto; padding: 4px 12px; font-size: 0.7rem; border: 1px solid var(--border);">Clear Pitch</button>
                            <button id="deselect-players-btn" class="btn btn-ghost" style="width: auto; padding: 4px 12px; font-size: 0.7rem; border: 1px solid var(--border);">Deselect Players</button>
                        </div>
                    </div>

                    <!-- Goal Face Overlay (Conditional) -->
                    <div id="goal-face-overlay" class="card" style="display: none; padding: 12px; flex-direction: column; align-items: center; border-color: var(--accent); flex-shrink: 0;">
                         <h4 style="margin-bottom: 8px; font-size: 0.875rem;">Shot Placement (Goal Face)</h4>
                         <canvas id="goal-face-canvas" width="400" height="200" style="width: 100%; max-width: 400px; border-radius: var(--radius-sm);"></canvas>
                         <div id="goal-coords" style="margin-top: 8px; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">End_Z: None | Y_Off: None</div>
                    </div>

                    <!-- Shot Metadata (Conditional - only for Shoot) -->
                    <div id="shot-metadata-overlay" class="card" style="display: none; padding: 12px; flex-direction: column; border-color: var(--warning); flex-shrink: 0;">
                        <h4 style="margin-bottom: 8px; font-size: 0.875rem;">Shot Details</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label class="form-label">Shot Technique</label>
                                <select id="shot-technique-select" class="form-input">
                                    <option value="Normal" selected>Normal</option>
                                    <option value="Volley">Volley</option>
                                    <option value="Half-volley">Half-volley</option>
                                    <option value="Header">Header</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">First Time Shot</label>
                                <select id="first-time-shot-select" class="form-input">
                                    <option value="0" selected>0 (No)</option>
                                    <option value="1">1 (Yes)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Assist Type</label>
                                <select id="assist-type-select" class="form-input">
                                    <option value="Normal Pass" selected>Normal Pass</option>
                                    <option value="Cross">Cross</option>
                                    <option value="Through ball">Through ball</option>
                                    <option value="Rebound">Rebound</option>
                                    <option value="Corner">Corner</option>
                                    <option value="Free Kick">Free Kick</option>
                                    <option value="Penalty">Penalty</option>
                                </select>
                            </div>
                        </div>
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
                                Pressure: OFF
                            </button>
                            <button id="direction-btn" class="btn btn-ghost" style="width: auto; flex: 1; border: 1px solid var(--border); padding: 8px;">
                                Direct: L2R
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
                    <button onclick="document.getElementById('player-dial').style.display='none'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;">X</button>
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
                <h3 style="margin-top: 0; color: var(--success);">Kick-Off Direction</h3>
                <p>Which direction is <b id="kickoff-team-name" style="color:var(--accent); font-size: 1.125rem;">Home Team</b> playing right now?</p>
                <div style="display: flex; gap: 12px; margin-top: 24px;">
                    <button class="btn btn-primary" id="btn-ko-l2r" style="background: var(--success); flex: 1;">Left -> Right</button>
                    <button class="btn btn-primary" id="btn-ko-r2l" style="background: var(--accent); flex: 1;">Right -> Left</button>
                </div>
                <button class="btn btn-ghost" onclick="document.getElementById('kickoff-modal').style.display='none'" style="margin-top: 16px; width: 100%;">Cancel Adding Event</button>
            </div>

            <!-- Keyboard Shortcuts Modal -->
            <div id="shortcuts-modal" style="display: none; position: fixed; inset: 0; z-index: 5000; background: rgba(0,0,0,0.6); display: none; align-items: center; justify-content: center;">
                <div class="card" style="width: 500px; max-width: 90vw; max-height: 80vh; overflow-y: auto; padding: 24px; box-shadow: var(--shadow-lg);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="margin: 0;">Keyboard Shortcuts</h3>
                        <button id="close-shortcuts" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-muted);">X</button>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
                        <thead>
                            <tr style="border-bottom:2px solid var(--border);">
                                <th style="padding:8px;text-align:left;color:var(--text-muted);">Key</th>
                                <th style="padding:8px;text-align:left;color:var(--text-muted);">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">Space</kbd></td><td style="padding:6px 8px;">Play / Pause video</td></tr>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">Arrow Right</kbd></td><td style="padding:6px 8px;">Skip forward 3s</td></tr>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">Arrow Left</kbd></td><td style="padding:6px 8px;">Skip backward 3s</td></tr>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">Enter</kbd></td><td style="padding:6px 8px;">Log Event</td></tr>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">Ctrl+Z</kbd></td><td style="padding:6px 8px;">Undo last event</td></tr>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">C</kbd></td><td style="padding:6px 8px;">Set action to Carry</td></tr>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">P</kbd></td><td style="padding:6px 8px;">Set action to Pass Intercept</td></tr>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">T</kbd></td><td style="padding:6px 8px;">Set action to Through Ball</td></tr>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">U</kbd></td><td style="padding:6px 8px;">Set outcome to Missed (for Pass/Through Ball)</td></tr>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">V</kbd></td><td style="padding:6px 8px;">Toggle Pressure ON/OFF</td></tr>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">L</kbd></td><td style="padding:6px 8px;">Set body part to Left Leg</td></tr>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">H</kbd></td><td style="padding:6px 8px;">Set body part to Head</td></tr>
                            <tr><td style="padding:6px 8px;"><kbd class="kbd">?</kbd> or <kbd class="kbd">F1</kbd></td><td style="padding:6px 8px;">Show this shortcuts overlay</td></tr>
                        </tbody>
                    </table>
                </div>
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
                .player-btn.action-active { background: #22c55e !important; color: white !important; border-color: #22c55e !important; }
                .player-btn.reaction-active { background: #ef4444 !important; color: white !important; border-color: #ef4444 !important; }
                .player-btn.disabled { opacity: 0.3; cursor: not-allowed; }
                .dial-btn { width: 26px; height: 26px; min-width: 26px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.65rem; }
                .kbd { display: inline-block; padding: 2px 8px; background: var(--primary-light); border: 1px solid var(--border); border-radius: 4px; font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700; }
                .lock-banner { padding: 8px 16px; font-size: 0.8rem; font-weight: 600; text-align: center; border-radius: var(--radius-md); margin-bottom: 4px; }
                .editable-cell { cursor: pointer; border-bottom: 1px dashed var(--text-muted); }
                .editable-cell:hover { background: var(--hover-bg); }

                /* Mobile responsive for tagger */
                @media (max-width: 1024px) {
                    .tagger-layout { grid-template-columns: 1fr !important; }
                    .tagger-right-col { order: -1; }
                }
                @media (max-width: 600px) {
                    .tagger-header { flex-direction: column; align-items: flex-start; }
                    .player-grid { grid-template-columns: repeat(4, 1fr) !important; }
                }
            </style>
        </div>
    `;
}

// ──────────────────────────────────────────
// MODULE STATE
// ──────────────────────────────────────────
let pitch = null;
let goalFace = null;
let video = null;
let activeMatch = null;
let activeLineup = [];
let localEvents = [];
let undoStack = []; // For undo functionality
let lockHeartbeatInterval = null;
let autoSyncPending = false;
let currentState = {
    actionPlayer: null,
    reactionPlayer: null,
    isPressureOn: false,
    homeDirection: 'L2R',
};

// ──────────────────────────────────────────
// LOCAL STORAGE PERSISTENCE
// ──────────────────────────────────────────
function getStorageKey() {
    return activeMatch ? `cac_unsync_${activeMatch.match_id}` : null;
}

function saveEventsToStorage() {
    const key = getStorageKey();
    if (key && localEvents.length > 0) {
        localStorage.setItem(key, JSON.stringify(localEvents));
    } else if (key) {
        localStorage.removeItem(key);
    }
}

function loadEventsFromStorage() {
    const key = getStorageKey();
    if (!key) return;
    try {
        const saved = localStorage.getItem(key);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                localEvents = parsed;
                console.log(`Restored ${localEvents.length} unsynced events from localStorage`);
            }
        }
    } catch (e) {
        console.warn('Failed to restore events from localStorage:', e);
    }
}

// ──────────────────────────────────────────
// SESSION STATE PERSISTENCE
// ──────────────────────────────────────────
let _restoringSession = false;

function getSessionKey() {
    return activeMatch ? `cac_session_${activeMatch.match_id}` : null;
}

function saveSessionState() {
    if (_restoringSession) return;
    const key = getSessionKey();
    if (!key) return;
    const session = {
        startPoint: pitch ? pitch.startPoint : null,
        endPoint: pitch ? pitch.endPoint : null,
        actionPlayer: currentState.actionPlayer,
        reactionPlayer: currentState.reactionPlayer,
        isPressureOn: currentState.isPressureOn,
        homeDirection: currentState.homeDirection,
        action: document.getElementById('action-select')?.value || 'Pass',
        outcome: document.getElementById('outcome-select')?.value || 'Successful',
        type: document.getElementById('type-select')?.value || null,
        bodyPart: document.getElementById('body-part-select')?.value || 'Right Leg',
    };
    localStorage.setItem(key, JSON.stringify(session));
}

function loadSessionState() {
    const key = getSessionKey();
    if (!key) return null;
    try {
        const saved = localStorage.getItem(key);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.warn('Failed to restore session state:', e);
    }
    return null;
}

// ──────────────────────────────────────────
// MATCH LOCKING
// ──────────────────────────────────────────
async function acquireMatchLock(matchId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data, error } = await supabase.rpc('acquire_match_lock', {
            p_match_id: matchId,
            p_user_id: user.id
        });

        if (error) {
            console.warn('Lock RPC not available:', error.message);
            return true; // Graceful fallback if RPC doesn't exist yet
        }
        return data === true;
    } catch (e) {
        console.warn('Lock acquisition failed:', e);
        return true; // Fallback
    }
}

async function refreshMatchLock(matchId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.rpc('refresh_match_lock', {
            p_match_id: matchId,
            p_user_id: user.id
        });
    } catch (e) {
        // Silently fail
    }
}

async function releaseMatchLock(matchId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.rpc('release_match_lock', {
            p_match_id: matchId,
            p_user_id: user.id
        });
    } catch (e) {
        // Silently fail
    }
}

function startLockHeartbeat(matchId) {
    stopLockHeartbeat();
    lockHeartbeatInterval = setInterval(() => refreshMatchLock(matchId), 2 * 60 * 1000); // Every 2 min
}

function stopLockHeartbeat() {
    if (lockHeartbeatInterval) {
        clearInterval(lockHeartbeatInterval);
        lockHeartbeatInterval = null;
    }
}

async function checkMatchLock(matchId) {
    try {
        const { data, error } = await supabase
            .from('matches')
            .select('locked_by, locked_at, profiles!locked_by(username)')
            .eq('match_id', matchId)
            .single();

        if (error || !data) return null;
        if (!data.locked_by) return null;

        const { data: { user } } = await supabase.auth.getUser();
        if (data.locked_by === user?.id) return null; // Our own lock

        const lockAge = Date.now() - new Date(data.locked_at).getTime();
        if (lockAge > 10 * 60 * 1000) return null; // Stale lock

        return data.profiles?.username || 'Another analyst';
    } catch (e) {
        return null;
    }
}

// ──────────────────────────────────────────
// AUTO-SYNC
// ──────────────────────────────────────────
function setupAutoSync() {
    window.addEventListener('cac-online', async () => {
        if (localEvents.length > 0 && !autoSyncPending) {
            autoSyncPending = true;
            const syncStatus = document.getElementById('sync-status');
            if (syncStatus) syncStatus.textContent = 'Reconnected! Auto-syncing...';
            await syncEvents();
            autoSyncPending = false;
        }
    });

    // Update offline banner with event count
    window.addEventListener('offline', () => {
        updateOfflineBanner();
    });
}

function updateOfflineBanner() {
    const offlineText = document.getElementById('offline-text');
    if (offlineText && !navigator.onLine && localEvents.length > 0) {
        offlineText.textContent = `You are offline — ${localEvents.length} events saved locally`;
    }
}

// ──────────────────────────────────────────
// PROGRESS INDICATOR
// ──────────────────────────────────────────
function updateProgress() {
    const countEl = document.getElementById('progress-count');
    const timeEl = document.getElementById('progress-time');
    if (!countEl || !timeEl) return;

    const total = localEvents.length + syncedEvents.length;
    countEl.textContent = total;

    // Find max tagged time
    const allEvents = [...localEvents, ...syncedEvents];
    if (allEvents.length > 0) {
        const maxTime = Math.max(...allEvents.map(e => e.match_time_seconds || 0));
        const mins = Math.floor(maxTime / 60);
        const secs = (maxTime % 60).toString().padStart(2, '0');
        timeEl.textContent = `${mins}:${secs}`;
    } else {
        timeEl.textContent = '0:00';
    }
}

// ──────────────────────────────────────────
// UNDO
// ──────────────────────────────────────────
function undoLastEvent() {
    if (localEvents.length === 0) return;
    const removed = localEvents.pop();
    undoStack.push(removed);
    saveEventsToStorage();
    renderStaging();
    updateProgress();

    const syncStatus = document.getElementById('sync-status');
    if (syncStatus) {
        syncStatus.textContent = 'Undone! Press Ctrl+Shift+Z to redo.';
        setTimeout(() => { syncStatus.textContent = ''; }, 3000);
    }
}

function redoLastEvent() {
    if (undoStack.length === 0) return;
    const restored = undoStack.pop();
    localEvents.push(restored);
    saveEventsToStorage();
    renderStaging();
    updateProgress();
}

// ──────────────────────────────────────────
// INIT TAGGER
// ──────────────────────────────────────────
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
        undoStack = [];
    }

    activeMatch = match;

    // ── Match Locking ──
    const lockBanner = document.getElementById('lock-banner');
    const lockedBy = await checkMatchLock(matchId);
    if (lockedBy) {
        lockBanner.style.display = 'block';
        lockBanner.style.background = 'var(--warning)';
        lockBanner.style.color = '#000';
        lockBanner.innerHTML = `This match is being edited by <strong>${lockedBy}</strong>. Your changes may conflict.`;
    }

    const gotLock = await acquireMatchLock(matchId);
    if (gotLock) {
        startLockHeartbeat(matchId);
    }

    // Release lock when navigating away
    const releaseLockOnLeave = () => {
        releaseMatchLock(matchId);
        stopLockHeartbeat();
    };
    window.addEventListener('hashchange', releaseLockOnLeave, { once: true });
    window.addEventListener('beforeunload', releaseLockOnLeave);

    // Restore any unsynced events from localStorage (survives page reload)
    if (localEvents.length === 0) {
        loadEventsFromStorage();
        renderStaging();
    }
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
        video = new VideoEngine('video-container', 'youtube');
        video.loadYouTube(url);
        await supabase.from('matches').update({ video_url: url }).eq('match_id', matchId);
    });

    pitch.onCoordsChange = (start, end, e) => {
        document.getElementById('pitch-coords').innerText = `Start: ${start ? start.x+','+start.y : 'None'} | End: ${end ? end.x+','+end.y : 'None'}`;
        saveSessionState();

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

        // Toggle Goal Face and Shot Metadata
        document.getElementById('goal-face-overlay').style.display = act === 'Shoot' ? 'flex' : 'none';
        document.getElementById('shot-metadata-overlay').style.display = act === 'Shoot' ? 'flex' : 'none';

        // Enforce end point / reaction player rules for the selected action
        const rule = ACTION_RULES[act];
        pitch.allowEndPoint = rule.end_point;
        if (!rule.end_point && pitch.endPoint) {
            pitch.endPoint = null;
            pitch.draw();
            document.getElementById('pitch-coords').innerText = `Start: ${pitch.startPoint ? pitch.startPoint.x+','+pitch.startPoint.y : 'None'} | End: None`;
        }
        if (rule.reaction === "None" && currentState.reactionPlayer) {
            currentState.reactionPlayer = null;
        }

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

    actionSelect.addEventListener('change', () => { updateOutcomes(); saveSessionState(); });
    outcomeSelect.addEventListener('change', () => { updateTypes(); saveSessionState(); });
    _restoringSession = true;
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
    activeLineup = lineup || [];
    renderPlayerGrids();

    // Load previously synced events from DB
    await loadSyncedEvents();

    // 6. Restore session state from localStorage
    const savedSession = loadSessionState();
    if (savedSession) {
        if (savedSession.startPoint) pitch.startPoint = savedSession.startPoint;
        if (savedSession.endPoint) pitch.endPoint = savedSession.endPoint;
        pitch.draw();
        document.getElementById('pitch-coords').innerText = `Start: ${pitch.startPoint ? pitch.startPoint.x+','+pitch.startPoint.y : 'None'} | End: ${pitch.endPoint ? pitch.endPoint.x+','+pitch.endPoint.y : 'None'}`;

        if (savedSession.actionPlayer) currentState.actionPlayer = savedSession.actionPlayer;
        if (savedSession.reactionPlayer) currentState.reactionPlayer = savedSession.reactionPlayer;
        if (savedSession.homeDirection) currentState.homeDirection = savedSession.homeDirection;
        if (savedSession.isPressureOn !== undefined) currentState.isPressureOn = savedSession.isPressureOn;

        if (savedSession.action && actionSelect.querySelector(`option[value="${savedSession.action}"]`)) {
            actionSelect.value = savedSession.action;
            outcomeSelect.innerHTML = '';
            Object.keys(CAC_LOGIC[savedSession.action]).forEach(out => outcomeSelect.add(new Option(out, out)));
            document.getElementById('goal-face-overlay').style.display = savedSession.action === 'Shoot' ? 'flex' : 'none';
            document.getElementById('shot-metadata-overlay').style.display = savedSession.action === 'Shoot' ? 'flex' : 'none';

            // Enforce end point / reaction player rules for the restored action
            const rule = ACTION_RULES[savedSession.action];
            if (rule) {
                pitch.allowEndPoint = rule.end_point;
                if (!rule.end_point && pitch.endPoint) {
                    pitch.endPoint = null;
                    pitch.draw();
                    document.getElementById('pitch-coords').innerText = `Start: ${pitch.startPoint ? pitch.startPoint.x+','+pitch.startPoint.y : 'None'} | End: None`;
                }
                if (rule.reaction === "None" && currentState.reactionPlayer) {
                    currentState.reactionPlayer = null;
                }
            }
        }
        if (savedSession.outcome && outcomeSelect.querySelector(`option[value="${savedSession.outcome}"]`)) {
            outcomeSelect.value = savedSession.outcome;
            typeSelect.innerHTML = '';
            const types = CAC_LOGIC[savedSession.action]?.[savedSession.outcome] || [];
            types.forEach(t => { if (t !== 'NA') typeSelect.add(new Option(t, t)); });
        }
        if (savedSession.type && typeSelect.querySelector(`option[value="${savedSession.type}"]`)) {
            typeSelect.value = savedSession.type;
        }
        if (savedSession.bodyPart) {
            document.getElementById('body-part-select').value = savedSession.bodyPart;
        }

        updateLineupState();
        directionBtn.innerText = `Direct: ${currentState.homeDirection}`;

        _restoringSession = false;
        console.log('Session state restored from localStorage');
    } else {
        _restoringSession = false;
    }

    // 5. Setup Action Handlers
    pressureBtn.innerText = `Pressure: ${currentState.isPressureOn ? 'ON' : 'OFF'}`;
    pressureBtn.style.background = currentState.isPressureOn ? 'var(--danger)' : 'transparent';

    pressureBtn.addEventListener('click', () => {
        currentState.isPressureOn = !currentState.isPressureOn;
        pressureBtn.innerText = `Pressure: ${currentState.isPressureOn ? 'ON' : 'OFF'}`;
        pressureBtn.style.background = currentState.isPressureOn ? 'var(--danger)' : 'transparent';
    });

    directionBtn.addEventListener('click', () => {
        currentState.homeDirection = currentState.homeDirection === 'L2R' ? 'R2L' : 'L2R';
        directionBtn.innerText = `Direct: ${currentState.homeDirection}`;
        saveSessionState();
    });

    document.getElementById('clear-pitch-btn').addEventListener('click', () => {
        pitch.reset();
        pitch.draw();
        document.getElementById('pitch-coords').innerText = 'Start: None | End: None';
        saveSessionState();
    });

    document.getElementById('deselect-players-btn').addEventListener('click', () => {
        currentState.actionPlayer = null;
        currentState.reactionPlayer = null;
        updateLineupState();
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

    addEventBtn.addEventListener('click', logEvent);
    syncBtn.addEventListener('click', syncEvents);

    // Undo button
    document.getElementById('undo-btn').addEventListener('click', undoLastEvent);

    // Keyboard shortcuts modal
    document.getElementById('shortcuts-btn').addEventListener('click', toggleShortcutsModal);
    document.getElementById('close-shortcuts').addEventListener('click', () => {
        document.getElementById('shortcuts-modal').style.display = 'none';
    });
    document.getElementById('shortcuts-modal').addEventListener('click', (e) => {
        if (e.target.id === 'shortcuts-modal') {
            document.getElementById('shortcuts-modal').style.display = 'none';
        }
    });

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
        document.getElementById('direction-btn').innerText = `Direct: L2R`;
        logEventWithNote(`Home Direction Set: L2R`);
    });
    document.getElementById('btn-ko-r2l').addEventListener('click', () => {
        document.getElementById('kickoff-modal').style.display = 'none';
        currentState.homeDirection = 'R2L';
        document.getElementById('direction-btn').innerText = `Direct: R2L`;
        logEventWithNote(`Home Direction Set: R2L`);
    });

    // Setup auto-sync on reconnect
    setupAutoSync();

    // Update progress
    updateProgress();
}

function toggleShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

// ──────────────────────────────────────────
// PLAYER GRIDS
// ──────────────────────────────────────────
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
        gridEl.innerHTML = '';
        players.forEach(p => {
            const btn = document.createElement('button');
            btn.className = `player-btn p-${p.player_id}`;
            btn.title = `${p.players.player_name} (${p.players.position})`;
            btn.textContent = p.jersey_no;
            btn.addEventListener('click', () => {
                if (btn.classList.contains('disabled')) return;
                window.taggerSelectPlayer(p.player_id, p.team_id, p.players.player_name, p.jersey_no);
            });
            gridEl.appendChild(btn);
        });
    };

    const renderDialGrid = (dialEl, teamId) => {
        const players = activeLineup.filter(l => l.team_id === teamId).sort(sortPlayers);
        dialEl.innerHTML = '';
        players.forEach(p => {
            const btn = document.createElement('button');
            btn.className = `player-btn dial-btn p-${p.player_id}`;
            btn.title = `${p.players.player_name} (${p.players.position})`;
            btn.textContent = p.jersey_no;
            btn.addEventListener('click', () => {
                if (btn.classList.contains('disabled')) return;
                window.taggerSelectPlayer(p.player_id, p.team_id, p.players.player_name, p.jersey_no);
                document.getElementById('player-dial').style.display = 'none';
            });
            dialEl.appendChild(btn);
        });
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
            }
        } else {
            if (currentState.actionPlayer && playerId === currentState.actionPlayer.id) return;

            const actionVal = document.getElementById('action-select').value;
            const rule = ACTION_RULES[actionVal];
            if (rule && rule.reaction === "None") return;

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

        if (currentState.actionPlayer && lineupItem) {
            const isSameTeam = lineupItem.team_id === currentState.actionPlayer.teamId;
            const isSamePlayer = pId === currentState.actionPlayer.id;

            if (rule.reaction === "None" && !isSamePlayer) btn.classList.add('disabled');
            if (rule.reaction === "Same" && !isSameTeam && !isSamePlayer) btn.classList.add('disabled');
            if ((rule.reaction === "Opposite" || rule.reaction === "OppositeOrNone") && isSameTeam) btn.classList.add('disabled');
            if (isSamePlayer && rule.reaction !== "None") btn.classList.add('disabled');
        }
    });

    document.getElementById('action-player-lbl').innerText = currentState.actionPlayer ? `${currentState.actionPlayer.name} (#${currentState.actionPlayer.jersey})` : 'None';
    document.getElementById('reaction-player-lbl').innerText = currentState.reactionPlayer ? `${currentState.reactionPlayer.name} (#${currentState.reactionPlayer.jersey})` : 'None';

    const pitchPlayers = document.getElementById('pitch-players');
    if (pitchPlayers) {
        let txt = '';
        if (currentState.actionPlayer) txt += `ACT: ${currentState.actionPlayer.name} #${currentState.actionPlayer.jersey}`;
        if (currentState.reactionPlayer) txt += `  |  RCT: ${currentState.reactionPlayer.name} #${currentState.reactionPlayer.jersey}`;
        pitchPlayers.innerText = txt || '';
    }
    saveSessionState();
}

// ──────────────────────────────────────────
// HOTKEYS
// ──────────────────────────────────────────
function handleHotkeys(e) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    const key = e.key.toLowerCase();
    const actionSelect = document.getElementById('action-select');
    const outcomeSelect = document.getElementById('outcome-select');

    // Ctrl+Z = Undo, Ctrl+Shift+Z = Redo
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
            redoLastEvent();
        } else {
            undoLastEvent();
        }
        return;
    }

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
    } else if (key === '?' || e.code === 'F1') {
        e.preventDefault();
        toggleShortcutsModal();
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
            outcomeSelect.value = 'Missed';
            outcomeSelect.dispatchEvent(new Event('change'));
        }
    } else if (key === 'l') {
        document.getElementById('body-part-select').value = 'Left Leg';
    } else if (key === 'h') {
        document.getElementById('body-part-select').value = 'Head';
    }
}

// ──────────────────────────────────────────
// LOG EVENT
// ──────────────────────────────────────────
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
    if (!rule.end_point && pitch.endPoint) {
        pitch.endPoint = null;
    }
    if (currentState.reactionPlayer && currentState.actionPlayer.id === currentState.reactionPlayer.id) {
        alert("Action Player and Reaction Player cannot be the same.");
        currentState.reactionPlayer = null;
        updateLineupState();
        return;
    }
    if (rule.reaction === "Same" && !currentState.reactionPlayer) {
        alert("Reaction Player is required (must be SAME team).");
        return;
    }
    if (rule.reaction === "Same" && currentState.reactionPlayer && currentState.reactionPlayer.teamId !== currentState.actionPlayer.teamId) {
        alert("Reaction Player must be on the SAME team.");
        return;
    }
    if (rule.reaction === "Opposite" && !currentState.reactionPlayer) {
        alert("Reaction Player is required (must be OPPONENT team).");
        return;
    }
    if (rule.reaction === "Opposite" && currentState.reactionPlayer.teamId === currentState.actionPlayer.teamId) {
        alert("Reaction Player must be on the OPPONENT team.");
        return;
    }
    if (rule.reaction === "OppositeOrNone" && currentState.reactionPlayer && currentState.reactionPlayer.teamId === currentState.actionPlayer.teamId) {
        alert("Reaction Player must be on the OPPONENT team or None.");
        return;
    }
    if (rule.reaction === "None" && currentState.reactionPlayer) {
        currentState.reactionPlayer = null;
        updateLineupState();
    }

    if (!CAC_LOGIC[actionVal]) {
        alert("Invalid action selected.");
        return;
    }

    // Validate coordinates
    const maxX = activeMatch.is_futsal ? 40 : 120;
    const maxY = activeMatch.is_futsal ? 20 : 80;
    if (pitch.startPoint) {
        pitch.startPoint.x = Math.max(0, Math.min(pitch.startPoint.x, maxX));
        pitch.startPoint.y = Math.max(0, Math.min(pitch.startPoint.y, maxY));
    }
    if (pitch.endPoint) {
        pitch.endPoint.x = Math.max(0, Math.min(pitch.endPoint.x, maxX));
        pitch.endPoint.y = Math.max(0, Math.min(pitch.endPoint.y, maxY));
    }

    const typeVal = document.getElementById('type-select').value || null;
    if (actionVal === 'Match Time' && typeVal === 'Kick-Off' && !kickoffNote) {
        document.getElementById('kickoff-team-name').innerText = activeMatch.home_team.team_name;
        document.getElementById('kickoff-modal').style.display = 'block';
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("Session expired. Please log in again.");
        window.location.hash = '#login';
        return;
    }
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
        shot_technique: actionVal === 'Shoot' ? document.getElementById('shot-technique-select').value : null,
        first_time_shot: actionVal === 'Shoot' ? parseInt(document.getElementById('first-time-shot-select').value) : null,
        assist_type: actionVal === 'Shoot' ? document.getElementById('assist-type-select').value : null,
        _ui_player: `${currentState.actionPlayer.name} (${currentState.actionPlayer.jersey})`,
        _ui_reaction_player: currentState.reactionPlayer ? `${currentState.reactionPlayer.name} (${currentState.reactionPlayer.jersey})` : null
    };

    localEvents.push(event);
    undoStack = []; // Clear redo stack on new event
    saveEventsToStorage();
    renderStaging();
    updateProgress();
    updateOfflineBanner();

    // Auto-advance logic
    const nextStart = pitch.endPoint ? { ...pitch.endPoint } : { ...pitch.startPoint };
    pitch.reset();
    pitch.startPoint = nextStart;
    pitch.endPoint = null;
    pitch.draw();

    document.getElementById('pitch-coords').innerText = `Start: ${nextStart.x},${nextStart.y} | End: None`;

    goalFace.reset();
    document.getElementById('action-notes').value = '';

    document.getElementById('shot-technique-select').value = 'Normal';
    document.getElementById('first-time-shot-select').value = '0';
    document.getElementById('assist-type-select').value = 'Normal Pass';

    // Save previous state for auto-suggestion
    const prevAction = actionVal;
    const prevOutcome = document.getElementById('outcome-select').value;
    const prevType = document.getElementById('type-select').value;
    const prevActionPlayer = currentState.actionPlayer ? { ...currentState.actionPlayer } : null;
    const prevReactionPlayer = currentState.reactionPlayer ? { ...currentState.reactionPlayer } : null;

    let nextAction = 'Pass';
    let nextOutcome = 'Successful';
    let nextType = null;
    let nextActionPlayer = null;
    let nextReactionPlayer = null;

    const isTackle = prevAction === 'Standing Tackle' || prevAction === 'Sliding Tackle';

    if ((prevAction === 'Pass' || prevAction === 'Through Ball') && prevOutcome === 'Intercepted') {
        nextAction = 'Pass Intercept';
        nextOutcome = null;
        nextActionPlayer = null;
        nextReactionPlayer = prevActionPlayer;
    } else if (prevAction === 'Shoot' && prevOutcome === 'Save') {
        nextAction = 'Save';
        nextOutcome = null;
        nextActionPlayer = prevReactionPlayer;
        nextReactionPlayer = prevActionPlayer;
    } else if (prevAction === 'Shoot' && prevOutcome === 'Block') {
        nextAction = 'Block';
        nextOutcome = null;
        nextActionPlayer = prevReactionPlayer;
        nextReactionPlayer = prevActionPlayer;
    } else if (isTackle && prevOutcome === 'Successful' && prevType === 'With Possession') {
        nextActionPlayer = prevActionPlayer;
    } else if (isTackle && prevOutcome === 'Successful' && prevType === 'Without Possession') {
        nextActionPlayer = null;
    } else if (isTackle && prevOutcome === 'Unsuccessful') {
        nextActionPlayer = null;
    } else {
        if (prevReactionPlayer) {
            nextActionPlayer = prevReactionPlayer;
        } else {
            nextActionPlayer = prevActionPlayer;
        }
    }

    const actionSelect = document.getElementById('action-select');
    actionSelect.value = nextAction;
    actionSelect.dispatchEvent(new Event('change'));

    const outcomeSelect = document.getElementById('outcome-select');
    if (nextOutcome && outcomeSelect.querySelector(`option[value="${nextOutcome}"]`)) {
        outcomeSelect.value = nextOutcome;
        outcomeSelect.dispatchEvent(new Event('change'));
    }

    const typeSelect = document.getElementById('type-select');
    if (nextType && typeSelect.querySelector(`option[value="${nextType}"]`)) {
        typeSelect.value = nextType;
    }

    document.getElementById('body-part-select').value = 'Right Leg';

    currentState.actionPlayer = nextActionPlayer;
    currentState.reactionPlayer = nextReactionPlayer;
    updateLineupState();
}

function getFinalDirection() {
    if (!currentState.actionPlayer || !activeMatch) return currentState.homeDirection;
    const isHome = currentState.actionPlayer.teamId === activeMatch.home_team_id;
    if (isHome) return currentState.homeDirection;
    return currentState.homeDirection === 'L2R' ? 'R2L' : 'L2R';
}

// ──────────────────────────────────────────
// STAGING / EVENT LOG
// ──────────────────────────────────────────
let syncedEvents = [];

function renderStaging() {
    const body = document.getElementById('staging-body');
    if (!body) return;

    const renderRow = (e, idx, isSynced) => {
        const bgColor = isSynced
            ? 'background: rgba(40, 167, 69, 0.08); border-left: 3px solid var(--success);'
            : (idx % 2 === 0 ? 'background: rgba(0,0,0,0.02);' : '');
        const timeStr = `${Math.floor(e.match_time_seconds / 60)}:${(e.match_time_seconds % 60).toString().padStart(2, '0')}`;
        const playerDisplay = e._ui_player || 'Unknown';
        const reactionDisplay = e._ui_reaction_player || '';

        // Make unsynced rows editable
        const editableClass = isSynced ? '' : 'editable-cell';
        const editClick = isSynced ? '' : `data-edit-idx="${idx}"`;

        return `
            <tr style="border-bottom: 1px solid var(--border); ${bgColor}">
                <td style="padding: 6px; white-space: nowrap;">${timeStr}</td>
                <td style="padding: 6px; font-weight: 600;">${e.team_direction}</td>
                <td style="padding: 6px;" class="${editableClass}" ${editClick} data-edit-field="action">
                    <span style="font-weight:600;">${e.action}</span><br>
                    <span style="color:var(--text-muted);font-size:0.65rem;">${e.outcome}</span>
                </td>
                <td style="padding: 6px;" class="${editableClass}" ${editClick} data-edit-field="type">${e.type || '-'}</td>
                <td style="padding: 6px;" class="${editableClass}" ${editClick} data-edit-field="body_part">${e.body_part || '-'}</td>
                <td style="padding: 6px;">${e.pressure_on ? 'Y' : 'N'}</td>
                <td style="padding: 6px; white-space: nowrap;">
                    ACT: ${playerDisplay}<br>
                    ${reactionDisplay ? '<span style="color:var(--text-muted);font-size:0.65rem;">RCT: '+reactionDisplay+'</span>' : ''}
                </td>
                <td style="padding: 6px; font-family: var(--font-mono); font-size: 0.65rem; white-space: nowrap;">
                    S: ${e.start_x},${e.start_y}<br>
                    E: ${e.end_x !== null ? e.end_x+','+e.end_y : '-'}${e.end_z !== null ? ' (z:'+e.end_z+')' : ''}
                </td>
                <td style="padding: 6px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${e.notes || ''}" class="${editableClass}" ${editClick} data-edit-field="notes">
                    ${e.notes || '-'}
                </td>
                <td style="padding: 6px; text-align: center;">
                    ${isSynced
                        ? '<span style="color: var(--success); font-size: 0.7rem;">OK</span>'
                        : `<button onclick="window.removeStagedEvent(${idx})" style="background: none; border: none; cursor: pointer; color: var(--danger); font-weight: 700; font-size: 0.8rem;">X</button>`
                    }
                </td>
            </tr>
        `;
    };

    const unsyncedRows = localEvents.map((e, idx) => renderRow(e, idx, false)).reverse().join('');
    const syncedRows = syncedEvents.map((e, idx) => renderRow(e, idx, true)).reverse().join('');
    body.innerHTML = unsyncedRows + syncedRows;

    window.removeStagedEvent = (idx) => {
        const removed = localEvents.splice(idx, 1)[0];
        if (removed) undoStack.push(removed);
        saveEventsToStorage();
        renderStaging();
        updateProgress();
    };

    // Inline editing for unsynced events
    body.querySelectorAll('[data-edit-idx]').forEach(cell => {
        cell.addEventListener('dblclick', () => {
            const idx = parseInt(cell.dataset.editIdx);
            const field = cell.dataset.editField;
            if (isNaN(idx) || !field || idx >= localEvents.length) return;

            const currentVal = localEvents[idx][field] || '';
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentVal;
            input.className = 'form-input';
            input.style.cssText = 'padding: 2px 4px; font-size: 0.7rem; width: 100%;';
            cell.innerHTML = '';
            cell.appendChild(input);
            input.focus();

            const save = () => {
                localEvents[idx][field] = input.value || null;
                saveEventsToStorage();
                renderStaging();
            };
            input.addEventListener('blur', save);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') renderStaging();
            });
        });
    });
}

async function loadSyncedEvents() {
    if (!activeMatch) return;

    // Paginated fetch — Supabase limits to 1000 rows per request
    let allData = [];
    let rangeStart = 0;
    const PAGE_SIZE = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('match_events')
            .select('*, player:players!player_id(player_name), reaction:players!reaction_player_id(player_name)')
            .eq('match_id', activeMatch.match_id)
            .order('match_time_seconds', { ascending: true })
            .range(rangeStart, rangeStart + PAGE_SIZE - 1);

        if (error) { console.error('Failed to load synced events:', error); return; }
        allData = allData.concat(data || []);
        if (!data || data.length < PAGE_SIZE) break;
        rangeStart += PAGE_SIZE;
    }

    syncedEvents = allData.map(e => {
        const pLineup = activeLineup.find(l => l.player_id === e.player_id);
        const rLineup = activeLineup.find(l => l.player_id === e.reaction_player_id);
        return {
            ...e,
            _ui_player: e.player ? `${e.player.player_name} (${pLineup?.jersey_no || '?'})` : 'Unknown',
            _ui_reaction_player: e.reaction ? `${e.reaction.player_name} (${rLineup?.jersey_no || '?'})` : null,
        };
    });
    renderStaging();
    updateProgress();
}

// ──────────────────────────────────────────
// SYNC
// ──────────────────────────────────────────
async function syncEvents() {
    if (localEvents.length === 0) return;
    const btn = document.getElementById('sync-btn');
    const syncStatus = document.getElementById('sync-status');
    btn.innerText = 'Syncing...';
    btn.disabled = true;

    const payload = localEvents.map(({ _ui_player, _ui_reaction_player, ...rest }) => rest);

    const BATCH_SIZE = 500;
    let allSuccess = true;
    let lastError = null;

    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const batch = payload.slice(i, i + BATCH_SIZE);
        let retries = 3;
        let success = false;

        while (retries > 0 && !success) {
            const { error } = await supabase.from('match_events').insert(batch);
            if (error) {
                retries--;
                lastError = error;
                if (retries > 0) {
                    btn.innerText = `Retrying... (${3 - retries}/3)`;
                    await new Promise(r => setTimeout(r, 1000));
                }
            } else {
                success = true;
            }
        }

        if (!success) {
            allSuccess = false;
            break;
        }

        btn.innerText = `Syncing... ${Math.min(i + BATCH_SIZE, payload.length)}/${payload.length}`;
    }

    if (!allSuccess) {
        alert("Sync Error: " + (lastError?.message || 'Unknown error. Your data is safe in local storage.'));
        btn.innerText = 'Sync Retry';
        btn.disabled = false;
        if (syncStatus) syncStatus.textContent = 'Sync failed — data safe locally';
    } else {
        syncedEvents = [...localEvents, ...syncedEvents];
        localEvents = [];
        undoStack = [];
        saveEventsToStorage();
        renderStaging();
        updateProgress();
        btn.innerText = 'Synced!';
        if (syncStatus) syncStatus.textContent = `${syncedEvents.length} events synced`;
        setTimeout(() => {
            btn.innerText = 'Sync All';
            btn.disabled = false;
        }, 2000);
    }
}

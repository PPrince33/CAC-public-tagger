import { supabase } from '../supabase'
import { CAC_LOGIC, ACTION_RULES } from '../lib/cacLogic'
import { getNextEntry, loadFlowRules } from '../lib/actionFlow'
import { PitchCanvas } from '../lib/pitchCanvas'
import { GoalFaceCanvas } from '../lib/goalFace'
import { VideoEngine } from '../lib/videoEngine'
import { PlayerTracker } from '../lib/playerTracker'
import { finalizeMatch } from '../lib/finalizeMatch'
import { ensurePlaceholders } from '../lib/placeholders'
import { projectsForMatch, projectMatches, refreshProjectStatus } from '../lib/playerProjects'

export function TaggerView() {
    return `
        <div class="fade-in tagger-app" style="height: calc(100vh - 32px); display: flex; flex-direction: column; gap: 16px;">
            <!-- Lock / Collaboration Banner -->
            <div id="lock-banner" class="lock-banner" style="display: none;"></div>
            <!-- Analyst collaboration stats -->
            <div id="collab-stats" style="display:none;padding:6px 14px;font-size:0.7rem;color:var(--text-muted);background:var(--primary-light);border:1px solid var(--border);border-radius:var(--radius-md);text-align:center;line-height:1.6;"></div>

            <header class="tagger-header" style="display: flex; justify-content: space-between; align-items: center; padding: 0 8px; flex-wrap: wrap; gap: 8px;">
                <div>
                    <h2 id="match-title" style="margin-bottom: 4px;">Loading Match...</h2>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span id="tagging-mode-badge" style="display: none; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; padding: 2px 8px; border-radius: 99px; color: #fff;"></span>
                        <div id="match-subtitle" style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Match ID: ...</div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <!-- Progress Indicator -->
                    <div id="progress-indicator" style="display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: var(--text-muted); padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-card);">
                        <span id="progress-count">0</span> events |
                        <span id="progress-time">0:00</span> tagged
                    </div>
                    <button class="btn btn-ghost" style="width: auto; padding: 6px 12px; border: 1px solid var(--border); font-size: 0.8125rem;" id="undo-btn" title="Undo last event (Ctrl+Z)">Undo</button>
                    <button class="btn btn-ghost" style="width: auto; padding: 6px 12px; border: 1px solid var(--border); font-size: 0.8125rem;" id="shortcuts-btn" title="Keyboard shortcuts (?)">Keys [?]</button>
                    <button class="btn btn-ghost" style="width: auto; padding: 6px 12px; border: 1px solid var(--border); font-size: 0.8125rem;" id="toggle-sidebar-btn">Toggle Sidebar</button>
                    <button class="btn btn-ghost" style="width: auto; padding: 6px 12px; font-size: 0.8125rem;" id="back-to-matches">Back</button>
                    <button class="btn btn-primary" style="width: auto; padding: 6px 16px; background: var(--success); font-size: 0.8125rem;" id="finish-match-btn">Finish Match</button>
                    <button class="btn btn-primary" style="width: auto; padding: 6px 16px; font-size: 0.8125rem;" id="tagger-finish-btn" title="Sync events and write processed_match_events (no QC needed)">Finish &amp; Process</button>
                </div>
            </header>

            <div class="tagger-layout" style="flex-grow: 1; display: grid; grid-template-columns: 1fr 480px; gap: 16px; min-height: 0;">
                <!-- Left Column: Video & Log -->
                <div style="display: flex; flex-direction: column; gap: 16px; overflow-y: auto; padding-right: 8px;">
                    <!-- Video Source Bar -->
                    <div class="card" style="padding: 12px; flex-shrink: 0;">
                        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                            <select id="video-source-select" class="form-input" style="width: 120px; padding: 6px 10px; font-size: 0.8125rem;">
                                <option value="youtube">YouTube</option>
                                <option value="local">Local File</option>
                            </select>
                            <input type="text" id="video-url-input" class="form-input" style="flex: 1; min-width: 150px; padding: 6px 10px; font-size: 0.8125rem;" placeholder="Paste YouTube URL here...">
                            <button id="load-video-btn" class="btn btn-primary" style="width: auto; padding: 6px 16px; font-size: 0.8125rem;">Load</button>
                            <input type="file" id="local-video-file" style="display: none;" accept="video/*">
                            <button id="upload-local-btn" class="btn btn-primary" style="width: auto; padding: 6px 16px; font-size: 0.8125rem; display: none;">📂 Load Video</button>
                            <select id="speed-select" class="form-input" style="width: 80px; padding: 6px 10px; font-size: 0.8125rem; margin-left: auto;">
                                <option value="0.25">0.25×</option>
                                <option value="0.5">0.5×</option>
                                <option value="1" selected>1×</option>
                                <option value="1.5">1.5×</option>
                                <option value="2">2×</option>
                            </select>
                        </div>
                    </div>

                    <!-- Video Section -->
                    <div id="main-video-card" class="card" style="padding: 0; overflow: hidden; position: relative; flex-shrink: 0;">
                        <div id="video-wrapper" style="aspect-ratio: 16/9; background: #000; position: relative;">
                            <div id="video-container" style="width: 100%; height: 100%;"></div>
                            <canvas id="player-tracker-overlay" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:4;"></canvas>
                        </div>
                        <div id="speed-badge" style="position:absolute;bottom:12px;right:12px;background:rgba(0,0,0,0.75);color:#fff;padding:4px 10px;border-radius:20px;font-family:var(--font-mono);font-size:0.8125rem;font-weight:700;pointer-events:none;z-index:5;">1×</div>
                        <div id="player-tracker-panel" style="display:none; position:absolute; top:8px; left:8px; background: rgba(0,0,0,0.78); color:#fff; padding: 8px 10px; border-radius: 8px; font-size: 0.75rem; z-index:6; max-width: 240px;">
                            <div style="display:flex; align-items:center; gap:6px; margin-bottom: 6px;">
                                <button id="pt-mark-btn" style="background: var(--success); color: #000; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">+ Mark Player</button>
                                <button id="pt-clear-btn" style="background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.4); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">Clear</button>
                            </div>
                            <div id="pt-status" style="font-size: 0.7rem; color: rgba(255,255,255,0.7); margin-bottom: 4px;">Local file only · pause + click on player</div>
                            <div id="pt-list" style="display: flex; flex-direction: column; gap: 3px; max-height: 140px; overflow-y: auto;"></div>
                        </div>
                    </div>

                    <!-- Staging Table -->
                    <div class="card" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 16px; min-height: 300px; flex-shrink: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                            <h4 style="margin:0;">Event Log</h4>
                            <div style="display: flex; gap: 12px; align-items: center; font-size: 0.75rem;" title="Set each team's colour to match their jersey">
                                <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                                    <input type="color" id="home-color-input" value="#ef4444" class="team-color-input">
                                    <span id="home-color-label" style="font-weight:700;text-transform:uppercase;">Home</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                                    <input type="color" id="away-color-input" value="#3b82f6" class="team-color-input">
                                    <span id="away-color-label" style="font-weight:700;text-transform:uppercase;">Away</span>
                                </label>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <span id="sync-status" style="font-size: 0.8125rem; color: var(--text-muted);"></span>
                                <button id="sync-btn" class="btn btn-ghost" style="width: auto; padding: 4px 12px; font-size: 0.8125rem; color: var(--success);">Sync All</button>
                            </div>
                        </div>
                        <div style="flex-grow: 1; overflow-y: auto; font-size: 0.8125rem;">
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

                    <!-- GK Position Overlay (Conditional - only for Shoot) -->
                    <div id="gk-position-overlay" class="card" style="display: none; padding: 10px 12px; flex-direction: column; border-color: #7c3aed; flex-shrink: 0;">
                        <h4 style="margin-bottom: 6px; font-size: 0.875rem; color: #7c3aed;">Goalkeeper Position <span style="font-size:0.7rem;font-weight:400;color:var(--text-muted);">(3rd pitch click)</span></h4>
                        <div id="gk-coords" style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">GK: None — click pitch for 3rd point</div>
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
                    <div class="card" style="padding: 16px; flex-shrink: 0;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                            <div class="form-group">
                                <label class="form-label">Action</label>
                                <select id="action-select" class="form-input" style="font-size: 0.8125rem;"></select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Outcome <span style="font-size: 0.7rem; color: var(--text-muted);">[Tab]</span></label>
                                <select id="outcome-select" class="form-input" style="font-size: 0.8125rem;"></select>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                            <div class="form-group">
                                <label class="form-label">Type</label>
                                <select id="type-select" class="form-input" style="font-size: 0.8125rem;"></select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Body Part</label>
                                <select id="body-part-select" class="form-input" style="font-size: 0.8125rem;">
                                    <option value="Right Leg" selected>Right Leg [R]</option>
                                    <option value="Left Leg">Left Leg [L]</option>
                                    <option value="Head">Head [H]</option>
                                    <option value="Other">Other</option>
                                    <option value="NA">N/A</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                            <button id="pressure-btn" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-md);background:transparent;color:var(--text-main);font-size:0.8125rem;font-weight:600;font-family:inherit;cursor:pointer;">
                                Pressure: OFF [V]
                            </button>
                            <button id="direction-btn" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-md);background:transparent;color:var(--text-main);font-size:0.8125rem;font-weight:600;font-family:inherit;cursor:pointer;">
                                Direct: L2R
                            </button>
                        </div>
                        <div class="form-group" style="margin-bottom: 8px;">
                            <label class="form-label">Notes <span style="font-size: 0.7rem; color: var(--text-muted);">[N] to focus</span></label>
                            <input type="text" id="action-notes" class="form-input" placeholder="Additional details..." style="font-size: 0.8125rem;">
                        </div>
                        <button id="add-event-btn" style="width:100%;padding:14px 20px;border:none;border-radius:var(--radius-md);background:#22c55e;color:white;font-size:1rem;font-weight:800;font-family:inherit;cursor:pointer;letter-spacing:0.02em;transition:all 0.15s ease;">Log Event [Enter]</button>
                    </div>


                    <!-- Lineup Grid -->
                    <div class="card" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 16px; min-height: 400px; flex-shrink: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; margin-top: 0;">
                            <h4 style="margin: 0;">Active Players <span style="font-size: 0.7rem; color: var(--text-muted);">[1-0] jersey select</span></h4>
                            <button id="open-create-player-btn" class="btn btn-ghost" style="padding: 4px 10px; font-size: 0.75rem; border: 1px solid var(--border);">+ New Player</button>
                        </div>
                        <div style="flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 20px;">
                            <div>
                                <div id="home-team-name" style="font-size: 0.8125rem; font-weight: 700; color: var(--accent); margin-bottom: 8px; text-transform: uppercase;">HOME TEAM</div>
                                <div id="home-player-grid" class="player-grid"></div>
                            </div>
                            <div>
                                <div id="away-team-name" style="font-size: 0.8125rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px; text-transform: uppercase;">AWAY TEAM</div>
                                <div id="away-player-grid" class="player-grid"></div>
                            </div>
                        </div>
                        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 0.875rem;">
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

            </div>

            <!-- Create Player Modal -->
            <div id="create-player-modal" class="card" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 3000; width: 400px; box-shadow: var(--shadow-lg);">
                <h3 style="margin-top: 0;">Create New Player</h3>
                <form id="create-player-form" style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">
                    <div class="form-group">
                        <label class="form-label">Team</label>
                        <select id="cp-team" class="form-input" required></select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Player Name</label>
                        <input type="text" id="cp-name" class="form-input" required placeholder="e.g. John Doe">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Jersey Number</label>
                        <input type="text" id="cp-jersey" class="form-input" required placeholder="e.g. 10">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Position</label>
                        <select id="cp-position" class="form-input">
                            <option value="GK">Goalkeeper (GK)</option>
                            <option value="DF">Defender (DF)</option>
                            <option value="MF">Midfielder (MF)</option>
                            <option value="FW">Forward (FW)</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 12px; margin-top: 8px;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;" id="cp-submit-btn">Save Player</button>
                        <button type="button" class="btn btn-ghost" onclick="document.getElementById('create-player-modal').style.display='none'" style="flex: 1;">Cancel</button>
                    </div>
                    <div id="cp-status" style="font-size: 0.8125rem; text-align: center; margin-top: 4px;"></div>
                </form>
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

            <!-- Event Toast -->
            <div id="event-toast" style="display:none;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#22c55e;padding:10px 24px;border-radius:var(--radius-lg);font-size:0.875rem;font-weight:600;font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:9999;white-space:nowrap;"></div>

            <!-- Keyboard Shortcuts Modal -->
            <div id="shortcuts-modal" style="display: none; position: fixed; inset: 0; z-index: 5000; background: rgba(0,0,0,0.6); align-items: center; justify-content: center;">
                <div class="card" style="width: 560px; max-width: 90vw; max-height: 80vh; overflow-y: auto; padding: 24px; box-shadow: var(--shadow-lg);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="margin: 0;">Keyboard Shortcuts</h3>
                        <button id="close-shortcuts" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-muted);">X</button>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                        <thead><tr style="border-bottom:2px solid var(--border);"><th style="padding:8px;text-align:left;color:var(--text-muted);">Key</th><th style="padding:8px;text-align:left;color:var(--text-muted);">Action</th></tr></thead>
                        <tbody>
                            <tr><td colspan="2" style="padding:8px 8px 4px;font-weight:700;color:var(--accent);font-size:0.75rem;text-transform:uppercase;">Video Controls</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">Space</kbd></td><td style="padding:5px 8px;">Play / Pause</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">\u2192</kbd> / <kbd class="kbd">\u2190</kbd></td><td style="padding:5px 8px;">Skip \u00b13s</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">Shift+\u2192</kbd> / <kbd class="kbd">Shift+\u2190</kbd></td><td style="padding:5px 8px;">Skip \u00b110s</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">Ctrl+\u2192</kbd> / <kbd class="kbd">Ctrl+\u2190</kbd></td><td style="padding:5px 8px;">Frame-by-frame</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">.</kbd> / <kbd class="kbd">,</kbd></td><td style="padding:5px 8px;">Speed Up / Slow Down</td></tr>
                            <tr><td colspan="2" style="padding:8px 8px 4px;font-weight:700;color:#22c55e;font-size:0.75rem;text-transform:uppercase;">Attacking</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">F</kbd></td><td style="padding:5px 8px;">Pass</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">T</kbd></td><td style="padding:5px 8px;">Through Ball</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">S</kbd></td><td style="padding:5px 8px;">Shoot</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">C</kbd></td><td style="padding:5px 8px;">Carry</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">D</kbd></td><td style="padding:5px 8px;">Dribble</td></tr>
                            <tr><td colspan="2" style="padding:8px 8px 4px;font-weight:700;color:#ef4444;font-size:0.75rem;text-transform:uppercase;">Defensive</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">G</kbd></td><td style="padding:5px 8px;">Standing Tackle</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">P</kbd></td><td style="padding:5px 8px;">Pass Intercept</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">B</kbd></td><td style="padding:5px 8px;">Block</td></tr>
                            <tr><td colspan="2" style="padding:8px 8px 4px;font-weight:700;color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;">Modifiers & Events</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">Tab</kbd> / <kbd class="kbd">Shift+Tab</kbd></td><td style="padding:5px 8px;">Cycle Outcome</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">U</kbd></td><td style="padding:5px 8px;">Outcome \u2192 Missed</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">V</kbd></td><td style="padding:5px 8px;">Toggle Pressure</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">R</kbd> / <kbd class="kbd">L</kbd> / <kbd class="kbd">H</kbd></td><td style="padding:5px 8px;">Body: Right / Left / Head</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">1</kbd>-<kbd class="kbd">9</kbd>, <kbd class="kbd">0</kbd></td><td style="padding:5px 8px;">Select player by jersey #</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">N</kbd></td><td style="padding:5px 8px;">Focus Notes</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">Enter</kbd></td><td style="padding:5px 8px;">Log Event</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">Ctrl+Z</kbd> / <kbd class="kbd">Ctrl+Shift+Z</kbd></td><td style="padding:5px 8px;">Undo / Redo</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">Esc</kbd></td><td style="padding:5px 8px;">Blur input</td></tr>
                            <tr><td style="padding:5px 8px;"><kbd class="kbd">?</kbd> / <kbd class="kbd">F1</kbd></td><td style="padding:5px 8px;">This overlay</td></tr>
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
                    min-width: 44px;
                    min-height: 44px;
                    border: 1px solid var(--border);
                    background: var(--primary-light);
                    color: var(--text-main);
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8125rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .player-btn:hover { background: var(--hover-bg); }
                .player-btn.action-active { background: #22c55e !important; color: white !important; border-color: #22c55e !important; }
                .player-btn.reaction-active { background: #ef4444 !important; color: white !important; border-color: #ef4444 !important; }
                .player-btn.disabled { opacity: 0.3; cursor: not-allowed; }
                .team-color-input { width: 22px; height: 22px; padding: 0; border: 1px solid var(--border); border-radius: 4px; background: none; cursor: pointer; }
                .team-color-input::-webkit-color-swatch-wrapper { padding: 2px; }
                .team-color-input::-webkit-color-swatch { border: none; border-radius: 2px; }
                .log-time-btn { background: none; border: none; padding: 0; font: inherit; font-family: var(--font-mono); font-weight: 600; color: var(--accent); text-decoration: underline dotted; text-underline-offset: 3px; cursor: pointer; }
                .log-time-btn:hover { text-decoration-style: solid; }
                .team-chip { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; border: 1px solid rgba(0,0,0,0.25); }
                .dial-btn { width: 30px; height: 30px; min-width: 30px; min-height: 30px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.7rem; }
                .kbd { display: inline-block; padding: 2px 8px; background: var(--primary-light); border: 1px solid var(--border); border-radius: 4px; font-family: var(--font-mono); font-size: 0.8125rem; font-weight: 700; }
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
let playerTracker = null;
let trackerArmed = false;
let activeMatch = null;
let activeLineup = [];
let localEvents = [];
let undoStack = []; // For undo functionality
let lockHeartbeatInterval = null;
let autoSyncPending = false;
let _lastLogTime = 0; // Debounce for Enter key
let _toastTimeout = null; // Toast dismissal timer
let _initAbortController = null; // AbortController for cleaning up event listeners on re-init
let _cachedUser = null; // Cached Supabase user — avoids network call on every logEvent
const DEFAULT_TEAM_COLORS = { home: '#ef4444', away: '#3b82f6' };
let teamColors = { ...DEFAULT_TEAM_COLORS };

function teamColorsKey() {
    return activeMatch ? `cac_team_colors_${activeMatch.match_id}` : null;
}

function loadTeamColors() {
    teamColors = { ...DEFAULT_TEAM_COLORS };
    const key = teamColorsKey();
    if (!key) return;
    try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        if (saved && /^#[0-9a-f]{6}$/i.test(saved.home)) teamColors.home = saved.home;
        if (saved && /^#[0-9a-f]{6}$/i.test(saved.away)) teamColors.away = saved.away;
    } catch (e) { /* ignore corrupt storage */ }
}

function saveTeamColors() {
    const key = teamColorsKey();
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(teamColors)); } catch (e) { /* storage unavailable */ }
}

// Apply team colours to the colour pickers and team name headers
function applyTeamColors() {
    const homeInput = document.getElementById('home-color-input');
    const awayInput = document.getElementById('away-color-input');
    if (homeInput) homeInput.value = teamColors.home;
    if (awayInput) awayInput.value = teamColors.away;
    ['home-team-name', 'dial-home-name', 'home-color-label'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.color = teamColors.home;
    });
    ['away-team-name', 'dial-away-name', 'away-color-label'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.color = teamColors.away;
    });
}

// Resolve which side ('home' | 'away' | null) an event belongs to
function getEventSide(e) {
    if (!activeMatch) return null;
    let teamId = e.team_id;
    if (!teamId && e.player_id) {
        const lineupItem = activeLineup.find(l => l.player_id === e.player_id);
        teamId = lineupItem?.team_id;
    }
    if (teamId === activeMatch.home_team_id) return 'home';
    if (teamId === activeMatch.away_team_id) return 'away';
    return null;
}

// Resolve which side ('home' | 'away' | null) a player belongs to, from the lineup
function getPlayerSide(playerId) {
    if (!activeMatch || !playerId) return null;
    const teamId = activeLineup.find(l => l.player_id === playerId)?.team_id;
    if (teamId === activeMatch.home_team_id) return 'home';
    if (teamId === activeMatch.away_team_id) return 'away';
    return null;
}

// Inline style that paints text in a team colour, outlining very light colours
// (e.g. white or yellow jerseys) so they stay readable on a light background
function teamTextStyle(side) {
    if (!side) return '';
    const hex = teamColors[side];
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const outline = luminance > 0.75 ? 'text-shadow:0 0 1px #000,0 0 1px #000;' : '';
    return `color:${hex};font-weight:700;${outline}`;
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
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
// COLLAB STATS
// ──────────────────────────────────────────
async function loadCollabStats(matchId) {
    try {
        const [{ data: events }, { data: profiles }] = await Promise.all([
            supabase.from('match_events').select('analyst_id, match_time_seconds').eq('match_id', matchId),
            supabase.from('profiles').select('id, username')
        ]);
        if (!events || events.length === 0) return;

        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.username || 'Unknown']));
        const uid = _cachedUser?.id;

        // Group by analyst: count, min/max time
        const stats = {};
        events.forEach(e => {
            if (!stats[e.analyst_id]) stats[e.analyst_id] = { count: 0, min: Infinity, max: -Infinity };
            stats[e.analyst_id].count++;
            const t = e.match_time_seconds || 0;
            if (t < stats[e.analyst_id].min) stats[e.analyst_id].min = t;
            if (t > stats[e.analyst_id].max) stats[e.analyst_id].max = t;
        });

        const total = events.length;
        const mine = stats[uid]?.count || 0;

        const analystParts = Object.entries(stats)
            .sort(([, a], [, b]) => a.min - b.min)
            .map(([id, s]) => {
                const name = id === uid ? '<strong>You</strong>' : (profileMap[id] || 'Unknown');
                const minM = Math.floor(s.min / 60);
                const maxM = Math.floor(s.max / 60);
                return `${name}: ${minM}′–${maxM}′ (${s.count} events)`;
            }).join(' &nbsp;│&nbsp; ');

        const el = document.getElementById('collab-stats');
        if (el) {
            el.style.display = 'block';
            el.innerHTML = `📊 <strong>${total}</strong> events in match &nbsp;•&nbsp; <strong style="color:var(--accent)">${mine} by you</strong> &nbsp;│&nbsp; ${analystParts}`;
        }
    } catch (e) { /* non-critical */ }
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
// BUTTON MATRIX RENDERING
// ──────────────────────────────────────────
const ACTION_CATEGORIES = {
    'Pass': 'atk', 'Through Ball': 'atk', 'Shoot': 'atk', 'Carry': 'atk', 'Dribble': 'atk', 'Ball Control': 'atk',
    'Standing Tackle': 'def', 'Sliding Tackle': 'def', 'Pass Intercept': 'def', 'Block': 'def', 'Clearance': 'def', 'Save': 'def', 'Pressure': 'def',
    'Discipline': 'set', 'Substitution': 'meta', 'Match Time': 'meta',
};

const ACTION_HOTKEYS = {
    'F': 'Pass', 'T': 'Through Ball', 'S': 'Shoot', 'C': 'Carry', 'D': 'Dribble',
    'G': 'Standing Tackle', 'P': 'Pass Intercept', 'B': 'Block',
};

function renderActionButtons() {
    const grid = document.getElementById('action-btn-grid');
    const actionSelect = document.getElementById('action-select');
    if (!grid || !actionSelect) return;
    grid.innerHTML = '';
    const reverseHotkeys = {};
    Object.entries(ACTION_HOTKEYS).forEach(([k, v]) => { reverseHotkeys[v] = k; });

    Array.from(actionSelect.options).forEach(opt => {
        const btn = document.createElement('button');
        const cat = ACTION_CATEGORIES[opt.value] || 'meta';
        const hk = reverseHotkeys[opt.value] || '';
        btn.type = 'button';
        btn.setAttribute('data-cat', cat);
        btn.setAttribute('data-value', opt.value);
        btn.innerHTML = opt.value + (hk ? `<span style="font-size:0.6rem;opacity:0.5;margin-left:2px;vertical-align:super;">${hk}</span>` : '');
        btn.style.cssText = 'padding:6px 10px;border:2px solid var(--border);border-radius:var(--radius-md);background:var(--bg-card);color:var(--text-main);font-size:0.75rem;font-weight:600;font-family:inherit;cursor:pointer;transition:all 0.12s ease;white-space:nowrap;';
        // Color-coded left border
        const colors = { atk: '#22c55e', def: '#ef4444', set: '#3b82f6', meta: '#6b7280' };
        btn.style.borderLeft = `3px solid ${colors[cat]}`;
        if (opt.value === actionSelect.value) {
            btn.style.background = colors[cat];
            btn.style.color = 'white';
            btn.style.borderColor = colors[cat];
        }
        btn.addEventListener('click', () => {
            actionSelect.value = opt.value;
            actionSelect.dispatchEvent(new Event('change'));
            renderActionButtons();
        });
        grid.appendChild(btn);
    });
}

function renderOutcomeButtons() {
    const grid = document.getElementById('outcome-btn-grid');
    const outcomeSelect = document.getElementById('outcome-select');
    if (!grid || !outcomeSelect) return;
    grid.innerHTML = '';
    Array.from(outcomeSelect.options).forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = opt.value;
        btn.setAttribute('data-value', opt.value);
        btn.style.cssText = 'padding:5px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-card);color:var(--text-main);font-size:0.75rem;font-weight:600;font-family:inherit;cursor:pointer;transition:all 0.12s ease;';
        if (opt.value === outcomeSelect.value) {
            btn.style.background = 'var(--accent)';
            btn.style.color = 'white';
            btn.style.borderColor = 'var(--accent)';
        }
        btn.addEventListener('click', () => {
            outcomeSelect.value = opt.value;
            outcomeSelect.dispatchEvent(new Event('change'));
            renderOutcomeButtons();
        });
        grid.appendChild(btn);
    });
}

function renderTypeButtons() {
    const grid = document.getElementById('type-btn-grid');
    const typeSelect = document.getElementById('type-select');
    if (!grid || !typeSelect) return;
    grid.innerHTML = '';
    Array.from(typeSelect.options).forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = opt.value;
        btn.setAttribute('data-value', opt.value);
        btn.style.cssText = 'padding:5px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-card);color:var(--text-main);font-size:0.75rem;font-weight:600;font-family:inherit;cursor:pointer;transition:all 0.12s ease;';
        if (opt.value === typeSelect.value) {
            btn.style.background = 'var(--accent)';
            btn.style.color = 'white';
            btn.style.borderColor = 'var(--accent)';
        }
        btn.addEventListener('click', () => {
            typeSelect.value = opt.value;
            typeSelect.dispatchEvent(new Event('change'));
            renderTypeButtons();
        });
        grid.appendChild(btn);
    });
}

function renderAllButtonGrids() {
    renderActionButtons();
    renderOutcomeButtons();
    renderTypeButtons();
}

// ──────────────────────────────────────────
// TOAST + FLASH
// ──────────────────────────────────────────
function showEventToast(message) {
    const toast = document.getElementById('event-toast');
    if (!toast) return;
    if (_toastTimeout) clearTimeout(_toastTimeout);
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    _toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, 1800);
}

function flashLogButton() {
    const btn = document.getElementById('add-event-btn');
    if (!btn) return;
    const orig = btn.style.background;
    btn.style.background = '#86efac';
    btn.style.transition = 'none';
    setTimeout(() => {
        btn.style.transition = 'background 0.3s ease';
        btn.style.background = orig || '#22c55e';
    }, 300);
}

function updateSpeedBadge() {
    const badge = document.getElementById('speed-badge');
    if (!badge || !video) return;
    const rate = video.getPlaybackRate();
    badge.textContent = rate === 1 ? '1\u00d7' : rate + '\u00d7';
    badge.style.opacity = rate === 1 ? '0.5' : '1';
    const speedSelect = document.getElementById('speed-select');
    if (speedSelect) speedSelect.value = rate;
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
    // Load action flow rules from DB (non-blocking — falls back to static)
    loadFlowRules();

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

    // Abort previous listeners to prevent accumulation on re-init
    if (_initAbortController) _initAbortController.abort();
    _initAbortController = new AbortController();
    const { signal } = _initAbortController;

    // Remove existing listener to prevent accumulation
    document.removeEventListener('keydown', handleHotkeys);
    document.addEventListener('keydown', handleHotkeys);

    // Cache user at init for fast event logging
    const { data: { user: initUser } } = await supabase.auth.getUser();
    _cachedUser = initUser;

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

    // ── Access check: must be creator or assigned analyst ──
    if (match.created_by !== _cachedUser.id) {
        const { data: assignment } = await supabase
            .from('match_assignments')
            .select('match_id')
            .eq('match_id', matchId)
            .eq('user_id', _cachedUser.id)
            .maybeSingle();
        if (!assignment) {
            alert("You don't have access to this match.");
            window.location.hash = '#matches';
            return;
        }
    }

    // ── Load & display per-analyst collab stats ──
    loadCollabStats(matchId);

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
        updateProgress();
    }
    document.getElementById('match-title').innerText = `${match.home_team.team_name} vs ${match.away_team.team_name}`;
    document.getElementById('match-subtitle').innerText = `Match ID: ${match.match_id.split('-')[0]}... | ${match.is_futsal ? 'Futsal' : 'Football'}`;
    document.getElementById('home-team-name').innerText = match.home_team.team_name;
    document.getElementById('away-team-name').innerText = match.away_team.team_name;
    renderModeBadge();
    document.getElementById('home-color-label').innerText = match.home_team.team_name;
    document.getElementById('away-color-label').innerText = match.away_team.team_name;

    // Team colours (per match, editable to match jersey colours)
    loadTeamColors();
    applyTeamColors();
    ['home', 'away'].forEach(side => {
        document.getElementById(`${side}-color-input`).addEventListener('input', (ev) => {
            teamColors[side] = ev.target.value;
            saveTeamColors();
            applyTeamColors();
            renderStaging();
        }, { signal });
        // Give focus back so tagging hotkeys keep working after picking a colour
        document.getElementById(`${side}-color-input`).addEventListener('change', (ev) => ev.target.blur(), { signal });
    });

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
            tearDownPlayerTracker();
        }
    };
    updateVideoSourceUI();
    videoSourceSelect.addEventListener('change', updateVideoSourceUI, { signal });

    if (initialSource === 'youtube') {
        video = new VideoEngine('video-container', 'youtube');
        if (match.video_url) video.loadYouTube(match.video_url);
    }

    // Speed control dropdown
    const speedSelect = document.getElementById('speed-select');
    speedSelect.addEventListener('change', () => {
        const rate = parseFloat(speedSelect.value);
        video.setPlaybackRate(rate);
        updateSpeedBadge();
    }, { signal });

    // Load video from URL input
    loadVideoBtn.addEventListener('click', async () => {
        const url = videoUrlInput.value.trim();
        if (!url) return;
        tearDownPlayerTracker();
        video = new VideoEngine('video-container', 'youtube');
        video.loadYouTube(url);
        await supabase.from('matches').update({ video_url: url }).eq('match_id', matchId);
    }, { signal });

    pitch.onCoordsChange = (start, end, e) => {
        document.getElementById('pitch-coords').innerText = `Start: ${start ? start.x+','+start.y : 'None'} | End: ${end ? end.x+','+end.y : 'None'}`;
        saveSessionState();

        // Only show player dial on end-point click (not start-point)
        if (e && e.clientX && e.clientY && end) {
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

    pitch.onGkChange = (gkPt) => {
        const gkCoordsEl = document.getElementById('gk-coords');
        if (gkCoordsEl) gkCoordsEl.textContent = `GK: (${gkPt.x}, ${gkPt.y})`;
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

    // 3. Setup Dropdowns — grouped by category
    const ACTION_GROUPS = [
        { label: '⚔️ Attacking',  cats: ['atk'] },
        { label: '🛡️ Defensive',  cats: ['def'] },
        { label: '⚙️ Other',      cats: ['set', 'meta', undefined] },
    ];
    ACTION_GROUPS.forEach(({ label, cats }) => {
        const group = document.createElement('optgroup');
        group.label = label;
        Object.keys(CAC_LOGIC).forEach(act => {
            const cat = ACTION_CATEGORIES[act];
            if (cats.includes(cat)) group.appendChild(new Option(act, act));
        });
        if (group.children.length) actionSelect.appendChild(group);
    });

    const updateOutcomes = () => {
        const act = actionSelect.value;
        outcomeSelect.innerHTML = '';
        Object.keys(CAC_LOGIC[act]).forEach(out => outcomeSelect.add(new Option(out, out)));
        updateTypes();

        // Toggle Goal Face, Shot Metadata and GK overlay
        document.getElementById('goal-face-overlay').style.display = act === 'Shoot' ? 'flex' : 'none';
        document.getElementById('shot-metadata-overlay').style.display = act === 'Shoot' ? 'flex' : 'none';
        const _gkOverlay = document.getElementById('gk-position-overlay');
        if (_gkOverlay) _gkOverlay.style.display = act === 'Shoot' ? 'flex' : 'none';
        pitch.allowGkPoint = act === 'Shoot';
        if (act !== 'Shoot') {
            pitch.gkPoint = null;
            pitch.draw();
            const _gkEl = document.getElementById('gk-coords');
            if (_gkEl) _gkEl.textContent = 'GK: None — click pitch for 3rd point';
        }

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

    actionSelect.addEventListener('change', () => { updateOutcomes(); saveSessionState(); }, { signal });
    outcomeSelect.addEventListener('change', () => { updateTypes(); saveSessionState(); }, { signal });
    _restoringSession = true;
    updateOutcomes();

    // 4. Fetch Lineups (one-team / one-player matches get their stand-ins first)
    if (taggingMode() !== 'full') {
        try { await ensurePlaceholders(matchId, taggingMode()); }
        catch (phErr) { console.warn('Could not create stand-in players:', phErr.message); }
    }
    const { data: lineup, error: lErr } = await supabase
        .from('lineups')
        .select(`
            *,
            players (*)
        `)
        .eq('match_id', matchId);

    if (lErr) console.error(lErr);
    activeLineup = lineup || [];
    renderPlayerGrids();
    applyFocusPlayer();

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
            const _gkOvSess = document.getElementById('gk-position-overlay');
            if (_gkOvSess) _gkOvSess.style.display = savedSession.action === 'Shoot' ? 'flex' : 'none';
            pitch.allowGkPoint = savedSession.action === 'Shoot';

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
    }, { signal });

    directionBtn.addEventListener('click', () => {
        currentState.homeDirection = currentState.homeDirection === 'L2R' ? 'R2L' : 'L2R';
        directionBtn.innerText = `Direct: ${currentState.homeDirection}`;
        saveSessionState();
    }, { signal });

    document.getElementById('clear-pitch-btn').addEventListener('click', () => {
        pitch.reset();
        pitch.draw();
        document.getElementById('pitch-coords').innerText = 'Start: None | End: None';
        saveSessionState();
    }, { signal });

    document.getElementById('deselect-players-btn').addEventListener('click', () => {
        currentState.actionPlayer = null;
        currentState.reactionPlayer = null;
        applyFocusPlayer();
        updateLineupState();
    }, { signal });

    document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
        }
    }, { signal });

    document.getElementById('back-to-matches').addEventListener('click', () => {
        if (mainView) {
            mainView.style.maxWidth = '';
            mainView.style.padding = '';
        }
        window.location.hash = '#matches';
    }, { signal });

    uploadLocalBtn.addEventListener('click', () => {
        document.getElementById('local-video-file').click();
    }, { signal });

    document.getElementById('local-video-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const container = document.getElementById('video-container');
        container.innerHTML = '';
        const vid = document.createElement('video');
        vid.controls = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        vid.style.width = '100%';
        vid.style.height = '100%';
        vid.style.display = 'block';
        vid.style.background = '#000';
        const url = URL.createObjectURL(file);
        vid.src = url;
        container.appendChild(vid);
        vid.load();
        // Wrap in a minimal VideoEngine-compatible shim so tagging still works
        video = {
            videoType: 'local',
            player: vid,
            getCurrentTime: () => vid.currentTime,
            seek: (s) => { vid.currentTime = Math.max(0, s); },
            seekRelative: (o) => { vid.currentTime = Math.max(0, vid.currentTime + o); },
            play: () => vid.play(),
            pause: () => vid.pause(),
            togglePlay: () => vid.paused ? vid.play() : vid.pause(),
            getPlaybackRate: () => vid.playbackRate,
            setPlaybackRate: (r) => { vid.playbackRate = r; },
            cycleSpeedUp: () => {
                const steps = [0.25, 0.5, 1, 1.5, 2];
                const idx = steps.indexOf(vid.playbackRate);
                const next = steps[Math.min(idx + 1, steps.length - 1)];
                vid.playbackRate = next; return next;
            },
            cycleSpeedDown: () => {
                const steps = [0.25, 0.5, 1, 1.5, 2];
                const idx = steps.indexOf(vid.playbackRate);
                const next = steps[Math.max(idx - 1, 0)];
                vid.playbackRate = next; return next;
            },
            togglePTZ: () => false,
            resetPTZ: () => {},
            togglePopOut: () => {},
            destroy: () => { URL.revokeObjectURL(url); },
        };
    }, { signal });

    setupPlayerTrackerUI(signal);

    addEventBtn.addEventListener('click', () => logEventWithNote(''), { signal });
    syncBtn.addEventListener('click', syncEvents, { signal });

    // Undo button
    document.getElementById('undo-btn').addEventListener('click', undoLastEvent, { signal });

    // Keyboard shortcuts modal
    document.getElementById('shortcuts-btn').addEventListener('click', toggleShortcutsModal, { signal });
    document.getElementById('close-shortcuts').addEventListener('click', () => {
        document.getElementById('shortcuts-modal').style.display = 'none';
    }, { signal });
    document.getElementById('shortcuts-modal').addEventListener('click', (e) => {
        if (e.target.id === 'shortcuts-modal') {
            document.getElementById('shortcuts-modal').style.display = 'none';
        }
    }, { signal });

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
    }, { signal });

    // Finish & Process: sync pending events, then write processed_match_events.
    // Leaves match status alone (QC stays optional) and does not touch the score.
    document.getElementById('tagger-finish-btn')?.addEventListener('click', async (e) => {
        if (!activeMatch) return;
        const btn = e.currentTarget;
        const label = btn.innerText;
        btn.disabled = true; btn.innerText = 'Processing...';
        try {
            if (localEvents.length > 0) {
                await syncEvents();
                if (localEvents.length > 0) throw new Error('Some events could not be synced. Fix the sync first, then process again.');
            }
            const res = await finalizeMatch(activeMatch.match_id, { computeScore: false, markDone: false });
            const msg = `Processed ${res.count} events.` + (res.warnings.length ? '\n\n' + res.warnings.join('\n') : '');
            btn.innerText = 'Re-process';
            await afterProcessProject(msg);
        } catch (err) {
            alert('Processing error: ' + err.message);
            btn.innerText = label;
        } finally { btn.disabled = false; }
    }, { signal });

    // Create Player Modal
    document.getElementById('open-create-player-btn').addEventListener('click', () => {
        if (!activeMatch) return;
        const cpTeam = document.getElementById('cp-team');
        cpTeam.innerHTML = `
            <option value="${activeMatch.home_team_id}">${activeMatch.home_team.team_name} (Home)</option>
            <option value="${activeMatch.away_team_id}">${activeMatch.away_team.team_name} (Away)</option>
        `;
        document.getElementById('create-player-modal').style.display = 'block';
    }, { signal });

    document.getElementById('create-player-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('cp-submit-btn');
        const status = document.getElementById('cp-status');
        btn.disabled = true;
        btn.innerText = 'Saving...';
        
        try {
            const teamId = document.getElementById('cp-team').value;
            const playerName = document.getElementById('cp-name').value.trim();
            const jerseyNo = document.getElementById('cp-jersey').value.trim();
            const position = document.getElementById('cp-position').value;
            
            const { data: { user } } = await supabase.auth.getUser();

            // 1. Create Player
            const { data: newPlayer, error: pErr } = await supabase
                .from('players')
                .insert({
                    player_name: playerName,
                    team_id: teamId,
                    position: position,
                    created_by: user.id
                })
                .select('player_id')
                .single();
            if (pErr) throw pErr;

            // 2. Add to Lineups
            const { error: lErr } = await supabase
                .from('lineups')
                .insert({
                    match_id: activeMatch.match_id,
                    team_id: teamId,
                    player_id: newPlayer.player_id,
                    jersey_no: jerseyNo,
                    position: position,
                    starting_xi: false
                });
            if (lErr) throw lErr;

            // 3. Refresh Lineup
            const { data: lineup, error: refreshErr } = await supabase
                .from('lineups')
                .select(`
                    *,
                    players (*)
                `)
                .eq('match_id', activeMatch.match_id);
            if (refreshErr) throw refreshErr;
            
            activeLineup = lineup || [];
            renderPlayerGrids();
            
            status.style.color = 'var(--success)';
            status.innerText = 'Player added successfully!';
            
            setTimeout(() => {
                document.getElementById('create-player-modal').style.display = 'none';
                document.getElementById('create-player-form').reset();
                status.innerText = '';
                btn.disabled = false;
                btn.innerText = 'Save Player';
            }, 1000);

        } catch (err) {
            console.error(err);
            status.style.color = 'var(--danger)';
            status.innerText = 'Error: ' + err.message;
            btn.disabled = false;
            btn.innerText = 'Save Player';
        }
    }, { signal });

    // Modal Events
    document.getElementById('btn-ko-l2r').addEventListener('click', () => {
        document.getElementById('kickoff-modal').style.display = 'none';
        currentState.homeDirection = 'L2R';
        document.getElementById('direction-btn').innerText = `Direct: L2R`;
        logEventWithNote(`Home Direction Set: L2R`);
    }, { signal });
    document.getElementById('btn-ko-r2l').addEventListener('click', () => {
        document.getElementById('kickoff-modal').style.display = 'none';
        currentState.homeDirection = 'R2L';
        document.getElementById('direction-btn').innerText = `Direct: R2L`;
        logEventWithNote(`Home Direction Set: R2L`);
    }, { signal });

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
// ──────────────────────────────────────────
// PLAYER PROJECTS: status + "Next match in project"
// ──────────────────────────────────────────
async function afterProcessProject(msg) {
    let projectIds = [];
    try { projectIds = await projectsForMatch(activeMatch.match_id); } catch { /* table not created yet */ }
    if (!projectIds.length) { alert(msg); return; }

    // Prefer the project the analyst came from (?project=...)
    const fromUrl = new URLSearchParams(window.location.hash.split('?')[1] || '').get('project');
    const pid = projectIds.includes(fromUrl) ? fromUrl : (projectIds.includes(activeMatch.player_project_id) ? activeMatch.player_project_id : projectIds[0]);
    try {
        await Promise.all(projectIds.map(id => refreshProjectStatus(id)));
        const next = (await projectMatches(pid)).find(m => !m.processed && m.match_id !== activeMatch.match_id);
        if (!next) { alert(msg + '\n\nEvery match in this project is processed. The project is ready for its report.'); return; }
        if (confirm(msg + `\n\nNext match in project: ${next.home_team?.team_name} vs ${next.away_team?.team_name} (${next.match_date || 'no date'}).\nOpen it now?`))
            window.location.hash = `#tagger?id=${next.match_id}&project=${pid}`;
    } catch (err) {
        alert(msg + '\n\nCould not update the project: ' + err.message);
    }
}

// ──────────────────────────────────────────
// TAGGING MODES (full / team / player)
// ──────────────────────────────────────────
function taggingMode() {
    return activeMatch?.tagging_mode || 'full';
}

function jerseyLabel(l) {
    if (l.players?.is_placeholder) return l.players.player_name === 'Teammate' ? 'TM' : 'OPP';
    return l.jersey_no ?? '—';
}

function renderModeBadge() {
    const badge = document.getElementById('tagging-mode-badge');
    if (!badge || !activeMatch) return;
    const mode = taggingMode();
    const focusSide = activeMatch.focus_team_id === activeMatch.away_team_id ? 'away' : 'home';
    const oppSide = focusSide === 'home' ? 'away' : 'home';
    if (mode === 'full') { badge.style.display = 'none'; return; }
    badge.style.display = 'inline-block';
    badge.style.background = mode === 'team' ? '#2563eb' : '#9333ea';
    badge.innerText = mode === 'team' ? 'One team' : 'One player';
    const focusName = activeMatch[`${focusSide}_team`]?.team_name || '';
    const oppName = activeMatch[`${oppSide}_team`]?.team_name || '';
    document.getElementById(`${focusSide}-team-name`).innerText = `${focusName} · tagged`;
    document.getElementById(`${oppSide}-team-name`).innerText = `${oppName} · opponent`;
}

// Player mode: pre-select the focus player as the action player.
function applyFocusPlayer() {
    if (taggingMode() !== 'player' || currentState.actionPlayer) return;
    const l = activeLineup.find(x => x.player_id === activeMatch.focus_player_id);
    if (!l) return;
    currentState.actionPlayer = { id: l.player_id, teamId: l.team_id, name: l.players.player_name, jersey: jerseyLabel(l) };
    updateLineupState();
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
        gridEl.innerHTML = '';
        players.forEach(p => {
            const btn = document.createElement('button');
            btn.className = `player-btn p-${p.player_id}`;
            btn.title = p.players.is_placeholder ? `${p.players.player_name} (stand-in)` : `${p.players.player_name} (${p.players.position})`;
            btn.textContent = jerseyLabel(p);
            btn.dataset.jersey = p.jersey_no;
            btn.addEventListener('click', () => {
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
            btn.title = p.players.is_placeholder ? `${p.players.player_name} (stand-in)` : `${p.players.player_name} (${p.players.position})`;
            btn.textContent = jerseyLabel(p);
            btn.addEventListener('click', () => {
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
            if (isSamePlayer && currentState.reactionPlayer) btn.classList.add('disabled');
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
    // Escape always works — blurs any focused input to restore hotkey mode
    if (e.key === 'Escape') {
        e.preventDefault();
        document.activeElement.blur();
        return;
    }

    // Tab/Shift+Tab cycles outcome — intercept before focus trap check
    if (e.key === 'Tab' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        const outcomeSelect = document.getElementById('outcome-select');
        if (!outcomeSelect || outcomeSelect.options.length === 0) return;
        let idx = outcomeSelect.selectedIndex;
        if (e.shiftKey) {
            idx = idx <= 0 ? outcomeSelect.options.length - 1 : idx - 1;
        } else {
            idx = idx >= outcomeSelect.options.length - 1 ? 0 : idx + 1;
        }
        outcomeSelect.selectedIndex = idx;
        outcomeSelect.dispatchEvent(new Event('change'));
        return;
    }

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

    // ── Video Controls ──
    if (e.code === 'Space') {
        e.preventDefault();
        video.togglePlay();
    } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            video.seekRelative(0.04); // Frame-by-frame forward
        } else if (e.shiftKey) {
            video.seekRelative(10); // ±10s
        } else {
            video.seekRelative(3); // ±3s
        }
    } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            video.seekRelative(-0.04); // Frame-by-frame backward
        } else if (e.shiftKey) {
            video.seekRelative(-10);
        } else {
            video.seekRelative(-3);
        }
    } else if (key === '.') {
        // Speed up
        video.cycleSpeedUp();
        updateSpeedBadge();
    } else if (key === ',') {
        // Slow down
        video.cycleSpeedDown();
        updateSpeedBadge();

    // ── Log Event (debounced) ──
    } else if (e.code === 'Enter') {
        e.preventDefault();
        logEvent();

    // ── Shortcuts Modal ──
    } else if (key === '?' || e.code === 'F1') {
        e.preventDefault();
        toggleShortcutsModal();

    // ── Pressure Toggle ──
    } else if (key === 'v') {
        document.getElementById('pressure-btn').click();

    // ── Action Hotkeys ──
    } else if (ACTION_HOTKEYS[key.toUpperCase()] && actionSelect) {
        const action = ACTION_HOTKEYS[key.toUpperCase()];
        if (actionSelect.querySelector(`option[value="${action}"]`)) {
            actionSelect.value = action;
            actionSelect.dispatchEvent(new Event('change'));
        }

    // ── Outcome: Missed ──
    } else if (key === 'u') {
        if (actionSelect && ['Pass', 'Through Ball'].includes(actionSelect.value)) {
            outcomeSelect.value = 'Missed';
            outcomeSelect.dispatchEvent(new Event('change'));
        }

    // ── Body Part Hotkeys ──
    } else if (key === 'r') {
        document.getElementById('body-part-select').value = 'Right Leg';
    } else if (key === 'l') {
        document.getElementById('body-part-select').value = 'Left Leg';
    } else if (key === 'h') {
        document.getElementById('body-part-select').value = 'Head';

    // ── Notes Focus ──
    } else if (key === 'n') {
        e.preventDefault();
        document.getElementById('action-notes')?.focus();

    // ── Player Jersey Hotkeys: 1-9 = jersey 1-9, 0 = jersey 10 ──
    } else if (/^[0-9]$/.test(key)) {
        const jersey = key === '0' ? 10 : parseInt(key);
        selectPlayerByJersey(jersey);
    }
}

function selectPlayerByJersey(jersey) {
    // Find the player button with this jersey number and simulate a click
    const allBtns = document.querySelectorAll('.player-btn');
    for (const btn of allBtns) {
        if (parseInt(btn.dataset.jersey) === jersey) {
            btn.click();
            return;
        }
    }
}

// ──────────────────────────────────────────
// LOG EVENT
// ──────────────────────────────────────────
async function logEvent() {
    const now = Date.now();
    if (now - _lastLogTime < 500) return; // Debounce 500ms (keyboard Enter only)
    _lastLogTime = now;
    await logEventWithNote("");
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
    if (!rule) {
        alert(`Invalid action selected: "${actionVal}". Please pick a valid action.`);
        return;
    }
    if (rule.end_point && !pitch.endPoint) {
        alert("Mark an End Point on the pitch");
        return;
    }
    if (!rule.end_point && pitch.endPoint) {
        pitch.endPoint = null;
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

    if (actionVal === 'Shoot' && !pitch.gkPoint) {
        alert("Mark the goalkeeper's position on the pitch (3rd click after shot start + end)");
        return;
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

    // Use cached user (fetched at init) — fallback to fresh fetch if cache is stale
    let user = _cachedUser;
    if (!user) {
        const { data } = await supabase.auth.getUser();
        user = data?.user;
        _cachedUser = user;
    }
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
        gk_x: actionVal === 'Shoot' ? (pitch.gkPoint?.x ?? null) : null,
        gk_y: actionVal === 'Shoot' ? (pitch.gkPoint?.y ?? null) : null,
        _ui_player: `${currentState.actionPlayer.name} (${currentState.actionPlayer.jersey})`,
        _ui_reaction_player: currentState.reactionPlayer ? `${currentState.reactionPlayer.name} (${currentState.reactionPlayer.jersey})` : null
    };

    localEvents.push(event);
    undoStack = []; // Clear redo stack on new event
    saveEventsToStorage();
    renderStaging();
    updateProgress();
    updateOfflineBanner();

    // Visual feedback: flash + toast
    const mins = Math.floor(event.match_time_seconds / 60);
    const secs = (event.match_time_seconds % 60).toString().padStart(2, '0');
    showEventToast(`\u2713 ${actionVal} \u2192 ${outcome} logged at ${mins}:${secs}`);
    flashLogButton();

    // Auto-advance logic
    const nextStart = pitch.endPoint ? { ...pitch.endPoint } : { ...pitch.startPoint };
    pitch.reset(); // also clears pitch.gkPoint via clear()
    pitch.startPoint = nextStart;
    pitch.endPoint = null;
    pitch.draw();

    document.getElementById('pitch-coords').innerText = `Start: ${nextStart.x},${nextStart.y} | End: None`;
    const _gkCoordEl = document.getElementById('gk-coords');
    if (_gkCoordEl) _gkCoordEl.textContent = 'GK: None — click pitch for 3rd point';

    goalFace.reset();
    document.getElementById('action-notes').value = '';

    document.getElementById('shot-technique-select').value = 'Normal';
    document.getElementById('first-time-shot-select').value = '0';
    document.getElementById('assist-type-select').value = 'Normal Pass';

    // Auto-suggest next entry from actionFlow config
    const prevAction = actionVal;
    const prevOutcome = document.getElementById('outcome-select').value;
    const prevType = document.getElementById('type-select').value;
    const prevActionPlayer = currentState.actionPlayer ? { ...currentState.actionPlayer } : null;
    const prevReactionPlayer = currentState.reactionPlayer ? { ...currentState.reactionPlayer } : null;

    const next = getNextEntry(prevAction, prevOutcome, prevType, prevActionPlayer, prevReactionPlayer);

    const actionSelect = document.getElementById('action-select');
    actionSelect.value = next.action;
    actionSelect.dispatchEvent(new Event('change'));

    const outcomeSelect = document.getElementById('outcome-select');
    if (next.outcome && outcomeSelect.querySelector(`option[value="${next.outcome}"]`)) {
        outcomeSelect.value = next.outcome;
        outcomeSelect.dispatchEvent(new Event('change'));
    }

    const typeSelect = document.getElementById('type-select');
    if (next.type && typeSelect.querySelector(`option[value="${next.type}"]`)) {
        typeSelect.value = next.type;
    }

    document.getElementById('body-part-select').value = 'Right Leg';

    currentState.actionPlayer = next.actionPlayer;
    currentState.reactionPlayer = next.reactionPlayer;
    if (taggingMode() === 'player') {
        // Player mode: the focus player is always the action player
        if (currentState.reactionPlayer?.id === activeMatch.focus_player_id) currentState.reactionPlayer = null;
        currentState.actionPlayer = null;
        applyFocusPlayer();
    }
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
        const side = getEventSide(e);
        const teamColor = side ? teamColors[side] : 'var(--border)';
        const teamName = side && activeMatch ? activeMatch[`${side}_team`]?.team_name || side : 'Unknown team';
        const bgColor = isSynced
            ? 'background: rgba(40, 167, 69, 0.08);'
            : (idx % 2 === 0 ? 'background: rgba(0,0,0,0.02);' : '');
        const secs = Math.max(0, Number(e.match_time_seconds) || 0);
        const timeStr = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;
        const playerDisplay = e._ui_player || 'Unknown';
        const reactionDisplay = e._ui_reaction_player || '';

        // Make unsynced rows editable
        const editableClass = isSynced ? '' : 'editable-cell';
        const editClick = isSynced ? '' : `data-edit-idx="${idx}"`;

        return `
            <tr style="border-bottom: 1px solid var(--border); border-left: 4px solid ${teamColor}; ${bgColor}">
                <td style="padding: 6px; white-space: nowrap;">
                    <span class="team-chip" style="background:${teamColor};" title="${escapeHtml(teamName)}"></span><button type="button" class="log-time-btn" data-seek="${secs}" title="Jump video to ${timeStr}">${timeStr}</button>
                </td>
                <td style="padding: 6px; font-weight: 600;">${e.team_direction}</td>
                <td style="padding: 6px;" class="${editableClass}" ${editClick} data-edit-field="action">
                    <span style="font-weight:600;">${e.action}</span><br>
                    <span style="color:var(--text-muted);font-size:0.65rem;">${e.outcome}</span>
                </td>
                <td style="padding: 6px;" class="${editableClass}" ${editClick} data-edit-field="type">${e.type || '-'}</td>
                <td style="padding: 6px;" class="${editableClass}" ${editClick} data-edit-field="body_part">${e.body_part || '-'}</td>
                <td style="padding: 6px;">${e.pressure_on ? 'Y' : 'N'}</td>
                <td style="padding: 6px; white-space: nowrap;">
                    <span style="color:var(--text-muted);">ACT:</span> <span style="${teamTextStyle(getPlayerSide(e.player_id) || side)}">${escapeHtml(playerDisplay)}</span><br>
                    ${reactionDisplay ? `<span style="font-size:0.65rem;"><span style="color:var(--text-muted);">RCT:</span> <span style="${teamTextStyle(getPlayerSide(e.reaction_player_id))}">${escapeHtml(reactionDisplay)}</span></span>` : ''}
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

    // Clickable timestamps: jump the video to the event's time
    body.querySelectorAll('.log-time-btn').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const t = Number(btn.dataset.seek);
            if (!video || isNaN(t)) {
                showEventToast('Load a video first to jump to this event');
                return;
            }
            video.seek(t);
            btn.blur(); // keep keyboard hotkeys working after the click
            showEventToast(`Jumped to ${btn.textContent}`);
        });
    });

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
        let { data, error } = await supabase
            .from('match_events')
            .select('*, player:players!player_id(player_name), reaction:players!reaction_player_id(player_name)')
            .eq('match_id', activeMatch.match_id)
            .order('match_time_seconds', { ascending: true })
            .range(rangeStart, rangeStart + PAGE_SIZE - 1);

        // If join query fails, retry without player joins
        if (error) {
            console.warn('Join query failed, retrying without player joins:', error);
            const fallback = await supabase
                .from('match_events')
                .select('*')
                .eq('match_id', activeMatch.match_id)
                .order('match_time_seconds', { ascending: true })
                .range(rangeStart, rangeStart + PAGE_SIZE - 1);
            if (fallback.error) { console.error('Failed to load synced events:', fallback.error); break; }
            data = fallback.data;
        }
        allData = allData.concat(data || []);
        if (!data || data.length < PAGE_SIZE) break;
        rangeStart += PAGE_SIZE;
    }

    syncedEvents = allData.map(e => {
        const pLineup = activeLineup.find(l => l.player_id === e.player_id);
        const rLineup = activeLineup.find(l => l.player_id === e.reaction_player_id);
        const pName = e.player?.player_name || pLineup?.players?.player_name || null;
        const rName = e.reaction?.player_name || rLineup?.players?.player_name || null;
        return {
            ...e,
            _ui_player: pName ? `${pName} (${pLineup?.jersey_no || '?'})` : 'Unknown',
            _ui_reaction_player: rName ? `${rName} (${rLineup?.jersey_no || '?'})` : null,
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
        syncedEvents = [...localEvents, ...syncedEvents].sort((a, b) => (a.match_time_seconds || 0) - (b.match_time_seconds || 0));
        localEvents = [];
        undoStack = [];
        saveEventsToStorage();
        renderStaging();
        updateProgress();
        btn.innerText = 'Synced!';
        if (syncStatus) syncStatus.textContent = `${syncedEvents.length} events synced`;
        if (activeMatch) loadCollabStats(activeMatch.match_id);
        setTimeout(() => {
            btn.innerText = 'Sync All';
            btn.disabled = false;
        }, 2000);
    }
}

// ──────────────────────────────────────────
// PLAYER TRACKER (local video only)
// ──────────────────────────────────────────
async function setupPlayerTracker() {
    tearDownPlayerTracker();
    const panel = document.getElementById('player-tracker-panel');
    const overlay = document.getElementById('player-tracker-overlay');
    const status = document.getElementById('pt-status');
    if (!panel || !overlay) return;

    // Find the underlying <video> element inside the engine container
    const videoEl = document.querySelector('#video-container video');
    if (!videoEl) {
        // Element not built yet — try once more after a tick
        setTimeout(() => setupPlayerTracker(), 200);
        return;
    }

    panel.style.display = 'block';
    status.textContent = 'Loading tracker engine…';

    try {
        playerTracker = new PlayerTracker(videoEl, overlay);
        await playerTracker.init();
        status.textContent = 'Pause + click "+ Mark Player" then click on the video';
        renderTrackerList();
    } catch (e) {
        status.textContent = 'Tracker failed to load: ' + e.message;
        playerTracker = null;
    }
}

function tearDownPlayerTracker() {
    if (playerTracker) {
        try { playerTracker.destroy(); } catch (e) {}
        playerTracker = null;
    }
    trackerArmed = false;
    const panel = document.getElementById('player-tracker-panel');
    if (panel) panel.style.display = 'none';
    const overlay = document.getElementById('player-tracker-overlay');
    if (overlay) overlay.style.pointerEvents = 'none';
}

function setupPlayerTrackerUI(signal) {
    const overlay = document.getElementById('player-tracker-overlay');
    const markBtn = document.getElementById('pt-mark-btn');
    const clearBtn = document.getElementById('pt-clear-btn');
    const status = document.getElementById('pt-status');
    if (!overlay || !markBtn || !clearBtn) return;

    markBtn.addEventListener('click', () => {
        if (!playerTracker) return;
        trackerArmed = !trackerArmed;
        if (trackerArmed) {
            overlay.style.pointerEvents = 'auto';
            overlay.style.cursor = 'crosshair';
            markBtn.style.background = '#ff9800';
            markBtn.textContent = 'Click on player…';
            if (status) status.textContent = 'Click directly on the player you want to mark';
        } else {
            overlay.style.pointerEvents = 'none';
            overlay.style.cursor = 'default';
            markBtn.style.background = 'var(--success)';
            markBtn.textContent = '+ Mark Player';
            if (status) status.textContent = 'Pause + click "+ Mark Player" then click on the video';
        }
    }, { signal });

    clearBtn.addEventListener('click', () => {
        if (!playerTracker) return;
        playerTracker.clear();
        renderTrackerList();
    }, { signal });

    overlay.addEventListener('click', (e) => {
        if (!playerTracker || !trackerArmed) return;
        const pt = playerTracker.overlayToVideo(e.clientX, e.clientY);
        if (!pt) return;
        const label = prompt('Jersey number / label for this player:');
        if (label == null || !String(label).trim()) {
            // Disarm but don't add
            trackerArmed = false;
            overlay.style.pointerEvents = 'none';
            overlay.style.cursor = 'default';
            markBtn.style.background = 'var(--success)';
            markBtn.textContent = '+ Mark Player';
            return;
        }
        playerTracker.addMarker(pt.x, pt.y, String(label).trim());
        renderTrackerList();
        // Disarm after one mark — click "+ Mark Player" again for the next
        trackerArmed = false;
        overlay.style.pointerEvents = 'none';
        overlay.style.cursor = 'default';
        markBtn.style.background = 'var(--success)';
        markBtn.textContent = '+ Mark Player';
        if (status) status.textContent = `${playerTracker.list().length} marker(s) active. Click + Mark Player to add another.`;
    }, { signal });
}

function renderTrackerList() {
    const list = document.getElementById('pt-list');
    if (!list || !playerTracker) return;
    const items = playerTracker.list();
    if (items.length === 0) {
        list.innerHTML = '<div style="color: rgba(255,255,255,0.5); font-size: 0.7rem;">No players marked yet.</div>';
        return;
    }
    list.innerHTML = items.map(m => `
        <div style="display:flex; align-items:center; gap:6px; padding: 2px 4px; background: rgba(255,255,255,0.06); border-radius: 4px;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${m.color}; flex-shrink:0;"></span>
            <span style="flex:1; font-weight:600;">${m.label}${m.alive ? '' : ' <span style=\"opacity:0.5; font-weight:400;\">(lost)</span>'}</span>
            <button data-pt-remove="${m.id}" style="background: transparent; color: #f88; border: none; cursor: pointer; font-size: 0.85rem; padding: 0 4px;">×</button>
        </div>
    `).join('');
    list.querySelectorAll('[data-pt-remove]').forEach(b => {
        b.addEventListener('click', () => {
            playerTracker?.removeMarker(b.getAttribute('data-pt-remove'));
            renderTrackerList();
        });
    });
}

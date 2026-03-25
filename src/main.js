import './styles/index.css'
import { supabase } from './supabase'
import { router } from './router'

// Load saved theme before render to prevent flash
const savedTheme = localStorage.getItem('cac-theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

class App {
    constructor() {
        this.appElement = document.getElementById('app');
        this.user = null;

        // Global error handling for debugging
        window.addEventListener('error', (e) => this.showFatalError(e.message));
        window.addEventListener('unhandledrejection', (e) => this.showFatalError(e.reason?.message || e.reason));

        this.init();
    }

    showFatalError(msg) {
        console.error("Fatal Error:", msg);
        if (this.appElement) {
            this.appElement.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--danger);">
                    <h2 style="margin-bottom: 16px;">App Load Failed</h2>
                    <p style="color: var(--text-muted); margin-bottom: 24px;">${msg}</p>
                    <button onclick="location.reload()" class="btn btn-primary" style="width: auto;">Try Refreshing</button>
                </div>
            `;
        }
    }

    async init() {
        // Initial session check
        const { data: { session } } = await supabase.auth.getSession();
        this.handleAuthChange(session?.user ?? null);

        // Listen for auth changes
        supabase.auth.onAuthStateChange((_event, session) => {
            this.handleAuthChange(session?.user ?? null);
        });

        // Initial route handling
        window.addEventListener('hashchange', () => this.render());
        this.render();
    }

    handleAuthChange(user) {
        this.user = user;
        // If not logged in and not on auth page, redirect to login
        if (!user && !['#login', '#register'].includes(window.location.hash)) {
            window.location.hash = '#login';
        } 
        // If logged in and on auth page, redirect to home
        else if (user && ['#login', '#register'].includes(window.location.hash)) {
            window.location.hash = '#create-match';
        }
        this.render();
    }

    async render() {
        const hash = window.location.hash || '#create-match';
        const route = router.getRoute(hash);

        if (route.requiresAuth && !this.user) {
            window.location.hash = '#login';
            return;
        }

        // Render main layout
        if (!this.user) {
            this.appElement.innerHTML = `
                <div class="auth-overlay">
                    <div id="auth-content"></div>
                </div>
            `;
            const authContent = document.getElementById('auth-content');
            authContent.innerHTML = await route.component();
        } else {
            this.appElement.innerHTML = `
                <div class="app-container">
                    <aside class="sidebar">
                        <div class="sidebar-brand">
                            <span>CAC</span> Match Center
                        </div>
                        <nav class="nav-list">
                            <a href="#create-match" class="nav-item ${hash === '#create-match' ? 'active' : ''}">
                                <span>➕</span> Create Match
                            </a>
                            <a href="#matches" class="nav-item ${hash === '#matches' ? 'active' : ''}">
                                <span>📋</span> My Matches
                            </a>
                            <a href="#qc" class="nav-item ${hash === '#qc' ? 'active' : ''}">
                                <span>✅</span> QC Portal
                            </a>
                            <div id="admin-nav"></div>
                        </nav>
                        <div class="sidebar-footer">
                            <div class="theme-toggle">
                                <span id="theme-label">${document.documentElement.getAttribute('data-theme') === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
                                <label class="theme-switch">
                                    <input type="checkbox" id="theme-checkbox" ${document.documentElement.getAttribute('data-theme') === 'dark' ? 'checked' : ''}>
                                    <span class="theme-slider"></span>
                                </label>
                            </div>
                            <div class="user-profile">
                                <div class="user-avatar">${this.user.email?.[0].toUpperCase() ?? 'U'}</div>
                                <div class="user-info">
                                    <div class="user-name">${this.user.user_metadata?.username ?? 'User'}</div>
                                    <div class="user-role" id="user-role-display">Analyzing...</div>
                                </div>
                            </div>
                            <button class="btn btn-ghost" id="logout-btn">
                                <span>🚪</span> Logout
                            </button>
                        </div>
                    </aside>
                    <main class="main-content">
                        <div id="main-view" class="view-container"></div>
                    </main>
                </div>
            `;

            // Render view component
            const mainView = document.getElementById('main-view');
            mainView.innerHTML = await route.component();

            // Set up logout
            document.getElementById('logout-btn').addEventListener('click', () => {
                supabase.auth.signOut();
            });

            // Set up theme toggle
            const themeCheckbox = document.getElementById('theme-checkbox');
            if (themeCheckbox) {
                themeCheckbox.addEventListener('change', () => {
                    const isDark = themeCheckbox.checked;
                    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
                    localStorage.setItem('cac-theme', isDark ? 'dark' : 'light');
                    const label = document.getElementById('theme-label');
                    if (label) label.textContent = isDark ? '🌙 Dark' : '☀️ Light';
                });
            }

            // Fetch role if needed
            this.updateRoleDisplay();
        }

        // Re-attach component-level listeners if any
        if (route.onRender) route.onRender();
    }

    async updateRoleDisplay() {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', this.user.id)
            .single();
        
        if (profile) {
            const roleEl = document.getElementById('user-role-display');
            if (roleEl) roleEl.innerText = profile.role;

            if (profile.role === 'admin') {
                const adminNav = document.getElementById('admin-nav');
                if (adminNav) {
                    adminNav.innerHTML = `
                        <a href="#admin" class="nav-item ${window.location.hash === '#admin' ? 'active' : ''}">
                            <span>⚙️</span> Admin Portal
                        </a>
                    `;
                }
            }
        }
    }
}

new App();

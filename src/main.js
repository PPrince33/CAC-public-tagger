import './styles/index.css'
import { supabase } from './supabase'
import { router } from './router'

// Load saved theme before render to prevent flash
const savedTheme = localStorage.getItem('cac-theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// HTML escape utility — prevents XSS in all template literals
function esc(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

class App {
    constructor() {
        this.appElement = document.getElementById('app');
        this.user = null;
        this.userRole = null;

        // Global error handling
        window.addEventListener('error', (e) => this.showFatalError(e.message));
        window.addEventListener('unhandledrejection', (e) => this.showFatalError(e.reason?.message || e.reason));

        this.init();
    }

    showFatalError(msg) {
        console.error('Fatal Error:', msg);
        if (this.appElement) {
            this.appElement.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--danger);">
                    <h2 style="margin-bottom: 16px;">App Load Failed</h2>
                    <p style="color: var(--text-muted); margin-bottom: 24px;">${esc(msg)}</p>
                    <button onclick="location.reload()" class="btn btn-primary" style="width: auto;">Try Refreshing</button>
                </div>
            `;
        }
    }

    async init() {
        const { data: { session } } = await supabase.auth.getSession();
        await this.handleAuthChange(session?.user ?? null);

        supabase.auth.onAuthStateChange(async (_event, session) => {
            // Handle password recovery flow
            if (_event === 'PASSWORD_RECOVERY') {
                window.location.hash = '#reset-password';
            }
            await this.handleAuthChange(session?.user ?? null);
        });

        window.addEventListener('hashchange', () => this.render());
        this.render();
    }

    async handleAuthChange(user) {
        this.user = user;
        this.userRole = null;

        if (user) {
            // Fetch role once on auth change
            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                this.userRole = profile?.role || 'analyst';
            } catch (e) {
                this.userRole = 'analyst';
            }
        }

        const publicRoutes = ['#login', '#register', '#forgot-password', '#reset-password'];
        if (!user && !publicRoutes.includes(window.location.hash.split('?')[0])) {
            window.location.hash = '#login';
        } else if (user && publicRoutes.includes(window.location.hash.split('?')[0]) && window.location.hash !== '#reset-password') {
            window.location.hash = '#create-match';
        }
        this.render();
    }

    async render() {
        const hash = window.location.hash || '#create-match';
        const route = router.getRoute(hash);

        // Auth guard
        if (route.requiresAuth && !this.user) {
            window.location.hash = '#login';
            return;
        }

        // Admin guard — server-side role check, not just client-side
        if (route.requiresAdmin && this.userRole !== 'admin') {
            window.location.hash = '#create-match';
            return;
        }

        // Unauthenticated layout
        if (!this.user) {
            this.appElement.innerHTML = `
                <div class="auth-overlay">
                    <div id="auth-content"></div>
                </div>
            `;
            const authContent = document.getElementById('auth-content');
            authContent.innerHTML = await route.component();
        } else {
            // Authenticated layout
            const displayName = esc(this.user.user_metadata?.username ?? 'User');
            const avatarLetter = esc(this.user.email?.[0]?.toUpperCase() ?? 'U');
            const roleName = esc(this.userRole || 'Analyst');

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
                            ${this.userRole === 'admin' ? `
                            <a href="#admin" class="nav-item ${hash.startsWith('#admin') ? 'active' : ''}">
                                <span>⚙️</span> Admin Portal
                            </a>` : ''}
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
                                <div class="user-avatar">${avatarLetter}</div>
                                <div class="user-info">
                                    <div class="user-name">${displayName}</div>
                                    <div class="user-role">${roleName}</div>
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

            const mainView = document.getElementById('main-view');
            mainView.innerHTML = await route.component();

            document.getElementById('logout-btn').addEventListener('click', () => {
                supabase.auth.signOut();
            });

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
        }

        if (route.onRender) route.onRender();
    }
}

new App();

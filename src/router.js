export const router = {
    routes: {
        '#login': {
            component: () => import('./components/auth').then(m => m.LoginView()).catch(err => { console.error('Failed to load auth:', err); return '<p style="color:var(--danger);text-align:center;">Failed to load page.</p>'; }),
            onRender: () => import('./components/auth').then(m => m.initAuth()).catch(() => {}),
            requiresAuth: false
        },
        '#register': {
            component: () => import('./components/auth').then(m => m.RegisterView()).catch(err => { console.error('Failed to load auth:', err); return '<p style="color:var(--danger);text-align:center;">Failed to load page.</p>'; }),
            onRender: () => import('./components/auth').then(m => m.initAuth()).catch(() => {}),
            requiresAuth: false
        },
        '#forgot-password': {
            component: () => import('./components/auth').then(m => m.ForgotPasswordView()).catch(err => { console.error('Failed to load auth:', err); return '<p style="color:var(--danger);text-align:center;">Failed to load page.</p>'; }),
            onRender: () => import('./components/auth').then(m => m.initAuth()).catch(() => {}),
            requiresAuth: false
        },
        '#reset-password': {
            component: () => import('./components/auth').then(m => m.ResetPasswordView()).catch(err => { console.error('Failed to load auth:', err); return '<p style="color:var(--danger);text-align:center;">Failed to load page.</p>'; }),
            onRender: () => import('./components/auth').then(m => m.initAuth()).catch(() => {}),
            requiresAuth: false
        },
        '#create-match': {
            component: () => import('./components/createMatch').then(m => m.CreateMatchView()).catch(err => { console.error('Failed to load createMatch:', err); return '<p style="color:var(--danger);text-align:center;">Failed to load page.</p>'; }),
            onRender: () => import('./components/createMatch').then(m => m.initCreateMatch?.()).catch(() => {}),
            requiresAuth: true
        },
        '#matches': {
            component: () => import('./components/createdMatches').then(m => m.MatchesView()).catch(err => { console.error('Failed to load matches:', err); return '<p style="color:var(--danger);text-align:center;">Failed to load page.</p>'; }),
            onRender: () => import('./components/createdMatches').then(m => m.initMatches?.()).catch(() => {}),
            requiresAuth: true
        },
        '#tagger': {
            component: () => import('./components/tagger').then(m => m.TaggerView()).catch(err => { console.error('Failed to load tagger:', err); return '<p style="color:var(--danger);text-align:center;">Failed to load page.</p>'; }),
            onRender: () => import('./components/tagger').then(m => m.initTagger?.()).catch(() => {}),
            requiresAuth: true
        },
        '#qc': {
            component: () => import('./components/qcPortal').then(m => m.QCPortalView()).catch(err => { console.error('Failed to load QC portal:', err); return '<p style="color:var(--danger);text-align:center;">Failed to load page.</p>'; }),
            onRender: () => import('./components/qcPortal').then(m => m.initQCPortal?.()).catch(() => {}),
            requiresAuth: true
        },
        '#analytics': {
            component: () => import('./components/analytics').then(m => m.AnalyticsView()).catch(err => { console.error('Failed to load analytics:', err); return '<p style="color:var(--danger);text-align:center;">Failed to load page.</p>'; }),
            onRender: () => import('./components/analytics').then(m => m.initAnalytics?.()).catch(() => {}),
            requiresAuth: true
        },
        '#admin': {
            component: () => import('./components/adminPortal').then(m => m.AdminPortalView()).catch(err => { console.error('Failed to load admin portal:', err); return '<p style="color:var(--danger);text-align:center;">Failed to load page.</p>'; }),
            onRender: () => import('./components/adminPortal').then(m => m.initAdminPortal?.()).catch(() => {}),
            requiresAuth: true,
            requiresAdmin: true
        },
    },

    getRoute(hash) {
        const routeKey = hash.split('?')[0];
        return this.routes[routeKey] || this.routes['#create-match'];
    }
};

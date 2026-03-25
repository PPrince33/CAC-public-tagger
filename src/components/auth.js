import { supabase } from '../supabase'

export function LoginView() {
    return `
        <div class="auth-card">
            <h2 class="auth-title">Welcome Back</h2>
            <p class="auth-subtitle">Sign in to your CAC account</p>
            <form id="login-form">
                <div class="form-group">
                    <label class="form-label">Email Address</label>
                    <input type="email" id="email" class="form-input" required placeholder="name@example.com">
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" id="password" class="form-input" required placeholder="••••••••">
                </div>
                <div id="auth-error" style="color: var(--danger); font-size: 0.875rem; margin-bottom: 20px; display: none;"></div>
                <button type="submit" class="btn btn-primary" id="login-btn">Sign In</button>
                <div style="margin-top: 16px; text-align: center;">
                    <a href="#register" class="btn btn-ghost" style="font-size: 0.8125rem;">Don't have an account? Register</a>
                </div>
            </form>
        </div>
    `;
}

export function RegisterView() {
    return `
        <div class="auth-card">
            <h2 class="auth-title">Create Account</h2>
            <p class="auth-subtitle">Join the CAC Match Tagging Center</p>
            <form id="register-form">
                <div class="form-group">
                    <label class="form-label">Email Address</label>
                    <input type="email" id="email" class="form-input" required placeholder="name@example.com">
                </div>
                <div class="form-group">
                    <label class="form-label">Username (Display Name)</label>
                    <input type="text" id="username" class="form-input" required placeholder="Single word or display name">
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" id="password" class="form-input" required placeholder="Min 6 chars, 2 num, 2 let, 1 spec">
                </div>
                <div id="auth-error" style="color: var(--danger); font-size: 0.875rem; margin-bottom: 20px; display: none;"></div>
                <button type="submit" class="btn btn-primary" id="register-btn">Create Account</button>
                <div style="margin-top: 16px; text-align: center;">
                    <a href="#login" class="btn btn-ghost" style="font-size: 0.8125rem;">Already have an account? Login</a>
                </div>
            </form>
        </div>
    `;
}

// Function to attach listeners after rendering
export function initAuth() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const errorEl = document.getElementById('auth-error');
            const btn = document.getElementById('login-btn');

            btn.innerText = 'Authenticating...';
            btn.disabled = true;

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                if (error.status === 429) {
                    errorEl.innerText = "Too many attempts! Please wait 60 seconds and try again.";
                } else {
                    errorEl.innerText = error.message;
                }
                errorEl.style.display = 'block';
                btn.innerText = 'Sign In';
                btn.disabled = false;
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const errorEl = document.getElementById('auth-error');
            const btn = document.getElementById('register-btn');

            errorEl.style.display = 'none';

            const passwordRegex = /^(?=.*[A-Za-z].*[A-Za-z])(?=.*\d.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{6,}$/;
            if (!passwordRegex.test(password)) {
                errorEl.innerText = 'Password must be min 6 chars, with at least 2 letters, 2 numbers, and 1 special character.';
                errorEl.style.display = 'block';
                return;
            }

            btn.innerText = 'Creating Account...';
            btn.disabled = true;

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { username }
                }
            });

            if (error) {
                if (error.status === 429) {
                    errorEl.innerText = "Too many attempts! Please wait 60 seconds and try again.";
                } else {
                    errorEl.innerText = error.message;
                }
                errorEl.style.display = 'block';
                btn.innerText = 'Create Account';
                btn.disabled = false;
            } else {
                // If the user is logged in immediately, redirect happens via main.js
                // Otherwise show confirmation message
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    errorEl.innerText = "Check your email for a confirmation link!";
                    errorEl.style.color = "var(--success)";
                    errorEl.style.display = 'block';
                    btn.innerText = 'Email Sent';
                }
            }
        });
    }
}

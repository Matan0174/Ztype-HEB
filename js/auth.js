
const API_URL = '/api'; // Relative path since we serve from same origin

// Auth Module
const Auth = {
    token: localStorage.getItem('token'),
    user: null,

    async init() {
        if (this.token) {
            try {
                const res = await fetch(`${API_URL}/me`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (res.ok) {
                    this.user = await res.json();
                    this.updateUI(true);
                } else {
                    this.logout();
                }
            } catch (e) {
                console.error('Auth check failed', e);
                this.logout();
            }
        } else {
            this.updateUI(false);
        }

        this.bindEvents();
    },

    bindEvents() {
        // UI Navigation for Auth Screens
        const loginBtn = document.getElementById('menu-login-btn');
        const registerBtn = document.getElementById('menu-register-btn');
        const logoutBtn = document.getElementById('menu-logout-btn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                document.getElementById('main-menu').classList.remove('active');
                document.getElementById('login-screen').classList.add('active');
            });
        }

        if (registerBtn) {
            registerBtn.addEventListener('click', () => {
                document.getElementById('main-menu').classList.remove('active');
                document.getElementById('register-screen').classList.add('active');
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Handle Forms
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Back Buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.dataset.target;
                if (targetId) {
                    document.getElementById(targetId).classList.remove('active');
                    document.getElementById('main-menu').classList.add('active');
                    // Clear messages/forms
                    this.clearForms();
                }
            });
        });
    },

    clearForms() {
        document.getElementById('login-form').reset();
        document.getElementById('register-form').reset();
        document.getElementById('login-message').textContent = '';
        document.getElementById('login-message').className = 'message';
        document.getElementById('register-message').textContent = '';
        document.getElementById('register-message').className = 'message';
    },

    updateUI(isLoggedIn) {
        const authButtonsContainer = document.querySelector('.auth-buttons');
        const userStatus = document.getElementById('user-status');
        const usernameDisplay = document.getElementById('username-display');

        if (isLoggedIn && this.user) {
            if (authButtonsContainer) authButtonsContainer.classList.add('hidden');
            if (userStatus) {
                userStatus.classList.remove('hidden');
                usernameDisplay.textContent = this.user.username;
            }
        } else {
            if (authButtonsContainer) authButtonsContainer.classList.remove('hidden');
            if (userStatus) userStatus.classList.add('hidden');
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const messageEl = document.getElementById('login-message');

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await res.json();

            if (res.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                
                messageEl.textContent = 'התחברת בהצלחה!';
                messageEl.className = 'message success';
                
                setTimeout(() => {
                    document.getElementById('login-screen').classList.remove('active');
                    document.getElementById('main-menu').classList.add('active');
                    this.updateUI(true);
                    this.clearForms();
                }, 1000);
            } else {
                messageEl.textContent = data.error || 'שגיאה בהתחברות';
                messageEl.className = 'message error';
            }
        } catch (err) {
            messageEl.textContent = 'שגיאת שרת';
            messageEl.className = 'message error';
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;
        const messageEl = document.getElementById('register-message');

        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await res.json();

            if (res.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                
                messageEl.textContent = 'נרשמת בהצלחה!';
                messageEl.className = 'message success';
                
                setTimeout(() => {
                    document.getElementById('register-screen').classList.remove('active');
                    document.getElementById('main-menu').classList.add('active');
                    this.updateUI(true);
                    this.clearForms();
                }, 1000);
            } else {
                messageEl.textContent = data.error || 'שגיאה בהרשמה';
                messageEl.className = 'message error';
            }
        } catch (err) {
            messageEl.textContent = 'שגיאת שרת';
            messageEl.className = 'message error';
        }
    },

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        this.updateUI(false);
    },

    async submitScore(score) {
        if (!this.token) return;

        try {
            await fetch(`${API_URL}/score`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ score })
            });
        } catch (e) {
            console.error('Failed to submit score', e);
        }
    },

    async submitProgress(level) {
        if (!this.token) return;

        // Optimistically update local user object
        if (this.user && level > this.user.maxLevel) {
            this.user.maxLevel = level;
        }

        try {
            await fetch(`${API_URL}/progress`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ level })
            });
        } catch (e) {
            console.error('Failed to submit progress', e);
        }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});

export default Auth;

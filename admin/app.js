/* Admin Panel SPA — kaymen.dev */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/admin/sw.js').catch(() => {});
}

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const app = document.getElementById('app');

  // Load saved theme
  if (localStorage.getItem('admin_theme') === 'light') document.documentElement.setAttribute('data-theme', 'light');

  // ===== STATE =====
  const state = {
    token: localStorage.getItem('admin_token'),
    user: null,
    page: 'dashboard',
    sidebarOpen: false
  };

  // ===== API =====
  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const res = await fetch(`/api${path}`, { ...opts, headers });
    if (res.status === 401) {
      state.token = null;
      state.user = null;
      localStorage.removeItem('admin_token');
      render();
      throw new Error('Unauthorized');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // ===== AUTH =====
  async function checkAuth() {
    if (!state.token) return false;
    try {
      const res = await api('/auth/me');
      state.user = res.data.user;
      return true;
    } catch {
      return false;
    }
  }

  async function login(email, password) {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    state.token = res.data.token;
    state.user = res.data.user;
    localStorage.setItem('admin_token', state.token);
    render();
  }

  async function changePassword(current, newPass) {
    await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: current, new_password: newPass })
    });
    state.user.must_change_password = 0;
    render();
  }

  function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('admin_token');
    render();
  }

  // ===== HELPERS =====
  function timeAgo(dateStr) {
    const seconds = Math.floor((new Date() - new Date(dateStr + 'Z')) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncate(str, len = 40) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  function severityBadge(severity) {
    const map = { high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray' };
    return `<span class="badge ${map[severity] || 'badge-gray'}">${severity}</span>`;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ===== MARKDOWN RENDERER =====
  function renderMarkdown(text) {
    if (!text) return '';
    function inline(t) {
      return t
        .replace(/\[x\]/g, '<span class="md-check done">&#9745;</span>')
        .replace(/\[ \]/g, '<span class="md-check">&#9744;</span>')
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    }
    // Extract code blocks (they can contain blank lines)
    const codeBlocks = [];
    let src = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      codeBlocks.push(`<pre><code>${code}</code></pre>`);
      return `\x00CB${codeBlocks.length - 1}\x00`;
    });
    const lines = src.split('\n');
    const out = [];
    let listType = null;
    let para = [];
    function flushPara() { if (para.length) { out.push(`<p>${para.join(' ')}</p>`); para = []; } }
    function flushList() { if (listType) { out.push(`</${listType}>`); listType = null; } }
    for (const line of lines) {
      const t = line.trim();
      if (!t) { flushPara(); flushList(); continue; }
      const cm = t.match(/^\x00CB(\d+)\x00$/);
      if (cm) { flushPara(); flushList(); out.push(codeBlocks[+cm[1]]); continue; }
      const hm = t.match(/^(#{1,4}) (.+)$/);
      if (hm) { flushPara(); flushList(); out.push(`<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>`); continue; }
      if (t === '---' || t === '***' || t === '___') { flushPara(); flushList(); out.push('<hr>'); continue; }
      const ul = t.match(/^[-*] (.+)$/);
      if (ul) { flushPara(); if (listType !== 'ul') { flushList(); out.push('<ul>'); listType = 'ul'; } out.push(`<li>${inline(ul[1])}</li>`); continue; }
      const ol = t.match(/^\d+\. (.+)$/);
      if (ol) { flushPara(); if (listType !== 'ol') { flushList(); out.push('<ol>'); listType = 'ol'; } out.push(`<li>${inline(ol[1])}</li>`); continue; }
      flushList();
      para.push(inline(t));
    }
    flushPara(); flushList();
    return out.join('\n');
  }

  // ===== CLAUDE CODE INTEGRATION =====
  const cc = {
    getServer: () => localStorage.getItem('cc_server_url') || '',
    getToken: () => localStorage.getItem('cc_access_token') || '',
    getRefresh: () => localStorage.getItem('cc_refresh_token') || '',
    getProjectMap() { try { return JSON.parse(localStorage.getItem('cc_project_map') || '{}'); } catch { return {}; } },
    setProjectMap(map) { localStorage.setItem('cc_project_map', JSON.stringify(map)); },
    isConnected() { return !!(this.getServer() && this.getToken()); },

    // In-memory chat state
    chats: {},       // { projectId: [{ role, content, tools }] }
    streaming: {},   // { projectId: { text, tools, active } }

    // Token refresh with dedup
    _refreshPromise: null,
    async refreshToken() {
      if (this._refreshPromise) return this._refreshPromise;
      this._refreshPromise = (async () => {
        try {
          const res = await fetch(`${this.getServer()}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: this.getRefresh() })
          });
          if (!res.ok) throw new Error('Session expired');
          const data = await res.json();
          localStorage.setItem('cc_access_token', data.token);
          if (data.refreshToken) localStorage.setItem('cc_refresh_token', data.refreshToken);
          return data.token;
        } catch (e) {
          localStorage.removeItem('cc_access_token');
          localStorage.removeItem('cc_refresh_token');
          throw e;
        } finally { this._refreshPromise = null; }
      })();
      return this._refreshPromise;
    },

    // Authenticated fetch to CC server
    async api(path, opts = {}) {
      const server = this.getServer();
      if (!server) throw new Error('Not connected');
      opts.headers = { ...opts.headers };
      opts.headers['Authorization'] = `Bearer ${this.getToken()}`;
      if (opts.body && !opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
      let res = await fetch(`${server}${path}`, opts);
      if (res.status === 401) {
        const token = await this.refreshToken();
        opts.headers['Authorization'] = `Bearer ${token}`;
        res = await fetch(`${server}${path}`, opts);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      return data;
    },

    // Pairing flow
    async pair(serverUrl, code) {
      const url = serverUrl.replace(/\/+$/, '');
      const res = await fetch(`${url}/api/auth/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairingCode: code, deviceName: 'Kaymen Admin Panel' })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Pairing failed');
      }
      const data = await res.json();
      localStorage.setItem('cc_server_url', url);
      localStorage.setItem('cc_access_token', data.token);
      localStorage.setItem('cc_refresh_token', data.refreshToken);
      return data;
    },

    disconnect() {
      this.disconnectWs();
      localStorage.removeItem('cc_server_url');
      localStorage.removeItem('cc_access_token');
      localStorage.removeItem('cc_refresh_token');
      localStorage.removeItem('cc_project_map');
      this.chats = {};
      this.streaming = {};
    },

    // WebSocket
    ws: null,
    _wsListeners: new Map(),
    _wsReconnect: null,
    _wsHasConnected: false,

    connectWs() {
      if (this.ws && this.ws.readyState <= 1) return;
      const server = this.getServer();
      if (!server || !this.getToken()) return;
      try { this.ws = new WebSocket(server.replace(/^http/, 'ws') + '/ws'); } catch { return; }
      this.ws.onopen = async () => {
        // Refresh token if needed before authenticating
        let token = this.getToken();
        try {
          const test = await fetch(`${server}/api/claude/status/test`, { headers: { 'Authorization': `Bearer ${token}` } });
          if (test.status === 401) token = await this.refreshToken();
        } catch {}
        this.ws.send(JSON.stringify({ type: 'auth', token }));
        // Emit reconnect event so listeners can reload state
        if (this._wsHasConnected) {
          const cbs = this._wsListeners.get('__ws_reconnected');
          if (cbs) cbs.forEach(cb => cb({}));
        }
        this._wsHasConnected = true;
      };
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const cbs = this._wsListeners.get(msg.type);
          if (cbs) cbs.forEach(cb => cb(msg));
        } catch {}
      };
      this.ws.onclose = () => {
        this.ws = null;
        this._wsReconnect = setTimeout(() => this.connectWs(), 3000);
      };
      this.ws.onerror = () => {};
    },

    disconnectWs() {
      if (this._wsReconnect) { clearTimeout(this._wsReconnect); this._wsReconnect = null; }
      if (this.ws) { this.ws.close(); this.ws = null; }
      this._wsListeners.clear();
    },

    on(event, cb) {
      if (!this._wsListeners.has(event)) this._wsListeners.set(event, new Set());
      this._wsListeners.get(event).add(cb);
      return cb;
    },
    off(event, cb) { const s = this._wsListeners.get(event); if (s) s.delete(cb); },

    // Get CC key — uses folder name to match Desktop/PWA convention
    keyFor(projectId) {
      const map = this.getProjectMap();
      const path = map[projectId];
      if (!path) return null;
      return path.replace(/[/\\]+$/, '').split(/[/\\]/).pop() || null;
    },

    // Load chat history from CC server (shared with Desktop/PWA)
    async loadHistory(projectId) {
      const key = this.keyFor(projectId);
      if (!key) return;
      try {
        const data = await this.api(`/api/history/${encodeURIComponent(key)}`);
        const all = (data.messages || []).map(m => ({
          role: m.role, content: m.content, tools: m.tools || [], timestamp: m.timestamp
        }));
        this.chats[projectId] = all.slice(-20);
      } catch {
        if (!this.chats[projectId]) this.chats[projectId] = [];
      }
    },

    // Save a message to CC server history (so Desktop/PWA can see it)
    _lastHistorySave: 0,
    async saveMessage(projectId, message) {
      const key = this.keyFor(projectId);
      if (!key) return;
      this._lastHistorySave = Date.now();
      try {
        await this.api(`/api/history/${encodeURIComponent(key)}`, {
          method: 'POST',
          body: JSON.stringify({ message, general: false })
        });
      } catch { /* ignore */ }
    },

    // Send message to Claude via CC server
    async send(projectId, message, projectPath) {
      const key = this.keyFor(projectId);
      if (!key) throw new Error('No folder mapped');
      const body = { key, message, projectPath };
      return this.api('/api/claude/send', { method: 'POST', body: JSON.stringify(body) });
    },

    async stop(projectId) {
      const key = this.keyFor(projectId);
      if (!key) return;
      return this.api('/api/claude/stop', { method: 'POST', body: JSON.stringify({ key }) });
    },

    async reset(projectId) {
      const key = this.keyFor(projectId);
      if (!key) return;
      return this.api('/api/claude/reset', { method: 'POST', body: JSON.stringify({ key }) });
    },

    async isRunning(projectId) {
      const key = this.keyFor(projectId);
      if (!key) return false;
      const res = await this.api(`/api/claude/status/${encodeURIComponent(key)}`);
      return res.running;
    },

    async listProjects() {
      return this.api('/api/projects');
    }
  };

  // ===== CHART HELPERS =====
  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#a1a1aa', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#a1a1aa', font: { size: 11 } },
        beginAtZero: true
      }
    }
  };

  let charts = {};
  function destroyCharts() {
    Object.values(charts).forEach(c => c.destroy());
    charts = {};
  }

  // ===== RENDER: LOGIN =====
  async function renderLogin() {
    // Check if Google OAuth is enabled
    let googleEnabled = false;
    try {
      const oauthStatus = await fetch('/api/auth/oauth/status').then(r => r.json());
      googleEnabled = oauthStatus.data?.google_enabled;
    } catch {}

    // Check for OAuth error in URL hash
    const hashParams = new URLSearchParams(window.location.hash.replace('#/login', '').replace('?', ''));
    const oauthError = hashParams.get('error');
    const errorMessages = {
      oauth_denied: 'Google sign-in was cancelled',
      invalid_state: 'Invalid OAuth state. Please try again',
      use_portal: 'Client accounts should use the client portal',
      server_error: 'Server error during sign-in. Please try again'
    };

    app.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo"><span class="accent">{</span> kaymen.dev <span class="accent">}</span></div>
          <h2 class="login-title">Admin Login</h2>
          <div id="loginMsg">${oauthError ? `<div class="alert alert-error">${escapeHtml(errorMessages[oauthError] || 'Sign-in failed')}</div>` : ''}</div>
          ${googleEnabled ? `
            <a href="/api/auth/google?target=admin" class="btn btn-google" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px;margin-bottom:16px;background:#fff;color:#333;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-weight:500;text-decoration:none;cursor:pointer;transition:background 0.2s">
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Sign in with Google
            </a>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;color:var(--text-dim);font-size:13px"><div style="flex:1;height:1px;background:var(--border)"></div>or<div style="flex:1;height:1px;background:var(--border)"></div></div>
          ` : ''}
          <form id="loginForm">
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="loginEmail" placeholder="you@example.com" required autocomplete="email">
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="loginPassword" placeholder="Enter password" required autocomplete="current-password">
            </div>
            <button type="submit" class="btn btn-primary">Sign In</button>
          </form>
          <div style="text-align:center;margin-top:16px">
            <a href="#" id="forgotLink" style="color:var(--text-secondary);font-size:13px;text-decoration:underline">Forgot password?</a>
          </div>
          <div id="resetSection" style="display:none;margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Enter your email to reset your password. The new password will appear in the server logs.</p>
            <form id="resetForm" style="display:flex;gap:8px">
              <input type="email" id="resetEmail" placeholder="Your admin email" required style="flex:1;padding:10px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:14px">
              <button type="submit" class="btn btn-secondary" style="width:auto;white-space:nowrap">Reset</button>
            </form>
            <div id="resetMsg" style="margin-top:10px"></div>
          </div>
        </div>
      </div>
    `;
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', e.target);
      btn.textContent = 'Signing in...';
      btn.disabled = true;
      try {
        await login($('#loginEmail').value, $('#loginPassword').value);
      } catch (err) {
        $('#loginMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        btn.textContent = 'Sign In';
        btn.disabled = false;
      }
    });
    $('#forgotLink').addEventListener('click', (e) => {
      e.preventDefault();
      const section = $('#resetSection');
      section.style.display = section.style.display === 'none' ? 'block' : 'none';
    });
    $('#resetForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', e.target);
      btn.textContent = 'Resetting...';
      btn.disabled = true;
      try {
        const res = await api('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email: $('#resetEmail').value })
        });
        $('#resetMsg').innerHTML = `<div class="alert alert-success">${escapeHtml(res.data.message)}</div>`;
      } catch (err) {
        $('#resetMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      }
      btn.textContent = 'Reset';
      btn.disabled = false;
    });
  }

  // ===== RENDER: CHANGE PASSWORD =====
  function renderChangePassword() {
    app.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo"><span class="accent">{</span> kaymen.dev <span class="accent">}</span></div>
          <h2 class="login-title">Change Password</h2>
          <div class="alert alert-warning">You must change your password before continuing.</div>
          <div id="cpError"></div>
          <form id="cpForm">
            <div class="form-group">
              <label>Current Password</label>
              <input type="password" id="cpCurrent" required autocomplete="current-password">
            </div>
            <div class="form-group">
              <label>New Password</label>
              <input type="password" id="cpNew" placeholder="Min 8 characters" required minlength="8" autocomplete="new-password">
            </div>
            <div class="form-group">
              <label>Confirm New Password</label>
              <input type="password" id="cpConfirm" required minlength="8" autocomplete="new-password">
            </div>
            <button type="submit" class="btn btn-primary">Change Password</button>
          </form>
        </div>
      </div>
    `;
    $('#cpForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPass = $('#cpNew').value;
      if (newPass !== $('#cpConfirm').value) {
        $('#cpError').innerHTML = `<div class="alert alert-error">Passwords don't match</div>`;
        return;
      }
      const btn = $('button[type="submit"]', e.target);
      btn.textContent = 'Changing...';
      btn.disabled = true;
      try {
        await changePassword($('#cpCurrent').value, newPass);
      } catch (err) {
        $('#cpError').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        btn.textContent = 'Change Password';
        btn.disabled = false;
      }
    });
  }

  // ===== RENDER: LAYOUT =====
  function renderLayout(content) {
    const navItems = [
      { id: 'dashboard', icon: '\u25A3', label: 'Dashboard' },
      { id: 'projects', icon: '\u{1F4CB}', label: 'Projects' },
      { id: 'clients', icon: '\u{1F465}', label: 'Clients' },
      { id: 'security', icon: '\u26A0', label: 'Security' },
      { id: 'analytics', icon: '\u25CE', label: 'Analytics' },
      { id: 'settings', icon: '\u2699', label: 'Settings' },
    ];
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const bottomNavItems = navItems.filter(n => n.id !== 'settings');
    app.innerHTML = `
      <div class="mobile-top-bar" id="mobileTopBar">
        <button class="mtb-btn" id="mtbTheme" title="Toggle theme">${isLight ? '\u2600' : '\u{1F319}'}</button>
        <a href="#/settings" class="mtb-btn ${state.page === 'settings' ? 'active' : ''}" title="Settings">\u2699</a>
        <button class="mtb-btn" id="mtbLogout" title="Logout">\u{1F6AA}</button>
      </div>
      <div class="layout">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-logo"><span class="accent">{</span> kaymen.dev <span class="accent">}</span></div>
          <div class="sidebar-label">Admin Panel</div>
          <ul class="sidebar-nav">
            ${navItems.map(n => `
              <li><a href="#/${n.id}" class="${state.page === n.id ? 'active' : ''}" data-page="${n.id}">
                <span class="icon">${n.icon}</span> ${n.label}
              </a></li>
            `).join('')}
          </ul>
          <div class="sidebar-bottom">
            <div class="sidebar-user">${escapeHtml(state.user?.email)}</div>
            <div style="display:flex;gap:6px;margin-bottom:8px">
              <button class="theme-toggle-btn" id="themeToggleAdmin" style="flex:1;justify-content:center">${isLight ? '\u2600 Light' : '\u{1F319} Dark'}</button>
            </div>
            <button class="btn btn-secondary btn-sm" id="logoutBtn" style="width:100%">Logout</button>
          </div>
        </aside>
        <main class="main" id="mainContent">${content}</main>
      </div>
      <nav class="bottom-nav" id="bottomNav">
        ${bottomNavItems.map(n => `
          <a href="#/${n.id}" class="bottom-nav-item ${state.page === n.id ? 'active' : ''}" data-page="${n.id}">
            <span class="bottom-nav-icon">${n.icon}</span>
            <span class="bottom-nav-label">${n.label}</span>
          </a>
        `).join('')}
      </nav>
    `;
    // Nav handlers (sidebar + bottom nav)
    $$('.sidebar-nav a').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = `/${a.dataset.page}`;
    }));
    $$('.bottom-nav-item').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = `/${a.dataset.page}`;
    }));
    $('#logoutBtn').addEventListener('click', logout);
    const mtbLogout = $('#mtbLogout');
    if (mtbLogout) mtbLogout.addEventListener('click', logout);
    function applyTheme(goLight) {
      if (goLight) { document.documentElement.setAttribute('data-theme', 'light'); localStorage.setItem('admin_theme', 'light'); }
      else { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('admin_theme', 'dark'); }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = goLight ? '#ffffff' : '#09090b';
      render();
    }
    const mtbTheme = $('#mtbTheme');
    if (mtbTheme) mtbTheme.addEventListener('click', () => {
      applyTheme(document.documentElement.getAttribute('data-theme') !== 'light');
    });
    const themeBtn = $('#themeToggleAdmin');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      applyTheme(document.documentElement.getAttribute('data-theme') !== 'light');
    });
  }

  // ===== RENDER: DASHBOARD =====
  async function renderDashboard() {
    renderLayout(`
      <div class="page-header"><h1>Dashboard</h1><p>Command center</p></div>
      <div class="loading"><div class="spinner"></div> Loading data...</div>
    `);

    try {
      const res = await api('/admin/dashboard');
      const d = res.data;

      const statusColors = { planning: 'badge-gray', proposed: 'badge-yellow', approved: 'badge-blue', in_progress: 'badge-blue', review: 'badge-yellow', completed: 'badge-green', maintenance: 'badge-green', archived: 'badge-gray' };

      // Build needs-attention items
      const attentionItems = [];
      d.urgentTickets.forEach(t => attentionItems.push({
        icon: t.priority === 'urgent' ? '&#9888;' : '&#9679;',
        color: 'var(--danger)',
        text: `<strong>#${t.ticket_number}</strong> ${escapeHtml(t.title)}`,
        sub: `${escapeHtml(t.project_name)} &middot; ${t.priority} &middot; ${timeAgo(t.created_at)}`,
        href: `#/tickets/${t.id}`
      }));
      d.overdueMilestones.forEach(m => attentionItems.push({
        icon: '&#9200;',
        color: 'var(--warning)',
        text: `<strong>Overdue:</strong> ${escapeHtml(m.title)}`,
        sub: `${escapeHtml(m.project_name)} &middot; due ${escapeHtml(m.target_date)}`,
        href: `#/projects/${m.project_id}`
      }));
      d.waitingApprovals.forEach(p => attentionItems.push({
        icon: '&#9993;',
        color: 'var(--info)',
        text: `<strong>Awaiting approval:</strong> ${escapeHtml(p.name)}`,
        sub: `${escapeHtml(p.org_name)} &middot; proposed ${timeAgo(p.updated_at)}`,
        href: `#/projects/${p.id}`
      }));
      const newContacts = d.recentContacts.filter(c => !c.dismissed);

      $('#mainContent').innerHTML = `
        <div class="page-header"><h1>Dashboard</h1><p>Command center</p></div>

        <!-- Top metrics -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Active Projects</div>
            <div class="metric-value accent">${d.activeProjects}</div>
            <div class="metric-sub">in progress or review</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Open Tickets</div>
            <div class="metric-value${d.openTickets > 0 ? ' warning' : ''}">${d.openTickets}</div>
            <div class="metric-sub">need resolution</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Pending Approvals</div>
            <div class="metric-value${d.pendingApprovals > 0 ? ' info' : ''}">${d.pendingApprovals}</div>
            <div class="metric-sub">plans waiting on client</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">New Leads</div>
            <div class="metric-value${d.unreadContacts > 0 ? ' accent' : ''}">${d.unreadContacts}</div>
            <div class="metric-sub">contact submissions</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Visitors Today</div>
            <div class="metric-value">${d.visitors.today}</div>
            <div class="metric-sub">${d.activeNow} active now</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">This Month</div>
            <div class="metric-value">${d.visitors.month}</div>
            <div class="metric-sub">avg ${d.avgTimeOnSite}s per session</div>
          </div>
        </div>

        <!-- Needs Attention -->
        ${attentionItems.length > 0 ? `
        <div class="card" style="border-color:var(--warning-dim)">
          <div class="card-header">
            <span class="card-title" style="color:var(--warning)">Needs Attention</span>
            <span class="badge badge-yellow">${attentionItems.length}</span>
          </div>
          <div style="max-height:280px;overflow-y:auto">
            ${attentionItems.map(item => `
              <a href="${item.href}" style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--surface-3);text-decoration:none;cursor:pointer" class="dash-attention-row">
                <span style="color:${item.color};font-size:16px;line-height:1;flex-shrink:0;margin-top:2px">${item.icon}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;color:var(--text)">${item.text}</div>
                  <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${item.sub}</div>
                </div>
              </a>
            `).join('')}
          </div>
        </div>
        ` : `
        <div class="card" style="border-color:var(--success-dim)">
          <div style="padding:16px;text-align:center;color:var(--text-dim);font-size:13px">
            All clear — no urgent items need your attention.
          </div>
        </div>
        `}

        <div class="grid-2">
          <!-- Active Projects -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Active Projects</span>
              <a href="#/projects" style="font-size:12px;color:var(--accent);text-decoration:none">View all</a>
            </div>
            ${d.projects.length === 0 ? '<p style="color:var(--text-dim);font-size:13px;padding:8px 0">No active projects.</p>' : `
              <div style="max-height:320px;overflow-y:auto">
                ${d.projects.map(p => `
                  <a href="#/projects/${p.id}" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--surface-3);text-decoration:none;cursor:pointer" class="dash-attention-row">
                    <div style="flex:1;min-width:0">
                      <div style="font-size:13px;font-weight:600;color:var(--text)">${escapeHtml(p.name)}</div>
                      <div style="font-size:11px;color:var(--text-dim)">${escapeHtml(p.org_name)}</div>
                    </div>
                    <div style="width:80px">
                      <div style="height:4px;background:var(--surface-3);border-radius:2px;overflow:hidden">
                        <div style="height:100%;width:${p.progress_percent}%;background:var(--accent);border-radius:2px"></div>
                      </div>
                      <div style="font-size:10px;color:var(--text-dim);text-align:right;margin-top:2px">${p.progress_percent}%</div>
                    </div>
                    <span class="badge ${statusColors[p.status] || 'badge-gray'}" style="font-size:10px;white-space:nowrap">${p.status.replace(/_/g, ' ')}</span>
                    ${p.open_tickets > 0 ? `<span class="badge badge-yellow" style="font-size:10px">${p.open_tickets} tickets</span>` : ''}
                  </a>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Recent Activity -->
          <div class="card">
            <div class="card-header"><span class="card-title">Recent Activity</span></div>
            ${d.recentActivity.length === 0 ? '<p style="color:var(--text-dim);font-size:13px;padding:8px 0">No activity yet.</p>' : `
              <div style="max-height:320px;overflow-y:auto">
                ${d.recentActivity.map(a => `
                  <div style="padding:8px 0;border-bottom:1px solid var(--surface-3);font-size:13px">
                    <div style="color:var(--text-secondary)">
                      <strong style="color:var(--text)">${escapeHtml(a.user_name)}</strong> ${escapeHtml(a.action.replace(/_/g, ' '))}
                    </div>
                    <div style="font-size:11px;color:var(--text-dim);margin-top:2px">
                      ${a.project_name ? `<a href="#/projects/${a.project_id}" style="color:var(--accent);text-decoration:none">${escapeHtml(a.project_name)}</a> &middot; ` : ''}${timeAgo(a.created_at)}
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <div class="grid-2">
          <!-- Recent Visitors -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Recent Visitors</span>
              <a href="#/analytics" style="font-size:12px;color:var(--accent);text-decoration:none">Analytics</a>
            </div>
            <div class="table-wrap">
              <table class="mobile-cards">
                <thead><tr><th>IP</th><th>Location</th><th>Device</th><th>When</th></tr></thead>
                <tbody>
                  ${d.recentVisitors.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--text-dim)">No visitors yet</td></tr>' :
                    d.recentVisitors.map(v => `<tr>
                      <td data-label="IP"><span class="mono">${escapeHtml(v.ip)}</span> ${v.is_bot ? '<span class="badge badge-yellow">bot</span>' : ''}</td>
                      <td data-label="Location">${escapeHtml(v.country ? `${v.city || ''}, ${v.country}` : 'Unknown')}</td>
                      <td data-label="Device">${escapeHtml(v.device_type)}</td>
                      <td data-label="When">${timeAgo(v.created_at)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Contact Submissions -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Contact Submissions</span>
              ${d.unreadContacts > 0 ? `<span class="badge badge-green">${d.unreadContacts} new</span>` : ''}
            </div>
            ${d.recentContacts.length === 0 ? '<p style="color:var(--text-dim);font-size:13px;padding:8px 0">No submissions yet.</p>' : `
              <div style="max-height:400px;overflow-y:auto">
                ${d.recentContacts.map(c => `
                  <div style="padding:10px 0;border-bottom:1px solid var(--surface-3)" data-contact-id="${c.id}">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;flex-wrap:wrap;gap:4px">
                      <div style="font-size:13px;min-width:0">
                        <strong style="color:var(--text)">${escapeHtml(c.name)}</strong>
                        <span style="color:var(--text-dim)">${escapeHtml(c.email)}</span>
                        ${c.project_name ? `<span class="badge badge-blue" style="font-size:10px;margin-left:4px">${escapeHtml(c.project_name)}</span>` : ''}
                      </div>
                      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                        <span style="font-size:11px;color:var(--text-dim)">${timeAgo(c.created_at)}</span>
                        ${c.converted_at
                          ? '<span class="badge badge-green" style="font-size:10px">Converted</span>'
                          : `<button class="btn btn-primary btn-sm contact-convert" data-id="${c.id}" data-name="${escapeHtml(c.name).replace(/"/g, '&quot;')}" data-email="${escapeHtml(c.email).replace(/"/g, '&quot;')}" data-project="${escapeHtml(c.project_name || '').replace(/"/g, '&quot;')}" style="font-size:10px;padding:2px 8px">\u2192 Client</button>
                            <button class="btn btn-secondary btn-sm contact-dismiss" data-id="${c.id}" style="font-size:10px;padding:2px 8px">Dismiss</button>`
                        }
                      </div>
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary);line-height:1.4">${escapeHtml(truncate(c.message, 120))}</div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      `;

      // Dismiss contact handler
      $$('.contact-dismiss').forEach(btn => btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await api(`/admin/contacts/${btn.dataset.id}/dismiss`, { method: 'POST' });
          const row = btn.closest('[data-contact-id]');
          if (row) row.style.opacity = '0.4';
          btn.disabled = true;
          btn.textContent = 'Dismissed';
        } catch {}
      }));

      // Convert contact to client
      $$('.contact-convert').forEach(btn => btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const defaultProject = btn.dataset.project || '';
        const projectName = prompt('Project name:', defaultProject || 'New Project');
        if (projectName === null) return;
        btn.disabled = true;
        btn.textContent = 'Converting...';
        try {
          const res = await api(`/admin/contacts/${btn.dataset.id}/convert`, {
            method: 'POST',
            body: JSON.stringify({ project_name: projectName })
          });
          const row = btn.closest('[data-contact-id]');
          const btns = row.querySelectorAll('.contact-convert, .contact-dismiss');
          btns.forEach(b => b.remove());
          const badge = document.createElement('span');
          badge.className = 'badge badge-green';
          badge.style.fontSize = '10px';
          badge.textContent = 'Converted';
          row.querySelector('div').lastElementChild.appendChild(badge);
          alert(res.data.message + (res.data.invite_url ? '\n\nInvite: ' + res.data.invite_url : ''));
        } catch (err) {
          alert('Failed: ' + err.message);
          btn.disabled = false;
          btn.textContent = '\u2192 Client';
        }
      }));

    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">Failed to load dashboard: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: SECURITY =====
  async function renderSecurity() {
    renderLayout(`
      <div class="page-header">
        <h1>Security</h1>
        <p>Monitor visitor activity and suspicious behavior</p>
      </div>
      <div class="loading"><div class="spinner"></div> Loading security data...</div>
    `);

    try {
      const res = await api('/admin/security?period=7');
      const d = res.data;

      const suspiciousHigh = d.suspicious.filter(s => s.severity === 'high').length;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Security</h1>
          <p>Monitor visitor activity and suspicious behavior</p>
        </div>
        ${suspiciousHigh > 0 ? `<div class="alert alert-error">${suspiciousHigh} high severity alert(s) in the last 7 days</div>` : ''}
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Human Visitors</div>
            <div class="metric-value accent">${d.humanCount}</div>
            <div class="metric-sub">last 7 days</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Bot Visits</div>
            <div class="metric-value warning">${d.botCount}</div>
            <div class="metric-sub">last 7 days</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Suspicious Events</div>
            <div class="metric-value danger">${d.suspicious.length}</div>
            <div class="metric-sub">last 7 days</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Unique IPs</div>
            <div class="metric-value">${d.topIPs.length}</div>
            <div class="metric-sub">last 7 days</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Suspicious Activity</span>
          </div>
          <div class="table-wrap">
            <table class="mobile-cards">
              <thead><tr><th>Severity</th><th>IP</th><th>Reason</th><th>Details</th><th>When</th></tr></thead>
              <tbody>
                ${d.suspicious.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--text-dim)">No suspicious activity detected</td></tr>' :
                  d.suspicious.slice(0, 50).map(s => `<tr>
                    <td data-label="Severity">${severityBadge(s.severity)}</td>
                    <td data-label="IP"><span class="mono">${escapeHtml(s.ip)}</span></td>
                    <td data-label="Reason">${escapeHtml(s.reason)}</td>
                    <td data-label="Details">${escapeHtml(truncate(s.details, 40))}</td>
                    <td data-label="When">${timeAgo(s.created_at)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Top IPs</span></div>
            <div class="table-wrap">
              <table class="mobile-cards">
                <thead><tr><th>IP</th><th>Location</th><th>Visits</th><th>Type</th></tr></thead>
                <tbody>
                  ${d.topIPs.map(ip => `<tr>
                    <td data-label="IP"><span class="mono">${escapeHtml(ip.ip)}</span></td>
                    <td data-label="Location">${escapeHtml(ip.country ? `${ip.city || ''}, ${ip.country}` : 'Unknown')}</td>
                    <td data-label="Visits"><strong>${ip.count}</strong></td>
                    <td data-label="Type">${ip.is_bot ? '<span class="badge badge-yellow">bot</span>' : '<span class="badge badge-green">human</span>'}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Flagged IPs</span></div>
            <div class="table-wrap">
              <table class="mobile-cards">
                <thead><tr><th>IP</th><th>Incidents</th><th>Max Severity</th></tr></thead>
                <tbody>
                  ${d.suspiciousIPs.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:var(--text-dim)">No flagged IPs</td></tr>' :
                    d.suspiciousIPs.map(ip => `<tr>
                      <td data-label="IP"><span class="mono">${escapeHtml(ip.ip)}</span></td>
                      <td data-label="Incidents"><strong>${ip.incidents}</strong></td>
                      <td data-label="Severity">${severityBadge(ip.max_severity)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Full Visitor Log</span></div>
          <div class="table-wrap">
            <table class="mobile-cards">
              <thead><tr><th>IP</th><th>Location</th><th>ISP</th><th>Browser / OS</th><th>Referrer</th><th>Type</th><th>When</th></tr></thead>
              <tbody>
                ${d.visitorLog.slice(0, 100).map(v => `<tr>
                  <td data-label="IP"><span class="mono">${escapeHtml(v.ip)}</span></td>
                  <td data-label="Location">${escapeHtml(v.country ? `${v.city || ''}, ${v.country}` : 'Unknown')}</td>
                  <td data-label="ISP">${escapeHtml(truncate(v.isp, 25) || '-')}</td>
                  <td data-label="Browser/OS">${escapeHtml(truncate(v.browser, 15))} / ${escapeHtml(truncate(v.os, 15))}</td>
                  <td data-label="Referrer">${escapeHtml(truncate(v.referrer, 30) || 'Direct')}</td>
                  <td data-label="Type">${v.is_bot ? '<span class="badge badge-yellow">bot</span>' : '<span class="badge badge-green">human</span>'}</td>
                  <td data-label="When">${timeAgo(v.created_at)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">Failed to load security data: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: ANALYTICS =====
  async function renderAnalytics() {
    renderLayout(`
      <div class="page-header">
        <h1>Analytics</h1>
        <p>Understand how people engage with your site</p>
      </div>
      <div class="loading"><div class="spinner"></div> Loading analytics...</div>
    `);

    try {
      const res = await api('/admin/analytics?period=30');
      const d = res.data;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Analytics</h1>
          <p>Understand how people engage with your site</p>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Avg Scroll Depth</div>
            <div class="metric-value accent">${d.avgScrollDepth}%</div>
            <div class="metric-sub">how far people scroll</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Visitors — Last 30 Days</span></div>
          <div class="chart-container"><canvas id="visitorsChart"></canvas></div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Section Engagement</span></div>
            <div class="chart-container" style="height:250px"><canvas id="sectionsChart"></canvas></div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Visits by Hour</span></div>
            <div class="chart-container" style="height:250px"><canvas id="hourlyChart"></canvas></div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Click Tracking</span></div>
            <div class="table-wrap">
              <table class="mobile-cards">
                <thead><tr><th>Element</th><th>Clicks</th></tr></thead>
                <tbody>
                  ${d.clickEvents.length === 0 ? '<tr><td colspan="2" style="text-align:center;color:var(--text-dim)">No click data yet</td></tr>' :
                    d.clickEvents.map(c => `<tr>
                      <td data-label="Element">${escapeHtml(c.target)}</td>
                      <td data-label="Clicks"><strong>${c.clicks}</strong></td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Referrer Sources</span></div>
            <div class="table-wrap">
              <table class="mobile-cards">
                <thead><tr><th>Source</th><th>Visits</th></tr></thead>
                <tbody>
                  ${d.referrers.length === 0 ? '<tr><td colspan="2" style="text-align:center;color:var(--text-dim)">No referrer data yet</td></tr>' :
                    d.referrers.map(r => `<tr>
                      <td data-label="Source">${escapeHtml(truncate(r.source, 50))}</td>
                      <td data-label="Visits"><strong>${r.count}</strong></td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Devices</span></div>
            <div class="chart-container" style="height:220px"><canvas id="devicesChart"></canvas></div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Browsers</span></div>
            <div class="table-wrap">
              <table class="mobile-cards">
                <thead><tr><th>Browser</th><th>Visits</th></tr></thead>
                <tbody>
                  ${d.browsers.map(b => `<tr>
                    <td data-label="Browser">${escapeHtml(b.browser)}</td>
                    <td data-label="Visits"><strong>${b.count}</strong></td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Draw charts
      destroyCharts();

      // Visitors line chart
      if (d.dailyVisitors.length > 0) {
        charts.visitors = new Chart($('#visitorsChart'), {
          type: 'line',
          data: {
            labels: d.dailyVisitors.map(v => v.date.slice(5)),
            datasets: [{
              data: d.dailyVisitors.map(v => v.count),
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59,130,246,0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 3,
              pointBackgroundColor: '#3b82f6'
            }]
          },
          options: chartDefaults
        });
      }

      // Section engagement bar chart
      if (d.sectionEngagement.length > 0) {
        charts.sections = new Chart($('#sectionsChart'), {
          type: 'bar',
          data: {
            labels: d.sectionEngagement.map(s => s.target || 'unknown'),
            datasets: [{
              data: d.sectionEngagement.map(s => s.views),
              backgroundColor: 'rgba(59,130,246,0.3)',
              borderColor: '#3b82f6',
              borderWidth: 1
            }]
          },
          options: { ...chartDefaults, indexAxis: 'y' }
        });
      }

      // Hourly distribution
      if (d.hourlyDistribution.length > 0) {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const hourMap = Object.fromEntries(d.hourlyDistribution.map(h => [h.hour, h.count]));
        charts.hourly = new Chart($('#hourlyChart'), {
          type: 'bar',
          data: {
            labels: hours.map(h => `${h}:00`),
            datasets: [{
              data: hours.map(h => hourMap[h] || 0),
              backgroundColor: 'rgba(59,130,246,0.3)',
              borderColor: '#3b82f6',
              borderWidth: 1
            }]
          },
          options: chartDefaults
        });
      }

      // Devices doughnut
      if (d.devices.length > 0) {
        const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e'];
        charts.devices = new Chart($('#devicesChart'), {
          type: 'doughnut',
          data: {
            labels: d.devices.map(d => d.device_type),
            datasets: [{
              data: d.devices.map(d => d.count),
              backgroundColor: colors.slice(0, d.devices.length),
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right', labels: { color: '#a1a1aa', font: { size: 12 } } }
            }
          }
        });
      }
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">Failed to load analytics: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: SETTINGS =====
  async function renderSettings() {
    renderLayout(`
      <div class="page-header">
        <h1>Settings</h1>
        <p>Manage your account and other administrators</p>
      </div>
      <div class="loading"><div class="spinner"></div> Loading...</div>
    `);

    try {
      const [usersRes, oauthRes, smtpRes, devKeysRes] = await Promise.all([
        api('/auth/users'),
        api('/auth/oauth/config'),
        api('/auth/smtp/config'),
        api('/admin/dev-keys')
      ]);
      const users = usersRes.data.users;
      const oauth = oauthRes.data;
      const smtp = smtpRes.data;
      const devKeys = devKeysRes.data.keys;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Settings</h1>
          <p>Manage your account, administrators, and integrations</p>
        </div>

        <div class="settings-section-label" style="margin-top:0">Account & Security</div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Change Password</span></div>
            <div id="cpMsg"></div>
            <form id="settingsCpForm">
              <div class="form-group">
                <label>Current Password</label>
                <input type="password" id="sCurrent" required autocomplete="current-password">
              </div>
              <div class="form-group">
                <label>New Password</label>
                <input type="password" id="sNew" placeholder="Min 8 characters" required minlength="8" autocomplete="new-password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" id="sConfirm" required minlength="8" autocomplete="new-password">
              </div>
              <button type="submit" class="btn btn-primary" style="width:auto">Update Password</button>
            </form>
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title">Google OAuth</span></div>
            <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">
              Allow clients (and admins) to sign in with their Google account. Users must be created first — Google login only works for existing accounts.
            </p>
            <div id="oauthMsg"></div>
            <form id="oauthForm">
              <div class="form-group">
                <label>Google Client ID</label>
                <input type="text" id="oauthClientId" value="${escapeHtml(oauth.google_client_id)}" placeholder="xxxx.apps.googleusercontent.com" style="font-family:var(--mono);font-size:12px">
              </div>
              <div class="form-group">
                <label>Client Secret ${oauth.google_client_secret_set ? '<span class="badge badge-green" style="margin-left:6px;font-size:10px">set</span>' : '<span class="badge badge-gray" style="margin-left:6px;font-size:10px">not set</span>'}</label>
                <input type="password" id="oauthClientSecret" placeholder="${oauth.google_client_secret_set ? 'Leave blank to keep current' : 'Enter client secret'}" style="font-family:var(--mono);font-size:12px">
              </div>
              <div style="display:flex;align-items:center;gap:16px">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
                  <input type="checkbox" id="oauthEnabled" ${oauth.google_oauth_enabled ? 'checked' : ''} style="width:auto">
                  Enable Google Sign-In
                </label>
                <button type="submit" class="btn btn-primary" style="width:auto">Save OAuth Settings</button>
              </div>
            </form>
            ${oauth.google_oauth_enabled ? '<div style="margin-top:12px;padding:12px;background:var(--surface-2);border-radius:var(--radius);font-size:12px;color:var(--text-dim)"><strong>Authorized redirect URI</strong> (add this in Google Cloud Console):<br><code style="color:var(--accent);font-family:var(--mono)">' + window.location.origin + '/api/auth/google/callback</code></div>' : ''}
          </div>
        </div>

        <div class="settings-section-label">Integrations</div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Claude Code</span>
              ${cc.isConnected() ? '<span class="badge badge-green">Connected</span>' : '<span class="badge badge-gray">Not connected</span>'}
            </div>
            <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">
              Connect your Claude Code server to get AI assistance directly from project pages.
            </p>
            <div id="ccMsg"></div>
            ${cc.isConnected() ? `
              <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius)">
                <span style="color:var(--success);font-size:8px">&#11044;</span>
                <code style="font-family:var(--mono);font-size:13px;color:var(--text-secondary);flex:1">${escapeHtml(cc.getServer())}</code>
                <button class="btn btn-danger btn-sm" id="ccDisconnectBtn">Disconnect</button>
              </div>
            ` : `
              <form id="ccPairForm">
                <div class="form-group">
                  <label>Server URL</label>
                  <input type="url" id="ccServerUrl" value="https://code.kaymen.dev" placeholder="https://code.kaymen.dev" style="font-family:var(--mono);font-size:12px">
                </div>
                <div class="form-group">
                  <label>Pairing Code</label>
                  <input type="text" id="ccPairCode" placeholder="000000" maxlength="6" style="font-family:var(--mono);font-size:16px;text-align:center;letter-spacing:4px">
                </div>
                <p style="color:var(--text-dim);font-size:12px;margin-bottom:12px">
                  Open Claude Code Desktop &rarr; the 6-digit pairing code is shown on startup or in the health endpoint.
                </p>
                <button type="submit" class="btn btn-primary" style="width:auto">Connect</button>
              </form>
            `}
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title">Notifications</span></div>
            <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">
              Configure email (SMTP) for invites and ticket alerts, and an optional webhook for ticket events.
            </p>
            <div id="smtpMsg"></div>
            <form id="smtpForm">
              <div class="form-group">
                <label>SMTP Host</label>
                <input type="text" id="smtpHost" value="${escapeHtml(smtp.smtp_host)}" placeholder="smtp.gmail.com" style="font-family:var(--mono);font-size:12px">
              </div>
              <div class="form-group">
                <label>Port</label>
                <input type="text" id="smtpPort" value="${escapeHtml(smtp.smtp_port)}" placeholder="587" style="font-family:var(--mono);font-size:12px;max-width:100px">
              </div>
              <div class="form-group">
                <label>Username</label>
                <input type="text" id="smtpUser" value="${escapeHtml(smtp.smtp_user)}" placeholder="you@gmail.com" style="font-family:var(--mono);font-size:12px">
              </div>
              <div class="form-group">
                <label>Password ${smtp.smtp_pass_set ? '<span class="badge badge-green" style="margin-left:6px;font-size:10px">set</span>' : ''}</label>
                <input type="password" id="smtpPass" placeholder="${smtp.smtp_pass_set ? 'Leave blank to keep' : 'App password'}" style="font-family:var(--mono);font-size:12px">
              </div>
              <div class="form-group">
                <label>From Address</label>
                <input type="text" id="smtpFrom" value="${escapeHtml(smtp.smtp_from)}" placeholder='"kaymen.dev" <hello@kaymen.dev>' style="font-family:var(--mono);font-size:12px">
              </div>
              <div style="display:flex;gap:8px">
                <button type="submit" class="btn btn-primary" style="width:auto">Save SMTP</button>
                <button type="button" class="btn btn-secondary" id="smtpTestBtn" style="width:auto">Send Test Email</button>
              </div>
            </form>
            <div style="border-top:1px solid var(--border);margin-top:20px;padding-top:20px">
              <h4 style="font-size:14px;margin-bottom:8px">Ticket Webhook</h4>
              <p style="color:var(--text-dim);font-size:12px;margin-bottom:12px">POST a JSON payload to this URL when a client creates a ticket. Works with Slack, Discord, or custom endpoints.</p>
              <form id="webhookForm" style="display:flex;gap:8px">
                <input type="url" id="webhookUrl" value="${escapeHtml(smtp.ticket_webhook_url)}" placeholder="https://hooks.slack.com/services/..." style="flex:1;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--mono);font-size:12px">
                <button type="submit" class="btn btn-primary" style="width:auto">Save</button>
              </form>
              <div id="webhookMsg" style="margin-top:8px"></div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Dev Keys</span>
            </div>
            <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">
              HMAC API keys for Claude Code integration. Use these to connect the portal sync service.
            </p>
            <div id="devKeysMsg"></div>
            ${devKeys.length ? `
            <div class="table-wrap" style="margin-bottom:20px">
              <table class="mobile-cards">
                <thead><tr><th>Key ID</th><th>Label</th><th>Status</th><th>Last Used</th><th></th></tr></thead>
                <tbody>
                  ${devKeys.map(k => `<tr>
                    <td data-label="Key ID"><code style="font-family:var(--mono);font-size:12px">${escapeHtml(k.key_id)}</code></td>
                    <td data-label="Label">${escapeHtml(k.label || '-')}</td>
                    <td data-label="Status">${k.revoked ? '<span class="badge badge-red">revoked</span>' : (k.expires_at && new Date(k.expires_at) < new Date() ? '<span class="badge badge-yellow">expired</span>' : '<span class="badge badge-green">active</span>')}</td>
                    <td data-label="Last Used">${k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'never'}</td>
                    <td data-label="">${!k.revoked ? `<button class="btn btn-danger btn-sm" data-revoke-key="${escapeHtml(k.key_id)}">Revoke</button>` : ''}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>` : '<p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">No dev keys yet.</p>'}
            <div style="border-top:1px solid var(--border);padding-top:20px">
              <h4 style="font-size:14px;margin-bottom:12px">Create New Key</h4>
              <form id="createDevKeyForm" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
                <div style="flex:1;min-width:200px">
                  <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:4px">Label</label>
                  <input type="text" id="devKeyLabel" placeholder="e.g. Claude Code Desktop" style="width:100%;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
                </div>
                <div style="min-width:120px">
                  <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:4px">Expires</label>
                  <select id="devKeyExpiry" style="width:100%;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
                    <option value="">Never</option>
                    <option value="30">30 days</option>
                    <option value="90" selected>90 days</option>
                    <option value="365">1 year</option>
                  </select>
                </div>
                <button type="submit" class="btn btn-primary" style="width:auto">Generate Key</button>
              </form>
              <div id="devKeyResult" style="margin-top:12px"></div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">Dev API Diagnostics</span>
              <button class="btn btn-secondary btn-sm" id="runDevDiagBtn">Run Check</button>
            </div>
            <div id="devDiagResult" style="font-size:13px;color:var(--text-secondary)">Click "Run Check" to verify the dev API is working and see recent ticket resolution activity.</div>
          </div>
        </div>

        <div class="settings-section-label">Team Management</div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Users</span>
          </div>
          <div id="usersMsg"></div>
          <div class="table-wrap" style="margin-bottom:20px">
            <table class="mobile-cards">
              <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${users.map(u => {
                  const roleBadge = u.role === 'admin' ? '<span class="badge badge-blue">admin</span>'
                    : u.role === 'staff' ? '<span class="badge badge-purple" style="background:rgba(168,85,247,0.15);color:#c084fc">staff</span>'
                    : '<span class="badge badge-green">client</span>';
                  return `<tr>
                  <td data-label="Email">${escapeHtml(u.email)}</td>
                  <td data-label="Name">${escapeHtml(u.name || '-')}</td>
                  <td data-label="Role">${roleBadge}</td>
                  <td data-label="Status">${u.must_change_password ? '<span class="badge badge-yellow">pending</span>' : '<span class="badge badge-green">active</span>'}</td>
                  <td data-label="">${u.id !== state.user.id ? `<button class="btn btn-secondary btn-sm" data-reset-user="${u.id}" style="margin-right:4px">Reset PW</button><button class="btn btn-danger btn-sm" data-delete-user="${u.id}">Remove</button>` : '<span class="badge badge-blue">you</span>'}</td>
                </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:20px">
            <h4 style="font-size:14px;margin-bottom:12px">Add New Admin</h4>
            <form id="addUserForm" style="display:flex;gap:8px;flex-wrap:wrap">
              <input type="email" id="newUserEmail" placeholder="Email" required style="flex:1;min-width:200px;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
              <input type="text" id="newUserName" placeholder="Name (optional)" style="flex:1;min-width:150px;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
              <button type="submit" class="btn btn-primary" style="width:auto">Add Admin</button>
            </form>
            <div id="newUserResult" style="margin-top:12px"></div>
          </div>
        </div>
      `;

      // Change password handler
      $('#settingsCpForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if ($('#sNew').value !== $('#sConfirm').value) {
          $('#cpMsg').innerHTML = `<div class="alert alert-error">Passwords don't match</div>`;
          return;
        }
        try {
          await api('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ current_password: $('#sCurrent').value, new_password: $('#sNew').value })
          });
          $('#cpMsg').innerHTML = `<div class="alert alert-success">Password updated</div>`;
          e.target.reset();
        } catch (err) {
          $('#cpMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      });

      // Add user handler
      $('#addUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const res = await api('/auth/users', {
            method: 'POST',
            body: JSON.stringify({ email: $('#newUserEmail').value, name: $('#newUserName').value || undefined })
          });
          $('#newUserResult').innerHTML = `
            <div class="alert alert-success">
              Admin created! Invite link sent via email.<br>
              <small>You can also share this link directly:</small><br>
              <input type="text" value="${escapeHtml(res.data.invite_url)}" readonly onclick="this.select()" style="width:100%;margin-top:8px;padding:8px;font-family:var(--mono);font-size:11px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text)">
            </div>
          `;
          e.target.reset();
          setTimeout(() => renderSettings(), 2000);
        } catch (err) {
          $('#newUserResult').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      });

      // Reset user password handlers
      $$('[data-reset-user]').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Reset this user\'s password?')) return;
        try {
          const res = await api(`/auth/users/${btn.dataset.resetUser}/reset`, { method: 'POST' });
          $('#usersMsg').innerHTML = `<div class="alert alert-success">Password reset! Invite link sent via email.<br><small>Or share directly:</small><br><input type="text" value="${escapeHtml(res.data.invite_url)}" readonly onclick="this.select()" style="width:100%;margin-top:8px;padding:8px;font-family:var(--mono);font-size:11px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text)"></div>`;
        } catch (err) {
          $('#usersMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      }));

      // Delete user handlers
      $$('[data-delete-user]').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Remove this admin?')) return;
        try {
          await api(`/auth/users/${btn.dataset.deleteUser}`, { method: 'DELETE' });
          renderSettings();
        } catch (err) {
          $('#usersMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      }));

      // OAuth settings handler
      $('#oauthForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const payload = {
            google_client_id: $('#oauthClientId').value,
            google_oauth_enabled: $('#oauthEnabled').checked
          };
          const secret = $('#oauthClientSecret').value;
          if (secret) payload.google_client_secret = secret;

          await api('/auth/oauth/config', {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
          $('#oauthMsg').innerHTML = `<div class="alert alert-success">OAuth settings saved</div>`;
          setTimeout(() => renderSettings(), 1500);
        } catch (err) {
          $('#oauthMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      });

      // SMTP settings handler
      $('#smtpForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const payload = {
            smtp_host: $('#smtpHost').value,
            smtp_port: $('#smtpPort').value,
            smtp_user: $('#smtpUser').value,
            smtp_from: $('#smtpFrom').value
          };
          const pass = $('#smtpPass').value;
          if (pass) payload.smtp_pass = pass;

          await api('/auth/smtp/config', { method: 'PUT', body: JSON.stringify(payload) });
          $('#smtpMsg').innerHTML = `<div class="alert alert-success">SMTP settings saved</div>`;
          setTimeout(() => renderSettings(), 1500);
        } catch (err) {
          $('#smtpMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      });

      // SMTP test
      $('#smtpTestBtn').addEventListener('click', async () => {
        try {
          // Save first, then test
          const payload = {
            smtp_host: $('#smtpHost').value,
            smtp_port: $('#smtpPort').value,
            smtp_user: $('#smtpUser').value,
            smtp_from: $('#smtpFrom').value
          };
          const pass = $('#smtpPass').value;
          if (pass) payload.smtp_pass = pass;
          await api('/auth/smtp/config', { method: 'PUT', body: JSON.stringify(payload) });

          const res = await api('/auth/smtp/test', { method: 'POST' });
          $('#smtpMsg').innerHTML = `<div class="alert alert-success">${escapeHtml(res.data.message)}</div>`;
        } catch (err) {
          $('#smtpMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      });

      // Webhook form
      $('#webhookForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api('/auth/smtp/config', { method: 'PUT', body: JSON.stringify({ ticket_webhook_url: $('#webhookUrl').value }) });
          $('#webhookMsg').innerHTML = '<div class="alert alert-success">Webhook URL saved</div>';
          setTimeout(() => { const m = $('#webhookMsg'); if (m) m.innerHTML = ''; }, 3000);
        } catch (err) { $('#webhookMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
      });

      // Create dev key
      $('#createDevKeyForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const body = { label: $('#devKeyLabel').value || undefined };
          const expiry = $('#devKeyExpiry').value;
          if (expiry) body.expires_days = parseInt(expiry);
          const res = await api('/admin/dev-keys', { method: 'POST', body: JSON.stringify(body) });
          const d = res.data;
          $('#devKeyResult').innerHTML = `
            <div class="alert alert-success" style="word-break:break-all">
              Key created! Copy these now — the secret will not be shown again.<br><br>
              <strong>Key ID:</strong> <code style="font-family:var(--mono)">${escapeHtml(d.key_id)}</code><br>
              <strong>Secret:</strong> <code style="font-family:var(--mono)">${escapeHtml(d.secret)}</code>
            </div>
          `;
          e.target.reset();
          setTimeout(() => renderSettings(), 5000);
        } catch (err) {
          $('#devKeyResult').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      });

      // Revoke dev key
      $$('[data-revoke-key]').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Revoke this dev key? Any services using it will stop working.')) return;
        try {
          await api(`/admin/dev-keys/${btn.dataset.revokeKey}`, { method: 'DELETE' });
          renderSettings();
        } catch (err) {
          $('#devKeysMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      }));

      // Dev API diagnostics
      const devDiagBtn = $('#runDevDiagBtn');
      if (devDiagBtn) devDiagBtn.addEventListener('click', async () => {
        const el = $('#devDiagResult');
        el.innerHTML = '<div class="loading"><div class="spinner"></div> Checking...</div>';
        try {
          const res = await api('/admin/dev-api-status');
          const d = res.data;
          el.innerHTML = `
            <div style="display:grid;gap:12px">
              <div><strong>Active dev keys:</strong> ${d.active_keys}${d.active_keys === 0 ? ' <span class="badge badge-red">No keys!</span> — create one above' : ''}</div>
              ${d.keys.map(k => `<div style="padding:8px;background:var(--surface-2);border-radius:var(--radius);font-size:12px">
                <code>${escapeHtml(k.key_id)}</code> (${escapeHtml(k.label || 'no label')})
                — Last used: <strong>${k.last_used ? timeAgo(k.last_used) : '<span style="color:var(--danger)">never</span>'}</strong>
                ${k.expires ? ` — Expires: ${new Date(k.expires).toLocaleDateString()}` : ''}
              </div>`).join('')}
              <div><strong>Recent ticket resolutions (via dev API):</strong></div>
              ${d.recent_resolves.length === 0 ? '<div style="color:var(--text-dim)">None — the dev API resolve endpoint has never been called successfully.</div>' :
                d.recent_resolves.map(r => `<div style="padding:6px 8px;background:var(--surface-2);border-radius:var(--radius);font-size:12px">
                  Ticket #${r.details.ticket_number || '?'} resolved by ${r.details.resolved_by || '?'} — ${timeAgo(r.at)}
                </div>`).join('')}
              <div><strong>Open tickets (${d.open_tickets.length}):</strong></div>
              ${d.open_tickets.length === 0 ? '<div style="color:var(--success)">All tickets are closed!</div>' :
                d.open_tickets.map(t => `<div style="padding:6px 8px;background:var(--surface-2);border-radius:var(--radius);font-size:12px">
                  <a href="#/tickets/${t.id}" style="color:var(--accent)">#${t.ticket_number}</a> ${escapeHtml(t.title)}
                  <span class="badge badge-blue" style="font-size:10px">${t.status}</span>
                  — ${escapeHtml(t.project_name)} — updated ${timeAgo(t.updated_at)}
                </div>`).join('')}
            </div>
          `;
        } catch (err) {
          el.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      });

      // Claude Code pairing
      const ccPairForm = $('#ccPairForm');
      if (ccPairForm) {
        ccPairForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const url = $('#ccServerUrl').value.trim();
          const code = $('#ccPairCode').value.trim();
          if (!url || !code) return;
          try {
            await cc.pair(url, code);
            $('#ccMsg').innerHTML = '<div class="alert alert-success">Connected to Claude Code server!</div>';
            setTimeout(() => renderSettings(), 1500);
          } catch (err) {
            $('#ccMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
          }
        });
      }
      const ccDisconnectBtn = $('#ccDisconnectBtn');
      if (ccDisconnectBtn) {
        ccDisconnectBtn.addEventListener('click', () => {
          if (!confirm('Disconnect from Claude Code server?')) return;
          cc.disconnect();
          renderSettings();
        });
      }
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">Failed to load settings: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: PROJECTS =====
  async function renderProjects() {
    renderLayout(`
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:start">
        <div><h1>Projects</h1><p>Manage client projects</p></div>
        <button class="btn btn-primary" id="newProjectBtn" style="width:auto">New Project</button>
      </div>
      <div class="loading"><div class="spinner"></div> Loading...</div>
    `);

    try {
      const res = await api('/admin/projects');
      const projects = res.data.projects;

      const statusColors = { planning: 'badge-gray', proposed: 'badge-yellow', approved: 'badge-blue', in_progress: 'badge-blue', review: 'badge-yellow', completed: 'badge-green', maintenance: 'badge-green', archived: 'badge-gray' };

      $('#mainContent').innerHTML = `
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:start">
          <div><h1>Projects</h1><p>Manage client projects</p></div>
          <button class="btn btn-primary" id="newProjectBtn" style="width:auto">New Project</button>
        </div>

        <div id="newProjectForm" style="display:none;margin-bottom:24px" class="card">
          <div class="card-header"><span class="card-title">Create Project</span></div>
          <div id="newProjectMsg"></div>
          <form id="createProjectForm">
            <div style="display:flex;gap:12px;flex-wrap:wrap">
              <div class="form-group" style="flex:1;min-width:200px">
                <label>Organization</label>
                <select id="projOrg" required style="width:100%;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
                  <option value="">Select org...</option>
                </select>
              </div>
              <div class="form-group" style="flex:2;min-width:200px">
                <label>Project Name</label>
                <input type="text" id="projName" required placeholder="e.g. PCG Website Redesign" style="width:100%;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <input type="text" id="projDesc" placeholder="Brief description" style="width:100%;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
            </div>
            <button type="submit" class="btn btn-primary" style="width:auto">Create</button>
          </form>
        </div>

        <div class="card" style="padding:0">
          <div class="table-wrap">
            <table class="mobile-cards">
              <thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th>Tickets</th><th>Last Activity</th></tr></thead>
              <tbody>
                ${projects.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:32px">No projects yet</td></tr>' :
                  projects.map(p => `<tr data-project-id="${p.id}" style="cursor:pointer">
                    <td data-label="Project" style="color:var(--text);font-weight:500">${escapeHtml(p.name)}</td>
                    <td data-label="Client">${escapeHtml(p.org_name)}</td>
                    <td data-label="Status"><span class="badge ${statusColors[p.status] || 'badge-gray'}">${p.status.replace(/_/g, ' ')}</span></td>
                    <td data-label="Progress"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:6px;background:var(--surface-3);border-radius:3px;min-width:60px"><div style="height:100%;background:var(--accent);border-radius:3px;width:${p.progress_percent}%"></div></div><span style="font-size:11px">${p.progress_percent}%</span></div></td>
                    <td data-label="Tickets">${p.open_tickets > 0 ? `<span class="badge badge-yellow">${p.open_tickets} open</span>` : '<span style="color:var(--text-dim)">0</span>'}</td>
                    <td data-label="Activity">${p.last_activity ? timeAgo(p.last_activity) : '-'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // New project toggle
      $('#newProjectBtn').addEventListener('click', async () => {
        const form = $('#newProjectForm');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
        if (form.style.display === 'block') {
          // Load orgs into select
          const orgsRes = await api('/admin/clients');
          const select = $('#projOrg');
          select.innerHTML = '<option value="">Select org...</option>' +
            orgsRes.data.organizations.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
        }
      });

      // Create project handler
      $('#createProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api('/admin/projects', {
            method: 'POST',
            body: JSON.stringify({ org_id: $('#projOrg').value, name: $('#projName').value, description: $('#projDesc').value })
          });
          renderProjects();
        } catch (err) {
          $('#newProjectMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      });

      // Click to view project
      $$('tr[data-project-id]').forEach(row => row.addEventListener('click', () => {
        state.page = 'projectDetail';
        state.projectDetailId = row.dataset.projectId;
        window.location.hash = `#/projects/${row.dataset.projectId}`;
        render();
      }));
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: PROJECT DETAIL (admin) =====
  async function renderProjectDetail(projectId) {
    renderLayout(`
      <div class="page-header"><h1>Project</h1></div>
      <div class="loading"><div class="spinner"></div> Loading...</div>
    `);

    try {
      const res = await api(`/admin/projects/${projectId}`);
      const { project, milestones, plan, members, recentActivity } = res.data;

      const statusOptions = ['planning', 'proposed', 'approved', 'in_progress', 'review', 'completed', 'maintenance', 'archived'];
      const statusColors = { planning: 'badge-gray', proposed: 'badge-yellow', approved: 'badge-blue', in_progress: 'badge-blue', review: 'badge-yellow', completed: 'badge-green', maintenance: 'badge-green', archived: 'badge-gray' };
      const msStatusColors = { upcoming: 'badge-gray', in_progress: 'badge-blue', completed: 'badge-green', skipped: 'badge-gray' };

      $('#mainContent').innerHTML = `
        <div style="margin-bottom:16px">
          <a href="#/projects" style="color:var(--text-secondary);text-decoration:none;font-size:13px">\u2190 All Projects</a>
        </div>
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <h1>${escapeHtml(project.name)}</h1>
            <p>${escapeHtml(project.org_name)} \u2022 ${escapeHtml(project.description || '')}</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="statusSelect" style="padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px">
              ${statusOptions.map(s => `<option value="${s}" ${s === project.status ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
            </select>
          </div>
        </div>

        <div id="statusMsg"></div>

        <div style="display:flex;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:24px">
          <div style="flex:1;text-align:center">
            <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">Progress</div>
            <div style="font-size:24px;font-weight:700;font-family:var(--mono);color:var(--accent)">${project.progress_percent}%</div>
          </div>
          <div style="flex:1;text-align:center">
            <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">Milestones</div>
            <div style="font-size:24px;font-weight:700;font-family:var(--mono)">${milestones.filter(m=>m.status==='completed').length}/${milestones.length}</div>
          </div>
          <div style="flex:1;text-align:center">
            <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">Target</div>
            <div style="font-size:14px;font-weight:500">${project.target_date ? new Date(project.target_date+'Z').toLocaleDateString() : '-'}</div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Milestones -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Milestones</span>
              <button class="btn btn-secondary btn-sm" id="addMsBtn">+ Add</button>
            </div>
            <div id="addMsForm" style="display:none;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
              <div style="display:flex;gap:8px">
                <input type="text" id="msTitle" placeholder="Milestone title" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px">
                <button class="btn btn-primary btn-sm" id="saveMsBtn">Save</button>
              </div>
            </div>
            ${milestones.length === 0 ? '<p style="color:var(--text-dim);font-size:13px">No milestones yet.</p>' :
              milestones.map(m => `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--surface-3)" data-ms-id="${m.id}">
                  <select class="ms-status-select" data-ms-id="${m.id}" style="padding:4px 8px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:11px;min-width:90px">
                    ${['upcoming','in_progress','completed','skipped'].map(s => `<option value="${s}" ${s===m.status?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
                  </select>
                  <span style="flex:1;font-size:14px">${escapeHtml(m.title)}</span>
                  <button class="btn btn-danger btn-sm ms-delete" data-ms-id="${m.id}" style="padding:2px 8px;font-size:10px">\u2715</button>
                </div>
              `).join('')}
          </div>

          <!-- Claude Code (primary position) -->
          <div class="card cc-card" style="display:flex;flex-direction:column">
            <div class="card-header">
              <span class="card-title" style="display:flex;align-items:center;gap:8px">
                <span style="font-family:var(--mono);font-size:14px;color:var(--accent)">&gt;_</span> Claude Code
              </span>
              <div style="display:flex;align-items:center;gap:8px" id="ccHeaderActions"></div>
            </div>
            <div id="ccWidgetBody" style="flex:1;display:flex;flex-direction:column">
              ${!cc.isConnected() ? `
                <div style="text-align:center;padding:32px 16px;color:var(--text-dim);flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center">
                  <div style="font-size:32px;margin-bottom:12px;opacity:0.3">&#9889;</div>
                  <p style="margin-bottom:12px;font-size:13px">Connect your Claude Code server<br>to use AI on this project.</p>
                  <a href="#/settings" class="btn btn-secondary btn-sm" style="text-decoration:none">Configure in Settings</a>
                </div>
              ` : `
                <div id="ccChatArea" style="flex:1;display:flex;flex-direction:column">
                  <div id="ccMessages" class="cc-messages"></div>
                  <div id="ccActivityBar" class="cc-activity-bar cc-activity-hidden">
                    <div class="cc-activity-pulse"></div>
                    <span class="cc-activity-text" id="ccActivityText">Thinking...</span>
                  </div>
                  <div style="display:flex;gap:8px;padding:12px 0 0">
                    <input type="text" id="ccMsgInput" placeholder="Ask Claude about this project..." style="flex:1;padding:10px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px">
                    <button class="btn btn-primary btn-sm" id="ccSendBtn" style="width:auto;padding:10px 20px">Send</button>
                    <button class="btn btn-danger btn-sm" id="ccStopBtn" style="width:auto;padding:10px 14px;display:none">Stop</button>
                  </div>
                </div>
              `}
            </div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Plan -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Project Plan</span>
              <div style="display:flex;align-items:center;gap:8px">
                ${plan ? `<span style="font-size:11px;color:var(--text-dim)">v${plan.version}</span>` : ''}
                ${plan ? `<button class="btn btn-secondary btn-sm" id="planHistoryBtn">History</button>` : ''}
                <button class="btn btn-secondary btn-sm" id="editPlanBtn">${plan ? 'Edit' : 'Create'} Plan</button>
              </div>
            </div>
            <div id="planEditor" style="display:none;margin-bottom:16px">
              <div style="display:flex;gap:4px;margin-bottom:8px;border-bottom:1px solid var(--border);padding-bottom:8px">
                <button class="btn btn-sm planTabBtn active" data-tab="write" style="font-size:12px">Write</button>
                <button class="btn btn-sm planTabBtn" data-tab="preview" style="font-size:12px">Preview</button>
              </div>
              <div id="planWriteTab">
                <textarea id="planContent" style="width:100%;min-height:300px;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--mono);font-size:13px;resize:vertical;line-height:1.6">${plan ? escapeHtml(plan.content) : ''}</textarea>
              </div>
              <div id="planPreviewTab" style="display:none;min-height:300px;padding:16px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);overflow-y:auto;max-height:600px" class="md-rendered"></div>
              <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
                <button class="btn btn-primary btn-sm" id="savePlanBtn">Save Plan</button>
                ${['planning', 'proposed'].includes(project.status) && plan ? `<button class="btn btn-secondary btn-sm" id="proposePlanBtn" style="background:var(--success);border-color:var(--success);color:#fff">${project.status === 'proposed' ? 'Re-send to Client' : 'Send to Client'}</button>` : ''}
                <span id="planMsg" style="font-size:12px"></span>
              </div>
            </div>
            <div id="planVersionsPanel" style="display:none;margin-bottom:16px"></div>
            ${plan ? `<div id="planDisplay" class="md-rendered" style="max-height:300px;overflow-y:auto;font-size:13px;line-height:1.6">${renderMarkdown(escapeHtml(plan.content))}</div>` :
              '<p style="color:var(--text-dim);font-size:13px">No plan created yet.</p>'}
          </div>

          <!-- Tickets -->
          <div class="card">
            <div class="card-header"><span class="card-title">Tickets</span></div>
            <div id="ticketsSection"><div class="loading"><div class="spinner"></div> Loading tickets...</div></div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Members -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Project Members</span>
              <button class="btn btn-secondary btn-sm" id="addMemberBtn">+ Add Member</button>
            </div>
            <div id="addMemberForm" style="display:none;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
              <div style="display:flex;gap:8px;align-items:center">
                <input type="text" id="memberSearch" placeholder="Search by name or email..." style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px">
              </div>
              <div id="memberSearchResults" style="margin-top:8px"></div>
            </div>
            ${members.length === 0 ? '<p style="color:var(--text-dim);font-size:13px;padding:4px 0">No members assigned. Members from other organizations can be added here for cross-org access.</p>' :
              members.map(m => `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--surface-3)">
                  <div style="width:32px;height:32px;border-radius:50%;background:var(--surface-3);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--text-dim)">${escapeHtml((m.name || '?')[0].toUpperCase())}</div>
                  <div style="flex:1">
                    <div style="font-size:14px;font-weight:500">${escapeHtml(m.name)}</div>
                    <div style="font-size:12px;color:var(--text-dim)">${escapeHtml(m.email)} <span class="badge badge-gray" style="font-size:10px">${m.user_role}</span> <span class="badge badge-blue" style="font-size:10px">${m.role}</span></div>
                  </div>
                  <button class="btn btn-danger btn-sm member-remove" data-user-id="${m.user_id}" data-name="${escapeHtml(m.name).replace(/"/g, '&quot;')}" style="padding:2px 8px;font-size:10px">\u2715</button>
                </div>
              `).join('')}
          </div>

          <!-- Activity -->
          <div class="card">
            <div class="card-header"><span class="card-title">Recent Activity</span></div>
            ${recentActivity.length === 0 ? '<p style="color:var(--text-dim);font-size:13px">No activity yet.</p>' : `
              <div style="max-height:300px;overflow-y:auto">
                ${recentActivity.map(a => {
                  const d = a.details ? JSON.parse(a.details) : {};
                  return `<div style="padding:8px 0;border-bottom:1px solid var(--surface-3);font-size:13px;color:var(--text-secondary)">
                    <strong>${escapeHtml(a.user_name || a.user_email || 'System')}</strong> — ${a.action.replace(/_/g, ' ')}
                    <span style="float:right;color:var(--text-dim);font-size:11px">${timeAgo(a.created_at)}</span>
                  </div>`;
                }).join('')}
              </div>
            `}
          </div>
        </div>

      `;

      // Status change handler
      $('#statusSelect').addEventListener('change', async (e) => {
        try {
          await api(`/admin/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) });
          $('#statusMsg').innerHTML = `<div class="alert alert-success" style="margin-bottom:16px">Status updated to ${e.target.value}</div>`;
          setTimeout(() => { const el = $('#statusMsg'); if(el) el.innerHTML=''; }, 2000);
        } catch (err) { $('#statusMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
      });

      // Add milestone
      $('#addMsBtn').addEventListener('click', () => {
        const form = $('#addMsForm');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      });
      $('#saveMsBtn').addEventListener('click', async () => {
        const title = $('#msTitle').value.trim();
        if (!title) return;
        try {
          await api(`/admin/projects/${projectId}/milestones`, { method: 'POST', body: JSON.stringify({ title }) });
          renderProjectDetail(projectId);
        } catch (err) { alert(err.message); }
      });

      // Milestone status changes
      $$('.ms-status-select').forEach(sel => sel.addEventListener('change', async (e) => {
        try {
          await api(`/admin/milestones/${e.target.dataset.msId}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) });
          renderProjectDetail(projectId);
        } catch (err) { alert(err.message); }
      }));

      // Milestone delete
      $$('.ms-delete').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Delete this milestone?')) return;
        try {
          await api(`/admin/milestones/${btn.dataset.msId}`, { method: 'DELETE' });
          renderProjectDetail(projectId);
        } catch (err) { alert(err.message); }
      }));

      // Members
      $('#addMemberBtn').addEventListener('click', () => {
        const form = $('#addMemberForm');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
        if (form.style.display === 'block') $('#memberSearch').focus();
      });

      let memberSearchTimeout;
      $('#memberSearch').addEventListener('input', (e) => {
        clearTimeout(memberSearchTimeout);
        const q = e.target.value.trim();
        if (q.length < 2) { $('#memberSearchResults').innerHTML = ''; return; }
        memberSearchTimeout = setTimeout(async () => {
          try {
            const res = await api(`/admin/users/search?q=${encodeURIComponent(q)}`);
            const existingIds = members.map(m => m.user_id);
            const available = res.data.users.filter(u => !existingIds.includes(u.id));
            if (available.length === 0) {
              $('#memberSearchResults').innerHTML = '<p style="color:var(--text-dim);font-size:12px">No matching users found.</p>';
              return;
            }
            $('#memberSearchResults').innerHTML = available.map(u => `
              <div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:4px;cursor:pointer;background:var(--surface)" class="member-search-row" data-user-id="${u.id}">
                <div style="width:28px;height:28px;border-radius:50%;background:var(--surface-3);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--text-dim)">${escapeHtml((u.name || '?')[0].toUpperCase())}</div>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:500">${escapeHtml(u.name)}</div>
                  <div style="font-size:11px;color:var(--text-dim)">${escapeHtml(u.email)} <span class="badge badge-gray" style="font-size:10px">${u.role}</span></div>
                </div>
                <button class="btn btn-primary btn-sm" style="font-size:11px">Add</button>
              </div>
            `).join('');
            $$('.member-search-row').forEach(row => row.addEventListener('click', async () => {
              try {
                await api(`/admin/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ user_id: row.dataset.userId }) });
                renderProjectDetail(projectId);
              } catch (err) { alert(err.message); }
            }));
          } catch (err) { $('#memberSearchResults').innerHTML = `<p style="color:var(--error);font-size:12px">${escapeHtml(err.message)}</p>`; }
        }, 300);
      });

      $$('.member-remove').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm(`Remove ${btn.dataset.name} from this project?`)) return;
        try {
          await api(`/admin/projects/${projectId}/members/${btn.dataset.userId}`, { method: 'DELETE' });
          renderProjectDetail(projectId);
        } catch (err) { alert(err.message); }
      }));

      // Plan editor
      $('#editPlanBtn').addEventListener('click', () => {
        const editor = $('#planEditor');
        const display = $('#planDisplay');
        editor.style.display = editor.style.display === 'none' ? 'block' : 'none';
        if (display) display.style.display = editor.style.display === 'none' ? 'block' : 'none';
      });

      // Write/Preview tabs
      $$('.planTabBtn').forEach(btn => btn.addEventListener('click', () => {
        $$('.planTabBtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        const writeTab = $('#planWriteTab');
        const previewTab = $('#planPreviewTab');
        if (tab === 'write') { writeTab.style.display = 'block'; previewTab.style.display = 'none'; }
        else { writeTab.style.display = 'none'; previewTab.style.display = 'block'; previewTab.innerHTML = renderMarkdown(escapeHtml($('#planContent').value)); }
      }));

      $('#savePlanBtn').addEventListener('click', async () => {
        const msg = $('#planMsg');
        try {
          const result = await api(`/admin/projects/${projectId}/plan`, { method: 'POST', body: JSON.stringify({ content: $('#planContent').value }) });
          if (msg) msg.innerHTML = `<span class="badge badge-green">Saved (v${result.data.version})</span>`;
          setTimeout(() => { if (msg) msg.innerHTML = ''; }, 3000);
          // Update preview display if visible
          const display = $('#planDisplay');
          if (display) display.innerHTML = renderMarkdown(escapeHtml($('#planContent').value));
        } catch (err) {
          if (msg) msg.innerHTML = `<span class="badge badge-red">${escapeHtml(err.message)}</span>`;
        }
      });

      const proposeBtn = $('#proposePlanBtn');
      if (proposeBtn) {
        proposeBtn.addEventListener('click', async () => {
          if (!confirm('This will send the plan to the client for approval. Continue?')) return;
          try {
            await api(`/admin/projects/${projectId}/plan`, { method: 'POST', body: JSON.stringify({ content: $('#planContent').value }) });
            await api(`/admin/projects/${projectId}/propose`, { method: 'POST' });
            renderProjectDetail(projectId);
          } catch (err) { alert(err.message); }
        });
      }

      // Version history
      const histBtn = $('#planHistoryBtn');
      if (histBtn) {
        histBtn.addEventListener('click', async () => {
          const panel = $('#planVersionsPanel');
          if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
          panel.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
          panel.style.display = 'block';
          try {
            const res = await api(`/admin/projects/${projectId}/plan/versions`);
            const versions = res.data.versions;
            if (versions.length === 0) {
              panel.innerHTML = '<p style="color:var(--text-dim);font-size:13px;padding:8px">No previous versions.</p>';
              return;
            }
            panel.innerHTML = `
              <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
                <div style="padding:8px 12px;background:var(--surface-3);font-size:12px;font-weight:600;color:var(--text-dim)">Version History</div>
                ${versions.map(v => `
                  <div style="padding:8px 12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:13px">
                    <div>
                      <strong>v${v.version}</strong>
                      <span style="color:var(--text-dim);margin-left:8px">${v.saved_by_name || 'Unknown'}</span>
                      <span style="color:var(--text-dim);margin-left:8px">${timeAgo(v.created_at)}</span>
                    </div>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-secondary btn-sm" data-view-version="${v.id}" style="font-size:11px">View</button>
                      <button class="btn btn-secondary btn-sm" data-restore-version="${v.id}" data-ver="${v.version}" style="font-size:11px">Restore</button>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div id="versionPreview" style="display:none;margin-top:8px;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);max-height:300px;overflow-y:auto" class="md-rendered"></div>
            `;
            $$('[data-view-version]').forEach(btn => btn.addEventListener('click', async () => {
              try {
                const vRes = await api(`/admin/projects/${projectId}/plan/versions/${btn.dataset.viewVersion}`);
                const preview = $('#versionPreview');
                preview.style.display = 'block';
                preview.innerHTML = renderMarkdown(escapeHtml(vRes.data.version.content));
              } catch (err) { alert(err.message); }
            }));
            $$('[data-restore-version]').forEach(btn => btn.addEventListener('click', async () => {
              if (!confirm(`Restore to v${btn.dataset.ver}? Current plan will be saved as a new version.`)) return;
              try {
                await api(`/admin/projects/${projectId}/plan/restore/${btn.dataset.restoreVersion}`, { method: 'POST' });
                renderProjectDetail(projectId);
              } catch (err) { alert(err.message); }
            }));
          } catch (err) {
            panel.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
          }
        });
      }

      // Render tickets with inline status change
      const loadProjectTickets = async () => {
        try {
          const ticketsRes = await api(`/admin/projects/${projectId}/tickets`);
          const tickets = ticketsRes.data.tickets;
          const tsEl = $('#ticketsSection');
          if (!tsEl) return;
          const statusClass = (s) => s==='open'?'badge-blue':s==='in_progress'?'badge-yellow':(s==='completed'||s==='closed')?'badge-green':'badge-gray';
          tsEl.innerHTML = tickets.length === 0 ? '<p style="color:var(--text-dim);font-size:13px">No tickets yet.</p>' : `
            <div class="table-wrap"><table class="mobile-cards">
              <thead><tr><th>#</th><th>Title</th><th>Type</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Updated</th></tr></thead>
              <tbody>${tickets.map(t => `<tr data-ticket-href="#/tickets/${t.id}" style="cursor:pointer">
                <td data-label="#" style="font-family:var(--mono);font-size:12px">${t.ticket_number}</td>
                <td data-label="Title" style="color:var(--text)">${escapeHtml(t.title)}</td>
                <td data-label="Type"><span class="badge badge-gray">${t.type.replace(/_/g,' ')}</span></td>
                <td data-label="Priority"><span class="badge ${t.priority==='high'||t.priority==='urgent'?'badge-red':t.priority==='medium'?'badge-yellow':'badge-gray'}">${t.priority}</span></td>
                <td data-label="Status">
                  <select class="inline-ticket-status" data-ticket-id="${t.id}" style="padding:3px 6px;font-size:11px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);cursor:pointer">
                    ${['open','in_progress','review','completed','closed'].map(s => `<option value="${s}" ${s===t.status?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
                  </select>
                </td>
                <td data-label="Assigned">${escapeHtml(t.assigned_to_name || '-')}</td>
                <td data-label="Updated">${timeAgo(t.updated_at)}</td>
              </tr>`).join('')}</tbody>
            </table></div>
          `;
          // Click to navigate to ticket detail (but not on the status dropdown)
          $$('[data-ticket-href]').forEach(r => r.addEventListener('click', (e) => {
            if (e.target.closest('.inline-ticket-status')) return;
            window.location.hash = r.dataset.ticketHref;
          }));
          // Inline status change
          $$('.inline-ticket-status').forEach(sel => sel.addEventListener('change', async (e) => {
            e.stopPropagation();
            const tid = sel.dataset.ticketId;
            const newStatus = sel.value;
            try {
              await api(`/admin/tickets/${tid}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
              loadProjectTickets(); // Reload to confirm
            } catch (err) { alert('Status update failed: ' + err.message); sel.value = sel.dataset.prev || 'open'; }
          }));
          // Store current value for rollback on error
          $$('.inline-ticket-status').forEach(sel => { sel.dataset.prev = sel.value; });
        } catch (e) {
          const tsEl = $('#ticketsSection');
          if (tsEl) tsEl.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
        }
      };
      loadProjectTickets();

      // ===== CLAUDE CODE CHAT WIDGET =====
      if (cc.isConnected()) {
        const projectMap = cc.getProjectMap();
        const mappedPath = projectMap[projectId];
        const ccKey = cc.keyFor(projectId); // Derives from folder name (matches Desktop/PWA)

        // Init streaming state
        if (!cc.chats[projectId]) cc.chats[projectId] = [];
        if (!cc.streaming[projectId]) cc.streaming[projectId] = { text: '', tools: [], active: false };

        // Load shared history from CC server (synced with Desktop/PWA)
        if (mappedPath) {
          await cc.loadHistory(projectId);
        }

        // Render header actions (folder selector)
        const headerActions = $('#ccHeaderActions');
        if (headerActions) {
          if (mappedPath) {
            headerActions.innerHTML = `
              <code style="font-size:11px;color:var(--text-dim);font-family:var(--mono);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(mappedPath)}">${escapeHtml(mappedPath.split('\\').pop() || mappedPath.split('/').pop())}</code>
              <button class="btn btn-secondary btn-sm" id="ccRemapBtn" style="font-size:10px;padding:4px 8px">Change</button>
              <button class="btn btn-secondary btn-sm" id="ccResetBtn" style="font-size:10px;padding:4px 8px" title="New conversation">Reset</button>
            `;
          } else {
            headerActions.innerHTML = '<span class="badge badge-yellow" style="font-size:10px">No folder mapped</span>';
          }
        }

        // --- Incremental chat renderer (avoids full innerHTML rebuild during streaming) ---
        let _ccRenderedCount = 0; // tracks how many committed messages are in the DOM
        let _ccStreamEl = null;   // reference to the live streaming bubble wrapper

        // Full rebuild — used for initial render, history load, and done events
        function renderCcChatFull() {
          const el = $('#ccMessages');
          if (!el) return;
          const messages = cc.chats[projectId] || [];
          const streaming = cc.streaming[projectId];
          let html = '';
          if (messages.length === 0 && !streaming.active) {
            html = `<div class="cc-empty-state" style="text-align:center;padding:40px 20px;color:var(--text-dim);font-size:13px">
              ${mappedPath ? 'Ask Claude anything about this project.' : 'Select a project folder above to get started.'}
            </div>`;
          }
          messages.forEach(m => {
            if (m.role === 'user') {
              html += `<div class="cc-msg cc-msg-user"><div class="cc-msg-bubble cc-msg-user-bubble">${escapeHtml(m.content)}</div></div>`;
            } else {
              html += `<div class="cc-msg cc-msg-assistant"><div class="cc-msg-bubble cc-msg-assistant-bubble">${renderMarkdown(escapeHtml(m.content))}</div>`;
              if (m.tools && m.tools.length) {
                html += `<div class="cc-tools">${m.tools.map(t => `<span class="cc-tool-badge">${escapeHtml(t)}</span>`).join('')}</div>`;
              }
              html += `</div>`;
            }
          });
          el.innerHTML = html;
          _ccRenderedCount = messages.length;
          _ccStreamEl = null;
          // Append streaming bubble if active
          if (streaming.active || streaming.text) {
            _ccEnsureStreamBubble(el, streaming);
          }
          el.scrollTop = el.scrollHeight;
        }

        // Ensure the streaming bubble exists, create if missing
        function _ccEnsureStreamBubble(container, streaming) {
          if (!_ccStreamEl) {
            // Remove empty state if present
            const empty = container.querySelector('.cc-empty-state');
            if (empty) empty.remove();
            _ccStreamEl = document.createElement('div');
            _ccStreamEl.className = 'cc-msg cc-msg-assistant';
            _ccStreamEl.innerHTML = `<div class="cc-msg-bubble cc-msg-assistant-bubble cc-stream-bubble"></div><div class="cc-tools cc-stream-tools"></div>`;
            container.appendChild(_ccStreamEl);
          }
          _ccUpdateStreamContent(streaming);
        }

        // Update just the streaming bubble content (no DOM rebuild)
        function _ccUpdateStreamContent(streaming) {
          if (!_ccStreamEl) return;
          const bubble = _ccStreamEl.querySelector('.cc-stream-bubble');
          if (!bubble) return;
          if (streaming.text) {
            const rendered = renderMarkdown(escapeHtml(streaming.text));
            if (bubble.innerHTML !== rendered) {
              bubble.innerHTML = `<div class="cc-stream-content">${rendered}</div>`;
            }
          } else {
            bubble.innerHTML = '<span class="cc-thinking">Thinking<span class="cc-thinking-dots"><span></span><span></span><span></span></span></span>';
          }
          // Update tool badges incrementally
          const toolsEl = _ccStreamEl.querySelector('.cc-stream-tools');
          if (toolsEl && streaming.tools.length) {
            const existing = toolsEl.querySelectorAll('.cc-tool-badge').length;
            if (existing < streaming.tools.length) {
              // Only append new badges
              for (let i = existing; i < streaming.tools.length; i++) {
                const badge = document.createElement('span');
                badge.className = 'cc-tool-badge';
                badge.textContent = streaming.tools[i];
                toolsEl.appendChild(badge);
              }
            }
          }
        }

        // Incremental update — only touches the streaming bubble
        function renderCcChatStream() {
          const el = $('#ccMessages');
          if (!el) return;
          const streaming = cc.streaming[projectId];
          // Check if committed messages changed (shouldn't during streaming, but safety)
          const messages = cc.chats[projectId] || [];
          if (messages.length !== _ccRenderedCount) {
            return renderCcChatFull(); // fallback to full rebuild
          }
          if (streaming.active || streaming.text) {
            _ccEnsureStreamBubble(el, streaming);
          }
          el.scrollTop = el.scrollHeight;
        }

        // Commit streaming bubble to final message (no full rebuild needed)
        function renderCcChatDone() {
          const el = $('#ccMessages');
          if (!el) return;
          // Remove the streaming bubble
          if (_ccStreamEl) {
            _ccStreamEl.remove();
            _ccStreamEl = null;
          }
          // Append the newly committed message(s)
          const messages = cc.chats[projectId] || [];
          for (let i = _ccRenderedCount; i < messages.length; i++) {
            const m = messages[i];
            const div = document.createElement('div');
            if (m.role === 'user') {
              div.className = 'cc-msg cc-msg-user';
              div.innerHTML = `<div class="cc-msg-bubble cc-msg-user-bubble">${escapeHtml(m.content)}</div>`;
            } else {
              div.className = 'cc-msg cc-msg-assistant';
              div.innerHTML = `<div class="cc-msg-bubble cc-msg-assistant-bubble">${renderMarkdown(escapeHtml(m.content))}</div>`;
              if (m.tools && m.tools.length) {
                const toolsDiv = document.createElement('div');
                toolsDiv.className = 'cc-tools';
                toolsDiv.innerHTML = m.tools.map(t => `<span class="cc-tool-badge">${escapeHtml(t)}</span>`).join('');
                div.appendChild(toolsDiv);
              }
            }
            el.appendChild(div);
          }
          _ccRenderedCount = messages.length;
          el.scrollTop = el.scrollHeight;
        }

        // Alias for backward compat (used by history:updated, reset, etc.)
        function renderCcChat() { renderCcChatFull(); }

        // --- Activity bar helpers ---
        function ccShowActivity(text) {
          const bar = $('#ccActivityBar');
          const txt = $('#ccActivityText');
          if (bar) bar.classList.remove('cc-activity-hidden');
          if (txt) txt.textContent = text || 'Thinking...';
        }
        function ccHideActivity() {
          const bar = $('#ccActivityBar');
          if (bar) bar.classList.add('cc-activity-hidden');
        }
        function ccShowStop() {
          const sendBtn = $('#ccSendBtn');
          const stopBtn = $('#ccStopBtn');
          if (sendBtn) sendBtn.style.display = 'none';
          if (stopBtn) stopBtn.style.display = '';
        }
        function ccShowSend() {
          const sendBtn = $('#ccSendBtn');
          const stopBtn = $('#ccStopBtn');
          if (sendBtn) sendBtn.style.display = '';
          if (stopBtn) stopBtn.style.display = 'none';
        }

        // Folder picker
        if (!mappedPath) {
          // Load available folders from CC server
          (async () => {
            try {
              const projects = await cc.listProjects();
              const el = $('#ccHeaderActions');
              if (!el) return;
              el.innerHTML = `
                <select id="ccFolderSelect" style="padding:4px 8px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:11px;font-family:var(--mono);max-width:200px">
                  <option value="">Select folder...</option>
                  ${(projects || []).map(p => `<option value="${escapeHtml(p.path)}">${escapeHtml(p.name)}</option>`).join('')}
                </select>
              `;
              const sel = $('#ccFolderSelect');
              if (sel) {
                // Auto-match folder to current project name
                const pName = (project.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (pName && projects && projects.length) {
                  const match = projects.find(p => {
                    const fName = (p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return fName === pName || fName.includes(pName) || pName.includes(fName);
                  });
                  if (match) {
                    sel.value = match.path;
                    const map = cc.getProjectMap();
                    map[projectId] = match.path;
                    cc.setProjectMap(map);
                    renderProjectDetail(projectId);
                    return;
                  }
                }
                sel.addEventListener('change', () => {
                  if (!sel.value) return;
                  const map = cc.getProjectMap();
                  map[projectId] = sel.value;
                  cc.setProjectMap(map);
                  renderProjectDetail(projectId);
                });
              }
            } catch (err) {
              const el = $('#ccHeaderActions');
              if (el) el.innerHTML = `<span style="color:var(--danger);font-size:11px">${escapeHtml(err.message)}</span>`;
            }
          })();
        }

        renderCcChat();

        // Connect WS
        cc.disconnectWs();
        cc.connectWs();

        // WS event handlers — shared with Desktop/PWA (same key)
        cc.on('claude:process-started', (msg) => {
          if (msg.key !== ccKey) return;
          if (!cc.streaming[projectId].active) {
            cc.streaming[projectId] = { text: '', tools: [], active: true };
            renderCcChatStream();
            ccShowActivity('Thinking...');
            ccShowStop();
          }
        });

        cc.on('claude:stream', (msg) => {
          if (msg.key !== ccKey) return;
          cc.streaming[projectId].text = msg.text || '';
          cc.streaming[projectId].active = true;
          renderCcChatStream();
          ccShowActivity('Generating response...');
          ccShowStop();
        });

        cc.on('claude:tool-use', (msg) => {
          if (msg.key !== ccKey) return;
          const toolName = msg.tool || 'tool';
          if (!cc.streaming[projectId].tools.includes(toolName)) {
            cc.streaming[projectId].tools.push(toolName);
          }
          renderCcChatStream();
          ccShowActivity(`Using ${toolName}...`);
          ccShowStop();
        });

        cc.on('claude:tool-result', (msg) => {
          if (msg.key !== ccKey) return;
          ccShowActivity('Processing...');
        });

        cc.on('claude:done', (msg) => {
          if (msg.key !== ccKey) return;
          const streaming = cc.streaming[projectId];
          if (!streaming.active && !streaming.text) return;
          const content = streaming.text || msg.output || '';
          const tools = [...streaming.tools];
          cc.streaming[projectId] = { text: '', tools: [], active: false };
          if (content) {
            cc.chats[projectId].push({ role: 'assistant', content, tools });
            cc.saveMessage(projectId, { role: 'assistant', content, timestamp: Date.now() });
          } else if (msg.error) {
            cc.chats[projectId].push({ role: 'assistant', content: `Error: ${msg.error}`, tools: [] });
          }
          renderCcChatDone();
          ccHideActivity();
          ccShowSend();

          // Auto-refresh project data after Claude Code finishes (tickets/milestones may have changed)
          setTimeout(() => {
            if ($('#ticketsSection')) loadProjectTickets();
          }, 2000);
        });

        // Sync: reload history when Desktop/PWA saves a message
        if (ccKey) {
          cc.on('history:updated', async (msg) => {
            if (msg.key !== ccKey) return;
            if (Date.now() - cc._lastHistorySave < 2000) return;
            await cc.loadHistory(projectId);
            renderCcChatFull();
          });
        }

        // Reconnect resilience: reload history when WS reconnects
        cc.on('__ws_reconnected', async () => {
          await cc.loadHistory(projectId);
          renderCcChatFull();
        });

        // Build portal context for first message injection
        function buildPortalContext() {
          let ctx = `[Portal Context — ${project.name}]\n`;
          ctx += `Status: ${project.status} | Progress: ${project.progress_percent}%\n`;
          if (project.org_name) ctx += `Client: ${project.org_name}\n`;
          ctx += `\nMilestones:\n`;
          milestones.forEach((m, i) => {
            const icon = m.status === 'completed' ? '✅' : m.status === 'in_progress' ? '🔄' : '⬚';
            ctx += `${i + 1}. ${icon} ${m.title} (${m.status})\n`;
          });
          // Include only recent open tickets (max 5)
          try {
            const ticketsEl = $('#ticketsSection');
            if (ticketsEl) {
              const rows = [...ticketsEl.querySelectorAll('tr[data-ticket-href]')].slice(0, 5);
              if (rows.length > 0) {
                ctx += `\nRecent Tickets:\n`;
                rows.forEach(r => {
                  const cells = r.querySelectorAll('td');
                  if (cells.length >= 5) {
                    ctx += `- #${cells[0].textContent} ${cells[1].textContent} (${cells[2].textContent.trim()}, ${cells[3].textContent.trim()}, ${cells[4].textContent.trim()})\n`;
                  }
                });
              }
            }
          } catch {}
          ctx += `[End Portal Context]\n\n`;
          return ctx;
        }

        // Send message
        async function ccSendMessage() {
          const input = $('#ccMsgInput');
          if (!input) return;
          const msg = input.value.trim();
          if (!msg || !mappedPath) return;
          input.value = '';

          // Show user message in chat
          cc.chats[projectId].push({ role: 'user', content: msg });
          cc.saveMessage(projectId, { role: 'user', content: msg, timestamp: Date.now() });
          cc.streaming[projectId] = { text: '', tools: [], active: true };
          renderCcChatFull(); // full rebuild to show new user message + streaming bubble
          ccShowActivity('Thinking...');
          ccShowStop();

          try {
            let sendMsg = msg;
            if (cc.chats[projectId].filter(m => m.role === 'user').length === 1) {
              sendMsg = buildPortalContext() + msg;
            }
            await cc.send(projectId, sendMsg, mappedPath);
          } catch (err) {
            cc.streaming[projectId] = { text: '', tools: [], active: false };
            cc.chats[projectId].push({ role: 'assistant', content: `Connection error: ${err.message}`, tools: [] });
            renderCcChatFull();
            ccHideActivity();
            ccShowSend();
          }
        }

        const ccSendBtn = $('#ccSendBtn');
        if (ccSendBtn) ccSendBtn.addEventListener('click', ccSendMessage);
        const ccInput = $('#ccMsgInput');
        if (ccInput) ccInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ccSendMessage(); }
        });
        const ccStopBtn = $('#ccStopBtn');
        if (ccStopBtn) ccStopBtn.addEventListener('click', async () => {
          try { await cc.stop(projectId); } catch {}
        });
        const ccRemapBtn = $('#ccRemapBtn');
        if (ccRemapBtn) ccRemapBtn.addEventListener('click', () => {
          const map = cc.getProjectMap();
          delete map[projectId];
          cc.setProjectMap(map);
          renderProjectDetail(projectId);
        });
        const ccResetBtn = $('#ccResetBtn');
        if (ccResetBtn) ccResetBtn.addEventListener('click', async () => {
          cc.chats[projectId] = [];
          cc.streaming[projectId] = { text: '', tools: [], active: false };
          _ccRenderedCount = 0;
          _ccStreamEl = null;
          try {
            await cc.reset(projectId);
            const key = cc.keyFor(projectId);
            if (key) await cc.api(`/api/history/${encodeURIComponent(key)}`, { method: 'DELETE' });
          } catch {}
          renderCcChatFull();
          ccHideActivity();
          ccShowSend();
        });
      }

    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: TICKET DETAIL (admin) =====
  async function renderAdminTicketDetail(ticketId) {
    renderLayout(`<div class="loading"><div class="spinner"></div> Loading ticket...</div>`);

    try {
      const res = await api(`/admin/tickets/${ticketId}`);
      const { ticket, comments } = res.data;

      // Fetch attachments
      let attachments = [];
      try {
        const attRes = await fetch(`/api/uploads/tickets/${ticket.id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` } });
        const attData = await attRes.json();
        if (attData.success) attachments = attData.data.attachments;
      } catch {}

      const statusOpts = ['open', 'in_progress', 'review', 'completed', 'closed'];
      const priorityOpts = ['low', 'medium', 'high', 'urgent'];

      const fileIcon = (mime) => {
        if (mime.startsWith('image/')) return '\u{1F5BC}';
        if (mime.includes('pdf')) return '\u{1F4C4}';
        if (mime.includes('word') || mime.includes('document')) return '\u{1F4DD}';
        if (mime.includes('sheet') || mime.includes('excel')) return '\u{1F4CA}';
        if (mime.includes('zip')) return '\u{1F4E6}';
        return '\u{1F4CE}';
      };

      $('#mainContent').innerHTML = `
        <div style="margin-bottom:16px">
          <a href="#/projects/${ticket.project_id || ''}" style="color:var(--text-secondary);text-decoration:none;font-size:13px">\u2190 Back to Project</a>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:24px">
          <div>
            <h1 style="font-size:22px;margin-bottom:8px">#${ticket.ticket_number} — ${escapeHtml(ticket.title)}</h1>
            <div style="font-size:13px;color:var(--text-secondary)">
              ${escapeHtml(ticket.project_name || '')} \u2022 Created by ${escapeHtml(ticket.created_by_name || ticket.created_by_email)} \u2022 ${timeAgo(ticket.created_at)}
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <select id="ticketStatus" style="padding:6px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:12px">
              ${statusOpts.map(s => `<option value="${s}" ${s===ticket.status?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
            </select>
            <select id="ticketPriority" style="padding:6px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:12px">
              ${priorityOpts.map(p => `<option value="${p}" ${p===ticket.priority?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="ticketUpdateMsg"></div>

        ${ticket.description ? `<div style="padding:16px;background:var(--surface-2);border-radius:var(--radius);font-size:14px;line-height:1.6;color:var(--text-secondary);margin-bottom:24px;white-space:pre-wrap">${escapeHtml(ticket.description)}</div>` : ''}

        <div class="card" style="margin-bottom:24px">
          <div class="card-header">
            <span class="card-title">Attachments (${attachments.length}/10)</span>
          </div>
          <div id="attachmentsList">
            ${attachments.length === 0 ? '<p style="color:var(--text-dim);font-size:13px;margin:0">No files attached.</p>' : `
              <div style="display:flex;flex-direction:column;gap:6px">
                ${attachments.map(a => `
                  <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface-2);border-radius:var(--radius);font-size:13px" data-att-id="${a.id}">
                    <span style="font-size:18px">${fileIcon(a.mimetype)}</span>
                    <a href="#" class="att-download" data-id="${a.id}" data-name="${escapeHtml(a.filename)}" style="color:var(--accent);text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(a.filename)}">${escapeHtml(a.filename)}</a>
                    <span style="color:var(--text-dim);font-size:12px;white-space:nowrap">${formatFileSize(a.size)}</span>
                    <span style="color:var(--text-dim);font-size:12px;white-space:nowrap">${escapeHtml(a.uploaded_by_name || '')}</span>
                    <span style="color:var(--text-dim);font-size:12px;white-space:nowrap">${timeAgo(a.uploaded_at)}</span>
                    <button class="btn btn-secondary btn-sm att-delete" data-id="${a.id}" style="padding:2px 8px;font-size:11px;color:var(--danger);border-color:var(--danger)">\u2715</button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
          ${attachments.length < 10 ? `
            <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px">
              <div id="uploadDropZone" style="border:2px dashed var(--border);border-radius:var(--radius);padding:20px;text-align:center;cursor:pointer;transition:border-color 0.2s">
                <div style="color:var(--text-secondary);font-size:13px">Drop files here or <label for="fileInput" style="color:var(--accent);cursor:pointer;text-decoration:underline">browse</label></div>
                <div style="color:var(--text-dim);font-size:11px;margin-top:4px">Max 10MB per file. Images, PDFs, docs, spreadsheets, CSV, ZIP.</div>
                <input type="file" id="fileInput" multiple style="display:none" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip">
              </div>
              <div id="uploadProgress" style="margin-top:8px"></div>
              <div id="uploadMsg" style="margin-top:8px"></div>
            </div>
          ` : ''}
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Comments (${comments.length})</span></div>
          ${comments.map(c => `
            <div style="padding:12px;background:${c.is_internal?'rgba(245,158,11,0.05)':'var(--surface-2)'};border-radius:var(--radius);margin-bottom:8px;border-left:3px solid ${c.is_internal?'var(--warning)':c.user_role==='client'?'var(--success)':'var(--accent)'}">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px">
                <span style="font-weight:600;color:var(--text)">${escapeHtml(c.user_name || c.user_email)} <span class="badge ${c.user_role==='client'?'badge-green':c.is_internal?'badge-yellow':'badge-blue'}">${c.is_internal?'internal':c.user_role}</span></span>
                <span style="color:var(--text-dim)">${timeAgo(c.created_at)}</span>
              </div>
              <div style="font-size:14px;color:var(--text-secondary);white-space:pre-wrap">${escapeHtml(c.body)}</div>
            </div>
          `).join('')}

          <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px">
            <div style="display:flex;gap:12px;margin-bottom:8px">
              <textarea id="newComment" placeholder="Add a comment..." style="flex:1;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px;min-height:60px;resize:vertical"></textarea>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" id="postPublicBtn">Post (visible to client)</button>
              <button class="btn btn-secondary btn-sm" id="postInternalBtn" style="border-color:var(--warning);color:var(--warning)">Post Internal Note</button>
            </div>
            <div id="commentMsg" style="margin-top:8px"></div>
          </div>
        </div>
      `;

      // Status/priority change — re-render full page to confirm update took effect
      const updateTicket = async (field, value) => {
        try {
          const res = await api(`/admin/tickets/${ticketId}`, { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
          // Verify the server actually persisted the change
          if (res.data.ticket && field === 'status' && res.data.ticket.status !== value) {
            $('#ticketUpdateMsg').innerHTML = `<div class="alert alert-error" style="margin-bottom:12px">Status change failed — server still reports: ${res.data.ticket.status}</div>`;
            return;
          }
          // Re-render to confirm the change is reflected
          renderAdminTicketDetail(ticketId);
        } catch (err) { $('#ticketUpdateMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
      };
      $('#ticketStatus').addEventListener('change', (e) => updateTicket('status', e.target.value));
      $('#ticketPriority').addEventListener('change', (e) => updateTicket('priority', e.target.value));

      // File upload handling
      const uploadFiles = async (files) => {
        if (!files || files.length === 0) return;
        const formData = new FormData();
        for (const f of files) formData.append('files', f);
        const progressEl = $('#uploadProgress');
        const msgEl = $('#uploadMsg');
        if (progressEl) progressEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px">Uploading...</div>';
        if (msgEl) msgEl.innerHTML = '';
        try {
          const uploadRes = await fetch(`/api/uploads/tickets/${ticket.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` },
            body: formData
          });
          const uploadData = await uploadRes.json();
          if (!uploadData.success) throw new Error(uploadData.error);
          renderAdminTicketDetail(ticketId);
        } catch (err) {
          if (progressEl) progressEl.innerHTML = '';
          if (msgEl) msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      };

      const dropZone = $('#uploadDropZone');
      const fileInput = $('#fileInput');
      if (dropZone) {
        dropZone.addEventListener('click', () => fileInput && fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
        dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border)'; });
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--border)'; uploadFiles(e.dataTransfer.files); });
      }
      if (fileInput) {
        fileInput.addEventListener('change', () => { uploadFiles(fileInput.files); });
      }

      // Download attachment (auth-gated)
      $$('.att-download').forEach(link => {
        link.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            const dlRes = await fetch(`/api/uploads/download/${link.dataset.id}`, {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
            });
            if (!dlRes.ok) throw new Error('Download failed');
            const blob = await dlRes.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = link.dataset.name; a.click();
            URL.revokeObjectURL(url);
          } catch (err) { alert('Download failed: ' + err.message); }
        });
      });

      // Delete attachment
      $$('.att-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this attachment?')) return;
          try {
            const delRes = await fetch(`/api/uploads/${btn.dataset.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
            });
            const delData = await delRes.json();
            if (!delData.success) throw new Error(delData.error);
            renderAdminTicketDetail(ticketId);
          } catch (err) {
            alert('Delete failed: ' + err.message);
          }
        });
      });

      // Post comment
      const postComment = async (isInternal) => {
        const body = $('#newComment').value.trim();
        if (!body) return;
        try {
          await api(`/admin/tickets/${ticketId}/comments`, { method: 'POST', body: JSON.stringify({ body, is_internal: isInternal }) });
          renderAdminTicketDetail(ticketId);
        } catch (err) { $('#commentMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
      };
      $('#postPublicBtn').addEventListener('click', () => postComment(false));
      $('#postInternalBtn').addEventListener('click', () => postComment(true));
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: CLIENTS =====
  async function renderClients() {
    renderLayout(`
      <div class="page-header"><h1>Clients</h1><p>Manage client organizations</p></div>
      <div class="loading"><div class="spinner"></div> Loading...</div>
    `);

    try {
      const res = await api('/admin/clients');
      const orgs = res.data.organizations;

      $('#mainContent').innerHTML = `
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:start">
          <div><h1>Clients</h1><p>Manage client organizations</p></div>
          <button class="btn btn-primary" id="newOrgBtn" style="width:auto">New Client</button>
        </div>

        <div id="newOrgForm" style="display:none;margin-bottom:24px" class="card">
          <div class="card-header"><span class="card-title">Create Organization</span></div>
          <div id="newOrgMsg"></div>
          <form id="createOrgForm" style="display:flex;gap:8px;flex-wrap:wrap">
            <input type="text" id="orgName" placeholder="Company name" required style="flex:1;min-width:200px;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
            <input type="email" id="orgEmail" placeholder="Primary email" required style="flex:1;min-width:200px;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
            <button type="submit" class="btn btn-primary" style="width:auto">Create</button>
          </form>
        </div>

        ${orgs.length === 0 ? '<div class="empty-state"><p>No clients yet. Create one to get started!</p></div>' :
          orgs.map(o => `
            <div class="card client-card" style="margin-bottom:16px;overflow:hidden">
              <div class="card-header" style="flex-wrap:wrap;gap:4px 12px">
                <span class="card-title" style="word-break:break-word">${escapeHtml(o.name)}</span>
                <span style="font-size:12px;color:var(--text-dim);word-break:break-all;min-width:0">${escapeHtml(o.primary_email)}</span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:8px 24px;font-size:13px;color:var(--text-secondary);margin-bottom:16px">
                <span>${o.project_count} project${o.project_count!==1?'s':''}</span>
                <span>${o.user_count} portal user${o.user_count!==1?'s':''}</span>
                <span>Created ${timeAgo(o.created_at)}</span>
              </div>
              <div style="border-top:1px solid var(--border);padding-top:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <span style="font-size:13px;font-weight:600">Portal Users</span>
                  <button class="btn btn-secondary btn-sm add-user-btn" data-org-id="${o.id}">+ Add User</button>
                </div>
                <div id="addUserForm-${o.id}" style="display:none;margin-bottom:12px">
                  <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <input type="email" placeholder="Email" class="new-client-email" style="flex:1;min-width:0;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px;box-sizing:border-box">
                    <input type="text" placeholder="Name" class="new-client-name" style="flex:1;min-width:0;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px;box-sizing:border-box">
                    <button class="btn btn-primary btn-sm save-client-btn" data-org-id="${o.id}" style="flex-shrink:0">Create</button>
                  </div>
                  <div class="new-client-result" style="margin-top:8px"></div>
                </div>
                <div id="usersList-${o.id}" style="font-size:13px;color:var(--text-dim)">Loading...</div>
              </div>
            </div>
          `).join('')}
      `;

      // New org toggle + handler
      $('#newOrgBtn').addEventListener('click', () => {
        const form = $('#newOrgForm');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      });
      $('#createOrgForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api('/admin/clients', { method: 'POST', body: JSON.stringify({ name: $('#orgName').value, primary_email: $('#orgEmail').value }) });
          renderClients();
        } catch (err) { $('#newOrgMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
      });

      // Load users for each org + add user handlers
      for (const o of orgs) {
        try {
          const usersRes = await api(`/admin/clients/${o.id}/users`);
          const users = usersRes.data.users;
          const el = $(`#usersList-${o.id}`);
          if (!el) continue;
          el.innerHTML = users.length === 0 ? 'No portal users yet.' :
            `<table class="mobile-cards" style="width:100%;font-size:13px"><thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">Email</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">Name</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">Status</th><th style="padding:6px 8px;border-bottom:1px solid var(--border)"></th></tr></thead><tbody>${users.map(u => `<tr>
              <td data-label="Email" style="padding:6px 8px;word-break:break-all;min-width:0">${escapeHtml(u.email)}${u.is_cross_org ? ' <span class="badge badge-blue" style="font-size:10px">cross-org</span>' : ''}</td>
              <td data-label="Name" style="padding:6px 8px">${escapeHtml(u.name || '-')}</td>
              <td data-label="Status" style="padding:6px 8px">${u.must_change_password ? '<span class="badge badge-yellow">pending</span>' : '<span class="badge badge-green">active</span>'}</td>
              <td data-label="" style="padding:6px 8px;text-align:right">
                <button class="btn btn-secondary btn-sm client-reset-pw" data-org-id="${o.id}" data-user-id="${u.id}" data-email="${escapeHtml(u.email).replace(/"/g, '&quot;')}" style="margin-right:4px">Reset PW</button>
                <button class="btn btn-danger btn-sm client-delete-user" data-org-id="${o.id}" data-user-id="${u.id}" data-email="${escapeHtml(u.email).replace(/"/g, '&quot;')}" data-cross-org="${u.is_cross_org ? 1 : 0}">Remove</button>
              </td>
            </tr>`).join('')}</tbody></table>`;
        } catch(e) {}
      }

      // Add user toggles
      $$('.add-user-btn').forEach(btn => btn.addEventListener('click', () => {
        const form = $(`#addUserForm-${btn.dataset.orgId}`);
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      }));

      // Save client user
      $$('.save-client-btn').forEach(btn => btn.addEventListener('click', async () => {
        const orgId = btn.dataset.orgId;
        const form = $(`#addUserForm-${orgId}`);
        const email = form.querySelector('.new-client-email').value;
        const name = form.querySelector('.new-client-name').value;
        const result = form.querySelector('.new-client-result');
        try {
          const res = await api(`/admin/clients/${orgId}/users`, { method: 'POST', body: JSON.stringify({ email, name }) });
          result.innerHTML = res.data.linked
            ? `<div class="alert alert-success">${escapeHtml(res.data.message)}</div>`
            : `<div class="alert alert-success">Created! Invite link sent via email.<br><small>Or share directly:</small><br><input type="text" value="${escapeHtml(res.data.invite_url)}" readonly onclick="this.select()" style="width:100%;margin-top:8px;padding:8px;font-family:var(--mono);font-size:11px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text)"></div>`;
          setTimeout(() => renderClients(), 3000);
        } catch (err) { result.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
      }));

      // Reset client user password
      $$('.client-reset-pw').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm(`Reset password for ${btn.dataset.email}?`)) return;
        try {
          const res = await api(`/auth/users/${btn.dataset.userId}/reset`, { method: 'POST' });
          const row = btn.closest('td');
          row.innerHTML = `<input type="text" value="${escapeHtml(res.data.invite_url)}" readonly onclick="this.select()" style="width:220px;padding:4px 8px;font-family:var(--mono);font-size:11px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text)">`;
          setTimeout(() => renderClients(), 5000);
        } catch (err) { alert(err.message); }
      }));

      // Delete client user
      $$('.client-delete-user').forEach(btn => btn.addEventListener('click', async () => {
        const isCrossOrg = btn.dataset.crossOrg === '1';
        const msg = isCrossOrg
          ? `Remove ${btn.dataset.email}'s cross-org access to this organization's projects?`
          : `Remove ${btn.dataset.email} from this organization? This cannot be undone.`;
        if (!confirm(msg)) return;
        try {
          await api(`/admin/clients/${btn.dataset.orgId}/users/${btn.dataset.userId}`, { method: 'DELETE' });
          renderClients();
        } catch (err) { alert(err.message); }
      }));
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== ROUTER =====
  function route() {
    const hash = window.location.hash.replace('#/', '') || 'dashboard';
    const parts = hash.split('/');

    if (parts[0] === 'projects' && parts[1]) {
      state.page = 'projectDetail';
      state.projectDetailId = parts[1];
      return;
    }
    if (parts[0] === 'tickets' && parts[1]) {
      state.page = 'ticketDetail';
      state.ticketDetailId = parts[1];
      return;
    }
    if (['dashboard', 'security', 'analytics', 'settings', 'projects', 'clients'].includes(parts[0])) {
      state.page = parts[0];
    }
  }

  // ===== RENDER: INVITE =====
  async function renderInvite(token) {
    app.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo"><span class="accent">{</span> kaymen.dev <span class="accent">}</span></div>
          <h2 class="login-title">Set Up Your Password</h2>
          <div id="inviteMsg"><div class="loading"><div class="spinner"></div> Validating invite...</div></div>
          <form id="inviteForm" style="display:none">
            <div id="inviteInfo"></div>
            <div class="form-group">
              <label>New Password</label>
              <input type="password" id="invitePass" placeholder="At least 8 characters" required minlength="8" autocomplete="new-password">
            </div>
            <div class="form-group">
              <label>Confirm Password</label>
              <input type="password" id="invitePassConfirm" placeholder="Confirm password" required minlength="8" autocomplete="new-password">
            </div>
            <button type="submit" class="btn btn-primary">Set Password & Sign In</button>
          </form>
        </div>
      </div>
    `;

    try {
      const res = await fetch('/api/auth/invite/' + token).then(r => r.json());
      if (!res.success) throw new Error(res.error);
      const user = res.data.user;
      $('#inviteMsg').innerHTML = '';
      $('#inviteInfo').innerHTML = `<p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px">Welcome${user.name ? ', <strong>' + escapeHtml(user.name) + '</strong>' : ''}! Set your password to get started.</p>`;
      $('#inviteForm').style.display = 'block';
      $('#invitePass').focus();
    } catch (err) {
      $('#inviteMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div><p style="margin-top:16px"><a href="#/login" style="color:var(--accent)">Go to login</a></p>`;
      return;
    }

    $('#inviteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pass = $('#invitePass').value;
      const confirm = $('#invitePassConfirm').value;
      if (pass !== confirm) {
        $('#inviteMsg').innerHTML = '<div class="alert alert-error">Passwords do not match</div>';
        return;
      }
      const btn = $('button[type="submit"]', e.target);
      btn.textContent = 'Setting up...'; btn.disabled = true;
      try {
        const res = await fetch('/api/auth/invite/' + token + '/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pass })
        }).then(r => r.json());
        if (!res.success) throw new Error(res.error);
        state.token = res.data.token;
        state.user = res.data.user;
        localStorage.setItem('admin_token', state.token);
        window.location.hash = '#/dashboard';
        render();
      } catch (err) {
        $('#inviteMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        btn.textContent = 'Set Password & Sign In'; btn.disabled = false;
      }
    });
  }

  // ===== MAIN RENDER =====
  async function render() {
    destroyCharts();

    // Handle invite page before auth check (public route)
    const hash = window.location.hash.replace('#/', '') || '';
    const parts = hash.split('/');
    if (parts[0] === 'invite' && parts[1]) return renderInvite(parts[1]);

    if (!state.token || !state.user) {
      const authed = await checkAuth();
      if (!authed) return renderLogin();
    }

    if (state.user.must_change_password) return renderChangePassword();

    route();
    switch (state.page) {
      case 'projects': return renderProjects();
      case 'projectDetail': return renderProjectDetail(state.projectDetailId);
      case 'ticketDetail': return renderAdminTicketDetail(state.ticketDetailId);
      case 'clients': return renderClients();
      case 'security': return renderSecurity();
      case 'analytics': return renderAnalytics();
      case 'settings': return renderSettings();
      default: return renderDashboard();
    }
  }

  // ===== INIT =====
  window.addEventListener('hashchange', render);
  render();
})();

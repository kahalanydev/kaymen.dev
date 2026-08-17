/* Admin Panel SPA — kaymen.dev */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/admin/sw.js').catch(() => {});
}

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const app = document.getElementById('app');

  // The panel is light-first now and has no dark variant, so a leftover
  // admin_theme key from before the re-skin must not be applied — it would set
  // data-theme on a stylesheet that no longer has any [data-theme] rules.
  localStorage.removeItem('admin_theme');
  document.documentElement.removeAttribute('data-theme');

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

  /* Two letters for an avatar chip. Falls back to the first two characters of
     whatever we have, because the activity feed carries emails as often as it
     carries names and "OH" beats an empty square. */
  function initials(name) {
    const parts = String(name || '').trim().split(/[\s@._-]+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
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
          <div class="login-logo" role="img" aria-label="kaymen.dev"></div>
          <h2 class="login-title">Admin Login</h2>
          <div id="loginMsg">${oauthError ? `<div class="alert alert-error">${escapeHtml(errorMessages[oauthError] || 'Sign-in failed')}</div>` : ''}</div>
          ${googleEnabled ? `
            <a href="/api/auth/google?target=admin" class="btn btn-google">
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Sign in with Google
            </a>
            <div class="or">or</div>
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
          <a href="#" id="forgotLink" class="link-quiet">Forgot password?</a>
          <div id="resetSection" class="divide" hidden>
            <p class="hint sm">Enter your email and we will send you a link to set a new password. It expires in an hour, and your current password keeps working until you use it.</p>
            <form id="resetForm" class="row">
              <input type="email" id="resetEmail" placeholder="Your admin email" required class="in grow">
              <button type="submit" class="btn btn-secondary" >Reset</button>
            </form>
            <div id="resetMsg" class="mt-s"></div>
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
      section.hidden = !section.hidden;
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
          <div class="login-logo" role="img" aria-label="kaymen.dev"></div>
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
  /* Line icons, same set and stroke weight as the marketing rail. Emoji were
     the old panel's icons; they render differently on every OS and cannot take
     currentColor, so the active state could never tint them. */
  const NAV_ICON = {
    dashboard: '<path d="M3 10.5 12 3l9 7.5V21H3z"/>',
    projects:  '<rect x="2.5" y="6.5" width="19" height="13.5" rx="2.2"/><path d="M8.5 6.5V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/>',
    clients:   '<path d="M16 20v-1.6a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="3.4"/><path d="M22 20v-1.6a4 4 0 0 0-3-3.8"/><path d="M16.5 3.8a4 4 0 0 1 0 6.4"/>',
    security:  '<path d="M12 2.8 4.5 6v6c0 4.6 3.1 8 7.5 9.2 4.4-1.2 7.5-4.6 7.5-9.2V6z"/><path d="M9.2 12.2l2 2 3.6-3.9"/>',
    analytics: '<path d="M3 20h18"/><path d="M6 20V11M11 20V6M16 20v-6M21 20V9"/>',
    settings:  '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  };
  const icon = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${NAV_ICON[id] || ''}</svg>`;

  function renderLayout(content, opts) {
    const navItems = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'projects', label: 'Projects', count: 'projects' },
      { id: 'clients', label: 'Clients', count: 'clients' },
      { id: 'security', label: 'Security', count: 'security' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'settings', label: 'Settings' },
    ];
    // Counts are whatever the last dashboard fetch saw. Absent on a cold load,
    // which is why every one of them is optional rather than rendered as 0.
    const counts = state.navCounts || {};
    const bottomNavItems = navItems.filter(n => n.id !== 'settings');
    const wide = opts && opts.wide ? ' wide' : '';
    // this wipes the whole shell, so the projects console can never still be
    // mounted afterwards — every other page render invalidates it for free
    con.mounted = false;

    app.innerHTML = `
      <div class="mobile-top-bar" id="mobileTopBar">
        <a href="#/settings" class="mtb-btn ${state.page === 'settings' ? 'active' : ''}" title="Settings" aria-label="Settings">${icon('settings')}</a>
        <button class="mtb-btn" id="mtbLogout" title="Log out" aria-label="Log out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.5"/><path d="m16 16.5 4.5-4.5L16 7.5"/><path d="M20.5 12H9.5"/></svg>
        </button>
      </div>
      <div class="layout">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-logo" role="img" aria-label="kaymen.dev"></div>
          <div class="sidebar-label">Admin</div>
          <ul class="sidebar-nav">
            ${navItems.map(n => {
              const c = n.count ? counts[n.count] : null;
              return `
              <li><a href="#/${n.id}" class="${state.page === n.id ? 'active' : ''}" data-page="${n.id}">
                <span class="icon">${icon(n.id)}</span><span>${n.label}</span>
                ${c ? `<span class="count${c.hot ? ' hot' : ''}">${c.n}</span>` : ''}
              </a></li>`;
            }).join('')}
          </ul>
          <div class="sidebar-bottom">
            ${state.navCounts && state.navCounts.live
              ? `<div class="sidebar-live"><span class="pulse"></span><em>${state.navCounts.live} systems live now</em></div>` : ''}
            <div class="sidebar-user">${escapeHtml(state.user?.email)}</div>
            <button class="btn btn-secondary btn-sm" id="logoutBtn" style="width:100%">Log out</button>
          </div>
        </aside>
        <main class="main${wide}" id="mainContent">${content}</main>
      </div>
      <nav class="bottom-nav" id="bottomNav">
        ${bottomNavItems.map(n => `
          <a href="#/${n.id}" class="bottom-nav-item ${state.page === n.id ? 'active' : ''}" data-page="${n.id}">
            <span class="bottom-nav-icon">${icon(n.id)}</span>
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
    // The theme toggle was removed with the re-skin, on the same grounds the
    // main site dropped its own (handoff §5): the palette is light-first and no
    // dark variant is designed. Do not re-add a half-working one.
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
      // tone drives the icon and the one badge; hue is spent on severity only
      const ATT_ICON = {
        alert: '<path d="M12 8v5"/><circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/><path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
        warn:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.4l3.4 2"/>',
        plan:  '<path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><path d="M14 2.5v5h5"/>',
        ok:    '<path d="M3.5 6.5h17v12h-17z"/><path d="m3.5 7 8.5 6.2L20.5 7"/>',
      };
      const attIcon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${ATT_ICON[k]}</svg>`;

      const attentionItems = [];
      d.urgentTickets.forEach(t => attentionItems.push({
        tone: 'alert', glyph: 'alert', flag: t.priority === 'urgent' ? 'Urgent' : 'High',
        text: `#${t.ticket_number} — ${escapeHtml(t.title)}`,
        sub: `${escapeHtml(t.project_name)} &middot; opened ${timeAgo(t.created_at)}`,
        href: `#/tickets/${t.id}`
      }));
      d.overdueMilestones.forEach(m => attentionItems.push({
        tone: 'warn', glyph: 'warn', flag: 'Overdue',
        text: `Milestone overdue — ${escapeHtml(m.title)}`,
        sub: `${escapeHtml(m.project_name)} &middot; target was ${escapeHtml(m.target_date)}`,
        href: `#/projects/${m.project_id}`
      }));
      d.waitingApprovals.forEach(p => attentionItems.push({
        tone: 'warn', glyph: 'plan', flag: 'Waiting',
        text: `Plan sent, not yet approved`,
        sub: `${escapeHtml(p.org_name)} &middot; ${escapeHtml(p.name)} &middot; proposed ${timeAgo(p.updated_at)}`,
        href: `#/projects/${p.id}`
      }));
      const newContacts = d.recentContacts.filter(c => !c.dismissed);
      if (newContacts.length) attentionItems.push({
        tone: 'ok', glyph: 'ok', flag: 'New',
        text: `${newContacts.length} new lead${newContacts.length === 1 ? '' : 's'}, none dismissed`,
        sub: `Oldest is ${timeAgo(newContacts[newContacts.length - 1].created_at)} old`,
        href: '#/dashboard'
      });

      // Feed the rail's queue counts. Absent on a cold load, which is why
      // renderLayout treats every one of them as optional.
      state.navCounts = {
        projects: d.activeProjects ? { n: d.activeProjects } : null,
        clients: null,
        security: null,
        live: null,
      };

      const hour = new Date().getHours();
      const partOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      const firstName = (state.user?.name || '').trim().split(/\s+/)[0] || '';
      const needCount = attentionItems.length;
      const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <p class="eyebrow">${escapeHtml(today)}</p>
          <h1>Good ${partOfDay}${firstName ? ', ' + escapeHtml(firstName) : ''}.</h1>
          <p>${needCount === 0
                ? 'Nothing needs you. Everything is running.'
                : `${needCount} thing${needCount === 1 ? '' : 's'} need${needCount === 1 ? 's' : ''} you today. Everything else is running.`}</p>
        </div>

        <hr class="rule">

        <!-- the evidence strip, pointed at the panel's own numbers -->
        <div class="section">
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-value accent">${d.activeProjects}</div>
              <div class="metric-label">Active projects</div>
              <div class="metric-sub">in progress or review</div>
            </div>
            <div class="metric-card">
              <div class="metric-value${d.openTickets > 0 ? ' danger' : ''}">${d.openTickets}</div>
              <div class="metric-label">Open tickets</div>
              <div class="metric-sub">need resolution</div>
            </div>
            <div class="metric-card">
              <div class="metric-value${d.pendingApprovals > 0 ? ' info' : ''}">${d.pendingApprovals}</div>
              <div class="metric-label">Awaiting approval</div>
              <div class="metric-sub">plans with the client</div>
            </div>
            <div class="metric-card">
              <div class="metric-value${d.unreadContacts > 0 ? ' accent' : ''}">${d.unreadContacts}</div>
              <div class="metric-label">New leads</div>
              <div class="metric-sub">contact submissions</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${d.visitors.today}</div>
              <div class="metric-label">Visitors today</div>
              <div class="metric-sub">${d.activeNow} active now</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${d.visitors.month}</div>
              <div class="metric-label">This month</div>
              <div class="metric-sub">avg ${d.avgTimeOnSite}s per session</div>
            </div>
          </div>
        </div>

        <hr class="rule">

        <!-- needs attention — the site's no-hostages tick-row, carrying a problem -->
        <div class="section">
          <p class="eyebrow">Needs attention</p>
          ${attentionItems.length > 0 ? `
          <div class="att">
            ${attentionItems.map(item => `
              <a href="${item.href}" class="att-row">
                <span class="att-ic t-${item.tone}">${attIcon(item.glyph)}</span>
                <div>
                  <div class="t">${item.text}</div>
                  <div class="s">${item.sub}</div>
                </div>
                <span class="badge ${item.tone === 'alert' ? 'badge-red' : item.tone === 'warn' ? 'badge-yellow' : 'badge-green'}">${item.flag}</span>
              </a>
            `).join('')}
          </div>` : `
          <div class="att-clear">
            <span class="pulse"></span>
            <p><b>Nothing is waiting.</b> No urgent tickets, no overdue milestones, no plan sitting with a client.</p>
          </div>`}
        </div>

        <hr class="rule">

        <!-- the running board, straight off the marketing site -->
        <div class="section">
          <p class="eyebrow">Active projects</p>
          ${d.projects.length === 0
            ? '<div class="empty-state"><p>No active projects.</p></div>'
            : `<div class="board">
                ${d.projects.map(p => `
                  <a href="#/projects/${p.id}" class="brow">
                    <span class="dot${p.status === 'proposed' || p.status === 'planning' ? ' idle' : ''}"></span>
                    <div class="nm">${escapeHtml(p.name)}<i>${escapeHtml(p.org_name)}</i></div>
                    <div class="wt">${escapeHtml(p.description ? truncate(p.description, 90) : p.status.replace(/_/g, ' '))}</div>
                    <div class="pg"><em>${p.progress_percent}%</em><span class="bar"><i style="width:${p.progress_percent}%"></i></span></div>
                    ${p.open_tickets > 0
                      ? `<span class="badge badge-yellow">${p.open_tickets} open</span>`
                      : `<span class="badge ${statusColors[p.status] || 'badge-gray'}">${escapeHtml(p.status.replace(/_/g, ' '))}</span>`}
                  </a>
                `).join('')}
              </div>`}
        </div>

        <hr class="rule">

        <div class="section">
          <div class="grid-2">
            <!-- Recent activity -->
            <div class="card">
              <div class="card-header"><span class="card-title">Recent activity</span></div>
              ${d.recentActivity.length === 0 ? '<div class="empty-state"><p>No activity yet.</p></div>' : `
                <div class="act">
                  ${d.recentActivity.map(a => `
                    <div class="act-row">
                      <span class="avatar">${escapeHtml(initials(a.user_name))}</span>
                      <div class="tx">
                        <b>${escapeHtml(a.user_name)}</b> ${escapeHtml(a.action.replace(/_/g, ' '))}
                        ${a.project_name ? ` in <b>${escapeHtml(a.project_name)}</b>` : ''}
                      </div>
                      <span class="tm">${timeAgo(a.created_at)}</span>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- New leads -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">New leads</span>
                ${d.unreadContacts > 0 ? `<span class="badge badge-green">${d.unreadContacts} new</span>` : ''}
              </div>
              ${d.recentContacts.length === 0 ? '<div class="empty-state"><p>No submissions yet.</p></div>' : `
                <div class="no-pad">
                  ${d.recentContacts.map(c => `
                    <div class="lead-row" data-contact-id="${c.id}">
                      <div class="lh">
                        <span class="ln">${escapeHtml(c.name)}</span>
                        <span class="le">${timeAgo(c.created_at)}</span>
                      </div>
                      <div class="le">${escapeHtml(c.email)}${c.project_name ? ` &middot; <b class="ink">${escapeHtml(c.project_name)}</b>` : ''}</div>
                      <div class="lm">${escapeHtml(truncate(c.message, 130))}</div>
                      <div class="row mt-s">
                        ${c.converted_at
                          ? '<span class="badge badge-green">Converted</span>'
                          : `<button class="btn btn-primary btn-sm contact-convert" data-id="${c.id}" data-name="${escapeHtml(c.name).replace(/"/g, '&quot;')}" data-email="${escapeHtml(c.email).replace(/"/g, '&quot;')}" data-project="${escapeHtml(c.project_name || '').replace(/"/g, '&quot;')}">Make a client</button>
                             <button class="btn btn-secondary btn-sm contact-dismiss" data-id="${c.id}">Dismiss</button>`}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        </div>

        <hr class="rule">

        <!-- Contact submissions moved into "New leads" above \u2014 they are the
             same records, and having them in two places meant dismissing one
             left the other showing a lead that was already dealt with. -->
        <div class="section">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Recent visitors</span>
              <a href="#/analytics">Analytics &rarr;</a>
            </div>
            <div class="table-wrap">
              <table class="mobile-cards">
                <thead><tr><th>IP</th><th>Location</th><th>Device</th><th>When</th></tr></thead>
                <tbody>
                  ${d.recentVisitors.length === 0 ? '<tr><td colspan="4" class="empty-cell">No visitors yet</td></tr>' :
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
                ${d.suspicious.length === 0 ? '<tr><td colspan="5" class="empty-cell">No suspicious activity detected</td></tr>' :
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
                  ${d.suspiciousIPs.length === 0 ? '<tr><td colspan="3" class="empty-cell">No flagged IPs</td></tr>' :
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
            <div class="chart-container chart-h" ><canvas id="sectionsChart"></canvas></div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Visits by Hour</span></div>
            <div class="chart-container chart-h" ><canvas id="hourlyChart"></canvas></div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Click Tracking</span></div>
            <div class="table-wrap">
              <table class="mobile-cards">
                <thead><tr><th>Element</th><th>Clicks</th></tr></thead>
                <tbody>
                  ${d.clickEvents.length === 0 ? '<tr><td colspan="2" class="empty-cell">No click data yet</td></tr>' :
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
                  ${d.referrers.length === 0 ? '<tr><td colspan="2" class="empty-cell">No referrer data yet</td></tr>' :
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
            <div class="chart-container chart-h sm" ><canvas id="devicesChart"></canvas></div>
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

        <div class="settings-section-label mt-0" >Account & Security</div>
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
              <button type="submit" class="btn btn-primary">Update Password</button>
            </form>
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title">Google OAuth</span></div>
            <p class="hint">
              Allow clients (and admins) to sign in with their Google account. Users must be created first — Google login only works for existing accounts.
            </p>
            <div id="oauthMsg"></div>
            <form id="oauthForm">
              <div class="form-group">
                <label>Google Client ID</label>
                <input type="text" id="oauthClientId" value="${escapeHtml(oauth.google_client_id)}" placeholder="xxxx.apps.googleusercontent.com" class="mono">
              </div>
              <div class="form-group">
                <label>Client Secret ${oauth.google_client_secret_set ? '<span class="badge badge-green mini">set</span>' : '<span class="badge badge-gray mini">not set</span>'}</label>
                <input type="password" id="oauthClientSecret" placeholder="${oauth.google_client_secret_set ? 'Leave blank to keep current' : 'Enter client secret'}" class="mono">
              </div>
              <div class="row gap-lg">
                <label class="check">
                  <input type="checkbox" id="oauthEnabled" ${oauth.google_oauth_enabled ? 'checked' : ''}>
                  Enable Google Sign-In
                </label>
                <button type="submit" class="btn btn-primary">Save OAuth Settings</button>
              </div>
            </form>
            ${oauth.google_oauth_enabled ? '<div class="codebox mt-m"><strong>Authorized redirect URI</strong> (add this in Google Cloud Console):<br><code >' + window.location.origin + '/api/auth/google/callback</code></div>' : ''}
          </div>
        </div>

        <div class="settings-section-label">Integrations</div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Claude Code</span>
              ${cc.isConnected() ? '<span class="badge badge-green">Connected</span>' : '<span class="badge badge-gray">Not connected</span>'}
            </div>
            <p class="hint">
              Connect your Claude Code server to get AI assistance directly from project pages.
            </p>
            <div id="ccMsg"></div>
            ${cc.isConnected() ? `
              <div class="row" style="padding:12px;background:var(--bg-alt);border-radius:11px">
                <span class="pulse">&#11044;</span>
                <code class="mono grow dim">${escapeHtml(cc.getServer())}</code>
                <button class="btn btn-danger btn-sm" id="ccDisconnectBtn">Disconnect</button>
              </div>
            ` : `
              <form id="ccPairForm">
                <div class="form-group">
                  <label>Server URL</label>
                  <input type="url" id="ccServerUrl" value="https://code.kaymen.dev" placeholder="https://code.kaymen.dev" class="mono">
                </div>
                <div class="form-group">
                  <label>Pairing Code</label>
                  <input type="text" id="ccPairCode" placeholder="000000" maxlength="6" class="mono pair-code">
                </div>
                <p class="hint sm">
                  Open Claude Code Desktop &rarr; the 6-digit pairing code is shown on startup or in the health endpoint.
                </p>
                <button type="submit" class="btn btn-primary">Connect</button>
              </form>
            `}
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title">Notifications</span></div>
            <p class="hint">
              Configure email (SMTP) for invites and ticket alerts, and an optional webhook for ticket events.
            </p>
            <div id="smtpMsg"></div>
            <form id="smtpForm">
              <div class="form-group">
                <label>SMTP Host</label>
                <input type="text" id="smtpHost" value="${escapeHtml(smtp.smtp_host)}" placeholder="smtp.gmail.com" class="mono">
              </div>
              <div class="form-group">
                <label>Port</label>
                <input type="text" id="smtpPort" value="${escapeHtml(smtp.smtp_port)}" placeholder="587" class="mono" style="max-width:110px">
              </div>
              <div class="form-group">
                <label>Username</label>
                <input type="text" id="smtpUser" value="${escapeHtml(smtp.smtp_user)}" placeholder="you@gmail.com" class="mono">
              </div>
              <div class="form-group">
                <label>Password ${smtp.smtp_pass_set ? '<span class="badge badge-green mini">set</span>' : ''}</label>
                <input type="password" id="smtpPass" placeholder="${smtp.smtp_pass_set ? 'Leave blank to keep' : 'App password'}" class="mono">
              </div>
              <div class="form-group">
                <label>From Address</label>
                <input type="text" id="smtpFrom" value="${escapeHtml(smtp.smtp_from)}" placeholder='"kaymen.dev" <hello@kaymen.dev>' class="mono">
              </div>
              <div class="row">
                <button type="submit" class="btn btn-primary">Save SMTP</button>
                <button type="button" class="btn btn-secondary" id="smtpTestBtn">Send Test Email</button>
              </div>
            </form>
            <div class="divide">
              <h4 class="sub-h">Ticket Webhook</h4>
              <p class="hint sm">POST a JSON payload to this URL when a client creates a ticket. Works with Slack, Discord, or custom endpoints.</p>
              <form id="webhookForm" class="row">
                <input type="url" id="webhookUrl" value="${escapeHtml(smtp.ticket_webhook_url)}" placeholder="https://hooks.slack.com/services/..." class="in mono grow">
                <button type="submit" class="btn btn-primary">Save</button>
              </form>
              <div id="webhookMsg" class="mt-s"></div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Dev Keys</span>
            </div>
            <p class="hint">
              HMAC API keys for Claude Code integration. Use these to connect the portal sync service.
            </p>
            <div id="devKeysMsg"></div>
            ${devKeys.length ? `
            <div class="table-wrap mb-l" >
              <table class="mobile-cards">
                <thead><tr><th>Key ID</th><th>Label</th><th>Status</th><th>Last Used</th><th></th></tr></thead>
                <tbody>
                  ${devKeys.map(k => `<tr>
                    <td data-label="Key ID"><code class="mono">${escapeHtml(k.key_id)}</code></td>
                    <td data-label="Label">${escapeHtml(k.label || '-')}</td>
                    <td data-label="Status">${k.revoked ? '<span class="badge badge-red">revoked</span>' : (k.expires_at && new Date(k.expires_at) < new Date() ? '<span class="badge badge-yellow">expired</span>' : '<span class="badge badge-green">active</span>')}</td>
                    <td data-label="Last Used">${k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'never'}</td>
                    <td data-label="">${!k.revoked ? `<button class="btn btn-danger btn-sm" data-revoke-key="${escapeHtml(k.key_id)}">Revoke</button>` : ''}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>` : '<p class="hint">No dev keys yet.</p>'}
            <div class="divide mt-0" >
              <h4 class="sub-h">Create New Key</h4>
              <form id="createDevKeyForm" class="row end">
                <div class="grow">
                  <label class="field-label">Label</label>
                  <input type="text" id="devKeyLabel" placeholder="e.g. Claude Code Desktop" class="in">
                </div>
                <div class="shrink0">
                  <label class="field-label">Expires</label>
                  <select id="devKeyExpiry" class="in">
                    <option value="">Never</option>
                    <option value="30">30 days</option>
                    <option value="90" selected>90 days</option>
                    <option value="365">1 year</option>
                  </select>
                </div>
                <button type="submit" class="btn btn-primary">Generate Key</button>
              </form>
              <div id="devKeyResult" class="mt-m"></div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">Dev API Diagnostics</span>
              <button class="btn btn-secondary btn-sm" id="runDevDiagBtn">Run Check</button>
            </div>
            <div id="devDiagResult" class="hint mb-0">Click "Run Check" to verify the dev API is working and see recent ticket resolution activity.</div>
          </div>
        </div>

        <div class="settings-section-label">Team Management</div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Users</span>
          </div>
          <div id="usersMsg"></div>
          <div class="table-wrap mb-l" >
            <table class="mobile-cards">
              <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${users.map(u => {
                  const roleBadge = u.role === 'admin' ? '<span class="badge badge-blue">admin</span>'
                    : u.role === 'staff' ? '<span class="badge badge-gray">staff</span>'
                    : '<span class="badge badge-green">client</span>';
                  return `<tr>
                  <td data-label="Email">${escapeHtml(u.email)}</td>
                  <td data-label="Name">${escapeHtml(u.name || '-')}</td>
                  <td data-label="Role">${roleBadge}</td>
                  <td data-label="Status">${u.must_change_password ? '<span class="badge badge-yellow">pending</span>' : '<span class="badge badge-green">active</span>'}</td>
                  <td data-label="">${u.id !== state.user.id ? `<button class="btn btn-secondary btn-sm mr-s" data-reset-user="${u.id}" >Reset PW</button><button class="btn btn-danger btn-sm" data-delete-user="${u.id}">Remove</button>` : '<span class="badge badge-blue">you</span>'}</td>
                </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div class="divide mt-0" >
            <h4 class="sub-h">Add New Admin</h4>
            <form id="addUserForm" class="row">
              <input type="email" id="newUserEmail" placeholder="Email" required class="in grow">
              <input type="text" id="newUserName" placeholder="Name (optional)" class="in grow">
              <button type="submit" class="btn btn-primary">Add Admin</button>
            </form>
            <div id="newUserResult" class="mt-m"></div>
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
          $('#newUserResult').innerHTML = res.data.emailed
            ? `
            <div class="alert alert-success">
              Admin created — invite emailed.<br>
              <small>You can also share this link directly:</small><br>
              <input type="text" value="${escapeHtml(res.data.invite_url)}" readonly onclick="this.select()" class="in mono mt-s">
            </div>
          `
            : `
            <div class="alert alert-warning">
              <b>Admin created, but no invite was sent</b> — outbound email is not configured, and the account cannot be used until they set a password.
              <b>Send them this link yourself:</b><br>
              <input type="text" value="${escapeHtml(res.data.invite_url)}" readonly onclick="this.select()" class="in mono mt-s">
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
          // "Sent" only when it was. This claimed delivery unconditionally, and
          // since the reset also revokes the old password, an operator who
          // believed it had locked somebody out with no way back.
          $('#usersMsg').innerHTML = res.data.emailed
            ? `<div class="alert alert-success">Password reset — link emailed.<br><small>Or share directly:</small><br><input type="text" value="${escapeHtml(res.data.invite_url)}" readonly onclick="this.select()" class="in mono mt-s"></div>`
            : `<div class="alert alert-warning"><b>Password reset, but no email was sent</b> — outbound email is not configured, and their old password no longer works. <b>Send them this link yourself:</b><br><input type="text" value="${escapeHtml(res.data.invite_url)}" readonly onclick="this.select()" class="in mono mt-s"></div>`;
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
            <div class="alert alert-success brk" >
              Key created! Copy these now — the secret will not be shown again.<br><br>
              <strong>Key ID:</strong> <code class="mono">${escapeHtml(d.key_id)}</code><br>
              <strong>Secret:</strong> <code class="mono">${escapeHtml(d.secret)}</code>
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
            <div class="stack">
              <div><strong>Active dev keys:</strong> ${d.active_keys}${d.active_keys === 0 ? ' <span class="badge badge-red">No keys!</span> — create one above' : ''}</div>
              ${d.keys.map(k => `<div class="codebox" style="padding:8px 10px">
                <code>${escapeHtml(k.key_id)}</code> (${escapeHtml(k.label || 'no label')})
                — Last used: <strong>${k.last_used ? timeAgo(k.last_used) : '<span class="t-alert">never</span>'}</strong>
                ${k.expires ? ` — Expires: ${new Date(k.expires).toLocaleDateString()}` : ''}
              </div>`).join('')}
              <div><strong>Recent ticket resolutions (via dev API):</strong></div>
              ${d.recent_resolves.length === 0 ? '<div class="dim">None — the dev API resolve endpoint has never been called successfully.</div>' :
                d.recent_resolves.map(r => `<div class="codebox" style="padding:7px 10px">
                  Ticket #${r.details.ticket_number || '?'} resolved by ${r.details.resolved_by || '?'} — ${timeAgo(r.at)}
                </div>`).join('')}
              <div><strong>Open tickets (${d.open_tickets.length}):</strong></div>
              ${d.open_tickets.length === 0 ? '<div class="t-ok">All tickets are closed!</div>' :
                d.open_tickets.map(t => `<div class="codebox" style="padding:7px 10px">
                  <a href="#/tickets/${t.id}" class="t-ok">#${t.ticket_number}</a> ${escapeHtml(t.title)}
                  <span class="badge badge-blue tiny" >${t.status}</span>
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

  // ===== RENDER: PROJECTS — DENSE CONSOLE =====
  /* One screen, two panes: the project list left, the selected project entire on
     the right. Both #/projects and #/projects/:id land here, and picking a project
     swaps the right pane only — no navigation round-trip, which is the whole point
     of the direction (handoff §3.1). Selection moves the hash with replaceState so
     the router is never re-entered; renderLayout() clears `mounted`, so rendering
     any other page invalidates the console for free.

     The Claude Code pane is deliberately gone (handoff §1). `cc.*` stays whole and
     functional for the Settings pairing card — it simply has no widget here. */
  const con = { mounted: false, projects: [], selected: null, detail: null, filter: '', planMode: null };

  const PROJ_STATUS = ['planning', 'proposed', 'approved', 'in_progress', 'review', 'completed', 'maintenance', 'archived'];
  const PROJ_BADGE = {
    planning: 'badge-gray', proposed: 'badge-yellow', approved: 'badge-blue', in_progress: 'badge-blue',
    review: 'badge-yellow', completed: 'badge-green', maintenance: 'badge-green', archived: 'badge-gray',
  };
  // the left pane's reading order: what is moving, then what is waiting, then what is done
  const PROJ_GROUPS = [
    ['in_progress', 'In progress'], ['review', 'In review'], ['approved', 'Approved'],
    ['proposed', 'Proposed'], ['planning', 'Planning'], ['maintenance', 'Maintenance'],
    ['completed', 'Completed'], ['archived', 'Archived'],
  ];
  const MS_STATUS = ['upcoming', 'in_progress', 'completed', 'skipped'];
  const TICKET_STATUS = ['open', 'in_progress', 'review', 'completed', 'closed'];

  /* SQLite hands back both "2026-08-16 10:11:12" and bare "2026-08-16". The +'Z'
     trick used elsewhere in this file silently yields Invalid Date on the second. */
  function toDate(s) {
    if (!s) return null;
    const str = String(s);
    const d = new Date(str.length <= 10 ? str + 'T00:00:00Z' : str.replace(' ', 'T') + 'Z');
    return isNaN(d.getTime()) ? null : d;
  }
  /* Formatted in UTC, which is what the column holds. Local formatting turns a
     bare "2026-08-29" into 28 Aug for anyone west of Greenwich — a target date
     that silently reads a day early is worse than no date at all. */
  function fmtDay(s) {
    const d = toDate(s);
    return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }) : null;
  }
  function daysTo(s) { const d = toDate(s); return d ? Math.round((d - new Date()) / 86400000) : null; }
  function daysSince(s) { const d = toDate(s); return d ? Math.round((new Date() - d) / 86400000) : null; }
  // the activity column is narrow: "2h" fits where "2 hours ago" does not
  function shortAgo(s) {
    const d = toDate(s);
    if (!d) return '';
    const sec = Math.floor((new Date() - d) / 1000);
    if (sec < 3600) return Math.max(1, Math.floor(sec / 60)) + 'm';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h';
    return Math.floor(sec / 86400) + 'd';
  }
  function parseTech(v) {
    if (!v) return [];
    try { const a = JSON.parse(v); return Array.isArray(a) ? a : [String(a)]; }
    catch { return String(v).split(/[,·]/).map(s => s.trim()).filter(Boolean); }
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : null; }

  async function renderProjects() { return renderConsole(null); }
  async function renderProjectDetail(projectId) { return renderConsole(projectId); }

  async function renderConsole(selectedId) {
    state.page = 'projects';  // one rail item lights for both routes

    // already on screen: this is a selection or a refresh, not a page load
    if (con.mounted && $('#cPanes')) return loadConsoleProjects(selectedId || con.selected);

    con.filter = '';
    con.planMode = null;
    renderLayout(`
      <div class="c-top">
        <h1>Projects</h1>
        <span class="badge badge-gray" id="cSummary">&nbsp;</span>
        <div class="c-k">
          <input id="cFilter" placeholder="Jump to a project" autocomplete="off" spellcheck="false" aria-label="Filter projects">
          <kbd>&#8984;</kbd><kbd>K</kbd>
        </div>
        <button class="btn btn-secondary btn-sm" id="newProjectBtn">New project</button>
      </div>
      <div class="c-new" id="newProject" hidden>${newProjectForm()}</div>
      <div class="c-panes" id="cPanes">
        <div class="c-list" id="cList"><div class="loading"><div class="spinner"></div></div></div>
        <div class="c-detail" id="cDetail"></div>
      </div>
    `, { wide: true });
    con.mounted = true;

    wireConsoleShell();
    await loadConsoleProjects(selectedId);
  }

  function newProjectForm() {
    return `
      <div class="card">
        <div class="card-header"><span class="card-title">Create project</span></div>
        <div id="newProjectMsg"></div>
        <form id="createProjectForm">
          <div class="grid-2">
            <div class="form-group">
              <label>Organization</label>
              <select id="projOrg" required><option value="">Select org&hellip;</option></select>
            </div>
            <div class="form-group">
              <label>Project name</label>
              <input type="text" id="projName" required placeholder="e.g. PCG Website Redesign">
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <input type="text" id="projDesc" placeholder="What the project is actually doing">
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Create</button>
        </form>
      </div>`;
  }

  function wireConsoleShell() {
    const filter = $('#cFilter');
    filter.addEventListener('input', () => { con.filter = filter.value.trim(); renderConsoleList(); });
    filter.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { filter.value = ''; con.filter = ''; renderConsoleList(); filter.blur(); }
      if (e.key === 'Enter') {
        const first = $('#cList .c-li');
        if (first) { selectConsoleProject(first.dataset.projectId); filter.blur(); }
      }
    });
    // ⌘K / Ctrl-K jumps to the filter from anywhere on the console
    if (!con.keyHandler) {
      con.keyHandler = (e) => {
        if (e.key !== 'k' || !(e.metaKey || e.ctrlKey)) return;
        const box = $('#cFilter');
        if (!box) return;
        e.preventDefault();
        box.focus();
        box.select();
      };
      window.addEventListener('keydown', con.keyHandler);
    }

    $('#newProjectBtn').addEventListener('click', async () => {
      const wrap = $('#newProject');
      wrap.hidden = !wrap.hidden;
      if (wrap.hidden) return;
      $('#projName').focus();
      try {
        const orgs = await api('/admin/clients');
        $('#projOrg').innerHTML = '<option value="">Select org&hellip;</option>' +
          orgs.data.organizations.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
      } catch (err) {
        $('#newProjectMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      }
    });

    $('#createProjectForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api('/admin/projects', {
          method: 'POST',
          body: JSON.stringify({ org_id: $('#projOrg').value, name: $('#projName').value, description: $('#projDesc').value }),
        });
        $('#newProject').hidden = true;
        e.target.reset();
        await loadConsoleProjects(res.data.project.id);
      } catch (err) {
        $('#newProjectMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      }
    });
  }

  async function loadConsoleProjects(selectedId) {
    try {
      const res = await api('/admin/projects');
      con.projects = res.data.projects || [];
    } catch (err) {
      const el = $('#cList');
      if (el) el.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      return;
    }

    const ids = con.projects.map(p => p.id);
    // an unknown id (deleted, or a stale link) falls back to the top of the list
    // rather than leaving the right pane dead
    let sel = selectedId && ids.includes(selectedId) ? selectedId : null;
    if (!sel) sel = con.projects.length ? con.projects[0].id : null;
    con.selected = sel;

    if (sel) {
      state.projectDetailId = sel;
      if (window.location.hash !== `#/projects/${sel}`) history.replaceState(null, '', `#/projects/${sel}`);
    }

    renderConsoleList();
    if (sel) await loadConsoleDetail(sel);
    else $('#cDetail').innerHTML = '<div class="empty-state"><p>No projects yet. Create one to get started.</p></div>';
  }

  function renderConsoleList() {
    const el = $('#cList');
    if (!el) return;
    const keepScroll = el.scrollTop;
    const q = con.filter.toLowerCase();
    const shown = q
      ? con.projects.filter(p => `${p.name} ${p.org_name || ''}`.toLowerCase().includes(q))
      : con.projects;

    let html = '';
    for (const [status, label] of PROJ_GROUPS) {
      const rows = shown.filter(p => p.status === status);
      if (rows.length) html += `<div class="c-lh">${label}</div>` + rows.map(consoleRow).join('');
    }
    // a status the group list has never heard of still has to reach the screen
    const known = PROJ_GROUPS.map(g => g[0]);
    const rest = shown.filter(p => !known.includes(p.status));
    if (rest.length) html += '<div class="c-lh">Other</div>' + rest.map(consoleRow).join('');

    el.innerHTML = html || `<div class="c-lh">${con.projects.length ? 'No match' : 'No projects yet'}</div>`;
    el.scrollTop = keepScroll;

    $$('#cList .c-li').forEach(r => r.addEventListener('click', () => selectConsoleProject(r.dataset.projectId)));

    const active = con.projects.filter(p => ['in_progress', 'review', 'approved'].includes(p.status)).length;
    const sum = $('#cSummary');
    if (sum) sum.textContent = `${active} active`;
  }

  function consoleRow(p) {
    const open = p.open_tickets || 0;
    // hot means severity, never volume — the two extra tones are restricted to it
    const hot = (p.urgent_tickets || 0) > 0 ? ' hot' : '';
    return `
      <div class="c-li${p.id === con.selected ? ' on' : ''}" data-project-id="${p.id}">
        <div>
          <div class="n">${escapeHtml(p.name)}</div>
          <div class="o">${escapeHtml(p.org_name || '')}</div>
        </div>
        <span class="c${hot}">${open || '&mdash;'}</span>
        <span class="bar"><i style="width:${p.progress_percent || 0}%"></i></span>
      </div>`;
  }

  async function selectConsoleProject(projectId) {
    if (!projectId || projectId === con.selected) return;
    con.selected = projectId;
    con.planMode = null;
    state.projectDetailId = projectId;
    // replaceState, not location.hash: assigning the hash would re-enter the
    // router and rebuild the whole screen, which is the round-trip we removed
    history.replaceState(null, '', `#/projects/${projectId}`);
    $$('#cList .c-li').forEach(r => r.classList.toggle('on', r.dataset.projectId === projectId));
    await loadConsoleDetail(projectId);
  }

  async function loadConsoleDetail(projectId) {
    const el = $('#cDetail');
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Loading&hellip;</div>';
    try {
      const res = await api(`/admin/projects/${projectId}`);
      if (con.selected !== projectId) return;  // a faster click already won
      con.detail = res.data;
      renderConsoleDetail(projectId, res.data);
    } catch (err) {
      el.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  /* Refresh after a mutation. Almost everything here moves a number the left pane
     shows too — progress, status group, open-ticket count — so the list is
     re-fetched by default rather than drifting out of agreement with the detail. */
  async function refreshConsole(projectId, opts) {
    if (!opts || opts.list !== false) {
      try {
        const res = await api('/admin/projects');
        con.projects = res.data.projects || [];
        renderConsoleList();
      } catch { /* the detail reload below will surface anything real */ }
    }
    await loadConsoleDetail(projectId);
  }

  function renderConsoleDetail(projectId, data) {
    const { project, milestones, plan, members, recentActivity } = data;
    const el = $('#cDetail');
    const doneCount = milestones.filter(m => m.status === 'completed').length;
    const started = project.start_date || project.created_at;
    const active = daysSince(started);
    const left = project.target_date ? daysTo(project.target_date) : null;
    const live = safeUrl(project.live_url);
    const repo = safeUrl(project.repo_url);

    const sub = [];
    if (project.org_name) sub.push(escapeHtml(project.org_name));
    if (fmtDay(started)) sub.push(`started ${fmtDay(started)}`);
    if (fmtDay(project.target_date)) sub.push(`target ${fmtDay(project.target_date)}`);
    if (project.scaffolded_at && fmtDay(project.scaffolded_at)) sub.push(`scaffolded ${fmtDay(project.scaffolded_at)}`);
    if (repo) sub.push(`<a href="${escapeHtml(repo)}" target="_blank" rel="noopener">repo &#8599;</a>`);
    if (live) sub.push(`<a href="${escapeHtml(live)}" target="_blank" rel="noopener">${escapeHtml(live.replace(/^https?:\/\//i, ''))} &#8599;</a>`);
    if (project.description) sub.push(escapeHtml(project.description));

    const leftClass = left === null ? '' : left < 0 ? ' class="hot"' : left <= 7 ? ' class="warn"' : '';
    const leftText = left === null ? '&mdash;' : left < 0 ? `−${Math.abs(left)}` : String(left);

    el.innerHTML = `
      <div class="c-dh">
        <h2>${escapeHtml(project.name)}</h2>
        <span class="badge ${PROJ_BADGE[project.status] || 'badge-gray'}">${escapeHtml(project.status.replace(/_/g, ' '))}</span>
        <div class="sp">
          ${parseTech(project.tech_stack).map(t => `<span class="badge badge-gray">${escapeHtml(t)}</span>`).join('')}
          <select class="c-sel" id="statusSelect" aria-label="Project status">
            ${PROJ_STATUS.map(s => `<option value="${s}"${s === project.status ? ' selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
          </select>
        </div>
      </div>
      ${sub.length ? `<p class="c-sub">${sub.join(' &middot; ')}</p>` : ''}
      <div id="cMsg"></div>

      <div class="c-stats">
        <div class="c-stat"><b>${project.progress_percent || 0}%</b><span>Progress</span></div>
        <div class="c-stat"><b>${doneCount} / ${milestones.length}</b><span>Milestones</span></div>
        <div class="c-stat"><b id="cStatOpen">&mdash;</b><span>Open tickets</span></div>
        <div class="c-stat"><b>${active === null ? '&mdash;' : active}</b><span>Days active</span></div>
        <div class="c-stat"><b${leftClass}>${leftText}</b><span>Days remaining</span></div>
      </div>

      <div class="c-cols">
        <div class="c-blk">
          <h4>Milestones<button class="hact" id="addMsBtn">Add</button></h4>
          <div id="addMsForm" hidden>
            <div class="c-inline">
              <input type="text" id="msTitle" placeholder="Milestone title">
              <input type="date" id="msDate" aria-label="Target date">
              <button class="btn btn-primary btn-sm" id="saveMsBtn">Save</button>
            </div>
          </div>
          ${milestones.length
            ? `<div class="c-ms">${milestones.map(milestoneRow).join('')}</div>`
            : '<p class="c-none">No milestones yet.</p>'}

          <div class="sub-blk">
            <h4>Plan${plan ? '<button class="hact" data-plan="view">View</button>' : ''}<button class="hact" data-plan="edit">${plan ? 'Edit' : 'Create'}</button>${plan ? '<button class="hact" data-plan="history">History</button>' : ''}</h4>
            <div class="c-meta">${planMeta(plan, project)}</div>
          </div>

          <div class="sub-blk">
            <h4>Members<button class="hact" id="addMemberBtn">Add</button></h4>
            <div id="addMemberForm" hidden>
              <div class="c-inline"><input type="text" id="memberSearch" placeholder="Search by name or email&hellip;"></div>
              <div id="memberSearchResults"></div>
            </div>
            ${members.length
              ? `<div class="c-av">${members.map(m => `
                  <span class="avatar" data-user-id="${m.user_id}" data-name="${escapeHtml(m.name || m.email)}"
                        title="${escapeHtml(m.name || '')} (${escapeHtml(m.email)}) &mdash; click to remove">${initials(m.name || m.email)}</span>`).join('')}</div>`
              : '<p class="c-none">No members assigned.</p>'}
          </div>
        </div>

        <div class="c-blk">
          <h4>Tickets</h4>
          <div id="ticketsSection"><div class="loading"><div class="spinner"></div></div></div>

          <div class="c-log">
            <h4>Activity</h4>
            ${recentActivity.length
              ? recentActivity.slice(0, 8).map(activityRow).join('') +
                // say what was dropped rather than letting eight rows read as all of it
                (recentActivity.length > 8
                  ? `<div class="c-lr"><span class="c-none">+${recentActivity.length - 8} older</span><span class="t"></span></div>`
                  : '')
              : '<p class="c-none">No activity yet.</p>'}
          </div>
        </div>
      </div>

      <div class="c-panel" id="planPanel" hidden></div>
    `;

    wireConsoleDetail(projectId, data);
    loadConsoleTickets(projectId);
  }

  function milestoneRow(m) {
    const done = m.status === 'completed';
    const now = m.status === 'in_progress';
    const late = now && m.target_date && daysTo(m.target_date) < 0;
    const day = fmtDay(m.target_date);
    return `
      <div class="c-m${done ? ' is-done' : ''}" data-ms-id="${m.id}">
        <span class="mk${done ? ' done' : now ? ' now' : ''}"></span>
        <span class="mn">${escapeHtml(m.title)}</span>
        <span class="mrt">
          ${day ? `<span class="md${late ? ' late' : ''}">${day}${late ? ` &middot; −${Math.abs(daysTo(m.target_date))}` : ''}</span>` : ''}
          <select class="c-sel ms-status-select" data-ms-id="${m.id}" aria-label="Milestone status">
            ${MS_STATUS.map(s => `<option value="${s}"${s === m.status ? ' selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
          </select>
          <button class="mdel ms-delete" data-ms-id="${m.id}" title="Delete milestone" aria-label="Delete milestone">&#10005;</button>
        </span>
      </div>`;
  }

  /* approved_at, not an inference from project.status — a project can be moved to
     in_progress by hand without the client ever having pressed Approve, and this
     line is the only place that difference is visible. */
  function planMeta(plan, project) {
    if (!plan) return 'No plan yet.';
    const bits = [`<b>v${plan.version}</b>`];
    if (plan.approved_at) bits.push(`approved ${fmtDay(plan.approved_at) || ''}`);
    else if (project.status === 'proposed') bits.push('awaiting client approval');
    else bits.push('not approved');
    if (plan.updated_at) bits.push(`last edited ${fmtDay(plan.updated_at) || ''}`);
    return bits.join(' &middot; ');
  }

  function activityRow(a) {
    let d = {};
    try { d = a.details ? JSON.parse(a.details) : {}; } catch { d = {}; }
    const what = d.title || d.name || d.new_status || d.version || '';
    return `
      <div class="c-lr">
        <span><b>${escapeHtml(a.user_name || a.user_email || 'System')}</b> ${escapeHtml(a.action.replace(/_/g, ' '))}${what ? ` &mdash; ${escapeHtml(String(what))}` : ''}${d.is_internal ? ' <em>internal</em>' : ''}</span>
        <span class="t">${shortAgo(a.created_at)}</span>
      </div>`;
  }

  function wireConsoleDetail(projectId, data) {
    const { members } = data;

    const note = (html) => {
      const el = $('#cMsg');
      if (!el) return;
      el.innerHTML = html;
      setTimeout(() => { const n = $('#cMsg'); if (n) n.innerHTML = ''; }, 2500);
    };

    // ----- project status
    $('#statusSelect').addEventListener('change', async (e) => {
      try {
        await api(`/admin/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) });
        await refreshConsole(projectId);
      } catch (err) {
        note(`<div class="alert alert-error">${escapeHtml(err.message)}</div>`);
      }
    });

    // ----- milestones
    $('#addMsBtn').addEventListener('click', () => {
      const form = $('#addMsForm');
      form.hidden = !form.hidden;
      if (!form.hidden) $('#msTitle').focus();
    });
    const saveMilestone = async () => {
      const title = $('#msTitle').value.trim();
      if (!title) return;
      try {
        await api(`/admin/projects/${projectId}/milestones`, {
          method: 'POST',
          body: JSON.stringify({ title, target_date: $('#msDate').value || null }),
        });
        await refreshConsole(projectId);
      } catch (err) { note(`<div class="alert alert-error">${escapeHtml(err.message)}</div>`); }
    };
    $('#saveMsBtn').addEventListener('click', saveMilestone);
    $('#msTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveMilestone(); } });

    $$('.ms-status-select').forEach(sel => sel.addEventListener('change', async (e) => {
      try {
        await api(`/admin/milestones/${e.target.dataset.msId}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) });
        await refreshConsole(projectId);
      } catch (err) { note(`<div class="alert alert-error">${escapeHtml(err.message)}</div>`); }
    }));

    $$('.ms-delete').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this milestone?')) return;
      try {
        await api(`/admin/milestones/${btn.dataset.msId}`, { method: 'DELETE' });
        await refreshConsole(projectId);
      } catch (err) { note(`<div class="alert alert-error">${escapeHtml(err.message)}</div>`); }
    }));

    // ----- members
    $('#addMemberBtn').addEventListener('click', () => {
      const form = $('#addMemberForm');
      form.hidden = !form.hidden;
      if (!form.hidden) $('#memberSearch').focus();
    });

    let searchTimer;
    $('#memberSearch').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      const q = e.target.value.trim();
      const out = $('#memberSearchResults');
      if (q.length < 2) { out.innerHTML = ''; return; }
      searchTimer = setTimeout(async () => {
        try {
          const res = await api(`/admin/users/search?q=${encodeURIComponent(q)}`);
          const taken = members.map(m => m.user_id);
          const available = res.data.users.filter(u => !taken.includes(u.id));
          if (!available.length) { out.innerHTML = '<p class="c-none">No matching users.</p>'; return; }
          out.innerHTML = available.map(u => `
            <div class="c-vr member-search-row" data-user-id="${u.id}">
              <span class="avatar">${initials(u.name || u.email)}</span>
              <span>${escapeHtml(u.name || '')} <span class="dim">${escapeHtml(u.email)}</span></span>
              <span class="sp"><button class="btn btn-secondary btn-sm">Add</button></span>
            </div>`).join('');
          $$('.member-search-row').forEach(row => row.addEventListener('click', async () => {
            try {
              await api(`/admin/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ user_id: row.dataset.userId }) });
              await refreshConsole(projectId, { list: false });
            } catch (err) { out.innerHTML = `<p class="c-none">${escapeHtml(err.message)}</p>`; }
          }));
        } catch (err) { out.innerHTML = `<p class="c-none">${escapeHtml(err.message)}</p>`; }
      }, 300);
    });

    $$('.c-av .avatar').forEach(chip => chip.addEventListener('click', async () => {
      if (!confirm(`Remove ${chip.dataset.name} from this project?`)) return;
      try {
        await api(`/admin/projects/${projectId}/members/${chip.dataset.userId}`, { method: 'DELETE' });
        await refreshConsole(projectId, { list: false });
      } catch (err) { note(`<div class="alert alert-error">${escapeHtml(err.message)}</div>`); }
    }));

    // ----- plan: too wide for a .82fr column, so it opens under both panes
    $$('[data-plan]').forEach(btn => btn.addEventListener('click', () => openPlanPanel(projectId, btn.dataset.plan)));
    if (con.planMode) openPlanPanel(projectId, con.planMode, true);
  }

  function openPlanPanel(projectId, mode, force) {
    const el = $('#planPanel');
    if (!el) return;
    if (!force && con.planMode === mode) mode = null;   // clicking the lit action closes it
    con.planMode = mode;
    $$('[data-plan]').forEach(b => b.classList.toggle('off', !!mode && b.dataset.plan !== mode));

    if (!mode) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;

    const { project, plan } = con.detail;
    if (mode === 'view') {
      el.innerHTML = `
        <div class="ph"><h4>Plan &middot; v${plan.version}</h4><div class="sp"><button class="btn btn-secondary btn-sm" data-plan-close>Close</button></div></div>
        <div class="pv md-rendered">${renderMarkdown(escapeHtml(plan.content))}</div>`;
    } else if (mode === 'edit') {
      const canPropose = ['planning', 'proposed'].includes(project.status) && plan;
      el.innerHTML = `
        <div class="ph">
          <h4>${plan ? `Edit plan &middot; v${plan.version}` : 'Create plan'}</h4>
          <div class="sp">
            <button class="filter-tab planTabBtn active" data-tab="write">Write</button>
            <button class="filter-tab planTabBtn" data-tab="preview">Preview</button>
            <button class="btn btn-primary btn-sm" id="savePlanBtn">Save</button>
            ${canPropose ? `<button class="btn btn-secondary btn-sm" id="proposePlanBtn">${project.status === 'proposed' ? 'Re-send to client' : 'Send to client'}</button>` : ''}
            <span id="planMsg"></span>
            <button class="btn btn-secondary btn-sm" data-plan-close>Close</button>
          </div>
        </div>
        <textarea id="planContent" spellcheck="false">${plan ? escapeHtml(plan.content) : ''}</textarea>
        <div class="pv md-rendered" id="planPreview" hidden></div>`;

      $$('.planTabBtn').forEach(btn => btn.addEventListener('click', () => {
        $$('.planTabBtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const preview = btn.dataset.tab === 'preview';
        $('#planContent').hidden = preview;
        $('#planPreview').hidden = !preview;
        if (preview) $('#planPreview').innerHTML = renderMarkdown(escapeHtml($('#planContent').value));
      }));

      $('#savePlanBtn').addEventListener('click', async () => {
        const msg = $('#planMsg');
        try {
          const res = await api(`/admin/projects/${projectId}/plan`, { method: 'POST', body: JSON.stringify({ content: $('#planContent').value }) });
          if (msg) msg.innerHTML = `<span class="badge badge-green">Saved v${res.data.version}</span>`;
          // the meta line and the version number both moved; keep the panel open
          const text = $('#planContent').value;
          await loadConsoleDetail(projectId);
          con.planMode = 'edit';
          openPlanPanel(projectId, 'edit', true);
          $('#planContent').value = text;
        } catch (err) {
          if (msg) msg.innerHTML = `<span class="badge badge-red">${escapeHtml(err.message)}</span>`;
        }
      });

      const propose = $('#proposePlanBtn');
      if (propose) propose.addEventListener('click', async () => {
        if (!confirm('This sends the plan to the client for approval. Continue?')) return;
        try {
          await api(`/admin/projects/${projectId}/plan`, { method: 'POST', body: JSON.stringify({ content: $('#planContent').value }) });
          await api(`/admin/projects/${projectId}/propose`, { method: 'POST' });
          con.planMode = null;
          await refreshConsole(projectId);
        } catch (err) { alert(err.message); }
      });
    } else if (mode === 'history') {
      el.innerHTML = `
        <div class="ph"><h4>Plan history</h4><div class="sp"><button class="btn btn-secondary btn-sm" data-plan-close>Close</button></div></div>
        <div class="loading"><div class="spinner"></div></div>`;
      (async () => {
        try {
          const res = await api(`/admin/projects/${projectId}/plan/versions`);
          const versions = res.data.versions;
          const body = versions.length
            ? versions.map(v => `
                <div class="c-vr">
                  <b>v${v.version}</b>
                  <span class="dim">${escapeHtml(v.saved_by_name || 'Unknown')} &middot; ${timeAgo(v.created_at)}</span>
                  <span class="sp">
                    <button class="btn btn-secondary btn-sm" data-view-version="${v.id}">View</button>
                    <button class="btn btn-secondary btn-sm" data-restore-version="${v.id}" data-ver="${v.version}">Restore</button>
                  </span>
                </div>`).join('')
            : '<p class="c-none">No previous versions.</p>';
          el.innerHTML = `
            <div class="ph"><h4>Plan history</h4><div class="sp"><button class="btn btn-secondary btn-sm" data-plan-close>Close</button></div></div>
            ${body}
            <div class="pv md-rendered" id="versionPreview" hidden></div>`;
          wirePlanClose(projectId);
          $$('[data-view-version]').forEach(btn => btn.addEventListener('click', async () => {
            try {
              const v = await api(`/admin/projects/${projectId}/plan/versions/${btn.dataset.viewVersion}`);
              const pv = $('#versionPreview');
              pv.hidden = false;
              pv.innerHTML = renderMarkdown(escapeHtml(v.data.version.content));
            } catch (err) { alert(err.message); }
          }));
          $$('[data-restore-version]').forEach(btn => btn.addEventListener('click', async () => {
            if (!confirm(`Restore to v${btn.dataset.ver}? The current plan is saved as a new version first.`)) return;
            try {
              await api(`/admin/projects/${projectId}/plan/restore/${btn.dataset.restoreVersion}`, { method: 'POST' });
              con.planMode = null;
              await refreshConsole(projectId);
            } catch (err) { alert(err.message); }
          }));
        } catch (err) {
          el.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      })();
    }
    wirePlanClose(projectId);
  }

  function wirePlanClose(projectId) {
    $$('[data-plan-close]').forEach(b => b.addEventListener('click', () => openPlanPanel(projectId, null, true)));
  }

  /* Tickets load separately from the project detail, so the open-ticket stat is
     filled in when they land rather than guessed from the list row. */
  async function loadConsoleTickets(projectId) {
    const el = $('#ticketsSection');
    if (!el) return;
    try {
      const res = await api(`/admin/projects/${projectId}/tickets`);
      if (con.selected !== projectId) return;
      const tickets = res.data.tickets;
      const openCount = tickets.filter(t => ['open', 'in_progress'].includes(t.status)).length;
      const stat = $('#cStatOpen');
      if (stat) {
        stat.textContent = openCount || '—';
        stat.className = tickets.some(t => ['open', 'in_progress'].includes(t.status) && ['urgent', 'high'].includes(t.priority)) ? 'hot' : '';
      }

      el.innerHTML = tickets.length ? `
        <table class="c-tb">
          <thead><tr><th style="width:26px">#</th><th>Title</th><th style="width:64px">Type</th><th style="width:56px">Pri</th><th style="width:104px">Status</th></tr></thead>
          <tbody>${tickets.map(t => `
            <tr data-ticket-id="${t.id}">
              <td class="num">${t.ticket_number}</td>
              <td class="ti">${escapeHtml(t.title)}</td>
              <td class="num">${escapeHtml(t.type.replace(/_/g, ' '))}</td>
              <td><span class="badge ${t.priority === 'urgent' ? 'badge-red' : t.priority === 'high' ? 'badge-yellow' : 'badge-gray'}">${escapeHtml(t.priority)}</span></td>
              <td>
                <select class="c-sel inline-ticket-status" data-ticket-id="${t.id}" data-prev="${t.status}" aria-label="Ticket status">
                  ${TICKET_STATUS.map(s => `<option value="${s}"${s === t.status ? ' selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
                </select>
              </td>
            </tr>`).join('')}</tbody>
        </table>` : '<p class="c-none">No tickets yet.</p>';

      $$('#ticketsSection tr[data-ticket-id]').forEach(row => row.addEventListener('click', (e) => {
        if (e.target.closest('.inline-ticket-status')) return;
        window.location.hash = `#/tickets/${row.dataset.ticketId}`;
      }));

      // the inline dropdown is how tickets move now — it is not a shortcut
      $$('.inline-ticket-status').forEach(sel => sel.addEventListener('change', async () => {
        const prev = sel.dataset.prev;
        try {
          await api(`/admin/tickets/${sel.dataset.ticketId}`, { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
          await refreshConsole(projectId);
        } catch (err) {
          sel.value = prev;
          alert('Status update failed: ' + err.message);
        }
      }));
    } catch (err) {
      el.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
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
        <a href="#/projects/${ticket.project_id || ''}" class="back">&larr; Back to the project</a>

        <div class="t-head">
          <div>
            <h1>#${ticket.ticket_number} — ${escapeHtml(ticket.title)}</h1>
            <div class="sub">
              ${escapeHtml(ticket.project_name || '')} &middot;
              opened by ${escapeHtml(ticket.created_by_name || ticket.created_by_email)} &middot;
              ${timeAgo(ticket.created_at)}
            </div>
          </div>
          <div class="sp">
            <select class="c-sel" id="ticketPriority" aria-label="Priority">
              ${priorityOpts.map(p => `<option value="${p}"${p === ticket.priority ? ' selected' : ''}>${p}</option>`).join('')}
            </select>
            <select class="c-sel" id="ticketStatus" aria-label="Status">
              ${statusOpts.map(s => `<option value="${s}"${s === ticket.status ? ' selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="ticketUpdateMsg"></div>

        ${ticket.description ? `<div class="t-desc">${escapeHtml(ticket.description)}</div>` : ''}

        <div class="card">
          <div class="card-header"><span class="card-title">Attachments (${attachments.length}/10)</span></div>
          <div id="attachmentsList">
            ${attachments.length === 0 ? '<p class="hint mb-0">No files attached.</p>' : `
              <div class="att">
                ${attachments.map(a => `
                  <div class="att-row" data-att-id="${a.id}">
                    <span class="ic">${fileIcon(a.mimetype)}</span>
                    <a href="#" class="nm att-download" data-id="${a.id}" data-name="${escapeHtml(a.filename)}"
                       title="${escapeHtml(a.filename)}">${escapeHtml(a.filename)}</a>
                    <span class="meta">${formatFileSize(a.size)}</span>
                    <span class="meta up">${escapeHtml(a.uploaded_by_name || '')}</span>
                    <span class="meta wh">${timeAgo(a.uploaded_at)}</span>
                    <button class="x att-delete" data-id="${a.id}" title="Delete attachment" aria-label="Delete attachment">&#10005;</button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
          ${attachments.length < 10 ? `
            <div class="divide">
              <div id="uploadDropZone" class="drop">
                <b>Drop files here, or <u>browse</u></b>
                <span>Max 10MB each. Images, PDFs, docs, spreadsheets, CSV, ZIP.</span>
                <input type="file" id="fileInput" multiple hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip">
              </div>
              <div id="uploadProgress" class="mt-s"></div>
              <div id="uploadMsg" class="mt-s"></div>
            </div>
          ` : ''}
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Comments (${comments.length})</span></div>
          ${comments.length ? comments.map(c => `
            <div class="cmt ${c.is_internal ? 'is-internal' : c.user_role === 'client' ? 'is-client' : 'is-team'}">
              <div class="cmt-h">
                <span class="who">${escapeHtml(c.user_name || c.user_email)}</span>
                <span class="badge ${c.is_internal ? 'badge-yellow' : c.user_role === 'client' ? 'badge-green' : 'badge-blue'}">${c.is_internal ? 'internal' : c.user_role}</span>
                <span class="tm">${timeAgo(c.created_at)}</span>
              </div>
              <div class="cmt-b">${escapeHtml(c.body)}</div>
            </div>
          `).join('') : '<p class="hint mb-0">No comments yet.</p>'}

          <div class="cmt-form">
            <textarea id="newComment" placeholder="Add a comment&hellip;"></textarea>
            <div class="row mt-m">
              <button class="btn btn-primary btn-sm" id="postPublicBtn">Post — the client sees this</button>
              <button class="btn btn-warn btn-sm" id="postInternalBtn">Post internal note</button>
            </div>
            <div id="commentMsg" class="mt-s"></div>
          </div>
        </div>
      `;

      // Status/priority change — re-render full page to confirm update took effect
      const updateTicket = async (field, value) => {
        try {
          const res = await api(`/admin/tickets/${ticketId}`, { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
          // Verify the server actually persisted the change
          if (res.data.ticket && field === 'status' && res.data.ticket.status !== value) {
            $('#ticketUpdateMsg').innerHTML = `<div class="alert alert-error mb-m" >Status change failed — server still reports: ${res.data.ticket.status}</div>`;
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
        if (progressEl) progressEl.innerHTML = '<div class="hint mb-0">Uploading...</div>';
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
        // .over rather than an inline borderColor, so the hover and drag states
        // are one rule in the stylesheet instead of two colours in two places
        dropZone.addEventListener('click', () => fileInput && fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('over'); uploadFiles(e.dataTransfer.files); });
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
        <div class="c-top">
          <h1>Clients</h1>
          <span class="badge badge-gray">${orgs.length} organisation${orgs.length !== 1 ? 's' : ''}</span>
          <button class="btn btn-secondary btn-sm ml-auto" id="newOrgBtn" >New client</button>
        </div>

        <div class="c-new" id="newOrgForm" hidden>
          <div class="card">
            <div class="card-header"><span class="card-title">Create organisation</span></div>
            <div id="newOrgMsg"></div>
            <form id="createOrgForm" class="row">
              <input type="text" id="orgName" class="in grow" placeholder="Company name" required>
              <input type="email" id="orgEmail" class="in grow" placeholder="Primary email" required>
              <button type="submit" class="btn btn-primary btn-sm">Create</button>
            </form>
          </div>
        </div>

        ${orgs.length === 0 ? '<div class="empty-state"><p>No clients yet. Create one to get started.</p></div>' :
          orgs.map(o => `
            <div class="card org">
              <div class="card-header">
                <span class="card-title">${escapeHtml(o.name)}</span>
                <span class="meta">${escapeHtml(o.primary_email)}</span>
              </div>
              <div class="who">
                <span>${o.project_count} project${o.project_count !== 1 ? 's' : ''}</span>
                <span>${o.user_count} portal user${o.user_count !== 1 ? 's' : ''}</span>
                <span>created ${timeAgo(o.created_at)}</span>
              </div>
              <div class="divide mt-0" >
                <div class="row mb-m">
                  <span class="sub-h mb-0">Portal users</span>
                  <button class="btn btn-secondary btn-sm add-user-btn ml-auto" data-org-id="${o.id}" >Add user</button>
                </div>
                <div id="addUserForm-${o.id}" class="mb-m" hidden>
                  <div class="row">
                    <input type="email" placeholder="Email" class="in grow new-client-email">
                    <input type="text" placeholder="Name" class="in grow new-client-name">
                    <button class="btn btn-primary btn-sm save-client-btn" data-org-id="${o.id}">Create</button>
                  </div>
                  <div class="new-client-result mt-s"></div>
                </div>
                <div id="usersList-${o.id}" class="hint mb-0">Loading&hellip;</div>
              </div>
            </div>
          `).join('')}
      `;

      // New org toggle + handler
      $('#newOrgBtn').addEventListener('click', () => {
        const form = $('#newOrgForm');
        form.hidden = !form.hidden;
        if (!form.hidden) $('#orgName').focus();
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
          el.className = 'org-users';
          el.innerHTML = users.length === 0 ? '<p class="hint mb-0">No portal users yet.</p>' :
            users.map(u => `
              <div class="org-user" data-user-row="${u.id}">
                <span class="em">${escapeHtml(u.email)}${u.is_cross_org ? ' <span class="badge badge-blue mini">cross-org</span>' : ''}</span>
                <span class="dim">${escapeHtml(u.name || '—')}</span>
                <span>${u.must_change_password ? '<span class="badge badge-yellow">pending</span>' : '<span class="badge badge-green">active</span>'}</span>
                <span class="acts">
                  <button class="btn btn-secondary btn-sm client-reset-pw" data-org-id="${o.id}" data-user-id="${u.id}"
                          data-email="${escapeHtml(u.email).replace(/"/g, '&quot;')}">Reset</button>
                  <button class="btn btn-danger btn-sm client-delete-user" data-org-id="${o.id}" data-user-id="${u.id}"
                          data-email="${escapeHtml(u.email).replace(/"/g, '&quot;')}" data-cross-org="${u.is_cross_org ? 1 : 0}">Remove</button>
                </span>
              </div>`).join('');
        } catch (e) { /* one org failing to list users must not blank the page */ }
      }

      // Add user toggles
      $$('.add-user-btn').forEach(btn => btn.addEventListener('click', () => {
        const form = $(`#addUserForm-${btn.dataset.orgId}`);
        form.hidden = !form.hidden;
        if (!form.hidden) form.querySelector('.new-client-email').focus();
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
            : res.data.emailed
              ? `<div class="alert alert-success">Created — the invite went out by email.
                   <input type="text" class="in mono mt-s" value="${escapeHtml(res.data.invite_url)}" readonly
                          aria-label="Invite link">
                 </div>`
              : `<div class="alert alert-warning"><b>Created, but the invite did not send</b> — outbound email is not configured. Their account cannot be used until they set a password, so <b>send them this link yourself:</b>
                   <input type="text" class="in mono mt-s" value="${escapeHtml(res.data.invite_url)}" readonly
                          aria-label="Invite link">
                 </div>`;
          const box = result.querySelector('input');
          if (box) box.addEventListener('click', () => box.select());
          setTimeout(() => renderClients(), 4000);
        } catch (err) { result.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
      }));

      // Reset client user password
      $$('.client-reset-pw').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm(`Reset the password for ${btn.dataset.email}?`)) return;
        try {
          const res = await api(`/auth/users/${btn.dataset.userId}/reset`, { method: 'POST' });
          const cell = btn.closest('.acts');
          cell.innerHTML = `<input type="text" class="in mono" value="${escapeHtml(res.data.invite_url)}" readonly aria-label="Reset link">`;
          const box = cell.querySelector('input');
          box.addEventListener('click', () => box.select());
          setTimeout(() => renderClients(), 6000);
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
          <div class="login-logo" role="img" aria-label="kaymen.dev"></div>
          <h2 class="login-title">Set Up Your Password</h2>
          <div id="inviteMsg"><div class="loading"><div class="spinner"></div> Validating invite...</div></div>
          <form id="inviteForm" hidden>
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
      $('#inviteInfo').innerHTML = `<p class="hint">Welcome${user.name ? ', <strong>' + escapeHtml(user.name) + '</strong>' : ''}! Set your password to get started.</p>`;
      $('#inviteForm').hidden = false;
      $('#invitePass').focus();
    } catch (err) {
      $('#inviteMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div><p class="mt-m"><a href="#/login" class="t-ok">Go to login</a></p>`;
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

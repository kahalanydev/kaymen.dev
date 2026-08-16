/* Client Portal SPA — kaymen.dev */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/portal/sw.js').catch(() => {});
}

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const app = document.getElementById('app');

  // Load saved theme
  if (localStorage.getItem('portal_theme') === 'light') document.documentElement.setAttribute('data-theme', 'light');

  // ===== STATE =====
  const state = {
    token: localStorage.getItem('portal_token'),
    user: null,
    page: 'dashboard',
    projectId: null,
    ticketId: null,
    sidebarOpen: false
  };

  // ===== API =====
  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const res = await fetch(`/api${path}`, { ...opts, headers });
    if (res.status === 401) {
      state.token = null; state.user = null;
      localStorage.removeItem('portal_token');
      render();
      throw new Error('Session expired');
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
    } catch { return false; }
  }

  async function login(email, password) {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (!['client', 'admin', 'staff'].includes(res.data.user.role)) {
      throw new Error('Access denied');
    }
    state.token = res.data.token;
    state.user = res.data.user;
    localStorage.setItem('portal_token', state.token);
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
    state.token = null; state.user = null;
    localStorage.removeItem('portal_token');
    window.location.hash = '';
    render();
  }

  // ===== HELPERS =====
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const seconds = Math.floor((new Date() - new Date(dateStr + 'Z')) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(dateStr + 'Z').toLocaleDateString();
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function statusBadge(status) {
    const map = {
      planning: 'badge-gray', proposed: 'badge-purple', approved: 'badge-blue',
      in_progress: 'badge-blue', review: 'badge-yellow', completed: 'badge-green',
      maintenance: 'badge-green', archived: 'badge-gray',
      open: 'badge-blue', closed: 'badge-gray',
      upcoming: 'badge-gray'
    };
    return `<span class="badge ${map[status] || 'badge-gray'}">${status.replace(/_/g, ' ')}</span>`;
  }

  function priorityBadge(priority) {
    const map = { urgent: 'badge-red', high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray' };
    return `<span class="badge ${map[priority] || 'badge-gray'}">${priority}</span>`;
  }

  function typeBadge(type) {
    const map = { bug: 'badge-red', feature_request: 'badge-purple', modification: 'badge-yellow', question: 'badge-blue', task: 'badge-gray', maintenance: 'badge-green' };
    return `<span class="badge ${map[type] || 'badge-gray'}">${type.replace(/_/g, ' ')}</span>`;
  }

  function milestoneIcon(status) {
    const icons = { completed: '\u2713', in_progress: '\u25B6', upcoming: '\u25CB', skipped: '\u2014' };
    return icons[status] || '\u25CB';
  }

  function progressRing(percent, size = 100, stroke = 8) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (percent / 100) * c;
    const color = percent >= 100 ? 'var(--success)' : 'var(--accent)';
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="progress-ring">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
        transform="rotate(-90 ${size/2} ${size/2})" style="transition:stroke-dashoffset 0.8s ease"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        style="font-size:${size * 0.24}px;font-weight:700;fill:var(--text);font-family:var(--mono)">${percent}%</text>
    </svg>`;
  }

  function activityIcon(action) {
    const map = {
      project_created: '&#9733;', project_proposed: '&#9993;', project_approved: '&#10003;',
      project_status_changed: '&#9881;', milestone_created: '&#9873;', milestone_status_changed: '&#9632;',
      ticket_created: '&#9998;', ticket_status_changed: '&#8635;', comment_added: '&#128172;',
      plan_updated: '&#128196;'
    };
    return map[action] || '&#8226;';
  }

  const phaseSteps = ['planning','proposed','approved','in_progress','review','completed','maintenance'];
  function phaseIndicator(status) {
    const idx = phaseSteps.indexOf(status);
    return `<div class="phase-bar">${phaseSteps.map((s, i) => `
      <div class="phase-step ${i < idx ? 'done' : i === idx ? 'active' : ''}">
        <div class="phase-dot">${i < idx ? '&#10003;' : i + 1}</div>
        <div class="phase-label">${s.replace(/_/g, ' ')}</div>
      </div>
      ${i < phaseSteps.length - 1 ? `<div class="phase-line ${i < idx ? 'done' : ''}"></div>` : ''}
    `).join('')}</div>`;
  }

  function activityText(a) {
    const d = a.details ? (typeof a.details === 'string' ? JSON.parse(a.details) : a.details) : {};
    const who = a.user_name || 'System';
    switch (a.action) {
      case 'project_created': return `<strong>${escapeHtml(who)}</strong> created the project`;
      case 'project_proposed': return `<strong>${escapeHtml(who)}</strong> sent the project plan for review`;
      case 'project_approved': return `<strong>${escapeHtml(who)}</strong> approved the project`;
      case 'project_status_changed': return `<strong>${escapeHtml(who)}</strong> changed status to <strong>${d.new_status || '?'}</strong>`;
      case 'milestone_created': return `<strong>${escapeHtml(who)}</strong> added milestone: ${escapeHtml(d.title || '')}`;
      case 'milestone_status_changed': return `<strong>${escapeHtml(who)}</strong> marked <strong>${escapeHtml(d.title || '')}</strong> as ${d.new_status || '?'}`;
      case 'ticket_created': return `<strong>${escapeHtml(who)}</strong> created ticket #${d.ticket_number}: ${escapeHtml(d.title || '')}`;
      case 'ticket_status_changed': return `<strong>${escapeHtml(who)}</strong> changed ticket #${d.ticket_number} to ${d.new_status || '?'}`;
      case 'comment_added': return `<strong>${escapeHtml(who)}</strong> commented on ticket #${d.ticket_number || '?'}`;
      case 'plan_updated': return `<strong>${escapeHtml(who)}</strong> updated the project plan`;
      default: return `<strong>${escapeHtml(who)}</strong> — ${a.action.replace(/_/g, ' ')}`;
    }
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

  // ===== RENDER: LOGIN =====
  async function renderLogin() {
    // Check for OAuth error in URL
    const hashParams = new URLSearchParams(window.location.hash.replace('#/login', '').replace('?', ''));
    const oauthError = hashParams.get('error');
    const errorMessages = {
      oauth_denied: 'Google sign-in was cancelled',
      invalid_state: 'Invalid OAuth state. Please try again',
      oauth_not_configured: 'Google sign-in is not configured',
      token_exchange_failed: 'Failed to authenticate with Google',
      userinfo_failed: 'Could not retrieve Google account info',
      no_account: 'No account found for this Google email. Contact us to get set up.',
      use_admin: 'Admin accounts should sign in at /admin',
      use_portal: 'Client accounts should sign in here',
      server_error: 'Server error during sign-in. Please try again'
    };

    // Check if Google OAuth is enabled
    let googleEnabled = false;
    try {
      const oauthStatus = await fetch('/api/auth/oauth/status').then(r => r.json());
      googleEnabled = oauthStatus.data?.google_enabled;
    } catch {}

    app.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo"><span class="accent">{</span> kaymen.dev <span class="accent">}</span></div>
          <h2 class="login-title">Client Portal</h2>
          <div id="loginMsg">${oauthError ? `<div class="alert alert-error">${escapeHtml(errorMessages[oauthError] || 'Sign-in failed')}</div>` : ''}</div>
          ${googleEnabled ? `
            <a href="/api/auth/google?target=portal" class="btn btn-google" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px;margin-bottom:16px;background:#fff;color:#333;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-weight:500;text-decoration:none;cursor:pointer;transition:background 0.2s">
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Sign in with Google
            </a>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;color:var(--text-dim);font-size:13px"><div style="flex:1;height:1px;background:var(--border)"></div>or<div style="flex:1;height:1px;background:var(--border)"></div></div>
          ` : ''}
          <form id="loginForm">
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="loginEmail" placeholder="you@company.com" required autocomplete="email">
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="loginPassword" placeholder="Enter password" required autocomplete="current-password">
            </div>
            <button type="submit" class="btn btn-primary">Sign In</button>
          </form>
        </div>
      </div>
    `;
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', e.target);
      btn.textContent = 'Signing in...'; btn.disabled = true;
      try { await login($('#loginEmail').value, $('#loginPassword').value); }
      catch (err) {
        $('#loginMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        btn.textContent = 'Sign In'; btn.disabled = false;
      }
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
            <div class="form-group"><label>Current Password</label><input type="password" id="cpCurrent" required></div>
            <div class="form-group"><label>New Password</label><input type="password" id="cpNew" placeholder="Min 8 characters" required minlength="8"></div>
            <div class="form-group"><label>Confirm</label><input type="password" id="cpConfirm" required minlength="8"></div>
            <button type="submit" class="btn btn-primary">Change Password</button>
          </form>
        </div>
      </div>
    `;
    $('#cpForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if ($('#cpNew').value !== $('#cpConfirm').value) {
        $('#cpError').innerHTML = `<div class="alert alert-error">Passwords don't match</div>`;
        return;
      }
      const btn = $('button[type="submit"]', e.target);
      btn.textContent = 'Changing...'; btn.disabled = true;
      try { await changePassword($('#cpCurrent').value, $('#cpNew').value); }
      catch (err) {
        $('#cpError').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        btn.textContent = 'Change Password'; btn.disabled = false;
      }
    });
  }

  // ===== RENDER: LAYOUT =====
  function renderLayout(content, activeNav) {
    const navItems = state.projectId
      ? [
          { id: 'project', icon: '\u25A3', label: 'Overview', hash: `#/project/${state.projectId}` },
          { id: 'plan', icon: '\u2630', label: 'Plan', hash: `#/project/${state.projectId}/plan` },
          { id: 'tickets', icon: '\u2709', label: 'Tickets', hash: `#/project/${state.projectId}/tickets` },
          { id: 'activity', icon: '\u25CE', label: 'Activity', hash: `#/project/${state.projectId}/activity` },
        ]
      : [{ id: 'dashboard', icon: '\u25A3', label: 'Dashboard', hash: '#/dashboard' }];

    // Build bottom nav items (always include dashboard, plus project-specific when in a project)
    const bottomItems = [{ id: 'dashboard', icon: '\u25A3', label: 'Projects', hash: '#/dashboard' }];
    if (state.projectId) {
      bottomItems.push(...navItems);
    }

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    app.innerHTML = `
      <div class="mobile-top-bar" id="mobileTopBar">
        <button class="mtb-btn" id="mtbTheme" title="Toggle theme">${isLight ? '\u2600' : '\u{1F319}'}</button>
        <button class="mtb-btn" id="mtbLogout" title="Logout">\u{1F6AA}</button>
      </div>
      <div class="layout">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-logo"><span class="accent">{</span> kaymen.dev <span class="accent">}</span></div>
          <div class="sidebar-label">Client Portal</div>
          <ul class="sidebar-nav">
            <li><a href="#/dashboard" class="${!state.projectId && activeNav === 'dashboard' ? 'active' : ''}" data-nav="dashboard">
              <span class="icon">\u25A3</span> My Projects
            </a></li>
            ${state.projectId ? navItems.map(n => `
              <li><a href="${n.hash}" class="${activeNav === n.id ? 'active' : ''}" data-nav="${n.id}">
                <span class="icon">${n.icon}</span> ${n.label}
              </a></li>
            `).join('') : ''}
          </ul>
          <div class="sidebar-bottom">
            <div class="sidebar-user">${escapeHtml(state.user?.name || state.user?.email)}</div>
            <div style="display:flex;gap:6px;margin-bottom:8px">
              <button class="theme-toggle-btn" id="themeTogglePortal" style="flex:1;justify-content:center">${isLight ? '\u2600 Light' : '\u{1F319} Dark'}</button>
            </div>
            <button class="btn btn-secondary btn-sm" id="logoutBtn" style="width:100%">Logout</button>
          </div>
        </aside>
        <main class="main" id="mainContent">${content}</main>
      </div>
      <nav class="bottom-nav" id="bottomNav">
        ${bottomItems.map(n => `
          <a href="${n.hash}" class="bottom-nav-item ${activeNav === n.id ? 'active' : ''}" data-nav-hash="${n.hash}">
            <span class="bottom-nav-icon">${n.icon}</span>
            <span class="bottom-nav-label">${n.label}</span>
          </a>
        `).join('')}
      </nav>
    `;

    $$('.sidebar-nav a').forEach(a => a.addEventListener('click', () => {}));
    $$('.bottom-nav-item').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = a.dataset.navHash;
    }));
    $('#logoutBtn').addEventListener('click', logout);
    const mtbLogout = $('#mtbLogout');
    if (mtbLogout) mtbLogout.addEventListener('click', logout);
    function applyTheme(goLight) {
      if (goLight) { document.documentElement.setAttribute('data-theme', 'light'); localStorage.setItem('portal_theme', 'light'); }
      else { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('portal_theme', 'dark'); }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = goLight ? '#ffffff' : '#09090b';
      render();
    }
    const mtbTheme = $('#mtbTheme');
    if (mtbTheme) mtbTheme.addEventListener('click', () => {
      applyTheme(document.documentElement.getAttribute('data-theme') !== 'light');
    });
    const themeBtn = $('#themeTogglePortal');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      applyTheme(document.documentElement.getAttribute('data-theme') !== 'light');
    });
  }

  // ===== COLLAPSE DUPLICATE ACTIVITY =====
  function collapseActivity(items) {
    const collapsed = [];
    let prev = null;
    items.forEach(a => {
      if (prev && prev.action === a.action && prev.user_name === a.user_name
          && prev.action.includes('status_changed') === false
          && Math.abs(new Date(prev.created_at) - new Date(a.created_at)) < 3600000) {
        // Same action by same person within 1h — skip duplicate
        if (!prev._count) prev._count = 1;
        prev._count++;
      } else {
        collapsed.push(a);
        prev = a;
      }
    });
    return collapsed;
  }

  // ===== RENDER: DASHBOARD =====
  async function renderDashboard() {
    state.projectId = null;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading...</div>', 'dashboard');

    try {
      const res = await api('/portal/dashboard');
      const { projects, recentActivity, activeMilestones, recentTickets, ticketStats } = res.data;

      const activeCount = projects.filter(p => ['in_progress','review'].includes(p.status)).length;
      const pendingCount = projects.filter(p => p.status === 'proposed').length;
      const summaryParts = [];
      if (activeCount) summaryParts.push(`${activeCount} project${activeCount > 1 ? 's' : ''} active`);
      if (pendingCount) summaryParts.push(`${pendingCount} awaiting your approval`);

      const collapsedActivity = collapseActivity(recentActivity);
      const totalTickets = (ticketStats.open || 0) + (ticketStats.in_progress || 0) + (ticketStats.closed || 0);

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Welcome${state.user?.name ? ', ' + escapeHtml(state.user.name) : ''}</h1>
          <p>${summaryParts.length ? summaryParts.join(', ') : 'Your projects and recent activity'}</p>
        </div>

        ${projects.length === 0 ? `
          <div class="empty-state">
            <div class="icon">&#128203;</div>
            <p>No projects yet. We'll set one up for you soon!</p>
          </div>
        ` : `<div class="hero-cards-grid">${projects.map(p => `
          <div class="hero-card" data-project-id="${p.id}">
            <div class="hero-card-top">
              <div class="hero-card-info">
                <div class="hero-card-name">${escapeHtml(p.name)}</div>
                ${statusBadge(p.status)}
              </div>
              ${progressRing(p.progress_percent, 90, 7)}
            </div>
            <div class="hero-card-details">
              <div class="hero-card-ms">
                <div class="hero-card-ms-dots">
                  ${Array.from({length: p.milestones_total || 0}, (_, i) =>
                    `<span class="ms-dot ${i < p.milestones_done ? 'done' : ''}"></span>`
                  ).join('')}
                </div>
                <span class="hero-card-ms-label">${p.milestones_done}/${p.milestones_total} milestones</span>
              </div>
              ${p.next_milestone ? `<div class="hero-card-next">Up next: <strong>${escapeHtml(p.next_milestone)}</strong></div>` : ''}
              <div class="hero-card-footer">
                ${p.days_remaining !== null ? `<span class="hero-card-countdown ${p.days_remaining < 0 ? 'overdue' : ''}">${p.days_remaining < 0 ? Math.abs(p.days_remaining) + 'd overdue' : p.days_remaining + 'd remaining'}</span>` : ''}
                ${p.open_tickets > 0 ? `<span class="badge badge-yellow" style="font-size:11px">${p.open_tickets} open ticket${p.open_tickets !== 1 ? 's' : ''}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('')}</div>

        <!-- Dashboard Widgets Grid -->
        <div class="dashboard-widgets">
          <!-- Left Column: Milestone Spotlight + Ticket Summary -->
          <div class="dashboard-widgets-left">
            ${activeMilestones.length > 0 ? `
              <div class="card widget-card">
                <div class="card-header"><span class="card-title">Milestone Spotlight</span></div>
                <div class="milestone-spotlight-list">
                  ${activeMilestones.map(m => `
                    <div class="spotlight-item">
                      <div class="spotlight-indicator ${m.status}"></div>
                      <div class="spotlight-info">
                        <div class="spotlight-title">${escapeHtml(m.title)}</div>
                        <div class="spotlight-meta">
                          <span class="spotlight-project">${escapeHtml(m.project_name)}</span>
                          ${m.target_date ? `<span class="spotlight-date">Target: ${formatDate(m.target_date)}</span>` : ''}
                        </div>
                      </div>
                      ${statusBadge(m.status)}
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div class="card widget-card">
              <div class="card-header"><span class="card-title">Tickets</span></div>
              <div class="ticket-stats-row">
                <div class="ticket-stat">
                  <span class="ticket-stat-num accent">${ticketStats.open || 0}</span>
                  <span class="ticket-stat-label">Open</span>
                </div>
                <div class="ticket-stat">
                  <span class="ticket-stat-num warning">${ticketStats.in_progress || 0}</span>
                  <span class="ticket-stat-label">In Progress</span>
                </div>
                <div class="ticket-stat">
                  <span class="ticket-stat-num success">${ticketStats.closed || 0}</span>
                  <span class="ticket-stat-label">Closed</span>
                </div>
              </div>
              ${recentTickets.length > 0 ? `
                <div class="recent-tickets-list">
                  ${recentTickets.map(t => `
                    <a class="recent-ticket-item" href="#/project/${t.project_id}/tickets/${t.id}">
                      <span class="recent-ticket-num">#${t.ticket_number}</span>
                      <span class="recent-ticket-title">${escapeHtml(t.title)}</span>
                      ${statusBadge(t.status)}
                    </a>
                  `).join('')}
                </div>
              ` : `<p style="color:var(--text-dim);font-size:13px;margin-top:8px">No tickets yet</p>`}
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions">
              ${projects.map(p => `
                <a href="#/project/${p.id}/tickets/new" class="quick-action-btn">+ Ticket for ${escapeHtml(p.name)}</a>
              `).join('')}
            </div>
          </div>

          <!-- Right Column: Compact Activity Feed -->
          <div class="dashboard-widgets-right">
            <div class="card widget-card">
              <div class="card-header"><span class="card-title">Recent Activity</span></div>
              ${collapsedActivity.length > 0 ? `
                <ul class="activity-list compact">
                  ${collapsedActivity.slice(0, 8).map(a => `
                    <li class="activity-item">
                      <div class="activity-icon">${activityIcon(a.action)}</div>
                      <div class="activity-text">${activityText(a)}${a._count > 1 ? ` <span class="activity-count">&times;${a._count}</span>` : ''}</div>
                      <div class="activity-time">${timeAgo(a.created_at)}</div>
                    </li>
                  `).join('')}
                </ul>
              ` : `<p style="color:var(--text-dim);font-size:13px">No activity yet</p>`}
            </div>
          </div>
        </div>
        `}
      `;

      $$('.hero-card').forEach(card => card.addEventListener('click', () => {
        window.location.hash = `#/project/${card.dataset.projectId}`;
      }));
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: PROJECT =====
  async function renderProject(projectId) {
    state.projectId = projectId;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading project...</div>', 'project');

    try {
      const res = await api(`/portal/projects/${projectId}`);
      const { project, milestones, open_tickets, recentActivity } = res.data;

      const showPlanApproval = project.status === 'proposed';
      const msDone = milestones.filter(m => m.status === 'completed').length;

      const collapsedProjectActivity = collapseActivity(recentActivity);

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>${escapeHtml(project.name)}</h1>
          <p>${escapeHtml(project.description || '')}</p>
        </div>

        <!-- Phase indicator -->
        ${phaseIndicator(project.status)}

        ${showPlanApproval ? `
          <div class="alert alert-info" style="margin-bottom:24px">
            A project plan is ready for your review!
            <a href="#/project/${projectId}/plan" style="color:var(--accent);font-weight:600;margin-left:8px">View & Approve Plan</a>
          </div>
        ` : ''}

        <!-- Progress + Stats + Ticket Buttons -->
        <div class="project-overview-card">
          <div class="project-overview-ring">
            ${progressRing(project.progress_percent, 120, 9)}
          </div>
          <div class="project-overview-stats">
            <div class="stat-item">
              <div class="stat-value accent">${msDone}/${milestones.length}</div>
              <div class="stat-label">Milestones</div>
            </div>
            <div class="stat-item">
              <div class="stat-value${open_tickets > 0 ? ' warning' : ''}">${open_tickets}</div>
              <div class="stat-label">Open Tickets</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${project.days_since_start !== null ? project.days_since_start : '-'}</div>
              <div class="stat-label">Days Active</div>
            </div>
            <div class="stat-item">
              <div class="stat-value${project.days_remaining !== null && project.days_remaining < 0 ? ' danger' : ''}">${project.days_remaining !== null ? (project.days_remaining < 0 ? Math.abs(project.days_remaining) + ' over' : project.days_remaining) : '-'}</div>
              <div class="stat-label">${project.days_remaining !== null && project.days_remaining < 0 ? 'Days Overdue' : 'Days Left'}</div>
            </div>
          </div>
          <div class="project-overview-actions">
            <a href="#/project/${projectId}/tickets" class="btn btn-secondary btn-sm">View Tickets</a>
            <a href="#/project/${projectId}/tickets/new" class="btn btn-primary btn-sm">Create Ticket</a>
          </div>
        </div>

        <!-- Milestones + Activity Side-by-Side -->
        <div class="project-content-grid">
          <div class="project-content-main">
            <div class="card">
              <div class="card-header"><span class="card-title">Milestones</span></div>
              ${milestones.length === 0 ? '<p style="color:var(--text-dim);font-size:14px">No milestones defined yet.</p>' : `
                <div class="timeline">
                  ${milestones.map((m, i) => `
                    <div class="timeline-item">
                      <div class="timeline-track">
                        <div class="timeline-node ${m.status}">
                          ${m.status === 'completed' ? '&#10003;' : m.status === 'in_progress' ? '' : ''}
                        </div>
                        ${i < milestones.length - 1 ? `<div class="timeline-connector ${m.status === 'completed' ? 'done' : ''}"></div>` : ''}
                      </div>
                      <div class="timeline-content">
                        <div class="timeline-title">${escapeHtml(m.title)}</div>
                        ${m.description ? `<div class="timeline-desc">${escapeHtml(m.description)}</div>` : ''}
                        <div class="timeline-meta">
                          ${statusBadge(m.status)}
                          ${m.target_date ? ` <span class="timeline-date">Target: ${formatDate(m.target_date)}</span>` : ''}
                          ${m.completed_date ? ` <span class="timeline-date">Completed: ${formatDate(m.completed_date)}</span>` : ''}
                        </div>
                        ${m.completion_notes ? `<div class="timeline-notes">${escapeHtml(m.completion_notes)}</div>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>

          <div class="project-content-side">
            ${collapsedProjectActivity.length > 0 ? `
              <div class="card widget-card">
                <div class="card-header"><span class="card-title">Recent Activity</span></div>
                <ul class="activity-list compact">
                  ${collapsedProjectActivity.slice(0, 8).map(a => `
                    <li class="activity-item">
                      <div class="activity-icon">${activityIcon(a.action)}</div>
                      <div class="activity-text">${activityText(a)}${a._count > 1 ? ` <span class="activity-count">&times;${a._count}</span>` : ''}</div>
                      <div class="activity-time">${timeAgo(a.created_at)}</div>
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: PLAN VIEW =====
  async function renderPlan(projectId) {
    state.projectId = projectId;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading plan...</div>', 'project');

    try {
      const res = await api(`/portal/projects/${projectId}/plan`);
      const { plan, project_status } = res.data;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Project Plan</h1>
          <p>Review the proposed plan for your project</p>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Plan v${plan.version}</span>
            <span style="font-size:12px;color:var(--text-dim)">Last updated: ${formatDate(plan.updated_at)}</span>
          </div>
          <div class="plan-content md-rendered">${renderMarkdown(escapeHtml(plan.content))}</div>
        </div>

        ${project_status === 'proposed' ? `
          <div class="approve-section" style="display:flex;flex-direction:column;gap:16px;align-items:center">
            <p>If you're happy with this plan, approve it to begin development.</p>
            <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
              <button class="btn btn-success" id="approveBtn" style="width:auto;padding:14px 40px;font-size:16px">
                Approve Project
              </button>
              <button class="btn btn-secondary" id="feedbackBtn" style="width:auto;padding:14px 24px;font-size:14px">
                Request Changes
              </button>
            </div>
          </div>

          <div id="feedbackForm" style="display:none;margin-top:16px">
            <div class="card">
              <div class="card-header"><span class="card-title">Plan Feedback</span></div>
              <p style="color:var(--text-dim);font-size:13px;margin-bottom:12px">Describe what changes you'd like. This will create a ticket for our team.</p>
              <textarea id="feedbackText" placeholder="What would you like changed in the plan?" style="width:100%;min-height:120px;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:14px;resize:vertical;line-height:1.5"></textarea>
              <div style="display:flex;gap:8px;margin-top:8px">
                <button class="btn btn-primary" id="submitFeedbackBtn" style="width:auto">Submit Feedback</button>
                <button class="btn btn-secondary" id="cancelFeedbackBtn" style="width:auto">Cancel</button>
              </div>
              <div id="feedbackMsg" style="margin-top:8px"></div>
            </div>
          </div>
        ` : plan.approved_at ? `
          <div class="alert alert-success">This plan was approved on ${formatDate(plan.approved_at)}.</div>
        ` : ''}
      `;

      const approveBtn = $('#approveBtn');
      if (approveBtn) {
        approveBtn.addEventListener('click', async () => {
          if (!confirm('This will approve the plan and begin development. Are you sure?')) return;
          approveBtn.textContent = 'Approving...'; approveBtn.disabled = true;
          try {
            await api(`/portal/projects/${projectId}/approve`, { method: 'POST' });
            window.location.hash = `#/project/${projectId}`;
          } catch (err) {
            alert(err.message);
            approveBtn.textContent = 'Approve Project'; approveBtn.disabled = false;
          }
        });
      }

      // Feedback form toggle
      const feedbackBtn = $('#feedbackBtn');
      if (feedbackBtn) {
        feedbackBtn.addEventListener('click', () => {
          $('#feedbackForm').style.display = 'block';
          feedbackBtn.style.display = 'none';
        });
        $('#cancelFeedbackBtn').addEventListener('click', () => {
          $('#feedbackForm').style.display = 'none';
          feedbackBtn.style.display = 'inline-flex';
        });
        $('#submitFeedbackBtn').addEventListener('click', async () => {
          const text = $('#feedbackText').value.trim();
          if (!text) { $('#feedbackMsg').innerHTML = '<div class="alert alert-error">Please describe the changes you want.</div>'; return; }
          const btn = $('#submitFeedbackBtn');
          btn.textContent = 'Submitting...'; btn.disabled = true;
          try {
            await api(`/portal/projects/${projectId}/tickets`, {
              method: 'POST',
              body: JSON.stringify({
                title: 'Plan feedback: ' + text.substring(0, 80) + (text.length > 80 ? '...' : ''),
                type: 'modification',
                priority: 'medium',
                description: text
              })
            });
            $('#feedbackMsg').innerHTML = '<div class="alert alert-success">Feedback submitted! We\'ll review and update the plan.</div>';
            $('#feedbackText').value = '';
            btn.textContent = 'Submit Feedback'; btn.disabled = false;
          } catch (err) {
            $('#feedbackMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
            btn.textContent = 'Submit Feedback'; btn.disabled = false;
          }
        });
      }
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: TICKETS =====
  async function renderTickets(projectId) {
    state.projectId = projectId;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading tickets...</div>', 'tickets');

    try {
      const res = await api(`/portal/projects/${projectId}/tickets`);
      const tickets = res.data.tickets;

      $('#mainContent').innerHTML = `
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <h1>Tickets</h1>
            <p>Track requests, bugs, and changes</p>
          </div>
          <a href="#/project/${projectId}/tickets/new" class="btn btn-primary" style="width:auto">New Ticket</a>
        </div>

        <div class="filter-tabs" id="statusFilter">
          <button class="filter-tab active" data-status="all">All</button>
          <button class="filter-tab" data-status="open">Open</button>
          <button class="filter-tab" data-status="in_progress">In Progress</button>
          <button class="filter-tab" data-status="completed">Completed</button>
          <button class="filter-tab" data-status="closed">Closed</button>
        </div>

        <div class="card" style="padding:0">
          <div class="table-wrap">
            <table class="mobile-cards">
              <thead><tr><th>#</th><th>Title</th><th>Type</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody id="ticketTableBody">
                ${tickets.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:32px">No tickets yet</td></tr>' :
                  tickets.map(t => `<tr data-ticket-id="${t.id}" data-status="${t.status}">
                    <td data-label="#" style="font-family:var(--mono);font-size:12px">${t.ticket_number}</td>
                    <td data-label="Title" style="color:var(--text);font-weight:500">${escapeHtml(t.title)}</td>
                    <td data-label="Type">${typeBadge(t.type)}</td>
                    <td data-label="Priority">${priorityBadge(t.priority)}</td>
                    <td data-label="Status">${statusBadge(t.status)}</td>
                    <td data-label="Updated">${timeAgo(t.updated_at)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Click to view ticket
      $$('#ticketTableBody tr[data-ticket-id]').forEach(row => {
        row.addEventListener('click', () => {
          window.location.hash = `#/project/${projectId}/tickets/${row.dataset.ticketId}`;
        });
      });

      // Filter tabs
      $$('#statusFilter .filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          $$('#statusFilter .filter-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const status = tab.dataset.status;
          $$('#ticketTableBody tr[data-ticket-id]').forEach(row => {
            row.style.display = (status === 'all' || row.dataset.status === status) ? '' : 'none';
          });
        });
      });
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: NEW TICKET =====
  function renderNewTicket(projectId) {
    state.projectId = projectId;
    renderLayout(`
      <div class="page-header">
        <h1>New Ticket</h1>
        <p>Submit a request, bug report, or question</p>
      </div>
      <div class="card">
        <div id="newTicketMsg"></div>
        <form id="newTicketForm">
          <div class="form-group">
            <label>Title</label>
            <input type="text" id="ticketTitle" placeholder="Brief description of your request" required maxlength="200">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Type</label>
              <select id="ticketType">
                <option value="modification">Change Request</option>
                <option value="bug">Bug Report</option>
                <option value="feature_request">Feature Request</option>
                <option value="question">Question</option>
                <option value="task">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Priority</label>
              <select id="ticketPriority">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="ticketDescription" placeholder="Describe what you need in detail..." maxlength="10000"></textarea>
          </div>
          <div style="display:flex;gap:12px">
            <a href="#/project/${projectId}/tickets" class="btn btn-secondary" style="flex:1;text-align:center">Cancel</a>
            <button type="submit" class="btn btn-primary" style="flex:1">Submit Ticket</button>
          </div>
        </form>
      </div>
    `, 'tickets');

    $('#newTicketForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', e.target);
      btn.textContent = 'Submitting...'; btn.disabled = true;
      try {
        await api(`/portal/projects/${projectId}/tickets`, {
          method: 'POST',
          body: JSON.stringify({
            title: $('#ticketTitle').value,
            type: $('#ticketType').value,
            priority: $('#ticketPriority').value,
            description: $('#ticketDescription').value
          })
        });
        window.location.hash = `#/project/${projectId}/tickets`;
      } catch (err) {
        $('#newTicketMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        btn.textContent = 'Submit Ticket'; btn.disabled = false;
      }
    });
  }

  // ===== RENDER: TICKET DETAIL =====
  async function renderTicketDetail(projectId, ticketId) {
    state.projectId = projectId;
    state.ticketId = ticketId;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading ticket...</div>', 'tickets');

    try {
      const res = await api(`/portal/projects/${projectId}/tickets/${ticketId}`);
      const { ticket, comments } = res.data;

      // Fetch attachments
      let attachments = [];
      try {
        const attRes = await fetch(`/api/uploads/tickets/${ticket.id}`, { headers: { 'Authorization': `Bearer ${state.token}` } });
        const attData = await attRes.json();
        if (attData.success) attachments = attData.data.attachments;
      } catch {}

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
          <a href="#/project/${projectId}/tickets" style="color:var(--text-secondary);text-decoration:none;font-size:13px">\u2190 Back to Tickets</a>
        </div>

        <div class="ticket-header">
          <div class="ticket-title">#${ticket.ticket_number} — ${escapeHtml(ticket.title)}</div>
          <div class="ticket-meta">
            ${statusBadge(ticket.status)}
            ${typeBadge(ticket.type)}
            ${priorityBadge(ticket.priority)}
            <span>Created ${timeAgo(ticket.created_at)} by ${escapeHtml(ticket.created_by_name || 'Unknown')}</span>
            ${ticket.assigned_to_name ? `<span>Assigned to ${escapeHtml(ticket.assigned_to_name)}</span>` : ''}
          </div>
        </div>

        ${ticket.description ? `<div class="ticket-body">${escapeHtml(ticket.description)}</div>` : ''}

        <div class="card" style="margin-bottom:24px">
          <div class="card-header"><span class="card-title">Attachments (${attachments.length}/10)</span></div>
          <div id="attachmentsList">
            ${attachments.length === 0 ? '<p style="color:var(--text-dim);font-size:13px;margin:0">No files attached.</p>' : `
              <div style="display:flex;flex-direction:column;gap:6px">
                ${attachments.map(a => `
                  <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface-2);border-radius:var(--radius);font-size:13px" data-att-id="${a.id}">
                    <span style="font-size:18px">${fileIcon(a.mimetype)}</span>
                    <a href="#" class="att-download" data-id="${a.id}" data-name="${escapeHtml(a.filename)}" style="color:var(--accent);text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(a.filename)}">${escapeHtml(a.filename)}</a>
                    <span style="color:var(--text-dim);font-size:12px;white-space:nowrap">${formatFileSize(a.size)}</span>
                    <span style="color:var(--text-dim);font-size:12px;white-space:nowrap">${timeAgo(a.uploaded_at)}</span>
                    <button class="btn btn-secondary btn-sm att-delete" data-id="${a.id}" style="padding:2px 8px;font-size:11px;color:var(--danger);border-color:var(--danger)">\u2715</button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
          ${!['closed', 'completed'].includes(ticket.status) && attachments.length < 10 ? `
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

          ${comments.length === 0 ? '<p style="color:var(--text-dim);font-size:14px">No comments yet.</p>' : `
            <div class="comment-list">
              ${comments.map(c => `
                <div class="comment ${c.user_role === 'client' ? 'client' : 'staff'}">
                  <div class="comment-header">
                    <span class="comment-author">${escapeHtml(c.user_name || 'Unknown')}
                      <span class="badge ${c.user_role === 'client' ? 'badge-green' : 'badge-blue'}" style="margin-left:6px">${c.user_role}</span>
                    </span>
                    <span class="comment-date">${timeAgo(c.created_at)}</span>
                  </div>
                  <div class="comment-body">${escapeHtml(c.body)}</div>
                </div>
              `).join('')}
            </div>
          `}

          ${!['closed', 'completed'].includes(ticket.status) ? `
            <div style="border-top:1px solid var(--border);padding-top:20px">
              <form id="commentForm">
                <div class="form-group" style="margin-bottom:12px">
                  <textarea id="commentBody" placeholder="Add a comment..." required maxlength="5000" style="min-height:80px"></textarea>
                </div>
                <button type="submit" class="btn btn-primary" style="width:auto">Post Comment</button>
              </form>
              <div id="commentMsg" style="margin-top:8px"></div>
            </div>
          ` : '<div style="color:var(--text-dim);font-size:13px;margin-top:16px;border-top:1px solid var(--border);padding-top:16px">This ticket is closed.</div>'}
        </div>
      `;

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
            headers: { 'Authorization': `Bearer ${state.token}` },
            body: formData
          });
          const uploadData = await uploadRes.json();
          if (!uploadData.success) throw new Error(uploadData.error);
          renderTicketDetail(projectId, ticketId);
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
              headers: { 'Authorization': `Bearer ${state.token}` }
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

      // Delete attachment (clients can only delete their own)
      $$('.att-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this attachment?')) return;
          try {
            const delRes = await fetch(`/api/uploads/${btn.dataset.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${state.token}` }
            });
            const delData = await delRes.json();
            if (!delData.success) throw new Error(delData.error);
            renderTicketDetail(projectId, ticketId);
          } catch (err) {
            alert('Delete failed: ' + err.message);
          }
        });
      });

      const commentForm = $('#commentForm');
      if (commentForm) {
        commentForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = $('button[type="submit"]', e.target);
          btn.textContent = 'Posting...'; btn.disabled = true;
          try {
            await api(`/portal/tickets/${ticketId}/comments`, {
              method: 'POST',
              body: JSON.stringify({ body: $('#commentBody').value })
            });
            renderTicketDetail(projectId, ticketId); // Refresh
          } catch (err) {
            $('#commentMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
            btn.textContent = 'Post Comment'; btn.disabled = false;
          }
        });
      }
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: ACTIVITY =====
  async function renderActivity(projectId) {
    state.projectId = projectId;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading activity...</div>', 'activity');

    try {
      const res = await api(`/portal/projects/${projectId}/activity`);
      const activities = res.data.activities;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Activity</h1>
          <p>Everything that's happened on this project</p>
        </div>

        <div class="card">
          ${activities.length === 0 ? '<div class="empty-state"><p>No activity yet.</p></div>' : `
            <ul class="activity-list">
              ${activities.map(a => `
                <li class="activity-item">
                  <div class="activity-dot"></div>
                  <div class="activity-text">${activityText(a)}</div>
                  <div class="activity-time">${timeAgo(a.created_at)}</div>
                </li>
              `).join('')}
            </ul>
          `}
        </div>
      `;
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== ROUTER =====
  function route() {
    const hash = window.location.hash.replace('#/', '') || 'dashboard';
    const parts = hash.split('/');

    // #/invite/:token
    if (parts[0] === 'invite' && parts[1]) {
      return { page: 'invite', token: parts[1] };
    }
    // #/dashboard
    if (parts[0] === 'dashboard' || hash === '') {
      return { page: 'dashboard' };
    }
    // #/project/:id
    if (parts[0] === 'project' && parts[1]) {
      const projectId = parts[1];
      // #/project/:id/plan
      if (parts[2] === 'plan') return { page: 'plan', projectId };
      // #/project/:id/tickets/new
      if (parts[2] === 'tickets' && parts[3] === 'new') return { page: 'newTicket', projectId };
      // #/project/:id/tickets/:ticketId
      if (parts[2] === 'tickets' && parts[3]) return { page: 'ticketDetail', projectId, ticketId: parts[3] };
      // #/project/:id/tickets
      if (parts[2] === 'tickets') return { page: 'tickets', projectId };
      // #/project/:id/activity
      if (parts[2] === 'activity') return { page: 'activity', projectId };
      // #/project/:id
      return { page: 'project', projectId };
    }

    return { page: 'dashboard' };
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
        localStorage.setItem('portal_token', state.token);
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
    // Handle invite page before auth check (public route)
    const r = route();
    if (r.page === 'invite') return renderInvite(r.token);

    if (!state.token || !state.user) {
      const authed = await checkAuth();
      if (!authed) return renderLogin();
      if (!['client', 'admin', 'staff'].includes(state.user.role)) {
        app.innerHTML = `<div class="login-page"><div class="login-card">
          <div class="alert alert-error">Access denied.</div>
        </div></div>`;
        return;
      }
    }

    if (state.user.must_change_password) return renderChangePassword();

    switch (r.page) {
      case 'project': return renderProject(r.projectId);
      case 'plan': return renderPlan(r.projectId);
      case 'tickets': return renderTickets(r.projectId);
      case 'newTicket': return renderNewTicket(r.projectId);
      case 'ticketDetail': return renderTicketDetail(r.projectId, r.ticketId);
      case 'activity': return renderActivity(r.projectId);
      default: return renderDashboard();
    }
  }

  // ===== INIT =====
  window.addEventListener('hashchange', render);
  render();
})();

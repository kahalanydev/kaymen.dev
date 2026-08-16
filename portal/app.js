/* Client Portal SPA — kaymen.dev */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/portal/sw.js').catch(() => {});
}

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const app = document.getElementById('app');

  /* The theme toggle is gone, on the same grounds the site and the admin dropped
     theirs: the palette is light-first and no dark variant is designed. The old
     key is actively cleared rather than ignored, because a leftover 'light' would
     put data-theme on a stylesheet that no longer has any [data-theme] rules. */
  localStorage.removeItem('portal_theme');
  document.documentElement.removeAttribute('data-theme');

  // ===== STATE =====
  const state = {
    token: localStorage.getItem('portal_token'),
    user: null,
    page: 'dashboard',
    projectId: null,
    ticketId: null,
    orgName: null,
    navCounts: null,
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
    const d = toDate(dateStr);
    return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '-';
  }

  /* SQLite hands back both "2026-08-16 10:11:12" and bare "2026-08-16"; the +'Z'
     idiom above yields Invalid Date on the second, and formatting a UTC-midnight
     date in local time reads a day early west of Greenwich. A target date that is
     silently one day out is worse than no date at all. */
  function toDate(s) {
    if (!s) return null;
    const str = String(s);
    const d = new Date(str.length <= 10 ? str + 'T00:00:00Z' : str.replace(' ', 'T') + 'Z');
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtDay(s) {
    const d = toDate(s);
    return d ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : null;
  }
  function fmtShort(s) {
    const d = toDate(s);
    return d ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : null;
  }
  function daysTo(s) { const d = toDate(s); return d ? Math.round((d - new Date()) / 86400000) : null; }
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

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
    const map = { urgent: 'badge-red', high: 'badge-yellow', medium: 'badge-gray', low: 'badge-gray' };
    return `<span class="badge ${map[priority] || 'badge-gray'}">${priority}</span>`;
  }

  function typeBadge(type) {
    const map = { bug: 'badge-gray', feature_request: 'badge-gray', modification: 'badge-gray', question: 'badge-gray', task: 'badge-gray', maintenance: 'badge-gray' };
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
    const color = percent >= 100 ? 'var(--accent-dark)' : 'var(--accent)';
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="progress-ring">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
        transform="rotate(-90 ${size/2} ${size/2})" style="transition:stroke-dashoffset 0.8s ease"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        style="font-size:${size * 0.24}px;font-weight:800;letter-spacing:-.04em;fill:var(--ink);font-family:var(--display)">${percent}%</text>
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
          <div class="login-logo"><span class="mark">K</span><span>kaymen<span class="accent">.</span>dev</span></div>
          <h2 class="login-title">Client Portal</h2>
          <div id="loginMsg">${oauthError ? `<div class="alert alert-error">${escapeHtml(errorMessages[oauthError] || 'Sign-in failed')}</div>` : ''}</div>
          ${googleEnabled ? `
            <a href="/api/auth/google?target=portal" class="btn btn-google">
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Sign in with Google
            </a>
            <div class="or">or</div>
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
          <div class="login-logo"><span class="mark">K</span><span>kaymen<span class="accent">.</span>dev</span></div>
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
  /* Line icons, not emoji: emoji render differently on every OS and cannot take
     currentColor, so an active nav item could never tint them. Same reasoning and
     same set as admin/app.js. */
  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="19" height="13.5" rx="2.2"/><path d="M8.5 6.5V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/></svg>',
    project: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V21H3z"/></svg>',
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><path d="M14 2.5v5h5"/></svg>',
    tickets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.2 9.2 0 0 1-3.9-.9L3 20.5l1.6-4.8A8.3 8.3 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.9-8.4 8.4 8.4 0 0 1 8.5 8.4z"/></svg>',
    activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.4l3.4 2"/></svg>',
  };
  const icon = (n) => ICONS[n] || ICONS.project;

  function renderLayout(content, activeNav) {
    // counts are whatever the last screen fetched; absent on a cold load, which is
    // why each one is optional rather than rendered as 0
    const counts = state.navCounts || {};
    const navItems = state.projectId
      ? [
          { id: 'project', label: 'Overview', hash: `#/project/${state.projectId}` },
          { id: 'plan', label: 'The plan', hash: `#/project/${state.projectId}/plan`, count: counts.plan },
          { id: 'tickets', label: 'Tickets', hash: `#/project/${state.projectId}/tickets`, count: counts.tickets },
          { id: 'activity', label: 'Activity', hash: `#/project/${state.projectId}/activity` },
        ]
      : [];

    const bottomItems = [{ id: 'dashboard', label: 'Projects', hash: '#/dashboard' }, ...navItems];

    app.innerHTML = `
      <div class="mobile-top-bar" id="mobileTopBar">
        <button class="mtb-btn" id="mtbLogout" title="Log out" aria-label="Log out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.5"/><path d="m16 16.5 4.5-4.5L16 7.5"/><path d="M20.5 12H9.5"/></svg>
        </button>
      </div>
      <div class="layout">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-logo">
            <span class="mark">K</span>
            <span>kaymen<span class="accent">.</span>dev</span>
          </div>
          <div class="sidebar-label">Client portal</div>
          <ul class="sidebar-nav">
            <li><a href="#/dashboard" class="${!state.projectId && activeNav === 'dashboard' ? 'active' : ''}" data-nav="dashboard">
              <span class="icon">${icon('dashboard')}</span><span>My projects</span>
            </a></li>
            ${navItems.map(n => `
              <li><a href="${n.hash}" class="${activeNav === n.id ? 'active' : ''}" data-nav="${n.id}">
                <span class="icon">${icon(n.id)}</span><span>${n.label}</span>
                ${n.count ? `<span class="count${n.count.hot ? ' hot' : ''}">${n.count.n}</span>` : ''}
              </a></li>
            `).join('')}
          </ul>
          <div class="sidebar-bottom">
            ${state.orgName
              ? `<div class="sidebar-org"><span class="pulse"></span><em>${escapeHtml(state.orgName)}</em></div>` : ''}
            <div class="sidebar-user">${escapeHtml(state.user?.name || state.user?.email || '')}</div>
            <button class="btn btn-secondary btn-sm" id="logoutBtn" style="width:100%">Log out</button>
          </div>
        </aside>
        <main class="main" id="mainContent">${content}</main>
      </div>
      <nav class="bottom-nav" id="bottomNav">
        ${bottomItems.map(n => `
          <a href="${n.hash}" class="bottom-nav-item ${activeNav === n.id ? 'active' : ''}" data-nav-hash="${n.hash}">
            <span class="bottom-nav-icon">${icon(n.id)}</span>
            <span class="bottom-nav-label">${n.label}</span>
          </a>
        `).join('')}
      </nav>
    `;

    $$('.bottom-nav-item').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = a.dataset.navHash;
    }));
    $('#logoutBtn').addEventListener('click', logout);
    const mtbLogout = $('#mtbLogout');
    if (mtbLogout) mtbLogout.addEventListener('click', logout);
    // The theme toggle was removed with the re-skin, on the same grounds the site
    // and the admin dropped theirs. Do not re-add a half-working one.
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

      // the rail foot names the client's own organisation
      state.orgName = (projects[0] && projects[0].org_name) || state.orgName;
      state.navCounts = null;

      const activeCount = projects.filter(p => ['in_progress','review'].includes(p.status)).length;
      const pendingCount = projects.filter(p => p.status === 'proposed').length;
      const summaryParts = [];
      if (activeCount) summaryParts.push(`${activeCount} project${activeCount > 1 ? 's' : ''} active`);
      if (pendingCount) summaryParts.push(`${pendingCount} awaiting your approval`);

      const collapsedActivity = collapseActivity(recentActivity);
      const totalTickets = (ticketStats.open || 0) + (ticketStats.in_progress || 0) + (ticketStats.closed || 0);

      // renderLayout, not #mainContent — the rail's org name arrives with this fetch
      renderLayout(`
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
                ${p.open_tickets > 0 ? `<span class="badge badge-yellow tiny" >${p.open_tickets} open ticket${p.open_tickets !== 1 ? 's' : ''}</span>` : ''}
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
              ` : `<p class="hint mt-s mb-0">No tickets yet</p>`}
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
              ` : `<p class="hint mb-0">No activity yet</p>`}
            </div>
          </div>
        </div>
        `}
      `, 'dashboard');

      $$('.hero-card').forEach(card => card.addEventListener('click', () => {
        window.location.hash = `#/project/${card.dataset.projectId}`;
      }));
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: PROJECT OVERVIEW — "Reassurance" =====
  /* A client logs in a couple of times a month, almost always for one reason: is
     my thing on track, and does anyone still care about it. So the screen answers
     that in a sentence before any evidence, then shows the evidence.

     The sentence is DERIVED on every render, never written. That is the whole
     safeguard: the direction's own stated cost is that a reassurance has to stay
     true, so a project that quietly stalls says so in 38px Sora rather than
     keeping a cheerful string somebody typed in August.

     The "yours to do" block is lifted from the Workspace direction and rendered
     only when it has contents (handoff §1). Workspace's own stated cost is that
     an empty to-do column reads as neglect exactly when things are going well —
     so when there is nothing to do, the block is absent, not empty. */

  function currentStage(milestones) {
    return milestones.find(m => m.status === 'in_progress')
        || milestones.find(m => m.status === 'upcoming')
        || null;
  }

  function statusSentence(project, milestones, tickets) {
    const total = milestones.length;
    const done = milestones.filter(m => m.status === 'completed').length;
    const stage = currentStage(milestones);
    const late = stage && stage.target_date ? daysTo(stage.target_date) : null;
    const behind = late !== null && late < 0 ? Math.abs(late) : 0;
    const open = tickets.filter(t => ['open', 'in_progress'].includes(t.status));
    const pressing = open.filter(t => ['urgent', 'high'].includes(t.priority));
    const last = milestones.length ? milestones[milestones.length - 1] : null;

    let head;
    const bits = [];

    if (project.status === 'proposed') {
      head = 'The plan is <span>ready for you</span>.';
      bits.push('Nothing starts until you have read it and said yes.');
      if (total) bits.push(`It breaks the work into ${plural(total, 'stage', 'stages')}.`);
    } else if (project.status === 'planning') {
      head = 'We are <span>still scoping this</span>.';
      bits.push('You will get a plan to read and approve before any work starts.');
    } else if (project.status === 'completed') {
      head = '<span>Delivered</span>.';
      if (project.completed_date) bits.push(`Finished ${fmtDay(project.completed_date)}.`);
      bits.push('Anything that comes up, tell us and we will look at it.');
    } else if (project.status === 'maintenance') {
      head = 'Live, and <span>looked after</span>.';
      bits.push('The build is done. We are here for changes and for anything that breaks.');
    } else if (project.status === 'archived') {
      head = 'This project is <span>closed</span>.';
    } else {
      // approved / in_progress / review — the live states, where the sentence earns its keep
      if (behind) {
        head = `Running <span>${plural(behind, 'day', 'days')} behind</span> on one stage.`;
      } else if (pressing.length) {
        head = `On track, with <span>${pressing.length === 1 ? 'one thing' : plural(pressing.length, 'thing', 'things')}</span> being fixed.`;
      } else {
        head = '<span>On track</span>.';
      }
      if (total) bits.push(`${done} of ${total} stages ${done === 1 ? 'is' : 'are'} done.`);
      if (stage) {
        let s = `We are on <b>${escapeHtml(stage.title)}</b>`;
        if (behind) s += `, which is ${plural(behind, 'day', 'days')} behind`;
        else if (stage.target_date) s += `, due ${fmtDay(stage.target_date)}`;
        bits.push(s + '.');
      }
      if (pressing.length) {
        const t = pressing[0];
        bits.push(`<b>#${t.ticket_number}</b> — ${escapeHtml(t.title)} — is being worked on now.`);
      }
      if (last && last.target_date && last !== stage) {
        bits.push(`<b>${escapeHtml(last.title)}</b> is still set for <b>${fmtDay(last.target_date)}</b>.`);
      }
    }

    return { head, lead: bits.join(' ') };
  }

  /* Two things are genuinely the client's to do, and both are derivable:
       · a plan sitting in `proposed`, waiting on their approval
       · a ticket we moved to `review` — we think it is fixed, they have to say so
     "We are blocked on you" is in the mockup but NOT here: nothing in the schema
     records that we are waiting on a client, and inventing the state would put a
     demand on their screen that no one actually made. See the handoff §6. */
  function buildTodo(project, tickets, projectId) {
    const items = [];

    if (project.status === 'proposed') {
      items.push(`
        <div class="td hero">
          <div class="td-t"><span class="badge badge-green">Needs your approval</span><h4>The plan is ready to read</h4></div>
          <p>Read it and approve, or tell us what to change. Nothing starts until you do.</p>
          <div class="td-a">
            <a href="#/project/${projectId}/plan" class="btn btn-primary">Read &amp; approve</a>
            <a href="#/project/${projectId}/plan" class="btn btn-ghost">Request changes</a>
          </div>
        </div>`);
    }

    tickets.filter(t => t.status === 'review').forEach(t => {
      items.push(`
        <div class="td">
          <div class="td-t"><span class="badge badge-yellow">Ready for you to check</span><h4>#${t.ticket_number} — ${escapeHtml(t.title)}</h4></div>
          <p>We think this one is done. Have a look and tell us if it is, or reopen it if it is not.</p>
          <div class="td-meta">Opened ${fmtShort(t.created_at) || ''} &middot; last touched ${timeAgo(t.updated_at)}</div>
          <div class="td-a"><a href="#/project/${projectId}/tickets/${t.id}" class="btn btn-ghost">Open it</a></div>
        </div>`);
    });

    return items;
  }

  function storyDate(created_at) {
    const d = toDate(created_at);
    if (!d) return '';
    const hrs = (new Date() - d) / 3600000;
    if (hrs < 24) return 'Today';
    if (hrs < 48) return 'Yesterday';
    return fmtShort(created_at) || '';
  }

  async function renderProject(projectId) {
    state.projectId = projectId;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading&hellip;</div>', 'project');

    try {
      /* Two calls, in parallel. The project response carries only an open-ticket
         *count*, and both the status sentence and the to-do block need the actual
         tickets — their priority, their status and their numbers. */
      const [projRes, ticketRes] = await Promise.all([
        api(`/portal/projects/${projectId}`),
        api(`/portal/projects/${projectId}/tickets`).catch(() => ({ data: { tickets: [] } })),
      ]);
      const { project, milestones, recentActivity } = projRes.data;
      const tickets = ticketRes.data.tickets || [];
      const openTickets = tickets.filter(t => ['open', 'in_progress'].includes(t.status));

      state.orgName = project.org_name || state.orgName;
      state.navCounts = {
        tickets: openTickets.length ? { n: openTickets.length } : null,
        plan: project.status === 'proposed' ? { n: 1, hot: true } : null,
      };

      const done = milestones.filter(m => m.status === 'completed').length;
      const stage = currentStage(milestones);
      const pct = project.progress_percent || 0;
      const { head, lead } = statusSentence(project, milestones, tickets);
      const todo = buildTodo(project, tickets, projectId);

      // the lit portion of the timeline spine, rather than the mockup's fixed 62%
      const lit = milestones.length ? Math.round((done / milestones.length) * 100) : 0;
      const C = 2 * Math.PI * 58;   // r=58, matching the mockup's ring

      const ringSub = [];
      if (milestones.length) ringSub.push(`${done} of ${milestones.length} stages done`);
      const subLine = [];
      if (project.days_since_start !== null && project.days_since_start !== undefined) {
        subLine.push(`${plural(project.days_since_start, 'day', 'days')} in`);
      }
      if (project.target_date) subLine.push(`target ${fmtDay(project.target_date)}`);

      const story = recentActivity.slice(0, 6);

      /* renderLayout again rather than patching #mainContent: the rail's org name
         and its counts only exist once this fetch lands, and a rail that is right
         on the second visit but blank on the first is worse than a beat's delay. */
      renderLayout(`
        <div class="p-hero">
          <p class="eyebrow">${escapeHtml(project.name)}</p>
          <h1>${head}</h1>
          ${lead ? `<p class="lead">${lead}</p>` : ''}
          <div class="p-actions">
            <a href="#/project/${projectId}/plan" class="btn btn-primary">Read the plan</a>
            <a href="#/project/${projectId}/tickets/new" class="btn btn-ghost">Tell us something</a>
          </div>
        </div>

        ${todo.length ? `
          <hr class="rule">
          <div class="p-todo">
            <h3>Yours to do <u>${todo.length}</u></h3>
            <div class="todo">${todo.join('')}</div>
          </div>
        ` : ''}

        <hr class="rule">

        <div class="p-grid">
          <div>
            <p class="eyebrow mb-l" >Where it stands</p>
            ${milestones.length ? `
              <div class="tl" style="--lit:${lit}%">
                ${milestones.map(m => {
                  const late = m.status === 'in_progress' && m.target_date && daysTo(m.target_date) < 0;
                  let when = '';
                  if (m.status === 'completed') when = m.completed_date ? `Completed ${fmtDay(m.completed_date)}` : 'Completed';
                  else if (m.status === 'in_progress') when = m.target_date ? `In progress &middot; ${late ? 'was due' : 'due'} ${fmtDay(m.target_date)}` : 'In progress';
                  else if (m.status === 'skipped') when = 'Not needed';
                  else when = m.target_date ? `Due ${fmtDay(m.target_date)}` : '';
                  return `
                    <div class="tl-i ${m.status === 'completed' ? 'done' : m.status === 'in_progress' ? 'now' : ''}">
                      <h4>${escapeHtml(m.title)}</h4>
                      ${m.description ? `<p>${escapeHtml(m.description)}</p>` : ''}
                      ${m.completion_notes ? `<p>${escapeHtml(m.completion_notes)}</p>` : ''}
                      ${when ? `<div class="when${late ? ' late' : ''}">${when}</div>` : ''}
                    </div>`;
                }).join('')}
              </div>
            ` : '<p class="hint mb-0">The stages will appear here once the plan is agreed.</p>'}
          </div>

          <div class="ring-wrap">
            <div class="ring">
              <svg width="132" height="132" viewBox="0 0 132 132">
                <defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#2bbcb3"/><stop offset="100%" stop-color="#229e96"/>
                </linearGradient></defs>
                <circle class="tr" cx="66" cy="66" r="58" fill="none" stroke-width="9"/>
                <circle class="fg" cx="66" cy="66" r="58" fill="none" stroke-width="9"
                        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}"/>
              </svg>
              <div class="lbl"><b>${pct}%</b><span>Complete</span></div>
            </div>
            ${ringSub.length || subLine.length ? `
              <div class="sub">
                ${ringSub.length ? `<b>${ringSub[0]}</b>` : ''}
                ${subLine.join(' &middot; ')}
              </div>` : ''}
            ${stage ? `<div class="sub">Now: <b style="display:inline;font-size:12px">${escapeHtml(stage.title)}</b></div>` : ''}
          </div>
        </div>

        <div class="p-story">
          <p class="eyebrow">What has happened</p>
          ${story.length ? `
            <div class="story">
              ${collapseActivity(story).map(a => `
                <div class="story-i">
                  <span class="d">${storyDate(a.created_at)}</span>
                  <span class="b">${activityText(a)}${a._count > 1 ? ` <span class="activity-count">&times;${a._count}</span>` : ''}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="hint mt-m mb-0">Nothing yet — this fills in as work happens.</p>'}
        </div>
      `, 'project');
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: PLAN VIEW =====
  async function renderPlan(projectId) {
    state.projectId = projectId;
    // 'plan', not 'project' — the rail was lighting Overview while you sat on the plan
    renderLayout('<div class="loading"><div class="spinner"></div> Loading plan&hellip;</div>', 'plan');

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
            <span class="meta">Last updated: ${formatDate(plan.updated_at)}</span>
          </div>
          <div class="plan-content md-rendered">${renderMarkdown(escapeHtml(plan.content))}</div>
        </div>

        ${project_status === 'proposed' ? `
          <div class="approve-section stack" >
            <p>If you're happy with this plan, approve it to begin development.</p>
            <div class="row center">
              <button class="btn btn-success" id="approveBtn" style="padding:14px 40px;font-size:15px">
                Approve Project
              </button>
              <button class="btn btn-secondary" id="feedbackBtn" style="padding:14px 24px">
                Request Changes
              </button>
            </div>
          </div>

          <div id="feedbackForm" class="mt-l" hidden>
            <div class="card">
              <div class="card-header"><span class="card-title">Plan Feedback</span></div>
              <p class="hint sm">Describe what changes you'd like. This will create a ticket for our team.</p>
              <textarea id="feedbackText" placeholder="What would you like changed in the plan?" class="in" style="min-height:120px;resize:vertical;line-height:1.6"></textarea>
              <div class="row mt-s">
                <button class="btn btn-primary" id="submitFeedbackBtn">Submit Feedback</button>
                <button class="btn btn-secondary" id="cancelFeedbackBtn">Cancel</button>
              </div>
              <div id="feedbackMsg" class="mt-s"></div>
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
          $('#feedbackForm').hidden = false;
          feedbackBtn.hidden = true;
        });
        $('#cancelFeedbackBtn').addEventListener('click', () => {
          $('#feedbackForm').hidden = true;
          feedbackBtn.hidden = false;
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
        <div class="page-header row"  style="justify-content:space-between;align-items:flex-start">
          <div>
            <h1>Tickets</h1>
            <p>Track requests, bugs, and changes</p>
          </div>
          <a href="#/project/${projectId}/tickets/new" class="btn btn-primary">New Ticket</a>
        </div>

        <div class="filter-tabs" id="statusFilter">
          <button class="filter-tab active" data-status="all">All</button>
          <button class="filter-tab" data-status="open">Open</button>
          <button class="filter-tab" data-status="in_progress">In Progress</button>
          <button class="filter-tab" data-status="completed">Completed</button>
          <button class="filter-tab" data-status="closed">Closed</button>
        </div>

        <div class="card no-pad" >
          <div class="table-wrap">
            <table class="mobile-cards">
              <thead><tr><th>#</th><th>Title</th><th>Type</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody id="ticketTableBody">
                ${tickets.length === 0 ? '<tr><td colspan="6" class="empty-cell">No tickets yet</td></tr>' :
                  tickets.map(t => `<tr data-ticket-id="${t.id}" data-status="${t.status}">
                    <td data-label="#" class="mono">${t.ticket_number}</td>
                    <td data-label="Title" class="ink">${escapeHtml(t.title)}</td>
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
          <div class="row">
            <a href="#/project/${projectId}/tickets" class="btn btn-secondary grow"  style="text-align:center">Cancel</a>
            <button type="submit" class="btn btn-primary grow" >Submit Ticket</button>
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
        <a href="#/project/${projectId}/tickets" class="back">&larr; Back to your tickets</a>

        <div class="t-head">
          <div>
            <h1>#${ticket.ticket_number} — ${escapeHtml(ticket.title)}</h1>
            <div class="sub">
              ${statusBadge(ticket.status)}
              ${typeBadge(ticket.type)}
              ${priorityBadge(ticket.priority)}
              <span>opened ${timeAgo(ticket.created_at)} by ${escapeHtml(ticket.created_by_name || 'Unknown')}</span>
              ${ticket.assigned_to_name ? `<span>&middot; with ${escapeHtml(ticket.assigned_to_name)}</span>` : ''}
            </div>
          </div>
        </div>

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
                    <span class="meta wh">${timeAgo(a.uploaded_at)}</span>
                    <button class="x att-delete" data-id="${a.id}" title="Delete attachment" aria-label="Delete attachment">&#10005;</button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
          ${!['closed', 'completed'].includes(ticket.status) && attachments.length < 10 ? `
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

          ${comments.length === 0 ? '<p class="hint mb-0">No comments yet.</p>' : comments.map(c => `
            <div class="cmt ${c.user_role === 'client' ? 'is-you' : 'is-team'}">
              <div class="cmt-h">
                <span class="who">${escapeHtml(c.user_name || 'Unknown')}</span>
                <span class="badge ${c.user_role === 'client' ? 'badge-green' : 'badge-blue'}">${c.user_role === 'client' ? 'you' : 'kaymen.dev'}</span>
                <span class="tm">${timeAgo(c.created_at)}</span>
              </div>
              <div class="cmt-b">${escapeHtml(c.body)}</div>
            </div>
          `).join('')}

          ${!['closed', 'completed'].includes(ticket.status) ? `
            <div class="cmt-form">
              <form id="commentForm">
                <textarea id="commentBody" placeholder="Add a comment&hellip;" required maxlength="5000"></textarea>
                <button type="submit" class="btn btn-primary btn-sm mt-m">Post comment</button>
              </form>
              <div id="commentMsg" class="mt-s"></div>
            </div>
          ` : '<p class="hint mb-0 divide">This ticket is closed. Open a new one and we will pick it up.</p>'}
        </div>
      `;

      // File upload handling
      const uploadFiles = async (files) => {
        if (!files || files.length === 0) return;
        const formData = new FormData();
        for (const f of files) formData.append('files', f);
        const progressEl = $('#uploadProgress');
        const msgEl = $('#uploadMsg');
        if (progressEl) progressEl.innerHTML = '<div class="hint mb-0">Uploading&hellip;</div>';
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
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('over'); });
        dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('over'); });
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
          <div class="login-logo"><span class="mark">K</span><span>kaymen<span class="accent">.</span>dev</span></div>
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
      $('#inviteMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div><p class="mt-l"><a href="#/login" class="lnk">Go to login</a></p>`;
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

/* ============================================================================
   kaymen.dev — analytics tracker

   Rewritten 2026-08-17. What changed and why, because most of it is not
   cosmetic:

   1. IT NOW SENDS THE PAGE. The old tracker put `path` in the visit payload and
      the server never stored it, so the panel could report how many people came
      and not one page any of them read. Path and title are first-class now, and
      a /work/<slug> navigation records its own pageview.

   2. HEARTBEATS NO LONGER CREATE ROWS. They used to POST /event every 30s, one
      database row each, forever — the exact growth the back-office handoff §6
      warned about. A heartbeat is now an UPDATE against the visit it belongs
      to. One row per visit, however long the visit lasts.

   3. IT COUNTS ACTIVE TIME, not wall-clock time. A tab left open over lunch used
      to report a two-hour visit. Active time only accrues while the document is
      visible, and stops after 30 seconds without a scroll, key or pointer.

   4. IT SURVIVES A MOBILE CLOSE. `beforeunload` does not fire reliably on iOS
      Safari or on any backgrounded tab that gets killed, so the final figures
      for phone traffic were simply lost. `visibilitychange` to hidden is the
      documented signal and it fires; `pagehide` backs it up.

   Do Not Track is still honoured before anything else runs.
   ============================================================================ */
(function () {
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1') return;

  var API = '/api/track';

  // ---- identity ------------------------------------------------------------
  // Two ids, deliberately different lifetimes. The session id is per tab-session
  // and answers "is this one visit". The visitor id persists and answers the
  // only question it is used for: first time here, or not. Neither leaves this
  // origin and neither is derived from anything about the device.
  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function store(area, key) {
    try {
      var v = area.getItem(key);
      if (!v) { v = uuid(); area.setItem(key, v); return { id: v, isNew: true }; }
      return { id: v, isNew: false };
    } catch (e) {
      return { id: uuid(), isNew: true }; // private mode: degrade, never throw
    }
  }
  var session = store(sessionStorage, '_k_sid');
  var visitor = store(localStorage, '_k_vid');
  var sessionId = session.id;

  // ---- state ---------------------------------------------------------------
  var visitId = null;
  var maxScroll = 0;
  var pageStart = Date.now();
  var activeMs = 0;
  var lastTick = Date.now();
  var lastInteraction = Date.now();
  var currentPath = location.pathname;
  var sent = false;

  var IDLE_AFTER_MS = 30000;

  function isActive() {
    return document.visibilityState === 'visible' && (Date.now() - lastInteraction) < IDLE_AFTER_MS;
  }

  // Accrue active time in small increments rather than measuring at the end,
  // which is the only way to exclude the middle of a visit rather than just its
  // tail.
  function tick() {
    var now = Date.now();
    if (isActive()) activeMs += now - lastTick;
    lastTick = now;
  }
  setInterval(tick, 1000);

  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'].forEach(function (evt) {
    window.addEventListener(evt, function () { lastInteraction = Date.now(); }, { passive: true });
  });

  // ---- scroll depth --------------------------------------------------------
  var scrollTimer;
  window.addEventListener('scroll', function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var height = document.documentElement.scrollHeight;
      if (height <= window.innerHeight) { maxScroll = 100; return; }
      var pct = Math.round((window.scrollY + window.innerHeight) / height * 100);
      if (pct > maxScroll) maxScroll = Math.min(pct, 100);
    }, 120);
  }, { passive: true });

  // ---- payload helpers -----------------------------------------------------
  function utm() {
    try {
      var q = new URLSearchParams(location.search);
      return {
        source: q.get('utm_source') || q.get('ref') || null,
        medium: q.get('utm_medium') || null,
        campaign: q.get('utm_campaign') || null
      };
    } catch (e) { return { source: null, medium: null, campaign: null }; }
  }

  function post(path, payload, beacon) {
    var body = JSON.stringify(payload);
    // sendBeacon is the only thing that reliably survives a page teardown, but
    // it cannot report a response — so it is used for the leave path only, and
    // fetch is used where the answer matters.
    if (beacon && navigator.sendBeacon) {
      try {
        return navigator.sendBeacon(API + path, new Blob([body], { type: 'application/json' }));
      } catch (e) { /* fall through to fetch */ }
    }
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: !!beacon
    }).catch(function () { });
  }

  function engagement() {
    tick();
    return {
      sessionId: sessionId,
      visitId: visitId,
      path: currentPath,
      scrollDepth: maxScroll,
      timeOnPage: Math.round((Date.now() - pageStart) / 1000),
      activeTime: Math.round(activeMs / 1000)
    };
  }

  // ---- visit ---------------------------------------------------------------
  function recordVisit() {
    var u = utm();
    post('/visit', {
      sessionId: sessionId,
      visitorId: visitor.id,
      isReturning: !visitor.isNew,
      referrer: document.referrer || '',
      path: location.pathname,
      title: document.title,
      screenWidth: screen.width,
      screenHeight: screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      language: navigator.language,
      timezone: (function () {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return null; }
      })(),
      utmSource: u.source,
      utmMedium: u.medium,
      utmCampaign: u.campaign
    }).then(function (res) {
      return res && res.json ? res.json() : null;
    }).then(function (data) {
      if (data && data.success) visitId = data.data.visitId;
    }).catch(function () { });
  }

  // ---- SPA navigation ------------------------------------------------------
  // The marketing site is server-rendered per page, so this fires on nothing
  // today. It exists because /work/<slug> is one history.pushState away from
  // being a client-side transition, and a tracker that silently stops counting
  // the moment that lands is worse than no tracker.
  function navigated() {
    if (location.pathname === currentPath) return;
    flush('pageview_end');            // close the page being left
    currentPath = location.pathname;
    maxScroll = 0;
    pageStart = Date.now();
    activeMs = 0;
    lastTick = Date.now();
    sent = false;
    post('/pageview', {
      sessionId: sessionId,
      visitId: visitId,
      path: currentPath,
      title: document.title,
      referrer: document.referrer || ''
    });
  }

  ['pushState', 'replaceState'].forEach(function (method) {
    var original = history[method];
    history[method] = function () {
      var out = original.apply(this, arguments);
      setTimeout(navigated, 0);
      return out;
    };
  });
  window.addEventListener('popstate', navigated);

  // ---- click + section tracking (still real events) ------------------------
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]');
    if (!el) return;
    post('/event', {
      sessionId: sessionId,
      visitId: visitId,
      type: 'click',
      target: el.getAttribute('data-track'),
      metadata: { text: (el.textContent || '').trim().substring(0, 80), path: currentPath }
    });
  });

  var viewedSections = {};
  if (window.IntersectionObserver) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.target.id && !viewedSections[entry.target.id]) {
          viewedSections[entry.target.id] = true;
          post('/event', {
            sessionId: sessionId, visitId: visitId,
            type: 'section_view', target: entry.target.id
          });
        }
      });
    }, { threshold: 0.25 });
    document.querySelectorAll('section[id]').forEach(function (s) { observer.observe(s); });
  }

  // ---- heartbeat + leave ---------------------------------------------------
  // 30s cadence kept, but it is an UPDATE now rather than an INSERT, and it is
  // skipped entirely while the tab is hidden or idle — a backgrounded tab used
  // to keep writing rows all night.
  setInterval(function () {
    if (!visitId || !isActive()) return;
    post('/engagement', engagement());
  }, 30000);

  function flush(reason) {
    if (sent || !visitId) return;
    sent = true;
    var payload = engagement();
    payload.final = true;
    payload.reason = reason || 'leave';
    post('/engagement', payload, true);
  }

  // visibilitychange is the one that actually fires on mobile. pagehide covers
  // desktop bfcache; beforeunload is kept last as the legacy belt.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush('hidden');
    else { sent = false; lastTick = Date.now(); lastInteraction = Date.now(); }
  });
  window.addEventListener('pagehide', function () { flush('pagehide'); });
  window.addEventListener('beforeunload', function () { flush('unload'); });

  recordVisit();
})();

/* Lightweight analytics tracker — kaymen.dev */
(function () {
  // Respect Do Not Track
  if (navigator.doNotTrack === '1') return;

  var API = '/api/track';
  var sessionId = sessionStorage.getItem('_k_sid');
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('_k_sid', sessionId);
  }

  var visitId = null;
  var maxScroll = 0;
  var startTime = Date.now();

  // Track max scroll depth
  var scrollTimer;
  window.addEventListener('scroll', function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var scrollPercent = Math.round(
        (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100
      );
      if (scrollPercent > maxScroll) maxScroll = scrollPercent;
    }, 100);
  }, { passive: true });

  // Record visit on page load
  function recordVisit() {
    var payload = JSON.stringify({
      sessionId: sessionId,
      referrer: document.referrer || '',
      path: location.pathname,
      title: document.title,
      screenWidth: screen.width,
      screenHeight: screen.height,
      language: navigator.language
    });

    fetch(API + '/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    }).then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) visitId = data.data.visitId;
      }).catch(function () { });
  }

  // Send event (uses sendBeacon when available for reliability)
  function sendEvent(type, target, metadata) {
    var payload = JSON.stringify({
      sessionId: sessionId,
      visitId: visitId,
      type: type,
      target: target || null,
      metadata: metadata || null
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(API + '/event', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(API + '/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(function () { });
    }
  }

  // Track clicks on elements with data-track attribute
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-track]');
    if (el) {
      sendEvent('click', el.getAttribute('data-track'), {
        text: (el.textContent || '').trim().substring(0, 80)
      });
    }
  });

  // Track section visibility with IntersectionObserver
  var viewedSections = {};
  if (window.IntersectionObserver) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !viewedSections[entry.target.id]) {
          viewedSections[entry.target.id] = true;
          sendEvent('section_view', entry.target.id);
        }
      });
    }, { threshold: 0.25 });

    document.querySelectorAll('section[id]').forEach(function (s) {
      observer.observe(s);
    });
  }

  // Heartbeat: send scroll depth + time updates every 30s
  setInterval(function () {
    sendEvent('heartbeat', null, {
      scrollDepth: maxScroll,
      timeOnPage: Math.round((Date.now() - startTime) / 1000)
    });
  }, 30000);

  // Send leave event on page unload
  window.addEventListener('beforeunload', function () {
    sendEvent('leave', null, {
      scrollDepth: maxScroll,
      timeOnPage: Math.round((Date.now() - startTime) / 1000)
    });
  });

  // Start
  recordVisit();
})();

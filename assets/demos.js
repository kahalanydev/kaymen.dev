/* ============================================================================
   Interactive case-study demos.

   One IIFE, no dependencies, no build step. Each demo boots from its
   [data-demo] container so a page carrying none of them costs nothing.

   All data is synthetic. These illustrate a mechanism; they never display a
   real record.
   ============================================================================ */
(function () {
  'use strict';

  const $ = (root, sel) => root.querySelector(sel);
  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));
  const out = (root, name) => root.querySelector(`[data-out="${name}"]`);

  /** Wire an aria-pressed button group; calls back with the chosen value. */
  function group(root, attr, onPick) {
    const btns = $$(root, `button[data-${attr}]`);
    btns.forEach((b) =>
      b.addEventListener('click', () => {
        btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        onPick(b.dataset[attr]);
      })
    );
    return btns;
  }

  const money = (n) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* --- 1. RLS ------------------------------------------------------------- */

  function rls(root) {
    // Synthetic roster. Four campuses, deliberately generic names.
    const ROWS = [
      ['Dana Ellis', 'Campus A'], ['Samir Okonkwo', 'Campus A'],
      ['Noa Bergman', 'Campus B'], ['Toby Fletcher', 'Campus C'],
      ['Priya Raman', 'Campus A'], ['Marcus Hale', 'Campus D'],
      ['Lior Adler', 'Campus B'], ['Erin Vasquez', 'Campus C'],
    ];

    function render(role) {
      const isSuper = role === 'super';
      const rows = isSuper ? ROWS : ROWS.filter((r) => r[1] === 'Campus A');

      out(root, 'user').textContent = isSuper ? 'thrive' : 'thrive_app';
      out(root, 'rolsuper').textContent = String(isSuper);
      out(root, 'rolsuper').className = isSuper ? 'bad' : 'good';
      out(root, 'count').textContent = String(rows.length);

      out(root, 'rows').innerHTML = rows
        .map(
          ([name, campus]) => `<tr class="${campus === 'Campus A' ? '' : 'foreign'}">
            <td>${name}</td><td><span class="campus">${campus}</span></td>
            <td>${campus === 'Campus A' ? '' : '<span class="leak">should not be visible</span>'}</td>
          </tr>`
        )
        .join('');

      const v = out(root, 'verdict');
      v.className = 'demo-verdict ' + (isSuper ? 'bad' : 'good');
      v.innerHTML = isSuper
        ? '<strong>Isolation is off.</strong> Superusers bypass row-level security unconditionally. Four campuses in one result set, no error, no warning — and every policy on the table is correct.'
        : '<strong>Policy enforced.</strong> Identical query, identical policies. The only thing that changed is that the connecting role is not a superuser.';
    }

    group(root, 'role', render);
    render('super');
  }

  /* --- 2. Fund basis ------------------------------------------------------ */

  function fund(root) {
    const ON_LOAN = 1_204_260.4;
    const CASH = 402_273.46;
    const UNDISTRIBUTED = 20_000.0;
    const DONATED = 921_400.2;
    const BORROWED = 712_517.36;

    const HELD = ON_LOAN + CASH - UNDISTRIBUTED;   // 1,586,533.86
    const IN = DONATED + BORROWED;                  // 1,633,917.56
    const GAP = IN - HELD;                          // 47,383.70

    const SETS = {
      in: {
        total: IN,
        bars: [
          { label: 'Donated outright', value: DONATED, tone: 'a' },
          { label: 'Lent to the fund by 44 people', value: BORROWED, tone: 'b' },
        ],
      },
      held: {
        total: HELD,
        bars: [
          { label: 'Out on loan', value: ON_LOAN, tone: 'a' },
          { label: 'Cash in the bank', value: CASH, tone: 'b' },
          { label: 'Grants still to distribute', value: -UNDISTRIBUTED, tone: 'neg' },
        ],
      },
    };

    let raf = null;
    function animateTo(target) {
      const el = out(root, 'total');
      const from = Number(String(el.dataset.v || target));
      const start = performance.now();
      cancelAnimationFrame(raf);
      (function tick(now) {
        const t = Math.min(1, (now - start) / 520);
        const e = 1 - Math.pow(1 - t, 3);
        const v = from + (target - from) * e;
        el.textContent = money(v);
        if (t < 1) raf = requestAnimationFrame(tick);
        else el.dataset.v = String(target);
      })(start);
      el.dataset.v = el.dataset.v || String(target);
    }

    function render(basis) {
      const set = SETS[basis];
      animateTo(set.total);

      const max = Math.max(...set.bars.map((b) => Math.abs(b.value)));
      out(root, 'bars').innerHTML = set.bars
        .map(
          (b) => `<div class="demo-bar ${b.tone}">
            <span class="demo-bar-label">${b.label}</span>
            <span class="demo-bar-track"><i style="width:${(Math.abs(b.value) / max) * 100}%"></i></span>
            <span class="demo-bar-value">${b.value < 0 ? '−' : ''}${money(Math.abs(b.value))}</span>
          </div>`
        )
        .join('');

      const gap = out(root, 'gap');
      gap.className = 'demo-gap ' + (basis === 'in' ? 'bad' : 'good');
      gap.innerHTML =
        basis === 'in'
          ? `<span class="demo-gap-value">${money(GAP)}</span>
             <span class="demo-gap-text"><strong>reported as “unexplained difference”</strong> — four years of bank fees, write-offs and running costs that left the bank and never came off the total.</span>`
          : `<span class="demo-gap-value">${money(GAP)}</span>
             <span class="demo-gap-text"><strong>now reported as “spent”</strong> — the figure reconciles to the bank with no remainder, and needs no expense record to be correct.</span>`;
    }

    group(root, 'basis', render);
    out(root, 'total').dataset.v = String(IN);
    render('in');
  }

  /* --- 3. Slot horizon ---------------------------------------------------- */

  function horizon(root) {
    const WINDOW = 30;         // rolling days the generator was meant to keep filled
    const slider = $(root, 'input[type=range]');
    const alertOn = $(root, '[data-fix="alert"]');
    const jobOn = $(root, '[data-fix="job"]');

    function render() {
      const day = Number(slider.value);
      // Detection and repair are deliberately separate: with only the daily job
      // enabled the window never empties, so the alarm would never be exercised
      // and the second half of the lesson would be unreachable.
      const detecting = alertOn.checked;
      const fixed = jobOn.checked;
      // Without the daily job the generated horizon shrinks as time advances.
      const remaining = fixed ? WINDOW : Math.max(0, WINDOW - day);
      const empty = remaining === 0;

      out(root, 'day').textContent = String(day);
      out(root, 'slots').innerHTML = empty
        ? '<strong>0 bookable slots</strong> — the booking page shows no availability'
        : `<strong>${remaining * 4} bookable slots</strong> across the next ${remaining} days`;

      out(root, 'calendar').innerHTML = Array.from({ length: WINDOW }, (_, i) => {
        const filled = i < remaining;
        return `<span class="cal-day${filled ? ' filled' : ''}"></span>`;
      }).join('');

      const status = out(root, 'status');
      const alerts = out(root, 'alerts');
      const errors = out(root, 'errors');

      if (empty && detecting) {
        status.textContent = 'HEALTHCHECK FAIL';
        status.className = 'demo-pill bad';
        alerts.textContent = '1 alert';
        alerts.className = 'demo-pill bad';
      } else {
        status.textContent = '200 OK';
        status.className = 'demo-pill ok';
        alerts.textContent = '0 alerts';
        alerts.className = 'demo-pill quiet';
      }
      // The request never fails in any branch — that is the entire point.
      errors.textContent = '0 errors';
      errors.className = 'demo-pill quiet';

      const v = out(root, 'verdict');
      if (fixed && detecting) {
        v.className = 'demo-verdict good';
        v.innerHTML =
          '<strong>Both halves in place.</strong> The daily job keeps the window extended, and the health check has to prove there is availability rather than being trusted because nothing crashed.';
      } else if (fixed) {
        v.className = 'demo-verdict';
        v.innerHTML =
          '<strong>Repaired, but still undetectable.</strong> The horizon no longer runs dry — but nothing here would tell you if it started to again. Fixing the cause without adding the alarm just resets the clock.';
      } else if (empty && detecting) {
        v.className = 'demo-verdict good';
        v.innerHTML =
          '<strong>Caught.</strong> Same empty calendar, same 200 response — but the check now asserts there is availability, so the absence itself is the alert.';
      } else if (empty) {
        v.className = 'demo-verdict bad';
        v.innerHTML =
          '<strong>Dry — and completely silent.</strong> No exception, no failed request, no alert that could have fired. The only symptom is an absence of bookings, which looks exactly like a quiet week.';
      } else {
        v.className = 'demo-verdict';
        v.innerHTML = `The generated window shrinks by one day, every day. <strong>${remaining} days of runway left.</strong>`;
      }
    }

    slider.addEventListener('input', render);
    alertOn.addEventListener('change', render);
    jobOn.addEventListener('change', render);
    render();
  }

  /* --- 4. OTA runtime ----------------------------------------------------- */

  function ota(root) {
    const VERSIONS = ['2.0.0', '2.0.1', '2.1.0', '2.2.0'];
    const state = { config: 2, store: 1 };

    function render(published) {
      out(root, 'config').textContent = VERSIONS[state.config];
      out(root, 'store').textContent = VERSIONS[state.store];
      const match = state.config === state.store;

      const term = out(root, 'terminal');
      if (published) {
        term.innerHTML = `<span class="t-dim">$ eas update --branch production</span>
<span class="t-dim">  Bundling JavaScript…                    done</span>
<span class="t-dim">  Uploading assets…                       done</span>
<span class="t-dim">  Runtime version</span> <span class="t-hi">${VERSIONS[state.config]}</span>
<span class="t-ok">✔ Published! Update group created.</span>
<span class="t-dim">  https://expo.dev/…/updates/8f2c1a</span>`;
        term.classList.add('is-on');
      }

      const pct = match ? 100 : 0;
      out(root, 'reach').textContent = pct + '%';
      out(root, 'reach').className = 'demo-reach-value ' + (match ? 'good' : 'bad');
      const bar = out(root, 'reachbar');
      bar.style.width = pct + '%';
      bar.className = match ? 'good' : 'bad';

      if (published) {
        const note = document.createElement('div');
        note.className = 'demo-verdict ' + (match ? 'good' : 'bad');
        note.innerHTML = match
          ? '<strong>Delivered.</strong> The published runtime matches the binary people actually have installed.'
          : `<strong>Published successfully to nobody.</strong> The command exited zero and the dashboard shows the update. No installed device runs runtime ${VERSIONS[state.config]}, so every user stays on the old code — indefinitely, and silently.`;
        const old = $(root, '.demo-verdict');
        if (old) old.remove();
        root.querySelector('.demo-body').appendChild(note);
      }
    }

    $$(root, 'button[data-step]').forEach((b) =>
      b.addEventListener('click', () => {
        const [key, delta] = b.dataset.step.split(':');
        state[key] = Math.max(0, Math.min(VERSIONS.length - 1, state[key] + Number(delta)));
        const old = $(root, '.demo-verdict');
        if (old) old.remove();
        render(false);
      })
    );
    $(root, '[data-publish]').addEventListener('click', () => render(true));
    render(false);
  }

  /* --- 5. Ingestion ceiling ----------------------------------------------- */

  function ingest(root) {
    const slider = $(root, 'input[type=range]');
    const PER_MONTH = 2615;     // synthetic, but proportionate to ~243k lifetime
    const CEILING = 60000;      // where an unbounded query stops returning at all
    let mode = 'naive';
    let timer = null;

    function render() {
      const months = Number(slider.value);
      const rows = months * PER_MONTH;
      out(root, 'window').textContent =
        months >= 12 ? `${(months / 12).toFixed(months % 12 ? 1 : 0)} years` : `${months} months`;
      out(root, 'rows').textContent = rows.toLocaleString('en-US');

      const bar = out(root, 'bar');
      const v = out(root, 'verdict');
      const short = out(root, 'verdictShort');
      clearTimeout(timer);

      if (mode === 'naive' && rows > CEILING) {
        bar.style.width = '100%';
        bar.className = 'bad';
        short.textContent = 'timeout';
        short.className = 'bad';
        v.className = 'demo-verdict bad';
        v.innerHTML =
          '<strong>504 — and zero rows returned.</strong> Not a slow response: no partial result, no cursor, no way to resume. Ask for more history and you get strictly less data than asking for less.';
      } else if (mode === 'naive') {
        bar.style.width = Math.min(100, (rows / CEILING) * 100) + '%';
        bar.className = 'warn';
        short.textContent = 'ok';
        short.className = 'good';
        v.className = 'demo-verdict';
        v.innerHTML = `Fits — for now. <strong>${Math.round((rows / CEILING) * 100)}% of the way to the ceiling</strong>, which nothing in the API tells you about until you cross it.`;
      } else {
        bar.style.width = '0%';
        bar.className = 'good';
        short.textContent = 'resumable';
        short.className = 'good';
        v.className = 'demo-verdict good';
        v.innerHTML =
          '<strong>Bounded, then incremental.</strong> A fixed-start backfill makes the initial load finite and resumable; delta sync on last-activity keeps it fresh. Extending history later clears one row of sync state instead of re-running the import.';
        // Fill the bar to show the backfill completing.
        requestAnimationFrame(() => { bar.style.width = '100%'; });
      }
    }

    group(root, 'mode', (m) => { mode = m; render(); });
    slider.addEventListener('input', render);
    render();
  }

  /* --- 6. Task id correlation --------------------------------------------- */

  function taskid(root) {
    const TOTAL = 5;
    let keying = 'naive';
    let timers = [];

    function reset() {
      timers.forEach(clearTimeout);
      timers = [];
      out(root, 'stream').innerHTML = '';
      out(root, 'done').textContent = '0';
      out(root, 'total').textContent = String(TOTAL);
      out(root, 'panelbar').style.width = '0%';
      out(root, 'dropped').innerHTML = '';
      out(root, 'dropped').className = 'demo-dropped';
    }

    function line(html, cls) {
      const el = document.createElement('div');
      el.className = 'ev ' + (cls || '');
      el.innerHTML = html;
      out(root, 'stream').appendChild(el);
      const s = out(root, 'stream');
      s.scrollTop = s.scrollHeight;
    }

    function run() {
      reset();
      let done = 0;
      let dropped = 0;
      const fixed = keying === 'fixed';

      for (let i = 0; i < TOTAL; i++) {
        const callId = `call_${(i + 1).toString().padStart(2, '0')}`;
        const taskId = `t_${88 + i}`;

        timers.push(setTimeout(() => {
          line(`<span class="ev-k">tool_use</span> TaskCreate <span class="ev-id">${callId}</span>`);
        }, i * 620));

        timers.push(setTimeout(() => {
          line(`<span class="ev-k res">tool_result</span> { taskId: <span class="ev-id hi">${taskId}</span> }`);
        }, i * 620 + 210));

        timers.push(setTimeout(() => {
          if (fixed) {
            done++;
            out(root, 'done').textContent = String(done);
            out(root, 'panelbar').style.width = (done / TOTAL) * 100 + '%';
            line(`<span class="ev-k upd">TaskUpdate</span> <span class="ev-id hi">${taskId}</span> → matched <span class="ok">✓</span>`, 'ok');
          } else {
            dropped++;
            line(`<span class="ev-k upd">TaskUpdate</span> <span class="ev-id">${taskId}</span> → no such key <span class="drop">dropped</span>`, 'drop');
            const d = out(root, 'dropped');
            d.className = 'demo-dropped is-on';
            d.innerHTML = `<strong>${dropped}</strong> update${dropped > 1 ? 's' : ''} discarded — keyed on <code>${'call_..'}</code>, arrived as <code>t_..</code>`;
          }
        }, i * 620 + 430));
      }

      timers.push(setTimeout(() => {
        if (!fixed) {
          out(root, 'done').textContent = String(TOTAL);
          out(root, 'panelbar').style.width = '100%';
          line(`<span class="ev-k end">turn end</span> panel jumps 0 → ${TOTAL}`, 'late');
        }
      }, TOTAL * 620 + 700));
    }

    group(root, 'key', (k) => { keying = k; reset(); });
    $(root, '[data-run]').addEventListener('click', run);
    reset();
  }

  /* --- boot ---------------------------------------------------------------- */

  const BOOT = { rls, fund, horizon, ota, ingest, taskid };

  function init() {
    document.querySelectorAll('[data-demo]').forEach((el) => {
      const fn = BOOT[el.dataset.demo];
      if (!fn || el.dataset.booted) return;
      el.dataset.booted = '1';
      try {
        fn(el);
      } catch (err) {
        // A broken demo must never take the page with it.
        el.classList.add('demo-failed');
        console.error(`[demo:${el.dataset.demo}]`, err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

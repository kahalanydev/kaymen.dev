/* ============================================================================
   Interactive "hard part" demos — markup only.

   Each case study's hardest bug is a playable artifact instead of four
   paragraphs. Behaviour lives in assets/demos.js (keyed on data-demo), styling
   in assets/demos.css. Markup is generated here so it stays next to the case
   study content it belongs to.

   Every value shown is SYNTHETIC. No client name, no real record, no real
   person — the demos illustrate a mechanism, they do not display data.
   ============================================================================ */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

/** Shared shell so every demo reads the same way. */
function shell({ id, kicker, title, body, caption }) {
  return `<figure class="demo" data-demo="${esc(id)}">
    <figcaption class="demo-head">
        <span class="demo-tag">Interactive — try it</span>
        <h3 class="demo-title">${esc(title)}</h3>
        ${kicker ? `<p class="demo-kicker">${esc(kicker)}</p>` : ''}
    </figcaption>
    <div class="demo-body">${body}</div>
    <p class="demo-caption">${caption}</p>
</figure>`;
}

/* --- 1. Row-level security bypassed by a superuser -------------------------- */

const rls = shell({
  id: 'rls',
  title: 'Same query. Two database roles.',
  kicker: 'The application never changed. Only the credential it connects with did.',
  body: `
    <div class="demo-switch" role="group" aria-label="Database role">
        <button type="button" data-role="super" aria-pressed="true">
            <span class="sw-name">thrive</span><span class="sw-sub">bootstrap superuser</span>
        </button>
        <button type="button" data-role="app" aria-pressed="false">
            <span class="sw-name">thrive_app</span><span class="sw-sub">non-superuser</span>
        </button>
    </div>

    <div class="demo-console">
        <div class="demo-console-bar">
            <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
            <span class="demo-console-title">psql — request scoped to Campus A</span>
        </div>
        <pre class="demo-sql"><span class="c">-- policy: students.org_id = current_setting('app.current_org_id')</span>
<span class="c">-- table has ENABLE + FORCE ROW LEVEL SECURITY</span>
<span class="k">SELECT</span> name, campus <span class="k">FROM</span> students <span class="k">LIMIT</span> 8;</pre>
        <div class="demo-facts">
            <span><em>current_user</em> <code data-out="user">thrive</code></span>
            <span><em>rolsuper</em> <code data-out="rolsuper">true</code></span>
            <span><em>rows</em> <code data-out="count">8</code></span>
        </div>
        <table class="demo-table"><tbody data-out="rows"></tbody></table>
    </div>

    <div class="demo-verdict" data-out="verdict"></div>`,
  caption:
    'The managed Postgres made the app’s user the cluster’s bootstrap superuser, and superusers bypass row-level security unconditionally — <code>FORCE ROW LEVEL SECURITY</code> does not apply to them. Every policy was correct. Nothing errored. Isolation was simply off. The bootstrap user cannot be demoted, so the fix was a second role owning every table.',
});

/* --- 2. Fund size counted from the wrong side ------------------------------- */

const fund = shell({
  id: 'fund',
  title: 'One fund. Two definitions. A $47,383 gap.',
  kicker: 'Switch which side of the balance sheet the headline number is counted from.',
  body: `
    <div class="demo-switch wide" role="group" aria-label="Counting basis">
        <button type="button" data-basis="in" aria-pressed="true">
            <span class="sw-name">Count what went in</span><span class="sw-sub">donations + owed to lenders</span>
        </button>
        <button type="button" data-basis="held" aria-pressed="false">
            <span class="sw-name">Count what is held</span><span class="sw-sub">on loan + cash − undistributed</span>
        </button>
    </div>

    <div class="demo-figure">
        <span class="demo-figure-label">Total fund size</span>
        <span class="demo-figure-value" data-out="total">$1,633,917.56</span>
        <div class="demo-bars" data-out="bars"></div>
        <div class="demo-gap" data-out="gap"></div>
    </div>`,
  caption:
    'Counting from money-in produces a figure that can only ever rise. Four years of bank fees, write-offs and running costs had never come off it — and could not be netted off, because the books hold zero recorded transactions. Counting what is <em>held</em> needs no expense record to be correct: money that left the bank is already absent from it.',
});

/* --- 3. A horizon that runs dry with no error ------------------------------- */

const horizon = shell({
  id: 'horizon',
  title: 'Drag time forward. Watch nothing break.',
  kicker: 'Bookable slots are generated into a rolling window. Generation ran once, at deploy.',
  body: `
    <div class="demo-scrub">
        <label for="demo-horizon-day">Days since deploy</label>
        <input type="range" id="demo-horizon-day" min="0" max="45" value="0" step="1">
        <output data-out="day">0</output>
    </div>

    <div class="demo-monitor">
        <span class="demo-pill ok" data-out="status">200 OK</span>
        <span class="demo-pill quiet" data-out="alerts">0 alerts</span>
        <span class="demo-pill quiet" data-out="errors">0 errors</span>
    </div>

    <div class="demo-calendar" data-out="calendar" aria-hidden="true"></div>
    <div class="demo-slotline"><span data-out="slots">28 bookable slots</span></div>

    <div class="demo-checks">
        <label class="demo-check">
            <input type="checkbox" data-fix="alert">
            <span><em>Detect it</em> — treat an empty forward window as a health-check failure</span>
        </label>
        <label class="demo-check">
            <input type="checkbox" data-fix="job">
            <span><em>Fix it</em> — run the horizon job daily instead of once at deploy</span>
        </label>
    </div>

    <div class="demo-verdict" data-out="verdict"></div>`,
  caption:
    'The site was up, the API returned 200, and the calendar rendered correctly — with nothing in it. A correctly-rendered empty calendar is indistinguishable from a quiet week to every monitor you would think to set up. Uptime checks answer <em>did it respond</em>, never <em>did it respond with anything</em>.',
});

/* --- 4. An OTA update that publishes to nobody ------------------------------ */

const ota = shell({
  id: 'ota',
  title: 'Publish an update. Reach zero users.',
  kicker: 'Expo matches updates to a runtime version. A device only accepts its own.',
  body: `
    <div class="demo-dials">
        <div class="demo-dial">
            <span class="demo-dial-label">app.json <em>runtimeVersion</em></span>
            <div class="demo-stepper">
                <button type="button" data-step="config:-1" aria-label="Decrease">−</button>
                <code data-out="config">2.1.0</code>
                <button type="button" data-step="config:1" aria-label="Increase">+</button>
            </div>
        </div>
        <div class="demo-dial">
            <span class="demo-dial-label">binary in the store</span>
            <div class="demo-stepper">
                <button type="button" data-step="store:-1" aria-label="Decrease">−</button>
                <code data-out="store">2.0.1</code>
                <button type="button" data-step="store:1" aria-label="Increase">+</button>
            </div>
        </div>
    </div>

    <button type="button" class="demo-action" data-publish>eas update --branch production</button>

    <div class="demo-terminal" data-out="terminal"></div>

    <div class="demo-reach">
        <span class="demo-reach-label">Installed devices that receive it</span>
        <div class="demo-reach-bar"><span data-out="reachbar"></span></div>
        <span class="demo-reach-value" data-out="reach">0%</span>
    </div>`,
  caption:
    'The publish succeeds either way. It reports success, exits zero, and appears in the dashboard — it has simply landed on a runtime no installed device has. “Did it publish” and “did it arrive” are different questions, and only one of them is answered for you.',
});

/* --- 5. An API that cannot answer the question ----------------------------- */

const ingest = shell({
  id: 'ingest',
  title: 'Ask for more history. Get nothing at all.',
  kicker: 'Roughly 243,000 tickets exist. The failure is not slowness — it is a total loss.',
  body: `
    <div class="demo-switch wide" role="group" aria-label="Ingestion strategy">
        <button type="button" data-mode="naive" aria-pressed="true">
            <span class="sw-name">Fetch it all</span><span class="sw-sub">one unbounded query</span>
        </button>
        <button type="button" data-mode="bounded" aria-pressed="false">
            <span class="sw-name">Bounded backfill + delta sync</span><span class="sw-sub">resumable, per-entity state</span>
        </button>
    </div>

    <div class="demo-scrub">
        <label for="demo-ingest-years">History requested</label>
        <input type="range" id="demo-ingest-years" min="1" max="60" value="8" step="1">
        <output data-out="window">8 months</output>
    </div>

    <div class="demo-facts wide">
        <span><em>matching tickets</em> <code data-out="rows">20,920</code></span>
        <span><em>result</em> <code data-out="verdictShort">ok</code></span>
    </div>

    <div class="demo-progress"><span data-out="bar"></span></div>
    <div class="demo-verdict" data-out="verdict"></div>`,
  caption:
    'An unbounded query times out server-side and returns <em>nothing</em> — no partial result, no cursor, no clue about the shape of the problem. The fix is not a cleverer query. It is accepting that you now own a synchronisation problem, and building the per-entity state that makes it resumable.',
});

/* --- 6. Updates keyed on an id that does not exist yet ---------------------- */

const taskid = shell({
  id: 'taskid',
  title: 'Watch the progress panel stay at zero.',
  kicker: 'The task id is assigned in the tool result, not in the call that announces it.',
  body: `
    <div class="demo-switch wide" role="group" aria-label="Correlation strategy">
        <button type="button" data-key="naive" aria-pressed="true">
            <span class="sw-name">Key on the announcement</span><span class="sw-sub">what the panel did</span>
        </button>
        <button type="button" data-key="fixed" aria-pressed="false">
            <span class="sw-name">Thread the tool-use id</span><span class="sw-sub">re-key when the real id lands</span>
        </button>
    </div>

    <button type="button" class="demo-action" data-run>Run a turn</button>

    <div class="demo-split">
        <div class="demo-stream">
            <span class="demo-col-label">event stream</span>
            <div data-out="stream"></div>
        </div>
        <div class="demo-panel">
            <span class="demo-col-label">tasks panel</span>
            <div class="demo-panel-count"><span data-out="done">0</span> / <span data-out="total">5</span></div>
            <div class="demo-panel-bar"><span data-out="panelbar"></span></div>
            <div class="demo-dropped" data-out="dropped"></div>
        </div>
    </div>`,
  caption:
    'Nothing errors. Updates arrive carrying the real id and land against keys that do not exist yet, so they are silently discarded and the panel reports 0 of 5 until the turn ends. When updates go missing without erroring, the bug is almost always a key that has not been created — not a message that never arrived.',
});

/* --------------------------------------------------------------------------- */

const DEMOS = {
  'multi-campus-engagement-platform': rls,
  'community-lending-ledger': fund,
  'bilingual-booking-platform': horizon,
  'torah-tracker': ota,
  'msp-time-compliance-portal': ingest,
  'claude-code-desk': taskid,
};

module.exports = { DEMOS, demoFor: (slug) => DEMOS[slug] || '' };

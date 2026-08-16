/* ============================================================================
   kaymen.dev — content layer
   ----------------------------------------------------------------------------
   Single source of truth for the homepage, the /work index, and every
   /work/<slug> case study. Rendered server-side by server/render.js — there is
   no build step and no client-side hydration, so what a crawler sees is what a
   human sees.

   ---------------------------------------------------------------------------
   CLIENT NAMING POLICY
   ---------------------------------------------------------------------------
   CHANNEL-PLAN.md §7 decision 4 (2026-08-12) made every client anonymous, on
   the grounds that describing work by shape is what removes the need to ask.

   AMENDED 2026-08-16, on Ohav's instruction. Consent is recorded PER PROJECT
   now, not by one global switch, because the real situation is per project:
   Thrive, PCG and ShipHero-AI are his own or in-house, and BridgeMortgage and
   Horse & Harmony are third-party businesses he confirms have agreed. One
   switch would have named all of them together, including any client added
   later who was never asked.

   So: a case study's TITLE is always the shape name. `client.named: true` adds
   the client's own name beside it. The default is false, which means a project
   added without thinking about this stays anonymous rather than leaking.
   `CLIENT_NAMING` survives as a global override and stays 'anonymous'.
   ============================================================================ */

const CLIENT_NAMING = 'anonymous'; // 'anonymous' | 'named'

/* ---------------------------------------------------------------------------
   Practice areas — replaces the 19-card grid.
   Three columns, deliberately equal weight (decision 1: generalist).
   --------------------------------------------------------------------------- */

const PRACTICE_AREAS = [
  {
    id: 'platforms',
    label: 'Platforms',
    title: 'Multi-tenant platforms',
    promise:
      'One system, many organisations, isolation enforced at the database rather than hoped for in the application.',
    detail:
      'The work is usually a replacement: an organisation outgrows a spreadsheet, a WordPress install, or six disconnected tools, and needs one platform that several groups can use without seeing each other. That means real tenancy, an audit trail, role and permission models, and a migration that runs while the old system is still live.',
    proof: [
      'Row-level security enforced in Postgres, verified in production',
      'Live migrations off legacy systems with no downtime window',
      'Per-tenant admin panels, HQ oversight across all tenants',
    ],
    stack: ['Laravel', 'Filament', 'PostgreSQL', 'Livewire', 'Node/Express', 'MySQL'],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    title: 'Business systems & integrations',
    promise:
      'The connective work most shops decline: two-way syncs, financial reconciliation, and APIs that were never designed for the question being asked.',
    detail:
      'Every one of these started as "can it just talk to X." X is usually Salesforce, QuickBooks, a PSA, a payment or shipping provider, or a calendar. And the honest answer is that the integration is the project. Rate limits, pagination ceilings, records that exist on one side and not the other, and a reconciliation story for when the two disagree.',
    proof: [
      'Two-way Salesforce sync: bridge objects, flow deploys via Metadata API',
      'Accounting reconciliation against a live book',
      'Delta-sync ingestion pipelines that survive API timeouts',
    ],
    stack: ['Salesforce API', 'QuickBooks Online', 'Autotask REST', 'Shopify', 'Google Calendar', 'Python'],
  },
  {
    id: 'apps',
    label: 'Apps',
    title: 'Consumer & mobile apps',
    promise:
      'Native iOS and Android in the stores, plus the release discipline that keeps an update from reaching zero users.',
    detail:
      'Shipping the first build is the easy half. The hard half is everything after: over-the-air updates that actually land on the installed base, native modules paired to the right binary, bilingual and right-to-left layouts, offline behaviour, and push notifications that arrive on the phones people actually own.',
    proof: [
      'Apps live in the App Store and Google Play with real users',
      'OTA update pipeline with runtime-version gating',
      'Full RTL/bilingual interfaces, not translated afterthoughts',
    ],
    stack: ['React Native', 'Expo / EAS', 'Astro', 'Capacitor', 'Electron', 'PWA'],
  },
];

/* ---------------------------------------------------------------------------
   Case studies. Deep, and led by the one closest to the buyer we want.
   Template (MARKETING-PLAN.md §7): problem → constraints → what we built →
   the hard part → outcome → stack. `hardPart` is the section that does the
   actual selling, so it is written as a specific failure and its fix, not as
   a capability claim.
   --------------------------------------------------------------------------- */

const CASE_STUDIES = [
  {
    slug: 'mortgage-broker-client-portal',
    /* 'stack', not 'platform'. The platform rung is "several systems, several
       teams, and the reporting across all of it", which does not describe a
       two-to-three-seat brokerage. The tag also has to survive arithmetic: this
       was 13 working days, so a $19,000 platform quote implies $183-244/hr,
       well above our own $125/hr overflow, and it tipped past PARTNER_AT into
       the 12-month partnership — which put "year one $42,000" next to an agency
       figure of $15,600-20,800 and made us look twice the price. At 'stack' it
       is $10,500, or $101-135/hr, which brackets $125. */
    pricing: { tier: 'stack', addons: ['portal', 'migrate'] },
    area: 'platforms',
    name: 'Mortgage broker and client portal',
    client: { real: 'BridgeMortgage', named: true },
    tagline: 'A brokerage running on board software, a Word document and an inbox.',
    summary:
      'A mortgage brokerage tracked live deals on a board tool, sent its application form as a Word document by email, and collected client paperwork as attachments. We replaced all three with one portal: a six-step client journey, an application form inside it, and a document vault the broker can actually search.',
    year: '2026',
    status: 'Live in production',
    scale: [
      { value: '313', label: 'live deals migrated into the new journey' },
      { value: '54', label: 'application fields, off paper and into the portal' },
      { value: '6', label: 'stages matching the real mortgage process' },
    ],
    problem: [
      'The pipeline lived on a board tool, one card per deal, priced per seat. It held the broker\'s view of a deal and nothing of the client\'s. Everything the client had to supply arrived by email and was reconciled by hand.',
      'The application itself was a Word document, emailed out and emailed back. Fifty-four fields, retyped into the pipeline by somebody every time, with no validation and no way to tell which client had answered what.',
      'A first attempt modelled the client journey in four steps. The broker\'s reaction was that four steps is not how a mortgage works, which meant the data model was wrong rather than the copy.',
    ],
    problemShort: [
      'Deal pipeline on a per-seat board tool that held the broker\'s view and none of the client\'s.',
      'The application form was a Word document, emailed both ways, then retyped by hand.',
      'The first four-step journey did not match the real mortgage process, so the model was wrong.',
    ],
    constraints: [
      'Real financial documents and identity paperwork, so storage had to be encrypted, virus-scanned and permission-checked rather than a shared folder.',
      'Deals already in flight. A migration had to place every existing deal into the new journey without a broker sorting them by hand.',
      'The people using the admin side are brokers, not operators. The internal UI had to hit the same bar as the client-facing one.',
      'A returning client buying a second property must not end up with a duplicate login, and must not see the wrong deal.',
    ],
    built: [
      'A six-step client journey built from the broker\'s description of the real process, with the stage copy and the paperwork bound to each stage both editable at runtime rather than in code.',
      'The application form moved inside the portal as a wizard, so answers land in the database validated instead of arriving as a document to be retyped.',
      'A document vault laid out per client and per deal, encrypted at rest and virus-scanned on upload, with filenames on disk that carry no client information.',
      'A broker pipeline over the same data, so the client view and the broker view are two readings of one record rather than two systems to reconcile.',
      'An idempotent invite: a returning client gets a fresh sign-in link against their existing account, never a second login.',
    ],
    hardPart: {
      title: 'The switch that had to be off before it existed',
      body: [
        'The brokerage was mid-migration with real client records already loaded, and the instruction was unambiguous: no automatic email may reach an existing client. Not "we will turn it off before launch". Off, now, on production.',
        'The obvious implementation is a settings flag defaulting to false. The trap is that a settings row which has never been written does not read as false. It reads as absent, and absent is not false unless somebody decides it is. A flag that defaults to off in code but reads null from an unwritten row is a flag that is off in the developer\'s head and undefined in production.',
        'So the read path treats an absent row as off, deliberately, and the deployment carries no migration to create it. The setting is safe on production precisely because nothing had to run successfully for it to be safe. A missing row is the safe state rather than an unknown one.',
        'Verifying it produced the more useful finding. The number everyone had been quoting for how many clients were reachable counted rows in the clients table. The number that matters counts clients with a portal login, because only those can be emailed at all. Those are different tables and, at that moment, very different numbers: one hundred and forty one against four.',
      ],
      lesson:
        'A default is only a default if the code that reads it agrees. Anything configurable has an unwritten state as well as true and false, and the unwritten state is the one that ships first. Decide what it means before it means something by accident.',
    },
    outcome: [
      'One system holds the deal, the application and the documents, so nothing is retyped between them.',
      'Every existing deal was placed into the new journey by migration rather than by hand.',
      'Per-seat cost is gone. Adding a broker or a client costs nothing, because there is nobody to pay per head.',
      'The brokerage owns the server, the repository and the data, and can move all three without asking us.',
    ],
    stack: ['Next.js', 'TypeScript', 'MySQL', 'Knex', 'Redis', 'ClamAV', 'Docker', 'Coolify'],
  },
  {
    slug: 'multi-campus-engagement-platform',
    pricing: { tier: 'platform', addons: ['tenant', 'connect', 'mobile'] },
    area: 'platforms',
    name: 'Multi-campus engagement platform',
    client: { real: 'Thrive / OLAMI', named: true },
    tagline: 'Four campuses, one database, isolation that had to be provably real.',
    summary:
      'A network of campus organisations ran on a 135,000-line WordPress plugin. One install per campus, student records duplicated across sites, no shared reporting, and a Salesforce org nobody trusted. We replaced it with a single multi-tenant platform.',
    /* 2025, not 2026: this began as the OLAMI system and became Thrive. `year`
       is LIVE SINCE — when it first carried real users — not when the current
       repo starts. The KDEV repos were re-initialised, so git history begins
       Feb–Jun 2026 and understates anything older (see the measurement table in
       unified-memory retainer-pricing-ladder). Ohav confirmed 2026-08-16 that
       only this, Torah Tracker and Davenen predate 2026. */
    year: '2025',
    status: 'Live in production',
    scale: [
      { value: '4', label: 'campuses on one platform' },
      { value: '135K', label: 'lines of legacy code retired' },
      { value: '2×/day', label: 'Salesforce sync, zero duplicates' },
    ],
    problem: [
      'Each campus ran its own copy of a large WordPress plugin. The same student could exist three times across three installs with three different histories, and there was no way to answer a question across the network. Headcount, attendance, engagement: without exporting three spreadsheets and reconciling them by hand.',
      'The parent organisation treated Salesforce as the system of record, but the data reaching it came from manual weekly CSV exports. By the time anyone looked, it was stale and partly wrong.',
    ],
    problemShort: [
      "One WordPress install per campus: the same student existing three times with three histories.",
      "No way to answer any question across the network without exporting three spreadsheets.",
      "Salesforce was the system of record, fed by manual weekly CSVs that were stale on arrival.",
    ],
    constraints: [
      'Real student PII across every campus: the isolation story had to be provable, not asserted.',
      'The old system stayed live throughout. There was no maintenance window and no cutover weekend.',
      'A native mobile app was already in the App Store with installed users. It had to keep working, on the same binary, while the backend underneath it changed completely.',
      'Salesforce had to stay in sync in both directions, without creating duplicate contacts in an org with an active duplicate-detection rule.',
    ],
    built: [
      'A single Laravel + Filament platform on one Postgres database, with per-campus tenancy enforced by row-level security.',
      'A per-campus admin panel, plus a cross-campus HQ panel for the parent organisation. The same data, two scopes, one permission model.',
      'A drag-and-drop public site builder so each campus runs its own public-facing site out of the same platform.',
      'Two-way Salesforce sync built on bridge objects, with flow deployment via the Metadata API.',
      'A read-only AI admin assistant, walled off from writes at the database layer.',
      'The v2 API the existing mobile app now runs against.',
    ],
    hardPart: {
      title: 'Row-level security that silently did nothing',
      body: [
        'Tenant isolation was designed on Postgres row-level security: every tenant table gets a policy, the request sets the current organisation, the database refuses to return anyone else\'s rows. Policies were in place. The tests passed. And one campus could still have read another\'s students.',
        'The managed Postgres had provisioned the application\'s database user as the cluster\'s **bootstrap superuser**. Superusers bypass row-level security unconditionally. `FORCE ROW LEVEL SECURITY` does not apply to them. And the bootstrap user cannot be demoted; Postgres refuses. So the entire isolation layer was inert, and nothing about the running application looked wrong.',
        'The fix was a separate non-superuser role, with ownership of every table and sequence in the schema reassigned to it, and the application moved onto it. `current_user` is now asserted on boot, because a future deploy that quietly reverts the credential would turn tenant isolation back off without a single error.',
        'Then the same property bit from the other direction. A migration backfilling a new column looped over an existing table and wrote nothing. It ran under row-level security with no bypass active, so the read returned zero rows and the loop did nothing, successfully. 152 student records went blank and the migration reported success. Anything crossing tenants now has to say so explicitly.',
      ],
      lesson:
        'A security control that fails open is worse than one you never built, because it also buys you confidence. Both bugs here were silent successes: the check that catches them is asserting the precondition at runtime, not testing the behaviour once.',
    },
    outcome: [
      'Four campuses live on one platform; the legacy plugin retired.',
      'Salesforce syncing twice daily across all campuses, zero failures and zero duplicate contacts on cutover.',
      'The mobile app moved onto the new backend without a forced update.',
      'Cross-network reporting that previously required three exports and a spreadsheet is now a page.',
    ],
    stack: ['Laravel 13', 'Filament 5', 'PostgreSQL + RLS', 'Livewire 4', 'React Native', 'Salesforce REST + Metadata API'],
    shots: [],
  },

  {
    slug: 'community-lending-ledger',
    pricing: { tier: 'stack', addons: ['connect', 'migrate'] },
    area: 'platforms',
    name: 'Community lending ledger',
    client: { real: 'Passaic Clifton Gemach', named: true },
    tagline: 'A $1.58M interest-free loan fund whose headline number was wrong by $47,383.',
    summary:
      'An interest-free community loan fund ran on spreadsheets, contracts in Google Drive, and a bookkeeping tool with no transaction export. We built the ledger, and in the process found that the number everyone quoted was measuring the wrong side of the balance sheet.',
    year: '2026',
    status: 'Live in production',
    scale: [
      { value: '$1.58M', label: 'fund reconciled to the bank' },
      { value: '44', label: 'lenders tracked individually' },
      { value: '$47K', label: 'previously-unexplained gap, resolved' },
    ],
    problem: [
      'The fund lends interest-free and is capitalised by two very different sources: money donated outright, and money lent to the fund by 44 individuals who expect it back. Tracking who is owed what, what is out on loan, and what is actually in the bank was a spreadsheet exercise nobody could fully verify.',
      'Loan contracts lived as PDFs in Google Drive, disconnected from any record of the loan itself, and guarantor details existed only inside those documents.',
    ],
    problemShort: [
      "A fund capitalised two ways: donated money, and money owed back to 44 lenders.",
      "Loan contracts sat as PDFs in Drive, disconnected from any record of the loan.",
      "The headline fund figure had drifted $47,383 from what the bank actually held.",
    ],
    constraints: [
      'The books had zero journal entries and zero recorded transactions. Four years of bank fees, write-offs and running costs had simply never been entered anywhere.',
      'The bookkeeping tool in use has no scheduled export and no per-transaction API, so expenses could not be pulled in and netted off.',
      'The administrators are not technical. Anything requiring a reconciliation ritual would not get done.',
    ],
    built: [
      'A loan ledger with borrowers, guarantors, repayment schedules and per-lender balances.',
      'Contract sync from Google Drive, with guarantor extraction backfilled from the documents themselves.',
      'A dashboard that reports the fund from the side that can actually be verified.',
      'Per-lender statements showing each lender\'s money at work as a share of what the fund holds.',
    ],
    hardPart: {
      title: 'The headline number was measuring the wrong side',
      body: [
        'Total Fund Size was computed from money that went **in**: donations plus what was still owed to lenders. That figure can only ever rise. Four years of bank fees, write-offs and running costs had left the fund without ever coming off the total.',
        'So the dashboard read **$1,633,917.56** while the gemach actually held **$1,586,533.86**, and the $47,383.70 between them sat on the page labelled "unexplained difference". Visible to everyone, explicable by no one.',
        'The instinct is to find the missing expenses and subtract them. That was impossible: there is no expense record to find, and building one retroactively across four years would have been an invention, not a reconstruction.',
        'The fix was to change which side the number is counted from. Fund size is now **what is held**: out on loan, plus cash in the bank, minus grants still to be distributed. That needs no expense record to be correct, because money that has left the bank is already absent from it. Money-in is kept as its own separate figure, since "who do we owe" is a genuinely different question from "what do we have", and the gap between them is now reported plainly as what has been spent.',
        'Two consequences were accepted deliberately. A lender\'s share of the fund rose, because the denominator got smaller. And that is the more truthful number. And the fund is allowed to go negative rather than being clamped at zero: a fund over-committed to causes should say so on its own dashboard.',
      ],
      lesson:
        'Not every wrong number is a bug. This one was an accounting definition that had quietly stopped matching reality, and the correct fix changed what the system claims to measure. Which is a decision to take with the client, not a patch to ship quietly.',
    },
    outcome: [
      'The headline figure reconciles to the bank balance with no unexplained remainder.',
      'Lender statements now show a share of what the fund actually holds.',
      'The growth chart was relabelled rather than redrawn. It charts money in, which is a real series, instead of being forced onto a basis the underlying data cannot support.',
    ],
    stack: ['PHP', 'MySQL', 'Google Drive API', 'Docker', 'Coolify'],
    shots: [],
  },

  {
    slug: 'torah-tracker',
    pricing: { tier: 'stack', addons: ['mobile'] },
    area: 'apps',
    name: 'Torah Tracker',
    client: { real: 'Torah Tracker', named: true },
    own: true,
    liveUrl: 'https://torahtracker.app',
    tagline: 'A rewrite shipped to an installed base, without reaching zero users.',
    summary:
      'Shipping a rewrite to an installed base without dropping anyone. A daily-habit app moved from a progressive web app to React Native in both stores. The rewrite was the easy half. The hard half was delivering updates to people who already had the old build on their phone.',
    /* 2025 — see the note on the multi-campus platform above. Live since is when
       it first had real users, not when the re-initialised repo begins. */
    year: '2025',
    status: 'Live: App Store & Google Play',
    scale: [
      { value: 'iOS + Android', label: 'native, in both stores' },
      { value: 'OTA', label: 'updates without a store round-trip' },
      { value: '0', label: 'users a mismatched update reaches' },
    ],
    problem: [
      'The original product was a progressive web app. It worked, but it could not do the things that make a daily-habit app stick on a phone. Reliable notifications, a home-screen presence people trust, and offline behaviour that survives a commute.',
      'Rewriting it native meant taking on the entire release-engineering problem that a web app simply does not have.',
    ],
    problemShort: [
      "A progressive web app that could not do reliable notifications or real offline.",
      "Real users already on the old build: a rewrite that stranded them is a downgrade.",
      "Store review on every fix is not a viable loop for a small team.",
    ],
    constraints: [
      'Real users on the existing build. A rewrite that stranded them would have been a downgrade dressed as a launch.',
      'Over-the-air updates were essential: waiting on store review for every fix is not a viable loop for a small team.',
      'Android notification delivery is not uniform. Some vendors defer background work aggressively enough to make a reminder app useless by default.',
    ],
    built: [
      'A React Native / Expo rewrite that replaced the PWA as the production app on iOS, Android and web.',
      'An OTA update pipeline gated on runtime version, so an update can only publish to a runtime that shipped builds actually have.',
      'A TypeScript check as a release gate, ahead of any publish.',
      'Notification handling that accounts for vendor-specific battery restrictions rather than assuming a stock Android.',
    ],
    hardPart: {
      title: 'The update that publishes successfully to nobody',
      body: [
        'Expo over-the-air updates are matched to a **runtime version**. A device only accepts an update published to the runtime its installed binary was built with. That is the correct design: it is what stops JavaScript expecting a native module the installed app does not contain.',
        'It also means a version bump in the wrong place is a silent, total delivery failure. The app config had been moved to 2.1.0 while the build in the store was 2.0.1. A publish from that state completes without warning, reports success, and lands on a runtime that no installed device has. Every user stays on the old code, indefinitely, and the dashboard says the update shipped.',
        'There is a matching trap one layer down: adding a native module in JavaScript without shipping a binary that contains it produces an update that installs and then crashes on the code path that needs it. A break introduced by the delivery mechanism itself.',
        'Both are now procedural rather than remembered. Runtime version is verified against the shipped build before any publish, native-module changes are pinned to a matching binary release, and a type check gates the publish so a broken bundle cannot reach the channel in the first place.',
      ],
      lesson:
        'For anything with an installed base, "did it publish" and "did it arrive" are different questions with different answers. The second one needs its own check, because the first one will happily report success.',
    },
    outcome: [
      'Live in the App Store and on Google Play, with the PWA retired.',
      'Fixes reach existing users over the air, without a store review cycle.',
      'Update delivery is verified against the installed base rather than assumed from a successful publish.',
    ],
    stack: ['React Native', 'Expo / EAS', 'TypeScript', 'Node.js', 'Docker', 'Coolify'],
    shots: [],
  },

  {
    slug: 'msp-time-compliance-portal',
    pricing: { tier: 'stack', addons: ['connect'] },
    area: 'integrations',
    name: 'MSP time-compliance portal',
    client: { real: 'Autotask tech-metrics / CIS', named: false },
    tagline: 'Billable hours were leaking. The API could not answer the question being asked.',
    summary:
      'A managed service provider could not tell whether its engineers were logging time. We built a near-real-time compliance portal on top of a PSA API that times out on any query broad enough to be useful.',
    year: '2026',
    status: 'Live in production',
    scale: [
      { value: '20,920', label: 'tickets under delta sync' },
      { value: '5,216', label: 'time entries reconciled' },
      { value: '10 min', label: 'refresh interval' },
    ],
    problem: [
      'Engineers were not consistently recording time entries, and leadership had no visibility into daily work. Billable hours were being lost somewhere between the work happening and the work being recorded, and nobody could point at where.',
      'The PSA holds the data, but its reporting cannot express the question that matters: which engineer has not logged time, for how long, against which tickets.',
    ],
    problemShort: [
      "Engineers were not consistently logging time, and billable hours were leaking.",
      "The PSA holds the data but cannot express the question: who has not logged, for how long.",
      "Roughly 243,000 lifetime tickets: any query broad enough to be useful times out.",
    ],
    constraints: [
      'The account holds roughly 243,000 tickets across its lifetime. Any unbounded query against that history times out server-side. There is no "just fetch it all" path.',
      'Refresh had to feel live. Minutes, not a nightly batch, because the point is catching a gap while it is still today\'s problem.',
      'Compliance thresholds are per-person and depend on whether someone is an engineer, management, or excluded entirely. The API has no such concept.',
    ],
    built: [
      'A Python ingestion service doing bounded historical backfill plus continuous delta sync on last-activity, with per-entity sync state so an interrupted run resumes rather than restarts.',
      'A FastAPI portal with a colour-coded compliance dashboard. Hours logged against target, days with zero entries, tickets worked with no time recorded, last-entry timestamp per engineer.',
      'Per-engineer drill-down: daily time chart, customers worked, time by billing code, ticket classifications, full ticket list.',
      'Roster classification as a self-serve screen, with every metric downstream obeying it.',
      'A settings screen holding API credentials and sync interval, so a rotated secret is a form submission rather than a redeploy.',
    ],
    hardPart: {
      title: 'Designing around an API that cannot answer the question',
      body: [
        'The obvious approach is to pull everything and compute locally. It dies immediately. An all-time ticket query against 243,000 records times out server-side and returns nothing at all, so there is no partial result to work with and no error that tells you the shape of the problem.',
        'The ingestion was rebuilt as two distinct mechanisms with different jobs. A bounded backfill fetches history from a fixed start date, which makes the initial load a known, finite, resumable amount of work. On top of that, a delta sync polls on last-activity and keeps the window fresh. Sync state is tracked per entity, so extending the history horizon later means clearing one row rather than re-running the whole import.',
        'The second problem was subtler and mattered more. The metric leadership actually wanted, *is this person compliant*, depends on a roster classification the PSA does not model. The obvious approach is a hard-coded list of engineer IDs. That list is wrong the first time somebody joins, and being silently wrong is exactly the failure this portal exists to prevent.',
        'So classification became a first-class, editable concept in the product, and every metric derives from it. Roster curation is self-serve; it stopped being an engineering dependency and stopped being a source of quiet drift.',
      ],
      lesson:
        'When an API cannot answer your question, the fix is usually not a cleverer query. It is accepting that you now own a synchronisation problem, and building the state tracking that makes it resumable.',
    },
    outcome: [
      'Full history backfilled in around 70 seconds; 20,920 tickets and 5,216 time entries in continuous sync.',
      'Compliance visible per engineer per day, with red/amber/green thresholds instead of a spreadsheet.',
      'Roster changes handled by the team, not by a code change.',
      'A failed sync raises a banner across the app rather than quietly serving stale numbers.',
    ],
    stack: ['Python 3.12', 'FastAPI', 'APScheduler', 'SQLite', 'PSA REST API', 'Docker'],
    shots: [],
  },

  {
    slug: 'bilingual-booking-platform',
    pricing: { tier: 'stack', addons: ['lang'] },
    area: 'apps',
    name: 'Bilingual therapeutic-riding booking platform',
    client: { real: 'Horse & Harmony', named: true },
    tagline: 'The booking calendar rendered perfectly, and it was empty.',
    summary:
      'A therapeutic horse-riding practice took bookings by phone and WhatsApp. We built a bilingual Hebrew/English booking site with a self-service admin, then hit a failure mode that produces no error at all.',
    year: '2026',
    status: 'Live in production',
    scale: [
      { value: 'HE / EN', label: 'full RTL and LTR' },
      { value: '30 days', label: 'rolling bookable horizon' },
      { value: '0', label: 'errors when it broke' },
    ],
    problem: [
      'Every booking went through a phone call or a WhatsApp message, which meant double-bookings, no record, and an owner doing scheduling admin instead of running sessions.',
      'The practice operates in Hebrew, with English-speaking clients too, so the site is genuinely bilingual and right-to-left, not an English site with a translation bolted on.',
    ],
    problemShort: [
      "Every booking ran through a phone call or a WhatsApp message.",
      "Hebrew-first with English, fully right-to-left. Not a translation layer.",
      "A non-technical owner: anything needing a mental model of the data would go unused.",
    ],
    constraints: [
      'The owner is not technical. An admin panel requiring a mental model of the data would go unused, and the system would quietly revert to WhatsApp.',
      'Bookings must never auto-confirm: a slot is held on submission, but a human decides.',
      'Session types have different durations, and the schedule is defined by recurring templates rather than by hand-entered slots.',
    ],
    built: [
      'A bilingual Astro front end with React islands, full RTL, and an Express + MySQL booking API.',
      'Slot generation from recurring templates, one series per active session type, each using its own duration.',
      'A pending-first booking flow: submission holds the slot, an admin confirms or declines.',
      'An admin panel deliberately kept to the smallest surface that does the job.',
    ],
    hardPart: {
      title: 'A failure mode with no error state',
      body: [
        'Bookable slots are generated ahead of time from recurring templates into a rolling window. Generation ran at deploy, which is fine on day one and wrong forever after: the window advanced, generation did not, and the horizon quietly ran dry.',
        'The result is the worst kind of outage. The site was up. The API returned 200. The calendar rendered correctly. It simply had nothing in it, and a correctly-rendered empty calendar is indistinguishable, to every monitor you would think to set up, from a correctly-rendered calendar on a quiet week.',
        'No exception was thrown, no request failed, and no alert existed that could have fired, because nothing was in an error state. The only signal was the absence of bookings, which looks exactly like ordinary quiet.',
        'The fix is two parts, and the second matters more than the first. A daily job now keeps the horizon extended. And the health check was inverted to treat an empty forward window as a failure rather than a valid response. The system now has to prove it has availability, instead of being trusted because it did not crash.',
      ],
      lesson:
        'Uptime monitoring answers "did it respond." It does not answer "did it respond with anything." For anything generated on a horizon. Slots, schedules, forecasts, rotations: the emptiness itself has to be the alert.',
    },
    outcome: [
      'Bookings run through the site, with the owner confirming rather than coordinating.',
      'Hebrew and English users get the same product, in the correct direction, not a translated fallback.',
      'The horizon is maintained by a daily job, and an empty forward window now pages instead of passing.',
    ],
    stack: ['Astro 5', 'React', 'Express', 'MySQL 8', 'Cloudflare R2', 'Docker'],
    shots: [{ src: '/assets/work/bilingual-booking-platform/home-desktop.png', alt: 'Booking site home page', from: 'horse-harmony', gated: true }],
  },

];

/* ---------------------------------------------------------------------------
   The long tail — everything else, deliberately below the fold and compact.
   Breadth is real and worth showing; it just must not be the pitch.
   --------------------------------------------------------------------------- */

const MORE_WORK = [
  { name: 'Davenen', area: 'apps', note: 'Prayer-partner matching platform', own: true, url: 'https://davenen.org', badge: 'App Store' },
  { name: 'Kartov', area: 'apps', note: 'Shared lists & meal planning', own: true, url: 'https://kartov.app' },
  { name: 'Temani Chacham', area: 'apps', note: 'Yemenite siddur with a rule-driven prayer engine', own: true, badge: 'App Store' },
  { name: 'Predictable', area: 'integrations', note: 'Stock curation & analysis, live broker integration', own: true },
  { name: 'TapSend', area: 'apps', note: 'Bulk messaging with a manual send gate', own: true },
  { name: 'Same-day delivery network', area: 'integrations', note: 'Multi-carrier rate-shop injected into checkout', own: false },
  { name: 'Warehouse operations assistant', area: 'integrations', note: 'Natural-language interface over 3PL operations', own: false },
  { name: 'Campus site builder', area: 'platforms', note: 'Drag-and-drop public sites, multi-tenant', own: false },
  { name: 'Client project portal', area: 'platforms', note: 'Milestones, tickets and plan approval: this site runs it', own: true, url: '/portal' },
  { name: 'Investment firm site', area: 'apps', note: 'Marketing site and content platform', own: false },
  { name: 'Advocacy campaign platform', area: 'apps', note: 'Hebrew-first campaign site with media pipeline', own: false },
];

/* ---------------------------------------------------------------------------
   Evidence strip — facts, each checkable. No adjectives.
   --------------------------------------------------------------------------- */

const EVIDENCE = [
  { value: '20+', label: 'apps in production', note: 'Not prototypes: deployed, in use, maintained.' },
  { value: '4', label: 'apps in the App Store & Play', note: 'Shipped, reviewed, and updated over the air.' },
  { value: '12+', label: 'live platforms', note: 'Self-hosted on infrastructure we run ourselves.' },
  { value: '1', label: 'team, end to end', note: 'Architecture, build, deploy and the 3am page.' },
];

/* --------------------------------------------------------------------------- */

const bySlug = Object.fromEntries(CASE_STUDIES.map((c) => [c.slug, c]));
const areaById = Object.fromEntries(PRACTICE_AREAS.map((a) => [a.id, a]));

/** Public display name. The title is always the shape name; naming a client
    adds their name alongside it rather than replacing it. */
function displayName(item) {
  return item.name;
}

/** The client's own name, only where that client has agreed to be named.
    Returns '' for anyone who has not, which is the safe default: a project
    added without a `named` flag stays anonymous without anyone remembering to
    make it so. Our own products return '' too — there is no client to credit. */
function clientName(item) {
  if (item.own || !item.client) return '';
  if (CLIENT_NAMING === 'anonymous' && !item.client.named) return '';
  return item.client.real || '';
}

/** Whether a live/outbound link may be shown for this item. */
function mayLink(item) {
  return Boolean(item.own || item.client?.named || CLIENT_NAMING === 'named');
}

module.exports = {
  CLIENT_NAMING,
  PRACTICE_AREAS,
  CASE_STUDIES,
  MORE_WORK,
  EVIDENCE,
  bySlug,
  areaById,
  displayName,
  clientName,
  mayLink,
};

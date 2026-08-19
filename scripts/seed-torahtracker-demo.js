#!/usr/bin/env node
/**
 * Fills the Torah Tracker demo account with invented study history, so the
 * screenshots show a used app rather than an empty one.
 *
 *   node scripts/seed-torahtracker-demo.js
 *
 * WHY IT TALKS TO PRODUCTION, which is the opposite of every other seeding
 * script in this repo: the phone app points at torahtracker.app, so an account
 * that only exists on a local instance cannot be photographed on a device. This
 * is Ohav's own product, not a client's, and everything below goes in through
 * the PUBLIC signup and session endpoints exactly as any user's would — no
 * database access, no credentials held, nothing privileged.
 *
 * The account is deliberately identifiable and deletable:
 *   dovid.freeman@example.com   —  example.com is the reserved domain, so it
 *                                  can never collide with a real person
 *
 * DO NOT point this at a CLIENT system. The rule that back-office screenshots
 * come from a local instance on invented data still stands for everything that
 * holds somebody else's records; this is the one exception and it is an
 * exception because the data and the product are both ours.
 */
const API = 'https://torahtracker.app/api';
const EMAIL = 'dovid.freeman@example.com';
const PASSWORD = 'TorahDemo!2026';

const post = async (path, body, token) => {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON error page */ }
  return { status: res.status, json, text: text.slice(0, 180) };
};

/* A believable week: not every day, not the same length, and one gap. A seeded
   history where every single day is a perfect 60 minutes reads as fake at a
   glance, and the streak counter is one of the things being photographed. */
const PLANS = [
  { title: 'Daf Yomi',            subject_type: 'gemara',  duration_minutes: 45, days_of_week: [0, 1, 2, 3, 4, 5, 6] },
  { title: 'Mishna Yomit',        subject_type: 'mishna',  duration_minutes: 15, days_of_week: [0, 1, 2, 3, 4] },
  { title: 'Halacha — Mishna Berura', subject_type: 'halacha', duration_minutes: 20, days_of_week: [0, 2, 4] },
];

/* Deterministic pseudo-random so re-running produces the same history rather
   than a different one stacked on top. Date.now()/Math.random() would make the
   screenshots un-reproducible. */
let seed = 20260819;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

/* --recent tops up the last seven days INCLUDING TODAY, so the streak counter
   reads as a live account rather than an abandoned one.
 *
 * It is a separate mode because sessions/create.php rate-limits: seeding the
 * ten weeks of history uses the allowance up and the top-up comes back 429.
 * That is the app's own protection working, not a bug — so this waits for the
 * window rather than trying to defeat it.
 *
 *   node scripts/seed-torahtracker-demo.js            history (run once)
 *   node scripts/seed-torahtracker-demo.js --recent   the last 7 days
 */
const RECENT_ONLY = process.argv.includes('--recent');

(async () => {
  console.log('\nTorah Tracker demo account\n');
  if (RECENT_ONLY) {
    const login = await post('/auth/login.php', { email: EMAIL, password: PASSWORD });
    if (!login.json?.token) { console.error('  login failed:', login.status, login.text); process.exit(1); }
    const token = login.json.token;
    let n = 0, blocked = false;
    for (let back = 6; back >= 0; back--) {
      const d = new Date();
      d.setDate(d.getDate() - back);
      const iso = d.toISOString().slice(0, 10);
      for (const p of PLANS) {
        if (p.subject_type === 'halacha' && back % 2) continue;
        const r = await post('/sessions/create.php', {
          subject_type: p.subject_type,
          duration_minutes: p.duration_minutes + (back % 3) * 4,
          session_date: iso,
          skip_chazara: 1,
        }, token);
        if (r.status === 200 || r.status === 201) n++;
        else if (r.status === 429) blocked = true;
      }
    }
    console.log('  ' + n + ' sessions added across the last 7 days');
    if (blocked) console.log('  RATE LIMITED — some were refused. Re-run this later to finish.');
    const s = await fetch(API + '/stats/streaks.php', { headers: { Authorization: 'Bearer ' + token } });
    console.log('  streaks ' + (await s.text()));
    return;
  }

  const login = await post('/auth/login.php', { email: EMAIL, password: PASSWORD });
  if (login.status !== 200 || !login.json?.token) {
    console.error('  login failed:', login.status, login.text);
    process.exit(1);
  }
  const token = login.json.token;
  console.log('  logged in as', login.json.user.name, '(id ' + login.json.user.id + ')');

  const planIds = [];
  for (const p of PLANS) {
    const r = await post('/plans/create.php', p, token);
    if (r.status === 200 || r.status === 201) {
      planIds.push(r.json?.plan?.id ?? r.json?.id);
      console.log('  plan   ' + p.title);
    } else {
      console.log('  plan   ' + p.title + ' → ' + r.status + ' ' + r.text);
    }
  }

  /* 10 weeks of history, ending yesterday so "today" is still open in the UI
     and the app does not look already-finished the moment it is opened. */
  const DAYS = 70;
  let made = 0;
  for (let back = DAYS; back >= 1; back--) {
    const d = new Date();
    d.setDate(d.getDate() - back);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getDay();

    /* one deliberate quiet week around day 40, so the streak has a real break
       in it — an unbroken 70-day streak invites the question and looks seeded */
    if (back > 38 && back < 45) continue;

    for (const p of PLANS) {
      if (!p.days_of_week.includes(dow)) continue;
      if (rnd() < 0.18) continue;                       // missed it, as people do
      const jitter = Math.round((rnd() - 0.5) * 12);
      const minutes = Math.max(5, p.duration_minutes + jitter);
      const r = await post('/sessions/create.php', {
        subject_type: p.subject_type,
        duration_minutes: minutes,
        session_date: iso,
        skip_chazara: 1,
      }, token);
      if (r.status === 200 || r.status === 201) made++;
      else if (made === 0) console.log('  session → ' + r.status + ' ' + r.text);
    }
  }

  console.log('  ' + made + ' study sessions over ' + DAYS + ' days');
  console.log('\n  web   https://torahtracker.app/login');
  console.log('  email ' + EMAIL);
  console.log('  pass  ' + PASSWORD);
  console.log('\n  Same credentials work in the iOS and Android apps.\n');
})();

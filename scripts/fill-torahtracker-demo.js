#!/usr/bin/env node
/**
 * Fills the Torah Tracker demo account until it looks like a real user's.
 *
 *   node scripts/fill-torahtracker-demo.js
 *
 * WHY THIS IS SEPARATE from seed-torahtracker-demo.js: sessions/create.php
 * allows 60 inserts per IP per 900 seconds (config/rate-limit.php). The first
 * seed used the whole allowance, so anything more has to be paced. This script
 * batches to 55, waits out the window, and continues — it does not try to
 * defeat the limit, which is the app's own protection doing its job.
 *
 * The limiter checks BEFORE it counts, so a rejected request does not extend
 * the block. Retrying is safe; it just will not help until the window rolls.
 *
 * WHAT MAKES IT LOOK FULL, and it is not the session count:
 * a tracker with minutes but no REFS has no progress and no review queue —
 * the two richest screens stay empty. Every session here carries start_ref and
 * end_ref, so the daf advances, progress accumulates, and chazara reviews get
 * scheduled. Sessions are only inserted without refs if the API rejects the
 * ref shape, which the script probes for once at the start rather than
 * assuming.
 */
const API = 'https://torahtracker.app/api';
const EMAIL = 'dovid.freeman@example.com';
const PASSWORD = 'TorahDemo!2026';

const BATCH = 55;          /* under the 60 ceiling, leaves headroom */
const WINDOW_MS = 915000;  /* 900s window + 15s of slack */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let token = null;
const post = async (path, body) => {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text: text.slice(0, 160) };
};
const get = async (path) => {
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } });
  return (await res.text()).slice(0, 220);
};

/* Deterministic, so a re-run reproduces the same history rather than stacking a
   different one on top. Date.now()/Math.random() would make the screenshots
   impossible to reproduce. */
let seed = 771903;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

/* Masechtos in Daf Yomi order with their real daf counts, so the progression is
   plausible to anyone who would recognise it. Getting this wrong is the kind of
   detail that makes a demo account obviously fake to exactly the audience the
   app is for. */
const MASECHTOS = [
  ['berachos', 64], ['shabbos', 157], ['eruvin', 105], ['pesachim', 121],
];
const MISHNAYOS = ['berachos', 'peah', 'demai', 'kilayim', 'sheviis', 'terumos'];

function buildSessions() {
  const out = [];
  const today = new Date();

  /* Daf Yomi: one daf a day, advancing through masechtos. */
  let mi = 0, daf = 2;
  for (let back = 250; back >= 0; back--) {
    const d = new Date(today); d.setDate(d.getDate() - back);
    const iso = d.toISOString().slice(0, 10);
    if (rnd() < 0.14) continue;                               /* missed a day */
    if (back > 150 && back < 158) continue;                   /* a week away */
    const [name, count] = MASECHTOS[mi];
    const endDaf = daf + 1;
    out.push({
      subject_type: 'gemara', subject_key: name,
      subject_detail: { masechet: name },
      start_ref: { daf, amud: 'a' }, end_ref: { daf: endDaf, amud: 'b' },
      duration_minutes: 40 + Math.round(rnd() * 20),
      session_date: iso,
    });
    daf = endDaf;
    if (daf >= count) { mi = (mi + 1) % MASECHTOS.length; daf = 2; }
  }

  /* Mishna, weekdays only, and Halacha three times a week. Different rhythms
     because a real person's plans do not all fire on the same days. */
  for (let back = 250; back >= 0; back--) {
    const d = new Date(today); d.setDate(d.getDate() - back);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    if (dow < 5 && rnd() > 0.35) {
      const m = MISHNAYOS[Math.floor(rnd() * MISHNAYOS.length)];
      out.push({
        subject_type: 'mishna', subject_key: m, subject_detail: { masechet: m },
        start_ref: { perek: 1, mishna: 1 }, end_ref: { perek: 2, mishna: 3 },
        duration_minutes: 12 + Math.round(rnd() * 10), session_date: iso,
      });
    }
    if ((dow === 0 || dow === 2 || dow === 4) && rnd() > 0.4) {
      out.push({
        subject_type: 'halacha', subject_key: 'mishna_berura',
        subject_detail: { sub_type: 'other_halacha', sefer: 'Mishna Berura' },
        start_ref: { siman: 90 }, end_ref: { siman: 91 },
        duration_minutes: 15 + Math.round(rnd() * 12), session_date: iso,
      });
    }
  }

  /* Newest first, so if the run is interrupted the RECENT history exists and
     the streak reads correctly — that matters more than 2025 being complete. */
  return out.sort((a, b) => b.session_date.localeCompare(a.session_date));
}

(async () => {
  const login = await post('/auth/login.php', { email: EMAIL, password: PASSWORD });
  if (!login.json?.token) { console.error('login failed:', login.status, login.text); process.exit(1); }
  token = login.json.token;
  console.log('filling ' + EMAIL);

  const all = buildSessions();
  console.log('  ' + all.length + ' sessions planned, newest first');

  /* Probe the ref shape once rather than assuming it. If the API rejects it,
     fall back to bare sessions — a full account without progress beats a
     script that 400s two hundred times. */
  let useRefs = true;
  for (let i = 0; i < all.length; i++) {
    const r = await post('/sessions/create.php', all[i]);
    if (r.status === 200 || r.status === 201) { console.log('  refs accepted'); break; }
    if (r.status === 429) { console.log('  rate limited at the probe, waiting a window'); await sleep(WINDOW_MS); i--; continue; }
    console.log('  refs rejected (' + r.status + ' ' + r.text + ') — falling back to bare sessions');
    useRefs = false; break;
  }

  let made = 1, blocked = 0;
  for (let i = 1; i < all.length; i++) {
    const s = all[i];
    const body = useRefs ? s : {
      subject_type: s.subject_type, duration_minutes: s.duration_minutes,
      session_date: s.session_date, skip_chazara: 1,
    };
    const r = await post('/sessions/create.php', body);
    if (r.status === 200 || r.status === 201) { made++; blocked = 0; }
    else if (r.status === 429) {
      blocked++;
      if (blocked > 2) { console.log('  ' + made + ' in — window full, waiting 15 minutes'); await sleep(WINDOW_MS); blocked = 0; }
      i--;                                   /* retry this one after the wait */
      continue;
    }
    if (made % BATCH === 0) { console.log('  ' + made + ' in — pausing for the window'); await sleep(WINDOW_MS); }
  }

  console.log('\n  ' + made + ' sessions created');
  console.log('  alltime  ' + await get('/stats/alltime.php'));
  console.log('  streaks  ' + await get('/stats/streaks.php'));
  console.log('  progress ' + await get('/progress/list.php'));
  console.log('\n  https://torahtracker.app/login  ·  ' + EMAIL + '  ·  ' + PASSWORD + '\n');
})();

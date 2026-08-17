/* ============================================================================
   kaymen.dev — threat engine

   Rewritten 2026-08-17. This used to be three regex lists and a counter: it
   answered "does this user agent contain the word bot" and "is this IP loud".
   Both are useful and neither is a security system, because neither ever looked
   at what was actually being requested.

   What it does now:

     · CLASSIFIES a user agent into a kind (search / ai / social / seo / monitor
       / tool / scanner / headless / human) rather than a boolean. "Bot" lumps
       Googlebot in with sqlmap, and those two want opposite responses — one is
       traffic you want, the other is an attack in progress.

     · INSPECTS the request — path, query string and the shape of the body — for
       exploit signatures, and returns SCORED findings rather than a flag. Score
       is what lets the shield distinguish "somebody typed a wrong URL" from
       "somebody is walking the filesystem", without a second list of rules.

     · TRACKS accumulated score per IP over a rolling window, so a scanner that
       sends fifty individually-unremarkable probes is caught by the fifty, not
       by any one of them.

   It deliberately does NOT block anything itself. Detection returns findings;
   `server/middleware/shield.js` decides what happens. Keeping the decision in
   one place is what makes the never-lock-Ohav-out rules auditable — see the
   allow-rule note in db.js.
   ============================================================================ */

const { getDb } = require('../db');

// ===== 1. USER AGENT CLASSIFICATION =========================================
//
// Order matters: scanner before tool before headless. sqlmap's UA contains
// "python-requests" on some versions, and it is a scanner first.
const UA_CLASSES = [
  ['scanner', /nikto|nmap|sqlmap|dirbuster|gobuster|feroxbuster|masscan|zgrab|censys|shodan|nuclei|wpscan|acunetix|netsparker|owasp zap|zaproxy|arachni|metasploit|hydra|whatweb|joomscan|droopescan|xsstrike|commix/i],
  ['search',  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex(bot)?|applebot|sogou|exabot|naver|seznambot/i],
  ['ai',      /gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|ccbot|perplexitybot|google-extended|bytespider|amazonbot|meta-externalagent|cohere-ai|diffbot|imagesiftbot|youbot|timpibot/i],
  ['social',  /twitterbot|facebookexternalhit|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|pinterest|redditbot|embedly|skypeuripreview/i],
  ['seo',     /ahrefsbot|semrushbot|mj12bot|dotbot|dataforseo|petalbot|blexbot|serpstatbot|megaindex|seokicks|screaming frog/i],
  ['monitor', /uptimerobot|pingdom|statuscake|better ?uptime|site24x7|newrelic|datadog|checkly|hetrixtools|freshping/i],
  ['headless',/headlesschrome|phantomjs|puppeteer|playwright|selenium|electron\/|chrome-lighthouse|pagespeed/i],
  ['tool',    /curl|wget|python-requests|python-urllib|go-http-client|java\/|okhttp|axios|node-fetch|got \(|libwww-perl|ruby|php\/|guzzle|postman|insomnia|httpie|rest(sharp|client)|scrapy|apache-httpclient|winhttp|powershell/i],
  ['crawler', /bot\b|crawl|spider|scraper|scan|fetcher|archiver|harvest/i],
];

/* Human-readable name for the feed, so a row reads "Googlebot" not the whole
   80-character UA string. Falls back to the browser name the visits table
   already parsed, and then to the raw head of the UA. */
const UA_NAMES = [
  [/googlebot/i, 'Googlebot'], [/bingbot/i, 'Bingbot'], [/duckduckbot/i, 'DuckDuckBot'],
  [/yandex/i, 'YandexBot'], [/baiduspider/i, 'Baiduspider'], [/applebot/i, 'Applebot'],
  [/gptbot/i, 'GPTBot'], [/chatgpt-user/i, 'ChatGPT'], [/oai-searchbot/i, 'OpenAI Search'],
  [/claudebot|claude-web|anthropic-ai/i, 'ClaudeBot'], [/ccbot/i, 'CCBot'],
  [/perplexitybot/i, 'PerplexityBot'], [/google-extended/i, 'Google-Extended'],
  [/bytespider/i, 'Bytespider'], [/amazonbot/i, 'Amazonbot'], [/meta-externalagent/i, 'Meta'],
  [/facebookexternalhit/i, 'Facebook'], [/twitterbot/i, 'Twitterbot'], [/linkedinbot/i, 'LinkedIn'],
  [/slackbot/i, 'Slackbot'], [/discordbot/i, 'Discord'], [/telegrambot/i, 'Telegram'],
  [/whatsapp/i, 'WhatsApp'], [/ahrefsbot/i, 'AhrefsBot'], [/semrushbot/i, 'SemrushBot'],
  [/mj12bot/i, 'MJ12bot'], [/dotbot/i, 'DotBot'], [/petalbot/i, 'PetalBot'],
  [/uptimerobot/i, 'UptimeRobot'], [/pingdom/i, 'Pingdom'],
  [/sqlmap/i, 'sqlmap'], [/nikto/i, 'Nikto'], [/nuclei/i, 'Nuclei'], [/wpscan/i, 'WPScan'],
  [/masscan/i, 'masscan'], [/zgrab/i, 'zgrab'], [/censys/i, 'Censys'], [/shodan/i, 'Shodan'],
  [/gobuster/i, 'gobuster'], [/dirbuster/i, 'DirBuster'], [/nmap/i, 'Nmap'],
  [/curl/i, 'curl'], [/wget/i, 'Wget'], [/python-requests|python-urllib/i, 'Python'],
  [/go-http-client/i, 'Go HTTP'], [/okhttp/i, 'OkHttp'], [/java\//i, 'Java'],
  [/postman/i, 'Postman'], [/headlesschrome/i, 'Headless Chrome'], [/puppeteer/i, 'Puppeteer'],
  [/playwright/i, 'Playwright'], [/scrapy/i, 'Scrapy'],
];

/* The kinds that are welcome. A search crawler and a social unfurler are how
   the site gets found and how a shared link gets a preview card — counting
   them as threats would make the threat feed useless within a week. */
const BENIGN_KINDS = new Set(['search', 'ai', 'social', 'monitor']);

function classifyUserAgent(userAgent) {
  const ua = String(userAgent || '');
  if (!ua.trim()) {
    // No UA at all is not a browser. Every real client sends one; the only
    // things that do not are hand-rolled scripts and probes.
    return { isBot: true, kind: 'unknown', label: 'No user agent', benign: false };
  }
  for (const [kind, pattern] of UA_CLASSES) {
    if (pattern.test(ua)) {
      const named = UA_NAMES.find(([p]) => p.test(ua));
      return {
        isBot: true,
        kind,
        label: named ? named[1] : kind,
        benign: BENIGN_KINDS.has(kind),
      };
    }
  }
  return { isBot: false, kind: 'human', label: 'Browser', benign: true };
}

// Kept because `visits.is_bot` is a column with three years of rows behind it
// and the analytics queries all key off it. The nuance lives in `bot_kind`.
function isBot(userAgent) {
  return classifyUserAgent(userAgent).isBot;
}

// ===== 2. REQUEST SIGNATURES ================================================
//
// Each entry scores independently and they stack, which is the point: a request
// for `/.env` is a 45, and a request for `/.env?x=../../etc/passwd` is a 45 and
// a 40 and lands somewhere no single rule had to anticipate.
//
// Scores are calibrated against the shield's thresholds (shield.js §2):
//   30  = worth recording, never worth blocking on its own
//   45  = one more finding away from a block
//   60+ = unambiguous exploit attempt, blocked on sight
const SIGNATURES = [
  // --- unambiguous exploitation --------------------------------------------
  { id: 'log4shell',   score: 90, severity: 'critical', label: 'Log4Shell JNDI probe',
    re: /\$\{jndi:|\$\{ *(lower|upper|env|sys|date) *:/i },
  { id: 'sqli',        score: 70, severity: 'critical', label: 'SQL injection',
    re: /(union[\s/*]+select|select[\s/*]+.*[\s/*]+from[\s/*]+information_schema|'\s*or\s*'?1'?\s*=\s*'?1|"\s*or\s*"?1"?\s*=|\bor\b\s+1\s*=\s*1|sleep\s*\(\s*\d|benchmark\s*\(|pg_sleep\s*\(|waitfor\s+delay|xp_cmdshell|load_file\s*\(|into\s+outfile)/i },
  { id: 'rce',         score: 85, severity: 'critical', label: 'Command injection',
    re: /(;\s*(cat|ls|id|whoami|uname|curl|wget|nc|bash|sh)\s|\|\s*(cat|id|whoami|uname|nc|bash|sh)\b|\$\(\s*(cat|id|whoami|curl|wget)|`\s*(cat|id|whoami)|\bnc\s+-e\b|\/bin\/(ba)?sh\b)/i },
  { id: 'traversal',   score: 65, severity: 'high', label: 'Path traversal',
    re: /(\.\.[\/\\]|\.\.%2f|%2e%2e[\/\\%]|\/etc\/(passwd|shadow|hosts)|\/proc\/self\/environ|c:[\/\\]windows[\/\\]|boot\.ini)/i },
  { id: 'fileinc',     score: 70, severity: 'critical', label: 'File inclusion',
    re: /(php|file|data|expect|zip|glob|phar):\/\/|=\s*https?:\/\/[^\s&]+\.(txt|php|sh)\b/i },
  { id: 'deserialize', score: 75, severity: 'critical', label: 'Deserialisation payload',
    re: /(O:\d+:"|rO0AB|__proto__|constructor\[prototype\]|\bpickle\b.*\bloads\b)/i },
  { id: 'ssrf',        score: 60, severity: 'high', label: 'SSRF / metadata probe',
    re: /(169\.254\.169\.254|metadata\.google\.internal|\[::ffff:169\.254|0x7f\.0|127\.0\.0\.1:\d{2,5}\/)/i },
  { id: 'ssti',        score: 55, severity: 'high', label: 'Template injection',
    re: /(\{\{\s*[\w.]*(config|self|request|class|globals|mro)\b|\{\{\s*\d+\s*[*+]\s*\d+\s*\}\}|#\{\s*\d+\s*\*)/i },
  { id: 'xss',         score: 50, severity: 'high', label: 'XSS payload',
    re: /(<\s*script|%3cscript|javascript\s*:|on(error|load|click|mouseover)\s*=|<\s*img[^>]+src\s*=[^>]*onerror|document\.cookie|<\s*svg[^>]*onload)/i },
  { id: 'crlf',        score: 45, severity: 'high', label: 'Header injection',
    re: /(%0d%0a|%0a%0d|\r\n)(set-cookie|location|content-length)/i },

  // --- reconnaissance -------------------------------------------------------
  { id: 'secrets',     score: 55, severity: 'high', label: 'Secret file probe',
    re: /(\/\.env|\/\.git\/|\/\.svn\/|\/\.aws\/|\/\.ssh\/|id_rsa|\.htpasswd|credentials\.json|\/config\.(json|yml|php)|\.pem$|backup\.(sql|zip|tar\.gz)|dump\.sql)/i },
  { id: 'webshell',    score: 60, severity: 'critical', label: 'Webshell probe',
    re: /\/(shell|c99|r57|wso|b374k|alfa|cmd|adminer|eval|backdoor)\d*\.(php|jsp|asp|aspx)\b/i },
  { id: 'cms',         score: 30, severity: 'medium', label: 'CMS probe',
    re: /\/(wp-admin|wp-login|wp-content|wp-includes|wp-json|wordpress|xmlrpc\.php|joomla|drupal|typo3|magento|administrator\/index\.php)/i },
  { id: 'dbadmin',     score: 45, severity: 'high', label: 'Database console probe',
    re: /\/(phpmyadmin|pma|myadmin|mysqladmin|adminer|dbadmin|phppgadmin|sqlitemanager)/i },
  { id: 'infra',       score: 40, severity: 'high', label: 'Infrastructure probe',
    re: /\/(actuator|jolokia|solr\/admin|jenkins|hudson|manager\/html|axis2|struts|cgi-bin|boaform|hnap1|\.docker|docker\/|portainer|kube|telerik)/i },
  { id: 'envfile',     score: 35, severity: 'medium', label: 'Config probe',
    re: /\/(server-status|server-info|\.well-known\/(?!security\.txt|acme-challenge)|debug\/|_profiler|phpinfo|info\.php|test\.php)/i },
  { id: 'exts',        score: 40, severity: 'medium', label: 'Server-language probe',
    re: /\.(php\d?|asp|aspx|jsp|jspx|cfm|cgi|pl|do|action)(\?|$)/i },
];

// Paths the site genuinely serves that would otherwise trip a signature. The
// exts rule fires on anything ending .php, and `/api/v1` used to be on the old
// scanner list even though it is the shape of a normal API.
const SIGNATURE_EXEMPT = [
  /^\/\.well-known\/(security\.txt|acme-challenge|assetlinks\.json|apple-app-site-association)/i,
  /^\/(robots\.txt|sitemap\.xml|favicon\.ico|manifest\.json|sw\.js)$/i,
];

/* Look at one request and return every signature it trips.

   `body` is inspected only when it is small and stringifiable: the JSON body
   parser caps at 1mb, and running fifteen regexes over a megabyte on every
   request is a denial of service you built yourself. 4KB covers every real
   payload this site accepts (a contact form, a ticket, a login). */
function inspectRequest({ method, path, query, userAgent, body, referrer }) {
  const findings = [];
  const p = String(path || '');

  if (SIGNATURE_EXEMPT.some(re => re.test(p))) return { findings, score: 0 };

  // decodeURIComponent throws on a malformed escape — which is itself a signal,
  // because a browser does not emit one. Scan the raw string in that case.
  let decodedPath = p;
  try {
    decodedPath = decodeURIComponent(p);
  } catch {
    findings.push({ id: 'badencoding', score: 35, severity: 'medium',
      label: 'Malformed URL encoding', detail: p.slice(0, 200) });
  }

  const queryStr = query && typeof query === 'object'
    ? Object.entries(query).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`).join('&')
    : String(query || '');

  let bodyStr = '';
  if (body && typeof body === 'object') {
    try {
      const s = JSON.stringify(body);
      if (s.length <= 4096) bodyStr = s;
    } catch { /* circular or unserialisable — nothing to scan */ }
  }

  const haystacks = [
    ['path', `${p} ${decodedPath}`],
    ['query', queryStr],
    ['body', bodyStr],
    ['referrer', String(referrer || '')],
  ];

  for (const sig of SIGNATURES) {
    for (const [where, text] of haystacks) {
      if (!text) continue;
      if (sig.re.test(text)) {
        const m = text.match(sig.re);
        findings.push({
          id: sig.id,
          score: sig.score,
          severity: sig.severity,
          label: sig.label,
          detail: `${where}: ${String(m && m[0] ? m[0] : text).slice(0, 160)}`,
        });
        break; // one finding per signature, wherever it first matched
      }
    }
  }

  // A UA that names a scanner is worth more than anything in the URL — the
  // tool announced itself before it found anything.
  const ua = classifyUserAgent(userAgent);
  if (ua.kind === 'scanner') {
    findings.push({ id: 'scanner_ua', score: 80, severity: 'critical',
      label: `Security scanner (${ua.label})`, detail: String(userAgent).slice(0, 200) });
  } else if (ua.kind === 'unknown') {
    findings.push({ id: 'no_ua', score: 25, severity: 'low',
      label: 'Empty user agent', detail: `${method || 'GET'} ${p}`.slice(0, 200) });
  }

  // Writing to the API with a shell tool. Reading with curl is how people test
  // things; POSTing with it against an auth or upload route is not.
  if (ua.kind === 'tool' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase())
      && /^\/api\/(auth|uploads|admin)/.test(p)) {
    findings.push({ id: 'tool_write', score: 35, severity: 'medium',
      label: `Scripted write (${ua.label})`, detail: `${method} ${p}`.slice(0, 200) });
  }

  const score = findings.reduce((n, f) => n + f.score, 0);
  return { findings, score, ua };
}

// ===== 3. RATE + ACCUMULATION ===============================================
//
// Two in-memory maps, both bounded and both swept on a timer. They reset on
// restart, which is correct: a rate window is a statement about the last
// minute, and a process that just started has no last minute.

const RATE_WINDOW_MS = 60000;
const SCORE_WINDOW_MS = 600000; // 10 minutes
const MAX_TRACKED_IPS = 20000;  // a hard ceiling, so a spoofed-IP flood cannot
                                // turn detection into the memory leak that ends
                                // the process

const requestCounts = new Map(); // ip -> [timestamp, ...]
const scoreWindows = new Map();  // ip -> [{ at, score }, ...]

function trackRequest(ip) {
  const now = Date.now();
  if (!requestCounts.has(ip)) {
    if (requestCounts.size >= MAX_TRACKED_IPS) return 1; // shed rather than grow
    requestCounts.set(ip, []);
  }
  const timestamps = requestCounts.get(ip);
  timestamps.push(now);
  const cutoff = now - RATE_WINDOW_MS;
  while (timestamps.length && timestamps[0] < cutoff) timestamps.shift();
  return timestamps.length;
}

function requestRate(ip) {
  const timestamps = requestCounts.get(ip);
  if (!timestamps) return 0;
  const cutoff = Date.now() - RATE_WINDOW_MS;
  return timestamps.filter(t => t >= cutoff).length;
}

/* Add to this IP's rolling threat score and return the new total. This is the
   thing that catches a patient scanner: fifty probes worth 30 each never trip a
   per-request threshold and are obvious at 1500 over ten minutes. */
function accumulate(ip, score) {
  if (!score) return currentScore(ip);
  const now = Date.now();
  if (!scoreWindows.has(ip)) {
    if (scoreWindows.size >= MAX_TRACKED_IPS) return score;
    scoreWindows.set(ip, []);
  }
  const window = scoreWindows.get(ip);
  window.push({ at: now, score });
  const cutoff = now - SCORE_WINDOW_MS;
  while (window.length && window[0].at < cutoff) window.shift();
  return window.reduce((n, e) => n + e.score, 0);
}

function currentScore(ip) {
  const window = scoreWindows.get(ip);
  if (!window) return 0;
  const cutoff = Date.now() - SCORE_WINDOW_MS;
  return window.filter(e => e.at >= cutoff).reduce((n, e) => n + e.score, 0);
}

function clearScore(ip) {
  scoreWindows.delete(ip);
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestCounts) {
    while (timestamps.length && timestamps[0] < now - RATE_WINDOW_MS * 2) timestamps.shift();
    if (!timestamps.length) requestCounts.delete(ip);
  }
  for (const [ip, window] of scoreWindows) {
    while (window.length && window[0].at < now - SCORE_WINDOW_MS) window.shift();
    if (!window.length) scoreWindows.delete(ip);
  }
}, 60000).unref?.();

// ===== 4. RECORDING =========================================================

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

function worstSeverity(findings) {
  return findings.reduce((worst, f) =>
    (SEVERITY_RANK[f.severity] || 0) > (SEVERITY_RANK[worst] || 0) ? f.severity : worst, 'low');
}

/* Write findings to `suspicious_activity`. One row per finding, because the
   feed is filtered by category and a row carrying three reasons cannot be.

   Deliberately capped at five rows per request: a URL crafted to trip every
   signature at once is a cheap way to make the attacker's own log entry the
   thing that fills the disk. */
function recordFindings(findings, ctx = {}) {
  if (!findings || !findings.length) return;
  const db = getDb();
  for (const f of findings.slice(0, 5)) {
    try {
      db.prepare(`
        INSERT INTO suspicious_activity
          (ip, reason, severity, details, category, path, method, user_agent, score, blocked)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ctx.ip || 'unknown', f.label, f.severity, String(f.detail || '').slice(0, 400),
        f.id, String(ctx.path || '').slice(0, 300), ctx.method || null,
        String(ctx.userAgent || '').slice(0, 300), f.score || 0, ctx.blocked ? 1 : 0
      );
    } catch (e) {
      // A logging failure must never fail the request it is logging.
      console.error('[detection] failed to record finding:', e.message);
    }
  }
}

/* The old entry point, still used by the tracker ingest. Rate and empty-UA only
   — the payload inspection belongs to the shield, which sees every request
   rather than only the ones that reached /api/track/visit. */
function checkSuspicious(ip, userAgent, path) {
  const findings = [];
  const rate = trackRequest(ip);
  if (rate > 120) {
    findings.push({ id: 'rate_high', score: 45, severity: 'high',
      label: 'High request rate', detail: `${rate} requests/min` });
  } else if (rate > 60) {
    findings.push({ id: 'rate_elevated', score: 25, severity: 'medium',
      label: 'Elevated request rate', detail: `${rate} requests/min` });
  }
  if (!userAgent) {
    findings.push({ id: 'no_ua', score: 25, severity: 'low',
      label: 'Empty user agent', detail: 'No UA string' });
  }
  recordFindings(findings, { ip, path, userAgent, method: 'POST' });
  return findings;
}

// Retained for the 404 handler's benefit and because removing an exported name
// that another file may still import is not worth the saving.
function isScannerPath(path) {
  return inspectRequest({ path, method: 'GET' }).score >= 30;
}

module.exports = {
  classifyUserAgent, isBot, isScannerPath,
  inspectRequest, recordFindings, worstSeverity, checkSuspicious,
  trackRequest, requestRate, accumulate, currentScore, clearScore,
  SEVERITY_RANK,
};

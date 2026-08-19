/* ============================================================================
   kaymen.dev — the legal pages

   DRAFTED 2026-08-19. NOT REVIEWED BY A LAWYER. Everything here is written to
   be ACCURATE TO THE IMPLEMENTATION rather than lifted from a generator, which
   is the part a template cannot do and the part that actually matters: a
   privacy policy that describes tracking the site does not do, and omits the
   third party it does send IP addresses to, is worse than none — it is a
   written statement that happens to be false.

   Every factual claim below was read out of the code on 2026-08-19:

     · tracker.js honours Do Not Track and returns before collecting anything
     · the visitor id is localStorage `_k_vid`; the session id is sessionStorage
     · server/routes/track.js sends the visitor's IP to ip-api.com over PLAIN
       HTTP and asks for country, city, region, lat, lon, isp, org, asn, timezone
     · retention windows are RETENTION in server/utils/rollup.js
     · daily rollups are permanent; raw rows are not

   THINGS THAT ARE PLACEHOLDERS AND MUST BE FILLED BEFORE THIS IS RELIED ON are
   marked TO CONFIRM in the text and listed in LEGAL_OPEN at the foot of this
   file. They are facts about the company that cannot be read out of a
   repository — the registered address, the governing law, whether a DPA is
   offered — and inventing any of them would be the same mistake as inventing a
   client quote.
   ============================================================================ */

const LEGAL_UPDATED = '19 August 2026';
const LEGAL_ENTITY = 'Kaymen Group LLC';
const LEGAL_EMAIL = 'elor@kaymengroup.com';

/* The retention table, mirrored from RETENTION in server/utils/rollup.js. If
   that changes and this does not, the policy is a false statement rather than
   a stale doc — keep them in step. */
const RETENTION = [
  ['Analytics events (clicks, engagement)', '60 days'],
  ['Page views', '120 days'],
  ['Visits and geo cache', '120–240 days'],
  ['Security and blocking records', '240 days'],
  ['Sign-in records for the client portal', '400 days'],
  ['Daily totals with no personal data in them', 'kept indefinitely'],
];

const PRIVACY = {
  slug: 'privacy',
  title: 'Privacy',
  lede:
    'What this site records, what it does not, who else sees any of it, and how long it is kept. ' +
    'Written against the code rather than from a template, so it describes what actually happens.',
  sections: [
    {
      h: 'Who this is',
      p: [
        `${LEGAL_ENTITY} operates kaymen.dev. If you want anything on this page explained, or you want your data removed, write to <a href="mailto:${LEGAL_EMAIL}">${LEGAL_EMAIL}</a> and a person will answer.`,
        '<b>TO CONFIRM:</b> registered address and jurisdiction of incorporation.',
      ],
    },
    {
      h: 'If your browser says do not track, we do not',
      p: [
        'The tracking script checks <code>navigator.doNotTrack</code> before it does anything else and stops there if it is set. No identifier is created, no request is made, nothing is recorded. That is a real check in the code, not a policy we promise to honour manually.',
      ],
    },
    {
      h: 'What is recorded when you browse',
      p: [
        'If you have not opted out, we record: the pages you open and their titles, the site you arrived from, any campaign tags in the URL, your screen and window size, your time zone and browser language, roughly how long you were actively reading, and your IP address and browser user-agent string.',
        'Two identifiers are stored in your own browser. A <b>visitor id</b> in <code>localStorage</code> (<code>_k_vid</code>) which persists so returning visits can be counted as returning rather than new, and a <b>session id</b> in <code>sessionStorage</code> which disappears when you close the tab. Neither is a cookie and neither is shared with anyone.',
        'We do not run advertising trackers, we do not embed third-party analytics, and we do not sell or share this data with anyone for marketing.',
      ],
    },
    {
      h: 'Your IP address is sent to one third party',
      p: [
        'To turn an IP address into an approximate location, we send it to <b>ip-api.com</b>, which returns a country, region, city, approximate latitude and longitude, time zone and network operator. That request is made from our server, not your browser.',
        '<b>Two things about that are worth stating plainly.</b> It is sent over plain HTTP, not HTTPS, because that is what their free tier allows — so anyone able to observe traffic between our server and theirs could see the IP and the location that comes back. And ip-api.com is an independent company with its own privacy policy that we do not control.',
        'If that is not acceptable to you, setting Do Not Track prevents it entirely, because nothing is recorded to look up.',
      ],
    },
    {
      h: 'Security records',
      p: [
        'Every request to this site passes a filter that looks for attacks. When something scores high enough it is recorded — the IP address, what was requested, and what was done about it — and the address may be blocked temporarily. Blocks expire; they escalate from an hour to seven days for repeat offenders and are never permanent, because IP addresses get reassigned to other people.',
        'This is done to keep the site and our clients\' systems up. It is not used for advertising or profiling.',
      ],
    },
    {
      h: 'If you contact us',
      p: [
        'The form on this site records your name, email address, what you said, and the time you sent it. It is stored so we can reply and emailed to us so we notice. If you would rather not use the form, the phone number and email address beside it reach the same person.',
      ],
    },
    {
      h: 'If you have a client portal login',
      p: [
        'For clients with an account we hold your name, email address, a hashed password, and a record of sign-ins and password resets. Sign-in records exist so we can tell you whether an account was accessed and by whom.',
      ],
    },
    {
      h: 'How long any of it is kept',
      table: RETENTION,
      p: [
        'Old raw records are deleted automatically. What survives indefinitely is a daily count — how many people visited on a given day, from which country, on which kind of device — with nothing in it that identifies anybody.',
      ],
    },
    {
      h: 'Where it lives',
      p: [
        'On servers we operate ourselves rather than on a third-party analytics platform. Nothing on this site is processed by Google Analytics, Meta, or any advertising network.',
      ],
    },
    {
      h: 'What you can ask for',
      p: [
        'Ask us what we hold about you, ask for it to be corrected, or ask for it to be deleted, and we will do it. There is no form and no ticketing system — write to <a href="mailto:' + LEGAL_EMAIL + '">' + LEGAL_EMAIL + '</a>.',
        '<b>TO CONFIRM:</b> whether GDPR, UK GDPR, CCPA or the Israeli Privacy Protection Law apply, which depends on where the company is established and where its visitors are. That determines what rights are legally enforceable rather than simply offered.',
      ],
    },
    {
      h: 'Data belonging to our clients',
      p: [
        'Separately from this website, we build and run systems for clients that hold their data — their customers, their staff, their records. In those systems we act on the client\'s instructions and the client decides what is collected and why. This page does not cover that data; the agreement with each client does.',
        '<b>TO CONFIRM:</b> whether a written data processing agreement is offered to clients as standard. If any client is subject to GDPR or the Israeli Privacy Protection Law, they will need one from us.',
      ],
    },
  ],
};

const TERMS = {
  slug: 'terms-of-use',
  title: 'Terms of use',
  lede:
    'The rules for using this website. Short, because there is not much to it — this is a site that describes work and takes enquiries.',
  sections: [
    {
      h: 'Prices here are estimates, not offers',
      p: [
        'The pricing on this site — the ladder, the estimate builder, and the comparison chart — is published so you can work out roughly what something costs before speaking to anyone. It is an indication, not a quote and not a contract. A real number comes after a conversation about what you actually need, in writing.',
        'The figures shown for other companies\' products are their published list prices as at the date on the page. They change, sometimes sharply, and we correct them when we notice. Check anything you are relying on.',
      ],
    },
    {
      h: 'What is on the site about our work',
      p: [
        'Case studies describe work we did. Client names appear only where the client agreed; where they did not, the work is described without naming them. Screenshots of systems we built are taken from local installations filled with invented data — never from a live system holding real people\'s records.',
      ],
    },
    {
      h: 'Using the site',
      p: [
        'Read it, use the estimate builder, send us a message. What you may not do is attack it, scan it for weaknesses without asking us first, attempt to reach accounts that are not yours, or scrape it in a way that degrades it for anybody else.',
        'Requests that look like attacks are recorded and may be blocked automatically. If you are a security researcher, there is <a href="/security">a page explaining how to report something</a>, and we would rather hear from you than block you.',
      ],
    },
    {
      h: 'The client portal',
      p: [
        'Accounts are issued to clients. Keep your password to yourself, tell us promptly if you think somebody else has it, and do not share a login between people — sign-in records are how we answer "was this account used and by whom", and a shared login makes that question unanswerable.',
      ],
    },
    {
      h: 'What belongs to whom',
      p: [
        'The design, words, code and images of this website are ours. The trade marks and screenshots of our clients\' products belong to those clients and appear with their knowledge.',
        'Work we build for a client belongs to that client on the terms of their agreement with us. Nothing on this page changes that — the ownership commitments on the home page are the commercial position, and the client agreement is where they are binding.',
      ],
    },
    {
      h: 'No warranty on the site itself',
      p: [
        'This website is provided as it is. We keep it accurate and online, and we will fix errors when we find them, but we do not promise it is free of mistakes or always reachable. Nothing on it is professional advice for your particular situation.',
      ],
    },
    {
      h: 'Governing law',
      p: [
        '<b>TO CONFIRM:</b> which jurisdiction governs these terms and where disputes are heard. This depends on where the company is registered and is a decision, not a lookup.',
      ],
    },
    {
      h: 'Changes',
      p: [
        `These terms were last changed on ${LEGAL_UPDATED}. When they change we update the date; we do not keep a public history, so if you need the version you agreed to, ask and we will send it.`,
      ],
    },
  ],
};

const SECURITY = {
  slug: 'security',
  title: 'Security',
  lede:
    'How to report something you have found, and what we run. If you think you have found a weakness, we want to hear it — and we will not come after you for looking.',
  sections: [
    {
      h: 'Reporting something',
      p: [
        `Email <a href="mailto:${LEGAL_EMAIL}">${LEGAL_EMAIL}</a> with what you found and how to reproduce it. A person reads it. We will confirm we received it, tell you what we think, and tell you when it is fixed.`,
        'Please give us a reasonable chance to fix it before publishing, do not access or change data that is not yours, and do not run tests that would take the site down or degrade it for other people.',
      ],
    },
    {
      h: 'What we will not do',
      p: [
        'If you report something in good faith and stay within the lines above, we will not pursue legal action against you and we will not report you. We will credit you if you want to be credited.',
      ],
    },
    {
      h: 'What is running here',
      p: [
        'Every request to this site passes through a filter that inspects the path, query, body and user agent for attack patterns, scores what it finds, and blocks addresses that cross a threshold. Blocks escalate with repeat offences and always expire.',
        'Accounts lock after repeated failed sign-ins. Sign-in attempts are recorded. An unknown email address and a wrong password return the same error, deliberately, so the login cannot be used to discover who has an account.',
        'That is the same shield we build into the systems we run for clients — this site is not a special case.',
      ],
    },
    {
      h: 'What we do not run',
      p: [
        'There is no bug bounty and no payment. This is a small company and the honest position is that we can offer thanks, credit and a fast fix, not money.',
      ],
    },
  ],
};

const LEGAL_PAGES = [PRIVACY, TERMS, SECURITY];
const legalBySlug = (slug) => LEGAL_PAGES.find((p) => p.slug === slug) || null;

/* Everything that cannot be answered from the repository. Keep this list — it
   is the difference between "drafted" and "done", and it is short enough to
   close in one conversation with whoever incorporates the company. */
const LEGAL_OPEN = [
  'Registered address and jurisdiction of incorporation for ' + LEGAL_ENTITY,
  'Governing law and venue for the terms of use',
  'Whether GDPR / UK GDPR / CCPA / Israeli Privacy Protection Law apply',
  'Whether a written data processing agreement is offered to clients as standard',
  'Whether analytics consent (a banner) is required for EU visitors, or whether Do Not Track plus self-hosting is considered sufficient',
  'Legal review of all three pages before they are relied on',
];

module.exports = {
  LEGAL_UPDATED, LEGAL_ENTITY, LEGAL_EMAIL,
  RETENTION, LEGAL_PAGES, legalBySlug, LEGAL_OPEN,
  PRIVACY, TERMS, SECURITY,
};

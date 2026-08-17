# LinkedIn — the whole page, ready to paste

**Written 2026-08-16.** Everything below is either a field to fill in or a file to
upload. Nothing here needs a design tool.

The artwork is **generated**, from the same geometry and the same copy as the site:

    node scripts/build-linkedin.js

It reads the mark from `content/logo.js`, the headline out of `index.html`, and the
numbers from `content/stats.js`. So the rule from `assets/brand/README.md` applies here
too — **do not hand-edit anything in `assets/social/linkedin/`.** Change the source and
re-run, or the next run silently reverts it.

---

## 1. The files, and where each one goes

| Upload slot | File | Size |
|---|---|---|
| Company page logo | `assets/social/linkedin/li-logo-300.png` | 300×300 |
| Company page cover | `assets/social/linkedin/li-cover-1128x191.png` | 1128×191 |
| **Your** profile banner | `assets/social/linkedin/li-profile-banner-1584x396.png` | 1584×396 |
| Post 1 image | `assets/social/linkedin/li-post-1-launch.png` | 1200×627 |
| Post 2 image | `assets/social/linkedin/li-post-2-hardpart.png` | 1200×627 |
| Post 3 image | `assets/social/linkedin/li-post-3-apps.png` | 1200×627 |
| Weekly post template | `assets/social/linkedin/li-post-template-shipped.png` | 1200×627 |

Two reference files, not for upload: `li-logo-proof-48.png` is the logo at the size the
feed actually draws it, and `li-logo-alt-lockup-300.png` is the version with the name
inside the arch, so the choice below can be made by looking rather than by imagining.

### Why the logo is the three stones and not the full lockup

The upload is 300×300, but **the feed draws it at about 48px** and search at about 56.
`assets/brand/README.md` fixes the boundary at 48: at or under it, three stones and no
wordmark, because below 64 the word falls under ~5px and turns into a grey smear that
makes the whole tile look out of focus. Open `li-logo-proof-48.png` and
`li-logo-alt-lockup-300.png` side by side and it is obvious. The file being large does
not mean the picture is seen large — that is the one easy thing to get wrong here.

It is also **full bleed, no rounded corner.** LinkedIn applies its own mask; a tile that
arrives pre-rounded gets rounded twice and reads as chewed.

### Why the cover has no logo on it

On a company page the avatar sits at the bottom-left **on top of** the banner. The mark
is already on screen, 40px away. Putting the lockup in the banner as well reads as a
template nobody adjusted. Everything in the cover is inside x = 232–1010 for that reason,
plus the fact that **mobile crops the banner to the centre 900px.**

---

## 2. Page fields

Create at **linkedin.com/company/setup/new** → *Company*.

| Field | Value |
|---|---|
| **Name** | `kaymen.dev` |
| **linkedin.com/company/** | `kaymen-dev` |
| **Website** | `https://kaymen.dev` |
| **Industry** | `Software Development` |
| **Company size** | `2-10 employees` |
| **Company type** | `Privately Held` |
| **Logo** | `li-logo-300.png` |
| **Tagline** | see below |

Then **Edit page → Page info** for the rest:

| Field | Value |
|---|---|
| **Cover image** | `li-cover-1128x191.png` |
| **Overview / About** | §3 below |
| **Year founded** | *confirm — see §8* |
| **Locations** | your city + state, headquarters, street address optional |
| **Custom button** | `Visit website` → `https://kaymen.dev` |
| **Hashtags** | `#CustomSoftware` `#SystemIntegration` `#SoftwareDevelopment` |

### Tagline — 120 characters max, this is 111

```
Own your software. Stop renting it. Custom platforms, integrations and apps — built and run by the same people.
```

If LinkedIn rejects the em dash, use `-` instead. Shorter fallback, 35 characters:

```
Own your software. Stop renting it.
```

---

## 3. About — 2,000 characters max, this is 1,696

Paste verbatim. LinkedIn strips bold, so the section headers are caps rather than markup,
and the bullets are `•` because asterisks render as literal asterisks.

```
Five subscriptions, each doing half a job. Somebody reconciles them by hand every week, every hire costs more, and you own none of it.

We build the one system that does all of it — and then we run it.

kaymen.dev builds custom platforms, integrations and native apps for organisations that have outgrown spreadsheets and a drawer full of disconnected tools. You own the code, the data and the servers. Hire twenty more people and the bill does not move.

WHAT WE BUILD

• Multi-tenant platforms — one system, many organisations, isolation enforced in the database rather than hoped for in the application.
• Business systems and integrations — the connective work most shops decline: two-way Salesforce syncs, reconciliation against a live book, APIs that were never designed for the question being asked.
• Consumer and mobile apps — native iOS and Android in the stores, plus the release discipline that keeps an update from reaching zero users.

WHAT IS ACTUALLY RUNNING

19 systems in production, on infrastructure we operate ourselves. 3 apps in the App Store and Google Play. 1,924 commits in the last twelve months. One team end to end — architecture, build, deploy, and the 3am page.

HOW WE PRICE

A build fee, then a flat monthly to run it. Overflow beyond the monthly is $125/hr. Nonprofits get 25% off, publicly and without asking. And sometimes the answer is that you should not build anything yet — we will say so.

NO HOSTAGES

Your code, your data, your servers. No lock-in, no per-seat tax, and you can take the whole thing with you any time.

Every case study on the site names the part that broke. A capability list is free to write; naming what went wrong is not.

kaymen.dev
```

**The three numbers in there are generated and will go stale.** They come from
`content/stats.js` via `scripts/refresh-stats.js`. When that file changes, this paragraph
is wrong until you edit the About. It is the one part of this page that does not
self-update.

---

## 4. Specialties — 20, and they feed LinkedIn search

Paste one at a time under *Edit page → Page info → Specialties*.

```
Custom software development
Multi-tenant SaaS platforms
System integrations
Salesforce integration
QuickBooks integration
Legacy system migration
Business process automation
Client portals
API development
Laravel
PostgreSQL
Node.js
React Native
iOS and Android apps
Managed application hosting
DevOps and deployment
Data reconciliation
Bilingual and RTL interfaces
Nonprofit technology
Software for growing businesses
```

---

## 5. The first three posts

**Post all three before you tell anyone the page exists.** A company page with zero posts
reads as abandoned, and the mailing-list email you are planning will send people straight
to it. Space them a few days apart, or post them over the first week.

### Post 1 — the launch · image `li-post-1-launch.png`

```
We have been quiet on here while we were busy shipping. Nineteen systems are running in production right now, so it seemed like a reasonable time to make a page.

Here is what kaymen.dev does.

Most growing businesses end up renting five different tools that each do half a job. Somebody reconciles them by hand every week. Every new hire adds another seat fee. And at the end of it you own none of it — not the code, not the data, and often not even a usable export.

We build the one system that does all of it, on infrastructure you own, and then we run it. Hire twenty people and the bill does not move.

Three kinds of work: multi-tenant platforms, the integration work most shops decline, and native apps that are actually in the stores.

Every case study on our site names the part that broke. A capability list is free to write. Naming what went wrong is not.

kaymen.dev

#CustomSoftware #SoftwareDevelopment #SystemIntegration
```

### Post 2 — proof · image `li-post-2-hardpart.png`

This is the strongest post of the three. It is a real failure, described precisely, with
the fix. That is the thing a capability list cannot fake.

```
A security control that fails open is worse than one you never built, because it also buys you confidence.

We built a multi-campus platform on one Postgres database, with tenant isolation done properly: every tenant table gets a row-level security policy, the request sets the current organisation, and the database refuses to return anyone else's rows.

The policies were in place. The tests passed. And one campus could still read another's students.

The managed Postgres had provisioned our application's database user as the cluster's bootstrap superuser. Superusers bypass row-level security unconditionally — FORCE ROW LEVEL SECURITY does not apply to them — and the bootstrap user cannot be demoted, because Postgres refuses. So the entire isolation layer was inert, and nothing about the running application looked wrong.

The fix was a separate non-superuser role, ownership of every table and sequence reassigned to it, and the app moved onto it. current_user is now asserted on boot, because a deploy that quietly reverts that credential would turn tenant isolation back off without a single error.

Then the same property bit from the other direction. A migration backfilling a new column looped over an existing table and wrote nothing — it ran under row-level security with no bypass active, so the read returned zero rows and the loop did nothing, successfully. 152 student records went blank and the migration reported success.

Both bugs were silent successes. The check that catches that kind is asserting the precondition at runtime, not testing the behaviour once.

Four campuses are live on it today.

#PostgreSQL #MultiTenant #SoftwareEngineering #Laravel
```

### Post 3 — the apps · image `li-post-3-apps.png`

```
"Did it publish" and "did it arrive" are different questions, and the first one will happily report success.

Expo over-the-air updates are matched to a runtime version. A device only accepts an update published to the runtime its installed binary was built with. That is the correct design — it is what stops JavaScript expecting a native module the installed app does not contain.

It also means a version bump in the wrong place is a silent, total delivery failure. The app config had moved to 2.1.0 while the build in the store was 2.0.1. A publish from that state completes without warning, reports success, and lands on a runtime that no installed device has. Every user stays on the old code, indefinitely, and the dashboard says the update shipped.

There is a matching trap one layer down: add a native module in JavaScript without shipping a binary that contains it, and the update installs and then crashes on the code path that needs it. A break introduced by the delivery mechanism itself.

Both are procedural now rather than remembered. Runtime version is verified against the shipped build before any publish, native-module changes are pinned to a matching binary release, and a type check gates the publish so a broken bundle cannot reach the channel at all.

Shipping the first build is the easy half.

#ReactNative #Expo #MobileDevelopment #AppStore
```

---

## 6. The weekly rhythm

Template image: `li-post-template-shipped.png`. Four slots, and they are the four the card
draws: **a number**, **what the number is**, **the one thing that was hard**, and **which
system it was**.

The format is deliberately not "here is what we shipped." It is **one specific thing that
was hard, and what fixed it** — because that is the only kind of post that cannot be
written by someone who did not do the work. Posts 2 and 3 above are the shape.

Three rules that will keep this alive past week four:

- **Do not force Thursday.** A week whose honest answer is "a CSS fix and a dependency
  bump" produces a filler post, and filler teaches people to scroll past you. Twenty good
  posts a year beat fifty-two shrugs. Aim weekly, skip without guilt.
- **The well is wider than shipping.** What broke, what you chose and why, what surprised
  you, what you talked a client out of building. All of it qualifies.
- **Never post a client's name without their yes**, even when the site already names them
  (see §8).

To make new template cards, add an entry to the `SHOTS` array in
`scripts/build-linkedin.js` and re-run. Anything built from a case study should use
`studyCard('<slug>')` so the numbers come from `content/projects.js` rather than from
memory.

---

## 7. Your personal profile — do this too

For a shop this size the personal profile is seen more than the company page. Posts go out
under a person, and the profile is where anyone interested actually lands.

- **Banner:** `li-profile-banner-1584x396.png`
- **Headline** (220 max, this is 139):

```
I build custom platforms, integrations and mobile apps — and then run them. Own your software instead of renting five tools that half-work.
```

- **About**, opening line — the rest can be lifted from §3:

```
I build the one system that replaces the five subscriptions, and then I keep it running. 19 in production right now.
```

- **Experience:** add `kaymen.dev` as your current role so the page links to the profile
  and the profile links to the page. A company page with no associated people looks like a
  shell.
- **Featured:** pin the link to `kaymen.dev` and one case study.
- **Creator mode / custom button:** set the profile button to your site.

---

## 8. Two things to check before you publish

**1. Year founded.** I have not filled this in because I could not source it — the repo
tells me systems have been live since 2025, which is not the same as when the LLC was
formed. Use the real formation year of Kaymen Group LLC.

**2. Client names, again, and for a different reason.** `content/projects.js` records
consent per project: Thrive/OLAMI, PCG, Torah Tracker, BridgeMortgage and Horse & Harmony
are marked `named: true`, and the MSP portal is `named: false` and stays anonymous.

**That consent was for the website.** A LinkedIn post is a different surface — it can be
tagged, it reaches the client's own network and their competitors, and it shows up in
their employees' feeds. It is worth one message to each of them saying you would like to
post about the work on LinkedIn specifically. Most will say yes and some will reshare it,
which is worth more than the post.

**Posts 2 and 3 above are written to need neither.** Post 2 says "a multi-campus platform"
and post 3 names no client at all — the engineering carries them. Add the names once you
have the yes, and they get better.

---

## 9. One thing this page cannot do

Automated posting to LinkedIn is gated: posting as a **person** needs partner approval for
the `w_member_social` scope, and Company Pages are easier but still an approval. For a
one-person shop the realistic loop is **agent drafts on Thursday, you paste on Thursday** —
which is better anyway, because you will edit it into your own voice on the way through.

The part actually worth automating is the raw material, not the prose: a job that reads git
history across the repos plus Coolify and hands you *"here are the seven things that
changed this week, this one is the interesting one, and here is why."* Same sources as
`scripts/refresh-stats.js`. That is a separate build, not part of this page.

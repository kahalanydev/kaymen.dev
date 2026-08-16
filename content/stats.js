/* ============================================================================
   GENERATED FILE. Do not edit by hand.

   Written by scripts/refresh-stats.js on 2026-08-16.
   Sources: git history of each project repo, and the Coolify API on
   admin.kaymen.dev. Re-run after any month rolls over, or after a system
   joins or leaves the fleet:

     COOLIFY_TOKEN=... node scripts/refresh-stats.js
   ============================================================================ */

const GENERATED_AT = "2026-08-16";

/** Month buckets for the sparklines, oldest first. */
const MONTHS = ["2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08"];

/** Active days per month per system: distinct days carrying at least one commit. */
const FLEET = [
  {
    "slug": "multi-campus-engagement-platform",
    "name": "Multi-campus platform",
    "kind": "Platform",
    "days": [
      0,
      0,
      0,
      0,
      19,
      29,
      10
    ]
  },
  {
    "slug": "community-lending-ledger",
    "name": "Community ledger",
    "kind": "Platform",
    "days": [
      0,
      11,
      0,
      0,
      2,
      5,
      8
    ]
  },
  {
    "slug": "msp-time-compliance-portal",
    "name": "MSP compliance portal",
    "kind": "Integration",
    "days": [
      0,
      0,
      0,
      0,
      6,
      8,
      4
    ]
  },
  {
    "slug": "bilingual-booking-platform",
    "name": "Bilingual booking",
    "kind": "App",
    "days": [
      0,
      0,
      1,
      2,
      5,
      2,
      0
    ]
  },
  {
    "slug": "torah-tracker",
    "name": "Torah Tracker",
    "kind": "App",
    "days": [
      1,
      14,
      13,
      1,
      1,
      0,
      5
    ]
  },
  {
    "slug": "claude-code-desk",
    "name": "Claude Code Desk",
    "kind": "Platform",
    "days": [
      0,
      3,
      7,
      0,
      5,
      4,
      10
    ]
  }
];

/** Where most months actually land, as an interquartile range of active months. */
const TYPICAL = {"low":2,"high":10};

/** Production (non-staging) applications running on our Coolify. */
const LIVE = {
  "total": 27,
  "running": 19,
  "names": [
    "Autotask Tech Metrics",
    "BridgeMortgage",
    "Davenen",
    "Finplan",
    "Hayeruka",
    "HorseHarmony",
    "Kartov",
    "Kaymen Dev Site",
    "Kaymen Group LLC",
    "Node AI Site",
    "NodeAI",
    "NodeAI-Published-Live",
    "Predictable",
    "RichmountCapital",
    "ShipHeroAI",
    "TapSend",
    "Temani Chacham Site",
    "Torah Tracker",
    "kahalanydev/-passaic-clifton-gemach:master-nwg0s00oc8k8owo0sggkgkgg"
  ]
};

/** Apps published to the App Store / Google Play, per the content model. */
const STORE_APPS = [
  "Davenen",
  "Temani Chacham",
  "Torah Tracker"
];

/** The four figures in the stats band. */
const BAND = [
  {
    "value": "19",
    "label": "systems running right now",
    "note": "Production apps on infrastructure we operate ourselves."
  },
  {
    "value": "3",
    "label": "apps in the App Store & Play",
    "note": "Shipped, reviewed, and updated over the air."
  },
  {
    "value": "1,827",
    "label": "commits in the last 12 months",
    "note": "Across the six systems on the board below."
  },
  {
    "value": "1",
    "label": "team, end to end",
    "note": "Architecture, build, deploy and the 3am page."
  }
];

module.exports = { GENERATED_AT, MONTHS, FLEET, TYPICAL, LIVE, STORE_APPS, BAND };

# v0.2.226-alpha — Entry-Flow Button Fix (stale service-worker app-shell)

**Type:** service-worker (`public/sw.js`) + `index.html` SW-registration self-heal slice. No
gameplay/physics/shooter/Nostr change. URGENT MVP BLOCKER fix.
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## Reported symptom

User manually tested live Torii Quest (v0.2.224-alpha at https://torii-quest.pplx.app) and
reported: *"the login button and enter arena buttons are not responding... they don't do
anything."* The static title screen renders, but every title-screen button is inert. This blocks
the manual MVP playtest.

## Root cause

**Stale service-worker app-shell precache — NOT a source regression.**

`public/sw.js` precached the HTML app shell (`'/'`) in `PRECACHE_ASSETS`. The production Vite build
content-hashes the app bundle (`/assets/index-<hash>.js`), and `index.html` pins that exact hashed
URL. The service worker serves JS/CSS/HTML **network-first**, but on any network hiccup it falls
back to the cache and returns the *precached* shell. That stale shell points at an
`/assets/index-<oldhash>.js` that **404s** after a redeploy mints a new bundle hash. Result: the
app bundle never executes, the static title HTML still renders, and every button's click listener
(which lives in the dead bundle) is inert — exactly the reported behaviour.

Diagnosis was done entirely from source: `main.js` button wiring is stable since v0.2.184, the CSP
matched, `#screen-title` is z-index 100 (topmost, no overlay swallowing pointer events), and the
full Vitest suite was green. The only lifecycle surface that strands a returning client on a dead
bundle is the SW precaching the mutable shell.

## Fix (surgical, two files)

1. **`public/sw.js`** — removed `'/'` from `PRECACHE_ASSETS`. Precache now contains ONLY the seven
   immutable binary assets (GLBs / textures) whose URLs never change between deploys. The HTML shell
   is always network-first; it is still cached *opportunistically* inside the VERSION-named cache
   (purged every deploy by the existing `activate` handler), so the shell and its hashed bundle stay
   a consistent pair. Added an explanatory comment block documenting the time-bomb and the v0.2.226
   regression. All install/activate/fetch handlers, `skipWaiting()`, `clients.claim()`, purge logic,
   and the cache-first/network-first routing are otherwise **unchanged**.

2. **`index.html`** — added a loop-guarded `controllerchange` → `window.location.reload()` self-heal
   to the inline SW-registration script, so a client that receives a fresh worker (which `skipWaiting`
   + `clients.claim`) reloads exactly once onto the live bundle instead of running against stale
   control. The `if (reloading) return;` guard prevents a reload loop. CSP `script-src` sha256 hash
   for the inline script recomputed accordingly.

## Changed / added files

### Core deliverable
- `public/sw.js` — dropped HTML shell `'/'` from `PRECACHE_ASSETS`; precache is binary-only.
  `CACHE_VERSION = 'tq-v0.2.226-alpha'`.
- `index.html` — guarded `controllerchange` self-heal reload in inline SW registration; CSP
  `script-src` sha256 updated to `'sha256-kSlcI81hNn07JrxiM4vmvnFrbp8sf1BjrBQFApJ2aFU='`.

### Regression coverage (new)
- `tests/sw-app-shell.test.js` — 7 tests: (a) SW does NOT precache the HTML shell, (b) precache is
  binary-only, (c) cache name embeds VERSION, (d) `isStaticAsset` excludes HTML/JS/CSS; plus
  (e) index.html registers the SW, (f) `controllerchange` reload is guarded with `if (reloading)
  return`, (g) the CSP sha256 matches the inline registration script byte-for-byte.

### Guard
- `tools/regression-check.mjs` — `EXPECTED_VERSION` → `v0.2.226-alpha`; stale guard now flags
  `v0.2.225-alpha`. Existing `[5]` assertion confirms `public/sw.js` `CACHE_VERSION` embeds the
  current version.

### Version markers
- `src/config.js` (`VERSION`), `package.json`, `index.html` (`#version-label` + `#ver`),
  `src/engine/dashboard/continuumData.js` (`CONTINUUM_VERSION` + "Source version" + Active slice
  narrative), `src/engine/status/mvpReadiness.js` (`DEFAULT_TEST_STATUS`),
  `tests/continuum-dashboard.test.js` (4 version pins). Test counts moved 1487→**1494 passing**,
  90→**91 files** (the +1 lockstep for the new `sw-app-shell.test.js`).

### Docs
- `todo.md` (header + new HARD-40 BUGFIX row), `progress.md` (header / Source version / Tests /
  Active slice), `HANDOFF.md` (Current version + v0.2.226 changelog block + report pointer),
  `CODE_INDEX.md` (Current version + new "buttons inert on live" diagnosis row),
  `SDK_DEBUG_INDEX.md` (status version).

### Regenerated artifacts
- `NEXT_ACTION_STATE.json`, `MVP_APPROVAL_STATE.json`, `public/release-metadata.json`,
  `public/continuum.html`, `public/continuum-data.json`, `HANDOFF.generated.md`,
  `MVP_RELEASE_PACKAGE.md`, `MVP_PLAYTEST_CHECKLIST.md`, `RELEASE_NOTES_DRAFT.md`,
  `GITHUB_RELEASE_DRY_RUN.md`, `MVP_RC_SNAPSHOT.md`, `RELEASE_ARTIFACT_MANIFEST.md` (carry
  v0.2.226-alpha). **`MVP_PLAYTEST_RESULTS.md` is NO-CLOBBER and was NOT regenerated.**

### New
- `torii-v0.2.226-entry-flow-button-fix-report.md` — this report.

## Tests run / results

- `npx vitest run` → **1494 passing / 91 files** (+7 from new `sw-app-shell.test.js`)
- `npm run check` → expected **15 / 15 GREEN**
- `npm run build` → expected clean (standing rapier >700 KB advisory only, not gated)
- `npm run test:release` → expected **exit 0**

## Manual verification notes

- **NOT yet manually playtested on a live deploy** — the fix is in source. After the parent agent
  deploys, the first load installs the corrected SW; the `controllerchange` self-heal reloads any
  client stranded on a stale shell onto the live hashed bundle, restoring button responsiveness.
- A returning user on the broken v0.2.224 cache will self-heal on next visit once v0.2.226 is live
  (new worker activates, `clients.claim()` fires `controllerchange`, page reloads once onto the
  fresh shell+bundle pair).
- **No MVP approval granted; playtest remains not-run / pending.** `MVP_PLAYTEST_RESULTS.md`
  untouched.

## Security-sensitive behavior

**None added — this slice REDUCES stale-asset risk.** No new fs/crypto/git/network surface. No
gameplay/physics/shooter/Rapier change; no Nostr signing/publishing/live network write; no
deploy/publish/tag/self-update. `godMode` stays false; no new `setTimeout`/`Vector3`/`Matrix4`;
"nostrich"/"Chiefmonkey" untouched.

## Blockers / warnings

None. Commit is **local only** — not pushed, not deployed, not published, not tagged. Standing
non-blocking advisories unchanged (rapier chunk >700 KB; alpha). Parent/main agent handles security
review, deploy, publish, push, and Space upload.

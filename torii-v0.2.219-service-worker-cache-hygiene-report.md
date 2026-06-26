# v0.2.219-alpha — Service-Worker Cache-Version Hygiene + Guard

**Type:** service-worker (`public/sw.js`) + tooling slice (no runtime/gameplay change).
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## What & why

The v0.2.217 and v0.2.218 security reviews carried ONE non-blocking advisory: `public/sw.js`
`CACHE_VERSION` was the static literal `tq-v1`. The service worker keys its cache name off that
literal (`torii-quest-${CACHE_VERSION}`), and the `activate` handler only purges caches whose name
does NOT equal the current `CACHE_NAME`. With a static `tq-v1`, the cache name never changes between
deploys, so after an asset-changing deploy a returning visitor could be served stale assets out of
the old cache — the purge never fires because the name is identical.

This slice makes the cache identity TRACK the app version, so every version bump (which already
happens on every deploy) mints a fresh cache name and the existing purge logic cleans up the prior
version automatically — no stale assets after an asset-changing deploy, and no new caching behavior.

`public/sw.js` is copied VERBATIM by Vite (it lives in `public/`, no module system / no Vite
transform), so it **cannot** `import` `src/config.js`. The chosen approach therefore keeps
`CACHE_VERSION` a hardcoded string literal and ties it to the version with a regression-check guard —
the same enforcement pattern already used for the `package.json` version. Per the work-order's
"regression guard if feasible without overcomplicating" option, the guard extends the established
regression-check `[5]` version-marker block rather than adding a new numbered check or unit test,
which keeps the scope tiny and the Vitest suite count unchanged (no `CURRENT_TEST_STATUS` /
`DEFAULT_TEST_STATUS` churn).

## Changed / added files

### Core deliverable
- `public/sw.js` — changed `CACHE_VERSION` from the static `'tq-v1'` to the version-tracking
  `'tq-v0.2.219-alpha'`, with an explanatory comment noting it must stay in lockstep with the other
  version markers and that regression-check `[5]` fails if it does not embed the current version.
  All install/activate/fetch handlers, `skipWaiting()`, `clients.claim()`, the old-cache purge, and
  the cache-first-for-assets / network-first-for-JS-CSS-HTML strategy are **UNCHANGED**.

### Guard (regression-check [5])
- `tools/regression-check.mjs` — bumped `EXPECTED_VERSION` to `v0.2.219-alpha`; the stale-version
  guard now flags `v0.2.218-alpha` in `index.html`. Added a guard at the end of the `[5]` block that
  reads `public/sw.js`, matches the `CACHE_VERSION = '...'` literal via regex, and FAILS if it is
  missing or does not EMBED `EXPECTED_VERSION` (so it can never silently rot back to a static value
  like `tq-v1`); on success it prints `public/sw.js CACHE_VERSION tracks v0.2.219-alpha`. The check
  `[5]` header comment documents the new service-worker assertion.

### Version markers
- `src/config.js` (`VERSION`), `index.html` (×2: `#version-label` + `#ver`),
  `src/engine/dashboard/continuumData.js` (`CONTINUUM_VERSION` + "Source version" metric + Active
  slice narrative), `tests/continuum-dashboard.test.js` (4 version pins). `CURRENT_TEST_STATUS`
  (continuumData) and `DEFAULT_TEST_STATUS` (mvpReadiness) are UNCHANGED at 1417/87 — no test added.

### Docs
- `todo.md` (header + new HARD-33 row), `progress.md` (header / Source version / Active slice /
  Active-now bullet, Tests held at 1417/87), `HANDOFF.md` (§1 Current version + §3 new `public/sw.js`
  version-marker row + v0.2.219 narrative block + report pointer), `CODE_INDEX.md` (Current version +
  Version/config row sw.js note), `SDK_DEBUG_INDEX.md` (status version).

### Regenerated artifacts
- `NEXT_ACTION_STATE.json`, `RELEASE_ARTIFACT_MANIFEST.md`, `public/release-metadata.json`,
  `public/continuum.html`, `public/continuum-data.json`, `HANDOFF.generated.md`,
  `MVP_RELEASE_PACKAGE.md`, `MVP_PLAYTEST_CHECKLIST.md`, `RELEASE_NOTES_DRAFT.md`,
  `GITHUB_RELEASE_DRY_RUN.md`, `MVP_PLAYTEST_RESULTS_TEMPLATE.md`, `MVP_RC_SNAPSHOT.md` (carry
  v0.2.219-alpha).

### New
- `torii-v0.2.219-service-worker-cache-hygiene-report.md` — this slice report.

## Tests run / results

- `npx vitest run` → **1417 passing / 87 files** (unchanged; no test added)
- `npm run check` → **15 / 15 ALL GREEN** (new `public/sw.js CACHE_VERSION tracks v0.2.219-alpha`
  pass line under check [5])
- `npm run build` → clean (standing rapier >700 KB advisory only, not gated)
- `npm run build:continuum` → all four lists derived from progress.md
- `npm run test:release` → **exit 0**

## Security-sensitive behavior

**None added — this slice REDUCES the stale-asset risk the security reviews flagged.** The service
worker's kill-switch / safety behavior (install precache, `skipWaiting`, `activate` old-cache purge,
`clients.claim`, the per-asset-type fetch routing) is byte-for-byte unchanged; only the cache-name
string now tracks the version so the purge actually fires after a deploy. No new fs/crypto/git/network
surface — the new guard reads `public/sw.js` from disk inside the existing node-only build tool. No
gameplay/physics/shooter/Rapier change; no Nostr signing/publishing/live network write; no
network/deploy/publish/tag/release/self-update. `godMode` stays false; no new
`setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey" untouched.

## Blockers / warnings

None. Commit is **local only** — not pushed, not deployed, not published, not tagged.
Standing non-blocking advisories unchanged (rapier chunk >700 KB; SDK_DEBUG advisory; alpha).
Parent/main agent handles security review, deploy, publish, push, and Space upload.

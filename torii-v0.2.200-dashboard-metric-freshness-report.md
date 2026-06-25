# Torii Quest — v0.2.200-alpha Release Report

## Slice: Dashboard Metric Freshness Cleanup

**Type:** infrastructure / dashboard / status data-quality. **No runtime behavior change.**

### Goal

Resolve the recurring stale LAST-KNOWN test-count issue flagged in security reviews:
`HEALTH_LASTKNOWN.totalTests` was stuck at an old `'1180 passing'` while the live
suite was 1246/78. Prefer deriving the displayed test count from the curated current
test status already used by the Continuum dashboard, OR make the label impossible to
confuse if it is truly last-known. Keep the slice focused on dashboard/status data
quality so the MVP percentage/status stays trustworthy, and add tests that catch
future stale-count drift.

### Root cause

Two displayed test-count surfaces in `src/engine/dashboard/continuumData.js` had
drifted apart because each carried its OWN hand-maintained copy of the number:

1. the engineering-health **"Total tests"** metric, fed by `HEALTH_LASTKNOWN.totalTests`
   (the stale `'1180 passing'` copy), and
2. the at-a-glance metrics **"Tests"** row (kept current at `1241 passing / 78 files`).

Because the two were maintained independently, one fell behind. The fix removes the
second copy: a SINGLE curated source feeds BOTH surfaces, so they cannot diverge again.

### What landed

**`src/engine/dashboard/continuumData.js`** (PURE, browser-safe — no fs/network/
THREE/DOM):

- New frozen single source of truth:
  ```js
  export const CURRENT_TEST_STATUS = Object.freeze({
    passing: 1246,
    files: 78,
    fastProfile: 5,
    foundationProfile: 25,
  });
  ```
- New helper `testCountLabel(status = CURRENT_TEST_STATUS)` → the canonical
  `"<passing> passing / <files> files"` string; null/partial-safe (falls back to
  `CURRENT_TEST_STATUS` fields for any missing value).
- `HEALTH_LASTKNOWN.totalTests` now DERIVES from `testCountLabel()` instead of the
  hard-coded `'1180 passing'` literal.
- The metrics **"Tests"** row now renders `testCountLabel()` + the profile counts
  (`test:fast ~5`, `test:foundation ~25`) drawn from the same source.
- `CONTINUUM_VERSION`, the **Source version** metric, and the **Active slice** metric
  bumped to v0.2.200-alpha; `activeNow`/`completed24h` rotated to add the v0.2.200
  entry (the 3/4 length invariants preserved by rotating, not growing, the arrays).

**`src/engine/status/mvpReadiness.js`** — the separate MVP-readiness rollup capture
`DEFAULT_TEST_STATUS` bumped from 1241 → 1246 (files stays 78), with a comment noting
it is kept in lock-step with the dashboard `CURRENT_TEST_STATUS` via a cross-capture
test rather than a cross-import (so the heavy dashboard module is NOT pulled into the
status/SDK/CLI chain — concerns stay split).

### Tests (drift catchers)

New describe block in `tests/continuum-dashboard.test.js`
("test-count freshness — single source of truth", **+5 tests**):

1. `CURRENT_TEST_STATUS` is frozen + well-shaped (positive ints, profile counts).
2. The curated `files` count EQUALS the real on-disk `*.test.js` count via
   `readdirSync(dirname(fileURLToPath(import.meta.url)))` — forces a bump whenever a
   test file is added/removed, so the displayed file count cannot silently drift.
3. `testCountLabel()` derives the canonical string and degrades safely on null/partial.
4. BOTH displayed surfaces (the metrics "Tests" row AND `HEALTH_LASTKNOWN.totalTests`)
   derive from `CURRENT_TEST_STATUS`, and `HEALTH_LASTKNOWN.totalTests` no longer
   matches `/1180/`.
5. `mvpReadiness.DEFAULT_TEST_STATUS` (passing/files) agrees with `CURRENT_TEST_STATUS`
   — a cross-capture check WITHOUT cross-importing.

The `passing` count stays a curated single-source capture (running vitest at static-
page-build time is out of scope), but it now lives in exactly ONE place and a cross-
capture test ties it to the readiness rollup.

Full suite after the slice: **1246 passing / 78 files** (78 files unchanged — the +5
cases were added to an existing file).

### Version bump (v0.2.199-alpha → v0.2.200-alpha)

`package.json`, `src/config.js`, `index.html` (×2), `tools/regression-check.mjs`
(EXPECTED_VERSION + stale guard), `src/engine/status/mvpReadiness.js`
(`DEFAULT_TEST_STATUS` 1241/78 → 1246/78), `src/engine/dashboard/continuumData.js`
(CONTINUUM_VERSION + metrics rows + active/completed entries), `tests/agent-handoff.test.js`
(fixture version strings), `public/release-metadata.json` (regenerated), continuum
artifacts rebuilt, dist rebuilt.

### Docs updated

`todo.md` (new HARD-15 row + HARD-13 test-count fix), `progress.md` (header / source
version / tests / active slice / active-now bullet + stale 1241 fix), `HANDOFF.md`
(version line + changelog block + latest-slice report), `CODE_INDEX.md` (version +
mvpReadiness test count + dashboard-row v0.2.200 note).

### Security-sensitive behavior

**None changed.** This is a data-quality cleanup of curated dashboard/status constants
and their tests. No gameplay/physics/shooter/Rapier change; no Nostr signing/
publishing/live network write; no server/DNS/SSH/updater change. The dashboard stays
server-rendered escaped text with NO new `<script>` and no new `data-k` key, so the
v0.2.172 continuum refresh-script sha256 + CSP/XSS guard are unchanged. `godMode`
remains `false`. No new `setTimeout`; no new `Vector3`/`Matrix4` in hot paths.

### Verification

- `tests/continuum-dashboard.test.js` — pass (incl. the +5 new cases).
- Full vitest suite — 1246 passing / 78 files.
- `npm run check` — 15 / 15 GREEN (docConsistency [14] reports v0.2.200 across the
  continuity docs).
- `npm run test:release` — build + vitest + check + bundle:report + handoff:status.

### Blockers / warnings

- Standing advisory (never gated): `rapier-*.js` chunk > 700 KB.
- The `passing` count remains a curated capture (single-sourced); a future build step
  could feed the live vitest number in without changing the module's purity. The
  on-disk file-count test guarantees the `files` figure cannot drift unnoticed.

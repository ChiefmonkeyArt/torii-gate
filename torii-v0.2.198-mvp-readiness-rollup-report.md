# Torii Quest — v0.2.198-alpha Release Report

## Slice: MVP Release-Readiness Rollup

**Type:** infrastructure / dashboard / tooling. **No runtime behavior change.**

### Goal

Add a pure/local **release-readiness rollup** that summarizes current MVP readiness
from already-existing local signals — version, test count/profile, the smoke-harness
family (Nostr read health, gateway-travel smoke, update-flow smoke, host-route
smoke), the release-metadata safety floor, and docs/handoff status — and surfaces an
`mvpPct` percentage, a READY/NEAR/ATTENTION status, and the next safest task. The
rollup lets the user understand MVP percentage/status and next actions without
manual digging.

**This changes nothing the app does at runtime** and reaches no server/DNS/SSH/
network — it only composes the already-shipped pure readiness modules into one
fail-fast, read-only report.

### What landed

**`src/engine/status/mvpReadiness.js`** — PURE node-safe rollup modeled on
`updateFlowSmoke.js`/`readHealth.js` (no THREE/Rapier/`window`/`location`/fs/
`child_process`/network/socket/signing/publishing; never throws; renders and acts on
nothing).

- `MVP_READINESS_VERSION` = 1
- `MVP_READINESS_BADGE` = `'MVP READINESS ROLLUP · READ-ONLY · NO DEPLOY'`
- Frozen curated defaults injected via opts to keep the module pure:
  - `DEFAULT_TEST_STATUS` = `{passing:1228, files:77, profile:'full', ok:true}`
  - `DEFAULT_VPS_DRY_RUN` = `{ok:true, detail}`
  - `DEFAULT_DOCS_STATUS` = `{ok:true, detail}`
  - `NEXT_SAFE_TASK` = `{title, why, kind:'infra'}`
- `runMvpReadiness(opts?)` composes the already-pure harnesses (`runReadHealth`,
  `runGatewayTravelSmoke`, `runUpdateFlowSmoke`, `runHostRouteSmoke`) plus the
  release-metadata guards over **nine read-only signals**:
  1. `version-marker` — `VERSION` pinned to the current alpha
  2. `nostr-read-health` — folds `runReadHealth()` ok verdict
  3. `gateway-travel-smoke` — folds `runGatewayTravelSmoke()` ok verdict
  4. `update-flow-smoke` — folds `runUpdateFlowSmoke()` ok verdict
  5. `host-route-smoke` — folds `runHostRouteSmoke()` ok verdict
  6. `release-metadata-floor` — `buildReleaseMeta`/`validateReleaseMeta` safety floor
  7. `test-suite` — injected test count/profile (curated default)
  8. `vps-dry-run` — injected `npm run vps:dry-run` verdict (curated default)
  9. `docs-handoff` — injected docs/handoff freshness (curated default)

  Returns `{ version, badge, ok, mvpPct, status, currentVersion, signals,
  summary:{total,ok,fail}, safety, reasons, nextSafeTask:{title,why,kind},
  rendered:false, actionable:false }`. `mvpPct = round(okCount/total*100)`;
  `status` = READY (0 fail) / NEAR (1 fail) / ATTENTION (≥2 fail). Fixtures are
  injectable via `opts.tests`/`opts.vpsDryRun`/`opts.docs`/`opts.nextSafeTask`; a
  broken fixture degrades to a failed signal with concrete `reasons` (never throws,
  safety flags still all false).
- `formatMvpReadiness(result)` — one stable text block (badge + `MVP X% · STATUS ·
  version` + verdict + ✓/✗ signal lines + reasons + next safe task); safe on null.

Composes ONLY the already-shipped pure modules — surfaces NO serve/deploy/publish/
upload/fetch/write/navigate/exec/spawn/run/ssh/connect method of its own.

### Wiring (debug/SDK only — no game behavior change)

- **SDK** `src/sdk/index.js`: `export * as mvpReadiness` + `SDK_SURFACE` entry at
  `STABILITY.EXPERIMENTAL`.
- **Debug shell** `src/engine/debug/shellReport.js`: `mvpReadinessReport(opts)`
  added to `buildShellReport()`.
- **`src/engine/debug/toriiDebug.js`**: `ToriiDebug.shells.mvpReadiness(opts)`.

### Tests

- New: `tests/mvp-readiness-rollup.test.js` — **+14 tests** covering constants
  (version/badge/frozen defaults), all-green 9/9, the exact sorted signal-key array,
  `mvpPct=100`/READY, safety flags all false + `rendered`/`actionable` false,
  next-safe-task infra, injected failing test status → NEAR + reasons, two fails →
  ATTENTION, docs + nextSafeTask overrides, null/garbled opts safe, garbled fixture
  falls back to default, and `formatMvpReadiness` rendering the badge/`MVP 100%`/
  verdict/9-9/next safe task and safe on null.
- Full suite after the slice: **1228 passing / 77 files**.

### Version bump (v0.2.197-alpha → v0.2.198-alpha)

`package.json`, `src/config.js`, `index.html` (×2), `tools/regression-check.mjs`
(EXPECTED_VERSION + stale guard), `src/engine/dashboard/continuumData.js`
(CONTINUUM_VERSION + metrics rows + active/completed entries),
`public/release-metadata.json` (regenerated), continuum artifacts rebuilt, dist rebuilt.

### Docs updated

`todo.md` (HARD-13 row), `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`,
`SDK_DEBUG_INDEX.md` (mvpReadiness namespace block + `shells.mvpReadiness` row).

### Security-sensitive behavior

**None changed.** The rollup is read-only; it injects no transport and reaches no
server, so it cannot serve, deploy, navigate, fetch, sign, publish, or write. It
composes only the already-shipped pure harnesses and reflects, never mutates,
readiness state. `godMode` remains `false`. No new `setTimeout`, no new
`Vector3`/`Matrix4` in hot paths. No gameplay/physics/shooter/Rapier/Nostr signing/
Nostr publishing/live network write/server/DNS/SSH/updater change.

### Verification

- `tests/mvp-readiness-rollup.test.js` — pass (14).
- Full vitest suite — 1228 passing / 77 files.
- `npm run check` / `npm run test:release` — see commit output.

### Blockers / warnings

- Standing advisory (never gated): `rapier-*.js` chunk > 700 KB.
- The fs-backed signals (test count, VPS dry-run, docs/handoff freshness) ship as
  curated frozen defaults injectable via opts — a build/CLI step can feed live values
  later. This preserves module purity; the defaults reflect the last-known local
  verdicts at this slice.

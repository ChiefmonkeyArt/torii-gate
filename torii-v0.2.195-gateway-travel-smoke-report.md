# Torii Quest — v0.2.195-alpha Release Report

## Slice: Gateway Travel Smoke Harness

**Type:** infrastructure / testing / tooling. **No runtime behavior change.**

### Goal

Add local/non-network smoke coverage for the gateway travel-flow contracts so
future portal/travel feature work can be regression-checked without a browser,
router, or network. Focus on the portal/travel boundaries already shipped:
trigger arming, same-origin route safety, `/zone/<slug>` route handling,
consent/confirm boundaries, no external URLs, and no automatic travel/write.

### What landed

**`src/engine/gateway/travelSmoke.js`** — PURE node-safe smoke harness (no
THREE/Rapier/`window`/`location`/relay I/O/socket/signing/publishing/NIP-07/fs/
network; never throws).

- `TRAVEL_SMOKE_VERSION` = 1
- `TRAVEL_SMOKE_BADGE` = `'GATEWAY TRAVEL SMOKE · READ-ONLY · DRY-RUN'`
- `HOSTILE_ROUTES` — frozen 7-entry fixture of hostile route strings
  (external `https://…`, protocol-relative `//evil`, `javascript:`, `data:`,
  backslash, dot-dot traversal, percent-encoded) the boundary must refuse.
- `demoGatewayComponent()` — deterministic in-memory gateway component.
- `runGatewayTravelSmoke(opts?)` — drives `createGatewayPortalBoundary({ dryRun: true })`
  with **NO injected transport** (so even a confirmed `confirm()` navigates nothing)
  through **ten read-only signals**:
  1. trigger arms on proximity
  2. proximity ALONE never navigates
  3. explicit confirm required to act
  4. same-origin `/zone/<slug>` route shape only
  5. route allowlist scoped, can never be `['/']` (folds to `['/zone/']`)
  6. a valid `/zone/<slug>` resolves
  7. `HOSTILE_ROUTES` fixture all rejected as INVALID
  8. no external gateway `website` carried into the hop
  9. consent gates travel (no grant → blocked; grant → allowed, never performed)
  10. no auto travel/write — every report pins
      `navigated/performed/external/signed/published/network = false`

  Returns `{ ok, badge, summary, signals, safety, reasons, rendered:false, actionable:false }`.
  A broken component degrades to `ok:false` with concrete `reasons` (never throws).
- `formatGatewayTravelSmoke(result)` — one stable text block.
- Re-exports `DEFAULT_PORTAL_ALLOWLIST`.

Composes ONLY the already-shipped pure gateway modules — surfaces NO
navigate/open/sign/publish/connect method of its own.

### Wiring (debug/SDK only — no game behavior change)

- **SDK** `src/sdk/index.js`: `export * as travelSmoke` + `SDK_SURFACE` entry at
  `STABILITY.EXPERIMENTAL`.
- **Debug shell** `src/engine/debug/shellReport.js`: `travelSmokeReport(opts)`
  added to `buildShellReport()` (the 4-surface `shellsSummary` list unchanged).
- **`src/engine/debug/toriiDebug.js`**: `ToriiDebug.shells.travelSmoke(opts)`.

### Tests

- New: `tests/gateway-travel-smoke.test.js` — **+12 tests** covering constants,
  `demoGatewayComponent`, all ten signal keys, safety flags all false,
  hostile-route rejection, consent gating, broken-component → `ok:false` without
  throwing, no-arg/degraded opts safe, and `formatGatewayTravelSmoke` safe on null.
- Full suite after the slice: **1180 passing / 74 files**.

### Version bump (v0.2.194-alpha → v0.2.195-alpha)

`package.json`, `src/config.js`, `index.html` (×2), `tools/regression-check.mjs`
(EXPECTED_VERSION + stale guard), `src/engine/dashboard/continuumData.js`
(CONTINUUM_VERSION + metrics rows + active/completed entries),
`public/release-metadata.json` (regenerated), continuum artifacts rebuilt, dist rebuilt.

### Docs updated

`todo.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`,
`GATEWAY_PROTOCOL.md` (smoke harness documented as the executable record of the
travel-flow safety invariants).

### Security-sensitive behavior

**None changed.** The harness is read-only and dry-run; it injects no transport,
so it cannot navigate. The shipped safety model is unchanged: proximity ARMS,
explicit confirm ACTS, same-origin `/zone/` only, consent-gated, external URLs
dropped. `godMode` remains `false`. No new `setTimeout`, no new `Vector3`/`Matrix4`
in hot paths. No gameplay/physics/shooter/Rapier/Nostr signing/Nostr publishing/
live network write change.

### Verification

- `tests/gateway-travel-smoke.test.js` — pass (12).
- Full vitest suite — 1180 passing / 74 files.
- `npm run check` — see commit output.

### Blockers / warnings

- Standing advisory (never gated): `rapier-*.js` chunk > 700 KB.
- Hard-refresh deep-link resolution of `/zone/*` still requires a static-host SPA
  fallback (documented, not faked in code) — unchanged by this slice.
</content>
</invoke>

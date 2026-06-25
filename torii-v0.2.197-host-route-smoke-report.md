# Torii Quest — v0.2.197-alpha Release Report

## Slice: Host Route + Asset Smoke Harness

**Type:** infrastructure / testing / tooling. **No runtime behavior change.**

### Goal

Add pure/local/non-network smoke coverage for torii.quest **static-hosting
readiness**, so future VPS/static-host work can be regression-checked locally
without a server, shell, DNS, SSH, remote command, or network. Pins the contracts
already shipped across the deployment-readiness modules: the published `dist/` root
`index.html`, the `DIST_SPEC` artifacts, the `/continuum.html` dashboard asset, the
`release-metadata.json` update asset, and — crucially — the `/zone/<slug>` SPA
fallback split: the **host config serves `index.html`** for an unknown
`/zone/<slug>`, while the **app route parser keeps the slug safe** once the page
loads. No server-side runtime is needed.

**This is NOT a VPS deployment** and touches no real server/DNS/SSH/remote
command/network — it only makes the static-host route + asset contracts checkable.

### What landed

**`src/engine/host/hostRouteSmoke.js`** — PURE node-safe smoke harness in a new
`src/engine/host/` concern directory (no THREE/Rapier/`window`/`location`/fs/
`child_process`/network/socket/signing/publishing; never throws; renders and acts on
nothing).

- `HOST_ROUTE_SMOKE_VERSION` = 1
- `HOST_ROUTE_SMOKE_BADGE` = `'HOST ROUTE SMOKE · READ-ONLY · NO DEPLOY'`
- `REQUIRED_ASSETS` = `['index.html','continuum.html','continuum-data.json','release-metadata.json']`
- `SAMPLE_DIST_PATHS` — frozen Vite-build-shape path list (index.html, assets/*.js,
  continuum.html, continuum-data.json, release-metadata.json, sw.js).
- `SAMPLE_FALLBACK_DOCS` — frozen `{VPS_INSTALL.md, HANDOFF.md}` carrying the
  `try_files … /index.html` + `/zone/` fallback text.
- `SAMPLE_ZONE_SLUG` = `'plebeian-market-bazaar'`.
- `HOSTILE_ZONE_PATHS` — frozen 8-entry set (absolute scheme, protocol-relative,
  dot-dot, sub-path, uppercase+underscore, empty slug, percent-encoding,
  `javascript:`) the route parser must reject as INVALID.
- `runHostRouteSmoke(opts?)` — composes the already-pure readiness helpers
  (`zoneFallbackReadiness`, the v0.2.182 `/zone/<slug>` route parser, and the
  v0.2.192 release-metadata guards) over the frozen fixtures through **ten
  read-only signals**:
  1. `root-index-present` — root `index.html` present in the built path set
  2. `expected-artifacts-present` — `DIST_SPEC` artifacts (index.html + assets)
  3. `dashboard-asset-present` — the `/continuum.html` dashboard asset
  4. `update-asset-present` — `release-metadata.json` present + manual-only
  5. `required-files-documented` — the `REQUIRED_FILES` floor intact
  6. `zone-fallback-documented` — `/zone/*` SPA fallback documented in the docs
  7. `no-zone-shadow` — no built file shadows the `/zone/<slug>` fallback
  8. `unknown-zone-served-index` — unknown `/zone/<slug>` → `index.html` (NOT a
     built file)
  9. `zone-slug-kept-safe` — parser resolves a good slug to a `ZONE` route and
     rejects the whole `HOSTILE_ZONE_PATHS` fixture as INVALID
  10. `no-host-side-action` — no serve/deploy/fetch action; every report pins
      `served/deployed/navigated/performed/external/network/wrote/fetched = false`

  Returns `{ version, badge, ok, signals, summary, safety, reasons, rendered:false, actionable:false }`.
  Fixtures are injectable via `opts.distPaths`/`opts.fallbackDocs`/`opts.zoneSlug`/
  `opts.hostile`; a broken fixture degrades to `ok:false` with concrete `reasons`
  (never throws, safety flags still all false).
- `formatHostRouteSmoke(result)` — one stable text block; safe on null.

Composes ONLY the already-shipped pure readiness modules — surfaces NO
serve/deploy/publish/upload/fetch/write/navigate/exec/spawn/run/ssh/connect method
of its own.

### Wiring (debug/SDK only — no game behavior change)

- **SDK** `src/sdk/index.js`: `export * as hostRouteSmoke` + `SDK_SURFACE` entry at
  `STABILITY.EXPERIMENTAL`.
- **Debug shell** `src/engine/debug/shellReport.js`: `hostRouteSmokeReport(opts)`
  added to `buildShellReport()`.
- **`src/engine/debug/toriiDebug.js`**: `ToriiDebug.shells.hostRouteSmoke(opts)`.

### Tests

- New: `tests/host-route-smoke.test.js` — **+17 tests** covering constants, frozen
  fixtures, all-green 10/10, the exact sorted signal-key array, safety flags all
  false, root-index/dashboard/release-metadata asset presence (manual-only),
  unknown-zone → index (`builtFile:false`, kind `zone`), slug kept safe, the broken
  fixtures (a shadowing `zone/<slug>.html` → `no-zone-shadow` fail; a path set with
  no root index → `ok:false`; docs with no fallback → `zone-fallback-documented`
  fail; a hostile zone slug → `ok:false`), no-arg/degraded opts safe, and
  `formatHostRouteSmoke` rendering the badge/verdict/10 and safe on null.
- Full suite after the slice: **1214 passing / 76 files**.

### Version bump (v0.2.196-alpha → v0.2.197-alpha)

`package.json`, `src/config.js`, `index.html` (×2), `tools/regression-check.mjs`
(EXPECTED_VERSION + stale guard), `src/engine/dashboard/continuumData.js`
(CONTINUUM_VERSION + metrics rows + active/completed entries),
`public/release-metadata.json` (regenerated), continuum artifacts rebuilt, dist rebuilt.

### Docs updated

`todo.md` (HARD-12 row), `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`,
`SDK_DEBUG_INDEX.md`, `VPS_INSTALL.md` (§15 — the host route + asset smoke contracts
tied to the manual-deploy story), `ZONE_FALLBACK_READINESS.md` (§6 — the harness
documented as the end-to-end record of the `/zone/*` fallback split).

### Security-sensitive behavior

**None changed.** The harness is read-only; it injects no transport and reaches no
server, so it cannot serve, deploy, navigate, fetch, or write. The shipped safety
model is unchanged: configuring the real static host stays the manual maintainer
step (`VPS_INSTALL.md` §6/§11), the host serves `index.html` for unknown
`/zone/<slug>` paths, and the app's route parser keeps each slug safe. `godMode`
remains `false`. No new `setTimeout`, no new `Vector3`/`Matrix4` in hot paths. No
gameplay/physics/shooter/Rapier/Nostr signing/Nostr publishing/live network write
change.

### Verification

- `tests/host-route-smoke.test.js` — pass (17).
- Full vitest suite — 1214 passing / 76 files.
- `npm run check` / `npm run test:release` — see commit output.

### Blockers / warnings

- Standing advisory (never gated): `rapier-*.js` chunk > 700 KB.
- Configuring the real static-host SPA fallback for `/zone/*` remains a manual
  maintainer step (`VPS_INSTALL.md` §6/§11, `ZONE_FALLBACK_READINESS.md`) — this
  repo touches no server and this slice changes nothing the app does at runtime.

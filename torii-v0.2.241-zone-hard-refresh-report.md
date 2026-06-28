# Torii Quest — v0.2.241-alpha · Zone hard-refresh / deep-link fix

**Verdict: SHIP** (local release gate `npm run test:release` ALL GREEN; 1682 passing / 102 files; regression 15/15; bundle advisory only.)

> Scope: a focused, no-backend fix for hard-refresh / deep-link of in-app `/zone/<slug>`
> routes on static published hosting. Game slice. No deploy/publish/push performed — the
> parent agent handles security review, deploy, live smoke, and playtest.

---

## 1. Summary

On the live host (`torii-quest.pplx.app`), entering the arena and hopping a portal works,
but a **hard-refresh or shared deep-link** of a zone route such as
`/zone/plebeian-market-bazaar` returned a static-host JSON 404:

```json
{"detail":"No static asset at /zone/plebeian-market-bazaar. If this is a backend API call, prefix the path with /port/5000/ — backend ports are not auto-routed."}
```

v0.2.241 makes any intended in-app zone route load the app shell on a cold hit **without
adding a backend**, by generating byte-identical static shells at
`dist/zone/<slug>/index.html` for every deployable zone slug at build time. The existing
client-side `_applyZoneRoute()` then resolves the slug exactly as on an in-app portal hop.

---

## 2. Root cause

- The game is a single-page app served from one `dist/index.html`. Client-side route
  support (`zoneRoute` parser + `_applyZoneRoute()` reading `window.location.pathname`) has
  shipped since v0.2.182, but it only runs **after the JS bundle loads**.
- The published host serves by **EXACT path**, has **no SPA rewrite** capability, and offers
  **no backend** (backend ports require an unused `/port/5000/` prefix). A `try_files …
  /index.html` rule (documented for self-hosted Caddy/Nginx) is therefore unavailable there.
- On a cold hit to `/zone/<slug>` the host looked for a file at that exact path, found none,
  and returned its JSON 404 **before** the bundle (which would have parsed the slug) loaded.
  There was no on-disk shell at `dist/zone/<slug>/index.html` to serve.

## 3. Fix (no backend, static-host compatible)

Make the exact path a real file. The build copies the freshly built `dist/index.html`
**byte-for-byte** to `dist/zone/<slug>/index.html` for every `DEPLOYABLE_ZONE_SLUGS` entry
(directory-index convention). `dist/index.html` references its bundle with **root-absolute**
asset URLs (`/assets/…`), so a subdirectory shell loads the same JS/CSS; the app boots and
`_applyZoneRoute()` shows the inert zone notice — identical to an in-app hop.

- **Single source of truth:** `DEPLOYABLE_ZONE_SLUGS` (frozen) in
  `src/engine/gateway/zoneRoute.js` — currently `['plebeian-market-bazaar']`.
- **Pure planner:** `tools/zoneShells.mjs` — `zoneShellPathFor(slug)` →
  `zone/<slug>/index.html` or `null` (never an unsafe path); `zoneShellRouteFor(slug)`;
  `planZoneShells(slugs)` de-dupes, flags invalid/duplicate, never throws.
- **fs generator:** `tools/generate-zone-shells.mjs` (`npm run zones:shells`, folded into
  `npm run build` after `vite build`) reads `dist/index.html` and writes each shell into
  `dist/` only (exits 1 if no build present).
- **Readiness guard reconciled:** `tools/zoneFallbackReadiness.mjs` `isVerifiedZoneShell`
  ALLOWS a `/zone/<slug>/index.html` shell ONLY when its content is byte-identical to
  `dist/index.html`; any other / non-identical `/zone/*` file still FAILS as a fallback
  shadow. Regression `[15]` and `tools/zone-fallback-check.mjs` feed it the shell contents.

To add a deep-linkable zone later: add the slug to `DEPLOYABLE_ZONE_SLUGS` and rebuild.

## 4. Files changed

Source / tooling:
- `src/engine/gateway/zoneRoute.js` — added frozen `DEPLOYABLE_ZONE_SLUGS`.
- `tools/zoneShells.mjs` — NEW pure planner.
- `tools/generate-zone-shells.mjs` — NEW fs CLI (build step).
- `tools/zoneFallbackReadiness.mjs` — `isVerifiedZoneShell` + verified-shell allowance.
- `tools/zone-fallback-check.mjs` — passes shell contents to the readiness check.
- `tools/regression-check.mjs` — `EXPECTED_VERSION` v0.2.241-alpha; `[15]` feeds shell contents.
- `tools/build-continuum.mjs` — packaging-time readiness now feeds the same shell `contents`
  map to `checkZoneFallbackReadiness`, so the dashboard reports READY (not a false zone-fallback
  FAIL) when verified per-zone shells are present in `dist/`.
- `package.json` — version 0.2.241-alpha; `build` includes the generator; `zones:shells` script.

Tests:
- `tests/zone-hard-refresh.test.js` — NEW (+8): slug list, pure planner, built-shell byte-identity.
- `tests/zone-fallback-readiness.test.js` — extended (+4): verified-shell allow / shadow-fail.

Version markers + curated state:
- `src/config.js`, `public/sw.js` (`CACHE_VERSION`), `index.html` (×2), `MVP_APPROVAL_STATE.json`,
  `tests/continuum-dashboard.test.js` (4 pins), `src/engine/dashboard/continuumData.js`
  (`CONTINUUM_VERSION`, `CURRENT_TEST_STATUS` 1682/102, source/active-slice prose),
  `src/engine/status/mvpReadiness.js` (`DEFAULT_TEST_STATUS` 1682/102), `NEXT_ACTION_STATE.json`
  (regenerated).

Docs:
- `HANDOFF.md`, `todo.md` (HARD-55), `progress.md`, `SDK_DEBUG_INDEX.md`, `CODE_INDEX.md`,
  `ZONE_FALLBACK_READINESS.md` (new §7 static-shell strategy; §1/§3/§4/§5 reconciled).

## 5. Tests / gate

- `npm run test:release` (build → vitest → check → bundle:report → handoff:status): **ALL GREEN**.
- Vitest: **1682 passing / 102 files**.
- Regression check: **15/15 GREEN** (incl. `[14]` docConsistency for v0.2.241-alpha and `[15]`
  zone fallback readiness with verified shells).
- Build generated `dist/zone/plebeian-market-bazaar/index.html` byte-identical to `dist/index.html`.
- Bundle: advisory only (rapier chunk > 700 KB, expected/tracked — not gated).

## 6. Preserved constraints

godMode false; no new `setTimeout` (only the allowed nostr.js WS close + hud.js kill-feed); no
new hot-path `Vector3`/`Matrix4`; debug tools ship unconditionally; ESC pause unchanged;
panel-locked cursor click never fires weapon; root entry flow intact; v0.2.240 SW fail-soft
per-asset precache fix untouched (zone shells are HTML → network-first); v0.2.236 login
decoupling and v0.2.238 fail-closed loop intact. No deploy/publish/push/upload performed.

## 7. Verdict

**SHIP** — the regression is fixed without a backend, the cold deep-link now resolves to the app
shell on an exact-path static host, the fix is covered by tests, and the local release gate is
fully green. MVP approval remains a separate explicit human gate (live-browser playtest); this
slice grants none.

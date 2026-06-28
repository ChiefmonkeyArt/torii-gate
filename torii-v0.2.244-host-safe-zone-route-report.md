# Torii Quest — v0.2.244-alpha · Host-Safe Canonical Zone Route

**Verdict: SHIP (local gates green) — pending the human live-browser playtest + explicit MVP approval.**
No deploy / publish / push / tag performed. `godMode` stays `false`.

---

## 1. Root cause

The v0.2.243 fix shipped a trailing-slash directory-index shell (`dist/zone/<slug>/index.html`)
on the theory that the published host (`torii-quest.pplx.app`) would resolve a trailing-slash URL
onto its directory index the way it serves the root `/`. The follow-up live evidence disproved that:
the rendered screenshot of `https://torii-quest.pplx.app/zone/plebeian-market-bazaar/` **still**
returned the host JSON 404:

```
{"detail":"No static asset at /zone/plebeian-market-bazaar. If this is a backend API call,
prefix the path with /port/5000/ — backend ports are not auto-routed."}
```

So the published host:

- serves by **EXACT static-asset path** only;
- has **no SPA rewrite** (no `try_files … /index.html`);
- has **no directory-index resolution** — a trailing-slash URL is *not* mapped onto a nested
  `index.html`;
- normalises **both** `/zone/<slug>` **and** `/zone/<slug>/` to the same exact-asset lookup → 404;
- infers Content-Type from the file **extension** (an extensionless exact-path file → `application/octet-stream` → the browser *downloads* it; that was the v0.2.242 failure).

Every `/zone/*` **PATH** strategy is therefore non-viable on this host without backend / rewrite /
content-type control, which we do not have. The **only** path that reliably serves `index.html` as
`text/html` is the **root `/`**.

## 2. Decision — hash fragment, and why (not query)

Canonical zone route is now the **URL fragment**: `/#/zone/<slug>` (e.g.
`https://torii-quest.pplx.app/#/zone/plebeian-market-bazaar`).

Hash chosen over `?zone=<slug>` query for three concrete reasons:

1. **Maximal host robustness.** A URL fragment is *never sent to the server*, so the request path
   is unambiguously `/` → the host serves `index.html` as `text/html` and the root shell always
   renders on a hard refresh. A query string (`/?zone=…`) is also served from `/` here, but it is
   *sent* to the server and depends on the host ignoring unknown query params on the exact-path
   lookup — an extra assumption this quirky host has already shown it can violate.
2. **Simplest parser reuse.** The fragment payload, with `#` stripped, **is** a `/zone/<slug>`
   string — it flows straight through the existing `safeRoutePath` + slug parser with no new
   grammar.
3. **No SW cache fragmentation.** The fragment leaves the request URL as `/`, so the service
   worker cache key stays `/` (a `?zone=` query would mint a distinct cache entry per zone).

`safeRoutePath` already accepts `/#/zone/<slug>` (its `UNSAFE_ROUTE` set excludes `#`/`?`/`=`,
requires `raw[0]==='/'` and `raw[1]!=='/'`, and rejects `..`, `%`, whitespace, markup, control
chars across the *whole* raw string before any fragment re-anchoring), and the allowlist prefix
`/#/zone/` (length 8, starts `/`, never `'/'`) qualifies as a meaningful scoped prefix.

The legacy `/zone/<slug>` **path** form is still *parsed* client-side (normalised to the canonical
`/#/zone/<slug>` route) so an in-app legacy hop or a typed bare path resolves once the bundle has
loaded — but it is **NON-CANONICAL** on this host (a cold deep-link 404s before the bundle loads),
so it is never generated or shared. No per-slug static shell is generated any more.

## 3. Files changed

### Engine / app
- `src/engine/gateway/zoneRoute.js` — new `ZONE_CANONICAL_PREFIX = '/#/zone/'`; `zoneRouteFor` and
  `DEMO_ZONE_ROUTE` build the hash route; `parseZoneRoute` extracts the fragment (empty `#` → home)
  and still accepts the legacy `/zone/<slug>` + tolerated trailing slash, reporting the canonical
  hash form as `route`; header + `DEPLOYABLE_ZONE_SLUGS` docs rewritten for the no-shell model.
- `src/engine/gateway/handoffPlan.js` — `handoffRouteFor` → `/#/zone/<slug>` (inlined literal to
  avoid the `zoneRoute ↔ handoffPlan` circular import). `safeRoutePath` unchanged.
- `src/main.js` — allowlist `['/#/zone/']`; `hostContext` current/rollback route now
  `pathname + hash`; `_applyZoneRoute` reads the URL hash fragment (falls back to the path for a
  legacy link); added a `hashchange` listener alongside `popstate`.
- `src/engine/gateway/hostTransport.js` — `getRoute` now returns `pathname + search + hash`.
- `src/engine/gateway/gatewayPortalActivation.js` — `DEFAULT_PORTAL_ALLOWLIST = ['/#/zone/']`.
- `src/engine/gateway/gatewayActivation.js` — demo `routeAllowlist = ['/#/zone/']`.
- `src/engine/debug/shellReport.js` — `routeAllowlist: ['/#/zone/']`.
- `src/engine/gateway/travelSmoke.js` — canonical-prefix aware (signals 4/6 + labels).
- `src/engine/gateway/zoneLabel.js` — strips `ZONE_CANONICAL_PREFIX` then legacy prefix.

### Build / tooling
- `package.json` — version `0.2.244-alpha`; removed `zones:shells` script; build no longer runs
  `generate-zone-shells`.
- Deleted `tools/generate-zone-shells.mjs`, `tools/zoneShells.mjs`.
- `tools/regression-check.mjs` — `EXPECTED_VERSION = 'v0.2.244-alpha'`. ([15] readiness logic
  untouched — passes trivially now that zero shells ship; the documented `index.html` SPA-fallback
  remains valid for any non-pplx host.)

### Version markers
- `src/config.js` (`VERSION`), `public/sw.js` (`CACHE_VERSION = tq-v0.2.244-alpha`),
  `index.html` (both labels), `MVP_APPROVAL_STATE.json`,
  `src/engine/dashboard/continuumData.js` (`CONTINUUM_VERSION`, Source-version metric, Active-slice
  narrative), `src/engine/status/mvpReadiness.js` + `continuumData.js` test counts.
- `NEXT_ACTION_STATE.json` regenerated via `tools/next-action-state.mjs --write`.

### Tests
- Rewrote `tests/zone-hard-refresh.test.js` for the hash-canonical + no-shell model (canonical
  `/#/zone/<slug>` whose request path is `/`; legacy path still parses; built dist ships **no**
  `/zone/*`).
- Updated canonical-route / allowlist assertions in: `tests/zone-route.test.js`,
  `tests/handoff-plan.test.js`, `tests/gateway-activation.test.js`,
  `tests/gateway-portal-activation.test.js`, `tests/portal-trigger.test.js`,
  `tests/handoff-execute.test.js`, `tests/host-transport.test.js`,
  `tests/gateway-travel-smoke.test.js`, `tests/continuum-dashboard.test.js` (version bump),
  `tests/next-action-state.test.js` (passes after regen).

### Docs
- `progress.md`, `todo.md` (new HARD-58 row; HARD-57 marked superseded), `HANDOFF.md`
  (v0.2.244 block + current-version line), `SDK_DEBUG_INDEX.md`, `CODE_INDEX.md`,
  `ZONE_FALLBACK_READINESS.md` (v0.2.244 note: `/zone/*` PATH non-viable on pplx.app;
  `/zone/<slug>` non-canonical; shells no longer generated; `index.html` fallback kept for other
  hosts).

## 4. Tests / gates

`npm run test:release` (= `vite build && vitest run && npm run check && npm run bundle:report && npm run handoff:status`):

- **Vitest: 1686 passing / 102 files** (0 failures).
- **Regression check: ALL GREEN (15/15).** Notably:
  - [5] version markers embed `v0.2.244-alpha` (config + index×2 + package + sw CACHE_VERSION).
  - [14] doc-consistency: `todo.md` / `progress.md` / `HANDOFF.md` reference the current version.
  - [15] `/zone/*` fallback readiness passes (zero shells; docs still document the `index.html`
    fallback for hosts that support it).
- godMode `false`; no new `setTimeout`/`setInterval`; no new hot-path `Vector3`/`Matrix4`.
- Built dist ships **no** `/zone/*` file; `index.html` is the sole shell.

## 5. Constraints honoured

Version bumped every deploy · `godMode` false · no new timers (only the pre-existing nostr.js WS
close + hud.js kill-feed) · no new hot-path `Vector3`/`Matrix4` · debug tools ship unconditionally ·
ESC pause unchanged · panel-locked cursor click never fires the weapon · no backend · v0.2.240 SW
fail-soft precache preserved (HTML network-first; root `/` is the cache key) · root entry flow +
ENTER ARENA preserved · **no deploy / publish / push / tag.**

## 6. Residual risk / follow-up

- The fix is structurally host-safe (request path is always `/`), so a hard refresh of
  `/#/zone/<slug>` must render. Confirm with a **live browser playtest** after the maintainer
  publishes: open `https://torii-quest.pplx.app/#/zone/plebeian-market-bazaar`, hard-refresh, and
  verify the app shell loads and the zone notice resolves (no JSON 404, no download).
- MVP approval stays **pending** — `MVP_APPROVAL_STATE.json` is unchanged; approval is an explicit
  human step.

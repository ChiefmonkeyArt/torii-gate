# Torii Quest — v0.2.179-alpha · LEAN-2 Gateway Route Hardening

**Slice:** LEAN-2 security-review follow-up — close the two WARNs from the v0.2.178
review *before* any live gateway-activation wiring.
**Status:** complete, full release gate green, committed locally only (no push/deploy/publish).

---

## 1. Why this slice

The v0.2.178 gateway-handoff activation review was **SAFE TO DEPLOY** but flagged two
hardening WARNs. The current attack surface is already closed (the planned `targetRoute`
is produced *internally* by `handoffRouteFor`/`_zoneSlug`, which only emit `[a-z0-9-]`),
but both paths must be hardened as defense-in-depth before a real host router/portal mesh
is wired at the gateway boundary. This slice does exactly that and nothing else.

## 2. WARN-1 — `safeRoutePath` rejects dot-dot + percent-encoding

`src/engine/gateway/handoffPlan.js`. Two raw-input checks were added to the same-origin
route validator:

- **Percent-encoding:** `%` is now part of the `UNSAFE_ROUTE` character class, so any
  percent-encoded route is rejected. Percent-encoding can smuggle a traversal/scheme past
  raw-char checks (e.g. `%2e%2e` = `..`, `%2f` = `/`), and an internally-built same-site
  route never needs it.
- **Dot-dot traversal:** a new `TRAVERSAL_ROUTE = /\.\./` regex rejects any path containing
  a `..` segment, which could otherwise climb out of an allowlisted prefix
  (e.g. `/zone/../admin`).

```js
const UNSAFE_ROUTE = /[\x00-\x1f\x7f<>"'`\\\s%]/;  // + %  (was: no %)
const TRAVERSAL_ROUTE = /\.\./;                     // new

export function safeRoutePath(raw) {
  if (typeof raw !== 'string') return null;
  if (raw.length === 0 || raw.length > ROUTE_MAX_LEN) return null;
  if (raw[0] !== '/' || raw[1] === '/') return null;
  if (UNSAFE_ROUTE.test(raw)) return null;
  if (TRAVERSAL_ROUTE.test(raw)) return null;       // new
  return raw;
}
```

Now rejected: `/zone/../admin`, `/zone/%2e%2e/admin`, `/zone/%2fadmin`, `/..`, `/a%20b`, …
Still accepted: `/zone/foo`, `/zone/nap-garden`, `/` — the existing safe behavior is
preserved (the slug builder only produces url-safe chars, so real routes are unaffected).
External preview URLs (`handoffUrlFor` → `safeProfileUrl`) are unaffected: they never flow
through `safeRoutePath`.

## 3. WARN-2 — `routeAllowlist` ignores trivially-permissive prefixes

`src/engine/gateway/gatewayActivation.js`. A 1-char prefix like `'/'` matches **every**
same-origin route, making an allowlist trivially permissive and giving a false sense of
restriction. `_routeAllowed` now only honours prefixes of length >=
`MIN_ALLOWLIST_PREFIX_LEN` (2):

```js
const MIN_ALLOWLIST_PREFIX_LEN = 2;

function _routeAllowed(route, allowlist) {
  if (!Array.isArray(allowlist) || allowlist.length === 0) return true; // no allowlist → any safe route
  if (typeof route !== 'string') return false;
  for (const prefix of allowlist) {
    if (typeof prefix === 'string' && prefix.length >= MIN_ALLOWLIST_PREFIX_LEN
      && route.startsWith(prefix)) return true;
  }
  return false;
}
```

Behavior:
- **No allowlist** (null / non-array / empty) → any safe same-origin route allowed
  (unchanged; `safeRoutePath` already constrains it).
- **`['/']` (or any all-short-prefix list)** → **fails CLOSED**: no meaningful prefix to
  match, so the route is rejected (`route-not-allowed`, status `BLOCKED`, no navigation).
  This is the safe reading of the WARN — a caller who *intended* to restrict but supplied a
  garbage prefix gets nothing allowed, rather than silently allowing everything.
- **`['/zone/']`** → unchanged; `/zone/foo` is still allowed.

## 4. Tests (+5)

- `tests/handoff-plan.test.js` (+3 cases in the `safeRoutePath` block):
  - dot-dot traversal rejected (`/zone/../admin`, `/..`, `/zone/..`, `/a/../../b`);
  - any percent-encoding rejected (`/zone/%2e%2e/admin`, `/zone/%2fadmin`, `/%00`, `/a%20b`);
  - plain safe `/zone/foo` still accepted after hardening.
- `tests/gateway-activation.test.js` (+2 cases in `route restrictions`):
  - `['/']` allowlist does NOT allow an arbitrary route (BLOCKED, `route-not-allowed`, no pushState);
  - `['/zone/']` allowlist still allows `/zone/foo` (NAVIGATED via recording host).
- The existing confirmed same-origin happy path (no allowlist / `['/zone/']`) still navigates.

## 5. Files changed

**Hardened**
- `src/engine/gateway/handoffPlan.js` — `safeRoutePath` + `UNSAFE_ROUTE`/`TRAVERSAL_ROUTE`.
- `src/engine/gateway/gatewayActivation.js` — `_routeAllowed` + `MIN_ALLOWLIST_PREFIX_LEN`.

**Tests**
- `tests/handoff-plan.test.js` (+3), `tests/gateway-activation.test.js` (+2).

**Version markers (bumped together → v0.2.179-alpha)**
- `src/config.js`, `package.json`, `index.html` (×2), `tools/regression-check.mjs`
  (header + `EXPECTED_VERSION` + stale-guard now flags v0.2.178),
  `src/engine/dashboard/continuumData.js` (`CONTINUUM_VERSION`, metrics, `HEALTH_LASTKNOWN.totalTests`
  866, active-now/completed-24h entries, active-slice text), `tests/continuum-dashboard.test.js` (×4).

**Docs**
- `todo.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`,
  `GATEWAY_PROTOCOL.md` — current-version lines + a v0.2.179 route-hardening note.
- `public/continuum.html` + `public/continuum-data.json` — regenerated via `build:continuum`.

## 6. Tests / timings

- `npm run test:fast` → 5 files / 74 tests passed (~4.7s).
- `npm run test:foundation` → 18 files / 270 tests passed (~11.7s).
- `npm run test:release` → **866 tests / 61 files passed**, regression-check **ALL GREEN
  (14/14)**, build + bundle advisory + handoff:status OK (~38s). Was 861/61 → +5.
- Bundle baseline unchanged: 2.9 MB raw / ~1023 KB gzip (rapier chunk >700 KB, tracked).

## 7. Safety / constraints preserved

- No new behavior beyond rejection: both changes only *narrow* what is accepted. The
  confirmed same-origin hop, consent gate, and injected-transport model are unchanged.
- godMode `false`; no new timers; no new `Vector3`/`Matrix4` allocations.
- No signing / NIP-07 / relay I/O / payments / auto-update; no external navigation /
  `window.open` / `eval`; the browser `window` is still injected, never reached at module scope.
- `external` / `worldReloaded` / `signed` / `published` / `network` stay pinned `false`.
- Still pre-SEC-2 for any LIVE relay-sourced destination — local/same-site route hardening only.

## 8. Recommended next task

Unchanged from v0.2.178: drive `gatewayActivation` from a **real injected host router** at
the gateway boundary (live app/browser window + a CSP-scoped, now-meaningful route allowlist
like `['/zone/']`), paired with the **in-world gateway portal mesh**, so a confirmed in-world
hop performs the live same-origin navigation. The signed/relay-mediated tier remains gated
behind **SEC-2** (`world/handoff.js`).

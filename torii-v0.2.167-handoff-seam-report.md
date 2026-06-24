# Torii Quest — v0.2.167-alpha — Host Travel Handoff Seam

## Goal

Add the **host-side travel handoff seam** for future gateway/NAP-to-NAP travel —
still inert by default. This defines the boundary that RECEIVES an allowed
`gateway:travel` intent (from v0.2.165 `prepareTravelIntent`) and produces a
**dry-run handoff plan + rollback plan**, WITHOUT performing any browser
navigation, world unload/reload, live network writes, signing, publishing,
NIP-07, key handling, payments, auto-update, or any irreversible action. This is
the final safe seam before v0.2.168 can implement a first controlled
local/same-site travel action.

## What shipped

### New module — `src/engine/gateway/handoffPlan.js` (pure, node-safe)

The host travel handoff seam. Consumes a `gateway:travel` intent plus an injected
host context and produces an INERT plan. No THREE/Rapier/DOM/network/WebSocket/fs;
the host route / `window.location` is **injected** via `hostContext` so the module
is fully node-testable and has no runtime browser dependency.

Exports:

- `HANDOFF_PLAN_VERSION = 1` — bumped when the plan shape changes.
- `HANDOFF_BADGE = 'HANDOFF · DRY-RUN · NO NAVIGATION'` — stamped on every plan.
- `HANDOFF_STATUS` (frozen) — `ready` / `blocked` / `invalid`.
- `HANDOFF_COMMANDS` (frozen) — the ordered FUTURE command names a host executor
  WOULD run (`preflight`, `snapshotState`, `unloadWorld`, `navigate`, `loadWorld`,
  `spawnPlayer`) as **strings only**. The module never invokes them and exposes no
  method by those names.
- `safeRoutePath(raw)` — a safe SAME-ORIGIN path fragment or `null`. Accepts only a
  string starting with a single `/` (rejects `//` protocol-relative, schemes,
  `javascript:`/`data:`, whitespace, control chars, markup, backslashes) within a
  256-char cap.
- `handoffRouteFor(destination)` — `/zone/<slug>` (url-safe slug) or `null`.
- `handoffUrlFor(destination)` — https-only external preview URL (via
  `profileRead.safeProfileUrl`) as an inert display string, or `null`.
- `summariseHandoff(input, grant, hostContext)` — one stable human-readable line.
- `planHandoff(input, grant, hostContext)` — the INERT dry-run plan (shape below).
- `DEMO_HANDOFF_INPUT` (frozen) — deterministic `nap-garden` sample for the debug
  shell only; not used by gameplay.

Plan shape returned by `planHandoff`:

```
{
  version, badge, action: 'gateway:travel',
  status: 'ready'|'blocked'|'invalid',
  ok: status === 'ready',
  reason, targetZoneId, targetRoute, targetUrl,
  currentRoute, rollbackRoute,
  preflight: [{ check, ok, detail }],   // consent-allowed, destination-valid,
                                        // target-route-safe, rollback-route-present,
                                        // inert-dry-run
  commands: HANDOFF_COMMANDS,           // future command names (never run)
  destination, consent, summary,
  dryRun: true, navigated: false, worldReloaded: false,
  performed: false, signed: false, published: false, readOnly: true,
  errors: [string],
}
```

Status precedence is **invalid > blocked > ready**: a malformed/unidentifiable
destination → `invalid`; a withheld/mismatched consent grant → `blocked`; only an
ALLOWED, matching `gateway:travel` intent over a VALID destination → `ready`. Even
when `ready`, the plan NEVER navigates — `ok:true` is proof of what a host COULD
execute next, not the act itself. Every route/url field is sanitised so a hostile
destination cannot inject a scheme or markup.

### Tests — `tests/handoff-plan.test.js` (21 tests)

Covers: module shape + frozen constants; `safeRoutePath` accept/reject
(protocol-relative, scheme, whitespace, control chars, markup, length cap);
`handoffRouteFor`/`handoffUrlFor` slug + https sanitisation; allowed-intent
dry-run `ready` plan; blocked grant → `blocked`; malformed destination →
`invalid`; route/url sanitisation in the plan; rollback-route presence; injected
`hostContext` currentRoute/rollbackRoute; `summariseHandoff`; the banned-name regex
(no navigate/goto/open/reload/unload/sign/publish method exposed); all safety flags
pinned; and SDK exposure (`SDK.handoffPlan`, `SDK_SURFACE.handoffPlan.tier ===
EXPERIMENTAL`).

### Wiring (report-only / dry-run surfaces)

- `src/sdk/index.js` — `export * as handoffPlan` + a `SDK_SURFACE.handoffPlan`
  entry at `STABILITY.EXPERIMENTAL`.
- `src/engine/debug/shellReport.js` — `handoffPlanReport(input, grant, hostContext)`
  mirrors the existing gateway report shapes; added to `buildShellReport` (overridable
  via `handoffInput`/`handoffGrant`/`handoffContext`, default `DEMO_HANDOFF_INPUT`).
  The locked 4-surface `shellsSummary` is **unchanged**.
- `src/engine/debug/toriiDebug.js` — `shells.handoffPlan(input, grant, hostContext)`.

### Version bump → v0.2.167-alpha

`src/config.js`, `package.json`, `index.html` (×2), `tools/regression-check.mjs`
(header, `EXPECTED_VERSION`, stale-guard now flags v0.2.166).

### Docs

`todo.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`
(namespace list, prose paragraph, shells table, namespace→test table), and
`GATEWAY_PROTOCOL.md` §10 (new `handoffPlan.js` code entry).

## Safety / constraint compliance

- godMode remains **false** (never deployed true).
- No new `setTimeout` (only existing allowed cases untouched).
- No new `Vector3`/`Matrix4` in hot paths — module is pure data.
- Comments use **"nostrich"**; "Chiefmonkey" spelling untouched.
- Debug tools ship unconditionally.
- ESC instant pause / panel-locked cursor: not touched, no regression.
- **No** browser navigation, world unload/reload, network writes, signing,
  publishing, NIP-07, key handling, payments, auto-update, or irreversible action.
  No `location.href`, `window.open`, router nav, history push, reload, `fetch`,
  WebSocket, sign/publish/send/connect/apply anywhere in the slice.
- Gameplay/shooter feel unchanged.

## Verification

| Command | Result |
|---|---|
| `npm run build` | ✓ built in ~2.9s; `torii-quest@0.2.167-alpha` |
| `npm test -- --run` | ✓ **717 passed / 55 files** (+21 new) |
| `npm run check` | ✓ **ALL GREEN** (14/14); continuity docs reference v0.2.167-alpha (5 doc(s) checked) |
| `npm run bundle:report` | ✓ total JS 2.9 MB raw / 1016.0 KB gzip (advisory rapier chunk, tracked/not gated) |
| `npm run handoff:status` | ✓ config + package.json in sync at v0.2.167-alpha |

## Next safe step (v0.2.168)

First controlled local/same-site travel that ACTS on a `ready` handoff plan —
executing the named `HANDOFF_COMMANDS` against an injected host transport, still
scoped to same-origin and behind the consent grant.

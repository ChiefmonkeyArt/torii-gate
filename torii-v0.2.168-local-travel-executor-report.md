# Torii Quest — v0.2.168-alpha · First local/same-origin gateway travel EXECUTOR

## Summary

v0.2.168-alpha adds the **first acting travel executor** in the gateway chain:
`src/engine/gateway/handoffExecute.js`. It consumes a v0.2.167 `status:'ready'`
dry-run handoff plan (`handoffPlan.js` / `planHandoff()`) and performs a SAFE
same-origin route change — but **only** through an explicitly injected host
transport, and **only** for a route string accepted by `safeRoutePath`. With no
transport it is a dry-run no-op. It never touches `window.location` /
`history.pushState` / `location.href` / `window.open` / `reload`, never executes the
external `targetUrl`, and never signs / publishes / writes the network / reloads the
world / uses a timer.

This is the last foundation step before REAL host transport wiring (a router/history
adapter) can be built in `world/handoff.js` — and that wiring remains deferred.

## Gateway travel chain (foundation, all node-safe)

```
gatewayRead (v0.2.164)  →  travelConfirm (v0.2.165, prepareTravelIntent)
  →  consentView (v0.2.166)  →  handoffPlan (v0.2.167, dry-run plan)
    →  handoffExecute (v0.2.168, FIRST acting executor)   ← THIS SLICE
```

## What shipped

### New module — `src/engine/gateway/handoffExecute.js` (pure, node-safe)

Exports:

- `EXECUTE_VERSION = 1`
- `EXECUTE_BADGE = 'TRAVEL · SAME-ORIGIN · HOST-TRANSPORT'`
- `EXECUTE_STATUS = { DONE:'done', NOOP:'no-op', BLOCKED:'blocked', FAILED:'failed', ROLLED_BACK:'rolled-back' }`
- `isHostTransport(t)` — true only for a non-array object with a `navigate` function
- `executeHandoff(plan, transport=null, opts={})`
- `executeHandoffFor(input={}, grant=null, transport=null, opts={})`

`executeHandoff` flow:

1. **validate-plan** — only a READY v0.2.167 plan (`action:'gateway:travel'`,
   `status:'ready'`, `ok:true`, `dryRun:true`) may act; anything else → `BLOCKED`
   `plan-not-ready`.
2. **validate-target-route** — `plan.targetRoute` is re-validated with `safeRoutePath`
   (defense in depth); failure → `BLOCKED` `unsafe-target-route`. The external
   `targetUrl` is **never** executed (preview-only, `external:false`).
3. **validate-transport** — no usable transport, or `opts.dryRun`, → safe `NO-OP`
   (`no-transport` / `dry-run`), performing nothing.
4. optional **snapshot** — `transport.snapshot()` if present (best-effort).
5. **navigate** — `transport.navigate(targetRoute)` called ONCE inside try/catch; a
   thrown error OR a `false` return is a failure. Success → `DONE` / `ok:true` /
   `navigated:true` / `performed:true` / reason `navigated`.
6. on failure → a SINGLE synchronous **rollback** (no timers) via
   `transport.rollback(rollbackRoute)` when present → `ROLLED_BACK` if it succeeds,
   else `FAILED`; `rollback:{attempted,ok,route}` recorded, rollback throws captured
   in `errors`.

Safety flags `external:false`, `worldReloaded:false`, `signed:false`,
`published:false`, `network:false` are **pinned last** in `_report()`, so a tampered
or sneaky plan can never flip them. `navigated` / `performed` are true ONLY when the
injected navigate actually succeeded.

### Tests — `tests/handoff-execute.test.js` (19 tests)

Covers: module shape; `isHostTransport`; no-op with no transport / forced dry-run;
blocked on non-ready / invalid / tampered-unsafe `targetRoute`; never throws; DONE
path (navigate called once with `/zone/nap-garden`, snapshot once); external
`targetUrl` present but never executed; `executeHandoffFor`; navigate-throw →
rolled-back; navigate-`false` → rolled-back; rollback-throw → FAILED; no rollback
transport → FAILED; safety flags pinned; sneaky plan cannot flip a pinned flag; no
bare-navigation method on the export surface; SDK exposure + EXPERIMENTAL tier.

### Wiring

- `src/sdk/index.js` — `export * as handoffExecute` + `SDK_SURFACE` entry at
  `EXPERIMENTAL`.
- `src/engine/debug/shellReport.js` — `handoffExecuteReport(...)` added to
  `buildShellReport` (default injects NO transport → dry-run no-op). `shellsSummary`
  (4 proof surfaces) NOT touched.
- `src/engine/debug/toriiDebug.js` — `shells.handoffExecute(input?,grant?,transport?,opts?)`.

### Version bump (v0.2.167-alpha → v0.2.168-alpha)

`src/config.js`, `package.json`, `index.html` (×2), `tools/regression-check.mjs`
(header + `EXPECTED_VERSION` + stale-guard).

### Docs

`todo.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`,
`GATEWAY_PROTOCOL.md` (§10), and this report.

## Safety / constraint compliance

- godMode remains `false` — never deployed true.
- No new `setTimeout` (rollback is a single synchronous call — no timers).
- No new `Vector3`/`Matrix4` in hot paths (module is pure data).
- No external/browser navigation, live network writes, signing, NIP-07, key
  handling, payments, auto-update, world reload, or irreversible actions.
- Comments use "nostrich"; "Chiefmonkey" spelling untouched.
- Debug tools ship unconditionally; default debug shell stays no-op (no transport).
- ESC pause / panel-locked cursor behaviour untouched (no main-loop/input changes).
- No gameplay/shooter-feel changes.

## Verification

- `npm test -- --run`: **736 passed / 56 files** (+19 new in `handoff-execute.test.js`).
- `npm run check`: **14/14 ALL GREEN** — version markers v0.2.168-alpha, dist markers
  present, proof-surface gate ok (4 bound, 2 groups), continuity docs reference
  v0.2.168-alpha (5 docs).
- `npm run bundle:report`: total JS 2.9 MB raw / 1017.1 KB gzip (app 155.0 KB, three
  609.1 KB, rapier 2.1 MB). Advisory only: rapier chunk over 700 KB (expected, tracked).
- `npm run handoff:status`: VERSION v0.2.168-alpha, package.json in sync, core docs 7/7.
- `npm run build`: built in ~3s, 97 modules, no errors (large-rapier-chunk advisory only).

## Commit

Branch `v0.2.168` off the v0.2.167 HEAD; committed locally only. NOT pushed /
deployed / published — parent agent will verify / security-review / deploy / push /
publish.

Commit: `2e4661a` on branch `v0.2.168` (off `c59e710`, the v0.2.167 HEAD).

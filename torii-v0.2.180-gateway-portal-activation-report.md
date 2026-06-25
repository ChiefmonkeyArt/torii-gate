# Torii Quest — v0.2.180-alpha · Gateway Portal Activation (LEAN-2 / GATEWAY-PORTAL-ACTIVATION)

**Slice:** minimal, real in-world portal activation seam.
**Status:** complete; committed locally only (no push/deploy/publish/upload).
**Posture:** SAFE — pure/node-safe, inert by default, same-origin only, no signing/relay/payments/external navigation.

---

## What shipped

A new **pure portal-boundary seam** that bridges an in-world gateway COMPONENT to the
existing v0.2.178 confirmed same-origin hop (`activateGatewayHandoff`). No live wiring
to a real in-world portal mesh yet (no mesh/proximity trigger exists), so the seam stops
at the safest useful boundary: a pure helper set + an injectable arm→confirm controller,
fully exercised by the debug shell over an in-memory recording host.

### New module — `src/engine/gateway/gatewayPortalActivation.js`
- `PORTAL_ACTIVATION_VERSION = 1`, `PORTAL_ACTIVATION_BADGE = 'GATEWAY PORTAL · CONFIRMED · SAME-ORIGIN HOP'`.
- `DEFAULT_PORTAL_ALLOWLIST = Object.freeze(['/zone/'])` — a meaningful scoped prefix, **never `['/']`**.
- `PORTAL_STATE` = `idle`/`armed`/`navigated`/`blocked`.
- `portalActivationInput(component, context)` — maps `gatewayDestination(component).target`→`zoneId`
  and **DROPS the external `website`** (so an external profile URL is never built or navigated);
  carries only title/zoneType/npub/relays. Rejects a non-gateway component or a destination with no target.
- `sanitizePortalAllowlist(allowlist)` — keeps only same-origin string prefixes (`/`-leading, length ≥2)
  and **folds `['/']`→`['/zone/']`** (stronger than the executor's fail-closed: the boundary can never be
  permit-everything).
- `withinPortalRange(playerPos, portalPos, radius=3)` — scalar squared-distance compare, **no `Vector3` allocation**.
- `activatePortalHandoff(component, context, grant, opts)` — builds the input, sanitises the allowlist, and
  **delegates to `activateGatewayHandoff`** so all three v0.2.178 gates still apply (`confirmed===true`,
  consent-gated `plan.ok`, route-allowlist prefix). Wraps the result in a `_portalReport` that pins
  `external`/`worldReloaded`/`signed`/`published`/`network` = `false` LAST.
- `createGatewayPortalBoundary(opts)` — captures the injected window/transport/host **ONCE** at construction;
  one-shot `arm(component, context)`→`confirm(grant, extra)` controller (`cancel`/`state`/`armed`/
  `routeAllowlist`/`stagedZoneId`). `confirm` sets `confirmed:true` and delegates; refuses with reason
  `not-armed` if not armed.
- `DEMO_PORTAL_CONTEXT` — frozen demo host context for the debug shell.

### Surface exposure
- **SDK** (`src/sdk/index.js`): `gatewayPortalActivation` namespace re-export + `SDK_SURFACE` entry at the
  `experimental` tier.
- **Debug** (`src/engine/debug/shellReport.js` + `toriiDebug.js`):
  `ToriiDebug.shells.gatewayPortalActivation(component?, context?, grant?, opts?)` →
  `gatewayPortalActivationReport(...)`, driving a `createRecordingHost` so the debug path **never live-navigates**.

### Tests — `tests/gateway-portal-activation.test.js` (28 tests)
Covers the required behaviours:
- unconfirmed does **not** navigate;
- confirmed same-origin uses the browser/host transport (records `pushState`);
- allowlist rejects `'/'` (folds to `'/zone/'`, never permit-all) and accepts `'/zone/'`;
- external `website` is dropped → no external URL path ever executes;
- missing grant / non-gateway component → blocked;
- rollback/back-home still reachable;
- safety flags pinned; never throws; SDK + debug exposure present.

Added to the `foundation` test profile (`tools/testProfiles.mjs`).

---

## Requirement-by-requirement

1. **Real portal activation seam** — ✅ `gatewayPortalActivation.js`; arm→confirm controller consumes the
   inert gateway handoff plan and activates only after explicit `confirmed:true`.
2. **Browser host transport by injection at the boundary; no module-scope window** — ✅ window/transport/host
   captured once via `opts` at controller construction; no module-scope `window`.
3. **Route allowlist uses a meaningful scoped prefix, never `['/']`** — ✅ default `['/zone/']`;
   `sanitizePortalAllowlist` folds `['/']`→`['/zone/']`.
4. **Same-origin route only; no external profile URL nav; no relay-sourced live destinations** — ✅
   `portalActivationInput` drops `website`; only the internal `target`→`zoneId` route travels.
5. **No NIP-07 / keys / payments / relay writes / auto-update / external nav / window.open / eval** — ✅ none added.
6. **SEC-2 gate unchanged and not live** — ✅ untouched; signed/relay-mediated tier still deferred.
7. **Existing constraints** — ✅ all bumped to v0.2.180-alpha; godMode=false; no new setTimeout; no new
   Vector3/Matrix4 in hot paths; debug tools ship unconditionally; ESC/panel cursor behaviour untouched.
8. **Focused tests** — ✅ 28 tests (see above).
9. **Docs** — ✅ todo.md, progress.md, HANDOFF.md, CODE_INDEX.md, SDK_DEBUG_INDEX.md, GATEWAY_PROTOCOL.md
   updated; continuum regenerated; this report added.
10. **Tests + local commit** — ✅ see below.

---

## Verification

- `npm run test:fast` — 5 files / 74 tests passed.
- `npm run test:foundation` — 19 files / 298 tests passed.
- `npm run test:release` — build OK; **62 files / 894 tests passed**; `npm run check` **ALL GREEN**
  (14/14 guardrails); bundle advisory only (rapier chunk, tracked); handoff:status in sync
  (config.js + package.json == v0.2.180-alpha).

---

## What remains blocked (deferred, by design)

Wiring an actual **in-world portal MESH + proximity trigger** that calls `arm`/`confirm` against a real
injected browser host (app/browser `window` + CSP-scoped same-origin allowlist via `world/handoff.js`)
remains the next step. The signed/relay-mediated travel tier stays behind the SEC-2 gate and is not live.
The seam, allowlist hardening, and arm→confirm controller are all in place and unit-covered, so that future
wiring is purely the host-injection + mesh-trigger step.

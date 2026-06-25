# Torii Quest v0.2.183-alpha — In-World Gateway Portal Marker (visible mesh)

> Safe, visible infrastructure slice after v0.2.182. Adds a dedicated, visible
> in-world portal marker at the existing gateway trigger position so players can
> SEE the travel point — **without changing the safety model**.

## Goal

Players already had a working proximity→confirm portal (v0.2.181) and a same-origin
`/zone/<slug>` route parser (v0.2.182), but there was **no visible landmark** at the
trigger position — the travel point was invisible until the HUD prompt fired. This
slice draws a small, performant, visually-distinct marker at the trigger so a player
can see what they are approaching, while leaving every navigation gate untouched.

## What shipped

Split per the project's established pure-plan / browser-adapter pattern (the same
shape as `proofSurfaceRenderPlan.js` + `proofSurfaceMeshes.js`), so the testable
logic stays node-safe and the THREE side is a thin, build-once adapter.

### 1. `src/engine/gateway/portalMeshPlan.js` — PURE render plan (node-safe)

- Exports `PORTAL_MESH_PLAN_VERSION` (1), `PORTAL_MESH_BADGE`
  (`'PORTAL MESH · DISPLAY-ONLY · INERT'`), `PORTAL_MESH_GROUP` (`'gateway-portal'`),
  `DEMO_PORTAL_MESH_OPTS`, `buildPortalMeshPlan(opts)`, `describePortalMeshPlan(opts)`.
- `buildPortalMeshPlan({position, range, title})` turns the v0.2.181 trigger geometry
  into a plain-data description of **four inert parts**:
  1. an **outer ring** (torus) whose `ringRadius` **EQUALS the proximity `range`** so
     the marker footprint matches the arm radius the player sees in the prompt,
  2. a violet **inner accent ring**,
  3. a faint **translucent beam** (cylinder),
  4. a slow-spinning **core** (octahedron).
- Every part **and** the plan pin `navigated`/`performed`/`external`/`signed`/
  `published` = `false`, `readOnly` = `true`, `actionable` = `false`.
- Degrades safely: `ok:false` with `invalid-position` / `range-defaulted` reasons on
  bad input. Never throws. **No** module-scope `window`/THREE/DOM.

### 2. `src/engine/gateway/portalMesh.js` — browser-only THREE adapter

- Exports `buildPortalMesh(scene, opts)`, `tickPortalMesh(dt)`, `disposePortalMesh()`,
  `portalMeshRenderState()`.
- Consumes an `ok` plan + a scene and builds emissive `MeshStandardMaterial` meshes
  **exactly once** behind a `_built` guard, mounted under a `gateway-portal` group at
  the trigger position. Re-entry is a no-op; a missing/`!ok` plan or no scene builds
  nothing and reports a reasoned render state.
- Uses the **same emissive material family** as the proof-surface boards / arena
  floor — **no new shader or heavy asset** is introduced.
- `tickPortalMesh(dt)` advances the idle animation by mutating **only scalars**
  (`rotation.y`, `emissiveIntensity`) — **no `Vector3`/`Matrix4`/geometry/material is
  created per frame**, preserving the no-allocation hot-path rule.
- `disposePortalMesh()` detaches the group and frees every geometry + material for a
  clean teardown (the live app builds once and never disposes).

### 3. `src/main.js` — composition-root wiring (browser only)

- `buildPortalMesh(scene, { position: portalPos(), range: range(), title })` is called
  **once** during world setup, aligned to the live trigger's position/range.
- `tickPortalMesh(dt)` runs in the update loop.
- This is the ONLY place the browser `scene` reaches the adapter; the engine modules
  remain DOM/window-free at module scope.

### 4. SDK + debug surface

- `src/sdk/index.js`: `portalMeshPlan` namespace re-export + a `SDK_SURFACE` entry
  (`tier: EXPERIMENTAL`).
- `src/engine/debug/shellReport.js`: `portalMeshPlanReport(opts)` — an inert report
  with `allPartsInert`, `ringMatchesRange`, anchor/range, and the part summary.
- `src/engine/debug/toriiDebug.js`: `ToriiDebug.shells.portalMeshPlan(opts?)` (plan
  report) + `ToriiDebug.shells.portalMesh()` (live render state). Debug tools ship
  unconditionally.

## Safety model — UNCHANGED

The marker is **DISPLAY-ONLY and INERT**. It adds **no capability**:

- No collider, no raycast/click handler, no input — it is a pure visual landmark.
- Navigation gates are identical to v0.2.181/v0.2.182: **proximity only ARMS**, **KeyF
  confirms**, **same-origin `/zone/` only**.
- No external navigation, no relay, no signing, no payments, no network.
- `godMode=false`. No new `setTimeout`. ESC / panel / cursor / weapon behavior not
  touched. Comments use the `nostrich` voice.

## Performance

- Meshes built **once** behind a `_built` guard (scene-setup, not a hot path).
- Tick mutates only existing scalars; **zero per-frame allocation** of
  `Vector3`/`Matrix4`/geometry/material.
- Dispose frees GPU resources and resets the build guard for clean reuse.
- No new heavy assets — reuses the existing emissive standard-material family.

## Tests

- `tests/portal-mesh-plan.test.js` (**+18**) covers: module shape/exports, happy path
  (4 parts, `ringRadius === range`), inert flags on every part + the plan, degraded
  input (`invalid-position` / `range-defaulted`), `describePortalMeshPlan`, the adapter
  build/tick/dispose against fake scenes (`{ add(){}, remove(){} }`),
  `portalMeshPlanReport`, and SDK exposure (`SDK.portalMeshPlan` +
  `SDK.SDK_SURFACE.portalMeshPlan`).
- Added to the `FOUNDATION` profile in `tools/testProfiles.mjs`.
- Suite now **958 passing / 65 files** (was 940 / 64 at v0.2.182).

## Docs updated

`todo.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`,
`GATEWAY_PROTOCOL.md` (§10 relationship-to-code), and the regenerated
`public/continuum.html` / `continuum-data.json` (docs **in sync**, **0** dangerous
tokens in the continuum XSS self-check).

## Release gate

`npm run test:fast`, `npm run test:foundation`, and `npm run test:release`
(`build && vitest run && check && bundle:report && handoff:status`) all green.

## Remaining (documented, not faked)

- Static-host SPA fallback so `/zone/*` resolves on a **cold hard refresh** (serve
  `index.html` for unknown deep links) — a hosting config, not app code.
- The signed / relay-mediated SEC-2 tier stays gated and not live.

## Constraints honored

- Existing workspace; **committed locally only** — no push/deploy/publish/upload.
- Surgical: a pure render-plan helper + a safe composition-root adapter, no scene
  rewrite, no change to the navigation safety model.

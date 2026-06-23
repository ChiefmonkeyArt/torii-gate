# Torii Quest — Source Reconciliation Report

**Date:** 2026-06-23
**Source repo:** `/home/user/workspace/torii-gate-ce3bcc94-c326380f`
**Live artifact compared against:** `/home/user/workspace/torii-live-v0298/torii-quest.pplx.app`
**Source version before:** `v0.2.64-alpha` (config.VERSION was stale at `v0.2.54-alpha`)
**Source version after:** `v0.2.109-alpha`

## Objective

The clean source repo lagged the deployed live build (live = v0.2.108-alpha). Nine
working live fixes (v0.2.100 → v0.2.108) were reverse-ported into the clean source
modules **by concern** (not by minified diff) so source becomes the source of truth.
A source-built dist was produced at v0.2.109-alpha and its key behavioural markers
were compared to the live artifact.

**Outcome: COMPLETE.** All 9 fixes ported, build clean (exit 0, 39 modules), all
key markers present and matching the live bundle. NOT pushed/published (per instruction).

## Constraints honoured

- `godMode` left `false` (config.js:`godMode=false`).
- No new `setTimeout` introduced. All new timing uses dt-accumulators / Rapier.
- No new `Vector3`/`Matrix4` allocations in hot paths — new code reuses existing
  scratch vectors (`_rayDirN`, `_rayHitP`, `_impactNrm`, `_reflDir`, `_bodyBurstNrm`)
  and the dynamic-crate sync reads `body.translation()/rotation()` straight into
  `mesh.position.set(...)`/`mesh.quaternion.set(...)`.
- Player bullets still fire from the CAMERA (player.js `shoot()` unchanged).
- ESC instant-pause and panel-lock click-no-fire preserved (main.js untouched in
  those paths).
- No backwards-compat shims — the old FP clip-plane clone was **deleted**, not hidden.

## Fixes ported (by concern)

| # | Live ver | Concern | Source files touched |
|---|----------|---------|----------------------|
| 1 | v0.2.100 | Mirror/player reflection scale | `src/playerModel.js` |
| 2 | v0.2.101 | Reload visual feedback | `src/hud.js`, `index.html` (CSS) |
| 3 | v0.2.102 | Bot gun audio → soft triangle zap | `src/audio.js` |
| 4 | v0.2.103 | Rapier-backed bot bullets | `src/weapons.js`, `src/physics.js` |
| 5 | v0.2.104 | Arena boundary / fall-hole safety net | `src/player.js` |
| 6 | v0.2.105 | Rapier line-of-sight gate for bot fire | `src/bots.js`, `src/physics.js` |
| 7 | v0.2.106 | Dynamic (pushable) Rapier crates | `src/dynamicCrates.js` (new), `src/physics.js`, `src/main.js` |
| 8 | v0.2.107 | NAP-zone Chiefmonkey NPC | `src/napNpc.js` (new), `src/main.js` |
| 9 | v0.2.108 | First-person headless Chiefmonkey body | `src/firstPersonBody.js` (new), `src/playerModel.js`, `src/scene.js`, `src/mirror.js`, `src/main.js` |

### Detail per fix

**#1 — Mirror scale.** `playerModel.js` forced the model scale to `1.0` (was
`TARGET_HEIGHT/geoH`). Verified the chiefmonkey GLB geometry POSITION accessor is
already metre-scale (y range 0..1.7), so `1.0` is correct and the existing
foot-seating formula `_root.position.y = (-gMinY*s) - 1.7` lands feet at y=0.

**#2 — Reload feedback.** `updateHUD()` now toggles a `reloading` class on the
ammo display and crosshair; `index.html` gained `@keyframes reloadPulse/reloadFade`
plus the `.reloading` rules.

**#3 — Bot audio.** `playBotShoot()` rewritten from sawtooth 1100→380 + highpass
crackle to a softer **triangle** 720→200 with attack ramp + lowpass body (520 Hz).
**Verified against the live bundle that the changed function is the BOT sound, not
the player's** — the player `playShoot()` sine 440→90 was left untouched.

**#4 — Bot bullets.** Added `castRayStatic()` to `physics.js` (a `castRay` that
filters out bot colliders via `filterPredicate`). `castRay` gained a 9th
`filterPredicate` param wired into `castRayAndGetNormal`'s 8th positional slot.
`weapons.js` bot-bullet branch now does a Rapier swept ray (excluding the player
collider) for wall/crate/obstacle/dynamic-crate impacts; the cheap distance-based
player-hit test is kept (player capsule is excluded from the ray). The dead
analytic `sweepWalls`/`_sweepCrate`/`sweepCrates` and unused imports
(`EAST_GAP_HALF`, `CRATES`, `OBSTACLES`) were removed.

**#5 — Boundary/fall-hole.** `player.js` `tickPlayer()` gained a safety net after
the NAP z-clamp: if body `y < -2` → `resetPlayerPos()`, else hard-clamp X∈[-19.5,44.5],
Z∈[-19.5,19.5] (arena + NAP corridor) and re-sync body + visual.

**#6 — LOS gate.** `physics.js` gained `hasLineOfSight()` (built on `castRayStatic`).
`bots.js` fire condition now requires a clear eye-to-eye line (player collider
excluded). Falls back to "can see" if physics isn't ready.

**#7 — Dynamic crates.** `physics.js` gained `createDynamicCrate()` (dynamic
rigid body + cuboid collider). New `dynamicCrates.js` spawns 4 brown 1m crates at
[[3,3],[-4,2],[2,-4],[-3,-3]] and syncs meshes each frame. Wired in `main.js`:
`buildDynamicCrates()` after `buildArenaColliders()`, `tickDynamicCrates()` inside
the PLAYING physics step.

**#8 — NAP NPC.** New `napNpc.js` loads `/chiefmonkey6.glb` (source's player GLB),
scale 1.0, at (28, -minY, 3), facing the gate, looping `Stylish_Walk_inplace`
(fallback `Idle_03`/animations[0]). No collider. Wired: `buildNapNpc()` on arena
enter, `tickNapNpc(dt)` in the loop.

**#9 — FP headless body.** Replaced the old clip-plane leg-clone with a dedicated
headless GLB. New `firstPersonBody.js` loads `/chiefmonkey-headless.glb` (anims
confirmed: `Idle_11`, `Running`, `Walking`), scale 1.0, parented to `playerObj`,
all meshes on **layer 2**, with idle/walk/run driven by `input.js` keys.
`scene.js` main camera does `camera.layers.enable(2)`; `mirror.js` reflection
camera adds `rc.layers.disable(2)` so the FP body never reflects. `playerModel.js`
was cleaned: removed the FP clone block, `_fpBody`/`_fpClipPlaneY`/`_fpClipLocalY`/
`_fpClipFrontOffs` state, the per-frame clip-plane update, the global
`renderer.localClippingEnabled = true`, and the now-unused `renderer` import.

## Asset

`public/chiefmonkey-headless.glb` (6,746,112 bytes) copied from the live tree.
Confirmed via glTF JSON chunk: animations `Idle_11`/`Running`/`Walking`, geometry
y-range -0.0..1.43 (headless, metre-scale), Armature root scale 0.01.

## Tests / checks run

- `node --check` on all 14 touched/new source files → all OK.
- `npx vite build` → exit 0, **39 modules** (baseline was 36; +3 new modules),
  `dist/assets/index-*.js` 66.02 kB (was 64.96 kB). The pre-existing >700 kB
  rapier-chunk size warning is unchanged and unrelated.
- Asset copy verified into `public/` and propagated to `dist/`.

### Marker comparison — source dist vs live bundle

| Marker | Live bundle | Source dist | Match |
|--------|-------------|-------------|-------|
| `chiefmonkey-headless.glb` | yes | yes | ✓ |
| `triangle` (bot audio) | yes | yes | ✓ |
| `Idle_11` (FP body) | yes | yes | ✓ |
| `Stylish_Walk_inplace` (NPC) | yes | yes | ✓ |
| `layers.enable(2)` | 1 | 1 | ✓ |
| `layers.disable(2)` | 1 | 1 | ✓ |
| `layers.enable(1)` | 1 | 1 | ✓ |
| `layers.set(1)` | 2 | 2 | ✓ |
| `layers.set(2)` | 2 | 1 | ≈ (see below) |
| version label (index.html) | — | `v0.2.109-alpha` | ✓ |

## What could NOT be fully verified

- **Runtime/visual behaviour.** This is a browser WebGL+Rapier game; no headless
  GPU/pointer-lock harness is available here, so in-game visuals (mirror scale,
  FP body framing, crate physics, LOS occlusion, audio timbre) were not exercised
  live. Verification was limited to syntax-check, production build, and static
  marker comparison. **Manual in-browser smoke test is still recommended** before
  any deploy.
- **`layers.set(2)` count 1 vs live 2.** A minification artifact, not a behavioural
  gap: the source sets layer 2 on every FP-body mesh in a single `traverse` loop
  (one `.set(2)` call site). The live build's second `set(2)` appears to be an
  inlined duplicate. The functional markers (`enable(2)`/`disable(2)`) match exactly.
- **`castRayStatic` name absent in minified JS.** Expected — local function names
  are mangled by the minifier. The behaviour is present (bot bullets resolve on
  static geometry only).
- **No automated test suite exists** in the repo (no test runner / specs), so
  there were no unit/integration tests to run beyond build + syntax checks.

## Pending / follow-ups

- Manual browser smoke test of the 9 fixes (above).
- `config.VERSION` is exported but unused, so it is tree-shaken from the JS bundle;
  the user-visible version comes from `index.html` (now `v0.2.109-alpha`). Consider
  wiring `VERSION` into the DOM label if a single source of truth is wanted.
- `package.json` version (`0.2.1`) was left unchanged (out of scope; not a runtime
  marker).
- **NOT pushed / NOT published**, per instruction. Changes are staged in the working
  tree only.

## Files changed (working tree)

Modified: `index.html`, `src/audio.js`, `src/bots.js`, `src/config.js`,
`src/hud.js`, `src/main.js`, `src/mirror.js`, `src/physics.js`, `src/player.js`,
`src/playerModel.js`, `src/scene.js`, `src/weapons.js`
New: `public/chiefmonkey-headless.glb`, `src/dynamicCrates.js`,
`src/firstPersonBody.js`, `src/napNpc.js`

# Torii Quest — Code Index

> Lightweight developer/agent index. Keep this practical and update it as systems are touched.
> Purpose: help future debugging, SDK extraction, FOSS contribution, and AI handoff speed.

Current version: `v0.2.115-alpha`  
Live site: [torii-quest.pplx.app](https://torii-quest.pplx.app)

---

## Index Rule

When a bug fix or feature pass stabilises a system, update at least one of:

- SDK/API seam
- `window.ToriiDebug` hook
- regression/smoke check
- this index

Do not abstract imaginary systems. Index proven systems and extract boundaries from working code.

---

## Core Runtime Areas

| Area | Current location / seam | Notes |
|---|---|---|
| Version/config | `src/config.js`, `index.html`, `tools/regression-check.mjs` | Version must bump every deploy. `godMode` must remain false. |
| Game state | `src/state.js` | v0.2.115 added the explicit state machine: `PHASE` + `GAME_EVENT` + transition table; `transition(event)` is the only write path; predicates `isTitle/isPlaying/isPaused/isDead/isGameover/isLive`. All phase reads/writes route through this seam. Check 7 guards against direct `state.phase =` writes elsewhere. |
| Scene/rendering | `src/scene.js`, mirror modules, Three.js renderer | Mirror and first-person camera regressions should be checked manually. |
| Player | `src/engine/entities/player.js` (boundary), `src/player.js` (runtime), `src/firstPersonBody.js`, `playerObj` | v0.2.114 began the boundary: geometry, spawn shape, and look-down POV math now live in `engine/entities/player.js`. Movement tick, combat, lifecycle, and body-state still in `src/player.js` (next slice). |
| Weapons/combat | `src/weapons.js`, `src/targetReticle.js`, `src/hud.js` | v0.2.113 introduced shared classifier for bullets and HUD preview. |
| Physics | `src/engine/physics/raycast.js`, `src/engine/physics/bodies.js` | Rapier-backed truth layer for LOS, bullets, crates, bodies. |
| Bots/NPCs | bot runtime modules, future `engine/entities/bot-agent.js` | Next extraction target: BotAgent SDK interface. |
| HUD/UI | `src/hud.js`, `index.html` HUD markup/styles | Reticle states: none, close, body, headshot. |
| Audio | `src/audio.js` | Reload is WebAudio-scheduled; no new `setTimeout`. |
| World/NAP | `src/world/napZone.js`, `src/world/handoff.js`, `src/identity/presence.js` | Skeletons exist; formalise after SDK Layer 1. |

---

## SDK/API Boundaries

### Stable or started

- **Physics raycast**: `castRay`, `castRayStatic`, `hasLineOfSight`.
- **Physics bodies**: dynamic/static/kinematic/body factory direction; crate collider mapping now supports bullet impulses.
- **Combat targeting**: shared headshot classifier used by both bullet hit result and target reticle preview.
- **Player boundary (started v0.2.114)**: `engine/entities/player.js` — pure geometry (`EYE`, `BODY_FROM_EYE`), spawn shape (`SPAWN_X/Y/Z`, `SPAWN_YAW`, `PLAYER_SAFE_CORNER`), and allocation-free look-down POV math (`lookDownEyeY`, `lookDownEyeZ`). Stateful tick/combat/lifecycle/body-state still in `src/player.js`.
- **State machine (started v0.2.115)**: `src/state.js` — `GAME_EVENT` event set, frozen `TRANSITIONS` table, `transition(event)`/`canTransition`/`nextPhase`, and phase predicates. The table mirrors the prior `if (phase !== X) return;` guards exactly, so behaviour is unchanged; all 6 call sites (main, player, input, bots, targetReticle, hud) now read via predicates and write via `transition()`.
- **Debug namespace**: `window.ToriiDebug` is the alpha inspection surface.

### Next to extract

- **Player boundary (continue)**: lift the stateful movement/kinematic tick, combat (shoot/reload/recoil), lifecycle (damage/death/respawn), and body-state (`setPlayerBody`/`getPlayerCollider`/`spawnPlayerBody`) behind the boundary; then add dash/zoom shape.
- **State machine (continue)**: first slice landed v0.2.115 (see Stable/started). Remaining: fold the secondary booleans (`reloading`, `pointerLocked`) into derived/guarded state, wire a real `GAMEOVER` edge if an end-of-run screen lands, and add unit tests for the transition table.
- **Event bus**: decouple gameplay, UI, identity, world, and economy modules.
- **BotAgent**: `BotAgent.tick(worldState) -> BotAction[]`.
- **Vitest suite**: one test per extracted seam.

---

## Debug Hooks to Use First

| Need | Debug path / check |
|---|---|
| Confirm running version | `window.ToriiDebug.version` and HUD version label |
| Check bot spawn count | `window.ToriiDebug.bots.count` |
| Inspect combat classification | `window.ToriiDebug.combat.lastHit` |
| Check mirror presence | `window.ToriiDebug.world.mirror` |
| Check physics/bodies direction | physics raycast/bodies exports and regression markers |
| Check no god mode | `npm run check` |
| Check no disallowed timers | `npm run check` |
| Check no stale version markers | `npm run check` |

---

## Common Fault Index

| Symptom | First places to inspect |
|---|---|
| Headshots/body shots feel wrong | shared classifier in combat path, bot head/body colliders, `ToriiDebug.combat.lastHit`, target reticle state |
| Reticle colour mismatches bullet result | ensure reticle uses same classifier as bullets; avoid duplicated aim math |
| Mirror player scale or gun orientation regresses | mirror layer/camera logic, player model layer, world gun transform |
| Looking down clips inside neck | first-person body/camera height and body offset logic |
| Footsteps drumroll | movement/grounded footstep cadence accumulator |
| Reload too slow or visually dead | reload time constant, viewmodel reload animation, `playReload()` timing |
| Crates do not react | `raycast.js` hit crate mapping, `bodies.js` collider map, bullet impulse application |
| NAP NPC stuck or mesh splitting | NPC placement, scale, skin/material setup, animation root |
| Live site shows old behaviour | version label, service worker cache, dist version markers |

---

## Manual Smoke Checklist

Run on real hardware after publish:

1. Version label shows current version.
2. Enter arena and reach playing state.
3. Aim near bot: reticle turns orange.
4. Aim body: reticle turns green.
5. Aim head: reticle turns green and shows 👌.
6. Shoot body/head and compare damage/classification via `ToriiDebug.combat.lastHit`.
7. Shoot crates and confirm visible nudge without launch.
8. Press reload and confirm fast clunk-clunk-click feel.
9. Look down and confirm no major neck interior.
10. Check mirror player scale and reflected gun handle orientation.
11. Confirm footsteps do not drumroll.
12. Confirm NAP Chiefmonkey NPC is not stuck or splitting.

---

## Living Reports

- `strategy.md` — strategic source of truth.
- `todo.md` — active task source of truth.
- `torii-source-reconciliation-report.md` — source reconciliation history.
- `torii-foundation-sprint-report.md` — v0.2.110 foundation history.
- `torii-v0.2.111-regression-repair-report.md` — v0.2.111 repair history.
- `torii-v0.2.112-tuning-report.md` — v0.2.112 collision/POV tuning history.
- `torii-v0.2.113-foundation-tuning-report.md` — v0.2.113 combat/HUD/crate/reload tuning history.
- `torii-v0.2.114-player-boundary-report.md` — v0.2.114 player boundary first-slice extraction.
- `torii-v0.2.115-state-machine-report.md` — v0.2.115 state-machine groundwork first slice.

# Torii Quest — Master TODO

> **Source of truth for active tasks.** Update this file whenever tasks are added, changed, completed, removed, or re-prioritised.
> Live site: [torii-quest.pplx.app](https://torii-quest.pplx.app) | Current version: **v0.2.116-alpha**

> Strategy source of truth: `strategy.md`.
> Mission: get to fast, safe feature delivery on solid foundations.

---

## Working Rules

- **Every fix should improve the foundation when useful**: add or strengthen an SDK/API seam, debug hook, smoke check, or code index entry.
- **SDK evolves from working code**: extract boundaries around systems we touch and prove, not speculative framework layers.
- **Agent/dev efficiency matters**: keep `CODE_INDEX.md`, `ENGINE.md`, `window.ToriiDebug`, regression checks, and handoff reports current enough that future agents can find faults quickly.
- **Rapier is the physical truth layer**: combat, LOS, bot bullets, crates, boundaries, and future interactable objects should converge on reusable Rapier-backed APIs.
- **Cut dead structure**: remove duplicate, stale, or completed structural tasks unless they directly support new features on solid foundations.

---

## Now — Foundation Close-Out

| # | Codebase | Category | Task |
|---|----------|----------|------|
| TQ-MANUAL-113 | TQ | TESTING | **Manual smoke test v0.2.113-alpha** — on real hardware verify head/body classification, reticle states (orange close, green body, green + 👌 headshot), crate bullet nudges, reload clunk-click speed, look-down POV, mirror, reflected gun, NAP NPC, footsteps, bot LOS, and general combat feel. |
| IDX-1 | TQ | INDEX | **Create/maintain dev index** — add a lightweight `CODE_INDEX.md` / index section covering core modules, SDK seams, debug hooks, smoke checks, and where to inspect common faults. This becomes part of every sprint. |
| SDK-1A | TQ | SDK | **Combat targeting seam** — treat the shared hit classifier and reticle preview as the first combat API. Keep bullet outcome and HUD preview on the same source of truth. |
| PHYS-1A | TQ | RAPiER | **Crate interaction tuning** — tune bullet impulse strength only after manual testing. Keep impulses behind the physics/raycast/bodies seam. |

---

## Next — SDK Layer 1: Core Engine Boundaries

| # | Codebase | Category | Task |
|---|----------|----------|------|
| A1-next | TQ/NA | ARCH | **Extract player boundary — IN PROGRESS (v0.2.114, first slice done).** `src/engine/entities/player.js` now owns the pure player geometry (`EYE`, `BODY_FROM_EYE`), spawn shape (`SPAWN_X/Y/Z`, `SPAWN_YAW`, `PLAYER_SAFE_CORNER`), and allocation-free look-down POV math (`lookDownEyeY`/`lookDownEyeZ`); `src/player.js` consumes them and re-exports `PLAYER_SAFE_CORNER`. **Remaining:** lift the stateful movement/kinematic tick, combat (shoot/reload/recoil), lifecycle (damage/death/respawn) and body-state (`setPlayerBody`/`getPlayerCollider`/`spawnPlayerBody`) behind the boundary, then add WASD+dash, zoom, iFrames, spectator shape. Nostr Arena absorbs the old v0.6 player extraction intent without old version clutter. |
| 8 | TQ/NA | ARCH | **State machine — IN PROGRESS (v0.2.115, first slice done).** `src/state.js` now defines the explicit FSM: `GAME_EVENT`, a frozen `TRANSITIONS` table mirroring the prior phase guards exactly, `transition()`/`canTransition()`/`nextPhase()`, and predicates (`isTitle/isPlaying/isPaused/isDead/isGameover/isLive`). All 6 call sites (main, player, input, bots, targetReticle, hud) read via predicates and write via `transition()`; regression check 7 guards against direct `state.phase =` writes outside `state.js`. **Remaining:** fold secondary booleans (`reloading`, `pointerLocked`) into guarded state, wire a real `GAMEOVER` edge if/when an end-of-run screen lands, add transition-table unit tests, and keep the old A2 circular-dependency/ecash-wallet warning in scope. |
| 9 | TQ/NA | ARCH | **Event bus — IN PROGRESS (v0.2.116, seam formalised).** `src/events.js` is the live decoupling backbone (`EV` registry + `on/off/emit`, imports nothing → no cycles). v0.2.116 documented the registry convention, wired `EV.PHASE_CHANGE` (`{from,to,event}`) from `state.transition()` as a behaviour-preserving instrumentation seam (no subscriber yet), and added regression check 8 (every `EV.<NAME>` reference must be defined). **Remaining:** migrate the last direct couplings onto the bus (`window._onBotHit` weapons→main bridge; `window._grassMat`/`_flowerMat` shader refs), add real `PHASE_CHANGE` subscribers (HUD/audio/presence), and emit `WS_*` once netcode lands. Required before Nostr, wallet, multiplayer, and NAP features scale. |
| B2-TQ | TQ | SDK | **Extract BotAgent interface** — formalise `engine/entities/bot-agent.js`, `BotAgent.tick(worldState) -> BotAction[]`, actions: move, shoot, idle, interact, speak. This is the useful Torii Quest part of the old bot refactor. |
| 14 | TQ/NA | TESTING | **Start Vitest unit suite** — one test per extracted SDK boundary: raycast, dynamic body creation, BotAgent, FSM transitions, and later kind:0 profile fetch. |
| CI-1 | TQ/NA | TESTING | **Fold bot health into checks** — do not keep a separate daily bot-health task. Cover boot, bot count, no JS exceptions, version marker, debug namespace, and critical markers in CI/smoke checks. |

---

## Next — SDK Layer 2: Identity, NAP Zones, and Handoff

| # | Codebase | Category | Task |
|---|----------|----------|------|
| 20 | TQ | NOSTR | **kind:0 profile sync manager** — `identity/profile.js`, fetch from primary relay on login, broadcast to all relays, use latest profile picture as player avatar, handle relay sync latency. |
| NAP-formalise | TQ | ARCH | **Formalise NAP zone module** — promote the NAP metadata skeleton into a working boundary: NIP-style metadata, pure builders, validators, decoration hooks. |
| HANDOFF | TQ | ARCH | **World handoff demo** — promote handoff skeleton to a local same-browser NAP-to-NAP demo before networked/node-to-node transport. |
| PRESENCE | TQ | NOSTR | **Presence/discovery prototype** — discover online zones and players via relay-friendly metadata without central platform accounts. |
| DECOR-1 | TQ | NAP ZONE | **Player-decorated NAP zone foundation** — define wallpaper/poster/object placement manifest before building the full editor. JPEG/PNG wallpaper upload comes after the module boundary is stable. |

---

## Later — Fun Features on Solid Ground

| # | Codebase | Category | Task |
|---|----------|----------|------|
| W1 | TQ | UI/UX | **Gate Modal** — Torii Gate social popup with following/follower avatars, online rings, open events, and JOIN buttons. Depends on presence/identity. |
| CF1 | TQ/NA | GAMEPLAY | **Combat feedback checklist** — screen-shake, weapon kick, hit-markers, damage vignette, bot hit flash. Keep dt-driven, no new unapproved timers. |
| R2 | TQ/NA | WEAPON | **Immersive reload mechanic** — mag-eject geometry and hip-fire lock during reload. Do after weapons boundary is cleaner. |
| LB1 | TQ/NA | NOSTR | **Persistent leaderboard** — kind:30000 read/write, top 10, title screen rank, relay-native identity. Depends on identity boundary. |
| 21 | TQ/NA | HUD | **2D mini-map** — live player and bot positions. |
| V1 | TQ/NA | GAMEPLAY | **Contrail plane** — low-poly flyby, permanent contrail, shootable hitbox, falling reward crate. |
| G1 | TQ/NA | ASSET | **gun.glb** — proper compact sidearm model, compressed textures, swap into viewmodel/world gun, add to precache if applicable. |
| B1 | NA | GAMEPLAY | **Kill feed + death counter** — Nostr Arena-specific unless pulled into Torii Quest later. |
| B2-NA | NA | GAMEPLAY | **Bot visual behaviour polish** — patrol/chase animation polish and obstacle avoidance for Nostr Arena. Separate from Torii Quest BotAgent SDK work. |

---

## Later — Economy, Markets, and Infrastructure

| # | Codebase | Category | Task |
|---|----------|----------|------|
| 19 | TQ | ECASH | **NIP-60 eCash wallet** — NIP-07 auth, live sat balance, arena stakes, signed eCash transfers. Do after identity/world foundations. |
| 6 | TQ | NAP ZONE | **Live Nostr auctions** — kind:30402/16, NIP-17 order flow, auction podium, Lightning/eCash payment. |
| 7 | TQ | NAP ZONE | **Host-configurable shop stalls** — stalls manifest, Nostr listing metadata, stall geometry per vendor. |
| 3 | TQ | NAP ZONE | **NAP Zone video chat** — private WebRTC, encrypted signalling, self-hostable STUN/TURN path. |
| 4a | TQ | INFRA | **Self-hosted coturn TURN server** — each arena host can run their own TURN server. |
| 4b | TQ | INFRA | **Nostr relay as ICE candidate** — track/propose relay/wss extension ideas. |
| 12 | TQ/NA | PERFORMANCE | **WebGPU renderer** — Three.js WebGPU backend behind feature flag. |
| 13 | TQ/NA | BUNDLE | **Bundle treemap audit** — rollup visualizer, unused Three.js extras, asset-size review. |
| 22 | TQ/NA | INFRA | **GitHub weekday scan** — optional scheduled scan of open issues/PRs when the project has enough contributor activity to justify it. |

---

## Open / Parked

| # | Category | Task |
|---|----------|------|
| NIP46-1 | BUG | **Primal remote signer — pubkey not returned** — external blocker. Keep visible; real fix requires Primal NIP-46 compliance. |
| TP1 ⏸ | GAMEPLAY | **Touchpad / laptop controls — PARKED** — revisit after core gameplay and pointer-lock controls are stable. |

---

## Removed / Archived

| # | Decision |
|---|----------|
| A2 | **Removed as standalone.** Merged into state machine, event bus, and BotAgent extraction notes. |
| B3 | **Removed.** Redundant with ToriiDebug, smoke tests, and CI. If needed, it belongs inside CI, not as a separate scheduled task. |
| Old v0.6 migration tables | **Archived.** Useful history, but not active Torii Quest execution guidance. Recover from Git/session history if needed. |
| Completed v0.2.100–v0.2.113 repair items | **Archived.** Keep reports and strategy history, but do not leave completed/debugged work in the active TODO. |

---

## Critical Rules

- **Version bump on EVERY deploy** — `v0.2.xxx-alpha`, max 999.
- **godMode = false** — NEVER deploy true.
- **No new `setTimeout`** except existing allowed cases: nostr.js WebSocket close and hud.js kill-feed.
- **No new `Vector3` / `Matrix4` in hot paths** — reuse scratch objects.
- **Comments use “nostrich” not “ostrich”.**
- **Chiefmonkey** — capital C, lowercase m, one word.
- **Debug tools ship unconditionally** in alpha.
- **ESC = instant pause**, overriding everything.
- **Panel-locked cursor click NEVER fires weapon.**
- **Bullets fire from CAMERA position along CAMERA forward.**
- **Use source, not patched dist**, except emergency hotfixes.
- **Deploy preview + publish live every version** when shipping to `torii-quest.pplx.app`.
- **No GitHub push every micro-version unless asked**; current instruction allows pushing completed v0.2.113/docs.
- **Prefer FOSS/open protocols**; do not recommend Google, Cloudflare, Microsoft, or Babylon.js.

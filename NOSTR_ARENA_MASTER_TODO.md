# Nostr Arena — Master Todo
> **Source of truth for all tasks.** Update this file whenever tasks are added, changed, or completed.
> Live site: [nostr-arena.pplx.app](https://nostr-arena.pplx.app) | Current version: **v0.6.144-alpha**

> Torii Quest gateway fork/session note: [torii-quest.pplx.app](https://torii-quest.pplx.app) is currently **v0.2.112-alpha**. Clean source reconciliation, foundation sprint, and the v0.2.111 regression repair pass are complete and pushed to GitHub. Strategy source of truth: `Strategy-&-Next-Steps.md`.

> **Archive note:** Completed historical work (v0.6.109–v0.6.134 bug fixes, perf optimisations, GC/debug sprints, optimisation sprint, Torii Quest v0.2.100–v0.2.111 completed items, and all earlier-version entries) has been removed from this active TODO. Full detail is available in Git history and session reports (`torii-source-reconciliation-report.md`, `torii-foundation-sprint-report.md`, `torii-v0.2.111-regression-repair-report.md`).

---

## Pending — Active Tasks

| # | Category | Task |
|---|----------|------|
| A1-next | ARCH | **Extract player.js** — movement tick, velocity, WASD+dash, zoom, iFrames, spectator cam, death/respawn (v0.6.145) |
| A2 | ARCH | **State + event bus refactor** — Migrate shared mutable state into a central state object and implement an event bus for inter-module communication. Concrete migration of the bot AI section to `bot-ai.js` with state sync. Architectural pattern for adding Nostr-based ecash wallet and other complex features without circular dependencies. |
| 8 | POST-VITE | State machine — replace ad-hoc booleans with explicit FSM in `src/state.js` |
| 9 | POST-VITE | Event bus — decouple modules via `src/events.js` |
| 12 | POST-VITE | WebGPU renderer — Three.js WebGPU backend behind feature flag |
| 13 | BUNDLE | rollup-plugin-visualizer treemap — full bundle audit, unused Three.js extras |
| 14 | TESTING | Vitest unit suite — sat balance, bot respawn, key states, Nostr kind:0 fetch |
| B1 | GAMEPLAY | **Kill feed + death counter** — Persistent kill feed and death counter tracking system for bot NPC encounters. Every hit and kill event broadcasts to local session state correctly even when the player is moving fast. Display metrics on the death screen. Redeploy to nostr-arena.pplx.app. |
| B2 | GAMEPLAY | **Bot NPC behaviour refactor** — Smooth out patrol and chase animations, add raycast-based obstacle avoidance so bots do not walk into the checker walls, and synchronise their movement speed with the player's strafing and running speed. Redeploy to nostr-arena.pplx.app. |
| CF1 | GAMEPLAY | **Combat feedback checklist** — Full combat-feel pass: (1) **Screen-shake on hit** — configurable intensity; (2) **Weapon kick animation** — gun body recoils back/up on each shot, snaps forward with ease-out; (3) **Hit-marker effects** — crosshair flashes/expands on confirmed hit, distinct colour for headshots; (4) **Damage vignette pulse** — red edge vignette proportional to damage; (5) **Bot hit flash** — bot mesh briefly flashes white on bullet impact. All wired into game-loop, no new setTimeout, dt-accumulator driven. |
| V1 | GAMEPLAY | **Contrail plane** — Low-poly plane flies across arena at ~100u altitude every 90–180s on a random heading. Leaves a permanent white `Line` contrail that slowly drifts sideways (wind) — no fading, stays for the entire game session. Multiple planes = criss-crossing lines accumulating in the sky. If shot down, contrail stops at the hit point. Shootable hitbox — on hit, spawns a slow-falling supply crate (reward: explosive rounds 30s / big sat bonus / full HP). Distant engine SFX fades in/out. `triggerShake()` on hit. Self-contained `src/plane.js` ~150 lines. |
| R2 | WEAPON | **Immersive reload mechanic** — Mag-eject/reload animation using a secondary geometry group for the magazine (slides out during dip phase, back in during snap phase). Lock player to hip-fire (no zoom) for the duration of the reload. Builds on the 3-phase carry-low animation. |
| G1 | ASSET | **gun.glb** — Create a proper gun model to replace the current procedural black block/stick placeholder. Compact semi-auto pistol / futuristic sidearm aesthetic. Draco-compress + WebP textures. Swap into `src/weapons.js` gunBody/gunBarrel/gunGrip viewmodel. Add to `PRECACHE_ASSETS` in `public/sw.js`. |
| W1 | UI/UX | **Gate Modal — Torii Gate social popup** — Modal when standing at the Torii Gate showing: (1) avatar grid of online Nostr followers/following with coloured ring indicators (dashed purple = in-arena, solid green = online, orange = away); (2) open events list with player counts, sat pot, and JOIN buttons; (3) tab navigation (Following / Followers / Open Events). **Concept 04 (Feudal Scroll × Cyberpunk Terminal)** selected: lacquer dark background + red scanline texture, torii arch SVG above modal, nostr purple ring variants, red/purple duality, monospace data aesthetic. Self-contained component — fires Nostr relay query on open, closes on ESC, click-outside, or close button. Panel-locked: clicking inside modal NEVER fires weapon. |
| LB1 | NOSTR | **Persistent leaderboard** — Read/write player stats to Nostr kind:30000 replaceable events on public relays (total sats earned, kill count, npub). Aggregate top 10 players by querying connected relays on game load. Display on the title screen: ranked table showing avatar, name (kind:0), kills, and sats earned. Returning players see their own rank and delta vs last session. No central server — fully relay-native. New module `src/leaderboard.js`. |
| 20 | NOSTR | Kind:0 profile sync manager — fetch kind:0 from primary relay on login, broadcast to all connected relays, use latest profile picture as player avatar, handle relay sync latency in multiplayer |
| 19 | ECASH | NIP-60 eCash wallet real-money arena stakes — NIP-07 browser extension auth, fetch live sat balance, stake 100 sats to enter arena, signed eCash token transfers on hit/kills between players |
| 21 | HUD | 2D mini-map — add a 2D mini-map to the HUD showing live player and bot positions |
| 3 | NAP ZONE | NAP Zone video chat — private WebRTC, presence-aware NIP-04 encrypted kind:25050 signalling, Nextcloud/Framasoft STUN, coturn fallback on host VPS |
| 4a | INFRA | Self-hosted coturn TURN server — each arena host runs coturn on their VPS |
| 4b | INFRA | Nostr relay as ICE candidate — track NIP proposal for relay/wss extension |
| 6 | NAP ZONE | Live Nostr auctions — kind:30402/16, NIP-17 order flow, auction podium, Lightning/eCash payment |
| 7 | NAP ZONE | Host-configurable shop stalls — stalls.json, kind:30402/30405, stall geometry per vendor |
| 22 | INFRA | GitHub weekday morning scan — scheduled task every weekday morning, scan ChiefmonkeyArt/nostr-arena and report open issues and PRs |
| B3 | INFRA | **Daily 8am bot health check** — Every morning at 8am, check nostr-arena.pplx.app deployment status, run a headless browser test confirming at least 5 bot NPC entities are rendered and not frozen or hidden by shader errors. Notify via Nostr DM (NIP-04 encrypted kind:4) or in-app notification only if regression detected — no third-party services. |

---

## Pending — Torii Quest Manual Smoke Test

| # | Category | Task |
|---|----------|------|
| TQ-MANUAL-111 | TESTING | Manually test live `v0.2.112-alpha` on real hardware: look-down neck/feet view, reflected gun handle-down, headshot counting, reload dip, NAP NPC pose/materials, footstep cadence, crates, mirror, bot LOS, and general combat feel. |

---

## Open / Parked

| # | Category | Task |
|---|----------|------|
| NIP46-1 | BUG | **Primal remote signer — pubkey not returned** — Primal's NIP-46 is non-compliant: does not respond to `get_public_key` and does not include the user pubkey in the `connect` response. Workaround: prompts for npub once and caches in `localStorage`. Real fix requires Primal. GitHub issue filed. |
| TP1 ⏸ | GAMEPLAY | **Touchpad / laptop controls — PARKED** — WASD + trackpad causes a freeze on arena entry (suspected pointer lock stall on integrated GPU / Mesa). Game currently requires **WASD + external mouse**. [GitHub issue #20](https://github.com/ChiefmonkeyArt/nostr-arena/issues/20) filed. Will revisit after core gameplay is stable. |

---

## Modular Migration Progress (Nostr Arena)

Steps 1–7 complete. `main.js` extracted modules so far:

| Step | Module | Version |
|------|--------|---------|
| 1 | `src/safe-zones.js` | v0.6.136 |
| 2 | `src/scene-setup.js` | v0.6.139 |
| 3 | `src/lighting.js` | v0.6.140 |
| 4 | `src/arena-objects.js` | v0.6.141 |
| 5 | `src/nap-zone.js` | v0.6.142 |
| 6 | `src/asset-loader.js` | v0.6.143 |
| 7 | `src/input.js` | v0.6.144 |
| **8 — next** | **`src/player.js`** | **v0.6.145** |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/main.js` | Primary game file (~4745 lines) |
| `src/scene-setup.js` | Renderer, camera, scene, bloom pipeline — extracted v0.6.139 |
| `src/lighting.js` | Lights, day/night cycle, rain, lightning — extracted v0.6.140 |
| `src/arena-objects.js` | Floor, neon grid, instanced grass, wildflowers — extracted v0.6.141 |
| `src/nap-zone.js` | NAP zone, compass labels, mirror, marketplace, panels, hotspot, detection — extracted v0.6.142 |
| `src/asset-loader.js` | sharedDraco, loadGLBWithRetry, initLoadingScreen, initGLBLoaders (all 5 GLB builders) — extracted v0.6.143 |
| `src/input.js` | keys, initInput, tryDash, tickDash, setZoom, isZoomed, getIFrames, getDashVelX/Z — extracted v0.6.144 |
| `src/config.js` | All constants — GATEWAY_GAP, arena dims, WS URLs, godMode |
| `src/state.js` | Shared mutable state + FSM |
| `src/game-loop.js` | rAF loop, render, tickNostrich, napZoneTickFns |
| `src/multiplayer.js` | WebSocket client, remote player management |
| `src/player-character.js` | Character picker, custom GLB upload, IndexedDB storage |
| `src/federation.cjs` | Nostr signing, kind:30078 registry |
| `src/debug-capture.js` | Stuck-key glitch capture, typed-array ring buffer |
| `server.js` | Node.js WS + HTTP server, port 8001, GLB_FILES |
| `vite.config.js` | Vite build config + dev proxy rules |
| `dist/` | Vite build output — deployed to S3 |
| `public/` | Static assets (GLBs, wall-texture.jpg, player-chiefmonkey.glb) |
| `public/sw.js` | Service worker — cache-first for GLBs, versioned cache key |
| `stalls.json` | Host-configurable shop stalls |
| `scripts/compress-glb.mjs` | Draco + WebP texture compression script |

---

## CI Pipeline

```
Lint & Format → TypeScript check → Vite Build → Server smoke test → Deploy (main only)
```

## Deploy Commands

```bash
# Version bump — replace XX with old, YY with new
sed -i 's/v0.6.XX-alpha/v0.6.YY-alpha/g' src/main.js index.html public/sw.js src/config.js src/bots.js src/game-loop.js src/federation.cjs src/player-character.js src/debug-capture.js
sed -i 's/na-v0.6.XX-alpha/na-v0.6.YY-alpha/g' public/sw.js
npm run build          # Vite production build → dist/
npm run dev            # Hot-reload dev server at localhost:5173
npm run lint           # ESLint src/
npm run format         # Prettier src/ + server.js
npm run typecheck      # tsc --noEmit
```

## Critical Rules

- **Version bump on EVERY deploy** — sed across `src/main.js`, `index.html`, `public/sw.js`, all `src/*.js`, `src/federation.cjs`
- **godMode = false** in `src/config.js` — NEVER deploy true
- **nostrich** not ostrich — all code comments and variables
- **Chiefmonkey** — capital C, lowercase m, one word, always
- **should_validate: false** always on deploy (debug overlay triggers validator)
- **#56 kind:1 broadcast** — PERMANENTLY PAUSED, removed from queue forever
- **Panel-locked click NEVER fires weapon**
- **SW precache rule** — every new GLB added to `public/` MUST also be added to `PRECACHE_ASSETS` in `public/sw.js`
- **NEVER recommend Google/big tech** — FOSS and open source only

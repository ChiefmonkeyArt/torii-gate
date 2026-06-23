# Torii Quest — v0.2.111-alpha Regression Repair Report

**Workspace:** `/home/user/workspace/torii-gate-ce3bcc94-c326380f` (existing source build; no clone)
**Version:** `v0.2.110-alpha` → `v0.2.111-alpha`
**Scope:** Source-level fixes for 7 of the 8 reported regressions (#5 crates left alone, as instructed).
**Build:** `npm run build` ✓ | `npm run check` ✓ ALL GREEN | headless Chrome smoke ✓
**Not done (per instructions):** no push, no publish. Main agent owns final deploy.

---

## Fixes by reported issue

### #1 — FP body: looking down sees inside the neck
**Files:** `src/firstPersonBody.js`, `src/scene.js`
- Enabled `renderer.localClippingEnabled = true` in `scene.js`.
- Added a world-space horizontal clip plane (normal `(0,-1,0)`) assigned to every FP-body
  material. It slices the body `NECK_CLIP_DROP = 0.28 m` below the eye, so the neck stump
  is removed from the FP camera and looking down now reveals chest → feet instead of the
  inside of the headless model.
- The plane constant is updated each frame in `tickFirstPersonBody` from the parent's live
  world Y (`_parent.getWorldPosition(_wp)`), so the slice tracks jumps/landing without
  re-reading per-vertex bounds. `_wp` is a module-scratch `Vector3` (no per-frame alloc).
- Pushed the body forward (`+Z` local `0.3` → `0.42`) so the chest sits ahead in the lower
  view, reading as the neck rolled forward.
- Exposed `window._fpBody = _root` for smoke tests + live tuning.

### #2 — Footstep "drum roll" even when not running
**File:** `src/main.js`
- Footsteps were gated on key-held only, so walking into a wall (keys down, zero
  displacement) kept the beat firing. Now gated additionally on **measured horizontal
  speed**: per-frame XZ displacement / dt must exceed `FOOT_MIN_SPEED = 1.5 m/s`.
- Added hysteresis to the airborne threshold (`EYE + 0.05` → `EYE + 0.12`) so snap-to-ground
  micro-jitter no longer re-triggers the jump-land thump every frame.
- No new timers; reuses the existing dt accumulator and the `FOOT_WALK_INTERVAL = 0.45` /
  `FOOT_RUN_INTERVAL = 0.30` cadence.

### #3 — Gun upside-down in the mirror
**File:** `src/weapons.js`
- Added `_worldGun.rotateX(Math.PI)` after the existing Euler `set(π, -π/2, π/2)`. `rotateX`
  spins about the gun's **own length** (local barrel axis), rolling the handle back down
  without disturbing the barrel's aim direction. FP viewmodel orientation is untouched.

### #4 — Headshots not reliably counted
**File:** `src/weapons.js`
- Headshot classification was `hit.bodyPart === 'head'` only. When the head sphere and body
  capsule overlap, Rapier's closest-collider pick can resolve `'body'` for a clear head hit.
- Added a deterministic dual test: headshot if `bodyPart === 'head'` **OR** the impact Y is
  at/above the body-capsule top (`BOT_BODY_CENTRE_Y_OFFSET + BOT_BODY_HALF_H +
  BOT_BODY_RADIUS = 1.44 m` above the bot foot, `bot.pos.y`). Constants imported from
  `physics.js` (re-exported from `engine/physics/bodies.js`) — single source of truth.
- Camera-origin bullet path is unchanged; only the post-hit damage classification changed
  (headshot 9, body 3).

### #6 — NAP monkey appears stuck walking into the tree
**File:** `src/napNpc.js`
- Repositioned the NPC from `(28, 3)` to `(30, 5)` — clear of the bonsai trunk at
  `(NAP_X+6=26, 0)` and off the central walkway, still facing the gate to greet the player.
- Switched the default clip preference to a standing **idle**
  (`Idle_03 → Idle_11 → Idle → Stylish_Walk_inplace → animations[0]`) so it no longer
  churns its legs (which read as "walking into the tree"). `Stylish_Walk_inplace` is kept in
  the fallback chain so the dist regression marker still passes and the NPC never T-poses.

### #7 — NAP monkey mesh splitting / skinning tear
**File:** `src/napNpc.js`
- Applied the proven opaque material patch (same as player/FP body) to every NPC mesh:
  `transparent=false; depthWrite=true; alphaTest=0; needsUpdate=true`. The GLB's
  `alphaMode:BLEND` was causing the skinned mesh to split/tear at distance. Scale policy was
  already correct (`scale=1.0`, geometry-only `minY` for foot seating) and is preserved.

### #8 — Reload not working / no animation
**File:** `src/weapons.js`
- Reload logic was fine (`player.js` drives `state.reloading`/`reloadTimer`; HUD pulses;
  3rd-person model plays a mirror-only reload clip), but the **FP viewmodel showed nothing**,
  so reload looked broken.
- Reworked `_tickGun(dt)` so it always runs (no longer early-returns when idle). During
  `state.reloading` it dips + rolls the gun out of view and back over the reload window,
  driven by `progress = 1 - clamp(reloadTimer / RELOAD_TIME)` and a `sin(progress·π)` curve
  (0 at the ends, 1 mid-reload). Pose restores cleanly when not reloading. No new timers.

### #5 — Crates pushable: **left alone** (as instructed). No crate code touched.

---

## Version bump (v0.2.111-alpha)
- `src/config.js` — `VERSION`
- `index.html` — `#version-label` and `#ver` (×2)
- `tools/regression-check.mjs` — `EXPECTED_VERSION`, header comment, and the stale-version
  guard updated to fail on a lingering `v0.2.110-alpha` in `index.html`.

---

## Files changed
- `src/scene.js` — enable local clipping
- `src/firstPersonBody.js` — neck clip plane, forward offset, `window._fpBody`
- `src/main.js` — speed-gated footsteps, jump-land hysteresis
- `src/weapons.js` — mirror gun roll, headshot Y-threshold, reload viewmodel dip, imports
- `src/napNpc.js` — reposition/idle, material patch
- `src/config.js`, `index.html`, `tools/regression-check.mjs` — version bump

## Verification
- `npm run build` → ✓ built clean (45 modules).
- `npm run check` → ✓ ALL GREEN: syntax (32 files), godMode=false, setTimeout allowlist,
  no-alloc foundation modules, version markers == v0.2.111-alpha, dist markers, dist version.
- Headless Chrome (swiftshader) smoke against `dist/`:
  - `#version-label` = `v0.2.111-alpha`; Enter Arena works; HUD shown.
  - `window.ToriiDebug` present (version, bots, player, physics, world, identity, fx).
  - 5 bots spawn (`ToriiDebug.bots.count === 5`).
  - World gun attaches (`[weapons] world gun attached via normalizer …` — #3 path runs clean).
  - Player model + FP headless body load (`window._fpBody` set; ~14 s due to the 6.7 MB GLB
    under swiftshader, not a code issue).
  - All GLBs return HTTP 200; only 404 is `favicon.ico` (harmless). No JS exceptions/pageerrors.

## Limitations
- **Pixel-level visual correctness was not verifiable headless.** The neck-clip result (#1),
  mirror gun handle-down (#3), reload dip (#8), and NPC pose/material (#6/#7) execute without
  error and are logically sound, but the exact on-screen look needs a manual browser pass
  (and a real GPU — swiftshader throws WebGL context-loss under the mirror's ReadPixels).
- **#4 headshot** verified by code/threshold reasoning, not by an automated in-arena shot
  (firing needs pointer-lock + click, impractical headless). Recommend a manual headshot
  count check.
- **#8 reload** verified by code path; a live test needs the player to deplete ammo first
  (reload is a no-op at full ammo, by design).
- `NECK_CLIP_DROP = 0.28` and the FP forward offset `0.42` are sensible starting values; a
  manual pass may want ±a few cm. `window._fpBody` is exposed to tune live.

## Recommended TODO / strategy-doc updates (Space files NOT modified by me)
- Mark the v0.2.111 regression batch (#1, #2, #3, #4, #6, #7, #8) as fixed in
  `NOSTR_ARENA_MASTER_TODO.md`; note #5 (pushable crates) intentionally deferred.
- In `Strategy-&-Next-Steps.md`, bump the "source-built" line from v0.2.110-alpha to
  v0.2.111-alpha and add a manual-smoke item: verify neck clip, mirror gun orientation,
  reload viewmodel dip, headshot counting, and NAP NPC pose on real hardware before publish.

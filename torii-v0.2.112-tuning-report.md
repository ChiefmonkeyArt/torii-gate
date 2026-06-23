# Torii Quest — v0.2.112-alpha Tuning Report

**Workspace:** `/home/user/workspace/torii-gate-ce3bcc94-c326380f` (existing source build; no clone)
**Version:** `v0.2.111-alpha` → `v0.2.112-alpha`
**Scope:** Two tuning goals after live v0.2.111-alpha — (A) hit-detection / collision
tightening, (B) look-down POV (lower camera + neck-pivot arc).
**Build:** `npm run build` ✓ | `npm run check` ✓ ALL GREEN | headless Chrome smoke ✓
**Not done (per instructions):** no push, no publish. Main agent owns final deploy.
**Untouched (per instructions):** Chiefmonkey NPC, mirror, reflection (world) gun, footsteps.

---

## Goal A — Hit detection / collision tightening

Root causes found in the v0.2.111 hit path:
1. **3 cm dead-band** between the body capsule top (1.44 m) and the head-sphere
   bottom (1.47 m) — a bullet threading that band hit *neither* collider, so a
   clear shot silently missed.
2. **Head sphere too small** (radius 0.18) — clear headshots could slip past it.
3. **Body capsule too slim** (radius 0.22 / 0.44 m wide) — narrower than the
   visible Banker torso, so edge body shots missed.
4. **One-frame collider lag** — `update()` ran `stepPhysics()` at the TOP, then
   `tickPlayer`/`tickBots` set the kinematic targets (applied only on the NEXT
   step), then `tickWeapons` raycast. Rapier's QueryPipeline updates *inside*
   `world.step()`, so the bullet raycast saw bot colliders one frame behind the
   visual model — a clear shot at a moving bot missed the stale collider.

### Fixes

**`src/engine/physics/bodies.js`** — geometry (single source of truth):
- Body capsule radius `0.22 → 0.26` (0.52 m wide) to match the Banker torso.
  `BOT_BODY_CENTRE_Y_OFFSET` recomputes to `0.76` → body spans `[0, 1.52]`.
- Head sphere radius `0.18 → 0.22`, centre unchanged (1.65) → head spans
  `[1.43, 1.87]`. Head bottom (1.43) now **overlaps** the body cap (1.52) — the
  dead-band is gone; there is no longer any height a bullet can thread between
  head and torso.

**`src/weapons.js`** — deterministic, layered headshot classification
(replaces the old `bodyPart==='head' || y >= bodyTop` dual test). Priority:
1. the ray resolved the **head sphere** collider outright (`bodyPart==='head'`); else
2. **head-sphere proximity** — impact within `headRadius + 5 cm` of the head
   centre (squared test, no sqrt) — backstop for the overlap frame where
   Rapier's closest-collider pick resolves `'body'` for a true head hit; else
3. **neck-line height** — impact at/above the head-sphere bottom (1.43 m above
   the bot foot); else **body**.
- Thresholds are derived from `BOT_HEAD_CENTRE_Y_OFFSET` / `BOT_HEAD_RADIUS`
  (imported from `physics.js`), so geometry stays the single source of truth.
  Damage unchanged: headshot 9, body 3. Camera-origin bullet path unchanged.
- Added `getLastHit()` + an in-place `_lastHit` record (no hot-path alloc)
  capturing resolved part, final class, impact Y, foot Y, rel Y, neck-line,
  head centre/radius, head-sphere flag and damage.

**`src/main.js`** — fixed the one-frame lag by moving the physics step to run
AFTER `tickPlayer`/`tickBots` set their kinematic targets but BEFORE
`tickWeapons` raycasts. The QueryPipeline now reflects THIS frame's bot
positions, so the bullet raycast hits exactly what the player sees.
`{ stepPhysics(); tickDynamicCrates(); }` stays grouped and PLAYING-gated;
crate visuals still sync post-step.

**`src/engine/debug/toriiDebug.js`** + `src/main.js` wiring — new
`ToriiDebug.combat.lastHit` getter surfaces the `_lastHit` record for live,
in-arena tuning of the head/body thresholds from the console after a shot.

## Goal B — Look-down POV (lower camera + neck-pivot arc)

Feedback: looking down is much better, but the player could still see a little
inside the neck; lower the camera a bit more and make the look-down feel like
the eyes pivot from the neck — arch outward and down, then inward, to look at
chest → feet.

**`src/player.js`** — the camera is a child of `playerObj` at the eye, so the
arc moves the eye *within* the head without changing gameplay height
(`playerObj.y` stays at EYE = 1.7; bots still aim at the true eye). After
`camera.rotation.x = pitch`:
- `down = clamp(-pitch / (π/2), 0, 1)` — 0 level → 1 straight down.
- `camera.position.y = CAM_BASE_Y − CAM_DOWN_DROP·sin(down·π/2)` — base eye
  lowered `6 cm` (`CAM_BASE_Y = -0.06`), then eased down a further `12 cm` as
  the pitch tips fully down (pulls the view onto chest → feet).
- `camera.position.z = −CAM_FWD_ARC·sin(down·π)` — a forward **bump**
  (`0.10 m` peak): arcs the eye OUT over the chest mid-look-down then back
  INWARD toward the feet at full down, emulating a head rotating on the neck.
- All scalar assignments — no allocations, no new Vector3.

**`src/firstPersonBody.js`** — the neck clip plane now tracks the live
**camera** world Y (was the parent/`playerObj` world Y, which didn't move as the
camera tipped or lowered — that's why a little neck interior remained). The clip
now follows the lowered base eye AND the look-down arc. `NECK_CLIP_DROP`
`0.28 → 0.32`. Imports `camera` from `scene.js`; removed the now-unused
`_parent` field. Local clipping was already enabled in `scene.js` (v0.2.111).
FP body stays on layer 2 (main camera only, hidden from the mirror).

---

## Version bump (v0.2.112-alpha)
- `src/config.js` — `VERSION`
- `index.html` — `#version-label` and `#ver` (×2)
- `tools/regression-check.mjs` — `EXPECTED_VERSION`, header comment, and the
  stale-version guard (now fails on a lingering `v0.2.111-alpha` in index.html).

## Files changed
- `src/engine/physics/bodies.js` — widened body capsule + head sphere, closed gap
- `src/weapons.js` — layered headshot classification, `getLastHit()` debug record
- `src/main.js` — physics-step reorder (one-frame lag fix), ToriiDebug wiring
- `src/player.js` — neck-pivot look-down arc + lowered base eye
- `src/firstPersonBody.js` — neck clip tracks camera world Y, drop 0.28→0.32
- `src/engine/debug/toriiDebug.js` — `ToriiDebug.combat.lastHit`
- `src/config.js`, `index.html`, `tools/regression-check.mjs` — version bump

## Verification
- `npm run build` → ✓ built clean (45 modules).
- `npm run check` → ✓ ALL GREEN: syntax (32 files), godMode=false, setTimeout
  allowlist, no-alloc foundation modules (bodies.js/raycast.js unchanged on that
  axis — only numeric constants and scalar math), version markers ==
  v0.2.112-alpha, dist markers, dist version.
- Headless Chrome (swiftshader) smoke against `dist/`:
  - `#version-label` = `v0.2.112-alpha`; Enter Arena works.
  - `window.ToriiDebug.version` = v0.2.112-alpha; 5 bots spawn.
  - `ToriiDebug.combat.lastHit` present with the new geometry-derived fields
    (`neckLine=1.43`, `headCentreY=1.65`, `headRadius=0.22`) — confirms the
    bodies.js geometry is wired through to the classifier.
  - `window._fpBody` set (FP headless body loaded); `ToriiDebug.world.mirror`
    present.
  - Only console error is a `favicon.ico` 404 (harmless). No JS exceptions.

## Limitations / manual test notes
- **Pixel-level visual correctness was not verifiable headless** (swiftshader
  throws WebGL context-loss under the mirror's ReadPixels). Needs a manual pass
  on real hardware:
  - Look-down POV: confirm no neck interior is visible at any pitch; the view
    should sweep from straight-ahead, out over the chest, down to the feet. If a
    sliver of neck remains, nudge `NECK_CLIP_DROP` (firstPersonBody.js) up a few
    cm, or `CAM_BASE_Y` more negative. If the forward arc feels too strong/weak,
    tune `CAM_FWD_ARC` / `CAM_DOWN_DROP` (player.js). `window._fpBody` is exposed.
  - Headshot/body counting: fire at bots at varying ranges and a moving bot;
    read `ToriiDebug.combat.lastHit` after each shot to confirm `classified`
    matches the visual hit location. Verify headshots aren't *too* easy (body
    shots at the shoulder line ≥1.43 m do count as head by design — the neck/
    shoulder transition). If the proximity backstop over-promotes, lower the
    `+0.05` epsilon in `HEAD_PROX`.
- **One-frame-lag reorder** is logically sound and build/check-clean, but the
  movement feel (player wall-sliding now resolves against the prior step's world,
  a pre-existing one-frame staleness simply shifted from bots to the player's own
  collision) should be sanity-checked on hardware — it should be imperceptible at
  8 m/s, but confirm no new jitter when sliding along walls/crates.
- Combat damage values (9/3) unchanged; only classification reliability and
  collider coverage changed.

## Recommended TODO / strategy-doc updates (Space files NOT modified by me)
- In `todo.md`, mark the v0.2.112 tuning pass (hit-detection
  tightening + look-down POV) and note the new `ToriiDebug.combat.lastHit`
  inspector.
- In `strategy.md`, bump the "source-built" line to v0.2.112-alpha
  and add a manual-smoke item: verify look-down POV (no neck interior, chest→feet
  sweep) and headshot/body counting (via `ToriiDebug.combat.lastHit`) on real
  hardware before publish.

# Torii Quest — v0.2.124-alpha: target-practice combat hit-registration diagnostics

**Date:** 2026-06-23
**Task:** Add diagnostics that make distance/“on-target” misses explainable, with pure-logic tests. Do NOT blindly loosen thresholds; ship diagnostics first, only fix surgically if an obvious distance ray-length / max-distance / collider-mask bug is found.
**Previous clean-source version:** v0.2.123-alpha. **This clean-source version:** v0.2.124-alpha.
**Status:** ✅ COMPLETE. Build green, all 11 static regression checks green, `npm test` green (83 tests / 7 files), headless boot smoke green (version `v0.2.124-alpha`, 5 bots, `ToriiDebug.combat.lastShot`/`lastMiss` getters present, no JS page errors). **Diagnostics only — no gameplay change. NOT published, NOT pushed** — main agent owns deploy/publish/push.

---

## 1. Root-cause investigation (why shots “on target” miss, especially at distance)

I read the full hit path: `src/player.js` `shoot()`, `src/weapons.js` `tickWeapons()`, `src/engine/physics/raycast.js` `castRay`, `src/engine/combat/classifier.js`, and `src/targetReticle.js`.

**There is no ray-length / max-distance / collider-mask bug, and no tunnelling gap.** Player bullets cast a per-tick segmented Rapier ray from `b.prev → b.curr` (`segLen = |vel|·dt`, ~1 m/tick). Consecutive segments chain (`prev` = last frame’s `curr`), so the swept path is **continuous** — a small head sphere anywhere on the path is caught. The `castRay` `maxDist` equals the exact segment length, and the bot/static filtering is correct.

The real cause is a **camera-vs-barrel divergence between the aim preview and the actual projectile**:

- **The reticle** (`targetReticle.js:48-49`) casts an **instantaneous hitscan ray from the CAMERA** along camera-forward and classifies what it hits → green / 👌. This is what the player trusts.
- **The bullet** (`player.js:218-232`) is a **travelling projectile fired from the gun BARREL** (`getGunBarrelWorld` = camera + 0.30 fwd + 0.12 right − 0.10 up) aimed toward a **convergence point 80 m down the camera ray** (`CROSSHAIR_CONVERGE_DIST`). The bullet line therefore only coincides with the aim line near 80 m; everywhere else it is laterally offset, and it takes real time to arrive (60 m/s, 2.5 s life).

Two independent miss mechanisms fall out of this, both worse at range:
1. **Lead/travel-time:** at distance the projectile’s flight time is long enough for a moving bot to step out of its path. The hitscan reticle showed green for where the bot *was*.
2. **Barrel/convergence offset:** the constant ~0.16 m muzzle offset (zeroed only at 80 m) is negligible against a wide torso up close but can clip a small head sphere — and it does not grow with distance, so it most visibly costs *headshots*.

Per the task (“ship diagnostics first; only fix if an obvious bug is found”), I did **not** change any combat tuning. Instead I added per-shot diagnostics that quantify exactly which mechanism caused each miss, plus a follow-up tuning task with concrete fix options.

## 2. What changed (the seam)

**New pure module `src/engine/combat/shotDiagnostics.js`** — `classifyShotOutcome(aim, outcome) -> {reason, label}`, comparing what the **aim line** (camera/crosshair) was on against what the bullet **actually resolved to**. Categories (`SHOT_REASON`): `head`, `body`, `head-to-body` (aimed head, hit torso), `blocked` (geometry closer than the aimed bot), `moved-or-offset` (aimed at a live bot, bullet hit no bot — the distance-miss signature), `aim-off` (crosshair wasn’t on a bot). No Three/Rapier/browser — node-testable. Allocates one small result object per call (per-shot, never per-frame).

**`src/weapons.js`** records a per-shot diagnostic snapshot:
- `recordPlayerShot(b, ax,ay,az, adx,ady,adz)` — at fire time, casts the **aim line** (camera ray) and the **bullet line** (muzzle → convergence), stores what each is on (`aim`, `pred`), computes the predicted outcome, and stashes the snapshot on the bullet (`b._diag`).
- On resolution (bot hit / geometry hit / expiry), `_finalizeShot()` records the **actual** outcome and derives the final `reason`/`label` via `classifyShotOutcome`. Hits update `getLastHit()` (now also carries `botName`/`dist`); non-bot resolutions update `getLastMiss()`. The latest fired shot is always `getLastShot()`.

**`src/player.js` `shoot()`** now includes the camera aim line in the `EV.SHOOT` payload (`aimOrigin`, `aimDir`) alongside the existing muzzle `origin`/`dir`, so the diagnostics can compare intent vs the bullet path. (Camera-origin bullet rule unchanged — the bullet itself is untouched.)

**`src/main.js`** captures the spawned bullet and calls `recordPlayerShot(...)` in the `EV.SHOOT` subscriber (still inside the NAP-zone guard, so no phantom shots are recorded past the gate), and passes `getLastShot`/`getLastMiss` into `installToriiDebug`.

**`src/engine/debug/toriiDebug.js`** — `combat` now exposes `lastShot` and `lastMiss` getters next to `lastHit`.

## 3. Files changed

| File | Change |
|---|---|
| `src/engine/combat/shotDiagnostics.js` | **New.** Pure `SHOT_REASON`, `classifyShotOutcome(aim,outcome)`, `reasonLabel`, `BLOCK_SLACK`. No Three/Rapier. |
| `src/weapons.js` | Added per-shot diagnostics: `_lastShot`/`_lastMiss` + `getLastShot`/`getLastMiss`, `recordPlayerShot()`, `_finalizeShot()`, `_describeInto()`; `_finalizeShot` calls on bot hit / geometry hit / expiry; `_lastHit` extended with `botName`/`dist`. Imports `classifyShotOutcome`. |
| `src/player.js` | `shoot()` `EV.SHOOT` payload now carries `aimOrigin`/`aimDir` (camera crosshair line). |
| `src/main.js` | `EV.SHOOT` subscriber captures the bullet and calls `recordPlayerShot`; `getLastShot`/`getLastMiss` imported and injected into `installToriiDebug`. |
| `src/engine/debug/toriiDebug.js` | `combat.lastShot` + `combat.lastMiss` getters added; refs extended. |
| `tests/shot-diagnostics.test.js` | **New.** 13 tests — every `SHOT_REASON` branch + block-vs-sail-past distance discrimination + labels + partial-input robustness. |
| `tools/regression-check.mjs` | `EXPECTED_VERSION` → `v0.2.124-alpha`; stale guard → flags `v0.2.123-alpha`; header comment bumped. |
| `src/config.js` | `VERSION` → `v0.2.124-alpha`. |
| `index.html` | `#version-label` + `#ver` → `v0.2.124-alpha`. |
| `CODE_INDEX.md`, `todo.md`, `strategy.md` | Version bumps + diagnostics/root-cause documentation, new `COMBAT-HITREG` follow-up task, fault-index row, future personal-NPC/AI note, test count (83 / 7). |

## 4. Debug API added

```
// engine/combat/shotDiagnostics.js (pure)
SHOT_REASON                      // {HEAD, BODY, HEAD_TO_BODY, BLOCKED, MOVED_OR_OFFSET, AIM_OFF}
classifyShotOutcome(aim, outcome) -> { reason, label }   // aim/outcome: {kind,isHead,dist}
reasonLabel(reason) -> string
BLOCK_SLACK                      // 0.25 m — block-vs-sail-past distance margin

// weapons.js
recordPlayerShot(b, ax,ay,az, adx,ady,adz) -> diag   // call at fire time
getLastShot() -> diag | null     // most recent FIRED shot
getLastMiss() -> diag | null     // most recent shot that did NOT hit a live bot

// ToriiDebug.combat (ships unconditionally in alpha)
ToriiDebug.combat.lastHit        // existing — last bot-hit classification (now incl. botName/dist)
ToriiDebug.combat.lastShot       // { origin, dir, aim, pred, outcome, predicted:{reason,label},
                                 //   reason, label, resolved, flightTime }
ToriiDebug.combat.lastMiss       // same shape; only set when a shot misses all live bots
```

`aim`/`pred`/`outcome` are each `{ kind:'bot'|'wall'|'crate'|'none', isHead, botName, dist }`. Compare `lastShot.aim` (what the crosshair was on) with `lastShot.outcome` (what the bullet hit) — `reason`/`label` summarise the verdict.

## 5. Tests added

`tests/shot-diagnostics.test.js` (node env, no browser) — 13 tests: head/body/head-to-body hit branches; aim-off, blocked (closer geometry), and moved-or-offset (sail-past / no-hit) miss branches; the `BLOCK_SLACK` boundary (marginally-closer geometry is *not* a block); every reason has a non-empty label and `classifyShotOutcome` returns the matching label; partial/missing-input robustness. Total suite now **83 tests / 7 files** (was 70 / 6).

## 6. Verification

- **`npm run build`** — ✅ green (rolldown; only the standard >700 kB three/rapier-vendor advisory).
- **`npm run check`** — ✅ **ALL GREEN**, 11 checks (incl. [4] foundation modules allocation-free, [5] version markers v0.2.124-alpha, [11] “7 test file(s) + npm test script present”).
- **`npm test`** — ✅ **83 passed** (shot-diagnostics 13, player-boundary 16, classifier 14, state 12, bot-agent 11, phaseScreens 10, events 7) in ~3s.
- **Headless boot smoke** (puppeteer-core + google-chrome-stable, ANGLE/swiftshader, vite preview): clicked ENTER ARENA → `version: v0.2.124-alpha`, `bots: 5`, `ToriiDebug.combat.lastShot`/`lastMiss` getters present (both `null` pre-fire, as expected), no `pageerror`/JS console errors (only two pre-existing resource 404s, unrelated to this change). Smoke harness + puppeteer-core removed afterward; `package.json` clean (0 puppeteer refs).

## 7. Constraints preserved

godMode `false`; no new `setTimeout`; no new hot-path `Vector3`/`Matrix4` — diagnostics reuse existing scratch (`_diagDir` is a one-time module scratch used only at fire time, outside the per-frame bullet loop; the pure classifier’s per-call object is per-shot, never per-frame; regression check [4] still green). Camera-origin bullet rule unchanged (the bullet path is identical to v0.2.123; only an extra read-only aim line is carried for diagnostics). NAP-zone weapon suppression preserved (diagnostics recorded only inside the existing NAP guard). nostrich + Chiefmonkey spellings untouched. No combat tuning constant changed — look-down POV, first-person body, footsteps, jump, reload, recoil, reticle/headshots, crates, mirror, NAP NPC, and bot bullets are all unchanged.

## 8. Manual target-practice instructions (real hardware)

1. Enter the arena, open the console.
2. Aim at a bot and fire. Read `ToriiDebug.combat.lastShot`:
   - `reason: 'head'`/`'body'` → the shot landed; `aim`/`outcome` agree.
   - `reason: 'head-to-body'` → you aimed at the head but the torso took it (barrel offset / target motion). `aim.isHead === true`, `outcome.isHead === false`.
   - `reason: 'moved-or-offset'` → you were on a live bot (`aim.kind === 'bot'`) but the bullet hit no bot (`outcome.kind === 'none'`/geometry beyond the bot). Check `flightTime` and `aim.dist` — large values confirm the distance/lead mechanism.
   - `reason: 'blocked'` → geometry closer than the bot took the round.
   - `reason: 'aim-off'` → the crosshair wasn’t actually on a bot.
3. Fire at varying distances and at moving vs stationary bots and note how often `moved-or-offset` appears at range — that frequency tells us which fix (below) to pick.
4. `ToriiDebug.combat.lastMiss` keeps the most recent non-hit so a miss isn’t overwritten by a later hit.

## 9. Next recommended task

**v0.2.125-alpha — fix distance hit-registration, driven by the manual `lastShot` data.** Pick based on which miss reason dominates at range (do NOT blindly loosen head/body thresholds):
- If **`moved-or-offset` with no geometry** dominates: the projectile is being out-run/dodged → raise `BULLET_SPEED` to shrink lead error, and/or fire the bullet line straight down the camera ray (origin still camera-side, honouring the camera-bullet rule) to kill the barrel/convergence parallax; optionally a small bot hit-assist radius at range.
- If **`head-to-body`** dominates: the barrel/convergence offset is clipping the head → align the bullet line to the camera ray (remove the 80 m convergence compromise) so preview matches outcome.
- Alternatively make the reticle predict the *projectile* (lead + travel) instead of an instantaneous hitscan, so a green/👌 reticle is an honest promise.

Parallel: the still-untested **physics raycast/bodies** seam (inject a mock `world`/`RAPIER`) remains the last core seam without unit coverage (todo #14 testing). Future: **personal NPCs from a player GLB + an AI/customer-service brain** (new `NPC-PERSONAL` todo), building on the NAP Chiefmonkey NPC skeleton + the BotAgent boundary.

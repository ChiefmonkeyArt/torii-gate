# Torii Quest — v0.2.238-alpha · ENTER-ARENA Reset-Crash Fix (render-loop boot order + fail-closed loop)

**Verdict: SHIP** · runtime repair (entry-flow / render loop) · preserves the v0.2.236 LOGIN WITH NOSTR fix · no gameplay/physics/Nostr/gateway behaviour change.

## Symptom (live v0.2.237-alpha, user-reported)

- LOGIN WITH NOSTR works (v0.2.236 fix held).
- **ENTER ARENA does not enter** — stays on the inline fallback `Engine still loading - reload the page if this persists.`
- Console floods with the SAME error thousands of times:
  `index-1TATffW-.js:187 Uncaught TypeError: Cannot read properties of undefined (reading 'reset')`
  with a repeating `requestAnimationFrame → e → Op` frame tail — a per-frame crash loop.

## Root cause (one bug, three symptoms)

Mapping the minified offsets in the matching `dist/assets/index-1TATffW-.js` back to source proved the
throwing call `db.reset()` is `_portalTrigger.reset()` inside the `update()` render-loop function.

`src/main.js` started the render loop **eagerly at the top of the boot block**
(`initLoop(update); startLoop()`), and `startLoop()` invokes the **first `update()` tick SYNCHRONOUSLY**.
That first tick ran **before** the module-level bindings `update()` reads — `_portalTrigger` and the
footstep/minimap `let`-vars, declared further down the module — were initialised.

- In dev (unminified) that is a TDZ `ReferenceError`; in the **prod bundle** the minifier hoists those
  `const`s to `var = undefined`, so frame-0 `update()` threw on `_portalTrigger.reset()` → "Cannot read
  properties of undefined (reading 'reset')".
- The **old `loop.js`** scheduled the next `requestAnimationFrame(_tick)` **before** calling `update()`, so
  the loop re-armed ahead of every throw → an infinite per-frame **crash flood**.
- The synchronous throw propagated out of the top-level `startLoop()` call and **aborted the rest of module
  eval** — before `window.__toriiEnterReady` and the ENTER click handler were wired. So ENTER never stood
  down from the inline "Engine still loading" fallback.

LOGIN kept working because v0.2.236 had already decoupled it into a self-installing
`src/engine/ui/loginBootstrap.js` imported **before** `./scene.js` — it survives a 3D/boot throw.

## Fix (root-cause initialization, not a broad-catch mask)

1. **Boot order (`src/main.js`)** — removed the eager `initLoop(update); startLoop()` from the top of the
   boot block and moved `initLoop(update, _onLoopFatal); startLoop();` to the **very end of the module**,
   after every module-level binding `update()` touches AND after `window.__toriiEnterReady = true` + the
   ENTER click handler are wired. The first synchronous tick can no longer read an uninitialised binding nor
   abort handler registration.

2. **Fail-closed loop (`src/loop.js`)** — defense-in-depth so a per-frame `update()` throw can never flood
   again:
   - `update()` now runs inside `try/catch`; the next `requestAnimationFrame` is scheduled **only while
     healthy** (after, not before, the call).
   - After `LOOP_ERROR_ABORT_STREAK` (8) **consecutive** throws the loop **stops rescheduling** (no flood),
     logs one FAILED-CLOSED line, and calls an optional fatal handler **once**. A throw from the fatal
     handler itself is swallowed (cannot re-enter).
   - A **healthy frame resets the streak**, so a one-off transient throw is still tolerated.
   - Uses `requestAnimationFrame` only — **no new `setTimeout`**.

3. **Visible, actionable failure (`src/main.js` `_onLoopFatal`)** — instead of a silent freeze + console
   flood, surfaces `⚠ Engine error — the arena stopped unexpectedly. Please reload the page.` via
   `showEntryStatus()` and re-enables the ENTER button.

The v0.2.236 NIP-07 login decoupling is untouched (missing provider still shows `NIP-07 extension not
found`, never a stuck "loading").

## Tests — new `tests/loop-fail-closed.test.js` (+9)

Locks the fix on two fronts:

- **Behaviour (`loop.js`)**: an always-throwing `update()` halts after exactly `LOOP_ERROR_ABORT_STREAK`
  frames (NOT thousands) and calls the fatal handler once; a single transient throw is tolerated and resets
  the streak; a fatal handler that itself throws cannot crash `startLoop()`; a healthy update advances the
  frame counter; a missing/invalid fatal handler is tolerated.
- **Boot-order contract (`src/main.js` source)**: the loop is started AFTER `window.__toriiEnterReady = true`
  and AFTER the `const _portalTrigger` definition; the boot block no longer starts the loop eagerly; the loop
  is wired with a fatal handler that surfaces a visible, actionable "reload the page" message.

## Version markers bumped to v0.2.238-alpha

`src/config.js` (VERSION), `package.json`, `index.html` (×2), `public/sw.js` (`tq-v0.2.238-alpha`),
`tools/regression-check.mjs` (EXPECTED_VERSION), `MVP_APPROVAL_STATE.json`,
`src/engine/dashboard/continuumData.js` (CONTINUUM_VERSION + Source version + Active slice; CURRENT_TEST_STATUS
1649/99), `src/engine/status/mvpReadiness.js` (DEFAULT_TEST_STATUS 1649/99). Docs: HANDOFF.md (changelog +
Current version), CODE_INDEX.md, SDK_DEBUG_INDEX.md, todo.md (HARD-52), progress.md.
`NEXT_ACTION_STATE.json` regenerated (v0.2.238-alpha, tests 1649/99).

## Verification — `npm run test:release`

- `npm run build` — clean.
- Vitest — **1649 passed / 99 files**.
- `npm run check` — ALL GREEN.
- `npm run bundle:report` — advisory only (rapier chunk >700 KB, expected/tracked).
- `npm run handoff:status` — config v0.2.238-alpha; package.json in sync.

## Hard constraints — all held

`godMode` stays false. No new `setTimeout` (the loop uses `requestAnimationFrame` only; the existing allowed
`nostr.js`/`hud.js` cases are untouched). No new hot-path `Vector3`/`Matrix4`. Comments use "nostrich".
Chiefmonkey spelling exact. Debug tools ship unconditionally. Non-religious ethics guard + the useful-job
workflow invariant intact. No Nostr writes/signing beyond the existing NIP-07 read; no new network writes. No
deploy/publish/push — the parent agent handles those. Status stays not-run/pending; no MVP approval granted
this slice.

**SHIP.**

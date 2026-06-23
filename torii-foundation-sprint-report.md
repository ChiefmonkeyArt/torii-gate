# Torii Quest — Foundation Sprint: Final Report

**Date:** 2026-06-23
**Worktree:** `/home/user/workspace/torii-gate-ce3bcc94-c326380f`
**Version:** `v0.2.109-alpha` → `v0.2.110-alpha`
**Build:** green — `npx vite build` exit 0, 45 modules (+6 new).
**Regression:** green — `npm run check` ALL GREEN (6/6 guardrail groups).
**Status:** NOT pushed / NOT published (per instruction). Working tree only.

## Summary

Implemented all remaining foundation-sprint tasks in **clean source** (not dist),
with no live-gameplay behaviour change. ESC instant-pause, panel-locked-cursor
no-fire, and camera-origin bullets all untouched. godMode stays `false`; no new
`setTimeout`; foundation modules are allocation-free; "nostrich"/Chiefmonkey
spelling preserved.

## What landed (by task)

1+2. **Physics SDK boundaries** — extracted `src/engine/physics/bodies.js` (all
   body/collider factories + collider→bot/part maps + capsule/bot constants) and
   `src/engine/physics/raycast.js` (`castRay`/`castRayStatic`/`hasLineOfSight`).
   World+RAPIER injected via `initBodies`/`initRaycast`. `physics.js` slimmed to
   world+controller+arena and **re-exports the full surface**, so every existing
   `from './physics.js'` import is byte-compatible. Only `dynamicCrates.js` was
   repointed (by choice) to import `createDynamicCrate` from `bodies.js`.

3. **`window.ToriiDebug`** — `src/engine/debug/toriiDebug.js` builds one
   namespaced API (`version`, `bots`, `player`, `physics`, `world`, `identity`,
   `fx`); wired once in `main.js`, ships unconditionally. Load-bearing functional
   globals (`_onBotHit`, `_grassMat`, `_flowerMat`, `_mirrorMesh`) preserved and
   mirrored under the namespace (documented in the module header).

4. **Hardening** — Nostr avatar URL validation (`_safeImageUrl`: absolute
   `https:` only, ≤2048 chars; rejects `javascript:`/`data:`/`http:`/relative);
   kill-feed `innerHTML` removed in favour of `createElement`+`textContent`;
   avatar placeholder `src=""` removed; conservative enforced CSP subset
   (`object-src 'none'; base-uri 'self'; form-action 'self'`) in `<meta>`, with
   the full policy documented for HTTP-header / Report-Only rollout (meta-CSP has
   no Report-Only mode; DRACO blob-worker + WASM + gstatic can't be verified
   headlessly).

5. **NAP zone metadata skeleton** — `src/world/napZone.js`: pure
   create/validate/`toUnsignedZoneEvent`(NIP-78 kind 30078)/`fromZoneEvent`. No
   transport.

6. **NAP-to-NAP handoff skeleton** — `src/world/handoff.js`: pure
   create/verify(structural+5-min freshness)/serialize/`resolveHandoffSpawn`. No
   relay, no online jump.

7. **Presence/discovery skeleton** — `src/identity/presence.js`: DISABLED by
   default (`PRESENCE_ENABLED=false`); `publishPresence` returns the unsigned
   event without sending; `discoverZones`→`[]`; `subscribePresence`→no-op.

8. **Regression tooling** — `tools/regression-check.mjs` + `npm run check`:
   syntax, godMode, setTimeout allowlist, no-alloc, version markers, dist markers.

9+10. Updated `strategy.md` (formerly `Strategy-&-Next-Steps.md`); wrote
   `torii-foundation-sprint-report.md`.

## Files changed

New (7): `src/engine/physics/bodies.js`, `src/engine/physics/raycast.js`,
`src/engine/debug/toriiDebug.js`, `src/world/napZone.js`, `src/world/handoff.js`,
`src/identity/presence.js`, `tools/regression-check.mjs`.

Modified (8): `src/physics.js`, `src/dynamicCrates.js`, `src/main.js`,
`src/nostr.js`, `src/hud.js`, `src/config.js`, `index.html`, `package.json`.

## Checks run

- `node --check` on all src (32 files) — OK.
- `npx vite build` — exit 0, 45 modules.
- `npm run check` — ALL GREEN.
- Node functional tests: NAP zone round-trip ✓; handoff round-trip + spawn ✓;
  presence inert ✓; avatar URL accept-https / reject-js·data·http·relative·null ✓.

## Limitations / remaining risks

- **No browser smoke test** possible here (WebGL + Rapier/Draco WASM +
  pointer-lock); static + node-level checks only. Manual in-browser smoke test
  still required before deploy.
- **Full CSP not enforced** — only the safe subset is live; full policy must be
  validated as an HTTP header (Report-Only first).
- Physics extraction relies on re-exports being runtime-identical — verified
  statically; runtime raycast/LOS/crate paths to be confirmed in manual smoke.

## NOT done (by instruction)

- No `git push`, no publish/deploy. Main agent handles final deploy/publish/push.

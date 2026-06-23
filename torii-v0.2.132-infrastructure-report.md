# Torii Quest — v0.2.132-alpha Infrastructure Batch Report

Date: 2026-06-23 · Version: **v0.2.132-alpha** (bumped from v0.2.131-alpha)

Four work items landed incrementally, each behaviour-preserving, all tests green.
No deploy/publish/push/upload performed — main agent handles those after verification.

---

## 1. ARS-4 — reload sub-state FSM fold

Folded the reload sub-state into pure, node-testable state predicates/transitions
in `src/state.js`:

- `isReloading(s = state)` — mirrors the `reloading` flag.
- `tickReload(dt, s = state)` — the FSM transition: counts `reloadTimer` down;
  when it reaches zero, clears `reloading`, refills `ammo = MAX_AMMO`, and returns
  whether it completed this tick (no-op + `false` when not reloading or still
  counting).

Adopted at call sites (behaviour-identical):
- `src/player.js` — reload tick block → `if (tickReload(dt)) emit(EV.HUD_UPDATE);`
- `src/weapons.js` — viewmodel reload gate → `isReloading()`
- `src/main.js` — `isReloading()` for HUD trigger + player-model tick

Tests: +5 cases in `tests/state.test.js` ("reload sub-state fold").

## 2. ARS-3 — weapons/player bullet + aim ray migration to RaycastService

Routed the remaining live raycast call sites through the `raycastService` facade
instead of importing `castRay`/`castRayStatic` from `physics.js` directly:

- `src/player.js` `shoot()` aim ray → `raycastService.ray(...)`
- `src/weapons.js` `recordPlayerShot` aim + prediction rays → `raycastService.ray`
- `src/weapons.js` `tickWeapons` player bullet ray → `raycastService.ray`
- `src/weapons.js` `tickWeapons` bot bullet ray → `raycastService.rayStatic`

Behaviour-identical: the default `raycastService` wraps the same `raycast.js`
functions that `physics.js` re-exports. The barrel-origin-through-crosshair firing
rule and all hit behaviour are preserved.

Tests: +3 cases in `tests/raycast-service.test.js` (default service production
wiring with no world loaded — exposes ray/rayStatic/lineOfSight; ray/rayStatic
null pre-init; lineOfSight true pre-init).

## 3. CMP-1 — COMPONENTS.md manifest spec

New `COMPONENTS.md` — the component-economy manifest spec (practical, implementable):
what a component is (idempotent `mount(scene, options)`/`unmount()`, full teardown),
the manifest (required `id`/`name`/`version`/`author.npub`/`mountTarget` + optional
`bundle.hash`/`contract`/`capabilities`/`dependencies`/`assets`/`config`/`pricing`/
`zapSplit`/`listing`), identity/provenance/versioning (npub attribution, bundle-hash
integrity, fork lineage), config→mount options, mount targets, Nostr distribution
(NIP-78 kind:30078 / kind:30402 / kind:16 / NIP-15; Lightning/Cashu/Nutzap; NIP-57/61
zap splits), and host security/verification rules.

## 4. CMP-2 — component mount/unmount SDK interface slice

New pure `src/engine/components/contract.js` (no THREE/Rapier/DOM, node-safe):
- `COMPONENT_CONTRACT_VERSION = '0.1.0'`
- `REQUIRED_MANIFEST_FIELDS`, `MOUNT_TARGETS`
- `validateManifest(m) → { valid, errors }` — required fields + `author.npub`
  provenance + mountTarget membership + pricing (free or positive sats); never throws.
- `isComponent(obj)` — mount+unmount function shape check.
- `defineComponent(def)` — throws on missing mount/unmount or invalid manifest;
  returns a component with idempotent `mount(scene, options={})`/`unmount()` and a
  `mounted` flag.

Surfaced via `src/sdk/index.js` as the `component` namespace + `SDK_SURFACE.component`
entry at tier `experimental`.

Tests: new `tests/component.test.js` (+14 cases — metadata, validateManifest,
isComponent, defineComponent idempotency, SDK exposure).

---

## Files changed

- `src/config.js` — VERSION → v0.2.132-alpha
- `index.html` — version labels (#version-label, #ver)
- `tools/regression-check.mjs` — header + EXPECTED_VERSION + stale-version guard
- `src/state.js` — `isReloading` / `tickReload`
- `src/player.js` — `tickReload` adoption + `raycastService.ray` aim ray
- `src/weapons.js` — `isReloading` gate + 3× ray / 1× rayStatic migration
- `src/main.js` — `isReloading` adoption
- `src/engine/components/contract.js` — NEW (component contract)
- `src/sdk/index.js` — `component` namespace + SDK_SURFACE entry
- `COMPONENTS.md` — NEW (manifest spec)
- `tests/state.test.js`, `tests/raycast-service.test.js` — augmented
- `tests/component.test.js` — NEW
- `todo.md`, `progress.md`, `strategy.md`, `CODE_INDEX.md`, `HANDOFF.md` — doc updates

## Verification

- `npm run build` — clean (only the pre-existing rapier chunk-size advisory)
- `npm run check` — ALL GREEN (11 checks; v0.2.132-alpha source + dist markers; 16 test files)
- `npm test` — 185 passed / 16 files

## Constraints preserved

godMode false; no new setTimeout; no new Vector3/Matrix4 in hot paths (ray migration
reuses existing scratch); 'nostrich'/'Chiefmonkey' spellings untouched; debug tools
unconditional; ESC instant pause + panel-locked cursor never fires; barrel-origin
through-crosshair firing rule intact; split by concern.

## Deferred / not done

- ESBUILD-1 dev-server advisory — still deferred (broad toolchain rewrite).
- CMP manifest builder helper + `torii.asset` extension — awaits loader/Nostr-event
  work (CMP-5/CMP-7); signature/hash/capability ENFORCEMENT is later CMP work.
- ARS-4 remaining: a real `GAMEOVER` edge.
- ARS-3 remaining: injected-world tests + `raycast.js` direct-import cleanup.

## Next steps for main agent

1. Manual smoke test (firing/headshots, reload feel, ESC pause, re-entry).
2. Deploy/publish/push/upload the v0.2.132-alpha source-built artifact (NOT done here).

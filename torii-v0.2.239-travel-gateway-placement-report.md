# Torii Quest — v0.2.239-alpha Travel Gateway Placement Report

**Slice:** Add the uploaded `torii-gateway-experience.glb` as the actual metaverse
travel portal on the far side of the NAP zone; relocate the portal visuals
(two ground rings, spinning diamond, beam), travel detection zone, and the
"Press F to travel" prompt to it. The existing `torii-gate.glb` stays the NAP
entrance marker with **no** travel behavior.

---

## 1. Asset handling / compression result

| | bytes | note |
|---|---|---|
| Uploaded source | 3,803,216 | `/home/user/workspace/uploaded_attachments/78e9708758d64662aa5ef785a8bfb175/torii-gateway-experience.glb` |
| Shipped (compressed) | **705,696** | `public/torii-gateway-experience.glb` |
| Reduction | **~81.4%** | 3.80 MB → 0.71 MB |

- **Tool:** `npx gltf-pipeline -d` (Draco mesh compression). Chosen because the
  arena loader already wires `DRACOLoader` (decoder
  `https://www.gstatic.com/draco/versioned/decoders/1.5.6/`), so the compressed
  asset decodes with **no new decoder wiring**. `gltfpack`/meshopt was rejected —
  it would require registering `MeshoptDecoder`, which the repo does not ship.
- Output validated: glTF magic header present; loads via existing GLTFLoader path.
- Precached: added to `public/sw.js` `PRECACHE_ASSETS` and `CACHE_VERSION` bumped
  to `tq-v0.2.239-alpha`.
- **Recommendation:** Draco copy is web-ready at 705 KB. If further savings are
  desired later, texture downscale/KTX2 is the next lever, but it would require a
  KTX2/BasisU loader not currently in the bundle — out of scope for this slice.

## 2. Placement coordinates

NAP zone geometry (from `src/config.js`):

- `NAP_X = ARENA_HALF = 20` — entrance plane (east wall); `torii-gate.glb` marker.
- `NAP_FAR_X = ARENA_HALF + 25 = 45` — outer edge of NAP-zone floor.
- **`TRAVEL_GATE_X = ARENA_HALF + 20 = 40`** — new far-side travel portal plane.

The travel gateway sits at `(40, 0, 0)`, strictly inside the NAP zone
(`20 < 40 < 45`) with ring radius 3 → footprint x∈[37,43], clear of the far edge
(45). The entrance marker remains at the NAP_X plane.

`src/arena.js _buildTravelGateway()`:
- Procedural turquoise fallback group ('travel-gateway') + turquoise PointLight at
  `(TRAVEL_GATE_X, 0, 0)`, `rotation.y = Math.PI/2`, shown until the GLB loads.
- GLB loaded from `/torii-gateway-experience.glb`; on load the fallback is removed,
  the model is scaled to `WALL_H * 1.6`, grounded at
  `position.set(TRAVEL_GATE_X, -box.min.y, 0)`, `rotation.y = Math.PI`, named
  'travel-gateway'; the Draco loader is disposed.

## 3. Moved effects / detection details

In `src/main.js`, both the portal **trigger** and the gateway **component** were
re-anchored from the entrance plane to `TRAVEL_GATE_X`:

- `createPortalTrigger({ portalPos: { x: TRAVEL_GATE_X, y: 0, z: 0 } })` — moves
  the travel **detection zone** and the **"Press F to travel"** interact prompt.
- `createToriiGateway({ position: { x: TRAVEL_GATE_X, y: 0, z: 0 } })`.
- The portal **mesh** (two ground rings + spinning diamond + beam) is built from
  `_portalTrigger.portalPos()`, so re-anchoring the trigger moves all visuals
  automatically — `buildPortalMesh(scene, { position: _portalTrigger.portalPos(), ... })`
  is unchanged. `tickPortalMesh(dt)` mutates scalars only (no new allocations).

Result: the player must walk to the **far-side** gateway (x≈40) to see the travel
prompt/detection. The NAP entrance marker at x=20 has no portal trigger, so it
carries no travel behavior.

## 4. Tests run

- **New:** `tests/travel-gateway-placement.test.js` (12 tests) — asserts the
  compressed GLB ships (glTF magic + size + SW precache), `torii-gate.glb` still
  ships, `NAP_X < TRAVEL_GATE_X < NAP_FAR_X` with footprint clear of the far edge,
  arena loads `/torii-gateway-experience.glb` via `_buildTravelGateway()` and
  names both 'travel-gateway' and 'torii-gate', and main.js anchors trigger +
  gateway to `TRAVEL_GATE_X` (not `ARENA_HALF`) while still building the mesh from
  `_portalTrigger.portalPos()`.
- **Full suite:** `npx vitest run` → **1660 passed (1660) / 100 files (100)**.
- **`npm run check`** → **ALL GREEN** (15/15), incl. version markers ==
  v0.2.239-alpha, godMode false, setTimeout allowlist (nostr.js + hud.js only),
  no new Vector3/Matrix4 in foundation modules, docs consistency.
- **`npm run test:release`** (build + vitest + check + bundle:report +
  handoff:status) → green; bundle advisory unchanged (rapier chunk over warn
  limit, tracked not gated).
- Curated counts synced to the live suite: `CURRENT_TEST_STATUS`
  (continuumData.js) and `DEFAULT_TEST_STATUS` (mvpReadiness.js) → 1660/100;
  `NEXT_ACTION_STATE.json` regenerated.

## 5. Manual test notes

Runtime build succeeds; placement/anchoring verified by contract tests rather than
a live browser session (no display in this environment). Expected in-game behavior:
walk east through the entrance `torii-gate.glb` (no prompt) into the NAP zone,
continue to the new far-side gateway at x≈40 — the two rings, spinning diamond,
beam, detection zone, and "Press F to travel" prompt appear there. The compressed
GLB renders via the existing Draco decoder; the turquoise procedural fallback shows
only during the brief load window.

## Verdict

**SHIP** — slice complete, full release gate green (1660/100, check 15/15),
constraints satisfied, asset compressed ~81% and web-ready. No deploy/push
performed (left to the main agent).

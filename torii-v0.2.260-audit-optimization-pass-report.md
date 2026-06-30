# Torii Quest v0.2.260 — Audit Optimization Pass

> Source-only audit pass: 6 separate commits, no architecture changes, no
> new dependencies. Cold-load payload, test loop, and security posture all
> improved in lockstep. Live deploy still trails — manual maintainer step.

## What landed (in commit order)

| # | SHA | Area | Change |
|---|---|---|---|
| 1 | `8bdfb9f` | tests (E1) | Vitest `pool: threads` + `poolOptions.threads.isolate: false` in `vite.config.js`. The 108-file / 1834-test suite imports only pure helpers — per-file isolation cost ~26 s of collect/prepare overhead for ~1.5 s of actual test execution. |
| 2 | `a6e3ba9` | assets (GLB1+GLB2) | `tools/optimize-glbs.mjs` one-shot author-side optimizer: `gltf-transform webp` + `gltf-transform draco` (lossless-vertex, no `simplify`). All 7 GLBs rewritten in place, originals preserved as `.glb.original` (gitignored). DRACOLoader wired into `playerModel`, `botModel`, `napNpc`, `firstPersonBody` (matching the existing `arena.js` + `weapons.js` pattern). CSP already allows `gstatic.com` Draco CDN. |
| 3 | `e6e9a33` | service worker (R3) | `PRECACHE_ASSETS` trimmed from 8 entries (≈15 MB) to 2 critical-path UI assets (`/wall-texture.webp`, `/bitcoin-b.png`). GLBs cached opportunistically by the existing `cacheFirst()` fetch handler on first request. |
| 4 | `2ae0d6a` | nostr (S5) | `_fetchProfile()` rewritten to call `fanoutReq()` against all 4 relays in parallel and pick the freshest kind:0 by `created_at` (NIP-01 replaceable semantics). New `_safeName()` sanitizer caps display names to 64 chars and strips C0/C1 control characters. |
| 5 | `4e3b04d` | gateway (S2) | `hardenSpawnUrl()` gains `opts.allowNonDefaultPort` (default `false`). Any spawn URL with an explicit non-443 port is now rejected unless the caller opts in. Production `main.js` callsite passes no opts → default-port-only is enforced for the live game. +4 tests. |
| 6 | `893cf9c` | repo hygiene | `.gitignore` additions for `coverage/`, `*.log`, npm/yarn debug logs, `.vitest-cache/`, `.vite/`, `.tmp/`, `*.tsbuildinfo`, and `public/*.glb.original`. |

The seventh audit recommendation — relocate the 104 historical `torii-v*-report.md` files into a `reports/` subdir — was skipped intentionally: 5 release tools (`handoff-status`, `rc-snapshot`, `release-manifest`, `release-package`, `releaseManifest`) all scan ROOT for these filenames, and the release-manifest pipeline (tests + tools) is deeply wired to that layout. The cosmetic benefit didn't justify the surface area of touching the release pipeline. Documented in the commit message of `893cf9c`.

## Measured impact

### Cold-load payload
- **Total GLB payload**: 14.66 MB → 5.02 MB (-9.64 MB, -66 %).
- **Largest single file**: `chiefmonkey-headless.glb` 6.43 MB → 648.8 KB (-90 %); the player's first-person body GLB was uncompressed-from-Blender with two 1024×1024 PNG textures (≈1.45 MB each).
- **Service worker install bandwidth**: ~15 MB → ~50 KB (`PRECACHE_ASSETS` trim). A user who closes the landing tab before entering the arena no longer pulls multiple megabytes of binary assets in the background.

Per-file breakdown of the lossless-vertex GLB pipeline:

| GLB | Before | After | Delta |
|---|---|---|---|
| `chiefmonkey-headless.glb` | 6.43 MB | 648.8 KB | -90 % |
| `banker-rigged.glb` | 1.76 MB | 701.7 KB | -61 % |
| `nostrich3.glb` | 2.52 MB | 1.21 MB | -52 % |
| `chiefmonkey6.glb` | 2.31 MB | 1.17 MB | -49 % |
| `torii-gateway-experience.glb` | 689.2 KB | 417.3 KB | -39 % |
| `gun-steampunk.glb` | 663.2 KB | 636.2 KB | -4 % |
| `torii-gate.glb` | 312.9 KB | 301.0 KB | -4 % |

Mesh vertex count is preserved exactly across every file — there is no LOD reduction, no `simplify` step, no perceptual quality loss. The win is entirely from `KHR_draco_mesh_compression` (mesh data) + `EXT_texture_webp` (textures). Three.js r152+ understands `EXT_texture_webp` natively; `DRACOLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')` matches the pattern already present in `arena.js` and `weapons.js`.

### Test loop
- **`npm test` (unit suite)**: 28.7 s → 2.7 s (-90 %, ~10×).
- **`npm run test:release` (build + vitest + check + bundle + handoff)**: 31.6 s → 7.9 s (-75 %, ~4×).
- **Test count**: 1834 → 1838 (+4 new `urlHarden` port-enforcement tests). All passing.

If a future test ever needs a fresh module graph (rare for pure-logic seams), the right answer is a dedicated vitest project with `isolate: true`, not reverting the default.

### Security & resilience
- **S5 (nostr name handling)**: hostile kind:0 can no longer blow out the title bar / HUD with arbitrary-length text or layout-breaking control codes; cap is 64 chars + C0/C1 strip.
- **S5 (nostr relay fan-out)**: profile lookup is no longer single-relay-fragile. The previous loop opened a WebSocket to `RELAYS[0]` and `break`ed out of the for-loop immediately, so a single offline lead relay left the player as "PUBKEY12" forever even when their profile was happily on the other three.
- **S2 (gateway port enforcement)**: closes the "redirect a traveller to a dev/admin server on a non-standard port of an otherwise-legit host" path. WHATWG URL normalises `https://host:443/` by clearing `u.port`, so the check is a single line and only trips on real overrides like `https://host:8443/`.

## Files touched

```
.gitignore                              | +11
HANDOFF.md                              |  ±1
MVP_APPROVAL_STATE.json                 |  ±1
NEXT_ACTION_STATE.json                  |  regenerated
package.json                            |  ±1
progress.md                             |  ±2
public/sw.js                            |  ±21
src/botModel.js                         | +5
src/config.js                           |  ±1
src/engine/dashboard/continuumData.js   |  ±2
src/engine/gateway/urlHarden.js         | +13
src/firstPersonBody.js                  | +5
src/napNpc.js                           | +5
src/nostr.js                            | +44 / -24
src/playerModel.js                      | +5
public/banker-rigged.glb                |  optimized (binary)
public/chiefmonkey-headless.glb         |  optimized (binary)
public/chiefmonkey6.glb                 |  optimized (binary)
public/gun-steampunk.glb                |  optimized (binary)
public/nostrich3.glb                    |  optimized (binary)
public/torii-gate.glb                   |  optimized (binary)
public/torii-gateway-experience.glb     |  optimized (binary)
tests/continuum-dashboard.test.js       |  ±4
tests/url-harden.test.js                | +28
todo.md                                 |  ±1
tools/optimize-glbs.mjs                 |  +new file (5087 B)
tools/regression-check.mjs              |  ±1
index.html                              |  ±2
vite.config.js                          | +5
```

## Gate / verification

- `npm run test:release` — **GREEN**. 108 files, 1838 tests, 15 / 15 regression checks.
- Version sync (`regression-check` step 5): `src/config.js` + `package.json` + `index.html` (≥2 markers) + `public/sw.js` `CACHE_VERSION` all agree on `v0.2.260-alpha`.
- Bundle baseline unchanged (advisory): 3.0 MB raw / 1.0 MB gzip JS, single advisory chunk (`rapier-*.js` lazy chunk, expected).
- Continuity-doc version markers (`todo.md`, `progress.md`, `HANDOFF.md`) updated.
- `MVP_APPROVAL_STATE.json` reset to `pending` against the new version — a v0.2.259 approval cannot accidentally carry over.

## Out of scope (parked, audit knew about these)

- **S1**: schnorr verify of `verifyHandoff` — would add the first runtime dependency, deferred.
- **R1**: split the SDK barrel (`continuumData.js` 139 KB) out of the runtime path — needs a careful import-graph refactor, deferred.
- **R2**: lazy-load `THREE` behind ENTER ARENA — game-loop refactor (the audit notes the arena modules statically import addons today).
- **S3**: move CSP from `<meta>` to an HTTP header — deploy/host change, not in-repo.
- **S4**: vendor the Draco decoder under `public/` instead of pulling `gstatic.com` — bundle size trade-off, deferred. CSP already allows the gstatic origin.
- **E2 / E3**: `--changed` flag for vitest and splitting the largest test files — useful but lower-leverage than E1.

## How to revert (if needed)

Each commit is independent and pure-source (no schema migrations, no on-disk format changes beyond GLB binary layout). `git revert <sha>` on any one of them is safe:

- Reverting the GLB commit (`a6e3ba9`) restores the 14.66 MB originals from git history *and* removes the DRACOLoader wiring from the 4 loader files in lockstep — the optimized binaries are gone from `public/` but the originals come back, so the loaders go back to using a vanilla `GLTFLoader` against uncompressed GLBs. The `.glb.original` working-copy backups on the maintainer's machine are an extra belt-and-braces guarantee that isn't relied on by the revert.
- Reverting the SW trim (`e6e9a33`) restores the 8-entry `PRECACHE_ASSETS`.
- Reverting S5 (`2ae0d6a`) restores the single-relay `_fetchProfile`.
- Reverting S2 (`4e3b04d`) drops the port check and the 4 new tests.
- Reverting E1 (`8bdfb9f`) goes back to per-file isolation; tests still pass, just slower.
- Reverting hygiene (`893cf9c`) drops the `.gitignore` entries.

Reference: `torii-quest-audit-v0.2.259.md` (the audit that drove this pass).

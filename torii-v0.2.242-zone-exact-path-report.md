# Torii Quest — v0.2.242-alpha — Zone deep-link exact-path repair

**Slice:** HARD-56 (GAME) · **Date:** 2026-06-28 · **Verdict: SHIP** (release gate green; one host-side residual to confirm via live re-smoke)

---

## 1. Problem (live v0.2.241 smoke failure)

The parent live smoke of v0.2.241 reported:

1. **Direct open of `https://torii-quest.pplx.app/zone/plebeian-market-bazaar` STILL returns the host JSON 404:**
   `{"detail":"No static asset at /zone/plebeian-market-bazaar. If this is a backend API call, prefix the path with /port/5000/ — backend ports are not auto-routed."}`
2. Root `/` loads and shows v0.2.241-alpha, but the smoke tester reported ENTER ARENA did not initialize the 3D arena (secondary; verify/fix if reproducible).

---

## 2. Root cause

v0.2.241 generated the zone shell at **`dist/zone/<slug>/index.html`** (a nested directory-index file). That form only resolves on a host that maps the extensionless URL `/zone/<slug>` → directory → `index.html` (directory-index resolution).

The live static host (`torii-quest.pplx.app`) does **none** of:
- SPA rewrite (`try_files … /index.html`),
- backend routing,
- **directory-index resolution** for an extensionless path.

It matches files by **EXACT path only**. So the no-trailing-slash URL `/zone/plebeian-market-bazaar` matched no on-disk file and returned the host JSON 404 — the v0.2.182 client route parser never got a chance to run. The v0.2.241 nested shell was effectively dead for the URL the in-app portal actually pushes.

---

## 3. Fix (no backend)

Write the shell at the **EXACT extensionless path** the host is asked for:

- The build now writes a real file at **`dist/zone/<slug>`** (no `/index.html`, no trailing slash), **byte-identical to `dist/index.html`**, for every `DEPLOYABLE_ZONE_SLUGS` entry.
- Because `dist/index.html` references its bundle with **root-absolute** URLs (`/assets/…`), the shell at the sub-path loads the same JS/CSS; the app boots and `_applyZoneRoute()` resolves the slug exactly as for an in-world portal hop.

### File-vs-directory impossibility (the task's "keep both" cannot hold)

The task asked to keep **both** `dist/zone/<slug>/index.html` and the exact `dist/zone/<slug>`. A regular **file** named `dist/zone/<slug>` and a **directory** named `dist/zone/<slug>/` cannot coexist under one name on a filesystem — they are mutually exclusive. Therefore the exact-path file **REPLACES** the v0.2.241 directory-index form. The regression coverage was adapted accordingly: it asserts the exact-path file exists, is a file, and is byte-identical to the shell, **AND** that no directory-index shell is left behind.

---

## 4. Files changed

**Build / tooling (extensionless `/zone/<slug>` shell):**
- `tools/zoneShells.mjs` — `zoneShellPathFor(slug)` → `` `zone/${slug}` `` (was `zone/<slug>/index.html`); removed `ZONE_SHELL_INDEX`; header rewritten to the v0.2.242 exact-path strategy + the file-vs-directory note. `zoneShellRouteFor` / `planZoneShells` unchanged.
- `tools/generate-zone-shells.mjs` — header → v0.2.242 exact-path; generator logic unchanged (`mkdirSync(dirname(out),{recursive:true}); writeFileSync(out, shell)` — `dirname` now `dist/zone`). Build log: `[zone-shells] wrote zone/plebeian-market-bazaar`.
- `tools/zoneFallbackReadiness.mjs` — `ZONE_SHELL_RE = /^\/zone\/[a-z0-9]+(?:-[a-z0-9]+)*$/` (dropped `\/index\.html`); comments + error string → `a verified shell must be /zone/<slug> byte-identical to index.html`. `isVerifiedZoneShell` / `checkDistRoutes` / `zonePathsInDist` logic unchanged.
- `tools/zone-fallback-check.mjs` — shell regex → `/^zone\/[a-z0-9]+(?:-[a-z0-9]+)*$/`; success wording → `verified /zone/<slug> shell(s)`.
- `tools/build-continuum.mjs` — dist-shell regex → extensionless; comment updated.
- `tools/regression-check.mjs` — `EXPECTED_VERSION = 'v0.2.242-alpha'`; `[15]` shell regex → extensionless; comment updated.

**Tests (regression coverage for BOTH artifacts):**
- `tests/zone-hard-refresh.test.js` — planner expects `zone/plebeian-market-bazaar`; added "shell path has no extension and no trailing slash"; built-dist test asserts the exact-path file `isFile()` and is byte-identical to `index.html`; added "does NOT leave a directory-index shell" (`existsSync(dist/zone/<slug>/index.html) === false`). Net +2.
- `tests/zone-fallback-readiness.test.js` — verified-shell cases use exact path `zone/plebeian-market-bazaar`; added "does NOT allow the v0.2.241 directory-index form as a verified shell". Net +1.

**Version markers (v0.2.241 → v0.2.242-alpha):** `src/config.js`, `package.json`, `public/sw.js` (`CACHE_VERSION`), `MVP_APPROVAL_STATE.json`, `index.html` (×2), `src/engine/gateway/zoneRoute.js` (DEPLOYABLE_ZONE_SLUGS comment), `tests/continuum-dashboard.test.js` (pins), `src/engine/dashboard/continuumData.js` (version + test status 1685 + active-slice entry), `src/engine/status/mvpReadiness.js` (default test status 1685), `NEXT_ACTION_STATE.json` (regenerated).

**Docs:** `todo.md` (HARD-56 row), `progress.md` (active slice), `HANDOFF.md` (current version + changelog), `SDK_DEBUG_INDEX.md`, `CODE_INDEX.md`, `ZONE_FALLBACK_READINESS.md` (header + §7 rewritten to the exact-path strategy + residual-risk note).

---

## 5. Tests / release gate

`npm run test:release` — **ALL GREEN**:
- build: `[zone-shells] wrote zone/plebeian-market-bazaar`.
- vitest: **1685 passed / 1685**, **102 files / 102** (was 1682/102; +3 net cases).
- `npm run check`: 15/15 guards green, including `[14]` docs reference v0.2.242-alpha and `[15]` zone fallback readiness.
- `bundle:report`: advisory only (rapier chunk over warn limit — expected/tracked, not gated).
- `handoff:status`: VERSION v0.2.242-alpha, package in sync.

**Dist verification:** `dist/zone/plebeian-market-bazaar` is a 41361-byte **file** byte-identical to `dist/index.html`; **no** directory form present (`dist/zone/plebeian-market-bazaar/index.html` absent).

---

## 6. Secondary ENTER ARENA regression

v0.2.241 made **no** changes to the boot path (`main.js` / `scene.js` / `loop.js` / `arena.js`); v0.2.242 makes none either. The v0.2.238 fail-closed render loop + boot-order fix and the v0.2.236 NIP-07 login decoupling remain intact, and the entry-flow contract tests (`tests/entry-flow-smoke.test.js`, `tests/loop-fail-closed.test.js`, `tests/sw-app-shell.test.js`) are green. The reported "ENTER ARENA did not initialize 3D arena" is most consistent with the headless/cloud smoke environment failing the Rapier WASM bootstrap (the v0.2.238 fail-closed path then returns to menu), not a source regression — no reproducible local failure was found, so no speculative boot edit was made (a blind change there risks re-introducing the very crash v0.2.238 fixed). **Recommend the parent confirm ENTER ARENA in a real browser during the live re-smoke.**

---

## 7. Constraints honored

Version bumped every marker; `godMode` false; no new `setTimeout` (only the existing nostr.js WS close + hud.js kill-feed); no new hot-path `Vector3`/`Matrix4`; debug tools ship unconditionally; ESC pause unchanged; panel-locked cursor click does not fire weapon; **no backend**; v0.2.240 SW fail-soft precache preserved (zone shells are HTML → network-first, no SW change); root entry flow preserved. **No deploy / publish / push performed.**

---

## 8. Residual risk (needs parent live re-smoke)

The fix is correct by filesystem reasoning and verified locally to the byte. The **one** thing that cannot be verified without the live host is the served **Content-Type** of an extensionless file: if `torii-quest.pplx.app` serves `dist/zone/plebeian-market-bazaar` as anything other than `text/html`, the browser will download/mis-handle it instead of booting the shell. The local fs only proves the bytes are an exact `index.html` copy.

**Parent live re-smoke after publish:** direct-open `https://torii-quest.pplx.app/zone/plebeian-market-bazaar` and confirm (a) HTTP 200, (b) `Content-Type: text/html`, (c) the app boots and shows the inert zone notice, and (d) root `/` ENTER ARENA initializes the 3D arena in a real browser.

---

## Verdict: **SHIP**

Release gate is green, the exact-path artifact is built and verified byte-identical with no stale directory form, docs/tests/status are reconciled to v0.2.242. The only open item is the host-side MIME confirmation, which is inherently a post-publish live check and cannot block a local release gate.

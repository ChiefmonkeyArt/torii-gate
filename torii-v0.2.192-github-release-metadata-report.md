# Torii Quest — v0.2.192-alpha: GitHub Release/Update Metadata

**Date:** 2026-06-25
**Type:** Safe infrastructure / tooling / docs slice (no gameplay/runtime/physics/Nostr change,
no live update execution, no runtime network)
**Scope:** Prepare the static GitHub release/update **metadata** a FUTURE torii.quest / VPS
update-checker will read to surface an inert "update available" notice — shaping + validating
the metadata locally, WITHOUT performing any live update, install, or network fetch.

---

## What shipped

A new **release/update metadata generator + spec + validator** (`npm run release:meta`) built on
the established **pure-helper + thin-CLI** pattern, and a deterministic static template
(`public/release-metadata.json`) a host/VPS update-checker can read alongside the app.

- **`tools/releaseMeta.mjs`** (PURE — no fs/network/child_process/THREE/DOM):
  - Constants: `RELEASE_META_BADGE`, `METADATA_SCHEMA_VERSION` (1), `RELEASE_META_KIND`
    (`torii-release-metadata`), `RELEASE_META_FILE` (`public/release-metadata.json`),
    `UPDATE_CHANNELS` (`stable/alpha/beta/rc/unknown`), `DEFAULT_SOURCE` (mirrors `RELEASE_SOURCE`
    in `src/engine/update/updateCheck.js`), `DIST_SPEC`, `REQUIRED_FILES`, `REQUIRED_CHECKS`,
    `CONSENT_TEXT`, `UPDATE_NOTICE`.
  - `channelForVersion(version)` → derives the channel from the prerelease tag (tagless →
    stable; unrecognised → unknown; bad input → unknown).
  - `releaseUrlsFor(owner, repo)` → the documentation-only https GitHub endpoints
    (url-encoded), the data the checker WOULD fetch (nothing here fetches).
  - `buildReleaseMeta({version, commit, owner, repo, generatedAt})` → the canonical metadata
    object: `{kind, schemaVersion, generatedAt, channel, version, commit, source, dist,
    requiredFiles, requiredChecks, update}`. Blank commit/generatedAt collapse to `null`.
  - `validateReleaseMeta(meta)` → `{ok, errors, warnings}`. **The safety floor:** it ERRORs
    (not warns) if `update.autoUpdate` or `update.actionable` is anything but `false`, and if
    `update.manual` is not `true` — machine-enforcing the no-auto-update contract — plus
    shape/channel/https-url/required-array checks. Never throws; safe on null/non-object/array.
  - `formatReleaseMeta(meta)` → concise text block with a validity line; safe on null.
- **`tools/release-meta.mjs`** (thin CLI): reads config `VERSION` + best-effort git short commit
  behind a `realpathSync` run-guard (silent on import). Modes: text (default) / `--json` /
  `--write` / `--stamp`. **READ-ONLY by default**; `--write` emits the **DETERMINISTIC**
  `public/release-metadata.json` (no commit/timestamp baked in, so re-runs never churn the
  tree); `--stamp` bakes the live commit + ISO time for a deploy step. Writes ONLY the in-repo
  safe path, no network, ALWAYS exits 0.
- **`public/release-metadata.json`** (new static template): the deterministic metadata record,
  copied into `dist/` by `npm run build` so a deployed instance / VPS checker can read
  `/release-metadata.json` next to the app.
- **`package.json`**: added `"release:meta": "node tools/release-meta.mjs"`.
- **`tests/release-meta.test.js`** (23 tests): channel derivation, URL shaping, the
  `buildReleaseMeta` assembly + determinism, the `validateReleaseMeta` safety floor (incl. the
  no-auto-update ERROR + degraded inputs) and warnings, and the text formatter.

---

## Advisory / no-gate / no-runtime — the decision

`release:meta` is a **local visibility + artifact-generation tool**, deliberately NOT wired into
`npm run check`. It performs no live update and touches no runtime code path: the game still
ships only the inert, display-only update-check view-models (`actionable:false`) from
`src/engine/update/*`. The metadata is descriptive only and the validator makes the
no-auto-update contract machine-enforced. Deploying a release stays the manual maintainer step
(HANDOFF.md §7 / VPS_INSTALL.md §7,§12 / UPDATE_CHECK.md §4,§5).

---

## Constraints honoured

- Version bumped to **v0.2.192-alpha** across `src/config.js`, `index.html` (2 markers),
  `package.json`, `tools/regression-check.mjs` (`EXPECTED_VERSION` + stale-guard now flags the
  previous `v0.2.191-alpha` literal), `tests/continuum-dashboard.test.js`,
  `src/engine/dashboard/continuumData.js`, and the continuity docs.
- `godMode` stays `false`; no new `setTimeout`; no new `Vector3`/`Matrix4` in hot paths;
  comments use `nostrich`; Chiefmonkey spelling preserved; debug tools ship unconditionally;
  ESC pause + panel-click fire safety untouched.
- **No change** to gameplay, portal runtime behaviour, physics, shooting, controls, live Nostr
  write behaviour, or real update execution. New tooling is local-only / read-only / no-network
  (the single `--write` path writes only the in-repo `public/release-metadata.json`).

---

## Tests & checks run

| Check | Result |
|-------|--------|
| `node tools/release-meta.mjs` (text) | ✅ renders + validates (✓ metadata valid) |
| `--json` | ✅ parseable metadata object |
| `--write` (idempotent) | ✅ deterministic `public/release-metadata.json`, identical bytes on re-run |
| `npx vitest run tests/release-meta.test.js` | ✅ 23 passed |
| `npx vitest run tests/continuum-dashboard.test.js` | ✅ 70 passed (dashboard count pins held) |
| `npm run docs:stale` | ✅ ✓ no drift detected — docs look consistent |
| `npm run test:release` (full gate) | ✅ **ALL GREEN** — `Test Files 71 passed (71)`, `Tests 1100 passed (1100)`, regression-check ALL GREEN |

Suite grew from 1077/70 (v0.2.191) to **1100 tests / 71 files** (+23 / +1).

---

## Docs updated

`todo.md` (header version + new HARD-7 row), `progress.md` (header + Source/Tests metrics
1100/71 + active-slice + active-now + completed-24h), `HANDOFF.md` (current version + v0.2.192
paragraph + latest-report line + command line), `CODE_INDEX.md` (header version + new
release/update-metadata row), `SDK_DEBUG_INDEX.md` (status version + new tool row),
`UPDATE_CHECK.md` (new §5 static-release-metadata spec), `VPS_INSTALL.md` (new §12 metadata in
the manual-update story), `src/engine/dashboard/continuumData.js` (version, totals 1100/71,
active + completed slices; oldest v0.2.188 rolled off completed-24h to keep the pinned length),
`tests/continuum-dashboard.test.js` (version pins), `public/continuum.html` +
`public/continuum-data.json` (regenerated).

---

## Security / performance concerns

- **None introduced.** The tool is pure logic + a read-only CLI; no network, no secrets, no
  child process beyond the existing best-effort `git rev-parse`. The only write target is the
  in-repo `public/release-metadata.json` under an explicit `--write`.
- The metadata is descriptive only; `validateReleaseMeta` ERRORs if the no-auto-update contract
  (`update.autoUpdate`/`update.actionable` === false) is ever violated, so the artifact can
  never become an update trigger.
- Bundle advisory unchanged: `rapier` chunk over the 700 KB warn limit (tracked, not gated —
  pre-existing).

---

## Files changed

- **New:** `tools/releaseMeta.mjs`, `tools/release-meta.mjs`, `tests/release-meta.test.js`,
  `public/release-metadata.json`, this report.
- **Modified:** `package.json`, `src/config.js`, `index.html`, `tools/regression-check.mjs`,
  `tests/continuum-dashboard.test.js`, `src/engine/dashboard/continuumData.js`,
  `public/continuum.html`, `public/continuum-data.json`, `todo.md`, `progress.md`, `HANDOFF.md`,
  `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`, `UPDATE_CHECK.md`, `VPS_INSTALL.md`.

**Commit:** _(local-only; not pushed — recorded after commit below)_

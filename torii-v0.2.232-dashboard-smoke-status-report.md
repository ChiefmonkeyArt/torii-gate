# Torii Quest v0.2.232-alpha — Dashboard-smoke status slice

**Verdict: SHIP** (status/dashboard/docs-only; no runtime change)

## What & why

v0.2.231-alpha is live and a cloud-browser smoke of the DEPLOYED oversight
dashboard (`https://torii-quest.pplx.app/continuum.html`) just passed. This slice
surfaces that result inside the existing oversight/handoff/dashboard state,
**alongside** the v0.2.231 app-entry live smoke. Where the app-entry smoke proves
the title buttons surface visible feedback, this proves the oversight surface
itself loads and visibly renders its data. No gameplay/runtime behavior changes.

## Changes

New state-artifact triple mirroring `LIVE_SMOKE_STATE`:

- **`tools/dashboardSmokeState.mjs`** — pure, node-safe module
  (`build`/`validate`/`format`/`summarize`; schema `torii.dashboard-smoke-state`)
  with a **pass-requires-evidence floor**: a `pass` verdict is a validator ERROR
  unless ≥1 check, EVERY check passing, plus a concrete version marker +
  `smokedAt`. Non-`pass`/`fail` results coerce to `unknown`.
- **`tools/dashboard-smoke-state.mjs`** — thin read-only CLI
  (`npm run dashboard:smoke`; flag-gated in-repo `--write`).
- **`DASHBOARD_SMOKE_STATE.json`** — committed record of the **v0.2.231-alpha**
  dashboard smoke (4/4): `continuum.html` loads; shows Torii Continuum
  v0.2.231-alpha; shows the folded LIVE SMOKE evidence (v0.2.230-alpha PASS 3/3,
  incl. ENTER ARENA + LOGIN WITH NOSTR); shows the active slice. No login/account
  actions performed. Captures observer/date/provenance (`smokedBy`, `smokedAt`,
  `commit`, `dashboardUrl`).

Folded into oversight surfaces:

- **`tools/nextActionState.mjs`** — `dashboardSmoke` summary + `REQUIRED_KEYS` +
  both formatters; CLI `gatherDashboardSmoke()` in `tools/next-action-state.mjs`.
- **`src/engine/dashboard/continuumData.js`** — new **Dashboard smoke** metric row.

`impliesApproval` AND `impliesPlaytestComplete` pinned **false** everywhere: a
green dashboard smoke is NOT MVP approval (stays `MVP_APPROVAL_STATE.json`) and
does NOT imply the human playtest is complete (stays `MVP_PLAYTEST_RESULTS.md`).

The recorded smoke version legitimately LAGS the build (a smoke can only observe
a DEPLOYED build), so the freshness guard asserts recorded **≤** config `VERSION`,
never leads.

## Version bump

`v0.2.231-alpha → v0.2.232-alpha` across all markers: `src/config.js`,
`package.json`, `public/sw.js` (`CACHE_VERSION`), `index.html`, and doc
"Current version" lines. `DASHBOARD_SMOKE_STATE.json` / `LIVE_SMOKE_STATE.json` /
`MVP_PLAYTEST_RESULTS.md` deliberately NOT bumped (smoke-observed / human-filled).

## Tests

- New `tests/dashboard-smoke-state.test.js`: pass-requires-evidence floor, schema,
  format/summarize, non-staleness guard on the committed artifact (recorded ≤
  config VERSION).
- Extended `tests/next-action-state.test.js`: `dashboardSmoke` summary fold +
  required keys.
- Updated `tests/continuum-dashboard.test.js` for the new row.

## Gate results

- `npm run test:release`: **94 test files / 1548 tests passed**, exit 0.
- `npm run check` (regression-check): **ALL GREEN**.
- `handoff:status`: VERSION v0.2.232-alpha, package.json in sync, 7/7 core docs.
- Bundle: advisory only (rapier chunk over warn limit — tracked, not gated).

## Hard constraints honored

- Status/dashboard/docs only — no gameplay/physics/shooting/Rapier/Nostr-write/
  gateway-execution changes.
- `godMode` false; no new `setTimeout`; no new `Vector3`/`Matrix4`.
- No deploy/publish/push/tag (main agent owns those).
- Debug tools ship unconditionally; spellings preserved.

## SHIP
No blockers. All local gates green; oversight surfaces now show the live dashboard
smoke result with full evidence/provenance, while preserving the MVP-approval and
playtest-complete distinctions.

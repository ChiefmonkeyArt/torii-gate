# Torii Quest — v0.2.203-alpha Release Report

## Slice: MVP Manual Playtest Acceptance Checklist

**Type:** docs / tooling. **No runtime behavior change. Not a gameplay change and not a live browser test.**

### Goal

Create a clear MANUAL playtest / MVP acceptance checklist the user (or a future AI
handoff) can run against the live build. It covers the full proof-of-concept surface:
launch/title screen, shooter loop, movement/footsteps, aim/hit-feedback/headshots/
body-shots, reload feel, gun/reflection sanity, mirror sanity, crates/physics-nudge
sanity, NAP monkey sanity, Continuum dashboard, release-metadata/update prompt, Nostr
read surfaces, gateway portal/travel-confirm shell — plus the known deferred/
non-blocking advisories. Each item carries pass/fail/notes fields, reproduction steps,
an expected result, a severity label, and an "if it failed" action — purpose-built for
future AI handoffs.

**This is a manual checklist generated from frozen local data — no browser automation,
no live network, no gameplay change.** A pure/local `npm run playtest:checklist` script
prints or writes bounded in-repo markdown (read-only except an explicit bounded write).

It mirrors the established pure-helper + thin-CLI pattern exactly.

### What landed

**`tools/playtestChecklist.mjs`** — PURE node-safe module (no fs/network/`child_process`/
THREE/DOM; never throws).

- `PLAYTEST_CHECKLIST_SCHEMA` = `'torii.playtest-checklist'`, `PLAYTEST_CHECKLIST_SCHEMA_VERSION` = 1
- `PLAYTEST_CHECKLIST_BADGE` = `'MVP MANUAL PLAYTEST CHECKLIST · LOCAL · READ-ONLY'`
- `PLAYTEST_CHECKLIST_WRITE_FILENAME` = `'MVP_PLAYTEST_CHECKLIST.md'`
- `PLAYTEST_CHECKLIST_TITLE` = `'Torii Quest — MVP Manual Playtest Acceptance Checklist'`
- Frozen `PLAYTEST_SEVERITIES` = `['blocker','major','minor']`
- Frozen `PLAYTEST_CHECKLIST_SECTIONS` — 13 areas keyed launch / shooter / movement /
  aim / reload / gun / mirror / crates / nap / continuum / update / nostr / gateway,
  **17 items total** (launch, shooter, and aim carry 2 items each; the rest 1), each
  `{id, title, steps[], expected, severity, ifFailed}`.
- Frozen `PLAYTEST_CHECKLIST_ADVISORIES` — 4 known deferred/non-blocking advisories.
- Frozen `PLAYTEST_CHECKLIST_HOWTO` — 4-line how-to preamble.
- `playtestItemCount()` sums the section items (= 17).
- `buildPlaytestChecklistModel({version,gitCommit,liveUrl,generatedAt})` folds the
  frozen data into a JSON-serialisable `{ schema, schemaVersion, generatedAt, badge,
  title, manual:true, version, gitCommit, liveUrl, severities, howTo, sections
  (deep-copied), itemCount, advisories, safety, rendered:false, actionable:false }`.
  - **`safety`** pins `automated/served/navigated/deployed/published/wrote/network = false`.
  - Null/garbled inputs degrade honestly and never throw.
- `formatPlaytestChecklist(model)` → text (null → `'playtest-checklist: (no checklist)'`);
  renders the badge, how-to, each `[ ] <ID>` item with `result: ____` fields, and the
  advisories under a MANUAL CHECKLIST ONLY footer.
- `formatPlaytestChecklistMarkdown(model)` → markdown (null →
  `'# Playtest checklist\n\n_(no checklist)_\n'`); ships `### [ ] <ID>` items with
  `| Result (PASS / FAIL / N/A) | Notes |` tables and the MANUAL CHECKLIST ONLY footer.

Composes ONLY frozen local data — surfaces NO serve/deploy/publish/navigate/fetch/
write/exec/spawn/run/ssh/connect method of its own.

**`tools/playtest-checklist.mjs`** — local CLI (`npm run playtest:checklist`) behind a
`realpathSync` run-guard. Builds the model from `configVersion()` + `gitCommit()` +
`HANDOFF_SUMMARY_LIVE_URL` (best-effort config/package + git reads only). Modes:
default text / `--json` / `--markdown`. `--write[=path]` (default
`MVP_PLAYTEST_CHECKLIST.md`, confined in-repo via `resolveHandoffWritePath`, exits 2 on
a rejected path) is the ONLY write. READ-ONLY/local/no-network; always exits 0 otherwise.

### Wiring (tooling only — no game / SDK / debug-shell change)

- **`package.json`**: `"playtest:checklist": "node tools/playtest-checklist.mjs"`.
- `playtestChecklist` is a build-time CLI, NOT an SDK namespace or `ToriiDebug` shell —
  it is never imported by the game. No `src/sdk` or `toriiDebug.js` change.

### Tests

- New: `tests/playtest-checklist.test.js` — **+15 tests** covering constants
  (schema/v1/badge/write-filename/title); frozen severities order; all 13 section keys
  present; every item shape (id/steps/expected/valid-severity/ifFailed) + unique ids;
  frozen advisories + how-to; `playtestItemCount()`; assembly; safety flags all false;
  deep-copy immutability; text formatter (badge/how-to/`[ ] LAUNCH-1`/`result: ____`/
  advisories/MANUAL CHECKLIST ONLY); markdown formatter (title/`### [ ] LAUNCH-1`/
  Result+Notes table/footer); null-safety; garbled-input robustness.
- Full suite after the slice: **1288 passing / 81 files**.

### Version bump (v0.2.202-alpha → v0.2.203-alpha)

`package.json`, `src/config.js` (`VERSION`), `index.html` (×2: `#version-label` +
`#ver`), `tools/regression-check.mjs` (`EXPECTED_VERSION` + stale-v0.2.202 guard),
`src/engine/status/mvpReadiness.js` (`DEFAULT_TEST_STATUS` 1273/80 → 1288/81),
`src/engine/dashboard/continuumData.js` (`CONTINUUM_VERSION` + `CURRENT_TEST_STATUS`
1288/81 + metrics rows + active/completed entries), `tests/agent-handoff.test.js`
(V/PKG pins), `tests/continuum-dashboard.test.js` (version pins),
`public/release-metadata.json` (regenerated), continuum artifacts rebuilt, dist rebuilt.

### Docs updated

`todo.md` (HARD-18 row + header), `progress.md` (header + at-a-glance + active-slice +
active-now), `HANDOFF.md` (version line + v0.2.203 narrative + latest-slice pointer),
`CODE_INDEX.md` (version + new playtest-checklist row), `SDK_DEBUG_INDEX.md` (status
version), `MVP_PLAYTEST_CHECKLIST.md` (generated via the CLI after build).

### Security-sensitive behavior

**None changed.** The playtest-checklist tool is read-only and built from frozen local
data; it injects no transport and reaches no server, so it cannot serve, deploy,
navigate, fetch, sign, publish, automate a browser, or run any game/physics/Nostr
behavior. Its single write is bounded in-repo behind `resolveHandoffWritePath`.
`godMode` remains `false`. No new `setTimeout` (only the existing allowed nostr.js WS
close + hud.js kill-feed remain), no new `Vector3`/`Matrix4` in hot paths. No gameplay/
physics/shooter/Rapier/Nostr signing/Nostr publishing/live network write/server/DNS/
SSH/updater/git tag/GitHub release/deployment change.

### Verification

- `tests/playtest-checklist.test.js` — pass (15).
- Full vitest suite — 1288 passing / 81 files.
- `npm run check` — 15/15 green ([14] reports v0.2.203 across the continuity docs).
- `npm run test:release` — see commit output.
- CLI smoke (text / `--json` / `--markdown` / `--write`) — all behave as designed.

### Blockers / warnings

- Standing advisory (never gated): `rapier-*.js` chunk > 700 KB.
- `SDK_DEBUG_INDEX.md` is an advisory doc (WARN-only in docConsistency [14]).
- The git branch label still reads `v0.2.180` (pre-existing, unrelated to this slice).
- `MVP_PLAYTEST_CHECKLIST.md` is a MANUAL checklist only — it automates nothing and is
  regenerated by the CLI. The user runs it by hand against the live build.

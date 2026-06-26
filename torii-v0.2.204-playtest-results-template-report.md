# Torii Quest — v0.2.204-alpha Release Report

## Slice: MVP Manual Playtest Results Intake Template

**Type:** docs / tooling. **No runtime behavior change. Not a gameplay change and not a live browser test.**

### Goal

Give the user (or a future AI handoff) a structured way to RECORD manual playtest
results from the v0.2.203 `MVP_PLAYTEST_CHECKLIST.md` and feed failures back into
todo/progress/handoff without ambiguity. The deliverable is a generated blank
markdown results template plus a pure/local CLI for creating it — with fields for
build/version, commit, live URL, tester, date, environment, pass/fail per checklist
item, severity, repro notes, screenshot/video refs, and a recommended next action.
A tolerant pure parser/summary can read a COMPLETED results markdown back into counts
(and a clear verdict), tolerating blanks.

**This is a results-intake template generated from frozen local data — no browser
automation, no live network, no gameplay change.** A pure/local `npm run playtest:results`
script prints or writes bounded in-repo markdown (read-only except an explicit bounded
write) and offers a read-only `--summarize`. It mirrors the established pure-helper +
thin-CLI pattern exactly, and DERIVES its item list from the v0.2.203 checklist so the
two stay in lock-step.

### What landed

**`tools/playtestResults.mjs`** — PURE node-safe module (no fs/network/`child_process`/
THREE/DOM; never throws). Imports `PLAYTEST_CHECKLIST_SECTIONS` + `PLAYTEST_SEVERITIES`
from `./playtestChecklist.mjs` so the template tracks the checklist as the single
source of truth.

- `PLAYTEST_RESULTS_SCHEMA` = `'torii.playtest-results'`, `PLAYTEST_RESULTS_SCHEMA_VERSION` = 1
- `PLAYTEST_RESULTS_SUMMARY_SCHEMA` = `'torii.playtest-results-summary'`
- `PLAYTEST_RESULTS_BADGE` = `'MVP PLAYTEST RESULTS INTAKE · LOCAL · READ-ONLY'`
- `PLAYTEST_RESULTS_WRITE_FILENAME` = `'MVP_PLAYTEST_RESULTS_TEMPLATE.md'`
- `PLAYTEST_RESULTS_TITLE` = `'Torii Quest — MVP Manual Playtest Results'`
- Frozen `PLAYTEST_RESULT_VALUES` = `['PASS','FAIL','N/A']`
- Frozen `PLAYTEST_RESULTS_META_FIELDS` — 7 build/session fields (build/commit/liveUrl
  prefilled from version/gitCommit/liveUrl; tester/date/environment/overall blank), each
  `{key,label,hint,prefill}`.
- Frozen `PLAYTEST_RESULTS_ITEM_FIELDS` — 5 per-item fields (result/severity/repro/media/
  nextAction), each `{key,label,hint}`.
- Frozen `PLAYTEST_RESULTS_HOWTO` — 4-line how-to preamble.
- `playtestResultsItemCount()` sums the section items (= 17, 13 sections).
- `buildPlaytestResultsTemplate({version,gitCommit,liveUrl,generatedAt})` derives the
  sections from the checklist and folds the frozen data into a JSON-serialisable
  `{ schema, schemaVersion, generatedAt, badge, title, manual:true, version, gitCommit,
  liveUrl, resultValues, severities, howTo, metaFields, itemFields, sections
  (each item {id,title,severity,expected}), itemCount, safety, rendered:false,
  actionable:false }`.
  - **`safety`** pins `automated/served/navigated/deployed/published/wrote/network = false`.
  - Null/garbled inputs degrade honestly and never throw.
- `formatPlaytestResultsTemplate(model)` → blank text template (null →
  `'playtest-results: (no template)'`).
- `formatPlaytestResultsTemplateMarkdown(model)` → blank markdown template (null →
  `'# Playtest results\n\n_(no template)_\n'`): a Build/session table + per-item
  Field/Value tables under a RESULTS INTAKE TEMPLATE ONLY footer.
- `parsePlaytestResults(text)` → `{ schema, items:[{id,result,raw}], total }` — a
  tolerant reader: heading-anchored on each item id, reads the **value cell** of the
  Result table row (so the placeholder hint never confuses it), strips markdown
  emphasis + parenthetical hints, classifies pass/fail/na/blank/other (FAIL-first),
  never throws.
- `summarizePlaytestResults(parsedOrText)` → `{ schema, total, counts:{total,pass,fail,
  na,blank,other}, fails:[ids], verdict }` — accepts a raw markdown string or a parsed
  object; verdict EMPTY / INCOMPLETE (any blank/other) / ATTENTION (any fail) / COMPLETE.
- `formatPlaytestResultsSummary(summary)` → text (null-safe), lists the failing ids.

Composes ONLY frozen local data + the checklist sections — surfaces NO serve/deploy/
publish/navigate/fetch/write/exec/spawn/run/ssh/connect method of its own.

**`tools/playtest-results.mjs`** — local CLI (`npm run playtest:results`) behind a
`realpathSync` run-guard. Builds the model from `configVersion()` + `gitCommit()` +
`HANDOFF_SUMMARY_LIVE_URL` (best-effort config/package + git reads only). Modes:
default text / `--json` / `--markdown`. `--write[=path]` (default
`MVP_PLAYTEST_RESULTS_TEMPLATE.md`, confined in-repo via `resolveHandoffWritePath`,
exits 2 on a rejected path) is the ONLY write. `--summarize[=path]` reads a completed
results file in-repo (rejects absolute / `..` paths, exits 2; exit 0 even if the file
is missing) and prints a text / `--json` summary. READ-ONLY/local/no-network; always
exits 0 otherwise.

### Wiring (tooling only — no game / SDK / debug-shell change)

- **`package.json`**: `"playtest:results": "node tools/playtest-results.mjs"`.
- `playtestResults` is a build-time CLI, NOT an SDK namespace or `ToriiDebug` shell —
  it is never imported by the game. No `src/sdk` or `toriiDebug.js` change.

### Tests

- New: `tests/playtest-results.test.js` — **+16 tests** covering constants
  (schemas/v1/summary-schema/badge/write-filename/title); frozen result values + meta/
  item fields + how-to; item count matches the checklist; template assembly (derives
  sections + every checklist id present, items carry severity/expected); safety flags
  all false; text formatter (badge/How to use/Build / session/`[ ] LAUNCH-1`/
  `Result (PASS / FAIL / N/A): ____`/RESULTS INTAKE TEMPLATE ONLY); markdown formatter
  (title/`## Build / session`/build+commit rows/`### [ ] LAUNCH-1`/Result row/footer);
  fresh blank template summarizes INCOMPLETE; parser (PASS/FAIL/N-A/blank classification,
  ignores the placeholder hint, tolerates a missing Result row, null-safe); summary
  (counts/fails/verdict ATTENTION, COMPLETE, EMPTY, accepts raw markdown); summary
  formatter null-safe + lists failing ids.
- Full suite after the slice: **1304 passing / 82 files**.

### Version bump (v0.2.203-alpha → v0.2.204-alpha)

`package.json`, `src/config.js` (`VERSION`), `index.html` (×2: `#version-label` +
`#ver`), `tools/regression-check.mjs` (`EXPECTED_VERSION` + stale-v0.2.203 guard),
`src/engine/status/mvpReadiness.js` (`DEFAULT_TEST_STATUS` 1288/81 → 1304/82),
`src/engine/dashboard/continuumData.js` (`CONTINUUM_VERSION` + `CURRENT_TEST_STATUS`
1304/82 + metrics rows + active/completed entries), `tests/agent-handoff.test.js`
(V/PKG pins), `tests/continuum-dashboard.test.js` (version pins),
`public/release-metadata.json` (regenerated), continuum artifacts rebuilt, dist rebuilt.

### Docs updated

`todo.md` (HARD-19 row + header), `progress.md` (header + at-a-glance + active-slice +
active-now), `HANDOFF.md` (version line + v0.2.204 narrative + latest-slice pointer),
`CODE_INDEX.md` (version + new playtest-results row), `SDK_DEBUG_INDEX.md` (status
version), `MVP_PLAYTEST_RESULTS_TEMPLATE.md` (generated via the CLI after build).

### Security-sensitive behavior

**None changed.** The playtest-results tool is read-only and built from frozen local
data + the checklist sections; it injects no transport and reaches no server, so it
cannot serve, deploy, navigate, fetch, sign, publish, automate a browser, or run any
game/physics/Nostr behavior. Its single write is bounded in-repo behind
`resolveHandoffWritePath`, and `--summarize` is an in-repo read only. `godMode` remains
`false`. No new `setTimeout` (only the existing allowed nostr.js WS close + hud.js
kill-feed remain), no new `Vector3`/`Matrix4` in hot paths. No gameplay/physics/shooter/
Rapier/Nostr signing/Nostr publishing/live network write/server/DNS/SSH/updater/git tag/
GitHub release/deployment change.

### Verification

- `tests/playtest-results.test.js` — pass (16).
- Full vitest suite — 1304 passing / 82 files.
- `npm run check` — 15/15 green ([14] reports v0.2.204 across the continuity docs).
- `npm run test:release` — see commit output.
- CLI smoke (text / `--json` / `--markdown` / `--write` / `--summarize`) — all behave
  as designed.

### Blockers / warnings

- Standing advisory (never gated): `rapier-*.js` chunk > 700 KB.
- `SDK_DEBUG_INDEX.md` is an advisory doc (WARN-only in docConsistency [14]).
- The git branch label still reads `v0.2.180` (pre-existing, unrelated to this slice).
- `MVP_PLAYTEST_RESULTS_TEMPLATE.md` is a BLANK results template only — the user fills
  it in by hand after a manual playtest, then `--summarize` rolls the completed file up.

# v0.2.217-alpha — Machine-Readable Next-Action State

**Type:** safe docs/tooling/dashboard slice (no runtime/gameplay change).
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## What & why

The repo already exposes rich handoff surfaces — the human-readable `HANDOFF.md`, the generated
`HANDOFF.generated.md` (v0.2.199 `buildAgentHandoff()`), the Continuum dashboard (Ship readiness /
RC status / manual-validation / no-blocker queue cards), and the release-readiness JSON envelope. But
the user wants agent handoffs across GPT / Claude / DeepSeek / other tools and rapid bombproof coding,
and for that a NEXT agent benefits from ONE compact, machine-readable next-action state it can read
first — version, commit, live URL, release readiness, the next safe no-blocker task, the manual
blocker flag, last-known test count, and where to look — WITHOUT parsing prose or re-deriving status.

This slice adds that state as a standalone `NEXT_ACTION_STATE.json` artifact plus a `handoff:next` CLI.
Per the work-order's "generate from existing sources, not a second task list", the builder FLATTENS
the existing `buildAgentHandoff()` export (which itself composes `buildHandoffSummary()` +
`runMvpReadiness()`) and derives the manual-blocker flag from the SAME `buildManualValidationModel()`
pill that `build-continuum.mjs` already uses — so it cannot drift from the dashboard.

## Changed / added files (2 new tool files + 1 new test + version/docs/artifacts)

### New pure builder
- `tools/nextActionState.mjs` — PURE/node-safe (no fs/network/child_process/THREE/DOM; never throws).
  Exports `NEXT_ACTION_STATE_BADGE` ('NEXT-ACTION STATE · LOCAL · READ-ONLY'),
  `NEXT_ACTION_STATE_SCHEMA` ('torii.next-action-state'), `NEXT_ACTION_STATE_SCHEMA_VERSION` (=1),
  `NEXT_ACTION_STATE_WRITE_FILENAME` (=`NEXT_ACTION_STATE.json`), frozen
  `NEXT_ACTION_STATE_REQUIRED_KEYS`, and `buildNextActionState({agentHandoff,manualValidation,
  testStatus,docs,generatedAt})` → flattens the handoff into `{schema,schemaVersion,badge,generatedAt,
  version,packageVersion,gitCommit,liveUrl,release:{ready,gateStatus,gateCommand,blockers,
  regression:{count,expected}},readiness:{pct,status},tests:{passing,files},manualBlocker:{pending,
  statusLabel,pill},nextSafeTask:{title,why,kind},constraints[],docs[],reports[],safety:{deploy,
  publish,push,tag,networkWrite,nostrWrite,godMode all false}}`. `manualBlocker.pending` =
  `manualValidation.pill !== 'no-blocker'` (null when no manual card). Null/garbled inputs degrade to
  honest nulls / `gateStatus:'UNKNOWN'` and never throw. `formatNextActionState()` /
  `formatNextActionStateMarkdown()` render text/markdown (null-safe).

### New thin CLI
- `tools/next-action-state.mjs` — does the fs/git I/O behind a `realpathSync` run-guard. Reuses
  `gatherReleaseReadiness()` + `buildHandoffSummary()` + `buildAgentHandoff()` + `runMvpReadiness()` +
  `buildManualValidationModel()`/`CURRENT_TEST_STATUS` (continuumData) + `CORE_DOCS` (handoffStatus),
  with `gatherManualValidation()` replicating build-continuum's gather and `gatherDocs()` listing the
  present core docs + `HANDOFF.generated.md`. Modes default text / `--json` / `--markdown`; writes
  `NEXT_ACTION_STATE.json` ONLY under an explicit `--write[=path]` (confined in-repo via the SHARED
  `resolveHandoffWritePath` — absolute / `..` rejected → exit 2); always exits 0 otherwise.

### package.json
- `version` 0.2.216-alpha → **0.2.217-alpha**; added `"handoff:next": "node tools/next-action-state.mjs"`.

### Tests (+13 → 1417)
- `tests/next-action-state.test.js` — constants frozen; assembly folds handoff + manual card + test
  count into a stable export with every required key always present; manual-blocker derivation
  (pending / clear / unknown); all-false safety posture; degraded (no input) + garbled (wrong-type)
  inputs never throw; text/markdown/null-safe formatters; no-stale-version guard tracks config
  `VERSION` and the committed `NEXT_ACTION_STATE.json` matches `VERSION` + `CURRENT_TEST_STATUS`.

### Version bump
- `src/config.js` (`VERSION`), `index.html` (×2), `tools/regression-check.mjs` (`EXPECTED_VERSION` +
  stale guard now rejects v0.2.216-alpha), `src/engine/dashboard/continuumData.js` (`CONTINUUM_VERSION`
  + `CURRENT_TEST_STATUS` 1404/86 → 1417/87 + Source version metric + Active slice narrative),
  `src/engine/status/mvpReadiness.js` (`DEFAULT_TEST_STATUS` 1417/87), `tests/continuum-dashboard.test.js`
  (4 version pins).

### Docs
- `todo.md` (header + new HARD-31 row), `progress.md` (header / Source version / Tests / Active slice /
  Active-now bullet), `HANDOFF.md` (version + v0.2.217 narrative + report pointer), `CODE_INDEX.md`
  (version + new next-action-state tool row), `SDK_DEBUG_INDEX.md` (status version).

### Regenerated artifacts
- `NEXT_ACTION_STATE.json` (new), `RELEASE_ARTIFACT_MANIFEST.md`, `public/release-metadata.json`,
  `public/continuum.html`, `public/continuum-data.json`, `HANDOFF.generated.md`,
  `MVP_RELEASE_PACKAGE.md`, `MVP_PLAYTEST_CHECKLIST.md`, `RELEASE_NOTES_DRAFT.md`,
  `GITHUB_RELEASE_DRY_RUN.md`, `MVP_PLAYTEST_RESULTS_TEMPLATE.md`, `MVP_RC_SNAPSHOT.md` (carry
  v0.2.217-alpha).

### New
- `torii-v0.2.217-next-action-state-report.md` — this slice report.

## Tests run / results

- `npx vitest run` → **1417 passing / 87 files** (was 1404/86; +13, +1 file)
- `npm run check` → **15 / 15 ALL GREEN**
- `npm run build` → clean (standing rapier >700 KB advisory only, not gated)
- `npm run build:continuum` → all four lists derived from progress.md
- `npm run handoff:next -- --write` → writes `NEXT_ACTION_STATE.json` (path-rejection → exit 2 verified)
- `npm run test:release` → **exit 0**

## Security-sensitive behavior

**None added.** The builder is PURE/node-safe (no fs/crypto/network/child_process/THREE/DOM). The CLI
is READ-ONLY except the single opt-in `--write` output, confined in-repo via the SHARED
`resolveHandoffWritePath` (absolute / `..` rejected → exit 2). It flattens already-computed local
signals + derives the manual-blocker flag from the same manual-validation pill the dashboard uses — no
second source of truth, no new fs/crypto/git/network surface. No gameplay/physics/shooter/Rapier
change; no Nostr signing/publishing/live network write; no network/deploy/publish/tag/release/
self-update. `godMode` stays false; no new `setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey"
untouched.

## Blockers / warnings

None. Commit is **local only** — not pushed, not deployed, not published, not tagged.
Standing non-blocking advisories unchanged (rapier chunk >700 KB; SDK_DEBUG advisory; alpha).
Parent/main agent handles security review, deploy, publish, push, and Space upload.

# Torii Quest — v0.2.235-alpha: MVP Playtest Verdict Capture Loop

**Verdict: SHIP** — status/dashboard/docs-only slice; no gameplay/physics/Nostr-write/gateway behavior changed. Full release gate is green (97 files / 1618 tests passing, 15/15 regression checks ALL GREEN, build succeeds).

---

## Goal

Make the user's manual playtest notes easy to capture as structured pass/fail/blocker data that can feed MVP approval state, **without implying approval automatically**.

The verbose 17-item intake (`MVP_PLAYTEST_RESULTS.md` → `tools/playtestResults.mjs`) already existed. The gap this slice closes is the tester's most practical question: *"I just played the live build; how do I report the result in ONE line?"* This adds a terse one-line verdict capture that **complements** (does not replace) the verbose intake.

## What shipped

### New PURE single-source-of-truth module — `src/engine/status/playtestVerdict.js`
Browser+node-safe (no fs/network/child_process/THREE/DOM/tools imports). Exports:
- `parsePlaytestVerdict(text)` — reads the FIRST recognised `Verdict:` line into `{ verdict, blockers[], reportedBy, reportedAt, raw }`. Tolerant of `**Verdict**`, leading `-`/`>`/`|` (markdown table cells like `| Verdict | MVP OK |`), case, and OK synonyms (`no blockers` / `all pass` / `clean`). Captures optional `Reported by:` / `Date:` metadata regardless of line order. A blank/garbled file → `pending`; an empty `blockers:` list degrades to `pending`.
- `summarizePlaytestVerdictForState(input)` — one compact JSON-serialisable state (accepts raw text OR a parse result). `approvalImplied` pinned **false** in every branch; `safety` block all-false.
- `buildPlaytestVerdictCard(input)` — render-ready Continuum card. Blocked → `open-edge` pill so a reported blocker can never be hidden; ok/pending → `manual`.
- Frozen vocabulary: `PLAYTEST_VERDICTS` = `{pending, ok, blocked}`, `PLAYTEST_VERDICT_SCHEMA`, `_BADGE` (`… TESTER VERDICT ≠ MVP APPROVAL`), `_FILE` (`MVP_PLAYTEST_VERDICT.md`), `_HOWTO`, `_REQUIRED_KEYS`.

### Capture artifact — `MVP_PLAYTEST_VERDICT.md`
Concise, hand-edited, source-controlled. Ships **blank → reads as `pending`**. Carries the prose how-to plus a table whose `| Verdict | |` row the parser reads. Tester writes ONE of:
- `Verdict: MVP OK`
- `Verdict: blockers: <comma/semicolon list>`

### Read-only CLI — `tools/playtest-verdict.mjs` (`npm run playtest:verdict`)
Mirrors `playtest-capture.mjs`. Modes: default text, `--json`, in-repo `--file=path` (guarded by the shared `safeRepoRelPath` — absolute paths and `..` traversal rejected, exit 2). Always exits 0 otherwise. Strictly read-only.

### Folded into the oversight surfaces (single source of truth, no drift)
- **Continuum dashboard** (`src/engine/dashboard/continuumData.js` + `tools/build-continuum.mjs`): a "Playtest verdict" section right after the playtest-results card, reusing the shared `.metric`/`.pill` markup → **no new `<script>`, CSP/refresh-script hash unchanged**.
- **Next-action state** (`tools/nextActionState.mjs` + `tools/next-action-state.mjs` CLI): `playtestVerdict` added to `NEXT_ACTION_STATE_REQUIRED_KEYS` + both formatters. Every reported blocker stays visible in `NEXT_ACTION_STATE.json`.

## Strict semantics preserved (requirement #6)

- `approvalImplied` is pinned **false** in every branch — a verdict of `MVP OK` means the tester found NO blockers, which is NECESSARY but NOT SUFFICIENT for MVP approval.
- The explicit human OK in `MVP_APPROVAL_STATE.json` (`approved` + `approver` + `timestamp`) remains the separate, deliberate gate this verdict can never stand in for.
- `safety` block all-false (deploy/publish/push/tag/networkWrite/nostrWrite/godMode).

## Tests (requirement #7)

- **New** `tests/playtest-verdict.test.js` (+16): blank→pending, OK synonyms, blocker-list parsing into a clean array, empty-blockers→pending, metadata capture regardless of order, first-verdict-wins, markdown table cells, required-keys + `approvalImplied` false, blockerCount visibility, card pills (open-edge for blocked), how-to surfacing.
- **Extended** `tests/continuum-dashboard.test.js` (+5): section render + badge + how-to, blockers stay visible in the rendered section, no religious language, XSS-escape + exactly-one-inline-script + CSP-hash intact under hostile injected verdict content, pill within the allowed vocabulary. Bumped the three `v0.2.234-alpha` assertions + the SDK `CONTINUUM_VERSION` assertion to `v0.2.235-alpha`.
- **Extended** `tests/next-action-state.test.js` (+2): folds pending/ok/blocked verdict with `approvalImplied` false and blockers visible; `playtestVerdict` is a required key.

Suite: **1595 → 1618 passing**, files **96 → 97**.

## Version markers bumped to v0.2.235-alpha

`src/config.js`, `public/sw.js` (`tq-v0.2.235-alpha`), `package.json`, `index.html` (×2), `tools/regression-check.mjs` (`EXPECTED_VERSION`), `MVP_APPROVAL_STATE.json`, `continuumData.js` (`CONTINUUM_VERSION` + Source-version metric + Active-slice text), `CURRENT_TEST_STATUS` + `DEFAULT_TEST_STATUS` (1618/97). Docs: `todo.md` (header + HARD-49), `progress.md` (header + at-a-glance + Active slice), `HANDOFF.md`, `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`. `NEXT_ACTION_STATE.json` regenerated via `npm run handoff:next -- --write`.

## Verification

- `npm run test:release` → **ALL GREEN**: 97 test files / 1618 tests passing; 15/15 regression checks GREEN; build + bundle baseline succeed; handoff status in sync (config ⟷ package.json).
- CLI smoke: `npm run playtest:verdict` renders `pending` by default; an in-repo blocked file parses to `verdict: blocked`, both blockers visible, `approvalImplied: false`; the `--file=` guard rejects `../../tmp/...` traversal (exit refusal).

## Hard constraints honored

godMode false · no new `setTimeout` · no new `Vector3`/`Matrix4` in hot paths · comments use "nostrich" · Chiefmonkey spelling exact · debug tools ship unconditionally · non-religious ethics guard intact (dashboard test asserts no religious language) · no deploy/publish/push (left to the main agent).

---

**SHIP** — v0.2.235-alpha MVP playtest verdict capture loop. A new pure single-source-of-truth module + blank capture artifact + read-only CLI + dashboard section + next-action fold let Chiefmonkey report the live build in ONE line, keep every blocker visible, and can never imply MVP approval. Full release gate green.

# Torii Quest — v0.2.209-alpha slice report

## Generated commit-stamp clarity (tooling/docs only, no runtime change)

### Problem

Several tracked generated artifacts stamp a short git commit hash near the top:

- `HANDOFF.generated.md` (`tools/agentHandoff.mjs`)
- `MVP_RELEASE_PACKAGE.md` (`tools/releasePackage.mjs`)
- `MVP_PLAYTEST_CHECKLIST.md` (`tools/playtestChecklist.mjs`)
- `RELEASE_NOTES_DRAFT.md` (`tools/releaseNotes.mjs`)
- `GITHUB_RELEASE_DRY_RUN.md` (`tools/githubReleaseDryRun.mjs`)
- the opt-in `handoff-summary.md` (`tools/handoffSummary.mjs`)

Each artifact is **written before the commit that will contain it**, so the hash
they capture is repo HEAD at generation time — i.e. the **parent** of the file's
own commit. The bare labels `commit` / `Git commit` imply the stamped hash *is*
the file's final commit, which it never can be. Security review flagged this as
cosmetic but potentially stale/misleading.

### Fix

A single shared PURE/node-safe wording helper, `tools/commitStamp.mjs` (no
fs/git/network/THREE/DOM), centralises non-misleading commit wording so the six
generators don't each duplicate it:

```js
export const SOURCE_COMMIT_NOTE =
  'commit shown is the source commit (repo HEAD at generation time); this file is '
  + 'generated before its own commit, so it does not carry that final hash';

export function sourceCommitLabel(commit) {
  const c = _clean(commit);
  return c ? `${c} (source commit at generation — precedes this file's own commit)`
           : '(unavailable)';
}

export function sourceCommitInline(commit) {
  const c = _clean(commit);
  return c ? ` @ ${c} (source)` : '';
}
```

The six generators now render their commit metadata through these helpers:

- **text** output appends `sourceCommitInline(gitCommit)` on the version/verdict line
  (e.g. `… v0.2.209-alpha @ abc1234 (source)`).
- **markdown** output uses `sourceCommitLabel(gitCommit)` and the label was changed
  from `**Git commit:**` to `**Source commit:**`.

`tools/playtestResults.mjs` (`MVP_PLAYTEST_RESULTS_TEMPLATE.md`) was **deliberately
left untouched** — its rendered `| Commit | abc1234 |` row is asserted verbatim by
`tests/playtest-results.test.js:104`, and that file is a blank intake template whose
commit cell is filled in by the tester after the fact, so the misleading-label
concern does not apply.

This is **wording-only**. No model field changed: every generator still carries the
same `gitCommit` value, so all model-field assertions (`expect(h.gitCommit).toBe(...)`)
remain valid.

### Tests

`tests/agent-handoff.test.js` (+5; 1334 → 1339), in a new describe block:

1. `SOURCE_COMMIT_NOTE` is a non-empty string explaining the source-commit timing.
2. `sourceCommitLabel('abc1234')` contains the hash, "source commit", and "precedes
   this file's own commit".
3. `sourceCommitLabel(null/''/'   '/[])` → `(unavailable)`.
4. `sourceCommitInline('abc1234')` === ` @ abc1234 (source)`; trims; null/''/[] → ''.
5. `formatAgentHandoffMarkdown(...)` contains `**Source commit:**` and the
   "precedes this file's own commit" wording and NOT `**Git commit:**`.

The cases live in an EXISTING test file, so the on-disk `*.test.js` file count stays
**84**; only the passing count changes (1334 → 1339).

### Verification

- `npx vitest run` → **1339 passing / 84 files**
- `npm run check` → **15 / 15 GREEN** ([14] reports v0.2.209-alpha; [5] version markers match)
- `npm run test:release` → exit 0
- regenerated the 6 generated artifacts via their `--write` CLIs so the committed
  copies carry the new wording

### Changed files

- `tools/commitStamp.mjs` — NEW shared wording helper (the core change)
- `tools/agentHandoff.mjs`, `tools/handoffSummary.mjs`, `tools/releasePackage.mjs`,
  `tools/releaseNotes.mjs`, `tools/playtestChecklist.mjs`, `tools/githubReleaseDryRun.mjs`
  — render commit metadata through the helper
- `tests/agent-handoff.test.js` — +5 commit-stamp tests; `V`/`PKG` version pins
- `src/config.js`, `package.json`, `index.html`, `tools/regression-check.mjs` — version bump to v0.2.209-alpha
- `src/engine/dashboard/continuumData.js` — `CONTINUUM_VERSION` + `CURRENT_TEST_STATUS` (1339) + metrics narrative
- `src/engine/status/mvpReadiness.js` — `DEFAULT_TEST_STATUS` (1339)
- `tests/continuum-dashboard.test.js` — version pins
- `todo.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md` — docs
- regenerated: `HANDOFF.generated.md`, `MVP_RELEASE_PACKAGE.md`, `MVP_PLAYTEST_CHECKLIST.md`,
  `RELEASE_NOTES_DRAFT.md`, `GITHUB_RELEASE_DRY_RUN.md`, `public/release-metadata.json`,
  `continuum.html` / `public/continuum-data.json` (build:continuum)
- `torii-v0.2.209-generated-commit-stamp-clarity-report.md` — this report

### Security-sensitive behavior

**None changed.** `tools/commitStamp.mjs` and the generators are pure + node-safe and
run at BUILD time only (never imported by the bundled game module). No schema, model
field, or render-call site changed beyond the wording of a label/inline string. No
gameplay/physics/shooter/Rapier change; no Nostr signing/publishing/live network write;
no server/DNS/SSH/updater/git-tag/GitHub-release/deploy behaviour; `godMode` stays false;
no new `setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey" untouched.

### Blockers / warnings

None.

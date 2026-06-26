# v0.2.223-alpha — MVP Playtest Results on the Continuum Dashboard

**Type:** docs / dashboard / tooling slice (no runtime/gameplay change).
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## What & why

v0.2.222 added the canonical recording file `MVP_PLAYTEST_RESULTS.md` (defaults to **not-run**)
and a pure state model (`summarizePlaytestForState`) folded into `NEXT_ACTION_STATE.json`. The
Continuum dashboard already shows **MVP approval PENDING** and **Manual validation PENDING**, but
it did NOT show whether the actual playtest had been **recorded** — only that approval was
outstanding. A tester reading the dashboard could not tell, at a glance, the difference between
"no playtest run yet" and "playtest run, results in".

This slice surfaces the v0.2.222 playtest-results state as a compact **Playtest results** card on
the Continuum dashboard, placed between the MVP-approval card and the Manual-validation card. The
card shows the recorded status (`not-run`/`incomplete`/`attention`/`complete`/`unknown`), whether
results were recorded, item counts, any failing item ids, and a clear next step. Crucially the
card **never implies approval** — `approvalImplied` is pinned `false` in every branch and a metric
states plainly that approval is a separate explicit user gate. No results are fabricated;
everything defaults to not-run / pending.

## Changed / added files

### Core deliverable
- `src/engine/dashboard/continuumData.js` — **NEW** card model + render section:
  - `PLAYTESTRESULTS_BADGE` (read-only / not-run-until-recorded / not-an-approval).
  - `PLAYTESTRESULTS_LASTKNOWN` — frozen curated **not-run** fallback.
  - `buildPlaytestResultsCardModel(input={})` — PURE, browser-safe (no fs/tools import; never
    throws). Coerces `status` to the known set, integer-coerces counts, filters string `fails`,
    derives `ran`/`complete`, and bands the card (attention→`open-edge`, incomplete→`manual`,
    complete→`no-blocker`, not-run/unknown→`manual`). Returns the standard card shape
    `{badge,kind,band,statusLabel,pill,status,ran,complete,approvalImplied:false,total,counts,fails,metrics,note}`.
    **HARD INVARIANT: `approvalImplied` pinned `false` in every branch.**
  - `CURATED_PLAYTESTRESULTS = buildPlaytestResultsCardModel()` at module load.
  - `_playtestResultsSection(pr)` render fn — reuses the existing `.metric`/`.pill` markup, default
    pill `manual`, every value HTML-escaped; no new CSS/script so the continuum CSP + inline
    refresh-script hash are untouched.
  - Wired `playtestResults: base.playtestResults || CURATED_PLAYTESTRESULTS` into
    `buildContinuumModel`; `playtestResults: model.playtestResults || null` into `continuumDataJSON`;
    `${_playtestResultsSection(m.playtestResults)}` rendered between the MVP-approval and
    manual-validation sections.

### Wiring (live gather)
- `tools/build-continuum.mjs` — reads `MVP_PLAYTEST_RESULTS.md` (read-only `stat`+read), re-shapes
  it via the pure `summarizePlaytestForState` (`tools/playtestResultsState.mjs`), and folds it into
  the card through `buildContinuumModel({playtestResults})`; on any failure degrades to the curated
  not-run card with a console note (keeps `continuumData.js` free of `tools/` imports).

### Version markers
- `src/config.js` (`VERSION`), `index.html` (×2: `#version-label` + `#ver`),
  `src/engine/dashboard/continuumData.js` (`CONTINUUM_VERSION` + "Source version" metric + Active
  slice narrative + `CURRENT_TEST_STATUS` 1463→1471 / files 89),
  `src/engine/status/mvpReadiness.js` (`DEFAULT_TEST_STATUS` 1463→1471 / files 89),
  `tools/regression-check.mjs` (`EXPECTED_VERSION` + stale guard now flags `v0.2.222-alpha`),
  `public/sw.js` (`CACHE_VERSION` → `tq-v0.2.223-alpha`),
  `package.json` (`version` 0.2.223-alpha),
  `tests/continuum-dashboard.test.js` (4 version pins).

### Tests
- `tests/continuum-dashboard.test.js` — **+8** in a new `playtest results card (v0.2.223)`
  describe block: last-known not-run model; live not-run card with next step; attention card with
  failing ids; complete NOT-AN-APPROVAL card with `approvalImplied:false`; pill vocabulary;
  `continuumDataJSON` carries `playtestResults`; `renderContinuumPage` shows the section/badge/pill;
  hostile tag-injection escaped + exactly one inline script + hash intact.
- Suite 1463/89 → **1471/89** (no new test file; files count unchanged).

### Docs
- `todo.md` (header + new HARD-37 row), `progress.md` (header / Source version / Tests 1471/89 /
  Active slice / Active-now bullet), `HANDOFF.md` (§1 Current version + v0.2.223 narrative + report
  pointer), `CODE_INDEX.md` (Current version + extended the MVP-approval dashboard row with the
  v0.2.223 playtest-results card), `SDK_DEBUG_INDEX.md` (status version).

### Regenerated artifacts
- `MVP_APPROVAL_STATE.json` (version → v0.2.223-alpha, still PENDING), `NEXT_ACTION_STATE.json`,
  `RELEASE_ARTIFACT_MANIFEST.md`, `public/release-metadata.json`, `public/continuum.html`,
  `public/continuum-data.json`, `HANDOFF.generated.md`, `MVP_RELEASE_PACKAGE.md`,
  `MVP_PLAYTEST_CHECKLIST.md`, `RELEASE_NOTES_DRAFT.md`, `GITHUB_RELEASE_DRY_RUN.md`,
  `MVP_PLAYTEST_RESULTS_TEMPLATE.md`, `MVP_RC_SNAPSHOT.md` (carry v0.2.223-alpha).
  **NOT regenerated:** `MVP_PLAYTEST_RESULTS.md` (no-clobber / persistent tester recording file).

### New
- `torii-v0.2.223-playtest-results-dashboard-report.md` — this slice report.

## Tests run / results

- `npx vitest run` → **1471 passing / 89 files**
- `npm run check` → **15 / 15 ALL GREEN**
- `npm run build` → clean (standing rapier >700 KB advisory only, not gated)
- `npm run test:release` → **exit 0**

## Security-sensitive behavior

**None added.** The new card model is pure/browser-safe (no fs/network/tools import; never throws);
the live gather is a read-only `stat`+read of one in-repo file inside the build tool. The card
reuses the existing `.metric`/`.pill` markup, so the continuum CSP and inline refresh-script hash
are untouched; every rendered value is HTML-escaped (hostile-input test confirms escape + a single
inline script + intact hash). The card **can never imply approval** — `approvalImplied` is pinned
`false` in every branch and asserted by tests (including a fully-complete playtest). No gameplay /
physics / shooter / Rapier change; no Nostr signing/publishing/live network write; no
network/deploy/publish/tag/release/self-update. `godMode` stays false; no new
`setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey" untouched.

## Blockers / warnings

- **No playtest results are recorded** — `MVP_PLAYTEST_RESULTS.md` ships blank, so the new card
  reads `not-run` / pending until the user manually records actual results.
- **MVP approval remains PENDING** — this slice records nothing as approved; approval is a separate
  explicit user gate.
- Commit is **local only** — not pushed, not deployed, not published, not tagged.
- Standing non-blocking advisories unchanged (rapier chunk >700 KB; SDK_DEBUG advisory; alpha).
- Parent/main agent handles security review, deploy, publish, push, and Space upload.

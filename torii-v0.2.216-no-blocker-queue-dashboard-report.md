# v0.2.216-alpha — Continuum No-Blocker Queue Card

**Type:** safe dashboard/docs/tooling slice (no runtime/gameplay change).
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## What & why

The Torii Continuum oversight dashboard (`/continuum.html`, generated from progress.md + todo.md +
status helpers) already surfaces Ship readiness (v0.2.188), RC / release-manifest status (v0.2.214),
and manual-validation / MVP-playtest readiness (v0.2.215). Those cards answer "is the build green?"
and "what still needs a human?" — but the user also wants to keep agents working SAFELY and know, at
a glance, what an AI agent can pick up NEXT without user input, distinguishing manual blockers from
no-blocker infrastructure jobs.

This slice adds a read-only **No-blocker queue** section just below the manual-validation card that
answers exactly that: the next safe no-runtime-risk slice (`SHIP_NEXT_SAFE_TASK`: title/why/kind),
the active/next/archive queue COUNTS, and the ONE item parked on the human (the live-browser MVP
playtest + explicit approval) kept clearly SEPARATE. Per the work-order's "derive from existing parsed
todo/progress data; do not invent a second source of truth", the card DERIVES its counts from the
SAME `taskTotals` the dashboard already parses from todo.md/progress.md.

## Changed / added files (25; 1 new)

### Dashboard data + render (pure, browser-safe)
- `src/engine/dashboard/continuumData.js` — new PURE `buildNoBlockerQueueModel(input={})` +
  `NOBLOCKERQUEUE_BADGE` ('NO-BLOCKER QUEUE · SAFE NEXT WORK · READ-ONLY') + frozen
  `NOBLOCKERQUEUE_LASTKNOWN` (curated fallback derived from `SHIP_NEXT_SAFE_TASK` + last-known counts:
  activeNow 42 / nextUp 12 / archiveClusters 11 / completed24h 27 / todoCompletedMarkers 12 /
  manualPending true). Folds plain data `{nextSafeTitle, nextSafeWhy, nextSafeKind, activeNow, nextUp,
  archiveClusters, completed24h, todoCompletedMarkers, manualPending}` into a render-ready model with
  a 6-card metrics list (Next safe task, Why safe, Awaiting user, Active now, Next up, Archive / done)
  and an honest band that SEPARATES safe-available work from the one user-gated item:
  - `manualPending` → `safe-available` / pill `no-blocker` / "NO-BLOCKER WORK AVAILABLE · MANUAL PLAYTEST AWAITS USER"
  - else → `safe-available-clear` / pill `no-blocker` / "NO-BLOCKER WORK AVAILABLE"

  With no input it degrades to `NOBLOCKERQUEUE_LASTKNOWN` (`kind:'last-known'`) and never throws —
  mirroring the rc-status/manual-validation/ship/health builders. `buildContinuumModel` attaches
  `noBlockerQueue` (falling back to `CURATED_NOBLOCKERQUEUE = buildNoBlockerQueueModel()`);
  `continuumDataJSON` carries `noBlockerQueue`. New `_noBlockerQueueSection(nb)` renderer (status pill
  from the existing vocabulary + `_healthChip(kind)` provenance chip + `_metricRows(nb.metrics)` +
  escaped note) inserted in `renderContinuumPage` immediately after `_manualValidationSection`. Reuses
  the existing `.metric`/`.pill` markup → NO new `<script>` and no new `data-k` key, so the v0.2.172
  CSP + inline refresh-script sha256 are unchanged; every value HTML-escaped. Also CONTINUUM_VERSION +
  CURRENT_TEST_STATUS.passing 1396→1404 + Source version metric + Active slice narrative.

### Build-time live gather (node side, no second source of truth)
- `tools/build-continuum.mjs` — imports `buildNoBlockerQueueModel` + `SHIP_NEXT_SAFE_TASK`
  (continuumData.js). Adds a try/catch block that builds the model from `SHIP_NEXT_SAFE_TASK`
  (title/why/kind) + the ALREADY-PARSED `taskTotals` (`activeNow`/`next12`/`archiveClusters`/
  `completed24h`/`todoCompletedMarkers` from `tools/continuumParse.mjs deriveContinuumData`) + a
  `manualPending` flag read off `manualValidation.pill !== 'no-blocker'`, and folds via
  `buildContinuumModel({noBlockerQueue})`. No crypto/git/network; degrades to curated last-known on
  failure. Generates: `no-blocker queue: NO-BLOCKER WORK AVAILABLE · MANUAL PLAYTEST AWAITS USER
  (generated) · active 42 · next 12 · archive 11 · done24h 27 · manualPending true`.

### Tests (+8 → 1404)
- `tests/continuum-dashboard.test.js` — no-blocker-queue imports + 4 version pins → v0.2.216-alpha;
  new `describe('no-blocker queue (v0.2.216)')` with 8 tests (last-known model shape: 6 metrics +
  band `safe-available` + pill `no-blocker` + statusLabel; live generated band SEPARATING safe vs
  user-gated; manual-clear variant `manualPending:false`→`safe-available-clear`; invalid/omitted
  counts fall back to last-known; pill vocabulary; JSON carries noBlockerQueue; render shows the
  section; hostile-input escape + script-hash intact).

### Version bump
- `src/config.js`, `package.json`, `index.html` (×2), `tools/regression-check.mjs` (EXPECTED_VERSION
  + stale guard now rejects v0.2.215-alpha), `src/engine/status/mvpReadiness.js` (DEFAULT_TEST_STATUS
  1396→1404).

### Docs
- `todo.md` (header + new HARD-30 row), `progress.md` (header/Source version/Tests/Active slice/
  Active-now bullet), `HANDOFF.md` (version + v0.2.216 narrative + report pointer), `CODE_INDEX.md`
  (version + project-oversight-dashboard row note), `SDK_DEBUG_INDEX.md` (status version).

### Regenerated artifacts
- `RELEASE_ARTIFACT_MANIFEST.md`, `public/release-metadata.json`, `public/continuum.html`,
  `public/continuum-data.json`, `HANDOFF.generated.md`, `MVP_RELEASE_PACKAGE.md`,
  `MVP_PLAYTEST_CHECKLIST.md`, `RELEASE_NOTES_DRAFT.md`, `GITHUB_RELEASE_DRY_RUN.md`,
  `MVP_PLAYTEST_RESULTS_TEMPLATE.md`, `MVP_RC_SNAPSHOT.md` (carry v0.2.216-alpha).

### New
- `torii-v0.2.216-no-blocker-queue-dashboard-report.md` — this slice report.

## Tests run / results

- `npx vitest run` → **1404 passing / 86 files** (was 1396/86; +8)
- `npm run check` → **15 / 15 ALL GREEN**
- `npm run build` → clean (standing rapier >700 KB advisory only, not gated)
- `npm run build:continuum` → all four lists derived from progress.md; no-blocker queue card generated
- `npm run test:release` → **exit 0**

## Security-sensitive behavior

**None added.** The dashboard data module stays PURE/browser-safe (no fs/crypto/network/
child_process/THREE/DOM). The card reuses existing `.metric`/`.pill` markup so the Continuum CSP and
inline refresh-script sha256 are untouched; every value HTML-escaped. The build-time gather reuses the
ALREADY-PARSED `taskTotals` + the frozen `SHIP_NEXT_SAFE_TASK` constant — no new fs/crypto/git/network
and no second source of truth. No gameplay/physics/shooter/Rapier change; no Nostr signing/publishing/
live network write; no network/deploy/publish/tag/release/self-update. `godMode` stays false; no new
`setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey" untouched.

## Blockers / warnings

None. Commit is **local only** — not pushed, not deployed, not published, not tagged.
Standing non-blocking advisories unchanged (rapier chunk >700 KB; SDK_DEBUG advisory; alpha).
Parent/main agent handles security review, deploy, publish, push, and Space upload.

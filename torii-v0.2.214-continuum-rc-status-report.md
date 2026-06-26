# v0.2.214-alpha — Continuum RC / Release-Manifest Status Card

**Type:** safe dashboard/docs/tooling slice (no runtime/gameplay change).
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## What & why

The Torii Continuum oversight dashboard (`/continuum.html`, generated from progress.md + todo.md +
status helpers) already surfaced Ship readiness, Engineering health, and Deployment readiness. The
user wants clearer visual project oversight of where the build stands as a release candidate. This
slice adds a read-only **RC / release manifest** section just below Ship readiness that folds the
LOCAL release-candidate artifact posture into one band: current version, the release-artifact
MANIFEST verdict (required/optional present), RC package-doc coverage, the curated test count +
profile summary, how many MANUAL live-browser validation checks remain, and the last local
release-gate verdict.

Per the work-order's "prefer deriving from existing pure helpers/docs over duplicating logic", the
card DERIVES from the already-frozen ref lists rather than re-running any gate.

## Changed / added files

### Dashboard data + render (pure, browser-safe)
- `src/engine/dashboard/continuumData.js` — new PURE `buildRcStatusModel(input={})` +
  `RCSTATUS_BADGE` ('RC / RELEASE MANIFEST · LOCAL · READ-ONLY') + frozen `RCSTATUS_LASTKNOWN`
  (curated fallback). Folds plain data `{version, testLabel, profileSummary,
  manifest:{status,requiredPresent,required,optionalPresent,optional}, rcDocs:{present,total},
  manualValidationRemaining, gateStatusLabel}` into a render-ready model with a 7-card metrics list
  (Source version, Release manifest, RC package docs, Tests, Test profiles, Manual validation
  remaining, Last release gate) and an honest band:
  - any required artifact/RC doc missing → `artifacts-incomplete` / pill `gated` / "ARTIFACTS INCOMPLETE"
  - complete + `/^READY/i` gate → `gates-green` / pill `manual` / "LOCAL GATES GREEN · MANUAL VALIDATION + APPROVAL PENDING"
  - else → `near` / pill `manual` / "NEAR · LOCAL GATES"

  With no input it degrades to `RCSTATUS_LASTKNOWN` (`kind:'last-known'`) and never throws — mirroring
  the ship/health builders. `buildContinuumModel` attaches `rcStatus` (falling back to
  `CURATED_RCSTATUS = buildRcStatusModel()`); `continuumDataJSON` carries `rcStatus`. New
  `_rcStatusSection(rc)` renderer (status pill from the existing vocabulary + `_healthChip(kind)`
  provenance chip + `_metricRows(rc.metrics)` + escaped note) inserted in `renderContinuumPage`
  immediately after `_shipSection`. Reuses the existing `.metric`/`.pill` markup → NO new `<script>`
  and no new `data-k` key, so the v0.2.172 CSP + inline refresh-script sha256 are unchanged; every
  value HTML-escaped.

### Build-time live gather (node side, cheap file-presence only)
- `tools/build-continuum.mjs` — imports `buildRcStatusModel`, `CURRENT_TEST_STATUS`,
  `testCountLabel` (from `continuumData.js`), `RELEASE_MANIFEST_REQUIRED`/`RELEASE_MANIFEST_OPTIONAL`
  (from `./releaseManifest.mjs`), and `RC_SNAPSHOT_DOC_REFS`/`RC_SNAPSHOT_MANUAL_VALIDATION` (from
  `./rcSnapshot.mjs`). Adds a try/catch block that `existsSync`-stats each frozen ref on disk for a
  present count, computes `manifestStatus`, reuses the already-gathered `ship.statusLabel`, and folds
  the result via `buildContinuumModel({rcStatus})`. No crypto, no git, no network — cheap file
  presence only. On any failure it degrades to the curated `buildRcStatusModel()` last-known card.

### Tests
- `tests/continuum-dashboard.test.js` — added `RCSTATUS_BADGE`/`RCSTATUS_LASTKNOWN`/
  `buildRcStatusModel` to imports; 4 version pins bumped to v0.2.214-alpha; new
  `describe('RC / release-manifest status (v0.2.214)')` with +7 tests: last-known model shape, live
  generated band, ARTIFACTS INCOMPLETE on a missing required artifact/RC doc, pill vocabulary,
  `continuumDataJSON` carries `rcStatus`, `renderContinuumPage` shows the section, hostile-input
  escape + script-hash intact.

### Version bump
- `src/config.js` (VERSION), `package.json` (version), `index.html` (×2: `version-label`, `ver`),
  `tools/regression-check.mjs` (EXPECTED_VERSION + stale-version guard now rejects v0.2.213-alpha),
  `src/engine/dashboard/continuumData.js` (CONTINUUM_VERSION + CURRENT_TEST_STATUS.passing 1381→1388
  + Source version metric + Active slice narrative), `src/engine/status/mvpReadiness.js`
  (DEFAULT_TEST_STATUS.passing 1381→1388).

### Docs
- `todo.md` (header + new HARD-28 row), `progress.md` (header / Source version / Tests / Active
  slice / Active-now bullet), `HANDOFF.md` (version line + v0.2.214 narrative + report pointer),
  `CODE_INDEX.md` (version + project-oversight-dashboard row note), `SDK_DEBUG_INDEX.md` (status
  version).

### Regenerated artifacts
- `RELEASE_ARTIFACT_MANIFEST.md`, `public/release-metadata.json`, `public/continuum.html`,
  `public/continuum-data.json`, `HANDOFF.generated.md`, `MVP_RELEASE_PACKAGE.md`,
  `MVP_PLAYTEST_CHECKLIST.md`, `RELEASE_NOTES_DRAFT.md`, `GITHUB_RELEASE_DRY_RUN.md`,
  `MVP_PLAYTEST_RESULTS_TEMPLATE.md`, `MVP_RC_SNAPSHOT.md` (regenerated so committed copies carry
  v0.2.214-alpha).

### New
- `torii-v0.2.214-continuum-rc-status-report.md` — this slice report.

## Tests run / results

- `npx vitest run` → **1388 passing / 86 files** (was 1381/86; +7 in tests/continuum-dashboard.test.js)
- `npm run check` → **15 / 15 ALL GREEN**
- `npm run build` → clean (standing rapier >700 KB advisory only, not gated)
- `npm run build:continuum` → all four lists derived from progress.md; RC-status card rendered
- `npm run test:release` → **exit 0**

## Security-sensitive behavior

**None added.** The dashboard data module stays PURE/browser-safe (no fs/crypto/network/
child_process/THREE/DOM). The new card reuses existing `.metric`/`.pill` markup so the Continuum CSP
and the inline refresh-script sha256 are untouched; every value is HTML-escaped. The build-time
gather does cheap `existsSync` file-presence only — no crypto, no git, no network — and reuses the
frozen ref lists so it can never drift from the release-manifest / rc-snapshot CLIs. No
gameplay/physics/shooter/Rapier change; no Nostr signing/publishing/live network write; no
network/deploy/publish/tag/release/self-update. `godMode` stays false; no new
`setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey" untouched; debug tools unconditional.

## Blockers / warnings

None. Commit is **local only** — not pushed, not deployed, not published, not tagged.
Standing non-blocking advisories unchanged (rapier chunk >700 KB; SDK_DEBUG advisory; alpha).
Parent/main agent handles security review, deploy, publish, push, and Space upload.

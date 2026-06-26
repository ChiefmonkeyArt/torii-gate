# v0.2.221-alpha — MVP Approval Dashboard Card

**Type:** docs / dashboard / tooling slice (no runtime/gameplay change).
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## What & why

v0.2.220 added `MVP_APPROVAL_STATE.json` (defaulting to **pending**) and folded the record into the
machine-readable next-action state. But the state was only visible by running a CLI or reading JSON —
the user previously missed the manual-validation card and is now doing the playtest. We needed the
pending approval to be **impossible to miss but concise** on the human-facing Continuum dashboard,
right next to the Manual-validation / RC status surface.

This slice surfaces the v0.2.220 approval state VISIBLY on the Continuum dashboard via a new compact
MVP-approval card, placed ABOVE the Manual-validation section. It shows PENDING status, the version,
no approver / no approved-at yet, and the explicit next-step instruction. No approval is granted in
this slice — the card renders APPROVED only with full provenance, so status stays pending by
construction.

## Changed / added files

### Core deliverable
- `src/engine/dashboard/continuumData.js` — new PURE, browser-safe MVP-approval card following the
  established dashboard-card pattern:
  - `MVPAPPROVAL_BADGE` (frozen) — `MVP APPROVAL · LOCAL · READ-ONLY · PENDING UNTIL EXPLICIT USER OK`.
  - `MVPAPPROVAL_LASTKNOWN` (frozen) — pending fallback (`approved:false`, no approver/time).
  - `buildMvpApprovalModel(input={})` — coerces status; renders APPROVED **only** when
    `status==='approved'` AND `approved===true` AND both `approvedBy` + `approvedAt` are present, so a
    partial/flag-only record always shows PENDING. Emits the standard card shape + 5 metrics
    (Approval status, Version, Approved by, Approved at, Next step) with the explicit instruction
    `User: run the live-browser MVP playtest, then explicitly say "MVP approved"`. Uses the existing
    `manual` pill (PENDING) / `no-blocker` pill (APPROVED) from the allowlist — **no new
    pill/CSS/CSP/refresh-script-hash**.
  - `CURATED_MVPAPPROVAL = buildMvpApprovalModel()` at module load.
  - `_mvpApprovalSection(mv)` HTML render fn (every value HTML-escaped; pill allowlist reused),
    rendered immediately BEFORE `_manualValidationSection(...)`.
  - Wired into `buildContinuumModel` (`mvpApproval: base.mvpApproval || CURATED_MVPAPPROVAL`),
    `continuumDataJSON` (`mvpApproval: model.mvpApproval || null`), and the render order.

### Wiring (live gather)
- `tools/build-continuum.mjs` — imports `buildMvpApprovalModel` (continuumData) +
  `buildApprovalState` / `summarizeApprovalForState` / `MVP_APPROVAL_FILE` (mvpApproval.mjs); reads
  `MVP_APPROVAL_STATE.json`, re-shapes via `buildApprovalState` → `summarizeApprovalForState`, and
  injects the resulting plain-data model into `buildContinuumModel({ mvpApproval })`. On any read/parse
  failure it degrades to `buildMvpApprovalModel()` (last-known pending) with a console note. Keeps
  `continuumData.js` free of any `tools/` import (browser bundle stays clean).

### Version markers
- `src/config.js` (`VERSION`), `index.html` (×2: `#version-label` + `#ver`),
  `src/engine/dashboard/continuumData.js` (`CONTINUUM_VERSION` + "Source version" metric + Active
  slice narrative + `CURRENT_TEST_STATUS` 1443→1450 / files stays 88),
  `src/engine/status/mvpReadiness.js` (`DEFAULT_TEST_STATUS` 1443→1450 / files 88),
  `tools/regression-check.mjs` (`EXPECTED_VERSION` + stale guard now flags `v0.2.220-alpha`),
  `public/sw.js` (`CACHE_VERSION` → `tq-v0.2.221-alpha`),
  `package.json` (`version` 0.2.221-alpha),
  `tests/continuum-dashboard.test.js` (4 version pins).

### Tests
- `tests/continuum-dashboard.test.js` — +7 cases in a new `mvp approval card (v0.2.221)` describe:
  last-known pending model (5 metrics / band `pending` / pill `manual`); live generated pending card;
  strict approved-only-with-provenance (partial + flag-only stay pending); pill vocabulary in the
  allowlist; `continuumDataJSON` carries `mvpApproval`; render shows `>MVP approval<` + badge +
  `MVP APPROVAL PENDING`; SAFETY tag-injection escaped + exactly 1 inline script + refresh-hash intact.
  Suite 1443/87 → **1450/88**.

### Docs
- `todo.md` (header + new HARD-35 row), `progress.md` (header / Source version / Tests 1450/88 /
  Active slice / Active-now bullet), `HANDOFF.md` (§1 Current version + §3
  `MVP_APPROVAL_STATE.json` row note + v0.2.221 narrative + report pointer), `CODE_INDEX.md`
  (Current version + MVP-approval-state row extended with the dashboard card), `SDK_DEBUG_INDEX.md`
  (status version).

### Regenerated artifacts
- `MVP_APPROVAL_STATE.json` (version → v0.2.221-alpha, still PENDING), `NEXT_ACTION_STATE.json`,
  `RELEASE_ARTIFACT_MANIFEST.md`, `public/release-metadata.json`, `public/continuum.html`,
  `public/continuum-data.json`, `HANDOFF.generated.md`, `MVP_RELEASE_PACKAGE.md`,
  `MVP_PLAYTEST_CHECKLIST.md`, `RELEASE_NOTES_DRAFT.md`, `GITHUB_RELEASE_DRY_RUN.md`,
  `MVP_PLAYTEST_RESULTS_TEMPLATE.md`, `MVP_RC_SNAPSHOT.md` (carry v0.2.221-alpha).

### New
- `torii-v0.2.221-mvp-approval-dashboard-report.md` — this slice report.

## Tests run / results

- `npx vitest run` → **1450 passing / 88 files**
- `npm run check` → **15 / 15 ALL GREEN**
- `npm run build` → clean (standing rapier >700 KB advisory only, not gated)
- `npm run build:continuum` → all lists derived from progress.md; MVP-approval card gathered live
- `npm run test:release` → **exit 0**

## Security-sensitive behavior

**None added.** The dashboard card is read-only rendering of already-computed pending state. The card
renders APPROVED only with full provenance (`status==='approved'` AND the `approved` flag AND
approver + timestamp), so it cannot misrepresent a partial record as approved. Live state is gathered
in `build-continuum.mjs` (a tools/ build step) and injected as plain data; `continuumData.js` imports
no `tools/` module. No new pill / CSS / CSP / inline-script-hash change. No
gameplay/physics/shooter/Rapier change; no Nostr signing/publishing/live network write; no
network/deploy/publish/tag/release/self-update. `godMode` stays false; no new
`setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey" untouched.

## Blockers / warnings

- **MVP approval remains PENDING** — this slice only surfaces the state; status flips only when the
  user explicitly approves and the record is filled with `approved_by` + `approved_at`.
- Commit is **local only** — not pushed, not deployed, not published, not tagged.
- Standing non-blocking advisories unchanged (rapier chunk >700 KB; SDK_DEBUG advisory; alpha).
- Parent/main agent handles security review, deploy, publish, push, and Space upload.

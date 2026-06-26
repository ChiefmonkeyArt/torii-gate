# v0.2.220-alpha — MVP Manual-Approval State Placeholder

**Type:** docs / tooling / dashboard slice (no runtime/gameplay change).
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## What & why

Automated readiness is green and the Continuum dashboard's manual-validation card shows the MVP
playtest + explicit user approval as the one outstanding blocker. The user missed that card and is
now going to test. We needed a clean, auditable place to record MVP approval when the user says
"MVP approved", WITHOUT editing many docs by hand or guessing — and, critically, a place that
**cannot silently flip to approved**.

This slice adds a single source-of-truth approval-state artifact (`MVP_APPROVAL_STATE.json`),
defaulting to **pending**, plus a pure model and a thin read/render CLI. The next-action handoff
state now folds the record, so a FUTURE approval flips ONE file rather than scattered docs. No
approval is granted in this slice — status stays pending by construction.

## Changed / added files

### Core deliverable (new)
- `tools/mvpApproval.mjs` — PURE, node-safe model. Exports `MVP_APPROVAL_BADGE`,
  `MVP_APPROVAL_SCHEMA` (`torii.mvp-approval-state`), `MVP_APPROVAL_SCHEMA_VERSION` (=1),
  `MVP_APPROVAL_FILE` (`MVP_APPROVAL_STATE.json`), `MVP_APPROVAL_STATUSES` ({PENDING,APPROVED}),
  `APPROVAL_REQUIRED_FIELDS` (`approved_by`,`approved_at`), `MVP_APPROVAL_PENDING_NOTE`, plus
  `buildApprovalState` / `validateApprovalState` / `isApproved` / `formatApprovalState` /
  `summarizeApprovalForState`. Cannot silently approve: `buildApprovalState` coerces any `status`
  other than `'approved'` to `'pending'`; `validateApprovalState` ERRORS on a wrong
  kind/schemaVersion/status, a bad version marker, a non-null/non-string commit, an APPROVED record
  missing any required provenance field or a version marker, OR a PENDING record carrying approver
  fields; `isApproved` is strict (status `'approved'` AND validation ok). Pins
  `safety:{deploy/publish/push/tag/networkWrite/nostrWrite/godMode}` all false.
- `tools/mvp-approval-state.mjs` — thin CLI (`npm run approval:state`). Reads
  `MVP_APPROVAL_STATE.json` re-shaped through `buildApprovalState` (else a default pending for the
  current config version); modes default text / `--json`; under an explicit `--write` emits ONLY a
  PENDING record for the current version. There is deliberately **NO `--approve` path** in this
  slice. Always exits 0.
- `MVP_APPROVAL_STATE.json` — committed PENDING record: `status:"pending"`,
  `version:"v0.2.220-alpha"`, `approved_by`/`approved_at`/`commit` null, pending note, safety
  all-false, validates clean.

### Wiring
- `tools/nextActionState.mjs` — imports `summarizeApprovalForState`; `buildNextActionState` accepts
  `mvpApproval` and emits `mvpApproval:{status,approved,approvedBy,approvedAt,version}`;
  `mvpApproval` added to `NEXT_ACTION_STATE_REQUIRED_KEYS`; text + markdown formatters print an
  `MVP approval:` line.
- `tools/next-action-state.mjs` — gathers the record from `MVP_APPROVAL_STATE.json` (re-shaped via
  `buildApprovalState`, else default pending) and passes it into `buildNextActionState`.

### Version markers
- `src/config.js` (`VERSION`), `index.html` (×2: `#version-label` + `#ver`),
  `src/engine/dashboard/continuumData.js` (`CONTINUUM_VERSION` + "Source version" metric + Active
  slice narrative + `CURRENT_TEST_STATUS` 1417→1443 / 87→88),
  `src/engine/status/mvpReadiness.js` (`DEFAULT_TEST_STATUS` 1417→1443 / 87→88),
  `tools/regression-check.mjs` (`EXPECTED_VERSION` + stale guard now flags `v0.2.219-alpha`),
  `public/sw.js` (`CACHE_VERSION` → `tq-v0.2.220-alpha`),
  `package.json` (`version` 0.2.220-alpha + new `approval:state` script),
  `tests/continuum-dashboard.test.js` (4 version pins).

### Tests
- `tests/mvp-approval-state.test.js` (new) — build coercion/defaults, validate safety floor,
  isApproved strictness, formatters, and the committed `MVP_APPROVAL_STATE.json` is pending + valid +
  tracks `VERSION`.
- `tests/next-action-state.test.js` — +3 cases (pending fold → `approved:false`; approved valid vs
  partial; unknown when no record). Suite 1417/87 → **1443/88**.

### Docs
- `todo.md` (header + new HARD-34 row), `progress.md` (header / Source version / Active slice /
  Active-now bullet, Tests 1443/88), `HANDOFF.md` (§1 Current version + §3 new
  `MVP_APPROVAL_STATE.json` version-marker row + v0.2.220 narrative + report pointer),
  `CODE_INDEX.md` (Current version + new MVP-approval-state row), `SDK_DEBUG_INDEX.md` (status
  version).

### Regenerated artifacts
- `NEXT_ACTION_STATE.json` (now carries `mvpApproval` + v0.2.220), `RELEASE_ARTIFACT_MANIFEST.md`,
  `public/release-metadata.json`, `public/continuum.html`, `public/continuum-data.json`,
  `HANDOFF.generated.md`, `MVP_RELEASE_PACKAGE.md`, `MVP_PLAYTEST_CHECKLIST.md`,
  `RELEASE_NOTES_DRAFT.md`, `GITHUB_RELEASE_DRY_RUN.md`, `MVP_PLAYTEST_RESULTS_TEMPLATE.md`,
  `MVP_RC_SNAPSHOT.md` (carry v0.2.220-alpha).

### New
- `torii-v0.2.220-mvp-approval-state-report.md` — this slice report.

## Tests run / results

- `npx vitest run` → **1443 passing / 88 files**
- `npm run check` → **15 / 15 ALL GREEN**
- `npm run build` → clean (standing rapier >700 KB advisory only, not gated)
- `npm run build:continuum` → all four lists derived from progress.md
- `npm run test:release` → **exit 0**

## Security-sensitive behavior

**None added.** The approval state is read-only data plus a CLI that, by construction, can only ever
write a PENDING record (no `--approve` path); `buildApprovalState` coerces non-approved input to
pending and `validateApprovalState` rejects an approved record without explicit provenance, so the
artifact cannot silently become approved. Every record pins
`safety:{deploy/publish/push/tag/networkWrite/nostrWrite/godMode}` all false. No
gameplay/physics/shooter/Rapier change; no Nostr signing/publishing/live network write; no
network/deploy/publish/tag/release/self-update. `godMode` stays false; no new
`setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey" untouched.

## Blockers / warnings

- **MVP approval remains PENDING** — this slice records no approval; status flips only when the user
  explicitly approves and the record is filled with `approved_by` + `approved_at`.
- Commit is **local only** — not pushed, not deployed, not published, not tagged.
- Standing non-blocking advisories unchanged (rapier chunk >700 KB; SDK_DEBUG advisory; alpha).
- Parent/main agent handles security review, deploy, publish, push, and Space upload.

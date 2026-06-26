# v0.2.218-alpha — package.json Privacy Hygiene + Guard

**Type:** package.json / tooling slice (no runtime/gameplay change).
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## What & why

The v0.2.217 security review left ONE low-risk advisory: `package.json` lacked `"private": true`.
Torii Quest is a static web-app/game that is never meant to be published to the npm registry, but
without the `private` flag a stray `npm publish` (manual or from a misconfigured CI step) would
upload the whole source tree. Adding `"private": true` makes npm refuse to publish the package, and
hardening the existing regression gate ensures the flag can never be silently dropped again.

This slice adds the flag and a guard. Per the work-order's "regression OR unit guard" choice, it
extends the established regression-check `[5]` version-marker block (the same block that already
ties `package.json`'s `version` to the runtime `VERSION`) rather than adding a new unit test — this
keeps the scope tiny and the Vitest suite count unchanged (no `CURRENT_TEST_STATUS` /
`DEFAULT_TEST_STATUS` churn).

## Changed / added files

### Core deliverable
- `package.json` — added `"private": true` (directly after `"version"`); bumped `version`
  `0.2.217-alpha` → **`0.2.218-alpha`**.

### Guard (regression-check [5])
- `tools/regression-check.mjs` — bumped `EXPECTED_VERSION` to `v0.2.218-alpha`; the stale-version
  guard now flags `v0.2.217-alpha` in `index.html`. Refactored the `[5]` block to read the whole
  `pkg` object once (`const pkg = JSON.parse(readFileSync('package.json'))`) so BOTH the version
  match and the new privacy flag are checked from a single parse, and added the guard:
  `if (pkg.private !== true) fail('package.json "private" must be true (prevents accidental npm publish)'); else pass('package.json is private (no accidental publish)');`
  The check `[5]` header comment documents the new privacy assertion.

### Version markers
- `src/config.js` (`VERSION`), `index.html` (×2: `#version-label` + `#ver`),
  `src/engine/dashboard/continuumData.js` (`CONTINUUM_VERSION` + "Source version" metric + Active
  slice narrative), `tests/continuum-dashboard.test.js` (4 version pins). `CURRENT_TEST_STATUS`
  (continuumData) and `DEFAULT_TEST_STATUS` (mvpReadiness) are UNCHANGED at 1417/87 — no test added.

### Docs
- `todo.md` (header + new HARD-32 row), `progress.md` (header / Source version / Active slice /
  Active-now bullet, Tests held at 1417/87), `HANDOFF.md` (§1 Current version + v0.2.218 narrative
  block + report pointer), `CODE_INDEX.md` (Current version + Version/config row privacy-guard note),
  `SDK_DEBUG_INDEX.md` (status version).

### Regenerated artifacts
- `NEXT_ACTION_STATE.json`, `RELEASE_ARTIFACT_MANIFEST.md`, `public/release-metadata.json`,
  `public/continuum.html`, `public/continuum-data.json`, `HANDOFF.generated.md`,
  `MVP_RELEASE_PACKAGE.md`, `MVP_PLAYTEST_CHECKLIST.md`, `RELEASE_NOTES_DRAFT.md`,
  `GITHUB_RELEASE_DRY_RUN.md`, `MVP_PLAYTEST_RESULTS_TEMPLATE.md`, `MVP_RC_SNAPSHOT.md` (carry
  v0.2.218-alpha).

### New
- `torii-v0.2.218-package-private-report.md` — this slice report.

## Tests run / results

- `npx vitest run` → **1417 passing / 87 files** (unchanged; no test added)
- `npm run check` → **15 / 15 ALL GREEN** (new `package.json is private (no accidental publish)`
  pass line under check [5])
- `npm run build` → clean (standing rapier >700 KB advisory only, not gated)
- `npm run build:continuum` → all four lists derived from progress.md
- `npm run test:release` → **exit 0**

## Security-sensitive behavior

**None added — this slice REDUCES risk.** Adding `"private": true` makes npm refuse to publish this
static web-app/game; the regression-check guard ensures the flag can never be silently dropped. No
new fs/crypto/git/network surface — the guard reads `package.json` from disk inside the existing
node-only build tool. No gameplay/physics/shooter/Rapier change; no Nostr signing/publishing/live
network write; no network/deploy/publish/tag/release/self-update. `godMode` stays false; no new
`setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey" untouched.

## Blockers / warnings

None. Commit is **local only** — not pushed, not deployed, not published, not tagged.
Standing non-blocking advisories unchanged (rapier chunk >700 KB; SDK_DEBUG advisory; alpha).
Parent/main agent handles security review, deploy, publish, push, and Space upload.

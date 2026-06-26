# v0.2.211-alpha — Release Artifact Integrity Manifest

**Type:** safe docs/tooling-only infrastructure slice (no runtime/gameplay change).
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## What & why

The MVP RC package is now a deep pile of docs + generated artifacts (release notes, release
package index, GitHub release dry-run, RC snapshot, playtest checklist/results, handoff, VPS
install notes) plus served build metadata. But nothing recorded, in ONE place, *which*
artifacts a future GitHub release / VPS self-update flow must resolve, whether they are
present, and a stable checksum so the shipped copy can be verified against what was committed.

This slice adds a pure, local, read-only **release artifact integrity manifest**. It records
the REQUIRED artifacts (the minimum set a release/self-update must resolve) and the OPTIONAL
supporting artifacts, each with a present/missing flag and a sha256 + byte size the CLI
computes from disk via `node:crypto`. It bands **COMPLETE** / **INCOMPLETE** on the required
set so a missing required RC artifact is caught locally before any release is attempted, and
it stays a VISIBILITY artifact — never a gate. Authority remains `npm run test:release`.

Checksums cover in-repo text docs + small served build-metadata JSON only — **no secrets, no
large binaries** (the rapier chunk and other `dist/` bundles are intentionally not hashed),
per the work order.

## Changed / added files

### New
- `tools/releaseManifest.mjs` — PURE/node-safe assembler. Exports `RELEASE_MANIFEST_SCHEMA`
  ('torii.release-manifest') / `_SCHEMA_VERSION` (1) / `_BADGE` / `_WRITE_FILENAME`
  ('RELEASE_ARTIFACT_MANIFEST.md') / `_TITLE` / `_STATES` (frozen `['COMPLETE','INCOMPLETE']`);
  frozen `RELEASE_MANIFEST_REQUIRED` (6 `{key,file,label,category}`) + `RELEASE_MANIFEST_OPTIONAL`
  (6) + `RELEASE_MANIFEST_NOTES` (4); `buildReleaseManifestModel()`, `formatReleaseManifest()`
  (text), `formatReleaseManifestMarkdown()` (markdown). Imports `sourceCommitInline` from
  `./commitStamp.mjs`. No fs/crypto/network; null-safe; never throws.
- `tools/release-manifest.mjs` — thin CLI (`npm run release:manifest`); fs/git I/O behind a
  `realpathSync` run-guard; reads each REQUIRED+OPTIONAL file and computes a sha256 + byte size
  via `node:crypto`; read-only git (`rev-parse`, no fetch); text/`--json`/`--markdown`/
  `--write[=path]` (default `RELEASE_ARTIFACT_MANIFEST.md`, confined in-repo); always exits 0
  (exit 2 on a rejected `--write`).
- `tests/release-manifest.test.js` — 14 tests (constants/frozen lists, references-real-artifacts
  existence assertion, COMPLETE/INCOMPLETE banding, unknown-not-missing, malformed-sha rejection,
  notes default/override, safety pin, formatters, garbled-input robustness).
- `RELEASE_ARTIFACT_MANIFEST.md` — generated manifest artifact (via `--write`).
- `torii-v0.2.211-release-artifact-manifest-report.md` — this report.

### Version bump
- `src/config.js` (VERSION), `package.json` (version + new `release:manifest` script),
  `index.html` (×2), `tools/regression-check.mjs` (EXPECTED_VERSION + stale-version guard
  209→210→**210 rejected**), `src/engine/dashboard/continuumData.js` (CONTINUUM_VERSION +
  CURRENT_TEST_STATUS 1358/85→1372/86 + Source version + Active slice narrative),
  `src/engine/status/mvpReadiness.js` (DEFAULT_TEST_STATUS 1358/85→1372/86),
  `tests/continuum-dashboard.test.js` (4 version pins).

### Docs
- `todo.md` (header + new HARD-25 row), `progress.md` (header/Source version/Tests/Active
  slice/Active now bullet), `HANDOFF.md` (version line + v0.2.211 narrative + report pointer),
  `CODE_INDEX.md` (version + new releaseManifest tools-table row), `SDK_DEBUG_INDEX.md`
  (status-line version).

### Regenerated artifacts
- `RELEASE_ARTIFACT_MANIFEST.md` (NEW, via `npm run release:manifest -- --write`)
- `public/release-metadata.json`, `public/continuum.html`, `public/continuum-data.json`
  (build:continuum / release:meta)
- `HANDOFF.generated.md`, `MVP_RELEASE_PACKAGE.md`, `MVP_PLAYTEST_CHECKLIST.md`,
  `RELEASE_NOTES_DRAFT.md`, `GITHUB_RELEASE_DRY_RUN.md`, `MVP_PLAYTEST_RESULTS_TEMPLATE.md`,
  `MVP_RC_SNAPSHOT.md` (regenerated so committed copies carry v0.2.211-alpha)

## Tests run / results

- `npx vitest run` → **1372 passing / 86 files** (was 1358/85; +14 new file)
- `npm run check` → **15 / 15 ALL GREEN** ([14] reports v0.2.211-alpha; [5] config↔package match)
- `npm run build` → clean (standing rapier >700 KB advisory only, not gated)
- `npm run build:continuum` → all four lists derived from progress.md, no gaps
- `npm run test:release` → **exit 0**
- `npm run release:manifest` → prints a COMPLETE manifest for v0.2.211-alpha

## Security-sensitive behavior

**None changed.** `tools/releaseManifest.mjs` + CLI are pure/node-safe, BUILD-time only (never
imported by the bundled game). No gameplay/physics/shooter/Rapier change; no Nostr
signing/publishing/live network write; no server/DNS/SSH/updater/git-tag/GitHub-release/
self-update/deploy behaviour. CLI git use is READ-ONLY (`rev-parse`, no fetch). sha256 hashing
covers in-repo text docs + small served build-metadata JSON only — no secrets, no large
binaries. `--write` is the only write and is confined inside the repo (absolute/`..` rejected).
`godMode` stays false; no new `setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey"
untouched; debug tools still ship unconditionally.

## Blockers / warnings

None. Commit is **local only** — not pushed, not deployed, not published, not tagged.
Standing non-blocking advisories unchanged (rapier chunk >700 KB; SDK_DEBUG advisory; alpha).
Parent/main agent handles security review, deploy, publish, push, and Space upload.

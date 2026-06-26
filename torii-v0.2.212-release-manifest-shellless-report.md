# v0.2.212-alpha — Release-Manifest Shell-less Report Discovery

**Type:** safe docs/tooling-only cleanup slice (no runtime/gameplay change).
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## What & why

The v0.2.211 release artifact integrity manifest shipped, but its security review noted that
the release-manifest CLI discovered recent slice reports with
`execSync('ls torii-v*-report.md 2>/dev/null')` — a hardcoded shell glob. It has **no injection
vector** (no user input, fixed literal command), but replacing it with `fs.readdirSync` + a pure
JS filter/sort is cleaner, more portable (no `ls` / shell dependency), and — by moving the logic
into the pure assembler — finally **unit-testable**.

This slice removes the shell glob. Discovery now runs through a new pure helper
`selectRecentReports(names, cap?)` in `tools/releaseManifest.mjs`; the CLI hands it
`readdirSync(ROOT)`. Behaviour is identical: report-shaped filenames are filtered, sorted
lexicographically (matching the old `ls` default order), and capped to the most recent 6.

## Changed / added files

### Tooling
- `tools/releaseManifest.mjs` (pure assembler) — NEW exports: `RELEASE_MANIFEST_REPORT_RE`
  (`/^torii-v.*-report\.md$/`), `RELEASE_MANIFEST_REPORT_CAP` (6), and
  `selectRecentReports(names, cap=RELEASE_MANIFEST_REPORT_CAP)` — filters the report-shaped
  names, trims/sorts lexicographically (deterministic), `.slice(-cap)` to the most recent; a
  non-positive/garbled cap falls back to the default; null-safe, never throws. Header comment
  bumped to v0.2.212.
- `tools/release-manifest.mjs` (CLI) — `recentReports()` now returns
  `selectRecentReports(readdirSync(ROOT))` instead of the `execSync('ls torii-v*-report.md …')`
  shell glob. Added `readdirSync` to the `node:fs` import and `selectRecentReports` to the
  `./releaseManifest.mjs` import. `execSync` stays imported solely for the read-only
  `git rev-parse --short HEAD` commit stamp. Header comment bumped to v0.2.212.

### Tests
- `tests/release-manifest.test.js` — version pins bumped to v0.2.212-alpha; +5 tests in a new
  `selectRecentReports (shell-less discovery)` block: report-shape filtering drops non-reports;
  deterministic sort regardless of input order (matches the old `ls` order); cap to the most
  recent; custom/garbled cap handling; `RELEASE_MANIFEST_REPORT_RE`/`_CAP` exposure + null-safety
  (`undefined`/non-array/garbled entries → `[]`, never throws). 14 → 19 tests in this file.

### Version bump
- `src/config.js` (VERSION), `package.json` (version), `index.html` (×2),
  `tools/regression-check.mjs` (EXPECTED_VERSION + stale-version guard 211→**211 rejected**),
  `src/engine/dashboard/continuumData.js` (CONTINUUM_VERSION + CURRENT_TEST_STATUS 1372/86→1377/86
  + Source version + Active slice narrative), `src/engine/status/mvpReadiness.js`
  (DEFAULT_TEST_STATUS 1372/86→1377/86), `tests/continuum-dashboard.test.js` (4 version pins).

### Docs
- `todo.md` (header + new HARD-26 row), `progress.md` (header/Source version/Tests/Active
  slice/Active now bullet), `HANDOFF.md` (version line + v0.2.212 narrative + report pointer),
  `CODE_INDEX.md` (version + updated releaseManifest tools-table row), `SDK_DEBUG_INDEX.md`
  (status-line version).

### Regenerated artifacts
- `RELEASE_ARTIFACT_MANIFEST.md`, `public/release-metadata.json`, `public/continuum.html`,
  `public/continuum-data.json`, `HANDOFF.generated.md`, `MVP_RELEASE_PACKAGE.md`,
  `MVP_PLAYTEST_CHECKLIST.md`, `RELEASE_NOTES_DRAFT.md`, `GITHUB_RELEASE_DRY_RUN.md`,
  `MVP_PLAYTEST_RESULTS_TEMPLATE.md`, `MVP_RC_SNAPSHOT.md` (regenerated so committed copies carry
  v0.2.212-alpha).

## Tests run / results

- `npx vitest run` → **1377 passing / 86 files** (was 1372/86; +5 in the existing file)
- `npm run check` → **15 / 15 ALL GREEN** ([14] reports v0.2.212-alpha; [5] config↔package match)
- `npm run build` → clean (standing rapier >700 KB advisory only, not gated)
- `npm run build:continuum` → all four lists derived from progress.md, no gaps
- `npm run test:release` → **exit 0**
- `npm run release:manifest` → discovers recent reports via readdirSync (no shell), COMPLETE manifest

## Security-sensitive behavior

**Reduced.** The only behavioral change is removing a `child_process` shell invocation
(`execSync('ls …')`) from the release-manifest CLI's report discovery, replacing it with
`fs.readdirSync` + a pure JS filter/sort. No new capability is added. `execSync` remains only for
the read-only `git rev-parse --short HEAD` commit stamp. The pure assembler stays pure/node-safe
(no fs/crypto/network/child_process). No gameplay/physics/shooter/Rapier change; no Nostr
signing/publishing/live network write; no server/DNS/SSH/updater/git-tag/GitHub-release/self-update/
deploy behaviour. `--write` is still the only write and is confined inside the repo (absolute/`..`
rejected). `godMode` stays false; no new `setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey"
untouched; debug tools still ship unconditionally.

## Blockers / warnings

None. Commit is **local only** — not pushed, not deployed, not published, not tagged.
Standing non-blocking advisories unchanged (rapier chunk >700 KB; SDK_DEBUG advisory; alpha).
Parent/main agent handles security review, deploy, publish, push, and Space upload.

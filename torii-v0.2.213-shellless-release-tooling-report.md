# v0.2.213-alpha — Shell-less Release Tooling Report Discovery

**Type:** safe docs/tooling-only cleanup slice (no runtime/gameplay change).
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## What & why

v0.2.212 removed the hardcoded `execSync('ls torii-v*-report.md 2>/dev/null')` shell glob from the
release-manifest CLI's recent-report discovery, replacing it with a new pure helper
`selectRecentReports(names, cap?)` in `tools/releaseManifest.mjs`. That slice's security review noted
two OTHER local tools still carried the identical tooling-only shell glob: `tools/rc-snapshot.mjs`
and `tools/release-package.mjs`. The glob has **no injection vector** (no user input, fixed literal
command), but `fs.readdirSync` + the shared pure JS filter/sort is cleaner, more portable (no `ls` /
shell dependency), and keeps report discovery unit-testable.

This slice finishes the cleanup across those remaining two tools by **reusing** the v0.2.212 helper
rather than duplicating it — so all three release tools now share one report-discovery source of
truth. Behaviour is identical: report-shaped filenames are filtered, sorted lexicographically
(matching the old `ls` default order), and capped to the most recent 6.

## Changed / added files

### Tooling
- `tools/rc-snapshot.mjs` (CLI) — `recentReports()` now returns
  `selectRecentReports(readdirSync(ROOT))` instead of the `execSync('ls torii-v*-report.md …')`
  shell glob. Added `readdirSync` to the `node:fs` import and `selectRecentReports` to a new
  `./releaseManifest.mjs` import. `execSync` stays imported solely for read-only git
  (`git rev-parse --short HEAD` commit stamp, `git status --porcelain` clean-tree,
  `git rev-parse HEAD`/`@{u}` pushed — no fetch). Header comment bumped to v0.2.213.
- `tools/release-package.mjs` (CLI) — `recentReports()` now returns
  `selectRecentReports(readdirSync(ROOT))` instead of the shell glob. Added `readdirSync` to the
  `node:fs` import and `selectRecentReports` to a new `./releaseManifest.mjs` import. `execSync`
  stays imported solely for the read-only `git rev-parse --short HEAD` commit stamp.
- `tools/releaseManifest.mjs` — UNCHANGED this slice (the shared `selectRecentReports` /
  `RELEASE_MANIFEST_REPORT_RE` / `RELEASE_MANIFEST_REPORT_CAP` already exist from v0.2.212).

### Tests
- `tests/rc-snapshot.test.js` — version fixture pin bumped to v0.2.213-alpha; +2 tests in a new
  `rc-snapshot CLI — shell-less report discovery` block: the CLI source no longer matches the
  `execSync('ls …')` / `ls torii-v` glob, and DOES import + call the shared `selectRecentReports`
  via `readdirSync`.
- `tests/release-package.test.js` — added `readFileSync`/`fileURLToPath`/`dirname`/`join` imports +
  a `REPO_ROOT`; +2 tests in a new `release-package CLI — shell-less report discovery` block (same
  two assertions against `tools/release-package.mjs`).

### Version bump
- `src/config.js` (VERSION), `package.json` (version), `index.html` (×2),
  `tools/regression-check.mjs` (EXPECTED_VERSION + stale-version guard now rejects v0.2.212),
  `src/engine/dashboard/continuumData.js` (CONTINUUM_VERSION + CURRENT_TEST_STATUS 1377/86→1381/86
  + Source version + Active slice narrative), `src/engine/status/mvpReadiness.js`
  (DEFAULT_TEST_STATUS 1377/86→1381/86), `tests/continuum-dashboard.test.js` (4 version pins).

### Docs
- `todo.md` (header + new HARD-27 row), `progress.md` (header/Source version/Tests/Active
  slice/Active now bullet), `HANDOFF.md` (version line + v0.2.213 narrative + report pointer),
  `CODE_INDEX.md` (version + rc-snapshot/release-package rows note shell-less discovery),
  `SDK_DEBUG_INDEX.md` (status-line version).

### Regenerated artifacts
- `RELEASE_ARTIFACT_MANIFEST.md`, `public/release-metadata.json`, `public/continuum.html`,
  `public/continuum-data.json`, `HANDOFF.generated.md`, `MVP_RELEASE_PACKAGE.md`,
  `MVP_PLAYTEST_CHECKLIST.md`, `RELEASE_NOTES_DRAFT.md`, `GITHUB_RELEASE_DRY_RUN.md`,
  `MVP_PLAYTEST_RESULTS_TEMPLATE.md`, `MVP_RC_SNAPSHOT.md` (regenerated so committed copies carry
  v0.2.213-alpha).

## Tests run / results

- `npx vitest run` → **1381 passing / 86 files** (was 1377/86; +4 across the two existing files)
- `npm run check` → **15 / 15 ALL GREEN** ([14] reports v0.2.213-alpha; [5] config↔package match)
- `npm run build` → clean (standing rapier >700 KB advisory only, not gated)
- `npm run build:continuum` → all four lists derived from progress.md, no gaps
- `npm run test:release` → **exit 0**
- `npm run rc:snapshot` / `npm run release:package` → discover recent reports via readdirSync (no shell)

## Security-sensitive behavior

**Reduced.** The only behavioral change is removing two `child_process` shell invocations
(`execSync('ls …')`) from the rc-snapshot and release-package CLIs' report discovery, replacing them
with `fs.readdirSync` + the shared pure JS filter/sort. No new capability is added. `execSync`
remains in both only for read-only git. The pure assembler stays pure/node-safe (no
fs/crypto/network/child_process). After this slice no `tools/` CLI uses a shell `ls` glob (only a
comment in `releaseManifest.mjs` references the removed glob). No gameplay/physics/shooter/Rapier
change; no Nostr signing/publishing/live network write; no server/DNS/SSH/updater/git-tag/
GitHub-release/self-update/deploy behaviour. `--write` is still the only write and is confined inside
the repo (absolute/`..` rejected). `godMode` stays false; no new `setTimeout`/`Vector3`/`Matrix4`;
"nostrich"/"Chiefmonkey" untouched; debug tools still ship unconditionally.

## Blockers / warnings

None. Commit is **local only** — not pushed, not deployed, not published, not tagged.
Standing non-blocking advisories unchanged (rapier chunk >700 KB; SDK_DEBUG advisory; alpha).
Parent/main agent handles security review, deploy, publish, push, and Space upload.

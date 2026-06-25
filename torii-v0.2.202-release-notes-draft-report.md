# Torii Quest — v0.2.202-alpha Release Report

## Slice: MVP Proof Release-Notes Draft

**Type:** docs / tooling. **No runtime behavior change.**

### Goal

Create a DRAFT release-notes artifact for the first MVP proof-of-concept candidate,
based only on the current local status/reports/docs. It should concisely explain
what has been built — shooter proof loop, Nostr read/profile/leaderboard proof
surfaces, gateway travel shell, update/VPS readiness, Continuum dashboard, SDK/debug
handoff surfaces, tests/guardrails — plus the known non-blocking advisories. **This
is a draft only: no GitHub release, no tag, no public announcement, no network.**
Optionally add a pure/local `npm run release:notes` script that prints or writes
bounded in-repo markdown (read-only except an explicit bounded write).

The upstream signals already exist and are reused verbatim:
- `buildMvpRcGate()` (v0.2.201) → the release-candidate verdict (status/pct/reasons).
- `runMvpReadiness()` (v0.2.198) → the MVP readiness rollup (pct/status/signals).
- `buildHandoffSummary()` (v0.2.199) → the handoff brief + latest reports.

This slice adds a thin layer that COMPOSES those into a single human/markdown
release-notes draft — it re-derives no check. It mirrors the established
pure-helper + thin-CLI pattern exactly.

### What landed

**`tools/releaseNotes.mjs`** — PURE node-safe module (no fs/network/`child_process`/
THREE/DOM; never throws).

- `RELEASE_NOTES_SCHEMA` = `'torii.release-notes'`, `RELEASE_NOTES_SCHEMA_VERSION` = 1
- `RELEASE_NOTES_BADGE` = `'MVP PROOF RELEASE NOTES · DRAFT · LOCAL · READ-ONLY'`
- `RELEASE_NOTES_WRITE_FILENAME` = `'RELEASE_NOTES_DRAFT.md'`
- `RELEASE_NOTES_TITLE` = `'Torii Quest — MVP Proof-of-Concept'`
- Frozen `RELEASE_NOTES_SECTIONS` — 7 curated "what's built" sections, each
  `{heading, items[]}`: Shooter proof loop; Nostr read / profile / leaderboard proof
  surfaces; Gateway travel shell; Update / VPS readiness; Continuum dashboard;
  SDK / debug handoff surfaces; Tests / guardrails.
- Frozen `RELEASE_NOTES_ADVISORIES` — 3 known non-blocking advisories (rapier chunk
  > 700 KB; `SDK_DEBUG_INDEX.md` advisory doc; alpha SEC-gated work parked).
- `buildReleaseNotesModel({rcGate,mvpReadiness,handoff,version,gitCommit,liveUrl,
  reports,generatedAt})` folds the three upstream signals into a JSON-serialisable
  `{ schema, schemaVersion, generatedAt, badge, title, draft:true, version,
  gitCommit, liveUrl, candidate:{present,status,isCandidate,pct,reasons},
  readiness:{present,pct,status,ok}, sections, advisories, latestReports, safety,
  rendered:false, actionable:false }`.
  - Reports prefer explicit `reports`, else `handoff.latestReports`.
  - Version resolves `version` → `rollup.currentVersion` → `gate.version` →
    `handoff.version`.
  - **`safety`** pins `released/tagged/published/announced/served/navigated/wrote/
    network = false`.
  - Null/garbled inputs degrade honestly (non-candidate, empty signals) and never throw.
- `formatReleaseNotes(model)` → text (null → `'release-notes: (no draft)'`).
- `formatReleaseNotesMarkdown(model)` → markdown with title
  `'# Torii Quest — MVP Proof-of-Concept — Release Notes (DRAFT)'` (null →
  `'# Release notes (draft)\n\n_(no draft)_\n'`).

Composes ONLY the already-shipped pure signals — surfaces NO release/tag/publish/
announce/serve/navigate/fetch/write/exec/spawn/run/ssh/connect method of its own.

**`tools/release-notes.mjs`** — local CLI (`npm run release:notes`) behind a
`realpathSync` run-guard. Reuses `gatherReleaseReadiness()` + `runMvpReadiness()` +
`buildHandoffSummary()` + `buildMvpRcGate()`; does best-effort git + config/package
fs reads only. Modes: default text / `--json` / `--markdown`. `--write[=path]`
(default `RELEASE_NOTES_DRAFT.md`, confined in-repo via `resolveHandoffWritePath`,
exits 2 on a rejected path) is the ONLY write. READ-ONLY/local/no-network; creates no
release, cuts no git tag, makes no announcement; always exits 0 otherwise.

### Wiring (tooling only — no game / SDK / debug-shell change)

- **`package.json`**: `"release:notes": "node tools/release-notes.mjs"`.
- `releaseNotes` is a build-time CLI, NOT an SDK namespace or `ToriiDebug` shell — it
  is never imported by the game. No `src/sdk` or `toriiDebug.js` change.

### Tests

- New: `tests/release-notes.test.js` — **+13 tests** covering constants
  (schema/v1/badge/write-filename/title); frozen sections + advisories coverage;
  assembly (folds rcGate + rollup + handoff); report preference vs. fallback;
  version resolution; safety flags all false; non-candidate honesty; formatters
  (text + markdown title); null-safety; garbled-input robustness.
- Full suite after the slice: **1273 passing / 80 files**.

### Version bump (v0.2.201-alpha → v0.2.202-alpha)

`package.json`, `src/config.js` (`VERSION`), `index.html` (×2: `#version-label` +
`#ver`), `tools/regression-check.mjs` (`EXPECTED_VERSION` + stale-v0.2.201 guard),
`src/engine/status/mvpReadiness.js` (`DEFAULT_TEST_STATUS` 1260/79 → 1273/80),
`src/engine/dashboard/continuumData.js` (`CONTINUUM_VERSION` + `CURRENT_TEST_STATUS`
1273/80 + metrics rows + active/completed entries), `tests/agent-handoff.test.js`
(V/PKG pins), `tests/continuum-dashboard.test.js` (version pins),
`public/release-metadata.json` (regenerated), continuum artifacts rebuilt, dist rebuilt.

### Docs updated

`todo.md` (HARD-17 row), `progress.md` (header + at-a-glance + active-slice +
active-now), `HANDOFF.md` (version line), `CODE_INDEX.md` (version + new release-notes
row), `SDK_DEBUG_INDEX.md` (status version), `RELEASE_NOTES_DRAFT.md` (regenerated
via the CLI after build).

### Security-sensitive behavior

**None changed.** The release-notes tool is read-only; it injects no transport and
reaches no server, so it cannot serve, deploy, navigate, fetch, sign, publish, create
a release, cut a git tag, or announce. Its single write is bounded in-repo behind
`resolveHandoffWritePath`. It composes only the already-shipped pure signals and
reflects, never mutates, readiness state. `godMode` remains `false`. No new
`setTimeout` (only the existing allowed nostr.js WS close + hud.js kill-feed remain),
no new `Vector3`/`Matrix4` in hot paths. No gameplay/physics/shooter/Rapier/Nostr
signing/Nostr publishing/live network write/server/DNS/SSH/updater/git tag/GitHub
release change.

### Verification

- `tests/release-notes.test.js` — pass (13).
- Full vitest suite — 1273 passing / 80 files.
- `npm run check` — 15/15 green ([14] reports v0.2.202 across the continuity docs).
- `npm run test:release` — see commit output.
- CLI smoke (text / `--json` / `--markdown` / `--write`) — all behave as designed.

### Blockers / warnings

- Standing advisory (never gated): `rapier-*.js` chunk > 700 KB.
- `SDK_DEBUG_INDEX.md` is an advisory doc (WARN-only in docConsistency [14]).
- The git branch label still reads `v0.2.180` (pre-existing, unrelated to this slice).
- `RELEASE_NOTES_DRAFT.md` is a DRAFT only — no GitHub release, no tag, no
  announcement. It is regenerated by the CLI and reflects the live candidate verdict
  at generation time.

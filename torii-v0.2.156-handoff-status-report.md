# Torii Quest — v0.2.156-alpha: AI-Handoff Status Snapshot

## Goal
Make it easy for any future AI/dev handoff to see the project's state at a glance —
current VERSION, package version, git commit, the regression checks that exist, the
bundle baseline, the core docs, and the live URL — without reading every file. No
runtime/gameplay/visual change.

## What landed

### 1. `tools/handoffStatus.mjs` (NEW — pure, node-safe)
No `fs`/`network`/`child_process`/`THREE`/DOM; reuses `formatBytes` from `bundleSizes.mjs`.
- `LIVE_URL`, `CORE_DOCS`, `CHECK_COMMANDS` constants.
- `stripV(version)` — strips a leading `v`.
- `versionAgreement(configVersion, packageVersion)` — config↔package sync check
  (mirrors regression-check `[5]`).
- `buildHandoffStatus({ version, packageVersion, gitCommit, docsPresent, latestReports,
  bundle, liveUrl })` → JSON-serialisable `{ badge, version, packageVersion, versionMatch,
  gitCommit, liveUrl, checks, docs:{present,missing}, latestReports, bundle }`. Deterministic;
  copies caller arrays (no mutation).
- `formatHandoffStatus(status)` → concise text block; flags version DRIFT and MISSING docs.

### 2. `tools/handoff-status.mjs` (NEW — CLI) + `npm run handoff:status`
Does the local I/O only: reads `src/config.js` VERSION, `package.json` version, core-doc
presence, the latest `torii-*-report.md` names by mtime, and an optional `dist/` gzip
bundle summary; asks git for the short commit **best-effort** (falls back to
`(unavailable)` — never throws, no repo required). Network-free, no secrets, **always
exits 0** — a visibility tool, not a deploy gate (current-version drift is already covered
by checks `[5]`/`[14]`).

### 3. `tests/handoff-status.test.js` (NEW — 14 cases)
Covers `stripV`, `versionAgreement`, `buildHandoffStatus` (complete assembly, missing
docs, safe degradation when git/dist absent, drift surfacing, determinism, no caller-array
mutation), and `formatHandoffStatus` (renders key fields + checks, flags DRIFT/MISSING,
notes no-dist, safe on null).

## Sample output
```
Torii Quest — AI handoff status
────────────────────────────────────────────────────────────
VERSION (config.js): v0.2.156-alpha
package.json:        0.2.156-alpha  ✓ in sync
git commit:          <short-sha>
live (manual deploy): https://torii-quest.pplx.app

checks (local, no network):
  npm test               Vitest unit suite (pure helpers + contracts)
  npm run check          static + runtime regression guardrails (must be ALL GREEN)
  npm run bundle:report  advisory built-bundle size baseline (needs dist/)
  npm run handoff:status this snapshot

core docs present (7/7): README.md, todo.md, progress.md, HANDOFF.md, strategy.md, CODE_INDEX.md, SDK_DEBUG_INDEX.md
latest reports: torii-v0.2.156-handoff-status-report.md, ...

bundle baseline (advisory): total JS 2.8 MB raw / 1006.8 KB gzip (app 116.3 KB, three 609.1 KB, rapier 2.1 MB)
  advisory: over warn limit — rapier-DE6a0vmv.js (tracked, not gated)
────────────────────────────────────────────────────────────
```

## Verification
- `npm test` → **505 passed / 44 files** (was 491/43; +14 cases).
- `npm run check` → **ALL GREEN**, 14/14; check `[14]` emits zero advisories.
- `npm run bundle:report` → advisory baseline unchanged (rapier chunk tracked, not gated).
- `npm run build` → clean (known large-chunk advisory only).
- `npm run handoff:status` → prints the snapshot above; exits 0.

## Safety
godMode=false. No new `setTimeout`. No network, navigation, payments,
signing/publishing, relay/live fetch/WebSocket, auto-update, or click/raycast changes.
New code is build-time only and never imported by the game; the CLI only reads local
files and runs `git rev-parse` best-effort.

## Version markers bumped → v0.2.156-alpha
`src/config.js`, `package.json`, `index.html` (×2), `tools/regression-check.mjs`
(header, `EXPECTED_VERSION`, stale-guard now flags `v0.2.155-alpha`).

## Not done (left to parent agent)
Not pushed/published. Parent agent verifies, security-reviews, deploys, publishes,
pushes, and syncs docs.

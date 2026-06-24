# Torii Quest — v0.2.158-alpha: In-Game Update-Status Panel (LEAN-5)

## Goal
Take the read-only GitHub release-check foundation from v0.2.157
(`githubReleaseSource`) and the inert preview presentation from v0.2.142
(`updatePreview`) and fold them into ONE render-ready, display-only **update-status**
surface for the in-world UPDATE proof board / a HUD card — still with **no
auto-fetch, no auto-update, and no action surface**. Deterministic local sample data
drives the visible view; any live fetch stays a deferred, audited host step.

## What landed

### 1. `src/engine/update/updateStatus.js` (NEW — pure, node-safe)
No THREE/Rapier/DOM, no network, never throws. Exports:
- `UPDATE_STATUS_BADGE` = `'STATUS · MANUAL · NO AUTO-UPDATE'` — the manual/no-auto
  contract, explicit on the panel.
- `UPDATE_SURFACE_ID` = `'update-prompt-board'` — display-only string reference to
  the proof surface (does NOT bind/render/act).
- `SAMPLE_RELEASE_FEED` — a frozen LOCAL `releases` array (two `-alpha` prereleases;
  newest `v0.2.999-alpha` wins) so the panel shows a non-trivial "update available"
  view WITHOUT ever touching the wire.
- `updateStatusPanel(payload = SAMPLE_RELEASE_FEED, opts)` →
  `{ title:'UPDATE STATUS', badge, surface, step:'UPDATE', status, statusLabel,
  currentVersion, latestVersion, updateAvailable, prompt, notesPreview,
  source:{status,kind,candidates,errors}, sourceUrl, lines:[{label,value}],
  readOnly:true, actionable:false }`. It `selectLatestRelease`s the newest eligible
  release from a single `releases/latest` object, a `releases` array, or a manifest,
  reuses `updatePreviewBlock` for the verdict + presentation, and surfaces both the
  verdict (update-available / up-to-date / unknown) AND the source diagnostics. Lines
  are ordered Version / Latest / Status / Source / Releases. Draft/empty/malformed
  payloads degrade to UNKNOWN without throwing. Exposes NO
  fetch/install/update/navigate/href/onClick/autoUpdate/sign/publish key.
- Re-exports `statusLabel`, `UPDATE_STATUS`.

### 2. Read-only debug + SDK exposure
- `src/engine/debug/shellReport.js` — new `updateStatusReport(payload, opts)` (a
  read-only projection of `updateStatusPanel`) + an `updateStatus` key in
  `buildShellReport`. The locked 4-surface `shellsSummary` proof-board list is
  **unchanged** (still gateway/product/leaderboard/update previews).
- `src/engine/debug/toriiDebug.js` — `ToriiDebug.shells.updateStatus(payload, opts)`.
- `src/sdk/index.js` — `export * as updateStatus` + `SDK_SURFACE.updateStatus`
  (tier: experimental).

### 3. `tests/update-status.test.js` (NEW — 15 cases)
Covers update-available (sample feed picks `0.2.999-alpha`, source `list`/2
candidates), default feed, line ordering + `sourceUrl`; up-to-date (single release,
older-than-runtime, default VERSION); unknown/degraded (draft→UNKNOWN/empty,
`[]`→UNKNOWN, `null`→UNKNOWN/malformed, `includePrerelease:false`→UNKNOWN); inert
invariants (readOnly/actionable, no-action-key scan, determinism); and SDK +
`ToriiDebug.shells` exposure (experimental tier, read-only report).

## Verification
- `npm test` → **544 passed / 46 files** (was 529/45; +15 cases).
- `npm run check` → **ALL GREEN**, 14/14; check `[14]` references v0.2.158-alpha (5 docs).
- `npm run build` → clean (known large-chunk advisory only).
- `npm run bundle:report` → advisory baseline unchanged (rapier chunk tracked, not gated).
- `npm run handoff:status` → VERSION v0.2.158-alpha, package in sync; exits 0.

## Safety
godMode=false. No network/fetch/XHR/WebSocket in the module — pure compose of plain
data. No `setTimeout` added. No Vector3/Matrix4. No auto-update, install, shell,
navigation, payments, signing/publishing, relay writes, or file mutation from release
data. The panel is `readOnly:true`/`actionable:false` and exposes no action key; the
default content is a deterministic LOCAL sample feed that never reaches the wire.

## Version markers bumped → v0.2.158-alpha
`src/config.js`, `package.json`, `index.html` (×2), `tools/regression-check.mjs`
(header, `EXPECTED_VERSION`, stale-guard now flags `v0.2.157-alpha`).

## Docs updated
`todo.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`,
`UPDATE_CHECK.md` (new in-game update-status panel subsection).

## Not done (left to parent agent)
Not pushed/published. The audited host wire-up (CSP `connect-src` GitHub API entry,
rate-limiting, the actual injected fetcher) and the in-world prompt MESH/HUD that
would BIND this panel onto the `update-prompt-board` surface remain deferred. Parent
agent verifies, security-reviews, deploys, publishes, pushes, and syncs docs.

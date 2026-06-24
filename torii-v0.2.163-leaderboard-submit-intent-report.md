# Torii Quest — v0.2.163-alpha: Leaderboard Submit Intent / Preview

## Goal
Add the leaderboard **submit INTENT/PREVIEW** flow behind the v0.2.162 consent gate —
proving the SHAPE of a future score submission and guaranteeing it is BLOCKED unless
the consent gate allows it — WITHOUT enabling any live Nostr signing, relay publish,
private-key handling, NIP-07 call, WebSocket write, payment, or irreversible action.
The actual live publish remains deferred until explicit user approval in a later task.

## What landed

### 1. `src/engine/leaderboard/submitIntent.js` (NEW — pure, node-safe, inert)
No Nostr client, no WebSocket, no relay I/O, no signing, no publishing, no NIP-07, no
key handling, no payments, no DOM, no network, no auto-connect. The module NEVER
performs the submission and exposes NO sign/publish/send/connect/submit/write method —
it only prepares an unsigned event template wrapped in a consent decision. Every helper
is pure and never throws.
- `SUBMIT_ACTION` = `'leaderboard:submit'` — the single consent action it routes through.
- `sanitizeSubmitMeta(meta)` → `{ name, npub, pubkey, game }` — sanitises the
  identity/game block: `name` strips C0/DEL control chars + HTML angle brackets and caps
  at 64 chars; `npub` accepts only a lowercase bech32 `npub1…`; `pubkey` accepts only
  64-char lowercase hex; `game` is a capped clean label. Unsafe/absent → `null`. No
  unsafe URLs/HTML are ever stored.
- `buildSubmitDraft(input)` → `{ ok, draft?|errors? }` — combines a validated score
  (`leaderboard.js` `buildScore`/`validateScore`/`buildScoreEventTemplate`) with the
  sanitised identity into the inert UNSIGNED kind-30000 draft a host WOULD later
  sign+publish: `{ action, kind, score, identity, event, signed:false, published:false }`.
  A malformed score degrades to `ok:false` with NO event template built (no half-formed
  draft). The `event` carries NO pubkey/id/sig/created_at — the signer adds those later.
- `summariseSubmit(input)` → one stable, human-readable preview-only line (consent
  summary + score headline + "preview only, not submitted").
- `prepareSubmitIntent(input, grant)` → the INERT report:
  `{ ok, action, draft, consent, summary, signed:false, published:false,
  performed:false, readOnly:true, errors }`. Routes the intent through
  `evaluateConsent('leaderboard:submit', grant)`:
  - no grant → BLOCKED (`consent-required`), `ok:false`; the draft is still previewed so
    a host can SHOW what would be submitted;
  - explicit matching grant (boolean `true` or scoped `{granted:true, action, token}`) →
    consent allowed (`consent-granted`), `ok:true` — but the flow STILL never
    signs/publishes/sends/connects (`performed:false` pinned);
  - grant minted for a DIFFERENT action → BLOCKED (`consent-mismatch`, no privilege
    transfer);
  - malformed score → `ok:false`, `draft:null` even WITH a valid grant.
- `DEMO_SUBMIT_INPUT` — frozen deterministic sample for the debug shell only.

### 2. SDK exposure (read-only)
`src/sdk/index.js` re-exports `submitIntent` and registers it in `SDK_SURFACE` at the
**experimental** tier. Pure helpers, no I/O, inert; no action surface.

### 3. ToriiDebug shell (read-only preview)
`src/engine/debug/shellReport.js` adds `leaderboardSubmitReport(input?, grant?)` — shows
the inert draft + consent decision for a run (blocked by default; an optional grant
previews what WOULD be allowed, `performed:false` pinned). Wired into `buildShellReport`
(over `DEMO_SUBMIT_INPUT`) and exposed read-only at
`ToriiDebug.shells.leaderboardSubmit(input?, grant?)`. The locked 4-surface
`shellsSummary` proof-board list is UNCHANGED.

### 4. `tests/leaderboard-submit-intent.test.js` (NEW — 20 cases)
Covers: identity sanitisation (keeps spaces/digits, strips HTML/control chars, caps
length, bech32 npub + hex pubkey only, never throws on garbage); draft building from a
valid score; malformed-score degradation; score caps/ranges (accuracy [0,1], non-neg
counters, headshots ≤ kills via leaderboard.js); consent routing — BLOCKED with no grant,
ALLOWED with a boolean grant, ALLOWED with a matching scoped grant, BLOCKED on action
mismatch, BLOCKED on `{granted:false}`, BLOCKED-but-draft-null on malformed score even
with a grant; inert-flag invariants (`performed`/`signed`/`published:false`,
`readOnly:true` on every report); no sign/publish/send/connect/submit/write method on the
module surface; stable summary text; SDK exposure; demo data.

## Verification
- `npm test -- --run` → **629 passed / 51 files** (was 609/50; +20 cases).
- `npm run build` → clean (known large-chunk advisory only).
- `npm run check` → **ALL GREEN**, 14/14; check `[14]` references v0.2.163-alpha (5 docs);
  proof-surface gate `[12]` ok (4 bound).
- `npm run bundle:report` → advisory baseline unchanged (rapier chunk tracked, not gated).
- `npm run handoff:status` → VERSION v0.2.163-alpha, package in sync; exits 0.

## Safety
godMode=false. No new `setTimeout` (the only allowed cases remain nostr.js WS close +
hud.js kill-feed). No Vector3/Matrix4. No gameplay/shooter/physics change; ESC instant
pause + panel-locked cursor untouched. Debug tools ship unconditionally. Comments use
"nostrich"; "Chiefmonkey" spelling preserved. No signing, publishing, payments, relay
writes, NIP-07 actions, private-key handling, auto-connect, navigation, or live
network — the flow PREPARES a draft and asks the gate, it never acts, and exposes no
write/sign/publish/connect surface.

## Version markers bumped → v0.2.163-alpha
`src/config.js`, `package.json`, `index.html` (×2), `tools/regression-check.mjs`
(header, `EXPECTED_VERSION`, stale-guard now flags `v0.2.162-alpha`).

## Docs updated
`todo.md` (LEAN-4/SEC-1 row), `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`,
`SDK_DEBUG_INDEX.md`.

## Not done (left to parent agent)
Not pushed/published. The consent UX (the actual confirm/HUD prompt that mints a grant)
and the real write path this intent guards — NIP-07 signer + relay publish (SEC-1) — and
the in-world rank/submit MESH/HUD remain deferred. Parent agent verifies,
security-reviews, deploys, publishes, pushes, and syncs docs.

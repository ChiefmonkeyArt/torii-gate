# Torii Quest — v0.2.166-alpha report

## Consent UX VIEW-MODEL foundation (CONSENT-2)

**Date:** 2026-06-24
**Branch:** `v0.2.166` (off the v0.2.165 commit `24eabe9`)
**Type:** safe, no-blocker infrastructure / foundation slice — a pure, inert DISPLAY
layer over the v0.2.162 consent gate. No runtime / gameplay / visual change; no
confirm-button side effects, no navigation, no network, no signing/publishing.

---

## What shipped

A pure, node-safe module that turns the v0.2.162 consent-gate requests/decisions into
clear, user-facing **PROMPT copy + preview rows** for every action (gateway travel,
leaderboard submit, profile update, update apply, Nostr publish, + read-only actions) —
the safe UI/view-model slice BEFORE any real confirm-button wiring exists. It NEVER
performs an action and exposes NO confirm/sign/publish/send/connect/travel/navigate/apply
method.

### New module — `src/engine/consent/consentView.js` (PURE / node-safe)

No THREE/Rapier/DOM/network/WebSocket/relay I/O/signing/key-handling/NIP-07/payments/
navigation/auto-update/auto-connect; never throws; never performs an action.

- `CONSENT_VIEW_VERSION = 1`.
- `CONSENT_PROMPT_BADGE = 'CONSENT · PREVIEW · NO ACTION'` — stamped on every view so a
  viewer can never mistake the preview for a live, wired confirm dialog.
- `CONSENT_SEVERITY` — `{ INFO:'info', CAUTION:'caution', DANGER:'danger' }`.
- `REASON_TEXT` — human-readable copy for every `CONSENT_REASON` value (display only).
- `ACTION_COPY` — frozen per-action `{ headline, actionLabel, cancelLabel }` for the 5
  write actions (gateway:travel "Travel"/"Stay here", leaderboard:submit "Submit
  score"/"Not now", profile:update "Update profile"/"Cancel", update:apply "Apply
  update"/"Later", nostr:publish "Publish"/"Cancel"); read-only + unknown fall back to
  internal `READ_COPY` / `UNKNOWN_COPY`.
- `copyForAction(id, requiresConsent)` — the UX copy bag for an action id (known write →
  its `ACTION_COPY` entry; known read → read copy; anything else → unknown copy).
- `severityFor(decision)` — read / no-consent → `info`; low-danger write → `caution`;
  high-danger write → `danger`; null/malformed → `info`.
- `consentPromptView(input, grant)` — re-shapes a gate decision into an **INERT**,
  render-ready view-model:
  ```
  {
    title:'CONSENT', badge, action, kind, severity, headline,
    bodyLines:[{label,value}],     // Action/Effect/Signature/Network/Consent/Status (+ Requested by)
    actionLabel, cancelLabel,
    requiresExplicitConsent, allowed, blocked, reason, reasonText,
    write, signed, danger, statusLine,
    performed:false, actionable:false, readOnly:true, errors:[],
  }
  ```
  Blocked-by-default for writes; ALLOWED copy under a matching grant but STILL
  `performed:false` / `actionable:false`; malformed/unknown input → a safe blocked view
  (`action:null`, `'Unknown action'` headline, populated `errors`); every free-form string
  (origin) is control/markup-stripped (`/[\x00-\x1f\x7f<>]/g`, length-capped) so a hostile
  value can never inject markup. `input` is an action id string or `{ action, detail?,
  origin? }`; `grant` is a boolean `true` or a scoped `{ granted:true, action?, token? }`
  (a mock-grant preview is explicitly inert).
- `consentPromptRows(grants)` — one compact inert row per known action (the UX-copy
  counterpart to `consentGateReport`), under an optional `grants` map; ignores a non-object
  grants argument.

The module exposes **no** confirm/perform/sign/publish/send/connect/travel/navigate/goto/
open/apply/submit/write/fetch/post method (asserted by test).

### Read-only exposure (SDK + debug)

- **SDK** — `src/sdk/index.js`: added `consentView` namespace re-export + a `SDK_SURFACE`
  entry at the EXPERIMENTAL tier.
- **Debug** — `src/engine/debug/shellReport.js`: new `consentPromptReport(opts?)` →
  `{ title:'CONSENT PROMPT PREVIEW', badge:'CONSENT · PREVIEW · NO ACTION', count,
  writeActions, allowedByDefault, rows, readOnly:true, actionable:false, performed:false }`;
  added to `buildShellReport` (key `consentPrompt`). The **4-surface `shellsSummary`
  proof-board list is unchanged.**
- **Debug** — `src/engine/debug/toriiDebug.js`: `ToriiDebug.shells.consentPrompt(opts?)`.

---

## Tests — `tests/consent-view.test.js` (27 tests, all pass)

Covers: module shape (version/badge/severity tiers; UX copy for every write action; reason
copy for every gate reason); `copyForAction` + `severityFor`; `consentPromptView` write
actions (blocked-by-default, danger severity, never actionable, body rows are
`{label,value}`; ALLOWED copy under a matching grant but `performed:false`; scoped grant
match vs mismatch); read actions (allowed read-only, info severity, no consent required);
malformed/unknown (blocked, never throws over `[null,undefined,42,[],{},{action:123}]`); no
DOM injection/HTML (strips control chars + angle brackets from origin; no `<`/`>` in any
rendered string); stable labels + safety flags (mirrors gate write/signed/danger; stable
`statusLine`); `consentPromptRows` (one inert row per action, blocked-by-default writes,
grant preview, ignores a non-object grants arg); **no action methods** on the surface; and
SDK/debug exposure (`SDK.consentView`, `SDK_SURFACE.consentView.tier === EXPERIMENTAL`).

---

## Verification

| Step | Result |
|---|---|
| `npm run build` | (see summary) |
| `npm test -- --run` | +27 tests, +1 file vs v0.2.165 (669/53 → 696/54) |
| `npm run check` | version markers == v0.2.166-alpha; proof-surface gate ok; continuity docs reference v0.2.166-alpha |
| `npm run bundle:report` | advisory only — rapier chunk over 700 KB (tracked, not gated) |
| `npm run handoff:status` | config/package versions in sync at v0.2.166-alpha |

---

## Files changed

**New:**
- `src/engine/consent/consentView.js`
- `tests/consent-view.test.js`
- `torii-v0.2.166-consent-ux-report.md`

**Edited:**
- `src/config.js` — `VERSION` → `v0.2.166-alpha`
- `package.json` — `version` → `0.2.166-alpha`
- `index.html` — both version markers → v0.2.166-alpha
- `tools/regression-check.mjs` — header, `EXPECTED_VERSION`, stale-guard (now flags v0.2.165-alpha)
- `src/sdk/index.js` — `consentView` namespace + `SDK_SURFACE` entry (experimental)
- `src/engine/debug/shellReport.js` — `consentPromptReport` + `buildShellReport` key
- `src/engine/debug/toriiDebug.js` — `shells.consentPrompt(opts?)`
- `todo.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`, `GATEWAY_PROTOCOL.md`

---

## Safety constraints upheld

godMode remains `false` (never true). No new `setTimeout` (allowlist unchanged: nostr.js WS
close, hud.js kill-feed). No new `Vector3`/`Matrix4` in hot paths. "nostrich" / "Chiefmonkey"
spellings untouched. Debug tools ship unconditionally. ESC instant-pause + panel-locked
cursor behaviour untouched. **No** confirm-button side effects, browser navigation, live
network writes, signing, NIP-07 requests, private-key handling, payments, automatic updates,
or irreversible actions added — every view is `performed:false` / `actionable:false` /
`readOnly:true`. Gameplay / shooter feel unchanged. Split by concern (pure module / tests /
SDK / debug / docs).

**Deferred (next slices):** the clickable confirm dialog that MINTS a grant, and the real
signer / navigation wire-up (NIP-07 + relay publish, world handoff) that acts on an allowed
decision.

---

## Commit

Committed locally on branch `v0.2.166` (NOT pushed/deployed/published — the parent agent will
verify / security-review / deploy / push / publish).

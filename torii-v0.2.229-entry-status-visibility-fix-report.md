# v0.2.229-alpha — Entry-Status Visibility / ENTER-ARENA No-Op Fix (follow-up)

**Type:** surgical bug fix (entry-flow follow-up to v0.2.228). Three files of shipped
runtime change (`src/main.js` handler + `index.html` markup + `src/hud.js` a11y toggle)
plus a test extension and the standard version/docs/artifact lockstep. No
gameplay/physics/shooter/Rapier logic change.
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent
handles security review, deploy, publish, GitHub push, Space upload, and live smoke.

## What & why

After v0.2.228 (which added `#entry-status` + `showEntryStatus()`) shipped and was
deployed, the live cloud-browser smoke STILL reported:

- **ENTER ARENA** click → no visible transition, no visible error.
- **LOGIN WITH NOSTR** click → no visible feedback.
- The accessibility/DOM tree contained **"YOU DIED"** and **"Respawning..."** near
  the centre, even on the TITLE screen before any arena entry.

So v0.2.228 was necessary but still insufficient. This slice diagnoses and fixes the
three residual user-visible entry-flow defects.

## Root cause (three residual paths)

1. **ENTER click cleared the status line, so a STALLED bootstrap was a silent no-op.**
   The handler set `showEntryStatus('')` on click and relied only on the disabled
   button text (`LOADING PHYSICS…`). `initPhysics()` loads Rapier via WASM; in a
   headless/cloud browser the fetch can **stall and never settle** — when the promise
   neither resolves nor rejects, *neither* the try-success path *nor* the `catch`
   runs, so v0.2.228's failure message never appears. The click looked dead.

2. **`#death-msg` polluted the accessibility tree on TITLE.** `#death-msg` is ALWAYS
   in the DOM (`opacity:0; pointer-events:none` until hud adds `.show`), but it had
   **no `aria-hidden`**, so its `YOU DIED` / `Respawning...` text was exposed to the
   accessibility tree (and the smoke tool) on the title screen before any entry —
   misleading, and a real a11y defect.

3. **A throw from `nostrLogin()` left `Connecting…` stuck.** `_doNostrLogin()` set
   `Connecting…`, then `await nostrLogin()`, then wrote the result. `nostrLogin()`
   correctly *returns* `'NIP-07 extension not found'` for the no-signer case, but an
   unexpected *throw* (not a returned string) would skip the result write and leave
   the interim `Connecting…` on screen with no resolution.

Anonymous entry remains the intended design — ENTER does **not** gate on Nostr login —
so the correct MVP behaviour is: ENTER shows immediate visible feedback and either
enters or surfaces a clear failure; the death overlay never appears on TITLE; LOGIN
always resolves to a visible message.

## Changed / added files

### Shipped runtime fix (surgical, three files)
- **`src/main.js`** — the ENTER click now shows an **IMMEDIATE** visible
  `Entering arena…` line *before* the `await initPhysics()` (was `showEntryStatus('')`).
  It is cleared on a successful entry and replaced by the existing
  `⚠ Arena failed to load — please reload the page and try again.` in the `catch`. So
  even a never-settling WASM bootstrap shows a visible status instead of an apparent
  silent no-op. `_doNostrLogin()` now wraps the `nostrLogin()` await in `try/catch`;
  an unexpected throw surfaces `⚠ Login unavailable — you can still ENTER ARENA
  anonymously.` instead of leaving `Connecting…` stuck. `textContent` only (via
  `showEntryStatus`) — no `innerHTML`, no secret/markup injection. Anonymous entry
  preserved.
- **`index.html`** — `#death-msg` is now `aria-hidden="true"` by default (markup-only;
  the inline SW `<script>` and its CSP sha256 are untouched).
- **`src/hud.js`** — flips `aria-hidden` in lockstep with the `.show` class:
  `false` on `EV.PLAYER_KILLED` (overlay shown), `true` on `EV.PLAYER_RESPAWN`
  (overlay hidden). The overlay only reaches the accessibility tree while a death is
  actually being shown.

### Tests
- **`tests/entry-flow-smoke.test.js`** — +4 tests (11 → 15 in this file; no new file).
  Freezes: (a) the ENTER handler shows a non-empty `showEntryStatus(...)` *before* the
  `try`/await; (b) `#death-msg` carries `aria-hidden="true"` in `index.html`; (c)
  `src/hud.js` toggles `aria-hidden` in lockstep with `.show`; (d) `_doNostrLogin()`
  guards the await with `try/catch` and the catch shows a visible message.

### Version markers (228 → 229)
`src/config.js`, `package.json`, `public/sw.js` (`CACHE_VERSION = tq-v0.2.229-alpha`),
`index.html` (`#version-label` + `#ver`), `tools/regression-check.mjs`
(`EXPECTED_VERSION` + stale guard → v0.2.228), `src/engine/dashboard/continuumData.js`
(`CONTINUUM_VERSION` + Source version + Active slice + `CURRENT_TEST_STATUS.passing`
1505→1509), `src/engine/status/mvpReadiness.js` (`DEFAULT_TEST_STATUS.passing` 1509),
`tests/continuum-dashboard.test.js` (4 version pins). Test counts 1505→**1509 passing**,
files stays **92** (no new test file).

### Docs
`todo.md` (new HARD-43 row + header), `progress.md` (header / Source version / Tests),
`HANDOFF.md` (Current version + v0.2.229 changelog block + report pointer),
`CODE_INDEX.md` (Current version + extended entry-flow diagnosis row + new
"YOU DIED on the title a11y tree" row), `SDK_DEBUG_INDEX.md` (status version).

### Regenerated artifacts
`MVP_APPROVAL_STATE.json` (status=pending), `public/release-metadata.json`,
`HANDOFF.generated.md`, `NEXT_ACTION_STATE.json`, `MVP_RELEASE_PACKAGE.md`,
`MVP_PLAYTEST_CHECKLIST.md`, `RELEASE_NOTES_DRAFT.md`, `GITHUB_RELEASE_DRY_RUN.md`,
`MVP_RC_SNAPSHOT.md`, `RELEASE_ARTIFACT_MANIFEST.md`, `public/continuum.html`,
`public/continuum-data.json`, plus the `dist/` rebuild. **`MVP_PLAYTEST_RESULTS.md` is
NO-CLOBBER — not regenerated.**

### New
- `torii-v0.2.229-entry-status-visibility-fix-report.md` — this report.

## Tests run / results

- `npx vitest run` → **1509 passing / 92 files** (+4 from the extended entry-flow suite)
- `npm run build` → clean (standing rapier >700 KB advisory only, not gated)
- `npm run check` → **15 / 15 ALL GREEN** (docConsistency confirms v0.2.229-alpha across 5 docs)
- `npm run test:release` → **exit 0**

## Manual verification notes

- Automated coverage stays static (file-read): it freezes that ENTER shows an immediate
  visible status before awaiting, that the death overlay is aria-hidden on TITLE and
  toggled in lockstep by hud, and that the LOGIN await is guarded. The LIVE check
  (the status line actually renders on the deployed site / the a11y tree is clean on
  TITLE) remains the parent agent's cloud-browser smoke of https://torii-quest.pplx.app.
- Expected live behaviour after deploy: clicking **ENTER ARENA** immediately shows
  `Entering arena…`; it then either enters the arena (status cleared) or, if physics
  fails/stalls, shows `⚠ Arena failed to load — please reload the page and try again.`
  with the button re-enabled — never a silent no-op or a stuck `LOADING PHYSICS…`.
  Clicking **LOGIN WITH NOSTR** with no extension shows `NIP-07 extension not found`
  (or the guarded fallback on a throw). The TITLE screen no longer exposes
  `YOU DIED`/`Respawning...` to the accessibility tree.
- **No MVP approval granted; playtest remains not-run / pending.** No fabricated results.

## Security-sensitive behavior

**None new.** No new fs/crypto/git/network surface. No Nostr signing/publishing or
live network write beyond the existing NIP-07 read in `nostrLogin()`. No
deploy/publish/tag/self-update. `godMode` stays false; no new
`setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey" untouched. The `index.html`
change is a single static attribute (`aria-hidden`) — the inline SW script and its CSP
sha256 are unchanged. Login feedback uses `textContent`, never `innerHTML`.

## Blockers / warnings

None blocking. Commit is **local only** — not pushed, not deployed, not published, not
tagged. Standing non-blocking advisories unchanged (rapier chunk >700 KB; alpha).
Parent/main agent handles security review, deploy, publish, push, Space upload, and the
live cloud-browser smoke.

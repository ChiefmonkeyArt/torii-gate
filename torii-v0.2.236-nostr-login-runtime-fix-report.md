# Torii Quest — v0.2.236-alpha · Nostr-login runtime fix report

**Version:** v0.2.236-alpha · **Source commit (at generation):** 243441e
**Live game:** https://torii-quest.pplx.app · **Dashboard:** https://torii-quest.pplx.app/continuum.html
**Kind:** surgical entry-flow BUGFIX (no gameplay change) · **Verdict:** SHIP (local gates green; live deploy + playtest stay with the parent agent)

---

## 1. The blocker

> User tested live **v0.2.235-alpha** and reported **LOGIN WITH NOSTR still does not work**. Visible message:
> `Login still loading - reload the page if this persists.`

This survived v0.2.228 / v0.2.229 / v0.2.230 — all of which added *fallback* behaviour but never moved
the real handler off the failure path.

## 2. Root cause

The string `Login still loading - reload the page if this persists.` exists ONLY in `index.html`'s
bundle-independent inline `<script>` fallback (added v0.2.230). That fallback fires when, at click time,
`window.__toriiLoginReady` is still falsy — i.e. the real module-side handler never took ownership.

The real login handler **and** the `window.__toriiLoginReady = true` assignment lived at the **END of
`src/main.js`'s module body**, which runs *after*:

- `import { renderer } from './scene.js'` — `scene.js` line 4 constructs a `new THREE.WebGLRenderer(...)`
  **at import time**; this throws on a headless / WebGL-locked-down browser; and
- the synchronous `buildArena()` / `buildMirror()` / HUD boot sequence, any of which can throw.

So on any client where the 3D boot threw, `main.js` aborted **before** login was ever wired. The inline
fallback never stood down, and the user saw the "still loading" text indefinitely — even though **login
needs no 3D at all** (it is a NIP-07 read of `window.nostr`).

## 3. The fix

Extract login into a dependency-light module that is imported and self-installs **before** `scene.js`:

- **New `src/engine/ui/loginBootstrap.js`** — imports **only** `nostr.js` (→ `state.js` / `events.js`;
  no THREE / scene / WebGL). Exposes `installLoginBootstrap(doc)` (idempotent; binds the click handler
  and raises `window.__toriiLoginReady`) and `doNostrLogin(statusEl)`. It **self-installs at module-eval
  time** via a `typeof document !== 'undefined'` guard.
- **`src/main.js`** now `import './engine/ui/loginBootstrap.js'` **before** `import … from './scene.js'`,
  so the login wiring + readiness flag are set before the `WebGLRenderer` is ever constructed. A loaded
  bundle therefore always wires login regardless of whether the 3D boot later throws. The old in-`main.js`
  login block (`_doNostrLogin`, the `btn-nostr-centre` lookup, the `from './nostr.js'` import, and the
  `window.__toriiLoginReady = true` assignment) is fully removed. **ENTER ARENA is untouched** — its
  handler, `showEntryStatus`, and `window.__toriiEnterReady` remain in `main.js`.
- **Specific, actionable messages** (requirement #4):
  - no NIP-07 provider → `NIP-07 extension not found`
  - success → `⚡ <NAME>`
  - provider present but errors/throws → `⚠ Login failed — approve the request in your Nostr extension,
    or ENTER ARENA anonymously.`
  - never the stuck `Connecting…` / `Login still loading`.
  - `src/nostr.js`'s `getPublicKey()` catch was made actionable: `Login failed — approve the request in
    your Nostr extension and try again`.

`showStatus` writes via `textContent` only (never `innerHTML`) — the kind:0 profile name is
attacker-influenced, so no markup reaches the DOM.

## 4. Tests (requirement #5 — a loaded bundle can never sit in fallback)

- **New `tests/login-bootstrap.test.js` (+7, behavioural):** drives `installLoginBootstrap()` /
  `doNostrLogin()` against a hand-rolled fake `document` + `window.nostr` (no jsdom). Proves: install binds
  a click handler and raises the readiness flag; install is idempotent (no double handler); the flag rises
  even if the button is briefly absent; `null` doc is an inert no-op; no provider → exact
  `NIP-07 extension not found`; success → `⚡ <NAME>`; a throwing provider → an actionable visible message,
  never `Connecting…` / `still loading`.
- **Rewritten `tests/entry-flow-smoke.test.js`:** LOGIN contracts now read `loginBootstrap.js`; preserved
  the v0.2.228/229/230 contracts; added a v0.2.236 "login decoupled from the 3D boot" block — main.js
  imports `loginBootstrap.js` before `./scene.js`, `loginBootstrap.js` has no three/scene/WebGL import
  (scans real `import` lines only), self-installs on import, and the old login block is fully removed
  from main.js.

Suite: **1618 → 1629 passing**, **97 → 98 files**. `CURRENT_TEST_STATUS` (continuumData.js) and
`DEFAULT_TEST_STATUS` (mvpReadiness.js) bumped in lock-step; `NEXT_ACTION_STATE.json` regenerated.

## 5. Version markers + docs (requirements #1, #7)

Bumped to **v0.2.236-alpha**: `src/config.js`, `tools/regression-check.mjs` (EXPECTED_VERSION),
`index.html` (2 markers), `public/sw.js` (`CACHE_VERSION='tq-v0.2.236-alpha'`), `package.json`,
`MVP_APPROVAL_STATE.json`, `continuumData.js` (CONTINUUM_VERSION), `tests/continuum-dashboard.test.js`.
Docs (`todo.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`) carry the version and
a v0.2.236 entry.

## 6. Hard constraints — all held

`godMode` false · no new `setTimeout` (only the allowed nostr.js ws-close + hud.js kill-feed remain) ·
no new `Vector3`/`Matrix4` in hot paths · comments use 'nostrich' · Chiefmonkey spelling intact · debug
tools ship unconditionally · non-religious ethics guard intact · no Nostr writes/signing beyond the
existing NIP-07 read · no deploy/publish/push/tag/self-update (parent agent's job).

## 7. Verdict

**SHIP** — `npm run test:release` green locally (build + 1629/98 vitest + regression 15/15 + bundle report
+ handoff:status). The live deploy and the human live-browser playtest remain the parent agent's / user's
gate; MVP approval stays `pending` (not fabricated). No runtime risk: the change only moves login earlier
in module-eval order and adds specific messages.

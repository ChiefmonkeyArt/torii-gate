# Torii Quest — v0.2.172-alpha · Continuum dashboard CSP hardening

## Status: IMPLEMENTED — committed locally (no push/deploy/publish)

A focused Content-Security-Policy hardening pass for the Torii Continuum
project-oversight dashboard introduced in v0.2.171. The generated `/continuum.html`
now ships a strict CSP `<meta>` that closes the prior inline-script WARN while keeping
the page fully static, read-only, and refreshable from a same-origin packaged
`continuum-data.json` on page refresh. No gameplay change.

---

## CSP approach

The renderer (`src/engine/dashboard/continuumData.js → renderContinuumPage`) emits a
`<meta http-equiv="Content-Security-Policy">` carrying `CONTINUUM_CSP`:

```
default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none';
frame-ancestors 'none'; img-src 'self'; connect-src 'self';
style-src 'self' 'unsafe-inline';
script-src 'self' 'sha256-otKqhP2RYAA6ZkrRVcAQSBm7B1ssPR70QQR5dXePHmw='
```

Design decisions:

- **`script-src 'self' '<sha256>'` — NO `'unsafe-inline'` script.** The single inline
  refresh IIFE is hoisted into one exported constant, `CONTINUUM_REFRESH_SCRIPT`, and
  pinned by a hardcoded `CONTINUUM_SCRIPT_SHA256`. This closes the inline-script XSS
  surface that caused the prior WARN. The hash is hardcoded (not computed at runtime)
  because `continuumData.js` is re-exported through the SDK barrel and therefore bundled
  into the browser app — it must stay crypto-free. A `node:crypto` **test** recomputes
  the sha256 over `CONTINUUM_REFRESH_SCRIPT` and over the script actually shipped in the
  rendered page, so the declared hash can never silently drift from the script body.
- **`style-src 'self' 'unsafe-inline'`.** The data-driven progress bars use inline
  `style="width:N%"` *attributes*. Element hashes only cover `<style>`/`<script>`
  elements, not style attributes, and adding any hash to `style-src` would itself
  disable `'unsafe-inline'`. Inline styles cannot execute JS, so this is the low-risk,
  maintainable choice that keeps the bars working.
- **`connect-src 'self'`.** The refresh script does `fetch('./continuum-data.json')`
  only — same-origin. No relay, websocket, or external endpoint is reachable.
- **`default-src 'self'` + `object-src`/`base-uri`/`form-action`/`frame-ancestors`
  `'none'`.** Locks out plugins, base-tag hijacking, form exfiltration, and framing.

The page still renders fully without JS; the refresh script is pure progressive
enhancement (no eval, no timers, no external URL, no navigation).

---

## Files changed

- `src/engine/dashboard/continuumData.js` — added `CONTINUUM_REFRESH_SCRIPT`,
  `CONTINUUM_SCRIPT_SHA256`, `CONTINUUM_CSP`; injected the CSP `<meta>` and the hashed
  inline `<script>` into `renderContinuumPage`; bumped `CONTINUUM_VERSION` + curated
  metrics/activeNow/next12/completed24h.
- `tests/continuum-dashboard.test.js` — bumped version assertions; added a
  `CSP hardening (v0.2.172)` block (7 tests) asserting the CSP meta, script-src self+hash
  with no unsafe-inline/eval, locked default/object/base-uri/form-action/frame-ancestors,
  same-origin-only connect-src, real-sha256 sync, single inline script, and no
  external/eval/inline-handler/navigation surfaces.
- `public/continuum.html` + `public/continuum-data.json` — regenerated (`build:continuum`).
- Version markers → `v0.2.172-alpha`: `src/config.js`, `package.json`, `index.html`,
  `tools/regression-check.mjs` (header + EXPECTED_VERSION + stale-guard).
- Continuity/index docs: `todo.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`,
  `SDK_DEBUG_INDEX.md` (CSP note + v0.2.173 test-profile system scheduled).

---

## Tests / verification (all local, no network)

- `npm test -- --run` → **786 passing / 58 files** (continuum suite now 29 tests).
- `npm run check` → **ALL GREEN (14/14)** after `npm run build` (check [6] needs dist).
- `npm run build` → clean; CSP meta present in both `public/` and `dist/continuum.html`.
- `npm run bundle:report` → 2.9 MB raw / ~1021 KB gzip; only the expected rapier-chunk
  advisory (tracked, not gated).
- `npm run handoff:status` → VERSION/package.json in sync at v0.2.172-alpha.

---

## Safety notes

- godMode remains `false`. Debug tools ship unconditionally.
- No new `setTimeout`/`setInterval`, no `eval`, no `window.open`, no `window.location`,
  no external `href`. No `Vector3`/`Matrix4` in hot paths.
- No signing, NIP-07, private keys, payments, auto-updates, relay/websocket writes, or
  external redirects. The page is static and read-only; the only network access is a
  same-origin `fetch('./continuum-data.json')`, already covered by `connect-src 'self'`.
- Comment spelling conventions ("nostrich", "Chiefmonkey") untouched.
- Committed locally only — not pushed, deployed, published, or uploaded.

---

## v0.2.173 scheduled (next planned task)

A **test profile system** for faster agent loops is scheduled in `todo.md`
(`TESTPROF-1`), `progress.md` (next-12 #1):
- `npm run test:fast` — quick foundation subset for inner agent loops.
- `npm run test:foundation` — pure node-safe modules.
- `npm run test:release` — FULL suite, required before any deploy/publish (the release
  gate is not weakened).

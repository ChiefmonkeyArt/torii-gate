# Torii Quest — v0.2.152-alpha report

## Slice: fold proof-surface render + parent-binding gates into the promotion/regression review path

Closes the v0.2.151 "Next": future preview→live promotions (and the in-world proof
boards themselves) now **fail fast** if the render plan or parent binding is
unsafe/broken, instead of surfacing in the browser. **No gameplay/visual change.**

---

## What changed

### New — pure promotion/regression gate (node-testable, no THREE/DOM)
`src/engine/debug/proofSurfaceGate.js`
- `PROOF_GATE_BADGE = 'PROOF-GATE · READ-ONLY · PROMOTION'`
- `proofSurfaceGate(opts?)` folds the three pure layers that must ALL hold before the
  display-only proof boards may be built (and, later, before any preview→live promotion):
  1. spec↔registry cross-check — `checkProofSurfaceSpecs().ok` (v0.2.148)
  2. render plan — `buildProofSurfaceRenderPlan().ok` (v0.2.150)
  3. scene-graph parent binding — `resolveParentBindings(plan).ok` (v0.2.151)
- Returns one fail-fast, JSON-serialisable report:
  ```js
  {
    badge, ok,                                   // ok iff all three pass
    gates: { specCheck, renderPlan, parentBinding },
    counts: { panels, groups, bound, unbound },
    reasons,                                     // concrete failures, empty iff ok
    rendered: false, actionable: false,
  }
  ```
- Every input (`check` / `anchors` / `plan` / `binding`) is **injectable**, so a test can
  drive a deliberately-broken layer and prove the gate catches it.
- Pure / node-safe: composes plain data only — no THREE, no DOM, no network, renders and
  acts on nothing.

### Modified — runtime regression check [12]
`tools/regression-check.mjs`
- New check **[12]** `await import`s the pure gate and asserts `ok`; on failure it prints
  the gate's own `reasons` and fails the build. The gate chain is THREE/DOM-free, so it
  imports cleanly under `npm run check`. This is the first *runtime* (vs static) check in
  the file — a broken board/binding now fails CI, not the browser.
- Header comment + `EXPECTED_VERSION` + stale-version guard regex bumped to v0.2.152.

### Modified — read-only debug shell
`src/engine/debug/toriiDebug.js`
- Added `ToriiDebug.shells.surfaceGate()` → `proofSurfaceGate(opts)`. Read-only, pure.

---

## Why this shape

The three safety layers already existed as pure helpers, but nothing *composed* them into
a single assertion, and nothing ran them outside the browser. A reviewer promoting a
preview→live surface (or just landing a new proof board) had to remember to check three
separate reports. `surfaceGate()` collapses that into one `ok` + a concrete `reasons`
list, and wiring it into `npm run check` makes the guard automatic. The gate composes
plain data only — it deliberately does NOT render, parent, fetch, sign, or navigate.

---

## Safety / constraints honored
- godMode = `false`; no new `setTimeout` (allowlist unchanged).
- No new `Vector3`/`Matrix4`; no Three/Rapier runtime work — the gate is pure data.
- No gameplay/visual change; no click/raycast/navigation/payments/signing/publishing/
  relay/live fetch/WebSocket/auto-update/external network.
- Checks are pure/node-safe and run under `npm run check` + `npm test` without a browser
  or live services.
- `ToriiDebug.shells.surfaceGate()` is read-only.

---

## Tests & checks
- New `tests/proof-surface-gate.test.js` (7 tests): the LIVE gate is `ok` with all three
  sub-gates green (counts 4/2/4/0, empty reasons); deterministic + JSON + inert + no
  forbidden keys; an injected failing **spec-check** fails fast (cascades to renderPlan);
  injected **unresolved anchors** → renderPlan false + `render-plan: anchors-unresolved`;
  an explicitly not-ok **plan** fails renderPlan; an `ok` plan with an orphan panel →
  **parentBinding** false + `parent-binding: unbound orphan`; an injected not-ok binding
  is reported directly.
- **`npm test` GREEN — 452 tests / 41 files.**
- **`npm run check` GREEN — 12/12 guardrails** (new check [12] runs the gate after build).
- **`npm run build` GREEN.**

---

## Files touched
- `src/engine/debug/proofSurfaceGate.js` (new)
- `src/engine/debug/toriiDebug.js`
- `tools/regression-check.mjs`
- `tests/proof-surface-gate.test.js` (new)
- version markers: `src/config.js`, `package.json`, `index.html`, `tools/regression-check.mjs`
- docs: `todo.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`

## Next safe slice (suggested)
Only once a preview→live promotion is sanctioned: the first live proof-surface read
(NIP-07 signer / relay), gated behind `surfaceGate().ok` + the `shells.diff()` review.

---

*Committed locally on branch `v0.2.152` with a `feat(v0.2.152): ...` message.
NOT pushed/published — parent agent will verify, security review, deploy, publish,
push, and sync docs.*

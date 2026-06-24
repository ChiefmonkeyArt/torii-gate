# Torii Quest — v0.2.136-alpha Visible Shells Report

## 1. Summary

v0.2.136 turns the v0.2.135 *pure infrastructure* (component registry, gateway
handoff, product panel view-model, leaderboard publisher) into **visible but safe
in-game VIEW shells** — render-ready view-models a thin renderer can later mount —
**without any side effects**. Three new modules landed, all node-pure (no
THREE / Rapier / DOM / scene imports), all surfaced via the SDK at the
`experimental` tier, all covered by deterministic tests:

1. **Gateway portal VIEW shell** (`engine/gateway/gatewayPortal.js`) — shows a
   destination label, prompt, armed/debug state and a URL preview over the
   existing travel-intent / gateway-handoff helpers. **Never navigates, contacts a
   relay, or signs.**
2. **Product panel RENDER shell** (`engine/components/productPanelShell.js`) — a
   read-only panel layout (title, image, Price/Seller/reward lines, link footer)
   over the product view-model. **No checkout / pay / zap / buy / external-open
   action** — `actions[]` is always empty and the footer is `actionable:false`.
3. **Read-only leaderboard display + build-only preview**
   (`engine/nostr/leaderboardView.js`) — ranks scores deterministically and offers
   a build-only `leaderboardPreview` through a **no-signer / no-publisher** adapter.
   **No NIP-07 signing, no relay publishing**; any non-`mock`/`build` mode throws.

The actual Three.js portal / panel meshes remain the documented **deferred render
step** — these shells are the render-ready data contract a mesh binds over.

Security gates **SEC-1 / SEC-2 / SEC-3** are preserved (see §4).

- **Version bump:** `v0.2.135-alpha` → `v0.2.136-alpha`.
- **Tests:** 274 → **297** (+23), 24 → **27** files. Build green, `npm run check`
  ALL GREEN.
- **No deploy / publish / push / upload** — the main agent owns deployment.

## 2. Changes by file

### New source modules
- `src/engine/gateway/gatewayPortal.js` — gateway portal VIEW shell.
- `src/engine/components/productPanelShell.js` — product panel RENDER shell.
- `src/engine/nostr/leaderboardView.js` — read-only leaderboard display + preview.

### New tests
- `tests/gateway-portal.test.js` (9 cases)
- `tests/product-panel-shell.test.js` (6 cases)
- `tests/leaderboard-view.test.js` (8 cases)

### Modified
- `src/sdk/index.js` — 3 new re-exports (`gatewayPortal`, `productPanelShell`,
  `leaderboardView`) + 3 `SDK_SURFACE` entries at `experimental` tier.
- `src/config.js` — `VERSION` → `v0.2.136-alpha`.
- `index.html` — version labels (×2) → `v0.2.136-alpha`.
- `tools/regression-check.mjs` — `EXPECTED_VERSION` + header + stale-version guard.
- Docs: `todo.md`, `strategy.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`,
  `COMPONENTS.md`, `GATEWAY_PROTOCOL.md`.
- This report.

## 3. The pieces

### gatewayPortal.js
- `PORTAL_PROMPT = 'Press E to travel'`.
- `shortKey(key, head=10, tail=4)` — truncates a long key to `npub1abcde…wxyz`;
  returns `''` on non-string, returns the key unchanged if short enough.
- `destinationLabel(dest)` — prefers `dest.target`, else `shortKey(dest.npub)`,
  else `'Unknown destination'`.
- `gatewayPortalView(component, context={}, { base='', prompt=PORTAL_PROMPT }={})`
  → `{ status, isGateway, armed, destination, destinationLabel, relay, prompt,
  plan:{valid,errors,intent}, urlPreview, errors }`. `status` is
  `ready` | `invalid` | `not-a-gateway`; `armed = plan.valid`; `prompt` and
  `urlPreview` are blank unless armed. Builds on `planGatewayTravel` /
  `gatewayTravelUrl` from `gatewayHandoff.js`. **No navigation.**

### productPanelShell.js
- `productPanelShell(product)` → `{ ok, errors, panel }`. Valid →
  `panel = { title, imageUrl, lines:[{label:'Price',…},{label:'Seller',…},
  (optional){label:'In-game reward',…}], footer:{kind:'link', label, url,
  actionable:false}, actions:[], readOnly:true }`. Invalid → `{ ok:false, errors,
  panel:null }`. Builds on `productPanelViewModel`. **Read-only: `actions[]` is
  always empty and the footer is display-only.**

### leaderboardView.js
- `VIEW_MODES = ['mock','build']`.
- `accuracyLabel(accuracy)` → `'NN.N%'` (non-finite → `'0.0%'`).
- `rankScores(statsList=[])` → `{ rows, skipped }` — validates each entry (invalid
  → `skipped` with errors), sorts desc by score → kills → headshots → runId, and
  assigns a 1-based `rank`. Safe on non-array input.
- `leaderboardView(statsList=[], { mode='mock' }={})` → `{ mode, rows, count,
  skipped }`. **Throws if `mode` is not in `VIEW_MODES`** — there is no `live` /
  relay mode.
- `async leaderboardPreview(statsList=[])` → `{ mode:'build', signed:false,
  published:false, entries }` — runs each score through
  `createLeaderboardPublisher()` with **no signer and no publisher**, so it is
  build-only and never signs or publishes.

## 4. Verification

- `npm run build` → exit 0 (`✓ built in ~2.4s`; dist rebuilt at v0.2.136 markers).
- `npm run check` → **ALL GREEN** (all 11 static guards, incl. version markers,
  godMode=false, setTimeout allowlist, no hot-path allocs, FSM/event-bus seams).
- `npm test` → **297 passed / 297**, **27 files**.

### Security gates preserved
- **SEC-1** (no live NIP-07 signing / relay publish without consent):
  `leaderboardView.leaderboardPreview` runs build-only through a no-signer /
  no-publisher adapter and reports `signed:false` / `published:false`;
  `leaderboardView` rejects any non-`mock`/`build` mode (no `live`/relay path).
- **SEC-2** (verify before acting on live relay data): `gatewayPortal.urlPreview`
  is display-only — the shell never assigns `window.location`, contacts a relay,
  or signs; crossing the gate stays the deferred `world/handoff.js` host step.
- **SEC-3** (tighten product URL validation before URLs become clickable/fetched):
  `productPanelShell.footer` is `actionable:false` with empty `actions[]`, so the
  product link is not yet clickable; URL hardening (regex → `URL`-object parsing)
  remains required before a mesh makes it actionable.

## 5. Deferred (documented, not built)
- The actual Three.js **portal mesh** and **product panel / billboard mesh** that
  bind over these view-models (the render step with scene/DOM side effects).
- Real Nostr **signer + relay read/publish** for the leaderboard (SEC-1).
- Cryptographic verification / signing-layer checks in `world/handoff.js` before
  it acts on a live intent (SEC-2).
- Product URL hardening to `URL`-object parsing before the footer link is
  clickable/fetched (SEC-3).

## 6. Next
- LEAN-2: build the portal mesh + wire `world/handoff.js` to ACT on a validated
  travel intent (gated by SEC-2).
- LEAN-3: in-world panel mesh over `productPanelShell` (gated by SEC-3).
- LEAN-4: real signer + relay read for the leaderboard (gated by SEC-1).

## For the main agent (deploy / sync)
- Commit is on branch **`v0.2.136`** (NOT pushed). Review, then push + open PR as
  appropriate.
- Live site `torii-quest.pplx.app` is still at **v0.2.113-alpha**; clean source is
  now **v0.2.136-alpha** (20+ versions ahead). Deployment + the manual smoke test
  (LEAN-1 / TQ-MANUAL-113) are maintainer steps — **not performed here**.
- No DNS / VPS / relay / external state was touched. No publish/upload.

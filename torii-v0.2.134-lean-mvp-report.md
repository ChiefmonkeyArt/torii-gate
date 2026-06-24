# Torii Quest — v0.2.134-alpha Report (lean-MVP foundation · gateway protocol · product display · leaderboard)

> Batch report for v0.2.134-alpha. A **safe foundation batch** for the lean
> prototype: every item is a pure, node-safe module or a doc. Nothing here needs
> torii.quest DNS/VPS credentials, and **no deploy/publish/push/upload is
> performed** — the maintainer/main agent ships after a manual smoke test.

---

## 1. Summary

Three foundation slices toward the lean freedom-tech loop, plus docs:

1. **GWPROTO-1 — Gateway Protocol draft + URL-handoff helpers.** New
   `GATEWAY_PROTOCOL.md` drafts the n2n spatial-hop protocol (relay-first hybrid
   discovery, URL handoff MVP, world/zone/gateway identity, travel intent, return
   path, signed-event future, security tiers, NIP path). New pure
   `src/engine/gateway/travelIntent.js` implements the URL-handoff MVP:
   `buildTravelIntent` / `validateTravelIntent` / `buildTravelUrl` /
   `parseTravelUrl`. No browser navigation, no relay I/O, no signing.
   "Component is code, protocol is agreement."
2. **CMP-13 — read-only product display reference component.** New pure
   `src/engine/components/productDisplay.js` built on the v0.2.132
   `defineComponent` contract (`createProductDisplay` / `productDisplay` /
   `validateProduct`). Manifest `kind:'product'`, `mountTarget:'panel'`. Links OUT
   to Plebeian.Market; **no checkout / pay / zap / publish**. Safe https-only URL
   validation.
3. **LB-1 — Nostr leaderboard score-event helpers.** New pure
   `src/engine/nostr/leaderboard.js` (`buildScore` / `validateScore` /
   `buildScoreEventTemplate`, kind 30000). Builds the **UNSIGNED** event template
   only — indexable tags, headshots≤kills invariant. No signing / relay / publish.

All three surfaced via the SDK at the **experimental** tier.

---

## 2. Changes by file

| File | Change |
|---|---|
| `src/config.js` | `VERSION` → `v0.2.134-alpha`. |
| `index.html` | `#version-label` + `#ver` → `v0.2.134-alpha`. |
| `tools/regression-check.mjs` | header + `EXPECTED_VERSION` → `v0.2.134-alpha`; stale-version guard now flags `v0.2.133-alpha`. |
| `GATEWAY_PROTOCOL.md` | NEW — n2n spatial-hop protocol DRAFT (10 sections). |
| `src/engine/gateway/travelIntent.js` | NEW — pure URL-handoff helpers. |
| `tests/travel-intent.test.js` | NEW — normalisation, validation, build/parse, round-trip, SDK exposure (18). |
| `src/engine/components/productDisplay.js` | NEW — read-only product display reference component. |
| `tests/product-display.test.js` | NEW — contract validity, validateProduct, lifecycle, no-payment surface, SDK exposure (12). |
| `src/engine/nostr/leaderboard.js` | NEW — pure unsigned score-event helpers. |
| `tests/leaderboard.test.js` | NEW — buildScore, validateScore, event template, throws-on-invalid (11). |
| `src/sdk/index.js` | `productDisplay` / `travelIntent` / `leaderboard` namespace re-exports + `SDK_SURFACE` entries (experimental). |
| `CODE_INDEX.md`, `COMPONENTS.md`, `HANDOFF.md`, `progress.md`, `strategy.md`, `todo.md` | v0.2.134 doc upkeep. |

---

## 3. The pieces

### 3.1 Travel intent (GWPROTO-1)

`buildTravelIntent(config)` normalises a travel intent — drops unknown/blank keys,
coerces `relays` to a string array, keeps only `TRAVEL_FIELDS`
(`to`,`from`,`return`,`spawn`,`zoneType`,`relays`,`player`,`state`).
`validateTravelIntent` requires `to`, npub-shape-checks `player`, and validates
the relays array. `buildTravelUrl` serialises via `URLSearchParams` (relays
comma-joined) with NO navigation; `parseTravelUrl` accepts a bare query, a `?…`
query, or a full path+query and never throws. The URL MVP is the forgeable
discovery layer; the signed spatial event (§6 of the protocol) is the trusted
forward path, not built here.

### 3.2 Product display (CMP-13)

`createProductDisplay({ title, image, sellerNpub, priceSats, url, reward })` → a
contract-valid component (manifest `id:'plebeian.product-display'`,
`kind:'product'`, `mountTarget:'panel'`, `author:{npub:sellerNpub}`).
`validateProduct` requires a title, an npub-shaped seller, and an `https://` URL;
rejects non-https / script / relative URLs and images, and negative `priceSats`.
Lifecycle is a symmetric no-op skeleton. **No checkout/pay/zap/publish surface** —
it links OUT to Plebeian.Market. The in-world panel mesh is a documented TODO.

### 3.3 Leaderboard (LB-1)

`buildScore(stats)` defaults counters to 0 and `version` to the game `VERSION`.
`validateScore` enforces a `runId`, non-negative integer counters,
`accuracy ∈ [0,1]`, and `headshots ≤ kills`. `buildScoreEventTemplate(stats)`
throws on invalid input and returns a kind-30000 **unsigned** template
(`content` = JSON score; indexable tags `d`/`score`/`kills`/`headshots`/
`accuracy`/`version`/`t`). No `pubkey`/`id`/`sig` — the signer/publisher is a
later task.

---

## 4. Verification

- `npm run build` — clean.
- `npm run check` — all 11 regression guardrails GREEN (`[5]` version markers ==
  `v0.2.134-alpha`; `[11]` 20 test files).
- `npm test` — **241 passed / 20 files**.

Constraints honoured: `godMode` false; no new `setTimeout`; no new
`Vector3`/`Matrix4` (new modules import no THREE); "nostrich"/"Chiefmonkey"
spelling intact; debug tools unconditional; split by concern.

---

## 5. Deferred

None. All four work-order items landed (the prioritisation fallback to defer
product/leaderboard was not needed).

---

## 6. Next

- Manual smoke test on real hardware (TQ-MANUAL-113), then publish — a separate
  manual maintainer/main-agent step. **No deploy/publish/push/upload performed by
  this task.**
- LEAN-2: CMP-7 loader + CMP-8 gateway portal mesh + n2n handoff that acts on a
  validated travel intent (`src/world/handoff.js`).
- LEAN-3: the in-world product panel mesh for `productDisplay`.
- LEAN-4: the leaderboard signer/publisher + relay read.

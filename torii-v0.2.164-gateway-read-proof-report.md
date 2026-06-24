# Torii Quest — v0.2.164-alpha: Gateway Destination LIVE-READ Proof

## Goal
Add a gateway / NAP-zone-to-NAP-zone handoff **LIVE-READ PROOF** using injected/sample
relay-read results only — proving how gateway destination records could be
read/validated/sanitised into a safe travel preview for the Torii/Plebeian open-world
vision — WITHOUT enabling navigation, writing, signing, publishing, NIP-07, private
keys, payments, automatic update, or any irreversible action. The actual relay query
and the act of travelling remain deferred until explicit user approval in a later task.

## What landed

### 1. `src/engine/gateway/gatewayRead.js` (NEW — pure, node-safe, inert)
No Nostr client, no WebSocket, no relay I/O, no signing, no publishing, no NIP-07, no
key handling, no payments, no DOM, no network, no auto-connect, **no navigation**. The
module NEVER performs travel and exposes NO navigate/sign/publish/send/connect/write
method — it only reads events handed to it and shapes them into a sanitised, inert
travel-preview report. Every helper is pure and never throws on event data.
- `GATEWAY_KIND` = `30078` (NIP-78 addressable app data — the read-proof choice while
  the world-registry kind is TBD per `GATEWAY_PROTOCOL.md` §2) and `GATEWAY_TOPIC` =
  `'torii-gateway'` (the discovery topic tag).
- `buildGatewayFilter({authors,since,until,limit})` → a NIP-01 filter
  `{kinds:[30078],'#t':['torii-gateway'],…}`; only well-formed options are included, a
  malformed option is dropped rather than producing a bad filter.
- `extractGatewayFromEvent(event)` → `{ ok, gateway?|errors? }` — from a NORMALISED
  event it reconstructs a SANITISED travel-preview model
  `{ zoneId, title, description, zoneType, npub, pubkey, shortPubkey, website, banner,
  relays, topics, created_at, trust }`. Content JSON is authoritative; indexable tags
  are a fallback. `zoneId` is anchored to the addressable `d` tag (a record with no
  zone id is rejected). ALL text is control/markup-stripped (spaces/digits preserved);
  `website`/`banner` are https-only via profileRead `safeProfileUrl`; `relays` are
  ws/wss-only + credential-free + deduped via relayRead `validateRelayUrl`; `npub` via
  travelIntent `looksLikeNpub`; `zoneType` ∈ nap/arena/shop/gallery; `trust` is always
  `'unverified'` (a read record is never crypto-verified here).
- `dedupeGateways(gateways)` → `{ gateways, dropped }` — keeps the newest record
  (highest created_at) per addressable `pubkey+zoneId` (parameterised-replaceable
  semantics).
- `readGateways(input, options)` → the INERT report:
  `{ ok, filter, count, gateways, skipped, duplicates, navigated:false, signed:false,
  published:false, performed:false, readOnly:true, errors }`. Accepts a relayRead
  `read()` result / bare events array / `{events}` / deterministic local sample; each
  item is run through relayRead `normalizeRelayEvent` → `validateRelayEvent` →
  `extractGatewayFromEvent` (failures land in `skipped`), then deduped newest-per-zone.
  An unusable top-level shape degrades to `ok:false` with an empty list — it NEVER
  throws, navigates, signs, publishes, or opens a socket.
- `DEMO_GATEWAY_EVENTS` — frozen deterministic sample (two records for one zone from one
  author → 1 superseded duplicate, plus a second zone) for the debug shell only.

### 2. SDK exposure (read-only)
`src/sdk/index.js` re-exports `gatewayRead` and registers it in `SDK_SURFACE` at the
**experimental** tier. Pure helpers, no I/O, inert; no action surface.

### 3. ToriiDebug shell (read-only preview)
`src/engine/debug/shellReport.js` adds `gatewayReadReport(input?)` — shows the inert,
deduped destination preview for a sample (`navigated`/`signed`/`published`/`performed:false`
pinned). Wired into `buildShellReport` (over `DEMO_GATEWAY_EVENTS`) and exposed read-only
at `ToriiDebug.shells.gatewayRead(input?)`. The locked 4-surface `shellsSummary`
proof-board list is UNCHANGED.

### 4. `tests/gateway-read.test.js` (NEW — 22 cases)
Covers: filter shape (kind+topic always present, well-formed options kept / malformed
dropped); extract from a valid record; `d`-tag zoneId anchoring; rejection of wrong
kind / no zone id; malformed-JSON tolerance with tag fallback; text control/markup
stripping (keeps spaces/digits); https-only website/banner (rejects
javascript:/data:/http/relative); ws/wss-only credential-free deduped relays; loose
npub + 64-hex pubkey only; unknown zoneType → null; never throws on garbage; dedupe
newest-per-(pubkey+zone); demo sample (2 zones, 1 duplicate); `{events}` envelope ==
bare array; malformed events routed to `skipped`; unusable shape → `ok:false`; inert
flag invariants on every report; NO navigate/sign/publish/send/connect/write method on
the module surface; field schema; SDK exposure.

## Verification
- `npm run build` → clean (known large-chunk advisory only).
- `npm test -- --run` → **651 passed / 52 files** (was 629/51; +22 cases).
- `npm run check` → **ALL GREEN**, 14/14; check `[14]` references v0.2.164-alpha (5 docs);
  proof-surface gate `[12]` ok (4 bound).
- `npm run bundle:report` → advisory baseline unchanged (rapier chunk tracked, not gated).
- `npm run handoff:status` → VERSION v0.2.164-alpha, package in sync; exits 0.

## Safety
godMode=false. No new `setTimeout` (the only allowed cases remain nostr.js WS close +
hud.js kill-feed). No Vector3/Matrix4. No gameplay/shooter/physics change; ESC instant
pause + panel-locked cursor untouched. Debug tools ship unconditionally. Comments use
"nostrich"; "Chiefmonkey" spelling preserved. No navigation, signing, publishing,
payments, relay writes, NIP-07 actions, private-key handling, auto-connect, automatic
update, or live network — the flow READS injected/sample events and shapes a preview,
it never acts, and exposes no navigate/write/sign/publish/connect surface.

## Version markers bumped → v0.2.164-alpha
`src/config.js`, `package.json`, `index.html` (×2), `tools/regression-check.mjs`
(header, `EXPECTED_VERSION`, stale-guard now flags `v0.2.163-alpha`).

## Docs updated
`todo.md` (LEAN-2/gateway row), `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`,
`SDK_DEBUG_INDEX.md`, `GATEWAY_PROTOCOL.md` (§2 read-proof note).

## Not done (left to parent agent)
Not pushed/published. The live relay-read transport that would feed real events, the
act of travelling (the host seam in `world/handoff.js`), and the in-world
gateway/destination MESH/HUD remain deferred. Parent agent verifies, security-reviews,
deploys, publishes, pushes, and syncs docs.

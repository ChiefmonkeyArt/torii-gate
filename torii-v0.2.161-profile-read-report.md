# Torii Quest — v0.2.161-alpha: Identity / Profile Read Proof

## Goal
Use the v0.2.159 read-only relay-adapter boundary to PROVE how Nostr **kind:0
profile metadata** and **npub identity** can be READ → normalised → validated →
sanitised → displayed from injected/sample Nostr events — WITHOUT live auto-connect,
signing, publishing, key handling, payments, NIP-07 actions, or any network/WebSocket.
Read path only; the write path and the audited host transport stay deferred.

## What landed

### 1. `src/engine/nostr/profileRead.js` (NEW — pure, node-safe)
No Nostr client, no WebSocket, no relay I/O, no signing, no key handling, no NIP-07,
no DOM, no network, no auto-connect. Every helper is pure over plain data and never
throws on event data. Any avatar/banner/website URL is validated to https-only and
kept as an INERT data string — there is NO DOM `<img src>` assignment anywhere.
- `PROFILE_KIND` = `0` (NIP-01 replaceable user-metadata).
- `PROFILE_FIELDS` = `[name, displayName, about, picture, banner, nip05, lud16, website]`.
- `buildProfileFilter({ authors, since, until, limit })` → a NIP-01 filter selecting
  kind:0 profile events. Only well-formed options are included (bad options dropped,
  never a malformed filter).
- `safeProfileUrl(raw)` → an https-only absolute URL string (≤2048 chars) or `null`.
  Rejects `javascript:` / `data:` / relative / `http:` / overlong / non-string. The
  result is an inert data string; the module never assigns it to a DOM node.
- `shortPubkey(pubkey, head=8, tail=4)` → display-only truncation of a long hex key
  (`aaaaaaaa…aaaa`); `''` on non-strings; returns short keys unchanged.
- `parseProfileMetadata(content)` → the parsed kind:0 metadata object, or `{}` on any
  non-string / malformed JSON / non-object payload (never throws).
- `extractProfileFromEvent(event)` → `{ ok, profile?|errors? }` — builds a sanitised,
  display-only identity view-model from a NORMALISED kind:0 event
  (`pubkey`/`shortPubkey`/`name`/`displayName`/`about`/`picture`/`banner`/`nip05`/
  `lud16`/`website`/`created_at`). Rejects non-kind:0 events and non-hex pubkeys;
  sanitises every URL via `safeProfileUrl`; resolves a `displayName` fallback chain
  (`display_name` → `name` → short pubkey) so callers always have one label.
- `selectNewestProfiles(profiles)` → `{ profiles, dropped }` — replaceable semantics:
  keeps the newest profile (highest `created_at`) per pubkey, counting superseded
  duplicates.
- `readProfiles(input, options)` → a read-only identity report
  `{ ok, filter, count, profiles, skipped, duplicates, signed:false, published:false,
  readOnly:true, errors }`. Accepts a v0.2.159 relayRead `read()` result (`{events}`),
  a bare events array, or deterministic local sample data; runs each item through
  relayRead `normalizeRelayEvent` → `validateRelayEvent` → `extractProfileFromEvent`
  (failures collected in `skipped`), selects the newest profile per author. An
  unusable top-level shape degrades to `ok:false` with an empty list. NEVER signs,
  publishes, opens a socket, or throws; exposes NO publish/sign/send/connect surface.

### 2. SDK exposure (read-only)
`src/sdk/index.js` re-exports `profileRead` and registers it in `SDK_SURFACE` at the
**experimental** tier. Safe: pure helpers, no I/O, inert without injected/sample events.

### 3. ToriiDebug shell (deterministic local sample, display-only)
`src/engine/debug/shellReport.js` adds `DEMO_PROFILE_EVENTS` (a frozen LOCAL sample of
four kind:0 events — a valid full profile, a superseded older duplicate of the same
pubkey, a profile carrying an unsafe `javascript:` picture URL, and one with malformed
JSON content) and `profileReadReport(events?, opts?)`. Wired into `buildShellReport`
and exposed read-only at `ToriiDebug.shells.profileRead()`. The locked 4-surface
`shellsSummary` proof-board list is UNCHANGED.

### 4. `tests/profile-read.test.js` (NEW — 17 cases)
Covers `buildProfileFilter` (kind:0; well-formed vs malformed options);
`safeProfileUrl` (accept https, reject http/javascript/data/relative/null/overlong);
`parseProfileMetadata` (JSON object vs malformed/array/empty/null → `{}`);
`shortPubkey` (truncate long, leave short/empty/null); `extractProfileFromEvent`
(sanitised view-model, unsafe-URL → null, displayName fallback chain, malformed-JSON
degrade, reject wrong kind / bad pubkey / null); `selectNewestProfiles`
(newest-per-pubkey + dropped count); `readProfiles` (parse + filter shape, `{events}`
envelope + dedupe, skip malformed/non-kind:0, safe degradation on unusable shapes, no
publish/sign/send/connect/close/write surface) + SDK exposure.

## Verification
- `npm test` → **590 passed / 49 files** (was 573/48; +17 cases).
- `npm run build` → clean (known large-chunk advisory only).
- `npm run check` → **ALL GREEN**, 14/14; check `[14]` references v0.2.161-alpha (5 docs);
  proof-surface gate `[12]` ok (4 bound).
- `npm run bundle:report` → advisory baseline unchanged (rapier chunk tracked, not gated).
- `npm run handoff:status` → VERSION v0.2.161-alpha, package in sync; exits 0.

## Safety
godMode=false. No WebSocket/fetch/XHR in the module — pure data shaping + predicates
over injected/sample events. No new `setTimeout`. No Vector3/Matrix4. No signing,
publishing, payments, relay writes, NIP-07 actions, private-key handling, auto-connect
from the game loop, or navigation. Avatar/banner/website URLs are sanitised to
https-only INERT data strings — NO DOM `<img src>` assignment. The reader only
consumes events handed to it; it never touches the wire and exposes no write/connect
surface.

## Version markers bumped → v0.2.161-alpha
`src/config.js`, `package.json`, `index.html` (×2), `tools/regression-check.mjs`
(header, `EXPECTED_VERSION`, stale-guard now flags `v0.2.160-alpha`).

## Docs updated
`todo.md`, `progress.md`, `HANDOFF.md`, `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`.

## Not done (left to parent agent)
Not pushed/published. The audited host wire-up — the actual WS REQ→EOSE collector
implementing the injected `request` transport, CSP `connect-src` relay entries, and
rate-limiting — remains deferred, as does the write path (NIP-07 signer + relay
publish, SEC-1) and the in-world identity-card MESH/HUD. Parent agent verifies,
security-reviews, deploys, publishes, pushes, and syncs docs.

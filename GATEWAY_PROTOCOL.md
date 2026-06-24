# Torii Gateway Protocol — n2n Spatial Hop (DRAFT)

> **Status:** DRAFT (v0.1, GWPROTO-1, landed v0.2.134-alpha). This is a working
> draft of the wire agreement, not a frozen spec. It is implementation-independent
> on purpose — any Nostr/Bitcoin world should be able to implement it, not just
> Torii Quest.
>
> **Scope of this version:** the relay-first **URL handoff MVP** is specified
> concretely (Torii ships pure helpers for it in `src/engine/gateway/travelIntent.js`).
> The **signed spatial event** is specified as the forward target, not yet
> implemented. No signing, publishing, or browser navigation is performed by the
> current code.

---

## 0. Component is code, protocol is agreement

This is the central distinction and the reason this file exists separately from
the gateway component:

- The **Torii Gateway component** (`src/engine/components/toriiGateway.js`, CMP-8)
  is **code** — one concrete, droppable implementation of a gate. It is owned by
  whoever ships it, it can be rewritten, forked, or replaced, and it carries
  Torii-specific assumptions.
- The **Gateway Protocol** (this document) is an **agreement** — the shape of the
  message two independently-built worlds exchange so a player can cross from one
  into the other. It carries no code and no Torii assumptions. A world that has
  never heard of Torii Quest can implement it.

A protocol survives its first implementation. If the only way to travel between
worlds is "run the Torii component," then there is no commons — there is one
client. The handoff is fundamentally a *spatial* event (cross a gate in world A,
arrive in world B carrying your identity), so it belongs in the open, like any
other Nostr event kind.

---

## 1. Identity: world, zone, gateway

Three nested identities, all anchored to a Nostr `npub` for ownership/provenance:

| Thing | What it is | Identity |
|---|---|---|
| **World / node** | An independently-operated instance (a game client + its relays). | `npub` of the operator + a human label. |
| **Zone** | A scoped space inside a world (a NAP zone, arena, shop, gallery). | `zone` id, unique within the world; optional `npub` if separately owned. |
| **Gateway** | A specific gate placed in a zone that points at a destination. | `gateway` id + the destination block it carries. |

Ownership rule: a destination is addressed by **`npub` (+ optional `relay` hint)**,
not by a hostname. The npub is the durable identity; relays and URLs are
discovery hints that can change. This keeps the graph self-sovereign — no central
registry of worlds, no DNS dependency for identity (DNS may still serve the
*bytes* of a client, but it does not *name* the destination).

---

## 2. Discovery: relay-first hybrid

How does a gate learn where it can send a player, and how does a destination
world know a traveller is coming?

**Relay-first hybrid** — try relays first, fall back to direct hints:

1. **Relay-mediated (preferred).** Worlds publish a discoverable presence/zone
   descriptor to shared relays (a world-registry event, future kind TBD). A gate
   resolves its destination `npub` → current `relay` + entry data by querying
   relays. This is the Nostr-native path: no central server, censorship-resistant,
   and it lets a destination move relays without breaking inbound gates.

   > **Read-proof (v0.2.164, `src/engine/gateway/gatewayRead.js`).** The READ side
   > of this path now has a pure, inert proof: `readGateways(input,options)`
   > consumes injected/sample relay events (whatever a read-only transport WOULD
   > return), builds a NIP-01 filter for kind **30078** (NIP-78 app data — the
   > read-proof choice while the registry kind is TBD) carrying the discovery topic
   > tag `['t','torii-gateway']`, and extracts each event into a SANITISED travel-
   > preview model (`zoneId` from the `d` tag, `title`/`description`/`zoneType`,
   > `npub`/`pubkey`, https-only `website`/`banner`, ws/wss `relays`, `topics`,
   > `created_at`, `trust:'unverified'`), deduped to the newest record per
   > addressable `pubkey+zoneId` (parameterised-replaceable semantics). It NEVER
   > navigates, queries the network, signs, or publishes — the report pins
   > `navigated:false`/`signed:false`/`published:false`/`performed:false`/
   > `readOnly:true`. This proves how a gate would read + validate a destination
   > descriptor into a safe preview; the live relay query + the act of travelling
   > remain deferred (§6).
2. **Direct hint fallback.** The gate's manifest already carries a `relay` hint
   and (in the URL-handoff MVP) a destination URL. If relays are unavailable or
   the destination has not published a descriptor, the gate uses these static
   hints directly. Lower resilience, but always works for a known pair.

The two are not exclusive — the static hint seeds discovery, the relay refreshes
it. Implementations MAY ship with only the fallback (URL MVP) and add relay
discovery later without changing the travel-intent shape (§4).

---

## 3. URL handoff MVP (implemented helpers)

The minimum viable hop, with **no signing and no relay**: a safe, parseable URL
(or equivalent intent object) that describes a travel request. This is what
`src/engine/gateway/travelIntent.js` builds and parses today. It is a *transport
encoding* of the travel intent in §4 — the same fields, serialised into a query
string a host can hand to a (future) navigation layer.

Properties:

- **Pure data, no side effects.** The helper *builds* and *parses* — it never
  navigates the browser. Whether/how to act on a parsed intent is the host's
  decision (and a separate, reviewable step).
- **Validated.** Required fields (`to`) must be present; npub-shaped fields are
  shape-checked; unknown/malformed input yields a structured error, never a throw.
- **Round-trippable.** `parseTravelUrl(buildTravelUrl(intent))` returns an
  equivalent intent.
- **Forward-compatible.** The URL carries exactly the §4 fields, so upgrading the
  MVP to a signed event (§6) is additive: the same intent gains a `sig`/`pubkey`
  and moves from a query string to an event body.

The URL form is explicitly a **bootstrap**, not the destination. It is trivially
forgeable (anyone can type a URL), so it is only acceptable while worlds are
trusted/demo-grade. Trust comes with §6.

---

## 4. Travel intent (the core payload)

The travel intent is the implementation-independent heart of the protocol. Both
the URL MVP (§3) and the future signed event (§6) carry these fields:

| Field | Req | Meaning |
|---|---|---|
| `to` | **yes** | Destination identity — the world/zone owner `npub` (or a `world:zone` address). Where the player is going. |
| `from` | no | Source identity — the origin world/zone `npub`/address. Where the player came from (provenance + analytics). |
| `return` | no | Return address — where "go back" sends the player. Often equal to `from`, but may differ (e.g. a hub). Enables the return path (§5). |
| `spawn` | no | Spawn point id / label within the destination zone (which entry point to arrive at). |
| `zoneType` | no | Hint about the destination kind (`nap`, `arena`, `shop`, `gallery`, …) so the host can prepare the right scene before arrival. |
| `relays` | no | Ordered list of relay URLs to reach the destination (discovery hint; see §2). |
| `player` | no | Traveller identity (`npub`) — who is travelling. Omitted in anonymous demos; required for a signed hop. |
| `state` | no | Opaque pointer to carried state (a hash/id, not the state itself — keep payloads small; the destination fetches state out-of-band). |

Design rules:
- **Address by npub, not host.** `to`/`from`/`return` are identities; `relays`
  are hints.
- **Carry a pointer, not a payload.** `state` is a reference, never a blob — the
  hop stays small and the destination pulls what it needs.
- **Minimal required set.** Only `to` is mandatory; everything else degrades
  gracefully so a bare hop still works.

---

## 5. Entry points and the return path

- **Entry points.** A destination zone exposes named spawn points. The intent's
  `spawn` selects one; absent that, the destination chooses a default. Entry
  points let a single zone be entered "at the front door," "at the market stall,"
  etc., without separate gateways.
- **Return path.** A hop SHOULD carry `return` so the destination can offer "go
  back" without the player getting stranded. The return is itself a travel intent
  (the destination builds a new hop addressed at `return`). This makes travel
  symmetric and composable — A→B→A is just two intents, and a hub can route
  A→Hub→B.

Statelessness: the protocol does not require either side to hold a session. Each
hop is a self-contained intent. Return works because the address travels *with*
the player, not because a server remembers them.

---

## 6. Signed spatial event (forward target, not yet built)

The trust upgrade. The travel intent (§4) becomes the content of a **signed Nostr
event**: the traveller (or the source world) signs the hop with their key, so the
destination can verify *who* is arriving and *where from* before admitting them.

Sketch (fields, not a frozen kind):

- `pubkey` — signer (traveller npub, or source-world npub for world-authorised hops).
- `kind` — a spatial-hop kind (TBD; candidate for the NIP in §8).
- `content` / `tags` — the §4 travel intent (to/from/return/spawn/zoneType/relays/state).
- `created_at`, `id`, `sig` — standard Nostr event integrity.

This makes a hop **unforgeable and attributable** the same way the component
economy does it: **attribution travels with the npub, integrity with the
signature** (see `COMPONENTS.md` provenance rules). The URL MVP becomes the
unsigned/demo tier; the signed event is the trust tier. No code in v0.2.134
signs or publishes anything — this section is the target the MVP is shaped to
grow into.

> **Travel-intent confirmation (v0.2.165, `src/engine/gateway/travelConfirm.js`).**
> Before any hop is performed, the destination is prepared and CONSENT-CHECKED. The
> READ-side `gatewayRead` preview model (§2) — or a plain destination descriptor — is
> re-sanitised by `sanitizeDestination` (required `zoneId`; control/markup-stripped text;
> https-only website; ws/wss credential-free relays; valid npub/hex pubkey; known
> `zoneType`) and routed through the v0.2.162 consent gate's `gateway:travel` action by
> `prepareTravelIntent(input, grant)`. The result is INERT —
> `{ok, action, destination, consent, summary, navigated:false, performed:false,
> signed:false, published:false, readOnly:true}` — BLOCKED by default (`consent-required`)
> and allowed only with an explicit matching grant. Even when allowed, it NEVER navigates,
> unloads/reloads the world, signs, publishes, or opens a socket: `allowed:true` is proof
> of what the host *could* later execute, not the act itself. The actual world hop
> (§5, `world/handoff.js`) and the consent UX that mints the grant remain the deferred
> host steps.

---

## 7. Relays

- Relays are **transport and discovery**, never identity. A destination is its
  npub; relays are where you currently reach it.
- A hop SHOULD carry a small ordered `relays` hint; a robust client also resolves
  the destination npub against its own relay set.
- Operators are free to run private/community relays. The protocol assumes
  multiple, possibly overlapping relay sets — no canonical relay.

---

## 8. Security and trust

The honest threat model for each tier:

| Tier | Forgeable? | Acceptable for |
|---|---|---|
| URL handoff MVP (§3) | Yes — anyone can craft a URL. | Demos, trusted pairs, local/dev. |
| Signed event (§6) | No — requires the signer's key. | Real cross-world travel between untrusted worlds. |

Rules even at MVP tier:
- **No implicit navigation.** Parsing an intent never moves the player. Acting on
  it is a separate host decision (so a malicious link cannot teleport/grief a
  player without host mediation).
- **Validate at the boundary.** Treat every inbound intent as untrusted input:
  shape-check npubs, reject unknown/oversized fields, never `eval` or fetch from
  unvalidated URLs. (Consistent with the existing Nostr-avatar URL validation and
  CSP hardening already in the codebase.)
- **State is a pointer, fetched and re-validated by the destination** — the
  source cannot push arbitrary state into the destination; it can only point at
  state the destination chooses to fetch and check.
- **Destination consent.** A world MAY refuse a hop (unknown source, blocklist,
  capacity). Admission is the destination's right, mirroring component
  host-side verification.

---

## 9. Possible NIP path

Once the signed-event format (§6) is stable and demonstrated **cross-world** (a
Torii gate handing off to a second world that implements only this document, not
Torii code), it is a candidate to propose as a **NIP** — a spatial-hop / world-
handoff event kind for the wider Nostr ecosystem. The staged path mirrors
`strategy.md` → *Nostr Spatial Gateway Protocol*:

1. Reference component — Torii Gateway (landed v0.2.133). ✅
2. **This spec** — extract the wire format (GWPROTO-1, v0.2.134). ✅ (draft)
3. Interop demo — validate with a non-Torii consumer. ⏳
4. Propose as a NIP once stable and demonstrated. ⏳

The end state: the metaverse layer is a graph of independently-owned worlds
linked by signed spatial events, with **no central router**.

---

## 10. Relationship to the code

- `src/engine/components/toriiGateway.js` (CMP-8) — the reference **component**;
  its manifest carries `gateway: { npub, relay, target, position }`, the
  destination wiring a host reads to build a travel intent.
- `src/engine/gateway/travelIntent.js` (v0.2.134) — pure **helpers** that
  build/parse/validate the URL-handoff MVP intent (§3–§4). No navigation, no
  signing, no relay I/O.
- `src/engine/gateway/gatewayHandoff.js` (v0.2.135) — pure **shell** that joins
  the two: `gatewayDestination(component)` reads the gate's `gateway` block,
  `planGatewayTravel(component, context)` maps it (+ host context: from/player/
  spawn/return/zoneType/state) onto a validated travel intent, and
  `gatewayTravelUrl(component, context, {base})` serialises a valid plan to a URL.
  Pure return values — still NO `window.location` / relay / signing.
- `src/engine/gateway/gatewayPortal.js` (v0.2.136) — pure **view shell** over the
  handoff: `gatewayPortalView(component, context, {base,prompt})` returns a
  render-ready portal view-model `{ status, isGateway, armed, destination,
  destinationLabel, relay, prompt, plan, urlPreview, errors }` for a portal mesh to
  display. `armed = plan.valid`; `prompt` and `urlPreview` are blank unless armed,
  so an invalid/unconfigured gate shows no actionable travel affordance.
  DISPLAY-ONLY — it never assigns `window.location`, contacts a relay, or signs;
  crossing the gate is still the deferred host step in `world/handoff.js`.
- `src/engine/gateway/gatewayRead.js` (v0.2.164) — pure **read proof** for the
  destination-record READ path (§2): builds the kind-30078 `#t:torii-gateway` filter
  and extracts/sanitises injected/sample relay events into a safe travel-preview model,
  deduped newest-per-zone. No relay I/O, navigation, or signing.
- `src/engine/gateway/travelConfirm.js` (v0.2.165) — pure **travel confirmation/intent**
  behind the consent gate (§6 note): `sanitizeDestination` re-sanitises a `gatewayRead`
  preview model or a plain descriptor, and `prepareTravelIntent(input, grant)` routes it
  through `evaluateConsent('gateway:travel', grant)` into an INERT
  `{ok, action, destination, consent, summary, navigated:false, performed:false, …}`
  report. BLOCKED by default; allowed-but-never-performed with a matching grant. No
  navigation/world-unload/signing/publishing/relay I/O.
- `src/engine/consent/consentView.js` (v0.2.166) — pure **consent UX view-model** over the
  consent gate: `consentPromptView(input, grant)` re-shapes the `gateway:travel` (and every
  other) consent decision into INERT, render-ready PROMPT copy (`{title, badge, severity,
  headline, bodyLines, actionLabel, cancelLabel, allowed, blocked, reason, …,
  performed:false, actionable:false, readOnly:true}`); `consentPromptRows(grants)` gives one
  inert preview row per action. DISPLAY-ONLY — a rendered "Travel" label is COPY, not a wired
  button; it exposes no confirm/navigate/sign/publish method. The clickable confirm dialog
  that MINTS the grant is still the deferred host step.
- `src/world/handoff.js` — the (skeleton) host seam where a future build will act
  on a validated intent.

Component is code. Protocol is agreement. This file is the agreement; the modules
above are one implementation of it.

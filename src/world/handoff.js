// world/handoff.js — NAP-to-NAP travel handoff (SKELETON, v0.2.110).
//
// Goal (eventual): hop from my NAP zone into someone else's online NAP zone.
// This module implements ONLY the pure, local pieces of that flow — the signed
// event SHAPE plus serialize / deserialize / structural-verify and a local
// "apply handoff to spawn" helper. There is NO online jump here: no relay
// publish, no remote fetch, no presence side effects. The relay-mediated and
// node-to-node transports are deliberately deferred (see presence.js).
//
// Trade-off recorded for later: relay-mediated handoff is easier and more
// Nostr-native than direct node-to-node; start relay-mediated, keep the event
// shape transport-agnostic so node-to-node can be added without a format change.

export const HANDOFF_KIND = 30079;            // app-specific, sibling of NAP_ZONE_KIND
export const HANDOFF_NAMESPACE = 'torii.handoff';
export const HANDOFF_SCHEMA_VERSION = 1;

// Minimum player state carried between zones. Kept intentionally small —
// position is the destination's concern (we spawn at its entry point), so we
// carry identity + display + a loadout pointer, not absolute coordinates.
//
// {
//   v:        1,
//   kind:     'torii.handoff',
//   player:   'npub1...',          // travelling identity
//   from:     'cm-home',           // source zone id
//   to:       'banker-bazaar',     // destination zone id
//   display:  { character, name }, // how to render the arrival
//   carry:    { },                 // optional inventory/state pointer (opaque)
//   ts:       <unix seconds>
// }
export function createHandoffEvent({
  player,
  from,
  to,
  display = {},
  carry = {},
} = {}) {
  return {
    v: HANDOFF_SCHEMA_VERSION,
    kind: HANDOFF_NAMESPACE,
    player: String(player || ''),
    from: String(from || ''),
    to: String(to || ''),
    display: display && typeof display === 'object' ? display : {},
    carry: carry && typeof carry === 'object' ? carry : {},
    ts: Math.floor(Date.now() / 1000),
  };
}

// Structural verification only — checks the shape + a freshness window. Does
// NOT verify a cryptographic signature (that is the signing layer's job once a
// real transport exists). Returns { ok:true } | { ok:false, error }.
const HANDOFF_MAX_AGE_S = 300; // a handoff older than 5 min is stale
export function verifyHandoffEvent(h, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (!h || typeof h !== 'object') return { ok: false, error: 'not an object' };
  if (h.v !== HANDOFF_SCHEMA_VERSION) return { ok: false, error: 'bad schema version' };
  if (h.kind !== HANDOFF_NAMESPACE) return { ok: false, error: 'bad namespace' };
  if (!h.player) return { ok: false, error: 'missing player npub' };
  if (!h.to) return { ok: false, error: 'missing destination zone' };
  if (typeof h.ts !== 'number') return { ok: false, error: 'missing timestamp' };
  if (now - h.ts > HANDOFF_MAX_AGE_S) return { ok: false, error: 'stale handoff' };
  return { ok: true };
}

// Local serialization for a same-browser/local jump demo: encode to a string a
// destination instance can read back. No network — just a transport-agnostic
// envelope. Returns a string, or throws if the handoff is malformed.
export function serializeHandoff(h) {
  const v = verifyHandoffEvent(h, { now: h?.ts ?? 0 }); // shape-only (skip freshness for round-trip)
  if (!v.ok && v.error !== 'stale handoff') throw new Error(`invalid handoff: ${v.error}`);
  return JSON.stringify(h);
}

export function deserializeHandoff(str) {
  if (typeof str !== 'string') return null;
  try { return JSON.parse(str); } catch { return null; }
}

// Resolve where an arriving player should spawn, given a verified handoff and
// the destination zone's metadata (from napZone.js). Pure: returns the spawn
// descriptor; the caller is responsible for actually moving the player object.
// Returns null if the handoff fails verification.
export function resolveHandoffSpawn(h, destZoneMeta) {
  if (!verifyHandoffEvent(h).ok) return null;
  if (!destZoneMeta || !destZoneMeta.spawn) return null;
  if (destZoneMeta.id && h.to && destZoneMeta.id !== h.to) return null;
  return {
    zone: destZoneMeta.id,
    spawn: destZoneMeta.spawn,
    player: h.player,
    display: h.display || {},
  };
}

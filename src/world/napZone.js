// world/napZone.js — NAP zone metadata format (SKELETON, v0.2.110).
//
// A NAP zone is a peaceful, player-owned, programmable social space beyond the
// torii gate. This module defines the *data shape* and pure (network-free)
// builders/validators for a zone's metadata. It is intentionally inert: nothing
// here touches a relay, a wallet, or the running game. Federation, decoration
// persistence, and live discovery are deliberately NOT implemented yet — see
// presence.js (discovery) and handoff.js (travel) for their own skeletons.
//
// Carrier event: NIP-78 application-specific data (kind 30078), a parameterized
// replaceable event. The `d` tag is the stable zone identifier, so re-publishing
// the same zone replaces the prior metadata for that owner npub.

export const NAP_ZONE_KIND = 30078;          // NIP-78 app-specific data
export const NAP_ZONE_NAMESPACE = 'torii.napzone';
export const NAP_ZONE_SCHEMA_VERSION = 1;

// The canonical in-memory shape of a NAP zone's metadata. All fields are plain
// JSON so the object round-trips through a Nostr event content string cleanly.
//
// {
//   v:        1,                       // schema version
//   kind:     'torii.napzone',         // namespace marker
//   id:       'cm-home',               // zone id (becomes the `d` tag)
//   owner:    'npub1...',              // owner identity (primary source of truth)
//   name:     'Chiefmonkey HQ',        // display name
//   policy:   'nap',                   // 'nap' = non-aggression; weapons inert
//   spawn:    { x, y, z, yaw },        // entry point for arriving players
//   portals:  [ { id, toZone, at:{x,y,z} } ],   // links to other zones
//   decor:    [ { type, ref, at:{x,y,z}, rot, scale } ], // wallpaper/signs/GLBs
//   links:    { chat, market },        // community / commerce pointers
//   updated:  <unix seconds>
// }

// Build a fresh zone metadata object from partial input. Pure — no IO.
export function createNapZoneMetadata({
  id,
  owner,
  name = 'Unnamed NAP Zone',
  policy = 'nap',
  spawn = { x: 28, y: 0, z: 0, yaw: -Math.PI / 2 },
  portals = [],
  decor = [],
  links = {},
} = {}) {
  return {
    v: NAP_ZONE_SCHEMA_VERSION,
    kind: NAP_ZONE_NAMESPACE,
    id: String(id || ''),
    owner: String(owner || ''),
    name: String(name),
    policy,
    spawn,
    portals: Array.isArray(portals) ? portals : [],
    decor: Array.isArray(decor) ? decor : [],
    links: links && typeof links === 'object' ? links : {},
    updated: Math.floor(Date.now() / 1000),
  };
}

// Structural validation only — does NOT verify signatures or relay provenance
// (that belongs to a signing/verification layer added later). Returns
// { ok:true } or { ok:false, error:'...' }.
export function validateNapZoneMetadata(meta) {
  if (!meta || typeof meta !== 'object') return { ok: false, error: 'not an object' };
  if (meta.v !== NAP_ZONE_SCHEMA_VERSION) return { ok: false, error: 'bad schema version' };
  if (meta.kind !== NAP_ZONE_NAMESPACE) return { ok: false, error: 'bad namespace' };
  if (!meta.id) return { ok: false, error: 'missing id' };
  if (!meta.owner) return { ok: false, error: 'missing owner npub' };
  if (meta.spawn == null || typeof meta.spawn.x !== 'number') return { ok: false, error: 'bad spawn' };
  if (!Array.isArray(meta.portals)) return { ok: false, error: 'portals must be array' };
  if (!Array.isArray(meta.decor)) return { ok: false, error: 'decor must be array' };
  return { ok: true };
}

// Shape an unsigned Nostr event for the zone metadata. The caller signs it with
// a NIP-07 extension (window.nostr.signEvent) — we never touch keys here.
export function toUnsignedZoneEvent(meta) {
  const v = validateNapZoneMetadata(meta);
  if (!v.ok) throw new Error(`invalid NAP zone metadata: ${v.error}`);
  return {
    kind: NAP_ZONE_KIND,
    created_at: meta.updated || Math.floor(Date.now() / 1000),
    tags: [
      ['d', meta.id],                       // replaceable identifier
      ['t', NAP_ZONE_NAMESPACE],            // discoverability tag
      ['name', meta.name],
    ],
    content: JSON.stringify(meta),
  };
}

// Parse the metadata back out of a (signed or unsigned) zone event. Returns the
// metadata object or null if the content is unparseable / invalid.
export function fromZoneEvent(event) {
  if (!event || typeof event.content !== 'string') return null;
  let meta;
  try { meta = JSON.parse(event.content); } catch { return null; }
  return validateNapZoneMetadata(meta).ok ? meta : null;
}

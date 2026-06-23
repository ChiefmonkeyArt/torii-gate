// identity/presence.js — Nostr presence + zone discovery (SKELETON, v0.2.110).
//
// DISABLED BY DEFAULT. This module defines the API surface for "who/what is
// online" without changing any live relay behaviour. Every network-capable
// function is gated behind PRESENCE_ENABLED and returns an inert result while
// the flag is false, so importing or even calling these is safe in alpha:
// nothing connects to a relay, publishes, or subscribes until the flag is
// flipped AND the functions are fleshed out.
//
// Design intent (for when this is implemented):
//   • publishPresence(zoneId) → ephemeral event (kind 20000-range) announcing
//     "npub X is in zone Y right now".
//   • discoverZones() → query relays for NAP_ZONE_KIND events, return zone list.
//   • subscribePresence(zoneId, cb) → live REQ subscription, cb per presence.
//
// The reconciled nostr.js already owns relay URLs + NIP-07 login; a real
// implementation should reuse that rather than opening parallel sockets.

export const PRESENCE_ENABLED = false; // NEVER flip on without a relay-privacy review
export const PRESENCE_KIND = 20078;    // ephemeral presence (NIP-16 ephemeral range)

// Announce presence in a zone. No-op while disabled. Returns the unsigned event
// it *would* publish (so callers/tests can inspect the shape) without sending.
export function publishPresence(zoneId, { npub = null } = {}) {
  const unsigned = {
    kind: PRESENCE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['d', 'torii.presence'], ['zone', String(zoneId || '')]],
    content: JSON.stringify({ zone: zoneId, npub }),
  };
  if (!PRESENCE_ENABLED) return { sent: false, reason: 'presence disabled', unsigned };
  // Real relay publish intentionally NOT implemented yet.
  return { sent: false, reason: 'not implemented', unsigned };
}

// Discover online NAP zones from relay metadata. Returns [] while disabled.
export async function discoverZones() {
  if (!PRESENCE_ENABLED) return [];
  // Real relay query intentionally NOT implemented yet.
  return [];
}

// Subscribe to presence updates for a zone. Returns an unsubscribe function.
// While disabled it never connects and the unsubscribe is a no-op.
export function subscribePresence(zoneId, cb) {
  if (!PRESENCE_ENABLED) return () => {};
  // Real subscription intentionally NOT implemented yet.
  void cb; void zoneId;
  return () => {};
}

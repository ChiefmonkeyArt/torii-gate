// engine/gateway/handoffArrival.js — P2 cross-host arrival / seating gate (v0.2.274).
// The HOST side of the n2n hop. A traveller on host A jumps to host B's spawn URL
// carrying their npub (`?torii-traveller=<hex64>`, appended by urlHarden.appendTraveller
// after a SEC-2 crypto-verified accept). This module is what host B uses on arrival to
// decide WHO is arriving — and to refuse impersonation.
//
// The threat: the `torii-traveller` query param alone is unforgeable-attribution-FREE —
// anyone can craft `?torii-traveller=<victim>` and load host B. So the param is only a
// HINT. Seating the arriving player as that npub is gated by a real BIP-340 schnorr
// proof: host B must hold the traveller's SIGNED travel REQUEST (kind-30078, addressed
// to host B, authored by the arriving pubkey). The traveller signed that request with
// their key, so verifying it proves they (a) control the arriving npub and (b) actually
// asked to travel to THIS host. No valid signed request → seat as anon (fail closed).
//
// PURE + node-safe: NO DOM, NO socket, NO navigation, NO key handling. It consumes a URL
// string + a sanitised request model (from travelRequest.extractTravelRequest, which now
// carries the signed-event fields) and returns a verdict. The host (main.js / the
// handshake controller) does the relay I/O and the actual seating.

import { verifyNostrEventSig } from '../crypto/nostrSig.js';

const HEX64 = /^[0-9a-f]{64}$/;
function _isHex64(v) { return typeof v === 'string' && HEX64.test(v); }

// The query param appendTraveller writes. Single source of truth so the writer
// (urlHarden) and the reader (here) cannot drift.
export const TRAVELLER_PARAM = 'torii-traveller';

// readArrivingTraveller(url) → { ok, pubkey, error }. Pure; never throws. Parses the
// `torii-traveller` query param from an inbound URL string and validates it is a hex64
// nostr pubkey. A missing/invalid param is ok:false (no arrival), not a throw.
export function readArrivingTraveller(url) {
  if (typeof url !== 'string' || url.length === 0) return { ok: false, pubkey: null, error: 'url-required' };
  let u;
  try { u = new URL(url); } catch { return { ok: false, pubkey: null, error: 'url-unparseable' }; }
  const raw = u.searchParams.get(TRAVELLER_PARAM);
  if (raw == null || raw === '') return { ok: false, pubkey: null, error: 'no-traveller' };
  if (!_isHex64(raw)) return { ok: false, pubkey: null, error: 'bad-pubkey' };
  return { ok: true, pubkey: raw, error: null };
}

// verifyArrival({ arrivingPubkey, request, expectedHostPubkey }) →
//   { ok, seated, trust, npub, errors }. Pure; never throws.
//
//   ok      — inputs were well-formed enough to evaluate (false = malformed)
//   seated  — the arrival is crypto-verified and may be seated as `npub`
//   trust   — 'crypto-verified' (full pass) | 'unverified' (not seatable)
//   npub    — the verified arriving pubkey (only when seated:true; else null)
//   errors  — human-readable reasons (empty when seated)
//
// Checks (ALL must pass for seated:true):
//   1. request carries a signed envelope + sig (request.signed + request.sig)
//   2. the signed event's author === arrivingPubkey (the request was signed by the
//      arriving identity — not merely tagged with it)
//   3. request.travellerPubkey === arrivingPubkey (sanitised model agrees)
//   4. request.hostPubkey === expectedHostPubkey (addressed to THIS host)
//   5. the BIP-340 schnorr signature verifies under arrivingPubkey over the NIP-01
//      event id (S1 crypto floor) — a forged/tampered/absent sig fails closed
export function verifyArrival(opts = {}) {
  const o = opts && typeof opts === 'object' && !Array.isArray(opts) ? opts : {};
  const arrivingPubkey = typeof o.arrivingPubkey === 'string' ? o.arrivingPubkey.trim() : '';
  const expectedHostPubkey = typeof o.expectedHostPubkey === 'string' ? o.expectedHostPubkey.trim() : '';
  const request = o.request && typeof o.request === 'object' && !Array.isArray(o.request) ? o.request : null;

  const fail = (errors) => ({ ok: true, seated: false, trust: 'unverified', npub: null, errors });

  if (!_isHex64(arrivingPubkey)) return { ok: false, seated: false, trust: 'unverified', npub: null, errors: ['arrivingPubkey must be hex64'] };
  if (!_isHex64(expectedHostPubkey)) return { ok: false, seated: false, trust: 'unverified', npub: null, errors: ['expectedHostPubkey must be hex64'] };
  if (!request) return { ok: false, seated: false, trust: 'unverified', npub: null, errors: ['request model is required'] };

  const errors = [];

  // 1. signed envelope present
  if (typeof request.sig !== 'string' || !request.signed || typeof request.signed !== 'object') {
    return fail(['arriving request is not crypto-signed']);
  }
  // 2. the signed envelope's author must BE the arriving identity
  if (request.signed.pubkey !== arrivingPubkey) {
    errors.push('signed request author is not the arriving traveller');
  }
  // 3. sanitised model agrees on the traveller
  if (request.travellerPubkey !== arrivingPubkey) {
    errors.push('request traveller pubkey does not match the arriving npub');
  }
  // 4. addressed to THIS host
  if (request.hostPubkey !== expectedHostPubkey) {
    errors.push('request was not addressed to this host');
  }
  // 5. real BIP-340 schnorr verification (S1 crypto floor)
  if (!verifyNostrEventSig({
    pubkey: request.signed.pubkey,
    created_at: request.signed.created_at,
    kind: request.signed.kind,
    tags: request.signed.tags,
    content: request.signed.content,
    id: request.id,
    sig: request.sig,
  })) {
    errors.push('schnorr signature verification failed');
  }

  if (errors.length) return fail(errors);
  return { ok: true, seated: true, trust: 'crypto-verified', npub: arrivingPubkey, errors: [] };
}

// seatArrivalDecision(verdict) → { identity, anon }. Pure. Maps a verifyArrival verdict
// onto the host's seating decision: a crypto-verified arrival seats AS that npub; every
// other outcome (no proof / tampered / wrong host) fails CLOSED to an anonymous seat.
export function seatArrivalDecision(verdict) {
  if (verdict && verdict.seated === true && _isHex64(verdict.npub)) {
    return { identity: verdict.npub, anon: false };
  }
  return { identity: null, anon: true };
}

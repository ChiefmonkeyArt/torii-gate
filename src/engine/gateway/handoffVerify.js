// engine/gateway/handoffVerify.js — SEC-2 handoff verification gate (P1, v0.2.252;
// real BIP-340 crypto landed S1, v0.2.263).
// The gate a traveller clears BEFORE trusting a host's signed accept and acting
// on the hop. Given a sanitised accept RESPONSE (from travelRequest.
// extractTravelResponse) and what the traveller EXPECTS (the request id they
// sent, the host pubkey they addressed it to, their own traveller pubkey), it
// verifies the response is a genuine, correctly-attributed accept for THIS hop.
//
// PURE + node-safe: NO DOM, NO socket, NO signing, NO navigation. It consumes a
// sanitised model + expectation and returns a verdict. The cheap STRUCTURAL
// checks (host identity match + request reference + traveller addressing + https
// spawn) run first as a fast pre-flight with good error messages, THEN the real
// BIP-340 schnorr signature is verified (S1): the response must carry the host's
// nostr signature over its NIP-01 event id, and that signature must verify under
// the host pubkey. A response with no signature, a tampered body, or a sig from
// the wrong key fails closed. The `trust` field reports 'crypto-verified' only on
// a full pass; 'unverified' otherwise. There is no longer a structural-only
// trusted path — a hop arms ONLY on a real signature.
//
// Checks (ALL must pass for trusted:true):
//   1. response.accepted === true            (a deny never arms a hop)
//   2. response.referencesRequestId === expectedRequestId  (it answers OUR ask)
//   3. response.hostPubkey === expectedHostPubkey         (signed by the host we chose)
//   4. response.travellerPubkey === expectedTravellerPubkey (addressed to US)
//   5. response.spawn is a valid https URL    (SEC-3 will deepen the URL check;
//      until then, a non-https/absent spawn on an accept fails closed)
//   6. response carries a BIP-340 schnorr signature (response.sig + response.signed)
//      that verifies under response.hostPubkey over the NIP-01 event id (S1)

import { verifyNostrEventSig } from '../crypto/nostrSig.js';

const HEX64 = /^[0-9a-f]{64}$/;
function _isHex64(v) { return typeof v === 'string' && HEX64.test(v); }

function _safeHttps(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  return u.protocol === 'https:' ? u.href : null;
}

// verifyHandoff({ response, expectedRequestId, expectedHostPubkey,
//   expectedTravellerPubkey, requireSpawn }) →
//   { ok, trusted, trust, errors }. Pure; never throws.
//
//   ok      — the inputs were well-formed enough to evaluate (false = malformed)
//   trusted — the accept passes every check AND its schnorr sig verifies (arm ok)
//   trust   — 'crypto-verified' (full pass) | 'unverified' (not trusted)
//   errors  — human-readable reasons (empty when trusted)
export function verifyHandoff(opts = {}) {
  const o = opts && typeof opts === 'object' && !Array.isArray(opts) ? opts : {};
  const response = o.response && typeof o.response === 'object' ? o.response : null;
  const expectedRequestId = typeof o.expectedRequestId === 'string' ? o.expectedRequestId.trim() : '';
  const expectedHostPubkey = typeof o.expectedHostPubkey === 'string' ? o.expectedHostPubkey.trim() : '';
  const expectedTravellerPubkey = typeof o.expectedTravellerPubkey === 'string' ? o.expectedTravellerPubkey.trim() : '';
  const requireSpawn = o.requireSpawn !== false; // default true

  if (!response) return { ok: false, trusted: false, trust: 'unverified', errors: ['response model is required'] };
  if (!expectedRequestId) return { ok: false, trusted: false, trust: 'unverified', errors: ['expectedRequestId is required'] };
  if (!_isHex64(expectedHostPubkey)) return { ok: false, trusted: false, trust: 'unverified', errors: ['expectedHostPubkey must be hex64'] };
  if (!_isHex64(expectedTravellerPubkey)) return { ok: false, trusted: false, trust: 'unverified', errors: ['expectedTravellerPubkey must be hex64'] };

  const errors = [];

  // 1. accept state
  if (response.accepted !== true) errors.push('response is not an accept (denied)');

  // 2. references OUR request
  if (response.referencesRequestId !== expectedRequestId) {
    errors.push('response does not reference our request id');
  }

  // 3. signed by the host we addressed the request to
  if (response.hostPubkey !== expectedHostPubkey) {
    errors.push('response signer is not the host we requested travel to');
  }

  // 4. addressed to US (the traveller)
  if (response.travellerPubkey !== expectedTravellerPubkey) {
    errors.push('response is not addressed to our traveller pubkey');
  }

  // 5. spawn URL (https only). SEC-3 will add deeper host/scheme hardening.
  if (requireSpawn) {
    const safeSpawn = _safeHttps(response.spawn);
    if (!safeSpawn) errors.push('accept has no valid https spawn URL');
  }

  // 6. real BIP-340 schnorr verification (S1). The host signs the accept as a
  // nostr event; we recompute the NIP-01 id from response.signed and verify
  // response.sig under the host pubkey. A valid signature authenticates every
  // structural field above (they are all derived from this signed event). Fail
  // closed if the signature is absent, malformed, or does not verify.
  if (typeof response.sig !== 'string' || !response.signed || typeof response.signed !== 'object') {
    errors.push('response is not crypto-signed');
  } else if (response.signed.pubkey !== expectedHostPubkey) {
    // The signed envelope's author must be the host we expect — otherwise a valid
    // sig from some OTHER key would pass the schnorr check.
    errors.push('signed event author is not the expected host');
  } else if (!verifyNostrEventSig({
    pubkey: response.signed.pubkey,
    created_at: response.signed.created_at,
    kind: response.signed.kind,
    tags: response.signed.tags,
    content: response.signed.content,
    id: response.id,
    sig: response.sig,
  })) {
    errors.push('schnorr signature verification failed');
  }

  if (errors.length) return { ok: true, trusted: false, trust: 'unverified', errors };
  return { ok: true, trusted: true, trust: 'crypto-verified', errors: [] };
}

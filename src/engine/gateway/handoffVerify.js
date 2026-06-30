// engine/gateway/handoffVerify.js — SEC-2 handoff verification gate (P1, v0.2.252;
// crypto-verified path added v0.2.262).
// The gate a traveller clears BEFORE trusting a host's signed accept and acting
// on the hop. Given a sanitised accept RESPONSE (from travelRequest.
// extractTravelResponse) and what the traveller EXPECTS (the request id they
// sent, the host pubkey they addressed it to, their own traveller pubkey), it
// verifies the response is a genuine, correctly-attributed accept for THIS hop.
//
// PURE + node-safe: NO DOM, NO socket, NO signing, NO navigation. It consumes a
// sanitised model + expectation and returns a verdict.
//
// Two trust tiers:
//   'host-matched'    — structural pass (legacy P1 floor). Identity/spawn/
//                       reference checks all aligned, but no signature was
//                       verified.
//   'crypto-verified' — structural pass AND a BIP-340 schnorr verify over the
//                       NIP-01 event-id hash under the host's claimed x-only
//                       pubkey succeeded. This is the new SEC-2 floor for the
//                       live n2n hop; pass `{ rawEvent, cryptoVerify: true }`
//                       (or inject `verifySignature`) to take this path.
//   'unverified'      — anything that did not clear the structural floor, or
//                       crypto was requested but failed.
//
// Crypto verification re-computes the event id from the raw event's own
// canonical fields (NIP-01 sha256 over [0, pubkey, created_at, kind, tags,
// content]) BEFORE checking the schnorr signature. A relay or man-in-the-
// middle that re-points an existing valid (id, sig) pair at a mutated content/
// tags payload cannot keep the id consistent — the recompute step is the
// single most important defence against a spoofed `trusted` verdict.
//
// Checks (ALL must pass for trusted:true on the structural floor):
//   1. response.accepted === true            (a deny never arms a hop)
//   2. response.referencesRequestId === expectedRequestId  (it answers OUR ask)
//   3. response.hostPubkey === expectedHostPubkey         (signed by the host we chose)
//   4. response.travellerPubkey === expectedTravellerPubkey (addressed to US)
//   5. response.spawn is a valid https URL    (SEC-3 will deepen the URL check;
//      until then, a non-https/absent spawn on an accept fails closed)
//
// Additional crypto floor (only when crypto verification is requested):
//   6. rawEvent must be a NIP-01 event object whose pubkey equals
//      expectedHostPubkey AND whose id matches the recomputed sha256 AND
//      whose schnorr signature verifies under that pubkey.

import { verifyEventSignature as _defaultVerifyEventSignature } from '../crypto/nostrSig.js';

const HEX64 = /^[0-9a-f]{64}$/;
function _isHex64(v) { return typeof v === 'string' && HEX64.test(v); }

function _safeHttps(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  return u.protocol === 'https:' ? u.href : null;
}

// verifyHandoff({ response, expectedRequestId, expectedHostPubkey,
//   expectedTravellerPubkey, requireSpawn, rawEvent, cryptoVerify,
//   verifySignature }) → { ok, trusted, trust, errors }. Pure; never throws.
//
//   ok      — the inputs were well-formed enough to evaluate (false = malformed)
//   trusted — the accept passes every SEC-2 check requested (the hop may arm)
//   trust   — 'crypto-verified' (structural + BIP-340 schnorr ok) |
//             'host-matched' (structural pass only) |
//             'unverified' (not trusted)
//   errors  — human-readable reasons (empty when trusted)
//
// Opt-in crypto: if `cryptoVerify` is true OR `rawEvent` is provided, the gate
// runs BIP-340 verification over the raw event in addition to the structural
// checks. Crypto requested but rawEvent missing → ok:false. Crypto run but the
// signature fails → trusted:false (fails closed). `verifySignature` may be
// injected for tests; default is the production schnorr verifier.
export function verifyHandoff(opts = {}) {
  const o = opts && typeof opts === 'object' && !Array.isArray(opts) ? opts : {};
  const response = o.response && typeof o.response === 'object' ? o.response : null;
  const expectedRequestId = typeof o.expectedRequestId === 'string' ? o.expectedRequestId.trim() : '';
  const expectedHostPubkey = typeof o.expectedHostPubkey === 'string' ? o.expectedHostPubkey.trim() : '';
  const expectedTravellerPubkey = typeof o.expectedTravellerPubkey === 'string' ? o.expectedTravellerPubkey.trim() : '';
  const requireSpawn = o.requireSpawn !== false; // default true
  const rawEvent = o.rawEvent && typeof o.rawEvent === 'object' && !Array.isArray(o.rawEvent) ? o.rawEvent : null;
  const cryptoRequested = o.cryptoVerify === true || rawEvent !== null;
  const verifySig = typeof o.verifySignature === 'function' ? o.verifySignature : _defaultVerifyEventSignature;

  if (!response) return { ok: false, trusted: false, trust: 'unverified', errors: ['response model is required'] };
  if (!expectedRequestId) return { ok: false, trusted: false, trust: 'unverified', errors: ['expectedRequestId is required'] };
  if (!_isHex64(expectedHostPubkey)) return { ok: false, trusted: false, trust: 'unverified', errors: ['expectedHostPubkey must be hex64'] };
  if (!_isHex64(expectedTravellerPubkey)) return { ok: false, trusted: false, trust: 'unverified', errors: ['expectedTravellerPubkey must be hex64'] };
  if (o.cryptoVerify === true && !rawEvent) {
    return { ok: false, trusted: false, trust: 'unverified', errors: ['cryptoVerify requested but rawEvent is missing'] };
  }

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

  // 6. CRYPTO floor — only when requested. The raw event MUST be the same
  // event whose sanitised model produced `response`: its pubkey must equal the
  // expected host pubkey (mirrors check 3 over the raw event), its id must
  // recompute from its own canonical fields, and its sig must schnorr-verify
  // under that pubkey. Any divergence fails closed and never elevates trust.
  if (cryptoRequested) {
    if (!rawEvent) {
      // Already caught by the precondition above; defensive double-check so a
      // future caller that bypasses the precondition still fails closed.
      errors.push('cryptoVerify requested but rawEvent is missing');
    } else {
      // Raw-event pubkey must match what we expected (and what the sanitised
      // model already reported). A relay swapping the sanitised vs raw pubkey
      // cannot beat this check.
      if (rawEvent.pubkey !== expectedHostPubkey) {
        errors.push('raw event pubkey does not match expected host pubkey');
      }
      // And the raw event id must equal the sanitised response.eventId — a
      // relay can't hand us a different signed event under the same sanitised
      // shell.
      if (typeof response.eventId === 'string' && response.eventId && response.eventId !== rawEvent.id) {
        errors.push('raw event id does not match sanitised response eventId');
      }
      const v = verifySig(rawEvent);
      if (!v || v.valid !== true) {
        const reason = v && Array.isArray(v.errors) && v.errors.length ? v.errors.join('; ') : 'schnorr verify failed';
        errors.push('BIP-340 verification failed: ' + reason);
      }
    }
  }

  if (errors.length) return { ok: true, trusted: false, trust: 'unverified', errors };
  return { ok: true, trusted: true, trust: cryptoRequested ? 'crypto-verified' : 'host-matched', errors: [] };
}

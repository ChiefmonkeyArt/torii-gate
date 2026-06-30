// engine/leaderboard/publishGate.js — SEC-1 leaderboard publish gate (v0.2.256;
// crypto-verified path added v0.2.262).
// THE gate that must clear BEFORE a signed score event is published to a relay.
// Given a SIGNED event (kind 30000, from leaderboardPublisher) + what we expect
// (the signer pubkey the player logged in with) + a consent decision, it verifies
// the event is a genuine, correctly-attributed, non-abusive score for THIS player.
//
// PURE + node-safe: NO DOM, NO socket, NO signing, NO relay I/O, NO key handling.
// It consumes a signed event + expectation and returns a verdict.
//
// Two trust tiers:
//   'structure-verified' — structural pass (legacy floor). Event shape, signer
//                          identity, abuse caps, consent, tags, score validity
//                          all aligned, but no signature was verified.
//   'crypto-verified'    — structural pass AND a BIP-340 schnorr verify over the
//                          NIP-01 event-id hash under the claimed pubkey
//                          succeeded. Pass `cryptoVerify: true` (or inject
//                          `verifySignature`) to take this path; production
//                          relay writes MUST.
//   'unverified'         — anything that did not clear the structural floor, or
//                          crypto was requested but failed.
//
// Crypto verification re-computes the event id from the event's own canonical
// NIP-01 fields BEFORE checking the schnorr signature. A hostile relay that
// reuses a valid (id, sig) pair under mutated content/tags/score will fail the
// id-recompute step — the single most important defence against a relay-spoofed
// `trusted` verdict.
//
// Checks (ALL must pass for trusted:true on the structural floor):
//   1. event is a well-formed object (kind, pubkey, id, sig, created_at, tags, content)
//   2. kind === LEADERBOARD_KIND (30000)
//   3. pubkey is hex64 AND === expectedSignerPubkey (signed by the logged-in player)
//   4. id is a present hex64 string (tamper anchor)
//   5. sig is a present hex128 string (64 raw bytes — a real BIP-340 signature)
//   6. created_at is a sane unix-seconds timestamp (not future-skewed, not ancient)
//   7. tags include ['t','torii-quest'] (the discovery topic)
//   8. content is valid JSON and validateScore passes (runId, sane counters, etc.)
//   9. abuse ceilings: score/kills/runId-length within finite caps (reject absurd)
//  10. consent === true (the player explicitly consented to this submission)
//
// Additional crypto floor (only when crypto verification is requested):
//  11. event.id must recompute from its own canonical fields AND event.sig must
//      schnorr-verify under event.pubkey (BIP-340 over the 32-byte id hash).

import { LEADERBOARD_KIND, validateScore } from '../nostr/leaderboard.js';
import { verifyEventSignature as _defaultVerifyEventSignature } from '../crypto/nostrSig.js';

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
function _isHex64(v) { return typeof v === 'string' && HEX64.test(v); }
function _isHex128(v) { return typeof v === 'string' && HEX128.test(v); }

// Abuse ceilings — generous but finite. A legitimate run cannot reach these by
// construction of the game loop; they exist so a hostile/buggy client can never
// push an absurd score to a relay. Overridable via opts for tests.
const DEFAULT_MAX_SCORE = 1_000_000;
const DEFAULT_MAX_KILLS = 10_000;
const DEFAULT_MAX_RUNID_LEN = 128;

// created_at bounds (unix seconds). Reject far-future (clock skew > 5 min) and
// anything before 2024-01-01 (the project predates nothing legitimate before then).
const MAX_FUTURE_SKEW_S = 300;
const MIN_CREATED_AT = Date.UTC(2024, 0, 1) / 1000;

// verifyPublishGate(event, { expectedSignerPubkey, consent, maxScore, maxKills,
//   maxRunIdLen, cryptoVerify, verifySignature }) → { ok, trusted, trust, errors }.
// Pure; never throws.
//
//   ok      — the inputs were well-formed enough to evaluate (false = malformed)
//   trusted — the event passes every SEC-1 check requested (publish may proceed)
//   trust   — 'crypto-verified' (structural + BIP-340 schnorr ok) |
//             'structure-verified' (structural pass only) |
//             'unverified' (not trusted)
//   errors  — human-readable reasons (empty when trusted)
//
// Opt-in crypto: `cryptoVerify: true` runs BIP-340 verification over the event
// in addition to the structural checks. Crypto requested but the signature
// fails → trusted:false (fails closed). `verifySignature` may be injected for
// tests; default is the production schnorr verifier.
export function verifyPublishGate(event, opts = {}) {
  const o = opts && typeof opts === 'object' && !Array.isArray(opts) ? opts : {};
  const expectedSignerPubkey = typeof o.expectedSignerPubkey === 'string' ? o.expectedSignerPubkey.trim() : '';
  const consent = o.consent === true;
  const maxScore = Number.isFinite(o.maxScore) ? o.maxScore : DEFAULT_MAX_SCORE;
  const maxKills = Number.isFinite(o.maxKills) ? o.maxKills : DEFAULT_MAX_KILLS;
  const maxRunIdLen = Number.isFinite(o.maxRunIdLen) ? o.maxRunIdLen : DEFAULT_MAX_RUNID_LEN;
  const cryptoRequested = o.cryptoVerify === true;
  const verifySig = typeof o.verifySignature === 'function' ? o.verifySignature : _defaultVerifyEventSignature;

  // Required-to-evaluate inputs (mirror SEC-2: missing → ok:false, not a verdict).
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return { ok: false, trusted: false, trust: 'unverified', errors: ['signed event is required'] };
  }
  if (!_isHex64(expectedSignerPubkey)) {
    return { ok: false, trusted: false, trust: 'unverified', errors: ['expectedSignerPubkey must be hex64'] };
  }

  const errors = [];

  // 1 + 2. kind
  if (!Number.isInteger(event.kind) || event.kind !== LEADERBOARD_KIND) {
    errors.push('kind must be ' + LEADERBOARD_KIND + ' (leaderboard)');
  }

  // 3. pubkey shape + signer match (anti-impersonation: must be the logged-in player)
  if (!_isHex64(event.pubkey)) {
    errors.push('event pubkey must be hex64');
  } else if (event.pubkey !== expectedSignerPubkey) {
    errors.push('event signer does not match expected signer pubkey');
  }

  // 4. id present + hex64 (tamper anchor; the crypto floor below recomputes
  // this id from the event's own canonical fields).
  if (!_isHex64(event.id)) errors.push('event id must be a hex64 string');

  // 5. sig present + hex128 (a 64-byte BIP-340 signature, not a bare template).
  // v0.2.262: tightened from hex64 (32 bytes) to hex128 (64 bytes) so a hostile
  // relay can't sneak a half-length placeholder past the structural floor.
  if (!_isHex128(event.sig)) errors.push('event sig must be a hex128 string (64 bytes)');

  // 6. created_at sane
  if (!Number.isFinite(event.created_at) || event.created_at <= 0) {
    errors.push('created_at must be a positive number');
  } else {
    const nowS = Date.now() / 1000;
    if (event.created_at > nowS + MAX_FUTURE_SKEW_S) errors.push('created_at is in the future');
    if (event.created_at < MIN_CREATED_AT) errors.push('created_at is too far in the past');
  }

  // 7. tags + topic tag
  if (!Array.isArray(event.tags)) {
    errors.push('tags must be an array');
  } else if (!event.tags.some((t) => Array.isArray(t) && t[0] === 't' && t[1] === 'torii-quest')) {
    errors.push('missing torii-quest topic tag');
  }

  // 8 + 9. content is valid JSON score + validity + abuse ceilings
  let score = null;
  if (typeof event.content !== 'string') {
    errors.push('content must be a JSON string');
  } else {
    try {
      score = JSON.parse(event.content);
    } catch {
      errors.push('content is not valid JSON');
    }
  }
  if (score !== null) {
    const v = validateScore(score);
    if (!v.valid) errors.push('invalid score: ' + v.errors.join('; '));
    // abuse ceilings (only flag when the value is present + integer + over cap)
    if (Number.isInteger(score.score) && score.score > maxScore) errors.push('score exceeds ceiling');
    if (Number.isInteger(score.kills) && score.kills > maxKills) errors.push('kills exceeds ceiling');
    if (typeof score.runId === 'string' && score.runId.length > maxRunIdLen) errors.push('runId exceeds length ceiling');
  }

  // 10. consent
  if (!consent) errors.push('consent not granted for this submission');

  // 11. CRYPTO floor — only when requested AND the structural floor is clean.
  // Re-computes the event id from the event's own canonical NIP-01 fields and
  // verifies the BIP-340 signature under the claimed pubkey. A relay handing us
  // a forged or tampered event (right shape, valid-looking hex, but wrong id-
  // hash or invalid sig) fails closed and never elevates trust. Skipped when
  // shape errors already exist — verifyEventSignature would only restate them.
  let cryptoVerified = false;
  if (cryptoRequested && errors.length === 0) {
    const v = verifySig(event);
    if (!v || v.valid !== true) {
      const reason = v && Array.isArray(v.errors) && v.errors.length ? v.errors.join('; ') : 'schnorr verify failed';
      errors.push('BIP-340 verification failed: ' + reason);
    } else {
      cryptoVerified = true;
    }
  }

  if (errors.length) return { ok: true, trusted: false, trust: 'unverified', errors };
  return { ok: true, trusted: true, trust: cryptoVerified ? 'crypto-verified' : 'structure-verified', errors: [] };
}

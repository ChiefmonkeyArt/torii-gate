// engine/leaderboard/publishGate.js — SEC-1 leaderboard publish gate (v0.2.256;
// real BIP-340 crypto landed v0.2.277).
// THE gate that must clear BEFORE a signed score event is published to a relay.
// Given a SIGNED event (kind 30000, from leaderboardPublisher) + what we expect
// (the signer pubkey the player logged in with) + a consent decision, it verifies
// the event is a genuine, correctly-attributed, non-abusive score for THIS player.
//
// PURE + node-safe: NO DOM, NO socket, NO signing, NO relay I/O, NO key handling.
// It consumes a signed event + expectation and returns a verdict. The cheap
// STRUCTURAL checks (signer-identity match + event shape + score validity + abuse
// caps + consent + topic tag) run FIRST as a fast pre-flight with good error
// messages, THEN the real BIP-340 schnorr signature is verified (v0.2.277, reusing
// the S1 verifier in ../crypto/nostrSig.js): the event id is recomputed from the
// NIP-01 canonical fields and `event.sig` must schnorr-verify under `event.pubkey`
// over that id. A signed-but-mismatched, tampered, wrong-key, or unsigned event
// fails closed — publish MUST NOT run. The `trust` field reports 'crypto-verified'
// ONLY on a full pass; 'unverified' otherwise. There is no longer a structural-only
// trusted path — a publish arms ONLY on a real signature (mirrors SEC-2 handoffVerify).
//
// Checks (ALL must pass for trusted:true):
//   1. event is a well-formed object (kind, pubkey, id, sig, created_at, tags, content)
//   2. kind === LEADERBOARD_KIND (30000)
//   3. pubkey is hex64 AND === expectedSignerPubkey (signed by the logged-in player)
//   4. id is a present hex64 string (the schnorr step re-derives + binds it to content)
//   5. sig is a present hex128 string (a 64-byte BIP-340 schnorr sig, not a stub)
//   6. created_at is a sane unix-seconds timestamp (not future-skewed, not ancient)
//   7. tags include ['t','torii-quest'] (the discovery topic)
//   8. content is valid JSON and validateScore passes (runId, sane counters, etc.)
//   9. abuse ceilings: score/kills/runId-length within finite caps (reject absurd)
//  10. consent === true (the player explicitly consented to this submission)
//  11. BIP-340 schnorr verify: nostrEventId(event) === event.id AND schnorr.verify(
//      sig, id, pubkey) — authenticates every field above as the player's own.

import { LEADERBOARD_KIND, validateScore } from '../nostr/leaderboard.js';
import { verifyNostrEventSig } from '../crypto/nostrSig.js';

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
//   maxRunIdLen }) → { ok, trusted, trust, errors }. Pure; never throws.
//
//   ok      — the inputs were well-formed enough to evaluate (false = malformed)
//   trusted — every check passes AND the schnorr sig verifies (publish may proceed)
//   trust   — 'crypto-verified' (full pass) | 'unverified' (not trusted)
//   errors  — human-readable reasons (empty when trusted)
export function verifyPublishGate(event, opts = {}) {
  const o = opts && typeof opts === 'object' && !Array.isArray(opts) ? opts : {};
  const expectedSignerPubkey = typeof o.expectedSignerPubkey === 'string' ? o.expectedSignerPubkey.trim() : '';
  const consent = o.consent === true;
  const maxScore = Number.isFinite(o.maxScore) ? o.maxScore : DEFAULT_MAX_SCORE;
  const maxKills = Number.isFinite(o.maxKills) ? o.maxKills : DEFAULT_MAX_KILLS;
  const maxRunIdLen = Number.isFinite(o.maxRunIdLen) ? o.maxRunIdLen : DEFAULT_MAX_RUNID_LEN;

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

  // 4. id present + hex64 (the schnorr step re-derives it from content + binds it)
  if (!_isHex64(event.id)) errors.push('event id must be a hex64 string');

  // 5. sig present + hex128 (a real 64-byte BIP-340 schnorr signature, not a stub)
  if (!_isHex128(event.sig)) errors.push('event sig must be a hex128 schnorr signature');

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

  // 11. real BIP-340 schnorr verification (v0.2.277). Only attempt once the id/sig/
  // pubkey are shaped (the structural errors above already report missing fields —
  // re-deriving on garbage just yields a redundant message). verifyNostrEventSig
  // recomputes the NIP-01 id from {pubkey, created_at, kind, tags, content}, confirms
  // it equals event.id (so the sig is bound to THIS content — a tampered body fails),
  // then schnorr-verifies sig over the id under pubkey. Fail closed otherwise.
  if (_isHex64(event.pubkey) && _isHex64(event.id) && _isHex128(event.sig)) {
    if (!verifyNostrEventSig(event)) errors.push('schnorr signature verification failed');
  }

  if (errors.length) return { ok: true, trusted: false, trust: 'unverified', errors };
  return { ok: true, trusted: true, trust: 'crypto-verified', errors: [] };
}

// engine/crypto/nostrSig.js — NIP-01 event-id hashing + BIP-340 schnorr signature
// verification for Nostr events (SEC-CRYPTO, v0.2.262).
//
// THE shared crypto floor under SEC-1 (publishGate) and SEC-2 (handoffVerify).
// Before this module both gates were STRUCTURAL: they matched fields like
// pubkey/id/sig as opaque hex64 strings but never asked "does this signature
// actually verify against the recomputed event id under the claimed pubkey?"
// A hostile relay could therefore spoof a `trusted` verdict with a well-formed-
// looking but cryptographically invalid event. This module closes that gap.
//
// PURE + node-safe + DOM-free: only consumes a normalised event object and
// returns a verdict. No network, no signing, no key generation. Imports
// @noble/curves (BIP-340 schnorr) + @noble/hashes (sha256) — the project's
// first runtime crypto dependencies (audited, sub-imported for tree-shaking).
//
// NIP-01 event id is sha256 of the canonical JSON serialisation:
//   id = sha256(JSON.stringify([0, pubkey, created_at, kind, tags, content]))
// where pubkey is lowercase 32-byte hex and tags is the exact array we signed
// (in NIP-01 order, with values verbatim). BIP-340 then signs the 32-byte id
// hash with the 32-byte x-only pubkey, producing a 64-byte signature.
//
// Two public helpers:
//   computeEventId(event)        → { ok, id?, errors? }
//   verifyEventSignature(event)  → { ok, valid, errors }
//
// Both NEVER throw. Both are sync (noble v2 schnorr.verify is sync). Both
// fail closed on any input/shape error or library exception.

import { schnorr } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;

function _isHex64(v) { return typeof v === 'string' && HEX64.test(v); }
function _isHex128(v) { return typeof v === 'string' && HEX128.test(v); }

// Convert lowercase hex string → Uint8Array. Returns null on any non-hex input.
// Length is verified separately by the regex helpers above.
function _hexToBytes(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const a = hex.charCodeAt(i * 2);
    const b = hex.charCodeAt(i * 2 + 1);
    const av = a >= 48 && a <= 57 ? a - 48 : a >= 97 && a <= 102 ? a - 87 : -1;
    const bv = b >= 48 && b <= 57 ? b - 48 : b >= 97 && b <= 102 ? b - 87 : -1;
    if (av < 0 || bv < 0) return null;
    out[i] = (av << 4) | bv;
  }
  return out;
}

function _bytesToHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    const v = bytes[i];
    s += (v < 16 ? '0' : '') + v.toString(16);
  }
  return s;
}

// Canonical NIP-01 serialisation for the event-id pre-image. Mirrors the
// reference implementation in nostr-tools / nips/01 examples: a JSON array of
// [0, pubkey, created_at, kind, tags, content] with NO whitespace. Returns the
// UTF-8 encoded bytes ready for sha256, or null on shape error.
function _serializeForId(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  if (!_isHex64(event.pubkey)) return null;
  if (!Number.isInteger(event.created_at) || event.created_at <= 0) return null;
  if (!Number.isInteger(event.kind) || event.kind < 0) return null;
  if (!Array.isArray(event.tags)) return null;
  if (typeof event.content !== 'string') return null;
  // tags must be array-of-arrays-of-strings; reject anything else so a hostile
  // relay can't slip a non-canonical structure through JSON.stringify.
  for (const t of event.tags) {
    if (!Array.isArray(t)) return null;
    for (const v of t) {
      if (typeof v !== 'string') return null;
    }
  }
  let json;
  try {
    json = JSON.stringify([
      0, event.pubkey, event.created_at, event.kind, event.tags, event.content,
    ]);
  } catch { return null; }
  return new TextEncoder().encode(json);
}

// computeEventId(event) → { ok, id?, errors? }. Computes the NIP-01 sha256
// event id from the event's canonical serialisation. NEVER throws.
//   ok      — the inputs were well-formed enough to hash (false = malformed)
//   id      — lowercase 64-char hex string (only present when ok:true)
//   errors  — human-readable reasons (empty when ok:true)
export function computeEventId(event) {
  const bytes = _serializeForId(event);
  if (!bytes) {
    return { ok: false, errors: ['event shape is not canonical (pubkey/created_at/kind/tags/content)'] };
  }
  try {
    const hash = sha256(bytes);
    return { ok: true, id: _bytesToHex(hash), errors: [] };
  } catch (e) {
    return { ok: false, errors: ['sha256 failed: ' + (e?.message || String(e))] };
  }
}

// verifyEventSignature(event) → { ok, valid, errors }. Re-computes the NIP-01
// event id from the event's own fields, asserts the supplied `event.id` equals
// it (tamper anchor — a relay cannot swap content under a fixed id), then runs
// BIP-340 schnorr verify over (sig, id, pubkey). NEVER throws.
//
//   ok      — inputs were well-formed enough to evaluate
//   valid   — true ONLY when id matches AND schnorr verify returns true
//   errors  — human-readable reasons (empty when valid)
//
// Fails closed on ANY error path: missing fields, malformed hex, id mismatch,
// noble-curves throwing on bad-length inputs, or schnorr.verify returning false.
export function verifyEventSignature(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return { ok: false, valid: false, errors: ['event must be an object'] };
  }
  if (!_isHex64(event.pubkey)) return { ok: false, valid: false, errors: ['pubkey must be hex64'] };
  if (!_isHex64(event.id)) return { ok: false, valid: false, errors: ['id must be hex64'] };
  if (!_isHex128(event.sig)) return { ok: false, valid: false, errors: ['sig must be hex128 (64 bytes)'] };

  // 1. recompute the canonical NIP-01 id from the event's own fields.
  const recomputed = computeEventId(event);
  if (!recomputed.ok) {
    return { ok: false, valid: false, errors: recomputed.errors };
  }
  if (recomputed.id !== event.id) {
    // A relay (or any intermediary) cannot keep a stolen id+sig pair valid
    // while mutating any signed field. The id-mismatch path is the single
    // most important defence against a spoofed `trusted` verdict.
    return { ok: true, valid: false, errors: ['event id does not match recomputed id (tags/content/created_at tampered)'] };
  }

  // 2. BIP-340 schnorr verify over the 32-byte id hash + 32-byte x-only pubkey.
  const sigBytes = _hexToBytes(event.sig);
  const idBytes = _hexToBytes(event.id);
  const pkBytes = _hexToBytes(event.pubkey);
  if (!sigBytes || !idBytes || !pkBytes) {
    return { ok: false, valid: false, errors: ['hex decode failed for sig/id/pubkey'] };
  }
  let verified = false;
  try {
    verified = schnorr.verify(sigBytes, idBytes, pkBytes) === true;
  } catch (e) {
    // noble throws on malformed point / out-of-range scalar. Treat as invalid.
    return { ok: true, valid: false, errors: ['schnorr verify threw: ' + (e?.message || String(e))] };
  }
  if (!verified) return { ok: true, valid: false, errors: ['schnorr signature does not verify under claimed pubkey'] };
  return { ok: true, valid: true, errors: [] };
}

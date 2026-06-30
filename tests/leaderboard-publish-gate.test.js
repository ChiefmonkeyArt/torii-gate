// tests/leaderboard-publish-gate.test.js — SEC-1 leaderboard publish gate (v0.2.256).
// Asserts the gate that must clear before a signed score event is published to a
// relay. A failure NEVER yields trusted:true; the publisher treats !trusted as
// "do not publish". Mirrors the url-harden / handoff-verify gate test pattern.
import { describe, it, expect, vi } from 'vitest';
import { schnorr } from '@noble/curves/secp256k1.js';
import { verifyPublishGate } from '../src/engine/leaderboard/publishGate.js';
import { computeEventId } from '../src/engine/crypto/nostrSig.js';
import { LEADERBOARD_KIND } from '../src/engine/nostr/leaderboard.js';
import { createLeaderboardPublisher } from '../src/engine/nostr/leaderboardPublisher.js';

const PK = 'a'.repeat(64); // valid hex64 signer pubkey
const ID = 'b'.repeat(64);
const SIG = 'c'.repeat(128); // hex128: 64 raw bytes (real BIP-340 signature length)
const NOW = Math.floor(Date.now() / 1000);
const SCORE = { runId: 'run-1', score: 10, kills: 5, headshots: 2, accuracy: 0.5, version: 'v0.2.256-alpha' };

function _bytesToHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}
function _hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// Build a real, fully-signed kind-30000 event for crypto-path tests. Returns
// { event, sk, pk } so a test can re-sign tampered variants if needed.
function realSignedEvent(scoreOverride = null) {
  const sk = schnorr.utils.randomSecretKey();
  const pk = _bytesToHex(schnorr.getPublicKey(sk));
  const score = scoreOverride || SCORE;
  const tags = [
    ['d', score.runId],
    ['score', String(score.score)],
    ['kills', String(score.kills)],
    ['headshots', String(score.headshots)],
    ['accuracy', score.accuracy.toFixed(4)],
    ['version', score.version],
    ['t', 'torii-quest'],
  ];
  const event = {
    kind: LEADERBOARD_KIND,
    pubkey: pk,
    created_at: NOW,
    tags,
    content: JSON.stringify(score),
  };
  const idR = computeEventId(event);
  event.id = idR.id;
  const sigBytes = schnorr.sign(_hexToBytes(event.id), sk);
  event.sig = _bytesToHex(sigBytes);
  return { event, sk, pk };
}

// A fully-valid signed kind-30000 event addressed to PK.
function signedEvent(overrides = {}) {
  return {
    kind: LEADERBOARD_KIND,
    pubkey: PK,
    id: ID,
    sig: SIG,
    created_at: NOW,
    tags: [
      ['d', SCORE.runId],
      ['score', String(SCORE.score)],
      ['kills', String(SCORE.kills)],
      ['headshots', String(SCORE.headshots)],
      ['accuracy', SCORE.accuracy.toFixed(4)],
      ['version', SCORE.version],
      ['t', 'torii-quest'],
    ],
    content: JSON.stringify(SCORE),
    ...overrides,
  };
}

describe('SEC-1 publishGate — accept path', () => {
  it('trusts a well-formed signed event signed by the expected player with consent', () => {
    const v = verifyPublishGate(signedEvent(), { expectedSignerPubkey: PK, consent: true });
    expect(v.ok).toBe(true);
    expect(v.trusted).toBe(true);
    expect(v.trust).toBe('structure-verified');
    expect(v.errors).toEqual([]);
  });

  it('trusts when score is exactly at the abuse ceiling (boundary)', () => {
    const ev = signedEvent({ content: JSON.stringify({ ...SCORE, score: 1_000_000, kills: 10_000 }) });
    const v = verifyPublishGate(ev, { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(true);
  });
});

describe('SEC-1 publishGate — malformed inputs (ok:false)', () => {
  it('returns ok:false when the event is missing', () => {
    const v = verifyPublishGate(null, { expectedSignerPubkey: PK, consent: true });
    expect(v.ok).toBe(false);
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('signed event is required');
  });

  it('returns ok:false when expectedSignerPubkey is not hex64', () => {
    const v = verifyPublishGate(signedEvent(), { expectedSignerPubkey: 'not-hex', consent: true });
    expect(v.ok).toBe(false);
    expect(v.errors).toContain('expectedSignerPubkey must be hex64');
  });
});

describe('SEC-1 publishGate — reject path (event shape / identity)', () => {
  it('rejects a wrong kind', () => {
    const v = verifyPublishGate(signedEvent({ kind: 1 }), { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors.some((e) => e.startsWith('kind must be'))).toBe(true);
  });

  it('rejects an event signed by a different pubkey (anti-impersonation)', () => {
    const other = 'd'.repeat(64);
    const v = verifyPublishGate(signedEvent({ pubkey: other }), { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('event signer does not match expected signer pubkey');
  });

  it('rejects a missing id (tamper anchor absent)', () => {
    const v = verifyPublishGate(signedEvent({ id: 'short' }), { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('event id must be a hex64 string');
  });

  it('rejects a missing sig (bare unsigned template)', () => {
    const v = verifyPublishGate(signedEvent({ sig: '' }), { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('event sig must be a hex128 string (64 bytes)');
  });

  it('rejects a hex64-length sig (half-length placeholder no longer accepted)', () => {
    // v0.2.262: tightened sig from hex64 (32 bytes) to hex128 (64 bytes). A
    // relay can no longer slip a half-length signature through the structural
    // floor and have it look real.
    const v = verifyPublishGate(signedEvent({ sig: 'c'.repeat(64) }), { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('event sig must be a hex128 string (64 bytes)');
  });
});

describe('SEC-1 publishGate — reject path (created_at / tags / content)', () => {
  it('rejects a future-skewed created_at', () => {
    const future = Math.floor(Date.now() / 1000) + 600;
    const v = verifyPublishGate(signedEvent({ created_at: future }), { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('created_at is in the future');
  });

  it('rejects an ancient created_at', () => {
    const v = verifyPublishGate(signedEvent({ created_at: 1_000_000 }), { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('created_at is too far in the past');
  });

  it('rejects a missing torii-quest topic tag', () => {
    const ev = signedEvent({ tags: [['d', SCORE.runId]] });
    const v = verifyPublishGate(ev, { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('missing torii-quest topic tag');
  });

  it('rejects non-JSON content', () => {
    const v = verifyPublishGate(signedEvent({ content: 'not-json' }), { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('content is not valid JSON');
  });

  it('rejects an invalid score (headshots exceed kills)', () => {
    const bad = { ...SCORE, kills: 1, headshots: 5 };
    const v = verifyPublishGate(signedEvent({ content: JSON.stringify(bad) }), { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors.some((e) => e.startsWith('invalid score'))).toBe(true);
  });
});

describe('SEC-1 publishGate — reject path (abuse ceilings + consent)', () => {
  it('rejects a score above the ceiling', () => {
    const ev = signedEvent({ content: JSON.stringify({ ...SCORE, score: 1_000_001 }) });
    const v = verifyPublishGate(ev, { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('score exceeds ceiling');
  });

  it('rejects kills above the ceiling', () => {
    const ev = signedEvent({ content: JSON.stringify({ ...SCORE, kills: 10_001 }) });
    const v = verifyPublishGate(ev, { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('kills exceeds ceiling');
  });

  it('rejects an oversized runId', () => {
    const ev = signedEvent({ content: JSON.stringify({ ...SCORE, runId: 'x'.repeat(129) }) });
    const v = verifyPublishGate(ev, { expectedSignerPubkey: PK, consent: true });
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('runId exceeds length ceiling');
  });

  it('rejects when consent is not granted', () => {
    const v = verifyPublishGate(signedEvent(), { expectedSignerPubkey: PK, consent: false });
    expect(v.trusted).toBe(false);
    expect(v.errors).toContain('consent not granted for this submission');
  });
});

describe('SEC-1 publishGate — publisher integration (gate blocks relay write)', () => {
  it('blocks publish() when the gate fails (consent missing) and never calls publish', async () => {
    const publish = vi.fn(async () => 'OK');
    const sign = vi.fn(async (t) => ({
      ...t,
      pubkey: PK,
      id: ID,
      sig: SIG,
      created_at: NOW,
    }));
    const pub = createLeaderboardPublisher({ sign, publish, gate: verifyPublishGate });
    // ctx with NO consent → gate fails closed
    const res = await pub.publishScore(SCORE, { signerPubkey: PK, consent: false });
    expect(res.signed).toBe(true);
    expect(res.published).toBe(false);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.startsWith('SEC-1 gate blocked publish'))).toBe(true);
    expect(publish).not.toHaveBeenCalled();
  });

  it('allows publish() when the gate passes', async () => {
    const publish = vi.fn(async () => 'OK');
    const sign = vi.fn(async (t) => ({
      ...t,
      pubkey: PK,
      id: ID,
      sig: SIG,
      created_at: NOW,
    }));
    const pub = createLeaderboardPublisher({ sign, publish, gate: verifyPublishGate });
    const res = await pub.publishScore(SCORE, { signerPubkey: PK, consent: true });
    expect(res.published).toBe(true);
    expect(publish).toHaveBeenCalledOnce();
  });

  it('without a gate, behaviour is unchanged (backward compatible)', async () => {
    const publish = vi.fn(async () => 'OK');
    const sign = vi.fn(async (t) => ({ ...t, sig: SIG }));
    const pub = createLeaderboardPublisher({ sign, publish }); // no gate
    const res = await pub.publishScore(SCORE); // no ctx
    expect(res.published).toBe(true);
    expect(publish).toHaveBeenCalledOnce();
  });
});

// v0.2.262 SEC-1 hardening: when cryptoVerify is requested the gate must do a
// real BIP-340 schnorr verify over the recomputed NIP-01 event id. Anything a
// hostile relay could try (forged sig, tampered content/tags, wrong pubkey,
// stale id) must fail closed and never elevate trust above 'unverified'.
describe('SEC-1 publishGate — crypto-verified path (BIP-340)', () => {
  it('elevates trust to crypto-verified when sig + id verify under the signer pubkey', () => {
    const { event, pk } = realSignedEvent();
    const v = verifyPublishGate(event, { expectedSignerPubkey: pk, consent: true, cryptoVerify: true });
    expect(v.ok).toBe(true);
    expect(v.trusted).toBe(true);
    expect(v.trust).toBe('crypto-verified');
    expect(v.errors).toEqual([]);
  });

  it('fails closed when the schnorr signature is forged (random 128 hex)', () => {
    const { event, pk } = realSignedEvent();
    // Replace the real sig with a structurally-valid but cryptographically
    // bogus 128-hex string. Structural floor passes; crypto floor fails.
    const forged = { ...event, sig: 'd'.repeat(128) };
    const v = verifyPublishGate(forged, { expectedSignerPubkey: pk, consent: true, cryptoVerify: true });
    expect(v.trusted).toBe(false);
    expect(v.trust).toBe('unverified');
    expect(v.errors.some((e) => e.startsWith('BIP-340 verification failed'))).toBe(true);
  });

  it('fails closed when content was tampered after signing (relay-spoof)', () => {
    const { event, pk } = realSignedEvent();
    // A hostile relay re-points a valid (id, sig) pair at a higher-score content.
    // The id no longer recomputes from the canonical fields → crypto floor fails.
    const tampered = {
      ...event,
      content: JSON.stringify({ ...SCORE, score: 999_999 }),
    };
    const v = verifyPublishGate(tampered, { expectedSignerPubkey: pk, consent: true, cryptoVerify: true });
    expect(v.trusted).toBe(false);
    expect(v.trust).toBe('unverified');
    expect(v.errors.some((e) => e.startsWith('BIP-340 verification failed'))).toBe(true);
  });

  it('fails closed when tags were tampered after signing (id no longer matches)', () => {
    const { event, pk } = realSignedEvent();
    const tampered = {
      ...event,
      tags: [...event.tags, ['extra', 'injected']],
    };
    const v = verifyPublishGate(tampered, { expectedSignerPubkey: pk, consent: true, cryptoVerify: true });
    expect(v.trusted).toBe(false);
    expect(v.errors.some((e) => e.startsWith('BIP-340 verification failed'))).toBe(true);
  });

  it('fails closed when event.id is overwritten with a wrong (but valid hex64) value', () => {
    const { event, pk } = realSignedEvent();
    const tampered = { ...event, id: 'f'.repeat(64) };
    const v = verifyPublishGate(tampered, { expectedSignerPubkey: pk, consent: true, cryptoVerify: true });
    expect(v.trusted).toBe(false);
    expect(v.errors.some((e) => e.startsWith('BIP-340 verification failed'))).toBe(true);
  });

  it('fails closed when verifySignature is injected and reports invalid', () => {
    const { event, pk } = realSignedEvent();
    const fakeVerify = vi.fn(() => ({ ok: true, valid: false, errors: ['injected-fail'] }));
    const v = verifyPublishGate(event, {
      expectedSignerPubkey: pk, consent: true, cryptoVerify: true, verifySignature: fakeVerify,
    });
    expect(fakeVerify).toHaveBeenCalledOnce();
    expect(v.trusted).toBe(false);
    expect(v.errors.some((e) => e.startsWith('BIP-340 verification failed'))).toBe(true);
  });

  it('skips crypto verification when cryptoVerify is not requested (legacy callers)', () => {
    const { event, pk } = realSignedEvent();
    // No cryptoVerify flag → legacy structural-only floor + a real-shape sig.
    const v = verifyPublishGate(event, { expectedSignerPubkey: pk, consent: true });
    expect(v.trusted).toBe(true);
    expect(v.trust).toBe('structure-verified');
  });

  it('does not run crypto when structural errors already exist (no double-reporting)', () => {
    const { event, pk } = realSignedEvent();
    const verifySignature = vi.fn(() => ({ ok: true, valid: true, errors: [] }));
    // Break the kind so a structural error fires first.
    const v = verifyPublishGate({ ...event, kind: 1 }, {
      expectedSignerPubkey: pk, consent: true, cryptoVerify: true, verifySignature,
    });
    expect(v.trusted).toBe(false);
    // Crypto verifier MUST NOT be invoked once the structural floor is dirty.
    expect(verifySignature).not.toHaveBeenCalled();
  });
});

// tests/handoff-arrival.test.js — locks the P2 cross-host arrival/seating gate (v0.2.274).
// Proves readArrivingTraveller parses the spawn-URL npub, verifyArrival seats ONLY a
// real BIP-340-signed request authored by the arriving npub and addressed to this host,
// and seatArrivalDecision fails CLOSED to anon on every mismatch (no sig, tampered body,
// wrong host, wrong traveller, impostor URL).
import { describe, it, expect } from 'vitest';
import {
  readArrivingTraveller, verifyArrival, seatArrivalDecision, TRAVELLER_PARAM,
} from '../src/engine/gateway/handoffArrival.js';
import { buildTravelRequest, extractTravelRequest } from '../src/engine/gateway/travelRequest.js';
import { nostrEventId } from '../src/engine/crypto/nostrSig.js';
import { schnorr } from '@noble/curves/secp256k1.js';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';

const TRAV_SK = hexToBytes('22'.repeat(32));
const HOST_SK = hexToBytes('11'.repeat(32));
const EVIL_SK = hexToBytes('33'.repeat(32));
const TRAV = bytesToHex(schnorr.getPublicKey(TRAV_SK));
const HOST = bytesToHex(schnorr.getPublicKey(HOST_SK));
const EVIL = bytesToHex(schnorr.getPublicKey(EVIL_SK));

// realSign — compute the NIP-01 id and BIP-340 schnorr-sign it (what NIP-07 does).
function realSign(unsigned, sk) {
  const pubkey = bytesToHex(schnorr.getPublicKey(sk));
  const evt = { ...unsigned, pubkey };
  const id = nostrEventId(evt);
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), sk));
  return { ...evt, id, sig };
}

// A real traveller-signed request from TRAV, addressed to HOST, → sanitised model.
function signedRequest({ travellerSk = TRAV_SK, toHost = HOST } = {}) {
  const built = buildTravelRequest({
    travellerPubkey: bytesToHex(schnorr.getPublicKey(travellerSk)),
    toHostPubkey: toHost, toZone: 'foreign-arena', fromZone: 'quest-torii', requestId: 'req-1',
  });
  return extractTravelRequest(realSign(built.event, travellerSk)).request;
}

describe('readArrivingTraveller', () => {
  it('reads a valid hex64 traveller pubkey from the spawn URL', () => {
    const url = `https://host-b.example.com/?${TRAVELLER_PARAM}=${TRAV}`;
    const r = readArrivingTraveller(url);
    expect(r.ok).toBe(true);
    expect(r.pubkey).toBe(TRAV);
  });
  it('returns ok:false (no throw) for missing / non-hex / bad inputs', () => {
    expect(readArrivingTraveller('https://host-b.example.com/').ok).toBe(false);
    expect(readArrivingTraveller(`https://h/?${TRAVELLER_PARAM}=not-a-key`).ok).toBe(false);
    expect(readArrivingTraveller('not a url').ok).toBe(false);
    expect(readArrivingTraveller('').ok).toBe(false);
    expect(readArrivingTraveller(null).ok).toBe(false);
  });
});

describe('verifyArrival — seats only a crypto-verified request', () => {
  it('seats the arriving npub when the signed request verifies + is addressed to us', () => {
    const v = verifyArrival({ arrivingPubkey: TRAV, request: signedRequest(), expectedHostPubkey: HOST });
    expect(v.ok).toBe(true);
    expect(v.seated).toBe(true);
    expect(v.trust).toBe('crypto-verified');
    expect(v.npub).toBe(TRAV);
    expect(v.errors).toHaveLength(0);
  });

  it('fails CLOSED when the request carries no signature', () => {
    const built = buildTravelRequest({ travellerPubkey: TRAV, toHostPubkey: HOST, toZone: 'z', requestId: 'r' });
    const unsigned = extractTravelRequest({ ...built.event, id: 'a'.repeat(64) }).request; // no sig
    const v = verifyArrival({ arrivingPubkey: TRAV, request: unsigned, expectedHostPubkey: HOST });
    expect(v.seated).toBe(false);
    expect(v.trust).toBe('unverified');
    expect(v.npub).toBe(null);
  });

  it('fails CLOSED on a tampered body (id no longer binds content)', () => {
    const req = signedRequest();
    const tampered = { ...req, signed: { ...req.signed, content: JSON.stringify({ to: 'evil-zone' }) } };
    const v = verifyArrival({ arrivingPubkey: TRAV, request: tampered, expectedHostPubkey: HOST });
    expect(v.seated).toBe(false);
    expect(v.errors).toContain('schnorr signature verification failed');
  });

  it('fails CLOSED when the request was addressed to a DIFFERENT host', () => {
    const req = signedRequest({ toHost: EVIL }); // signed, but addressed to EVIL, not us
    const v = verifyArrival({ arrivingPubkey: TRAV, request: req, expectedHostPubkey: HOST });
    expect(v.seated).toBe(false);
    expect(v.errors).toContain('request was not addressed to this host');
  });

  it('fails CLOSED when the URL npub does not match the request signer (impersonation)', () => {
    // A real signed request from TRAV, but the arriving URL claims to be EVIL.
    const v = verifyArrival({ arrivingPubkey: EVIL, request: signedRequest(), expectedHostPubkey: HOST });
    expect(v.seated).toBe(false);
  });

  it('rejects malformed inputs with ok:false', () => {
    expect(verifyArrival({ arrivingPubkey: 'nope', request: signedRequest(), expectedHostPubkey: HOST }).ok).toBe(false);
    expect(verifyArrival({ arrivingPubkey: TRAV, request: null, expectedHostPubkey: HOST }).ok).toBe(false);
    expect(verifyArrival({ arrivingPubkey: TRAV, request: signedRequest(), expectedHostPubkey: 'nope' }).ok).toBe(false);
  });
});

describe('seatArrivalDecision', () => {
  it('seats AS the npub on a crypto-verified verdict', () => {
    const d = seatArrivalDecision({ seated: true, npub: TRAV, trust: 'crypto-verified' });
    expect(d).toEqual({ identity: TRAV, anon: false });
  });
  it('fails closed to anon on any unverified verdict', () => {
    expect(seatArrivalDecision({ seated: false, npub: null })).toEqual({ identity: null, anon: true });
    expect(seatArrivalDecision({ seated: true, npub: 'not-hex' })).toEqual({ identity: null, anon: true });
    expect(seatArrivalDecision(null)).toEqual({ identity: null, anon: true });
  });
});

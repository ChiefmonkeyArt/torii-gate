// tests/travel-intent.test.js — locks the pure URL-handoff / travel-intent
// helpers (GWPROTO-1, src/engine/gateway/travelIntent.js). These encode the
// Torii Gateway Protocol MVP (GATEWAY_PROTOCOL.md §3–§4): build / validate /
// serialise / parse a travel intent with NO side effects. Pure module →
// node-testable, no DOM / navigation / relay / signing.
import { describe, it, expect } from 'vitest';
import {
  TRAVEL_FIELDS, looksLikeNpub,
  buildTravelIntent, validateTravelIntent,
  buildTravelUrl, parseTravelUrl,
} from '../src/engine/gateway/travelIntent.js';
import * as SDK from '../src/sdk/index.js';

const NPUB = 'npub1destination00000000000000000000000000000000000000';

describe('looksLikeNpub', () => {
  it('accepts npub1-prefixed identities and rejects everything else', () => {
    expect(looksLikeNpub(NPUB)).toBe(true);
    expect(looksLikeNpub('npub1short')).toBe(false);
    expect(looksLikeNpub('hex0000')).toBe(false);
    expect(looksLikeNpub(null)).toBe(false);
    expect(looksLikeNpub(42)).toBe(false);
  });
});

describe('buildTravelIntent — normalisation', () => {
  it('keeps only known fields, trims strings, drops blanks', () => {
    const intent = buildTravelIntent({
      to: '  npubA ', from: 'napA', spawn: '', bogus: 'x', zoneType: 'shop',
    });
    expect(intent).toEqual({ to: 'npubA', from: 'napA', zoneType: 'shop' });
    expect(intent).not.toHaveProperty('bogus');
    expect(intent).not.toHaveProperty('spawn');
  });

  it('coerces relays to a clean string array and drops blanks', () => {
    expect(buildTravelIntent({ to: 'x', relays: 'wss://a' }).relays).toEqual(['wss://a']);
    expect(buildTravelIntent({ to: 'x', relays: ['wss://a', '', ' wss://b '] }).relays)
      .toEqual(['wss://a', 'wss://b']);
    expect(buildTravelIntent({ to: 'x', relays: [] })).not.toHaveProperty('relays');
  });

  it('TRAVEL_FIELDS is the documented protocol field set', () => {
    expect(TRAVEL_FIELDS).toEqual([
      'to', 'from', 'return', 'spawn', 'zoneType', 'relays', 'player', 'state',
    ]);
  });
});

describe('validateTravelIntent', () => {
  it('requires a destination (to)', () => {
    const r = validateTravelIntent({ from: 'napA' });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/to/);
  });

  it('accepts a minimal valid intent (only to)', () => {
    expect(validateTravelIntent({ to: 'npubA' }).valid).toBe(true);
  });

  it('shape-checks the player npub when present', () => {
    expect(validateTravelIntent({ to: 'x', player: NPUB }).valid).toBe(true);
    const bad = validateTravelIntent({ to: 'x', player: 'not-an-npub' });
    expect(bad.valid).toBe(false);
    expect(bad.errors.join(' ')).toMatch(/player/);
  });

  it('rejects a malformed relays field', () => {
    expect(validateTravelIntent({ to: 'x', relays: 'wss://a' }).valid).toBe(false);
    expect(validateTravelIntent({ to: 'x', relays: [] }).valid).toBe(false);
    expect(validateTravelIntent({ to: 'x', relays: ['wss://a'] }).valid).toBe(true);
  });

  it('never throws on junk input', () => {
    expect(validateTravelIntent(null).valid).toBe(false);
    expect(validateTravelIntent(42).valid).toBe(false);
  });
});

describe('buildTravelUrl', () => {
  it('returns a bare query string with no base', () => {
    const url = buildTravelUrl({ to: 'npubA', from: 'napA' });
    expect(url.startsWith('?')).toBe(true);
    expect(url).toMatch(/to=npubA/);
    expect(url).toMatch(/from=napA/);
  });

  it('appends the query onto a base path', () => {
    expect(buildTravelUrl({ to: 'npubA' }, { base: '/travel' })).toBe('/travel?to=npubA');
    expect(buildTravelUrl({}, { base: '/travel' })).toBe('/travel');
  });

  it('comma-joins relays into one param', () => {
    const url = buildTravelUrl({ to: 'x', relays: ['wss://a', 'wss://b'] });
    expect(url).toMatch(/relays=wss%3A%2F%2Fa%2Cwss%3A%2F%2Fb/);
  });
});

describe('parseTravelUrl', () => {
  it('parses a bare query, a ?query, and a path?query equivalently', () => {
    const expected = { to: 'npubA', from: 'napA' };
    expect(parseTravelUrl('to=npubA&from=napA').intent).toEqual(expected);
    expect(parseTravelUrl('?to=npubA&from=napA').intent).toEqual(expected);
    expect(parseTravelUrl('/travel?to=npubA&from=napA').intent).toEqual(expected);
  });

  it('splits relays back into an array', () => {
    const { intent } = parseTravelUrl('to=x&relays=wss://a,wss://b');
    expect(intent.relays).toEqual(['wss://a', 'wss://b']);
  });

  it('reports invalid when the destination is missing', () => {
    const r = parseTravelUrl('from=napA');
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/to/);
  });

  it('never throws on non-string input', () => {
    expect(parseTravelUrl(null).valid).toBe(false);
    expect(parseTravelUrl(undefined).valid).toBe(false);
  });
});

describe('round-trip — parse(build(intent)) is equivalent', () => {
  it('preserves all fields through a build → parse cycle', () => {
    const intent = buildTravelIntent({
      to: 'npubDest', from: 'napHome', return: 'napHome', spawn: 'frontdoor',
      zoneType: 'shop', relays: ['wss://a', 'wss://b'], player: NPUB, state: 'sha256:abc',
    });
    const round = parseTravelUrl(buildTravelUrl(intent)).intent;
    expect(round).toEqual(intent);
  });
});

describe('travelIntent — SDK exposure', () => {
  it('is re-exported from the SDK at the experimental tier', () => {
    expect(typeof SDK.travelIntent.buildTravelUrl).toBe('function');
    expect(typeof SDK.travelIntent.parseTravelUrl).toBe('function');
    expect(SDK.SDK_SURFACE.travelIntent.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
    expect(SDK.surfacesByTier(SDK.STABILITY.EXPERIMENTAL)).toContain('travelIntent');
  });
});

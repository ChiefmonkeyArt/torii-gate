// tests/profile-read.test.js — locks the READ-ONLY Nostr identity/profile proof
// (src/engine/nostr/profileRead.js, NOSTR-READ / IDENTITY, v0.2.161). Proves the
// kind:0 READ path: build the profile filter, parse + sanitise metadata into a
// display-only identity view-model, select the newest profile per author, and
// return a read-only report — no signing, no publishing, no network, no DOM.
// Pure module → node-testable.
import { describe, it, expect } from 'vitest';
import {
  PROFILE_KIND, PROFILE_FIELDS,
  buildProfileFilter, safeProfileUrl, shortPubkey, parseProfileMetadata,
  extractProfileFromEvent, selectNewestProfiles, readProfiles,
} from '../src/engine/nostr/profileRead.js';
import * as SDK from '../src/sdk/index.js';

const HEX_A = 'a'.repeat(64);
const HEX_B = 'b'.repeat(64);
const HEX_SIG = 'c'.repeat(64) + 'd'.repeat(64); // 128-hex

// A structurally-valid kind:0 profile event.
function profileEvent(over = {}) {
  // When `over.meta` is given it REPLACES the default metadata wholesale (so
  // fallback tests can exercise a name-only / no-name profile); otherwise the
  // full default profile is used.
  const meta = over.meta || {
    name: 'satoshi',
    display_name: 'Satoshi N',
    about: 'building freedom tech',
    picture: 'https://example.com/pic.png',
    banner: 'https://example.com/banner.png',
    nip05: 'satoshi@example.com',
    lud16: 'satoshi@walletofsatoshi.com',
    website: 'https://example.com',
  };
  return {
    id: over.id || HEX_A,
    pubkey: over.pubkey || HEX_B,
    created_at: over.created_at != null ? over.created_at : 1000,
    kind: over.kind != null ? over.kind : PROFILE_KIND,
    tags: over.tags || [],
    content: over.content != null ? over.content : JSON.stringify(meta),
    sig: over.sig || HEX_SIG,
  };
}

describe('buildProfileFilter', () => {
  it('selects kind:0 profile events', () => {
    const f = buildProfileFilter();
    expect(f.kinds).toEqual([PROFILE_KIND]);
    expect(f).not.toHaveProperty('authors');
  });

  it('includes well-formed authors/since/until/limit and drops malformed options', () => {
    const f = buildProfileFilter({ authors: [HEX_B, '', 7], since: 100, until: 200, limit: 1 });
    expect(f.authors).toEqual([HEX_B]);
    expect(f.since).toBe(100);
    expect(f.until).toBe(200);
    expect(f.limit).toBe(1);

    const g = buildProfileFilter({ authors: [], since: 'x', limit: -1 });
    expect(g).not.toHaveProperty('authors');
    expect(g).not.toHaveProperty('since');
    expect(g).not.toHaveProperty('limit');
  });
});

describe('safeProfileUrl', () => {
  it('accepts https URLs and rejects other schemes / overlong / garbage', () => {
    expect(safeProfileUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(safeProfileUrl('http://example.com/a.png')).toBeNull();
    expect(safeProfileUrl('javascript:alert(1)')).toBeNull();
    expect(safeProfileUrl('data:image/png;base64,xxx')).toBeNull();
    expect(safeProfileUrl('/relative.png')).toBeNull();
    expect(safeProfileUrl(null)).toBeNull();
    expect(safeProfileUrl('https://e.com/' + 'x'.repeat(2048))).toBeNull();
  });
});

describe('parseProfileMetadata', () => {
  it('parses a JSON object and degrades malformed/non-object to {}', () => {
    expect(parseProfileMetadata('{"name":"x"}')).toEqual({ name: 'x' });
    expect(parseProfileMetadata('not json{')).toEqual({});
    expect(parseProfileMetadata('[1,2]')).toEqual({});
    expect(parseProfileMetadata('')).toEqual({});
    expect(parseProfileMetadata(null)).toEqual({});
  });
});

describe('shortPubkey', () => {
  it('truncates a long hex key and leaves short ones alone', () => {
    expect(shortPubkey(HEX_B)).toBe(`${'b'.repeat(8)}…bbbb`);
    expect(shortPubkey('abc')).toBe('abc');
    expect(shortPubkey('')).toBe('');
    expect(shortPubkey(null)).toBe('');
  });
});

describe('extractProfileFromEvent', () => {
  it('builds a sanitised identity view-model from kind:0 metadata', () => {
    const r = extractProfileFromEvent(profileEvent());
    expect(r.ok).toBe(true);
    expect(r.profile.name).toBe('satoshi');
    expect(r.profile.displayName).toBe('Satoshi N');
    expect(r.profile.picture).toBe('https://example.com/pic.png');
    expect(r.profile.website).toBe('https://example.com/');
    expect(r.profile.pubkey).toBe(HEX_B);
    expect(PROFILE_FIELDS.every((f) => f in r.profile)).toBe(true);
  });

  it('drops unsafe URLs to null and keeps the rest', () => {
    const r = extractProfileFromEvent(profileEvent({ meta: { name: 'x', picture: 'javascript:bad', banner: 'http://no.tls/b.png', website: 'https://ok.example/' } }));
    expect(r.ok).toBe(true);
    expect(r.profile.picture).toBeNull();
    expect(r.profile.banner).toBeNull();
    expect(r.profile.website).toBe('https://ok.example/');
  });

  it('falls back displayName: display_name → name → short pubkey', () => {
    expect(extractProfileFromEvent(profileEvent({ meta: { name: 'justname' } })).profile.displayName).toBe('justname');
    const noNames = extractProfileFromEvent(profileEvent({ meta: { about: 'anon' } }));
    expect(noNames.profile.displayName).toBe(shortPubkey(HEX_B));
  });

  it('degrades malformed JSON content to an empty-but-valid profile', () => {
    const r = extractProfileFromEvent(profileEvent({ content: 'not json{' }));
    expect(r.ok).toBe(true);
    expect(r.profile.name).toBeNull();
    expect(r.profile.displayName).toBe(shortPubkey(HEX_B)); // falls back to short pubkey
  });

  it('rejects non-kind:0 events, bad pubkeys, and non-objects without throwing', () => {
    expect(extractProfileFromEvent(profileEvent({ kind: 1 })).ok).toBe(false);
    expect(extractProfileFromEvent(profileEvent({ pubkey: 'short' })).ok).toBe(false);
    expect(extractProfileFromEvent(null).ok).toBe(false);
  });
});

describe('selectNewestProfiles — replaceable semantics', () => {
  it('keeps the newest profile per pubkey and counts dropped duplicates', () => {
    const older = { pubkey: HEX_B, name: 'old', created_at: 1000 };
    const newer = { pubkey: HEX_B, name: 'new', created_at: 2000 };
    const other = { pubkey: HEX_A, name: 'a', created_at: 1500 };
    const { profiles, dropped } = selectNewestProfiles([older, newer, other]);
    expect(dropped).toBe(1);
    expect(profiles).toHaveLength(2);
    expect(profiles.find((p) => p.pubkey === HEX_B).name).toBe('new');
  });
});

describe('readProfiles — read-only report', () => {
  it('parses valid events and exposes the profile filter', () => {
    const r = readProfiles([profileEvent()]);
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
    expect(r.profiles[0].displayName).toBe('Satoshi N');
    expect(r.filter.kinds).toEqual([PROFILE_KIND]);
    expect(r.signed).toBe(false);
    expect(r.published).toBe(false);
    expect(r.readOnly).toBe(true);
  });

  it('accepts a relayRead { events } result and selects newest per author', () => {
    const result = {
      events: [
        profileEvent({ id: HEX_A, pubkey: HEX_B, created_at: 1000, content: JSON.stringify({ name: 'old' }) }),
        profileEvent({ id: HEX_B, pubkey: HEX_B, created_at: 2000, content: JSON.stringify({ name: 'new' }) }),
      ],
    };
    const r = readProfiles(result);
    expect(r.count).toBe(1);
    expect(r.duplicates).toBe(1);
    expect(r.profiles[0].name).toBe('new');
  });

  it('skips malformed/non-kind:0 events without throwing', () => {
    const events = [
      profileEvent(),
      { id: 'bad' },                                   // fails relay validation
      'not-an-object',                                 // not an event
      profileEvent({ id: 'e'.repeat(64), kind: 1 }),   // wrong kind
    ];
    const r = readProfiles(events);
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
    expect(r.skipped.length).toBe(3);
  });

  it('degrades safely on an unusable input shape — never throws', () => {
    expect(readProfiles(42).ok).toBe(false);
    expect(readProfiles(null).ok).toBe(false);
    expect(readProfiles({ nope: true }).ok).toBe(false);
    const r = readProfiles([]);
    expect(r.ok).toBe(true);
    expect(r.count).toBe(0);
  });

  it('exposes no publish/sign/send/connect surface on the report', () => {
    const r = readProfiles([profileEvent()]);
    for (const key of ['publish', 'sign', 'send', 'connect', 'close', 'write']) {
      expect(r).not.toHaveProperty(key);
    }
  });
});

describe('SDK exposure', () => {
  it('exposes profileRead at the experimental SDK tier', () => {
    expect(SDK.SDK_SURFACE.profileRead.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
    expect(typeof SDK.profileRead.readProfiles).toBe('function');
    expect(typeof SDK.profileRead.buildProfileFilter).toBe('function');
    expect(SDK.profileRead.PROFILE_KIND).toBe(0);
  });
});

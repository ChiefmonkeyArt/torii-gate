// engine/nostr/profileRead.js — READ-ONLY Nostr identity/profile proof (NOSTR-READ
// / IDENTITY, v0.2.161). Proves the READ path for kind:0 profile metadata on top of
// the v0.2.159 relayRead boundary: given relay events a host's read-only transport
// WOULD return, it builds the profile filter, parses + sanitises the JSON metadata
// into a display-only identity view-model, selects the newest profile per author,
// and returns a read-only report.
//
// Pure + node-safe: NO Nostr client, NO WebSocket, NO relay I/O, NO signing, NO
// publishing, NO key handling, NO NIP-07, NO DOM, NO network, NO auto-connect. This
// module NEVER opens a socket and exposes NO publish/sign/send/connect surface — it
// only consumes events handed to it (a v0.2.159 relayRead `read()` result, a bare
// event array, or deterministic local sample data) and shapes them into a sanitised
// identity view-model. Any avatar/banner/website URL is validated to https-only and
// kept as an INERT data string — there is NO DOM/<img src> assignment here. Every
// helper degrades safely on malformed input and never throws on event data.

import { normalizeRelayEvent, validateRelayEvent } from './relayRead.js';

// NIP-01 kind for replaceable user-metadata (profile) events.
export const PROFILE_KIND = 0;

// The kind:0 metadata fields this module surfaces into the identity view-model.
export const PROFILE_FIELDS = Object.freeze([
  'name', 'displayName', 'about', 'picture', 'banner', 'nip05', 'lud16', 'website',
]);

const HEX64 = /^[0-9a-f]{64}$/;
function _isHex64(v) { return typeof v === 'string' && HEX64.test(v); }
function _isInt(v) { return Number.isInteger(v); }
function _isNonNegInt(v) { return _isInt(v) && v >= 0; }

// buildProfileFilter({ authors, since, until, limit }) → a NIP-01 filter that
// selects kind:0 profile events. Pure: optional `authors` (hex pubkeys),
// `since`/`until` (unix seconds) and `limit` (transport hint) are only included
// when well-formed, so a bad option is dropped rather than producing a malformed
// filter. Never throws.
export function buildProfileFilter({ authors = null, since = null, until = null, limit = null } = {}) {
  const filter = { kinds: [PROFILE_KIND] };
  if (Array.isArray(authors)) {
    const clean = authors.filter((a) => typeof a === 'string' && a !== '');
    if (clean.length > 0) filter.authors = clean;
  }
  if (_isInt(since)) filter.since = since;
  if (_isInt(until)) filter.until = until;
  if (_isNonNegInt(limit)) filter.limit = limit;
  return filter;
}

// safeProfileUrl(raw) → an https-only absolute URL string, or null. Pure, never
// throws. A kind:0 `picture`/`banner`/`website` is attacker-controlled (anyone can
// sign a profile with any string), so only a well-formed https URL is accepted —
// a hostile value can never smuggle in javascript:/data:/relative schemes. The
// result is an INERT data string; this module never assigns it to a DOM <img src>.
export function safeProfileUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  let u;
  try { u = new URL(raw); } catch { return null; } // absolute URLs only
  return u.protocol === 'https:' ? u.href : null;
}

// shortPubkey(pubkey, head, tail) → a display-only truncation of a long hex pubkey
// so the identity stays readable on a small card. Pure; '' on non-strings; returns
// the key unchanged when already short.
export function shortPubkey(pubkey, head = 8, tail = 4) {
  if (typeof pubkey !== 'string' || pubkey === '') return '';
  if (pubkey.length <= head + tail + 1) return pubkey;
  return `${pubkey.slice(0, head)}…${pubkey.slice(-tail)}`;
}

// parseProfileMetadata(content) → the parsed kind:0 metadata object, or {} on any
// non-string / malformed JSON / non-object payload. Pure, never throws — a bad
// profile content degrades to an empty metadata object rather than failing.
export function parseProfileMetadata(content) {
  if (typeof content !== 'string' || content === '') return {};
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // malformed JSON → empty metadata
  }
  return {};
}

// _str(v) → a trimmed string for a metadata field, or null when absent/blank/non-string.
function _str(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

// extractProfileFromEvent(event) → { ok, profile?|errors? }. Pure, never throws.
// Takes a NORMALISED kind:0 event and builds a sanitised, display-only identity
// view-model. Rejects non-kind:0 events and events without a valid hex pubkey. The
// NIP-01 metadata both `name`/`display_name` (and the `displayName` alias) is read;
// URLs are sanitised to https-only (unsafe → null). A `displayName` fallback chain
// (display_name → name → shortened pubkey) gives callers one always-present label.
export function extractProfileFromEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return { ok: false, errors: ['event must be an object'] };
  }
  if (event.kind !== PROFILE_KIND) {
    return { ok: false, errors: [`event kind must be ${PROFILE_KIND}`] };
  }
  if (!_isHex64(event.pubkey)) {
    return { ok: false, errors: ['pubkey must be 64-char lowercase hex'] };
  }

  const meta = parseProfileMetadata(event.content);
  const name = _str(meta.name);
  const displayNameRaw = _str(meta.display_name) || _str(meta.displayName);
  const short = shortPubkey(event.pubkey);

  const profile = {
    pubkey: event.pubkey,
    shortPubkey: short,
    name,
    displayName: displayNameRaw || name || short,
    about: _str(meta.about),
    picture: safeProfileUrl(meta.picture),
    banner: safeProfileUrl(meta.banner),
    nip05: _str(meta.nip05),
    lud16: _str(meta.lud16),
    website: safeProfileUrl(meta.website),
    created_at: _isInt(event.created_at) ? event.created_at : null,
  };
  return { ok: true, profile };
}

// selectNewestProfiles(profiles) → { profiles, dropped }. Pure, never throws.
// kind:0 is a replaceable event, so a player has at most one current profile: keep
// the newest (highest created_at; ties keep the first seen) per pubkey and report
// how many superseded duplicates were dropped.
export function selectNewestProfiles(profiles = []) {
  const list = Array.isArray(profiles) ? profiles : [];
  const byKey = new Map();
  let dropped = 0;
  for (const p of list) {
    const key = p.pubkey || '';
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, p); continue; }
    dropped += 1;
    const prevAt = _isInt(prev.created_at) ? prev.created_at : -1;
    const curAt = _isInt(p.created_at) ? p.created_at : -1;
    if (curAt > prevAt) byKey.set(key, p);
  }
  return { profiles: [...byKey.values()], dropped };
}

// _toEventArray(input) → an array of raw events from any accepted shape, or null.
// Accepts a relayRead read() result ({ events }), a bare array, or null/garbage.
function _toEventArray(input) {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object' && Array.isArray(input.events)) return input.events;
  return null;
}

// readProfiles(input, options) → a read-only identity/profile report:
//
//   {
//     ok:         boolean,            // false only on an unusable input shape
//     filter:     { kinds:[0], … },   // the profile filter these events answer
//     count:      number,             // newest profiles returned
//     profiles:   [view-model],       // sanitised, newest-per-author identity cards
//     skipped:    [{ event, errors }],// events that failed normalise/validate/extract
//     duplicates: number,            // superseded replaceable profiles dropped
//     signed:     false,             // ALWAYS — this module never signs
//     published:  false,             // ALWAYS — this module never publishes
//     readOnly:   true,
//     errors:     [string],          // input-shape problems (never event data)
//   }
//
// `input` is whatever an injected read-only transport produced: a v0.2.159 relayRead
// `read()` result, a bare array of relay events, or deterministic local sample data.
// Each event is normalised (relayRead.normalizeRelayEvent) → structurally validated
// (relayRead.validateRelayEvent) → profile-extracted; failures land in `skipped`.
// Survivors are reduced to the newest profile per author. NEVER signs, publishes,
// fetches, opens a socket, or throws on event data — an unusable top-level shape
// degrades to ok:false with an empty profile list.
export function readProfiles(input, options = {}) {
  const filter = buildProfileFilter(options);
  const result = {
    ok: true,
    filter,
    count: 0,
    profiles: [],
    skipped: [],
    duplicates: 0,
    signed: false,
    published: false,
    readOnly: true,
    errors: [],
  };

  const rawEvents = _toEventArray(input);
  if (rawEvents == null) {
    result.ok = false;
    result.errors.push('input must be a relayRead result, an events array, or { events }');
    return result;
  }

  const extracted = [];
  for (const item of rawEvents) {
    const event = normalizeRelayEvent(item);
    if (event == null) {
      result.skipped.push({ event: item, errors: ['not an event object'] });
      continue;
    }
    const struct = validateRelayEvent(event);
    if (!struct.valid) {
      result.skipped.push({ event, errors: struct.errors });
      continue;
    }
    const ex = extractProfileFromEvent(event);
    if (!ex.ok) {
      result.skipped.push({ event, errors: ex.errors });
      continue;
    }
    extracted.push(ex.profile);
  }

  const { profiles, dropped } = selectNewestProfiles(extracted);
  result.duplicates = dropped;
  result.profiles = profiles;
  result.count = profiles.length;
  return result;
}

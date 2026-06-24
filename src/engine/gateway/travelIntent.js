// engine/gateway/travelIntent.js — pure URL-handoff / travel-intent helpers for
// the n2n spatial hop (GWPROTO-1, v0.2.134). The MVP transport for the Torii
// Gateway Protocol (see GATEWAY_PROTOCOL.md §3–§4): build / parse / validate a
// travel intent, serialised as a safe query string.
//
// PURE + node-safe: NO DOM, NO window/location, NO browser navigation, NO relay
// I/O, NO signing. These helpers move *data* only — turning a destination block
// into a parseable intent and back. Whether/how to ACT on a parsed intent
// (actually move the player) is the host's separate, reviewable decision; this
// module never has side effects. Uses only URLSearchParams (a JS global in node
// + browsers), so it is importable in vitest's node env.
//
// Forward-compat: the fields here are exactly the protocol's travel intent, so
// upgrading the unsigned URL MVP to a signed Nostr event later is additive — the
// same intent gains a signature and moves from query string to event body.

// The travel-intent fields (GATEWAY_PROTOCOL.md §4). `to` is the only required
// field; everything else degrades gracefully so a bare hop still works.
export const TRAVEL_FIELDS = Object.freeze([
  'to', 'from', 'return', 'spawn', 'zoneType', 'relays', 'player', 'state',
]);

// Fields that carry a Nostr identity and so get an npub shape-check.
const NPUB_FIELDS = Object.freeze(['player']);

function _isBlank(v) { return v == null || v === ''; }

// Loose npub shape check — bech32-ish `npub1…`, not a full checksum verify
// (that is host/crypto-layer work). Rejects obviously-malformed identities at
// the boundary without pulling a bech32 dependency into this pure leaf.
export function looksLikeNpub(v) {
  return typeof v === 'string' && /^npub1[0-9a-z]{20,}$/.test(v);
}

// buildTravelIntent(config) → a normalised intent object carrying only known
// fields. Pure: trims/normalises, drops unknown keys, coerces `relays` to a
// clean string array. Does NOT validate (call validateTravelIntent for that) so
// callers can build-then-inspect.
export function buildTravelIntent(config = {}) {
  const intent = {};
  for (const f of TRAVEL_FIELDS) {
    const v = config[f];
    if (_isBlank(v)) continue;
    if (f === 'relays') {
      const list = (Array.isArray(v) ? v : [v])
        .map((r) => (typeof r === 'string' ? r.trim() : ''))
        .filter((r) => r !== '');
      if (list.length) intent.relays = list;
    } else {
      intent[f] = typeof v === 'string' ? v.trim() : v;
    }
  }
  return intent;
}

// validateTravelIntent(intent) → { valid, errors }. Pure, never throws. Mirrors
// the protocol's required-set + shape rules: `to` is mandatory; npub-shaped
// fields, when present, must look like an npub; `relays` must be a non-empty
// array of non-blank strings.
export function validateTravelIntent(intent) {
  const errors = [];
  if (!intent || typeof intent !== 'object') {
    return { valid: false, errors: ['travel intent must be an object'] };
  }
  if (_isBlank(intent.to)) errors.push('missing required field: to (destination)');

  for (const f of NPUB_FIELDS) {
    if (!_isBlank(intent[f]) && !looksLikeNpub(intent[f])) {
      errors.push(`${f} must be an npub (npub1…)`);
    }
  }
  if (intent.relays != null) {
    if (!Array.isArray(intent.relays) || intent.relays.length === 0) {
      errors.push('relays must be a non-empty array when present');
    } else if (intent.relays.some((r) => _isBlank(r) || typeof r !== 'string')) {
      errors.push('relays must contain only non-blank strings');
    }
  }
  return { valid: errors.length === 0, errors };
}

// buildTravelUrl(intent, { base }) → a query string encoding the intent. With no
// base, returns just `?to=…&from=…`; with a base (e.g. '/travel' or a path) the
// query is appended. NO browser navigation — this returns a string, nothing more.
// `relays` is comma-joined into one param; everything else is a single param.
export function buildTravelUrl(intent = {}, { base = '' } = {}) {
  const normalised = buildTravelIntent(intent);
  const params = new URLSearchParams();
  for (const f of TRAVEL_FIELDS) {
    if (normalised[f] == null) continue;
    params.set(f, f === 'relays' ? normalised[f].join(',') : String(normalised[f]));
  }
  const qs = params.toString();
  if (!base) return qs ? `?${qs}` : '';
  return qs ? `${base}?${qs}` : base;
}

// parseTravelUrl(url) → { valid, errors, intent }. Accepts a full-ish URL, a
// path+query, or a bare query string ('?a=b' or 'a=b'). Pure: parses the query,
// rebuilds a normalised intent, and validates it. Never navigates, never throws
// on malformed input — returns structured errors instead.
export function parseTravelUrl(url) {
  if (typeof url !== 'string') {
    return { valid: false, errors: ['url must be a string'], intent: {} };
  }
  const qIndex = url.indexOf('?');
  const query = qIndex >= 0 ? url.slice(qIndex + 1) : url;
  const params = new URLSearchParams(query);

  const raw = {};
  for (const f of TRAVEL_FIELDS) {
    if (!params.has(f)) continue;
    if (f === 'relays') raw.relays = params.get(f).split(',');
    else raw[f] = params.get(f);
  }
  const intent = buildTravelIntent(raw);
  const { valid, errors } = validateTravelIntent(intent);
  return { valid, errors, intent };
}

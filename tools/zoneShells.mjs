// tools/zoneShells.mjs — PURE, node-safe planner for the static `/zone/<slug>` SHELL
// files (v0.2.241). On an exact-path static host with no SPA rewrite (torii-quest.pplx.app
// returns a JSON 404 for an unknown path), a hard-refresh / deep-link of `/zone/<slug>`
// 404s because no real file lives there. The fix is to publish a byte-identical copy of
// index.html at `dist/zone/<slug>/index.html` (directory-index convention) for each
// deployable slug, so the host serves the app shell (text/html) and the v0.2.182 parser
// then resolves the slug client-side — no backend, no rewrite engine needed.
//
// This module only PLANS the shell paths from a slug list; the fs writes live in
// tools/generate-zone-shells.mjs (the impure CLI). Kept pure + deterministic so the path
// shapes are unit-testable (tests/zone-hard-refresh.test.js) without touching disk.
//
// Constrained by construction: NO fs / network / child_process / THREE / DOM imports.
// It reaches for no global and writes nothing — it returns plain data only.

import { isValidZoneSlug, ZONE_ROUTE_PREFIX } from '../src/engine/gateway/zoneRoute.js';

// The directory-index file every shell is named, so an exact-path host serving
// `/zone/<slug>` (or `/zone/<slug>/`) returns the shell with a text/html MIME type.
export const ZONE_SHELL_INDEX = 'index.html';

// zoneShellPathFor(slug) → the dist-relative shell path `zone/<slug>/index.html` for a
// valid slug, or null. PURE — builds a string, writes nothing.
export function zoneShellPathFor(slug) {
  if (!isValidZoneSlug(slug)) return null;
  return `zone/${slug}/${ZONE_SHELL_INDEX}`;
}

// zoneShellRouteFor(slug) → the same-origin route a shell answers (`/zone/<slug>`), or
// null. PURE — mirrors zoneRouteFor so the plan can be cross-checked against the parser.
export function zoneShellRouteFor(slug) {
  if (!isValidZoneSlug(slug)) return null;
  return `${ZONE_ROUTE_PREFIX}${slug}`;
}

// planZoneShells(slugs) → { ok, shells, errors }. PURE, never throws.
//   slugs:  array of zone slugs (typically DEPLOYABLE_ZONE_SLUGS).
//   shells: [ { slug, path, route } ] for every VALID slug, de-duplicated.
//   errors: one message per invalid/duplicate slug; `ok` is true iff errors is empty.
export function planZoneShells(slugs = []) {
  const errors = [];
  const shells = [];
  const seen = new Set();
  const list = Array.isArray(slugs) ? slugs : [];
  for (const slug of list) {
    if (!isValidZoneSlug(slug)) {
      errors.push(`invalid zone slug (cannot build a shell): ${JSON.stringify(slug)}`);
      continue;
    }
    if (seen.has(slug)) {
      errors.push(`duplicate zone slug: ${slug}`);
      continue;
    }
    seen.add(slug);
    shells.push({ slug, path: zoneShellPathFor(slug), route: zoneShellRouteFor(slug) });
  }
  return { ok: errors.length === 0, shells, errors };
}

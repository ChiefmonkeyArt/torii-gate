// tools/zoneShells.mjs — PURE, node-safe planner for the static `/zone/<slug>` SHELL
// files (v0.2.242). On an exact-path static host with no SPA rewrite AND no directory-index
// resolution (torii-quest.pplx.app returns a JSON 404 for an unknown path), a hard-refresh
// / deep-link of `/zone/<slug>` 404s because no real file lives there. v0.2.241 wrote the
// shell at `dist/zone/<slug>/index.html` (directory-index convention), but the host does
// NOT map the extensionless `/zone/<slug>` URL onto that nested index.html, so the cold hit
// still 404'd. v0.2.242 instead writes a byte-identical copy of index.html to the EXACT-PATH
// file `dist/zone/<slug>` (no extension), the precise path the host's exact-path lookup
// resolves for the no-trailing-slash URL. index.html uses root-absolute asset URLs
// (`/assets/…`), so the shell loads the same bundle and the v0.2.182 parser resolves the
// slug client-side — no backend, no rewrite engine needed.
//
// NOTE: a file `dist/zone/<slug>` and a directory `dist/zone/<slug>/` cannot coexist under
// one name, so the extensionless file REPLACES the v0.2.241 directory-index shell; it does
// not sit alongside it. The exact no-trailing-slash URL is the one the smoke test requires.
//
// This module only PLANS the shell paths from a slug list; the fs writes live in
// tools/generate-zone-shells.mjs (the impure CLI). Kept pure + deterministic so the path
// shapes are unit-testable (tests/zone-hard-refresh.test.js) without touching disk.
//
// Constrained by construction: NO fs / network / child_process / THREE / DOM imports.
// It reaches for no global and writes nothing — it returns plain data only.

import { isValidZoneSlug, ZONE_ROUTE_PREFIX } from '../src/engine/gateway/zoneRoute.js';

// zoneShellPathFor(slug) → the dist-relative EXACT-PATH shell file `zone/<slug>` (no
// extension) for a valid slug, or null. PURE — builds a string, writes nothing.
export function zoneShellPathFor(slug) {
  if (!isValidZoneSlug(slug)) return null;
  return `zone/${slug}`;
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

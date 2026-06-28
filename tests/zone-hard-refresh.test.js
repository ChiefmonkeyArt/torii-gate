// tests/zone-hard-refresh.test.js — the v0.2.242 static-shell deep-link fix. On an
// exact-path static host with no SPA rewrite AND no directory-index resolution
// (torii-quest.pplx.app returns a JSON 404 for an unknown path), a hard-refresh / deep-link
// of the no-trailing-slash `/zone/<slug>` 404s unless a real file lives at that EXACT path.
// v0.2.241 wrote the shell at `dist/zone/<slug>/index.html`, but the host never mapped the
// extensionless URL onto that nested index.html, so the cold hit still 404'd. v0.2.242 writes
// the shell to the exact-path file `dist/zone/<slug>` (no extension) instead — a file and a
// directory of the same name cannot coexist, so this REPLACES the directory-index form.
// These tests pin: the slug list is valid + parseable, the pure planner emits the exact-path
// shape, and (when a build is present) every planned shell is the exact-path extensionless
// file, byte-identical to dist/index.html, with no leftover directory-index shell.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEPLOYABLE_ZONE_SLUGS, isValidZoneSlug, parseZoneRoute, ZONE_ROUTE_KIND,
} from '../src/engine/gateway/zoneRoute.js';
import { planZoneShells, zoneShellPathFor, zoneShellRouteFor } from '../tools/zoneShells.mjs';

const DIST = join(process.cwd(), 'dist');

describe('DEPLOYABLE_ZONE_SLUGS', () => {
  it('is a non-empty frozen list of valid, parseable zone slugs', () => {
    expect(Object.isFrozen(DEPLOYABLE_ZONE_SLUGS)).toBe(true);
    expect(DEPLOYABLE_ZONE_SLUGS.length).toBeGreaterThan(0);
    for (const slug of DEPLOYABLE_ZONE_SLUGS) {
      expect(isValidZoneSlug(slug)).toBe(true);
      const r = parseZoneRoute(`/zone/${slug}`);
      expect(r.kind).toBe(ZONE_ROUTE_KIND.ZONE);
      expect(r.slug).toBe(slug);
    }
  });

  it('includes the live demo bazaar slug that 404d on the published host', () => {
    expect(DEPLOYABLE_ZONE_SLUGS).toContain('plebeian-market-bazaar');
  });
});

describe('zoneShellPathFor / zoneShellRouteFor', () => {
  it('builds an exact-path (extensionless) shell path + matching route for a valid slug', () => {
    expect(zoneShellPathFor('plebeian-market-bazaar')).toBe('zone/plebeian-market-bazaar');
    expect(zoneShellRouteFor('plebeian-market-bazaar')).toBe('/zone/plebeian-market-bazaar');
  });

  it('shell path has no extension and no trailing slash (the host resolves the exact URL)', () => {
    const p = zoneShellPathFor('plebeian-market-bazaar');
    expect(p.endsWith('/index.html')).toBe(false);
    expect(p.endsWith('/')).toBe(false);
    expect(`/${p}`).toBe(zoneShellRouteFor('plebeian-market-bazaar'));
  });

  it('returns null for an invalid slug (never builds an unsafe path)', () => {
    expect(zoneShellPathFor('Bad_Slug')).toBeNull();
    expect(zoneShellPathFor('a/b')).toBeNull();
    expect(zoneShellPathFor('')).toBeNull();
    expect(zoneShellRouteFor('-bad')).toBeNull();
  });
});

describe('planZoneShells', () => {
  it('plans one exact-path shell per deployable slug', () => {
    const plan = planZoneShells(DEPLOYABLE_ZONE_SLUGS);
    expect(plan.ok).toBe(true);
    expect(plan.errors).toEqual([]);
    expect(plan.shells.length).toBe(DEPLOYABLE_ZONE_SLUGS.length);
    for (const s of plan.shells) {
      expect(s.path).toBe(`zone/${s.slug}`);
      expect(s.route).toBe(`/zone/${s.slug}`);
      expect(parseZoneRoute(s.route).kind).toBe(ZONE_ROUTE_KIND.ZONE);
    }
  });

  it('reports invalid and duplicate slugs without throwing', () => {
    const plan = planZoneShells(['plebeian-market-bazaar', 'Bad_Slug', 'plebeian-market-bazaar']);
    expect(plan.ok).toBe(false);
    expect(plan.shells.length).toBe(1);
    expect(plan.errors.some((e) => e.includes('invalid'))).toBe(true);
    expect(plan.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('is safe on bad input', () => {
    expect(planZoneShells(null).shells).toEqual([]);
    expect(planZoneShells(undefined).ok).toBe(true);
  });
});

describe('built dist/ shells (when a build is present)', () => {
  it('emits a byte-identical exact-path shell file for every deployable slug', () => {
    const indexPath = join(DIST, 'index.html');
    if (!existsSync(indexPath)) return; // no build in this run — covered by test:release
    const indexBody = readFileSync(indexPath, 'utf8');
    for (const slug of DEPLOYABLE_ZONE_SLUGS) {
      const shellPath = join(DIST, 'zone', slug);
      expect(existsSync(shellPath), `missing exact-path shell for /zone/${slug}`).toBe(true);
      expect(statSync(shellPath).isFile(), `/zone/${slug} must be a file, not a directory`).toBe(true);
      expect(readFileSync(shellPath, 'utf8')).toBe(indexBody);
    }
  });

  it('does NOT leave a directory-index shell (a file and dir of one name cannot coexist)', () => {
    const indexPath = join(DIST, 'index.html');
    if (!existsSync(indexPath)) return; // no build in this run — covered by test:release
    for (const slug of DEPLOYABLE_ZONE_SLUGS) {
      // The v0.2.241 directory-index form would require dist/zone/<slug>/ to be a directory,
      // which cannot coexist with the exact-path file dist/zone/<slug>. Assert it's absent so
      // the exact-path fix is the single served artifact.
      expect(existsSync(join(DIST, 'zone', slug, 'index.html'))).toBe(false);
    }
  });
});

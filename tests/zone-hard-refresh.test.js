// tests/zone-hard-refresh.test.js — the v0.2.241 static-shell deep-link fix. On an
// exact-path static host with no SPA rewrite (torii-quest.pplx.app returns a JSON 404
// for an unknown path), a hard-refresh / deep-link of `/zone/<slug>` 404s unless a real
// `dist/zone/<slug>/index.html` shell exists. The build copies index.html to a shell for
// each DEPLOYABLE_ZONE_SLUGS entry. These tests pin: the slug list is valid + parseable,
// the pure shell planner emits the right directory-index paths, and (when a build is
// present on disk) every planned shell exists and is byte-identical to dist/index.html.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
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
  it('builds a directory-index shell path + matching route for a valid slug', () => {
    expect(zoneShellPathFor('plebeian-market-bazaar')).toBe('zone/plebeian-market-bazaar/index.html');
    expect(zoneShellRouteFor('plebeian-market-bazaar')).toBe('/zone/plebeian-market-bazaar');
  });

  it('returns null for an invalid slug (never builds an unsafe path)', () => {
    expect(zoneShellPathFor('Bad_Slug')).toBeNull();
    expect(zoneShellPathFor('a/b')).toBeNull();
    expect(zoneShellPathFor('')).toBeNull();
    expect(zoneShellRouteFor('-bad')).toBeNull();
  });
});

describe('planZoneShells', () => {
  it('plans one directory-index shell per deployable slug', () => {
    const plan = planZoneShells(DEPLOYABLE_ZONE_SLUGS);
    expect(plan.ok).toBe(true);
    expect(plan.errors).toEqual([]);
    expect(plan.shells.length).toBe(DEPLOYABLE_ZONE_SLUGS.length);
    for (const s of plan.shells) {
      expect(s.path).toBe(`zone/${s.slug}/index.html`);
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
  it('emits a byte-identical index.html shell for every deployable slug', () => {
    const indexPath = join(DIST, 'index.html');
    if (!existsSync(indexPath)) return; // no build in this run — covered by test:release
    const indexBody = readFileSync(indexPath, 'utf8');
    for (const slug of DEPLOYABLE_ZONE_SLUGS) {
      const shellPath = join(DIST, 'zone', slug, 'index.html');
      expect(existsSync(shellPath), `missing shell for /zone/${slug}`).toBe(true);
      expect(readFileSync(shellPath, 'utf8')).toBe(indexBody);
    }
  });
});

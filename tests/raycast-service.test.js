// tests/raycast-service.test.js — locks down the injectable raycast facade
// (src/engine/physics/raycastService.js). The factory is pure: given fake impls
// it must delegate verbatim, and given missing impls it must degrade safely
// (ray/rayStatic → null, lineOfSight → true). We test the FACTORY, not the
// default singleton, so no Rapier is needed.
import { describe, it, expect } from 'vitest';
import { createRaycastService } from '../src/engine/physics/raycastService.js';

describe('createRaycastService — delegation', () => {
  it('forwards ray() args to castRay and returns its result', () => {
    let seen = null;
    const svc = createRaycastService({
      castRay: (...args) => { seen = args; return { toi: 1.5 }; },
    });
    const ex = {}, filt = () => true;
    const r = svc.ray(0, 1, 2, 3, 4, 5, 80, ex, filt);
    expect(r).toEqual({ toi: 1.5 });
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 80, ex, filt]);
  });
  it('forwards rayStatic() args to castRayStatic', () => {
    let seen = null;
    const svc = createRaycastService({ castRayStatic: (...a) => { seen = a; return { toi: 9 }; } });
    const r = svc.rayStatic(1, 2, 3, 4, 5, 6, 50, 'player');
    expect(r).toEqual({ toi: 9 });
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 50, 'player']);
  });
  it('forwards lineOfSight() args to hasLineOfSight', () => {
    let seen = null;
    const svc = createRaycastService({ hasLineOfSight: (...a) => { seen = a; return false; } });
    expect(svc.lineOfSight(0, 0, 0, 1, 1, 1, 'p')).toBe(false);
    expect(seen).toEqual([0, 0, 0, 1, 1, 1, 'p']);
  });
  it('passes default null excludes when caller omits them', () => {
    let seen = null;
    const svc = createRaycastService({ castRay: (...a) => { seen = a; return null; } });
    svc.ray(0, 0, 0, 1, 0, 0, 10);
    expect(seen).toEqual([0, 0, 0, 1, 0, 0, 10, null, null]);
  });
});

describe('createRaycastService — safe degradation (missing impls)', () => {
  it('ray and rayStatic return null when impls are absent', () => {
    const svc = createRaycastService({});
    expect(svc.ray(0, 0, 0, 1, 0, 0, 10)).toBeNull();
    expect(svc.rayStatic(0, 0, 0, 1, 0, 0, 10)).toBeNull();
  });
  it('lineOfSight returns true (fall back to "can see") when impl is absent', () => {
    const svc = createRaycastService({});
    expect(svc.lineOfSight(0, 0, 0, 1, 1, 1)).toBe(true);
  });
  it('createRaycastService() with no arg still yields a usable service', () => {
    const svc = createRaycastService();
    expect(svc.ray(0, 0, 0, 1, 0, 0, 10)).toBeNull();
    expect(svc.lineOfSight(0, 0, 0, 1, 1, 1)).toBe(true);
  });
});

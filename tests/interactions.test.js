// tests/interactions.test.js — locks down the pure physics interaction helpers
// (src/engine/physics/interactions.js): the impulse math and the thin Rapier-
// facing wrapper. No Three/Rapier — applyNudge is exercised against a fake body
// that records what it was handed, and the impulse/point scratch objects are
// supplied by the test (mirroring weapons.js's allocation-free hot path).
import { describe, it, expect } from 'vitest';
import {
  nudgeImpulse, applyNudge, CRATE_IMPULSE, CRATE_LIFT,
} from '../src/engine/physics/interactions.js';

describe('nudgeImpulse (pure math, writes into out)', () => {
  it('scales the direction by strength and adds lift on +Y', () => {
    const out = { x: 0, y: 0, z: 0 };
    const ret = nudgeImpulse(1, 0, 0, 2.2, 0.6, out);
    expect(ret).toBe(out); // returns the same object it wrote into
    expect(out).toEqual({ x: 2.2, y: 0.6, z: 0 });
  });
  it('applies lift on top of a non-zero Y component', () => {
    const out = { x: 0, y: 0, z: 0 };
    nudgeImpulse(0, 1, 0, 3, 0.5, out);
    expect(out).toEqual({ x: 0, y: 3.5, z: 0 }); // 1*3 + 0.5
  });
  it('handles negative directions', () => {
    const out = { x: 0, y: 0, z: 0 };
    nudgeImpulse(-1, 0, -1, 2, 0.6, out);
    expect(out).toEqual({ x: -2, y: 0.6, z: -2 });
  });
});

describe('applyNudge (fake body)', () => {
  function fakeBody() {
    const calls = [];
    return {
      calls,
      applyImpulseAtPoint(imp, pt, wake) {
        // copy — the real call reuses scratch objects, so snapshot the values.
        calls.push({ imp: { ...imp }, pt: { ...pt }, wake });
      },
    };
  }

  it('builds the impulse + point and forwards them to applyImpulseAtPoint with wake=true', () => {
    const body = fakeBody();
    const imp = { x: 0, y: 0, z: 0 };
    const pt  = { x: 0, y: 0, z: 0 };
    const ok = applyNudge(body, 1, 0, 0, 7, 8, 9, CRATE_IMPULSE, CRATE_LIFT, imp, pt);
    expect(ok).toBe(true);
    expect(body.calls).toHaveLength(1);
    expect(body.calls[0].imp).toEqual({ x: CRATE_IMPULSE, y: CRATE_LIFT, z: 0 });
    expect(body.calls[0].pt).toEqual({ x: 7, y: 8, z: 9 });
    expect(body.calls[0].wake).toBe(true);
  });
  it('returns false and does nothing for a null body', () => {
    const imp = { x: 0, y: 0, z: 0 }, pt = { x: 0, y: 0, z: 0 };
    expect(applyNudge(null, 1, 0, 0, 0, 0, 0, 2, 0.6, imp, pt)).toBe(false);
  });
  it('returns false for a body lacking applyImpulseAtPoint', () => {
    const imp = { x: 0, y: 0, z: 0 }, pt = { x: 0, y: 0, z: 0 };
    expect(applyNudge({}, 1, 0, 0, 0, 0, 0, 2, 0.6, imp, pt)).toBe(false);
  });
});

describe('tuning constants', () => {
  it('exposes the bullet→crate nudge defaults', () => {
    expect(CRATE_IMPULSE).toBe(2.2);
    expect(CRATE_LIFT).toBe(0.6);
  });
});

// tests/proof-surface-gate.test.js — pure PROMOTION/REGRESSION GATE for the
// display-only proof-surface boards (proofSurfaceGate.js, v0.2.152). The gate folds
// three pure layers — the spec↔registry cross-check, the render plan, and the
// scene-graph parent binding — into one fail-fast `{ok,gates,counts,reasons}`. These
// tests prove (a) the LIVE gate passes and (b) the gate CATCHES a deliberately-broken
// spec-check, render plan, or parent binding (the whole point: fail fast before a
// browser/promotion). No THREE/DOM/browser — fully node-deterministic.
import { describe, it, expect } from 'vitest';
import { proofSurfaceGate, PROOF_GATE_BADGE } from '../src/engine/debug/proofSurfaceGate.js';
import { buildProofSurfaceRenderPlan } from '../src/engine/world/proofSurfaceRenderPlan.js';

const FORBIDDEN_KEYS = [
  'fetch', 'navigate', 'href', 'url', 'onClick', 'onclick', 'sign', 'publish',
  'checkout', 'pay', 'zap', 'submit', 'relay', 'action', 'actions', 'mesh',
  'geometry', 'material', 'handler', 'listener',
];

describe('proofSurfaceGate — live gate passes', () => {
  it('reports ok with all three layers green', () => {
    const g = proofSurfaceGate();
    expect(g.badge).toBe(PROOF_GATE_BADGE);
    expect(g.ok).toBe(true);
    expect(g.gates).toEqual({ specCheck: true, renderPlan: true, parentBinding: true });
    expect(g.reasons).toEqual([]);
    expect(g.counts.panels).toBe(4);
    expect(g.counts.groups).toBe(2);
    expect(g.counts.bound).toBe(4);
    expect(g.counts.unbound).toBe(0);
  });

  it('is deterministic, JSON-serialisable, and inert', () => {
    const a = proofSurfaceGate();
    const b = proofSurfaceGate();
    expect(a).toEqual(b);
    expect(() => JSON.parse(JSON.stringify(a))).not.toThrow();
    expect(a.rendered).toBe(false);
    expect(a.actionable).toBe(false);
    for (const k of FORBIDDEN_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(a, k)).toBe(false);
    }
  });
});

describe('proofSurfaceGate — catches a broken spec-check', () => {
  it('fails fast when the injected spec-check is not ok', () => {
    const check = { ok: false, errors: ['gateway-portal-panel: shell is missing'] };
    const g = proofSurfaceGate({ check });
    expect(g.ok).toBe(false);
    expect(g.gates.specCheck).toBe(false);
    // render plan also fails because it consumes the failing check (cascades).
    expect(g.gates.renderPlan).toBe(false);
    expect(g.reasons).toContain('spec-check-failed');
    expect(g.reasons).toContain('spec-check: gateway-portal-panel: shell is missing');
  });
});

describe('proofSurfaceGate — catches a broken render plan', () => {
  it('fails fast when anchors are unresolved (empty render plan)', () => {
    // Inject an anchors result that reports not-ok → the plan produces no panels.
    const g = proofSurfaceGate({ anchors: { ok: false, resolved: [] } });
    expect(g.gates.renderPlan).toBe(false);
    expect(g.ok).toBe(false);
    expect(g.reasons).toContain('render-plan-not-ok');
    expect(g.reasons).toContain('render-plan: anchors-unresolved');
  });

  it('fails fast when an explicitly-injected plan is not ok', () => {
    const g = proofSurfaceGate({ plan: { ok: false, count: 0, panels: [], reasons: ['spec-check-failed'] } });
    expect(g.gates.renderPlan).toBe(false);
    expect(g.ok).toBe(false);
    expect(g.reasons).toContain('render-plan-not-ok');
  });
});

describe('proofSurfaceGate — catches a broken parent binding', () => {
  it('fails fast when a panel cannot be bound to a parent', () => {
    // A plan that is itself "ok" but carries a panel with an unknown anchor/no parent,
    // so resolveParentBindings lands it in `unbound`.
    const plan = { ok: true, count: 1, panels: [{ id: 'orphan', anchor: 'nope' }], reasons: [] };
    const g = proofSurfaceGate({ plan });
    expect(g.gates.renderPlan).toBe(true);
    expect(g.gates.parentBinding).toBe(false);
    expect(g.ok).toBe(false);
    expect(g.reasons).toContain('parent-binding-not-ok');
    expect(g.reasons).toContain('parent-binding: unbound orphan');
    expect(g.counts.unbound).toBe(1);
  });

  it('accepts an injected binding result directly', () => {
    const plan = buildProofSurfaceRenderPlan();
    const binding = { ok: false, groups: [], unbound: ['x', 'y'] };
    const g = proofSurfaceGate({ plan, binding });
    expect(g.gates.parentBinding).toBe(false);
    expect(g.reasons).toContain('parent-binding: unbound x, y');
  });
});

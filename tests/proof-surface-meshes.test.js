// tests/proof-surface-meshes.test.js — guard/failure paths of the browser-only
// proof-surface mesh adapter (proofSurfaceMeshes.js, v0.2.150). These cases never
// touch the DOM (no canvas/texture creation): they only exercise the gates that
// must REFUSE to build — a failing render plan or a missing scene. The happy
// mesh-building path needs a real WebGL/DOM context and is verified visually in
// the browser, not here (scope item 6: avoid brittle visual tests).
import { describe, it, expect } from 'vitest';
import {
  proofSurfaceRenderState,
  buildProofSurfaceMeshes,
} from '../src/engine/world/proofSurfaceMeshes.js';

describe('proofSurfaceMeshes — initial state', () => {
  it('reports not-built before any build', () => {
    const s = proofSurfaceRenderState();
    expect(s.rendered).toBe(false);
    expect(s.ok).toBe(false);
    expect(s.count).toBe(0);
    expect(s.reasons).toContain('not-built');
  });
});

describe('proofSurfaceMeshes — refuses to build when gated shut', () => {
  it('does not render when the plan fails (and does not throw)', () => {
    const s = buildProofSurfaceMeshes({ add() {} }, {
      anchors: { ok: false, resolved: [] },
      check: { ok: false },
    });
    expect(s.rendered).toBe(false);
    expect(s.ok).toBe(false);
    expect(s.count).toBe(0);
    expect(s.reasons).toContain('anchors-unresolved');
    expect(s.reasons).toContain('spec-check-failed');
  });

  it('does not render when no scene is provided', () => {
    const s = buildProofSurfaceMeshes(null, {
      anchors: { ok: false, resolved: [] },
      check: { ok: false },
    });
    expect(s.rendered).toBe(false);
    expect(s.reasons).toContain('no-scene');
  });
});

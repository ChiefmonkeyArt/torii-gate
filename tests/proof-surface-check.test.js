// tests/proof-surface-check.test.js — pure CROSS-CHECK that the in-world proof
// surface specs stay aligned with the live SDK + ToriiDebug.shells registries
// (proofSurfaceCheck.js, v0.2.148). Covers: all four current specs pass against the
// real registries, missing/unknown SDK + shell references are caught, inert
// invariant violations are caught, and no live-action key may appear on a spec.
import { describe, it, expect } from 'vitest';
import { checkProofSurfaceSpecs } from '../src/engine/debug/proofSurfaceCheck.js';
import { PROOF_SURFACE_SPECS } from '../src/engine/world/proofSurfaceSpecs.js';
import { SDK_SURFACE, STABILITY } from '../src/sdk/index.js';
import { buildShellReport } from '../src/engine/debug/shellReport.js';

// The real registries the specs must align with.
const SDK_NAMES = Object.entries(SDK_SURFACE)
  .filter(([, m]) => m.tier === STABILITY.EXPERIMENTAL && m.module)
  .map(([n]) => n);
const SHELL_NAMES = Object.keys(buildShellReport());

const baseSpec = () => ({
  id: 'x-panel', step: 'TRAVEL', lean: 'LEAN-2', title: 'X', kind: 'panel',
  previewSdk: 'gatewayPreview', shell: 'gatewayPreview', anchor: 'a',
  position: { x: 21, y: 2, z: 0 }, size: { width: 1, height: 1, depth: 0.1 }, yawRad: 0,
  invariants: { readOnly: true, actionable: false },
});

describe('proofSurfaceCheck — the four current specs', () => {
  it('passes against the real SDK + shells registries (default map)', () => {
    const r = checkProofSurfaceSpecs();
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.checked).toBe(2);
    expect(r.surfaces).toHaveLength(2);
    expect(r.surfaces.every((s) => s.sdkOk && s.shellOk && s.inert)).toBe(true);
  });

  it('passes against an explicitly injected map', () => {
    const r = checkProofSurfaceSpecs({ sdk: SDK_NAMES, shells: SHELL_NAMES });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('is deterministic — repeated calls return equal reports', () => {
    expect(checkProofSurfaceSpecs()).toEqual(checkProofSurfaceSpecs());
  });

  it('every current spec references a real SDK experimental namespace + shell report', () => {
    for (const s of PROOF_SURFACE_SPECS) {
      expect(SDK_NAMES).toContain(s.previewSdk);
      expect(SHELL_NAMES).toContain(s.shell);
    }
  });

  it('carries a read-only, no-render badge', () => {
    expect(checkProofSurfaceSpecs().badge).toBe('SPEC-CHECK · READ-ONLY · NO RENDER');
  });
});

describe('proofSurfaceCheck — missing / unknown references', () => {
  it('flags an unknown previewSdk as an error', () => {
    const spec = { ...baseSpec(), previewSdk: 'notARealSdkNamespace' };
    const r = checkProofSurfaceSpecs({}, [spec]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('previewSdk') && e.includes('notARealSdkNamespace'))).toBe(true);
    expect(r.surfaces[0].sdkOk).toBe(false);
  });

  it('flags a missing previewSdk and a missing shell', () => {
    const spec = { ...baseSpec(), previewSdk: '', shell: undefined };
    const r = checkProofSurfaceSpecs({}, [spec]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('previewSdk is missing'))).toBe(true);
    expect(r.errors.some((e) => e.includes('shell is missing'))).toBe(true);
  });

  it('flags a shell that is not a ToriiDebug.shells report', () => {
    const spec = { ...baseSpec(), shell: 'notAShellReport' };
    const r = checkProofSurfaceSpecs({}, [spec]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('shell') && e.includes('notAShellReport'))).toBe(true);
    expect(r.surfaces[0].shellOk).toBe(false);
  });

  it('warns (not errors) when previewSdk is a known but non-experimental surface', () => {
    // 'aim' is a real STABLE surface — known, but not experimental.
    const spec = { ...baseSpec(), previewSdk: 'aim' };
    const r = checkProofSurfaceSpecs({}, [spec]);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes("previewSdk 'aim'"))).toBe(true);
    expect(r.surfaces[0].sdkOk).toBe(true);
  });

  it('honours an injected sdk map (rejects names not in it)', () => {
    const r = checkProofSurfaceSpecs({ sdk: ['somethingElse'], shells: SHELL_NAMES }, [baseSpec()]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('previewSdk'))).toBe(true);
  });
});

describe('proofSurfaceCheck — inert invariants', () => {
  it('flags a spec whose invariants are loosened', () => {
    const spec = { ...baseSpec(), invariants: { readOnly: false, actionable: true, signed: true, published: true } };
    const r = checkProofSurfaceSpecs({}, [spec]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('readOnly must be true'))).toBe(true);
    expect(r.errors.some((e) => e.includes('actionable must be false'))).toBe(true);
    expect(r.errors.some((e) => e.includes('signed must not be true'))).toBe(true);
    expect(r.errors.some((e) => e.includes('published must not be true'))).toBe(true);
    expect(r.surfaces[0].inert).toBe(false);
  });

  it('accepts a spec missing the optional signed/published keys', () => {
    const r = checkProofSurfaceSpecs({}, [baseSpec()]);
    expect(r.ok).toBe(true);
    expect(r.surfaces[0].inert).toBe(true);
  });
});

describe('proofSurfaceCheck — no live-action keys', () => {
  it('flags any forbidden live-action key on a spec', () => {
    for (const key of ['fetch', 'navigate', 'href', 'sign', 'publish', 'checkout', 'onClick', 'mesh', 'geometry', 'actions']) {
      const spec = { ...baseSpec(), [key]: 'whatever' };
      const r = checkProofSurfaceSpecs({}, [spec]);
      expect(r.ok).toBe(false);
      expect(r.errors.some((e) => e.includes('forbidden live-action key') && e.includes(key))).toBe(true);
      expect(r.surfaces[0].inert).toBe(false);
    }
  });

  it('the real specs carry NO forbidden live-action key', () => {
    const r = checkProofSurfaceSpecs();
    expect(r.errors.some((e) => e.includes('forbidden live-action key'))).toBe(false);
  });
});

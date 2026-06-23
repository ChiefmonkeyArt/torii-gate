// tests/component.test.js — locks the pure component contract (CMP-2,
// src/engine/components/contract.js) and its exposure through the SDK entrypoint.
// The contract is the machine-checkable slice of COMPONENTS.md: manifest
// validation, the mount/unmount shape check, and the idempotent defineComponent
// wrapper. Pure module → fully node-testable, no scene/Rapier needed.
import { describe, it, expect } from 'vitest';
import {
  COMPONENT_CONTRACT_VERSION, REQUIRED_MANIFEST_FIELDS, MOUNT_TARGETS,
  validateManifest, isComponent, defineComponent,
} from '../src/engine/components/contract.js';
import * as SDK from '../src/sdk/index.js';

const goodManifest = () => ({
  id: 'torii.test.widget',
  name: 'Test Widget',
  version: '1.0.0',
  author: { npub: 'npub1abc', name: 'tester' },
  mountTarget: 'scene',
});

describe('component contract — metadata', () => {
  it('declares a contract version and the required-field list', () => {
    expect(typeof COMPONENT_CONTRACT_VERSION).toBe('string');
    expect(REQUIRED_MANIFEST_FIELDS).toEqual(['id', 'name', 'version', 'author', 'mountTarget']);
    expect(MOUNT_TARGETS).toContain('scene');
  });
});

describe('validateManifest', () => {
  it('accepts a complete manifest', () => {
    const r = validateManifest(goodManifest());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });
  it('rejects a non-object', () => {
    expect(validateManifest(null).valid).toBe(false);
    expect(validateManifest('x').valid).toBe(false);
  });
  it('flags each missing required field', () => {
    const r = validateManifest({});
    expect(r.valid).toBe(false);
    for (const f of REQUIRED_MANIFEST_FIELDS) {
      expect(r.errors.some(e => e.includes(f))).toBe(true);
    }
  });
  it('requires author.npub for provenance', () => {
    const m = goodManifest(); m.author = { name: 'anon' };
    const r = validateManifest(m);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('npub'))).toBe(true);
  });
  it('rejects an unknown mountTarget', () => {
    const m = goodManifest(); m.mountTarget = 'orbit';
    const r = validateManifest(m);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('mountTarget'))).toBe(true);
  });
  it('accepts free pricing and positive-sats pricing', () => {
    const free = goodManifest(); free.pricing = { free: true };
    expect(validateManifest(free).valid).toBe(true);
    const paid = goodManifest(); paid.pricing = { free: false, sats: 2100 };
    expect(validateManifest(paid).valid).toBe(true);
  });
  it('rejects paid pricing with no positive sats amount', () => {
    const m = goodManifest(); m.pricing = { free: false };
    const r = validateManifest(m);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('pricing'))).toBe(true);
    const m2 = goodManifest(); m2.pricing = { free: false, sats: -5 };
    expect(validateManifest(m2).valid).toBe(false);
  });
});

describe('isComponent', () => {
  it('is true only for objects with mount + unmount functions', () => {
    expect(isComponent({ mount() {}, unmount() {} })).toBe(true);
    expect(isComponent({ mount() {} })).toBe(false);
    expect(isComponent(null)).toBe(false);
    expect(isComponent({})).toBe(false);
  });
});

describe('defineComponent', () => {
  it('throws without mount/unmount functions', () => {
    expect(() => defineComponent({})).toThrow();
    expect(() => defineComponent({ mount() {} })).toThrow();
  });
  it('throws on an invalid manifest', () => {
    expect(() => defineComponent({ mount() {}, unmount() {}, manifest: {} })).toThrow(/manifest/);
  });
  it('produces a valid component from a good definition', () => {
    const c = defineComponent({ mount() {}, unmount() {}, manifest: goodManifest() });
    expect(isComponent(c)).toBe(true);
    expect(c.mounted).toBe(false);
    expect(c.manifest.id).toBe('torii.test.widget');
  });
  it('mount/unmount are idempotent and track the mounted flag', () => {
    const calls = [];
    const scene = { tag: 'scene' };
    const c = defineComponent({
      mount(s, opts) { calls.push(['mount', s, opts]); },
      unmount() { calls.push(['unmount']); },
      manifest: goodManifest(),
    });
    expect(c.mount(scene, { a: 1 })).toBe(true);
    expect(c.mounted).toBe(true);
    expect(c.mount(scene)).toBe(false);       // already mounted → no-op
    expect(c.unmount()).toBe(true);
    expect(c.mounted).toBe(false);
    expect(c.unmount()).toBe(false);          // already down → no-op
    // mount called once with the scene + options; unmount called once.
    expect(calls).toEqual([['mount', scene, { a: 1 }], ['unmount']]);
  });
});

describe('SDK exposure', () => {
  it('exposes the component contract via the SDK namespace', () => {
    expect(typeof SDK.component.defineComponent).toBe('function');
    expect(typeof SDK.component.validateManifest).toBe('function');
    expect(SDK.SDK_SURFACE.component.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
    expect(SDK.surfacesByTier(SDK.STABILITY.EXPERIMENTAL)).toContain('component');
  });
});

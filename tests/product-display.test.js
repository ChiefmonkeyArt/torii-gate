// tests/product-display.test.js — locks the read-only product display reference
// component (CMP-13 skeleton, src/engine/components/productDisplay.js). Built on
// the v0.2.132 component contract (defineComponent): contract-valid, carries a
// product manifest, has a symmetric idempotent lifecycle, validates listings
// safely, and exposes NO payment path. Pure module → node-testable.
import { describe, it, expect } from 'vitest';
import {
  createProductDisplay, productDisplay, validateProduct, PRODUCT_DISPLAY_VERSION,
} from '../src/engine/components/productDisplay.js';
import { isComponent, validateManifest } from '../src/engine/components/contract.js';
import * as SDK from '../src/sdk/index.js';

const SELLER = 'npub1seller000000000000000000000000000000000000000000';

describe('productDisplay — contract validity', () => {
  it('the default instance satisfies the component contract', () => {
    expect(isComponent(productDisplay)).toBe(true);
    expect(validateManifest(productDisplay.manifest).valid).toBe(true);
  });
  it('declares a product manifest (kind + provenance npub + panel target)', () => {
    const m = productDisplay.manifest;
    expect(m.kind).toBe('product');
    expect(m.id).toBe('plebeian.product-display');
    expect(m.mountTarget).toBe('panel');
    expect(typeof m.author.npub).toBe('string');
    expect(m.author.npub.length).toBeGreaterThan(0);
    expect(m.version).toBe(PRODUCT_DISPLAY_VERSION);
  });
});

describe('validateProduct', () => {
  const ok = {
    title: 'Sticker Gun', sellerNpub: SELLER, url: 'https://plebeian.market/p/1',
  };
  it('accepts a minimal valid product', () => {
    expect(validateProduct(ok).valid).toBe(true);
  });
  it('requires title, sellerNpub, and url', () => {
    expect(validateProduct({}).valid).toBe(false);
    expect(validateProduct({ title: 'x', url: 'https://a.b' }).valid).toBe(false); // no seller
    expect(validateProduct({ title: 'x', sellerNpub: SELLER }).valid).toBe(false); // no url
  });
  it('rejects a non-npub seller', () => {
    const r = validateProduct({ ...ok, sellerNpub: 'nope' });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/sellerNpub/);
  });
  it('rejects non-https url / image (no script or relative URLs)', () => {
    expect(validateProduct({ ...ok, url: 'javascript:alert(1)' }).valid).toBe(false);
    expect(validateProduct({ ...ok, url: '/relative' }).valid).toBe(false);
    expect(validateProduct({ ...ok, image: 'http://insecure' }).valid).toBe(false);
    expect(validateProduct({ ...ok, image: 'https://img.example/a.png' }).valid).toBe(true);
  });
  it('rejects a negative price but allows zero / omitted', () => {
    expect(validateProduct({ ...ok, priceSats: -1 }).valid).toBe(false);
    expect(validateProduct({ ...ok, priceSats: 0 }).valid).toBe(true);
    expect(validateProduct({ ...ok, priceSats: 21000 }).valid).toBe(true);
  });
  it('never throws on junk input', () => {
    expect(validateProduct(null).valid).toBe(false);
    expect(validateProduct(42).valid).toBe(false);
  });
});

describe('createProductDisplay — config flows into the manifest', () => {
  it('carries the supplied product fields incl. the reward hint', () => {
    const c = createProductDisplay({
      title: 'Sticker Gun', image: 'https://img.example/gun.png', sellerNpub: SELLER,
      priceSats: 5000, url: 'https://plebeian.market/p/42', reward: 'skin:sticker-gun',
    });
    expect(c.manifest.author.npub).toBe(SELLER);
    expect(c.manifest.product).toEqual({
      title: 'Sticker Gun', image: 'https://img.example/gun.png', sellerNpub: SELLER,
      priceSats: 5000, url: 'https://plebeian.market/p/42', reward: 'skin:sticker-gun',
    });
    expect(validateManifest(c.manifest).valid).toBe(true);
    expect(validateProduct(c.manifest.product).valid).toBe(true);
  });
});

describe('productDisplay — symmetric idempotent lifecycle (no payment path)', () => {
  it('mount then unmount toggles the mounted flag and is idempotent', () => {
    const c = createProductDisplay();
    const scene = { tag: 'panel' };
    expect(c.mounted).toBe(false);
    expect(c.mount(scene)).toBe(true);
    expect(c.mounted).toBe(true);
    expect(c.mount(scene)).toBe(false);  // already mounted → no-op
    expect(c.unmount()).toBe(true);
    expect(c.unmount()).toBe(false);     // already down → no-op
  });
  it('exposes no checkout / pay / zap surface (read-only)', () => {
    const c = createProductDisplay();
    expect(c.checkout).toBeUndefined();
    expect(c.pay).toBeUndefined();
    expect(c.zap).toBeUndefined();
  });
});

describe('productDisplay — SDK exposure', () => {
  it('is re-exported from the SDK at the experimental tier', () => {
    expect(typeof SDK.productDisplay.createProductDisplay).toBe('function');
    expect(isComponent(SDK.productDisplay.productDisplay)).toBe(true);
    expect(SDK.SDK_SURFACE.productDisplay.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
    expect(SDK.surfacesByTier(SDK.STABILITY.EXPERIMENTAL)).toContain('productDisplay');
  });
});

// tests/product-preview.test.js — Plebeian/Nostr product/market PREVIEW block
// (productPreview.js, LEAN-3, v0.2.140). Asserts the block is render-ready,
// surfaces the Nostr seller (npub) ownership proof, carries an explicit
// read-only/no-checkout badge + actionable:false, and never exposes a
// clickable/checkout/navigating action.
import { describe, it, expect } from 'vitest';
import {
  productPreviewBlock, shortNpub, previewUrl, PRODUCT_PREVIEW_BADGE,
} from '../src/engine/components/productPreview.js';
import * as SDK from '../src/sdk/index.js';

const VALID_PRODUCT = Object.freeze({
  title: 'Sticker Gun Skin',
  sellerNpub: 'npub1demo0seller0fixture0pleb0market0xxxxxxxxxxxxxxxxxxxx',
  priceSats: 2100,
  url: 'https://plebeian.market/listing/sticker-gun',
  image: 'https://plebeian.market/img/sticker-gun.png',
  reward: 'Sticker Gun skin',
});

describe('productPreview — shortNpub', () => {
  it('truncates a long npub with an ellipsis', () => {
    const out = shortNpub(VALID_PRODUCT.sellerNpub);
    expect(out.startsWith('npub1demo0se')).toBe(true);
    expect(out).toContain('…');
    expect(out.length).toBeLessThan(VALID_PRODUCT.sellerNpub.length);
  });
  it('returns short keys unchanged and is safe on non-strings', () => {
    expect(shortNpub('npub1abc')).toBe('npub1abc');
    expect(shortNpub(null)).toBe('');
    expect(shortNpub(42)).toBe('');
  });
});

describe('productPreview — previewUrl', () => {
  it('returns short urls unchanged', () => {
    expect(previewUrl('https://plebeian.market')).toBe('https://plebeian.market');
  });
  it('caps long urls with an ellipsis', () => {
    const long = `https://plebeian.market/${'x'.repeat(80)}`;
    const out = previewUrl(long, 30);
    expect(out.length).toBe(30);
    expect(out.endsWith('…')).toBe(true);
  });
  it('is safe on null/non-strings', () => {
    expect(previewUrl(null)).toBe('');
    expect(previewUrl(123)).toBe('123');
  });
});

describe('productPreview — productPreviewBlock', () => {
  it('builds a render-ready block for a valid product with the ownership proof', () => {
    const block = productPreviewBlock(VALID_PRODUCT);
    expect(block.title).toBe('PRODUCT PREVIEW');
    expect(block.ok).toBe(true);
    expect(block.sellerFull).toBe(VALID_PRODUCT.sellerNpub);
    expect(block.seller).toContain('…');
    expect(block.marketplace.label).toBe('View on Plebeian.Market');
    expect(block.marketplace.url).toContain('plebeian.market');
    expect(block.badge).toBe(PRODUCT_PREVIEW_BADGE);
  });

  it('exposes ordered label/value rows incl. product, price, shortened seller, reward and link', () => {
    const block = productPreviewBlock(VALID_PRODUCT);
    const labels = block.lines.map((l) => l.label);
    expect(labels).toEqual(['Product', 'Price', 'Seller', 'In-game reward', 'Marketplace', 'Link']);
    expect(block.lines.find((l) => l.label === 'Product').value).toBe('Sticker Gun Skin');
    expect(block.lines.find((l) => l.label === 'Price').value).toBe('2100 sats');
    const sellerRow = block.lines.find((l) => l.label === 'Seller');
    expect(sellerRow.value).toContain('…');
    expect(sellerRow.value).not.toBe(VALID_PRODUCT.sellerNpub);
  });

  it('omits the reward row when the product has no reward', () => {
    const { reward, ...noReward } = VALID_PRODUCT;
    const block = productPreviewBlock(noReward);
    const labels = block.lines.map((l) => l.label);
    expect(labels).toEqual(['Product', 'Price', 'Seller', 'Marketplace', 'Link']);
  });

  it('is inert: read-only, actionable false, no commerce/clickable keys', () => {
    const block = productPreviewBlock(VALID_PRODUCT);
    expect(block.readOnly).toBe(true);
    expect(block.actionable).toBe(false);
    expect(block.marketplace.actionable).toBe(false);
    expect(block.badge).toContain('NO CHECKOUT');
    for (const k of ['action', 'actions', 'href', 'onClick', 'navigate', 'checkout', 'pay', 'zap', 'buy']) {
      expect(block[k]).toBeUndefined();
    }
  });

  it('degrades to ok:false with errors for an invalid product (no throw)', () => {
    const block = productPreviewBlock({ title: '', url: 'javascript:alert(1)' });
    expect(block.ok).toBe(false);
    expect(block.actionable).toBe(false);
    expect(block.marketplace).toBeNull();
    expect(block.errors.length).toBeGreaterThan(0);
    expect(block.lines).toEqual([{ label: 'Status', value: 'UNAVAILABLE' }]);
  });
});

describe('productPreview — SDK exposure', () => {
  it('is re-exported at the experimental tier', () => {
    expect(typeof SDK.productPreview.productPreviewBlock).toBe('function');
    expect(SDK.SDK_SURFACE.productPreview.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
  });
});

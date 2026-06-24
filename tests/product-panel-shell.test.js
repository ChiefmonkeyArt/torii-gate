// tests/product-panel-shell.test.js — product panel RENDER shell
// (productPanelShell.js, v0.2.136). Asserts the layout spec is render-ready,
// read-only, and exposes NO commerce action (no checkout/pay/zap/open).
import { describe, it, expect } from 'vitest';
import { productPanelShell } from '../src/engine/components/productPanelShell.js';
import * as SDK from '../src/sdk/index.js';

const validProduct = {
  title: 'Sticker Gun Skin',
  image: 'https://img.example/skin.webp',
  sellerNpub: 'npub1abcdefghijklmnopqrstuvwxyz0123456789',
  priceSats: 2100,
  url: 'https://plebeian.market/listing/123',
  reward: 'sticker-gun',
};

describe('productPanelShell — layout spec', () => {
  it('builds an ordered panel for a valid product', () => {
    const { ok, panel } = productPanelShell(validProduct);
    expect(ok).toBe(true);
    expect(panel.title).toBe('Sticker Gun Skin');
    expect(panel.imageUrl).toBe('https://img.example/skin.webp');
    expect(panel.readOnly).toBe(true);
    // Body rows, in order: Price, Seller, then reward (present here).
    expect(panel.lines.map((l) => l.label)).toEqual(['Price', 'Seller', 'In-game reward']);
    expect(panel.lines[0].value).toBe('2100 sats');
    expect(panel.lines[2].value).toBe('sticker-gun');
  });

  it('omits the reward row when there is no reward', () => {
    const { panel } = productPanelShell({ ...validProduct, reward: null });
    expect(panel.lines.map((l) => l.label)).toEqual(['Price', 'Seller']);
  });

  it('shows the marketplace link as a DISPLAY-ONLY footer (not actionable)', () => {
    const { panel } = productPanelShell(validProduct);
    expect(panel.footer.kind).toBe('link');
    expect(panel.footer.label).toBe('View on Plebeian.Market');
    expect(panel.footer.url).toBe('https://plebeian.market/listing/123');
    expect(panel.footer.actionable).toBe(false);
  });

  it('exposes NO commerce action surface', () => {
    const { panel } = productPanelShell(validProduct);
    expect(panel.actions).toEqual([]);
    const json = JSON.stringify(panel).toLowerCase();
    for (const banned of ['checkout', 'pay', 'zap', 'buy', 'publish', 'addtocart']) {
      expect(json.includes(banned)).toBe(false);
    }
  });

  it('degrades safely on an invalid product', () => {
    const { ok, panel, errors } = productPanelShell({ title: '' });
    expect(ok).toBe(false);
    expect(panel).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('productPanelShell — SDK exposure', () => {
  it('is re-exported at the experimental tier', () => {
    expect(typeof SDK.productPanelShell.productPanelShell).toBe('function');
    expect(SDK.SDK_SURFACE.productPanelShell.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
  });
});

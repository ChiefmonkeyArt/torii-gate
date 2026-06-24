// engine/components/productPreview.js — visible-but-inert Plebeian/Nostr
// product/market panel PREVIEW block (LEAN-3, v0.2.140). Flattens the
// productPanelShell RENDER spec into a render-ready block of label/value rows
// that a title-screen or HUD card can draw directly — product identity, price,
// Nostr seller (npub) ownership proof, optional in-game reward, and the
// Plebeian.Market link as DISPLAY text — all framed with an explicit
// "PREVIEW · READ ONLY · NO CHECKOUT" badge.
//
// Pure + node-safe: NO Three/Rapier/DOM, NO window/location navigation, NO
// fetch, NO checkout/pay/zap/publish. This is the presentation layer over
// productPanelShell: it only re-shapes that shell's pure return value into
// display strings. Every block carries `actionable: false`; buying happens on
// Plebeian.Market, reached by the user out-of-band — this card only shows it.

import { productPanelShell } from './productPanelShell.js';

// Badge shown on every preview block so a viewer can never mistake it for a
// live commerce surface. The preview SHOWS a listing; it never transacts one.
export const PRODUCT_PREVIEW_BADGE = 'PREVIEW · READ ONLY · NO CHECKOUT';

// shortNpub(npub, head, tail) → a display-only truncation of a long npub so the
// Nostr ownership proof stays readable on a small card. Pure; collapses to ''
// on null/non-strings; returns the key unchanged when already short.
export function shortNpub(npub, head = 12, tail = 6) {
  if (typeof npub !== 'string' || npub === '') return '';
  if (npub.length <= head + tail + 1) return npub;
  return `${npub.slice(0, head)}…${npub.slice(-tail)}`;
}

// previewUrl(url, max) → a length-capped display form of the marketplace link.
// Display only — this string is NEVER navigated to or fetched. Pure; collapses
// whitespace, safe on null/non-strings (returns '').
export function previewUrl(url, max = 44) {
  const flat = String(url || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

// productPreviewBlock(product, { urlMax }) → a render-ready, INERT product
// preview block for a Plebeian/Nostr market card:
//
//   {
//     title:       'PRODUCT PREVIEW',
//     ok:          boolean,             // false ⇒ product failed validation
//     seller:      string,              // shortened npub (ownership proof), '—' if none
//     sellerFull:  string | null,       // the full npub (display only)
//     marketplace: { label, url, actionable:false } | null,  // link is text only
//     badge:       'PREVIEW · READ ONLY · NO CHECKOUT',
//     lines:       [{ label, value }],  // ready-to-draw rows for a DOM/HUD card
//     readOnly:    true,
//     actionable:  false,               // ALWAYS false — never a commerce action
//     errors:      string[],            // validation errors when ok:false
//   }
//
// Pure — never throws, never navigates, never fetches.
export function productPreviewBlock(product, { urlMax = 44 } = {}) {
  const { ok, errors, panel } = productPanelShell(product);
  if (!ok) {
    return {
      title: 'PRODUCT PREVIEW',
      ok: false,
      seller: '—',
      sellerFull: null,
      marketplace: null,
      badge: PRODUCT_PREVIEW_BADGE,
      lines: [{ label: 'Status', value: 'UNAVAILABLE' }],
      readOnly: true,
      actionable: false,
      errors,
    };
  }

  const sellerLine = panel.lines.find((l) => l.label === 'Seller');
  const sellerFull = sellerLine ? sellerLine.value : null;
  const linkUrl = previewUrl(panel.footer.url, urlMax);

  // Build display rows: product identity first, then the panel's body rows
  // (shortening the Seller npub for readability), then the marketplace link as
  // text-only rows. No row is interactive.
  const lines = [{ label: 'Product', value: panel.title }];
  for (const { label, value } of panel.lines) {
    lines.push({ label, value: label === 'Seller' ? shortNpub(value) : value });
  }
  lines.push({ label: 'Marketplace', value: panel.footer.label });
  lines.push({ label: 'Link', value: linkUrl || '—' });

  return {
    title: 'PRODUCT PREVIEW',
    ok: true,
    seller: shortNpub(sellerFull),
    sellerFull,
    // Marketplace link carried as a LABEL + url string for DISPLAY. actionable
    // is false so a renderer must not wire it to navigation; opening the link
    // is the user's own out-of-band action on Plebeian.Market.
    marketplace: { label: panel.footer.label, url: linkUrl, actionable: false },
    badge: PRODUCT_PREVIEW_BADGE,
    lines,
    readOnly: true,
    actionable: false, // display-only; no checkout/pay/zap surface, ever
    errors: [],
  };
}

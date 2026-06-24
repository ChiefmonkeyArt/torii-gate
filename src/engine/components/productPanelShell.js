// engine/components/productPanelShell.js — product panel RENDER shell (CMP-13
// continuation, v0.2.136). Turns the productPanel view-model into an ordered,
// render-ready PANEL SPEC: a title bar, body lines, a footer link LABEL, and an
// explicit (empty) actions list. This is the concrete content an in-world panel
// mesh or a DOM card draws — split from the view-model so the renderer binds to a
// fixed layout shape.
//
// Pure + node-safe: NO Three/Rapier/DOM. READ-ONLY by design — the footer link is
// a DISPLAY-ONLY label (actionable:false). There is NO checkout/pay/zap and NO
// open-external-url action: `actions` is always empty. Buying happens on
// Plebeian.Market, reached by the user out-of-band; this panel only shows it.

import { productPanelViewModel } from './productPanel.js';

// productPanelShell(product) → { ok, errors, panel }. Validates via the
// view-model first (invalid ⇒ ok:false, panel:null). The panel is a flat layout
// spec a renderer can draw top-to-bottom. Pure — never throws, no side effects.
//
//   panel = {
//     title:   string,                 // title-bar text
//     imageUrl: string | null,         // optional hero image (display only)
//     lines:   [{ label, value }],     // ordered body rows
//     footer:  { kind:'link', label, url, actionable:false },  // link is text only
//     actions: [],                     // ALWAYS empty — no checkout/pay/zap/open
//     readOnly: true,
//   }
export function productPanelShell(product) {
  const vm = productPanelViewModel(product);
  if (!vm.ok) return { ok: false, errors: vm.errors, panel: null };

  const v = vm.view;
  const lines = [{ label: 'Price', value: v.priceLabel }];
  lines.push({ label: 'Seller', value: v.seller });
  if (v.hasReward) lines.push({ label: 'In-game reward', value: v.reward });

  const panel = {
    title: v.title,
    imageUrl: v.imageUrl,
    lines,
    // Footer carries the marketplace link as a LABEL + url string for display.
    // actionable:false marks it non-interactive — the renderer must not wire it
    // to navigation; opening the link is the user's own out-of-band action.
    footer: { kind: 'link', label: v.linkLabel, url: v.linkUrl, actionable: false },
    // No commerce surface: empty by construction so a renderer cannot bind a
    // checkout/pay/zap button from this shell.
    actions: [],
    readOnly: true,
  };
  return { ok: true, errors: [], panel };
}

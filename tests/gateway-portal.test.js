// tests/gateway-portal.test.js — gateway portal VIEW shell (gatewayPortal.js,
// v0.2.136). Asserts the view-model is render-ready, armed only on a valid plan,
// carries a display-only URL preview, and NEVER navigates (it's a pure return).
import { describe, it, expect } from 'vitest';
import {
  gatewayPortalView, destinationLabel, shortKey, PORTAL_PROMPT,
} from '../src/engine/gateway/gatewayPortal.js';
import { createToriiGateway } from '../src/engine/components/toriiGateway.js';
import { parseTravelUrl } from '../src/engine/gateway/travelIntent.js';
import * as SDK from '../src/sdk/index.js';

describe('gatewayPortal — shortKey', () => {
  it('truncates long keys with an ellipsis, keeps short ones', () => {
    expect(shortKey('npub1abcdefghijklmnopqrstuvwxyz', 10, 4)).toBe('npub1abcde…wxyz');
    expect(shortKey('short')).toBe('short');
  });
  it('is safe on null/non-strings', () => {
    expect(shortKey(null)).toBe('');
    expect(shortKey(123)).toBe('');
  });
});

describe('gatewayPortal — destinationLabel', () => {
  it('prefers an explicit target', () => {
    expect(destinationLabel({ target: 'plebeian-market', npub: 'npub1xyz' })).toBe('plebeian-market');
  });
  it('falls back to a truncated npub, then to a placeholder', () => {
    expect(destinationLabel({ npub: 'npub1abcdefghijklmnopqrstuvwxyz' })).toBe('npub1abcde…wxyz');
    expect(destinationLabel({})).toBe('Unknown destination');
    expect(destinationLabel(null)).toBe('Unknown destination');
  });
});

describe('gatewayPortal — gatewayPortalView', () => {
  it('is armed + ready with a parseable URL preview for a valid gateway', () => {
    const gate = createToriiGateway({ target: 'world-2', relay: 'wss://relay.example' });
    const view = gatewayPortalView(gate, { from: 'torii-quest' });
    expect(view.status).toBe('ready');
    expect(view.isGateway).toBe(true);
    expect(view.armed).toBe(true);
    expect(view.destinationLabel).toBe('world-2');
    expect(view.relay).toBe('wss://relay.example');
    expect(view.prompt).toBe(PORTAL_PROMPT);
    expect(view.urlPreview).not.toBe('');
    // The preview is a real, parseable travel URL — display only, no navigation.
    const parsed = parseTravelUrl(view.urlPreview);
    expect(parsed.valid).toBe(true);
    expect(parsed.intent.to).toBe('world-2');
    expect(parsed.intent.from).toBe('torii-quest');
  });

  it('honours a custom prompt and URL base', () => {
    const gate = createToriiGateway({ target: 'world-2' });
    const view = gatewayPortalView(gate, {}, { base: '/travel', prompt: 'Enter the gate' });
    expect(view.prompt).toBe('Enter the gate');
    expect(view.urlPreview.startsWith('/travel?')).toBe(true);
  });

  it('is not armed when the traveller npub is malformed', () => {
    const gate = createToriiGateway({ target: 'world-2' });
    const view = gatewayPortalView(gate, { player: 'not-an-npub' });
    expect(view.armed).toBe(false);
    expect(view.status).toBe('invalid');
    expect(view.prompt).toBe('');
    expect(view.urlPreview).toBe('');
    expect(view.errors.some((e) => e.includes('npub'))).toBe(true);
  });

  it('reports not-a-gateway for a non-gateway component', () => {
    const view = gatewayPortalView({ manifest: { kind: 'product' } }, {});
    expect(view.status).toBe('not-a-gateway');
    expect(view.isGateway).toBe(false);
    expect(view.armed).toBe(false);
    expect(view.destination).toBeNull();
  });
});

describe('gatewayPortal — SDK exposure', () => {
  it('is re-exported at the experimental tier', () => {
    expect(typeof SDK.gatewayPortal.gatewayPortalView).toBe('function');
    expect(SDK.SDK_SURFACE.gatewayPortal.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
  });
});

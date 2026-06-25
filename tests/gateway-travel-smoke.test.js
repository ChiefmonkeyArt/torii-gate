// tests/gateway-travel-smoke.test.js — pure GATEWAY TRAVEL SMOKE harness
// (src/engine/gateway/travelSmoke.js, v0.2.195). Covers the folded
// runGatewayTravelSmoke() report (all 10 signals + summary), the read-only /
// no-auto-action safety invariants (navigated/performed/external/signed/published/
// network pinned false), the hostile-route rejection set, the consent gate, and the
// text formatter on degraded input — plus a deliberately-broken injected component
// to prove the harness catches a failing flow without throwing. No fs/network/relay/
// DOM — every input is plain data, fully node-deterministic.
import { describe, it, expect } from 'vitest';
import {
  TRAVEL_SMOKE_VERSION, TRAVEL_SMOKE_BADGE, HOSTILE_ROUTES,
  DEFAULT_PORTAL_ALLOWLIST,
  demoGatewayComponent, runGatewayTravelSmoke, formatGatewayTravelSmoke,
} from '../src/engine/gateway/travelSmoke.js';

describe('constants', () => {
  it('exports a version, a read-only/dry-run badge, and the hostile-route fixture', () => {
    expect(TRAVEL_SMOKE_VERSION).toBe(1);
    expect(TRAVEL_SMOKE_BADGE).toMatch(/READ-ONLY/);
    expect(TRAVEL_SMOKE_BADGE).toMatch(/DRY-RUN/);
    expect(Array.isArray(HOSTILE_ROUTES)).toBe(true);
    expect(HOSTILE_ROUTES.length).toBe(7);
    expect(Object.isFrozen(HOSTILE_ROUTES)).toBe(true);
  });
  it('re-exports the scoped default allowlist (never permit-everything)', () => {
    expect(DEFAULT_PORTAL_ALLOWLIST).toEqual(['/zone/']);
    expect(DEFAULT_PORTAL_ALLOWLIST).not.toContain('/');
  });
});

describe('demoGatewayComponent', () => {
  it('builds a deterministic same-origin demo gate', () => {
    const c = demoGatewayComponent();
    expect(c && typeof c === 'object').toBe(true);
  });
});

describe('runGatewayTravelSmoke', () => {
  it('is all-green over the demo gate (10 signals, no fail)', () => {
    const r = runGatewayTravelSmoke();
    expect(r.ok).toBe(true);
    expect(r.badge).toBe(TRAVEL_SMOKE_BADGE);
    expect(r.version).toBe(TRAVEL_SMOKE_VERSION);
    expect(r.summary.total).toBe(10);
    expect(r.summary.ok).toBe(10);
    expect(r.summary.fail).toBe(0);
    expect(r.reasons).toEqual([]);
  });

  it('emits exactly the expected signal keys, all ok', () => {
    const r = runGatewayTravelSmoke();
    const keys = r.signals.map((s) => s.key).sort();
    expect(keys).toEqual([
      'allowlist-scoped',
      'consent-gates-travel',
      'explicit-confirm-required',
      'hostile-routes-rejected',
      'no-auto-action',
      'no-external-url',
      'proximity-never-navigates',
      'same-origin-route-only',
      'trigger-arms-on-proximity',
      'zone-route-resolves',
    ]);
    expect(r.signals.every((s) => s.status === 'ok')).toBe(true);
  });

  it('pins every safety flag false on the folded report', () => {
    const r = runGatewayTravelSmoke();
    expect(r.safety).toEqual({
      navigated: false, performed: false, external: false,
      signed: false, published: false, network: false,
    });
    expect(r.rendered).toBe(false);
    expect(r.actionable).toBe(false);
  });

  it('rejects every hostile route (none classifies as a zone / navigates)', () => {
    const r = runGatewayTravelSmoke();
    const sig = r.signals.find((s) => s.key === 'hostile-routes-rejected');
    expect(sig.status).toBe('ok');
    expect(sig.detail).toMatch(/all 7 rejected/);
  });

  it('blocks travel without a grant and allows-but-never-performs with one', () => {
    const r = runGatewayTravelSmoke();
    const sig = r.signals.find((s) => s.key === 'consent-gates-travel');
    expect(sig.status).toBe('ok');
    expect(sig.detail).toMatch(/grant\.performed=false/);
  });

  it('surfaces ok:false (with reasons) when an injected component breaks the flow', () => {
    const broken = { manifest: { gateway: { npub: 'x', relay: 'wss://r', target: '', position: { x: 10, y: 0, z: 0 } } }, position: { x: 10, y: 0, z: 0 } };
    const r = runGatewayTravelSmoke({ component: broken });
    expect(r.ok).toBe(false);
    expect(r.summary.fail).toBeGreaterThan(0);
    expect(r.reasons.length).toBeGreaterThan(0);
    // Even a broken flow keeps the no-auto-action safety posture pinned false.
    expect(r.safety.navigated).toBe(false);
    expect(r.safety.performed).toBe(false);
    expect(r.safety.external).toBe(false);
  });

  it('is safe on no-arg / degraded opts (never throws)', () => {
    expect(() => runGatewayTravelSmoke(null)).not.toThrow();
    expect(() => runGatewayTravelSmoke([])).not.toThrow();
    expect(() => runGatewayTravelSmoke('nope')).not.toThrow();
    expect(runGatewayTravelSmoke(null).summary.total).toBe(10);
    expect(runGatewayTravelSmoke(null).ok).toBe(true);
  });
});

describe('formatGatewayTravelSmoke', () => {
  it('renders a block with the badge and a verdict line', () => {
    const out = formatGatewayTravelSmoke(runGatewayTravelSmoke());
    expect(out).toMatch(/GATEWAY TRAVEL SMOKE/);
    expect(out).toMatch(/verdict: OK/);
    expect(out).toMatch(/10\/10 signals/);
  });
  it('is safe on null (falls back to running the smoke)', () => {
    expect(() => formatGatewayTravelSmoke(null)).not.toThrow();
    expect(formatGatewayTravelSmoke(null)).toMatch(/GATEWAY TRAVEL SMOKE/);
  });
});

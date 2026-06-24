// tests/shell-report.test.js — read-only DEBUG reports over the v0.2.136 VIEW
// shells (shellReport.js, v0.2.137). Asserts each report reads its shell's pure
// output, is deterministic, and exposes NO commerce/signer/publish/navigation.
import { describe, it, expect } from 'vitest';
import {
  gatewayReport, gatewayPreviewReport, productReport, leaderboardReport,
  buildShellReport, shellsSummary, shellsDiff,
  DEMO_GATEWAY, DEMO_PRODUCT, DEMO_SCORES,
} from '../src/engine/debug/shellReport.js';
import { VERSION } from '../src/config.js';

describe('shellReport — gatewayReport', () => {
  it('reports an armed, ready portal for the demo gateway (display only)', () => {
    const r = gatewayReport();
    expect(r.status).toBe('ready');
    expect(r.isGateway).toBe(true);
    expect(r.armed).toBe(true);
    expect(r.destinationLabel).toBe('plebeian-market-bazaar');
    expect(r.relay).toBe('wss://relay.example.com');
    expect(r.urlPreview).not.toBe('');
    // No live-action fields leak into the report.
    expect(r).not.toHaveProperty('navigate');
    expect(r).not.toHaveProperty('sign');
  });

  it('reports not-a-gateway for a non-gateway component', () => {
    const r = gatewayReport({ manifest: { kind: 'product' } });
    expect(r.status).toBe('not-a-gateway');
    expect(r.isGateway).toBe(false);
    expect(r.armed).toBe(false);
  });
});

describe('shellReport — productReport', () => {
  it('reports a read-only panel with no commerce surface', () => {
    const r = productReport();
    expect(r.ok).toBe(true);
    expect(r.title).toBe('Sticker Gun Skin');
    expect(r.lineCount).toBe(r.lines.length);
    expect(r.readOnly).toBe(true);
    expect(r.actionable).toBe(false);
    expect(r.actionCount).toBe(0);
  });

  it('reports ok:false for an invalid product', () => {
    const r = productReport({ title: '', sellerNpub: 'nope', url: 'ftp://x' });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.actionCount).toBe(0);
  });
});

describe('shellReport — leaderboardReport', () => {
  it('ranks scores deterministically and never signs or publishes', () => {
    const r = leaderboardReport();
    expect(r.count).toBe(3);
    expect(r.skipped).toBe(0);
    // Highest score first (run-b 240, run-a 120, run-c 90).
    expect(r.rows.map((x) => x.runId)).toEqual(['run-b', 'run-a', 'run-c']);
    expect(r.rows[0].rank).toBe(1);
    expect(r.signed).toBe(false);
    expect(r.published).toBe(false);
  });
});

describe('shellReport — buildShellReport', () => {
  it('composes all three reports with safe demo defaults', () => {
    const r = buildShellReport();
    expect(r.gateway.armed).toBe(true);
    expect(r.product.ok).toBe(true);
    expect(r.leaderboard.count).toBe(3);
    expect(r.leaderboard.signed).toBe(false);
    expect(r.leaderboard.published).toBe(false);
  });

  it('accepts overrides for each section', () => {
    const r = buildShellReport({
      gateway: { manifest: { kind: 'product' } },
      scores: [],
    });
    expect(r.gateway.status).toBe('not-a-gateway');
    expect(r.leaderboard.count).toBe(0);
    expect(r.product.ok).toBe(true); // falls back to DEMO_PRODUCT
  });
});

describe('shellReport — shellsSummary', () => {
  it('summarises the four MVP proof surfaces framed by the loop', () => {
    const s = shellsSummary();
    expect(s.count).toBe(4);
    expect(s.surfaces.map((x) => x.key)).toEqual([
      'gatewayPreview', 'productPreview', 'leaderboardPreview', 'updatePreview',
    ]);
    expect(s.surfaces.map((x) => x.lean)).toEqual(['LEAN-2', 'LEAN-3', 'LEAN-4', 'LEAN-5']);
    expect(s.surfaces.map((x) => x.step)).toEqual(['TRAVEL', 'MARKET', 'SCORE', 'UPDATE']);
    // Each surface maps to a real SDK namespace + ToriiDebug.shells report.
    for (const x of s.surfaces) {
      expect(typeof x.sdk).toBe('string');
      expect(x.shell).toBe(x.key);
    }
  });

  it('ties version + flow to the MVP loop and frames the loop header', () => {
    const s = shellsSummary();
    expect(s.version).toBe(VERSION);
    expect(s.flow).toBe('Travel → Market → Score → Update');
    expect(s.loop.flow).toBe(s.flow);
    expect(s.loop.key).toBe('mvpLoop');
  });

  it('reports every surface inert: actionable/signed/published never true', () => {
    const s = shellsSummary();
    expect(s.allInert).toBe(true);
    expect(s.network).toBe(false);
    expect(s.autoUpdate).toBe(false);
    expect(s.loop.invariants.actionable).toBe(false);
    for (const x of s.surfaces) {
      expect(x.invariants.actionable).toBe(false);
      expect(x.invariants.signed).not.toBe(true);
      expect(x.invariants.published).not.toBe(true);
    }
    // The leaderboard surface explicitly pins signed/published false.
    const lb = s.surfaces.find((x) => x.key === 'leaderboardPreview');
    expect(lb.invariants.signed).toBe(false);
    expect(lb.invariants.published).toBe(false);
  });

  it('exposes NO live-action keys on the summary', () => {
    const s = shellsSummary();
    for (const k of ['fetch', 'navigate', 'href', 'sign', 'publish', 'update', 'checkout', 'onClick']) {
      expect(s).not.toHaveProperty(k);
    }
  });

  it('exposes symmetric readOnly+actionable invariants on all four surfaces', () => {
    const s = shellsSummary();
    for (const x of s.surfaces) {
      expect(x.invariants.readOnly).toBe(true);
      expect(x.invariants.actionable).toBe(false);
    }
    // The gateway preview now reports readOnly explicitly (v0.2.146 symmetry).
    expect(gatewayPreviewReport().readOnly).toBe(true);
  });
});

describe('shellReport — shellsDiff', () => {
  it('reports no flips for two identical summaries (safe, unchanged)', () => {
    const d = shellsDiff(shellsSummary(), shellsSummary());
    expect(d.changed).toBe(false);
    expect(d.safe).toBe(true);
    expect(d.flips).toEqual([]);
    expect(d.loosened).toEqual([]);
    expect(d.fromVersion).toBe(d.toVersion);
  });

  it('flags a surface invariant flip that LOOSENS inertness (actionable→true)', () => {
    const before = shellsSummary();
    const after = structuredClone(before);
    const upd = after.surfaces.find((x) => x.key === 'updatePreview');
    upd.invariants.actionable = true; // simulate a preview→live promotion
    after.allInert = false;           // the summary would recompute this too
    const d = shellsDiff(before, after);
    expect(d.changed).toBe(true);
    expect(d.safe).toBe(false);
    const flip = d.loosened.find((f) => f.scope === 'surface' && f.key === 'updatePreview');
    expect(flip).toMatchObject({ invariant: 'actionable', from: false, to: true, loosens: true });
    // The top-level allInert flip is also flagged as loosening.
    expect(d.loosened.some((f) => f.key === 'allInert' && f.from === true && f.to === false)).toBe(true);
  });

  it('treats a TIGHTENING flip (actionable→false) as safe', () => {
    const before = shellsSummary();
    const loosened = structuredClone(before);
    loosened.surfaces.find((x) => x.key === 'productPreview').invariants.actionable = true;
    // Diffing loosened → original tightens it back: a change, but not a loosening.
    const d = shellsDiff(loosened, before);
    expect(d.changed).toBe(true);
    expect(d.safe).toBe(true);
    expect(d.loosened).toEqual([]);
  });

  it('reports added/removed surfaces without loosening', () => {
    const before = shellsSummary();
    const after = structuredClone(before);
    after.surfaces.pop(); // drop updatePreview
    const d = shellsDiff(before, after);
    const removed = d.flips.find((f) => f.change === 'removed');
    expect(removed).toMatchObject({ scope: 'surface', key: 'updatePreview', loosens: false });
    expect(d.safe).toBe(true);
  });

  it('exposes NO live-action keys on the diff', () => {
    const d = shellsDiff(shellsSummary(), shellsSummary());
    for (const k of ['fetch', 'navigate', 'href', 'sign', 'publish', 'checkout', 'onClick']) {
      expect(d).not.toHaveProperty(k);
    }
  });
});

describe('shellReport — demo fixtures', () => {
  it('exposes frozen, valid demo fixtures', () => {
    expect(DEMO_GATEWAY.manifest.kind).toBe('gateway');
    expect(Object.isFrozen(DEMO_PRODUCT)).toBe(true);
    expect(Object.isFrozen(DEMO_SCORES)).toBe(true);
    expect(DEMO_SCORES.length).toBe(3);
  });
});

// tests/mvp-readiness-rollup.test.js — pure MVP RELEASE-READINESS ROLLUP
// (src/engine/status/mvpReadiness.js, v0.2.198). Covers the folded
// runMvpReadiness() report (all 9 signals + summary + mvpPct/status), the
// read-only / no-deploy safety invariants (served/deployed/published/navigated/
// performed/fetched/wrote/network pinned false), the curated injectable
// fixtures (tests/VPS/docs/nextSafeTask) and their defaults, the MVP
// percentage/status computation, degraded/null opts safety, and the text
// formatter on degraded input — plus deliberately-broken injected fixtures to
// prove the rollup catches a failing signal without throwing.
// No fs/network/server/DOM — every input is plain data, fully node-deterministic.
import { describe, it, expect } from 'vitest';
import {
  MVP_READINESS_VERSION, MVP_READINESS_BADGE,
  DEFAULT_TEST_STATUS, DEFAULT_VPS_DRY_RUN, DEFAULT_DOCS_STATUS, NEXT_SAFE_TASK,
  runMvpReadiness, formatMvpReadiness,
} from '../src/engine/status/mvpReadiness.js';

const EXPECTED_KEYS = [
  'docs-handoff',
  'gateway-travel-smoke',
  'host-route-smoke',
  'nostr-read-health',
  'release-metadata-floor',
  'test-suite',
  'update-flow-smoke',
  'version-marker',
  'vps-dry-run',
];

describe('constants', () => {
  it('exports a version and a read-only/no-deploy badge', () => {
    expect(MVP_READINESS_VERSION).toBe(1);
    expect(MVP_READINESS_BADGE).toMatch(/READ-ONLY/);
    expect(MVP_READINESS_BADGE).toMatch(/NO DEPLOY/);
  });
  it('exposes frozen, deterministic curated default fixtures', () => {
    expect(Object.isFrozen(DEFAULT_TEST_STATUS)).toBe(true);
    expect(DEFAULT_TEST_STATUS.ok).toBe(true);
    expect(typeof DEFAULT_TEST_STATUS.passing).toBe('number');
    expect(Object.isFrozen(DEFAULT_VPS_DRY_RUN)).toBe(true);
    expect(DEFAULT_VPS_DRY_RUN.ok).toBe(true);
    expect(Object.isFrozen(DEFAULT_DOCS_STATUS)).toBe(true);
    expect(DEFAULT_DOCS_STATUS.ok).toBe(true);
    expect(Object.isFrozen(NEXT_SAFE_TASK)).toBe(true);
    expect(typeof NEXT_SAFE_TASK.title).toBe('string');
  });
});

describe('runMvpReadiness', () => {
  it('is all-green over the default signals (9 signals, no fail)', () => {
    const r = runMvpReadiness();
    expect(r.ok).toBe(true);
    expect(r.badge).toBe(MVP_READINESS_BADGE);
    expect(r.version).toBe(MVP_READINESS_VERSION);
    expect(r.summary.total).toBe(9);
    expect(r.summary.ok).toBe(9);
    expect(r.summary.fail).toBe(0);
    expect(r.reasons).toEqual([]);
  });

  it('emits exactly the expected signal keys, all ok', () => {
    const r = runMvpReadiness();
    const keys = r.signals.map((s) => s.key).sort();
    expect(keys).toEqual(EXPECTED_KEYS);
    for (const s of r.signals) expect(s.status).toBe('ok');
  });

  it('computes mvpPct=100 and status READY when all green', () => {
    const r = runMvpReadiness();
    expect(r.mvpPct).toBe(100);
    expect(r.status).toBe('READY');
    expect(typeof r.currentVersion).toBe('string');
    expect(r.currentVersion).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it('pins every safety flag false', () => {
    const r = runMvpReadiness();
    for (const f of ['served', 'deployed', 'published', 'navigated',
      'performed', 'fetched', 'wrote', 'network']) {
      expect(r.safety[f]).toBe(false);
    }
    expect(r.rendered).toBe(false);
    expect(r.actionable).toBe(false);
  });

  it('surfaces a next-safe-task (infra, no gated/runtime work)', () => {
    const r = runMvpReadiness();
    expect(r.nextSafeTask.kind).toBe('infra');
    expect(r.nextSafeTask.title.length).toBeGreaterThan(0);
    expect(r.nextSafeTask.why).toMatch(/SEC-1\/2\/3/);
  });

  it('accepts an injected test status and reflects a failing suite', () => {
    const r = runMvpReadiness({ tests: { passing: 1200, files: 75, profile: 'fast', ok: false } });
    expect(r.ok).toBe(false);
    expect(r.status).toBe('NEAR'); // exactly one signal short
    expect(r.mvpPct).toBe(Math.round((8 / 9) * 100));
    const sig = r.signals.find((s) => s.key === 'test-suite');
    expect(sig.status).toBe('fail');
    expect(r.reasons.some((x) => x.startsWith('test-suite:'))).toBe(true);
  });

  it('flags ATTENTION when two or more signals fail', () => {
    const r = runMvpReadiness({
      tests: { ok: false },
      vpsDryRun: { ok: false, detail: 'dry-run unavailable' },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe('ATTENTION');
    expect(r.summary.fail).toBeGreaterThanOrEqual(2);
  });

  it('accepts an injected docs status and next-safe-task override', () => {
    const r = runMvpReadiness({
      docs: { ok: true, detail: 'custom docs note' },
      nextSafeTask: { title: 'Custom safe slice', why: 'because', kind: 'docs' },
    });
    expect(r.nextSafeTask.title).toBe('Custom safe slice');
    expect(r.nextSafeTask.kind).toBe('docs');
    const sig = r.signals.find((s) => s.key === 'docs-handoff');
    expect(sig.detail).toBe('custom docs note');
  });

  it('treats null/garbled opts as defaults (never throws)', () => {
    expect(() => runMvpReadiness(null)).not.toThrow();
    expect(() => runMvpReadiness(42)).not.toThrow();
    expect(() => runMvpReadiness([])).not.toThrow();
    const r = runMvpReadiness(null);
    expect(r.ok).toBe(true);
    expect(r.summary.total).toBe(9);
  });

  it('ignores a garbled injected fixture and falls back to the curated default', () => {
    const r = runMvpReadiness({ tests: 'nope', vpsDryRun: 7, docs: null });
    expect(r.ok).toBe(true);
    const test = r.signals.find((s) => s.key === 'test-suite');
    expect(test.status).toBe('ok');
  });
});

describe('formatMvpReadiness', () => {
  it('renders the badge, MVP %, verdict, and all signal lines', () => {
    const text = formatMvpReadiness(runMvpReadiness());
    expect(text).toContain(MVP_READINESS_BADGE);
    expect(text).toMatch(/MVP 100%/);
    expect(text).toMatch(/verdict: OK/);
    expect(text).toMatch(/9\/9 signals/);
    expect(text).toMatch(/next safe task:/);
  });
  it('is safe on null (renders a default run)', () => {
    expect(() => formatMvpReadiness(null)).not.toThrow();
    const text = formatMvpReadiness(null);
    expect(text).toContain(MVP_READINESS_BADGE);
  });
});

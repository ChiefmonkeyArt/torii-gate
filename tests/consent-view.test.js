// tests/consent-view.test.js — locks the CONSENT UX VIEW-MODEL foundation
// (src/engine/consent/consentView.js, CONSENT-2, v0.2.166). Proves the display
// layer over the v0.2.162 consent gate: per-action prompt copy for every write
// action + read/unknown fallbacks, read-vs-write severity, blocked-vs-allowed copy,
// malformed/unknown safety, no HTML/DOM injection, stable labels, no action methods,
// and SDK/debug exposure. Pure module → node-testable.
import { describe, it, expect } from 'vitest';
import {
  CONSENT_VIEW_VERSION, CONSENT_PROMPT_BADGE, CONSENT_SEVERITY, REASON_TEXT, ACTION_COPY,
  copyForAction, severityFor, consentPromptView, consentPromptRows,
} from '../src/engine/consent/consentView.js';
import { CONSENT_ACTIONS, CONSENT_REASON } from '../src/engine/consent/consentGate.js';
import * as SDK from '../src/sdk/index.js';

const WRITE_ACTIONS = ['gateway:travel', 'leaderboard:submit', 'profile:update', 'update:apply', 'nostr:publish'];
const READ_ACTIONS = ['leaderboard:read', 'profile:read', 'relay:read'];

describe('module shape', () => {
  it('pins a version + a clear preview badge', () => {
    expect(CONSENT_VIEW_VERSION).toBe(1);
    expect(CONSENT_PROMPT_BADGE).toBe('CONSENT · PREVIEW · NO ACTION');
    expect(Object.values(CONSENT_SEVERITY)).toEqual(['info', 'caution', 'danger']);
  });

  it('has UX copy for every write action in the registry', () => {
    for (const id of WRITE_ACTIONS) {
      expect(ACTION_COPY[id]).toBeTruthy();
      expect(typeof ACTION_COPY[id].headline).toBe('string');
      expect(ACTION_COPY[id].actionLabel.length).toBeGreaterThan(0);
      expect(ACTION_COPY[id].cancelLabel.length).toBeGreaterThan(0);
    }
  });

  it('has reason copy for every gate reason', () => {
    for (const reason of Object.values(CONSENT_REASON)) {
      expect(typeof REASON_TEXT[reason]).toBe('string');
      expect(REASON_TEXT[reason].length).toBeGreaterThan(0);
    }
  });
});

describe('copyForAction + severityFor', () => {
  it('returns the action copy for known write actions', () => {
    expect(copyForAction('gateway:travel', true)).toBe(ACTION_COPY['gateway:travel']);
  });

  it('falls back to read copy for read actions and unknown copy for write-unknowns', () => {
    expect(copyForAction('leaderboard:read', false).actionLabel).toBe('Continue');
    expect(copyForAction('nope:nope', true).headline).toBe('Unknown action');
  });

  it('maps severity from danger + requiresConsent', () => {
    expect(severityFor({ requiresConsent: false })).toBe('info');
    expect(severityFor({ requiresConsent: true, danger: 'high' })).toBe('danger');
    expect(severityFor({ requiresConsent: true, danger: 'low' })).toBe('caution');
    expect(severityFor(null)).toBe('info');
  });
});

describe('consentPromptView — write actions (blocked by default)', () => {
  for (const id of WRITE_ACTIONS) {
    it(`${id} is blocked with no grant, danger severity, never actionable`, () => {
      const v = consentPromptView(id);
      expect(v.action).toBe(id);
      expect(v.requiresExplicitConsent).toBe(true);
      expect(v.allowed).toBe(false);
      expect(v.blocked).toBe(true);
      expect(v.reason).toBe(CONSENT_REASON.CONSENT_REQUIRED);
      expect(v.severity).toBe('danger');
      expect(v.headline).toBe(ACTION_COPY[id].headline);
      expect(v.actionLabel).toBe(ACTION_COPY[id].actionLabel);
      // INERT invariants
      expect(v.performed).toBe(false);
      expect(v.actionable).toBe(false);
      expect(v.readOnly).toBe(true);
      // every body line is a {label,value} display row
      for (const row of v.bodyLines) {
        expect(typeof row.label).toBe('string');
        expect(typeof row.value).toBe('string');
      }
    });
  }

  it('shows ALLOWED copy with a matching grant but still performs nothing', () => {
    const v = consentPromptView('gateway:travel', true);
    expect(v.allowed).toBe(true);
    expect(v.blocked).toBe(false);
    expect(v.reason).toBe(CONSENT_REASON.CONSENT_GRANTED);
    expect(v.bodyLines.some((r) => r.value.includes('ALLOWED'))).toBe(true);
    expect(v.performed).toBe(false);
    expect(v.actionable).toBe(false);
  });

  it('honours a scoped matching grant and rejects a mismatched one', () => {
    const ok = consentPromptView('leaderboard:submit', { granted: true, action: 'leaderboard:submit' });
    expect(ok.allowed).toBe(true);
    expect(ok.reason).toBe(CONSENT_REASON.CONSENT_GRANTED);

    const mismatch = consentPromptView('leaderboard:submit', { granted: true, action: 'gateway:travel' });
    expect(mismatch.allowed).toBe(false);
    expect(mismatch.reason).toBe(CONSENT_REASON.CONSENT_MISMATCH);
    expect(mismatch.reasonText).toBe(REASON_TEXT[CONSENT_REASON.CONSENT_MISMATCH]);
  });
});

describe('consentPromptView — read actions', () => {
  for (const id of READ_ACTIONS) {
    it(`${id} is allowed read-only, info severity, no consent required`, () => {
      const v = consentPromptView(id);
      expect(v.allowed).toBe(true);
      expect(v.blocked).toBe(false);
      expect(v.requiresExplicitConsent).toBe(false);
      expect(v.reason).toBe(CONSENT_REASON.READ_ONLY);
      expect(v.severity).toBe('info');
      expect(v.headline).toBe('Read-only action');
      expect(v.performed).toBe(false);
    });
  }
});

describe('consentPromptView — malformed / unknown', () => {
  it('unknown action → blocked, info severity, safe headline', () => {
    const v = consentPromptView('nope:nope');
    expect(v.action).toBeNull();
    expect(v.blocked).toBe(true);
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe(CONSENT_REASON.UNKNOWN_ACTION);
    expect(v.headline).toBe('Unknown action');
    expect(v.actionable).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
  });

  it('malformed input never throws and yields a blocked view', () => {
    for (const bad of [null, undefined, 42, [], {}, { action: 123 }]) {
      const v = consentPromptView(bad);
      expect(v.blocked).toBe(true);
      expect(v.allowed).toBe(false);
      expect(v.performed).toBe(false);
    }
  });
});

describe('no DOM injection / HTML', () => {
  it('strips control chars + angle brackets from origin text', () => {
    const v = consentPromptView({ action: 'gateway:travel', origin: '<script>alert(1)</script>evil' });
    const originRow = v.bodyLines.find((r) => r.label === 'Requested by');
    expect(originRow).toBeTruthy();
    expect(originRow.value).not.toMatch(/[<>]/);
    expect(originRow.value).not.toMatch(/[\x00-\x1f\x7f]/);
  });

  it('no rendered string in any view contains HTML angle brackets', () => {
    const collect = (v) => [v.title, v.badge, v.headline, v.actionLabel, v.cancelLabel, v.reasonText, v.statusLine,
      ...v.bodyLines.flatMap((r) => [r.label, r.value])];
    for (const id of [...WRITE_ACTIONS, ...READ_ACTIONS, 'nope:nope']) {
      for (const s of collect(consentPromptView(id))) {
        expect(typeof s).toBe('string');
        expect(s).not.toMatch(/[<>]/);
      }
    }
  });
});

describe('stable labels + safety flags', () => {
  it('mirrors the gate write/signed/danger flags onto the view', () => {
    const v = consentPromptView('nostr:publish');
    expect(v.write).toBe(CONSENT_ACTIONS['nostr:publish'].write);
    expect(v.signed).toBe(CONSENT_ACTIONS['nostr:publish'].signed);
    expect(v.danger).toBe(CONSENT_ACTIONS['nostr:publish'].danger);
  });

  it('produces a stable statusLine string', () => {
    const a = consentPromptView('gateway:travel').statusLine;
    const b = consentPromptView('gateway:travel').statusLine;
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('consentPromptRows', () => {
  it('returns one inert row per known action, blocked-by-default for writes', () => {
    const rows = consentPromptRows();
    expect(rows.length).toBe(Object.keys(CONSENT_ACTIONS).length);
    for (const row of rows) {
      expect(row.actionable).toBe(false);
      const req = CONSENT_ACTIONS[row.action].requiresConsent;
      expect(row.requiresExplicitConsent).toBe(req);
      expect(row.allowed).toBe(!req);
    }
  });

  it('previews allowed writes under a grants map without performing anything', () => {
    const rows = consentPromptRows({ 'gateway:travel': true });
    const travel = rows.find((r) => r.action === 'gateway:travel');
    expect(travel.allowed).toBe(true);
    expect(travel.reason).toBe(CONSENT_REASON.CONSENT_GRANTED);
    expect(travel.actionable).toBe(false);
  });

  it('ignores a non-object grants argument', () => {
    expect(() => consentPromptRows('nope')).not.toThrow();
    expect(consentPromptRows(null).length).toBe(Object.keys(CONSENT_ACTIONS).length);
  });
});

describe('no action methods + SDK/debug exposure', () => {
  it('exposes NO confirm/sign/publish/send/connect/travel/apply function', () => {
    const mod = { CONSENT_VIEW_VERSION, CONSENT_PROMPT_BADGE, CONSENT_SEVERITY, REASON_TEXT, ACTION_COPY,
      copyForAction, severityFor, consentPromptView, consentPromptRows };
    const banned = /^(confirm|perform|sign|publish|send|connect|travel|navigate|goto|open|apply|submit|write|fetch|post)/i;
    for (const name of Object.keys(mod)) {
      if (typeof mod[name] === 'function') expect(name).not.toMatch(banned);
    }
  });

  it('is exported on the SDK as the consentView namespace', () => {
    expect(SDK.consentView).toBeTruthy();
    expect(typeof SDK.consentView.consentPromptView).toBe('function');
    expect(SDK.SDK_SURFACE.consentView.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
  });
});

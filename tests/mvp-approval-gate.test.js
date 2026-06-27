// tests/mvp-approval-gate.test.js — locks the PURE MVP approval gate module
// (src/engine/status/mvpApprovalGate.js, v0.2.234). Proves the APPROVAL-REQUIRES-EXPLICIT-OK floor
// (the gate verdict can read "approved" ONLY when the approval record carries approved===true with
// an approver + timestamp — green confidence signals NEVER flip it), the visible manual playtest
// focus + clarifications wording, the safety pins, the next-action fold, and the dashboard card.
import { describe, it, expect } from 'vitest';
import {
  MVP_GATE_LIVE_URL, MVP_GATE_DASHBOARD_URL, MVP_APPROVAL_GATE_BADGE,
  MVP_PLAYTEST_FOCUS, MVP_GATE_CLARIFICATIONS, MVP_GATE_VERDICTS,
  buildMvpApprovalGate, validateMvpApprovalGate, isMvpGateApproved,
  MVP_APPROVAL_GATE_REQUIRED_KEYS, summarizeMvpApprovalGateForState,
  buildMvpApprovalGateCard,
} from '../src/engine/status/mvpApprovalGate.js';
import { VERSION } from '../src/config.js';

// Confidence-green, approval-pending input — the expected pre-sign-off posture.
function awaitingInput(overrides = {}) {
  return {
    version: VERSION,
    releaseReady: true,
    entrySmokePass: true,
    dashboardSmokePass: true,
    tests: { passing: 1600, files: 96 },
    approval: { approved: false, status: 'pending' },
    ...overrides,
  };
}

// A legitimately approved input — explicit human OK with approver + timestamp.
function approvedInput(overrides = {}) {
  return awaitingInput({
    approval: { approved: true, status: 'approved', approvedBy: 'Chiefmonkey', approvedAt: '2026-06-27T12:00:00Z' },
    ...overrides,
  });
}

describe('shape + required keys', () => {
  it('buildMvpApprovalGate never omits the required keys, even with no input', () => {
    const gate = buildMvpApprovalGate();
    for (const k of MVP_APPROVAL_GATE_REQUIRED_KEYS) expect(gate).toHaveProperty(k);
    expect(gate.badge).toBe(MVP_APPROVAL_GATE_BADGE);
  });

  it('defaults to the curated live + dashboard URLs and the curated focus + clarifications', () => {
    const gate = buildMvpApprovalGate();
    expect(gate.liveUrl).toBe(MVP_GATE_LIVE_URL);
    expect(gate.dashboardUrl).toBe(MVP_GATE_DASHBOARD_URL);
    expect(gate.playtestFocus).toEqual(Array.from(MVP_PLAYTEST_FOCUS));
    expect(gate.clarifications).toEqual(Array.from(MVP_GATE_CLARIFICATIONS));
  });

  it('pins every safety flag false (including impliesApproval + impliesPlaytestComplete)', () => {
    const s = buildMvpApprovalGate().safety;
    for (const k of ['deploy', 'publish', 'push', 'tag', 'networkWrite', 'nostrWrite', 'godMode',
      'impliesApproval', 'impliesPlaytestComplete']) {
      expect(s[k]).toBe(false);
    }
  });

  it('carries the manual playtest focus categories required for sign-off', () => {
    const focus = MVP_PLAYTEST_FOCUS.join(' | ').toLowerCase();
    for (const term of ['entry flow', 'shooter feel', 'headshot', 'bot behaviour', 'footstep',
      'reload', 'mirror', 'crate', 'nap monkey', 'dashboard clarity', 'fun']) {
      expect(focus).toContain(term);
    }
  });
});

describe('approval-requires-explicit-OK floor', () => {
  it('confidence-green + approval-pending → verdict awaiting-approval, NOT approved', () => {
    const gate = buildMvpApprovalGate(awaitingInput());
    expect(gate.confidenceGreen).toBe(true);
    expect(gate.verdict).toBe(MVP_GATE_VERDICTS.AWAITING_APPROVAL);
    expect(isMvpGateApproved(gate)).toBe(false);
    expect(validateMvpApprovalGate(gate).ok).toBe(true);
  });

  it('a forged "approved" verdict without an explicit OK is a validator ERROR', () => {
    const gate = { ...buildMvpApprovalGate(awaitingInput()), verdict: MVP_GATE_VERDICTS.APPROVED };
    const v = validateMvpApprovalGate(gate);
    expect(v.ok).toBe(false);
    expect(isMvpGateApproved(gate)).toBe(false);
    expect(v.errors.join(' ')).toMatch(/approved.*requires|explicit human OK/i);
  });

  it('approval.approved true while verdict is not "approved" is a validator ERROR (must agree)', () => {
    const gate = { ...buildMvpApprovalGate(awaitingInput()),
      approval: { approved: true, status: 'approved', approvedBy: 'X', approvedAt: 'Y' } };
    // verdict still awaiting-approval (forced disagreement)
    expect(validateMvpApprovalGate(gate).ok).toBe(false);
  });

  it('an explicit OK with approver + timestamp → verdict approved + isMvpGateApproved true', () => {
    const gate = buildMvpApprovalGate(approvedInput());
    expect(gate.verdict).toBe(MVP_GATE_VERDICTS.APPROVED);
    expect(validateMvpApprovalGate(gate).ok).toBe(true);
    expect(isMvpGateApproved(gate)).toBe(true);
  });

  it('an "approved" status missing approver/timestamp cannot read approved', () => {
    const gate = buildMvpApprovalGate(awaitingInput({
      approval: { approved: true, status: 'approved' }, // no approvedBy/approvedAt
    }));
    // builder set verdict approved (approved flag true), but validator rejects missing provenance
    expect(gate.verdict).toBe(MVP_GATE_VERDICTS.APPROVED);
    expect(validateMvpApprovalGate(gate).ok).toBe(false);
    expect(isMvpGateApproved(gate)).toBe(false);
  });

  it('incomplete confidence signals → verdict signals-incomplete (still not approved)', () => {
    const gate = buildMvpApprovalGate(awaitingInput({ dashboardSmokePass: false }));
    expect(gate.confidenceGreen).toBe(false);
    expect(gate.verdict).toBe(MVP_GATE_VERDICTS.SIGNALS_INCOMPLETE);
    expect(isMvpGateApproved(gate)).toBe(false);
  });
});

describe('next-action fold', () => {
  it('summarizeMvpApprovalGateForState reports verdict, confidence, and pinned implies-false', () => {
    const sum = summarizeMvpApprovalGateForState(buildMvpApprovalGate(awaitingInput()));
    expect(sum.verdict).toBe(MVP_GATE_VERDICTS.AWAITING_APPROVAL);
    expect(sum.approved).toBe(false);
    expect(sum.confidenceGreen).toBe(true);
    expect(sum.focusCount).toBe(MVP_PLAYTEST_FOCUS.length);
    expect(sum.impliesApproval).toBe(false);
    expect(sum.impliesPlaytestComplete).toBe(false);
  });

  it('summarize is null-safe and reports approved:false on garbage', () => {
    const sum = summarizeMvpApprovalGateForState(null);
    expect(sum.approved).toBe(false);
    expect(sum.verdict).toBe('unknown');
  });
});

describe('dashboard card', () => {
  it('pending gate → manual pill; the card surfaces the focus + clarifications', () => {
    const card = buildMvpApprovalGateCard(buildMvpApprovalGate(awaitingInput()));
    expect(card.pill).toBe('manual');
    expect(card.approved).toBe(false);
    const blob = card.metrics.map((m) => `${m.label} ${m.value}`).join(' ').toLowerCase();
    expect(blob).toContain('confidence only, not approval');
    expect(blob).toContain('explicit');
    expect(blob).toContain('nap monkey');
  });

  it('approved gate → no-blocker pill and APPROVED verdict', () => {
    const card = buildMvpApprovalGateCard(buildMvpApprovalGate(approvedInput()));
    expect(card.pill).toBe('no-blocker');
    expect(card.approved).toBe(true);
  });

  it('the card note never implies approval or a completed playtest from green checks', () => {
    const card = buildMvpApprovalGateCard(buildMvpApprovalGate(awaitingInput()));
    expect(card.note.toLowerCase()).toContain('not that');
    expect(card.note.toLowerCase()).toContain('smoke pass is not approval');
  });
});

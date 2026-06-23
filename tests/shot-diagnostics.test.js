// tests/shot-diagnostics.test.js — pure shot-outcome / miss-reason classifier.
// Node env, no Three/Rapier/browser. Covers every SHOT_REASON branch plus the
// block-vs-sail-past distance discrimination.
import { describe, it, expect } from 'vitest';
import {
  SHOT_REASON, BLOCK_SLACK, reasonLabel, classifyShotOutcome,
} from '../src/engine/combat/shotDiagnostics.js';

const bot  = (isHead, dist = 10) => ({ kind: 'bot', isHead, dist });
const wall = (dist) => ({ kind: 'wall', isHead: false, dist });
const none = () => ({ kind: 'none', isHead: false, dist: Infinity });

describe('classifyShotOutcome — hits', () => {
  it('bullet on head → HEAD regardless of where aim was', () => {
    expect(classifyShotOutcome(bot(true), bot(true)).reason).toBe(SHOT_REASON.HEAD);
    expect(classifyShotOutcome(bot(false), bot(true)).reason).toBe(SHOT_REASON.HEAD);
    expect(classifyShotOutcome(none(), bot(true)).reason).toBe(SHOT_REASON.HEAD);
  });

  it('aimed body, hit body → BODY', () => {
    expect(classifyShotOutcome(bot(false), bot(false)).reason).toBe(SHOT_REASON.BODY);
  });

  it('aimed head, hit body → HEAD_TO_BODY (the dropped-headshot signature)', () => {
    expect(classifyShotOutcome(bot(true), bot(false)).reason).toBe(SHOT_REASON.HEAD_TO_BODY);
  });

  it('not aimed at a bot but still tagged a body hit → BODY (no head intent)', () => {
    expect(classifyShotOutcome(none(), bot(false)).reason).toBe(SHOT_REASON.BODY);
    expect(classifyShotOutcome(wall(5), bot(false)).reason).toBe(SHOT_REASON.BODY);
  });
});

describe('classifyShotOutcome — misses', () => {
  it('crosshair off any bot → AIM_OFF', () => {
    expect(classifyShotOutcome(none(), none()).reason).toBe(SHOT_REASON.AIM_OFF);
    expect(classifyShotOutcome(wall(8), wall(8)).reason).toBe(SHOT_REASON.AIM_OFF);
    expect(classifyShotOutcome(none(), wall(8)).reason).toBe(SHOT_REASON.AIM_OFF);
  });

  it('aimed at a bot, bullet hit closer geometry → BLOCKED', () => {
    // aim bot at 20 m, wall at 5 m (well inside BLOCK_SLACK margin)
    expect(classifyShotOutcome(bot(false, 20), wall(5)).reason).toBe(SHOT_REASON.BLOCKED);
  });

  it('aimed at a bot, bullet sailed past into far geometry → MOVED_OR_OFFSET', () => {
    // wall is BEYOND the aimed bot — not a block, the bullet went wide/long
    expect(classifyShotOutcome(bot(false, 20), wall(40)).reason).toBe(SHOT_REASON.MOVED_OR_OFFSET);
  });

  it('aimed at a bot, bullet hit nothing → MOVED_OR_OFFSET', () => {
    expect(classifyShotOutcome(bot(true, 45), none()).reason).toBe(SHOT_REASON.MOVED_OR_OFFSET);
  });

  it('geometry only marginally closer than the bot (within slack) is NOT a block', () => {
    const aimDist = 10;
    const within = aimDist - BLOCK_SLACK / 2; // closer, but inside the slack band
    expect(classifyShotOutcome(bot(false, aimDist), wall(within)).reason)
      .toBe(SHOT_REASON.MOVED_OR_OFFSET);
  });
});

describe('labels', () => {
  it('every reason resolves to a non-empty human label', () => {
    for (const r of Object.values(SHOT_REASON)) {
      expect(typeof reasonLabel(r)).toBe('string');
      expect(reasonLabel(r).length).toBeGreaterThan(0);
    }
  });

  it('classifyShotOutcome returns the matching label', () => {
    const { reason, label } = classifyShotOutcome(bot(true), bot(true));
    expect(label).toBe(reasonLabel(reason));
  });

  it('unknown reason → fallback label', () => {
    expect(reasonLabel('nope')).toBe('Unknown.');
  });
});

describe('robustness', () => {
  it('tolerates missing/partial inputs', () => {
    expect(classifyShotOutcome(undefined, undefined).reason).toBe(SHOT_REASON.AIM_OFF);
    expect(classifyShotOutcome(null, bot(true)).reason).toBe(SHOT_REASON.HEAD);
  });
});

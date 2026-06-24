// tests/mvp-loop.test.js — MVP loop header block (mvpLoop.js, v0.2.143). Asserts
// the four title-screen PoC preview cards are framed as one ordered loop —
// Travel → Market → Score → Update — that the header is render-ready, carries an
// explicit PREVIEW/READ-ONLY/MANUAL badge, and is inert: actionable:false /
// readOnly:true, never exposing a navigate/fetch/sign/publish/update action.
import { describe, it, expect } from 'vitest';
import {
  mvpLoopSummary, MVP_LOOP_STEPS, MVP_LOOP_FLOW, MVP_LOOP_BADGE,
} from '../src/engine/mvpLoop.js';
import { VERSION } from '../src/config.js';
import * as SDK from '../src/sdk/index.js';

describe('MVP loop steps', () => {
  it('defines four ordered, frozen steps Travel/Market/Score/Update', () => {
    expect(Object.isFrozen(MVP_LOOP_STEPS)).toBe(true);
    expect(MVP_LOOP_STEPS.map((s) => s.step)).toEqual(['TRAVEL', 'MARKET', 'SCORE', 'UPDATE']);
    expect(MVP_LOOP_STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4]);
    expect(MVP_LOOP_STEPS.map((s) => s.lean)).toEqual(['LEAN-2', 'LEAN-3', 'LEAN-4', 'LEAN-5']);
  });

  it('exposes a title-cased flow string', () => {
    expect(MVP_LOOP_FLOW).toBe('Travel → Market → Score → Update');
  });
});

describe('mvpLoopSummary', () => {
  it('produces an inert, render-ready header block', () => {
    const b = mvpLoopSummary();
    expect(b.title).toBe('TORII QUEST · MVP LOOP');
    expect(b.badge).toBe(MVP_LOOP_BADGE);
    expect(b.flow).toBe(MVP_LOOP_FLOW);
    expect(b.actionable).toBe(false);
    expect(b.readOnly).toBe(true);
    expect(typeof b.note).toBe('string');
    expect(b.note.length).toBeGreaterThan(0);
  });

  it('orders lines "1 · TRAVEL".."4 · UPDATE" mapped to their cards', () => {
    const b = mvpLoopSummary();
    expect(b.lines.map((l) => l.label)).toEqual(['1 · TRAVEL', '2 · MARKET', '3 · SCORE', '4 · UPDATE']);
    expect(b.lines.map((l) => l.value)).toEqual(['Gateway', 'Product', 'Leaderboard', 'Update check']);
  });

  it('defaults version to the runtime VERSION and honours an override', () => {
    expect(mvpLoopSummary().version).toBe(VERSION);
    expect(mvpLoopSummary({ currentVersion: 'v9.9.9-test' }).version).toBe('v9.9.9-test');
  });

  it('never exposes a navigate/fetch/sign/publish/update action key', () => {
    const b = mvpLoopSummary();
    for (const key of ['fetch', 'navigate', 'href', 'onClick', 'sign', 'publish', 'update', 'checkout']) {
      expect(b).not.toHaveProperty(key);
    }
  });
});

describe('SDK exposure', () => {
  it('exposes mvpLoop at the experimental tier', () => {
    expect(SDK.SDK_SURFACE.mvpLoop.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
    expect(typeof SDK.mvpLoop.mvpLoopSummary).toBe('function');
  });
});

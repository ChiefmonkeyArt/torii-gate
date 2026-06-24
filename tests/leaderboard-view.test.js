// tests/leaderboard-view.test.js — read-only leaderboard display shell
// (leaderboardView.js, v0.2.136). Asserts deterministic ranking, build/mock-only
// modes, and a build-only preview that never signs or publishes.
import { describe, it, expect } from 'vitest';
import {
  leaderboardView, rankScores, accuracyLabel, leaderboardPreview, VIEW_MODES,
} from '../src/engine/nostr/leaderboardView.js';
import { LEADERBOARD_KIND } from '../src/engine/nostr/leaderboard.js';
import * as SDK from '../src/sdk/index.js';

const scores = [
  { runId: 'r-a', score: 100, kills: 5, headshots: 2, accuracy: 0.5 },
  { runId: 'r-b', score: 300, kills: 9, headshots: 4, accuracy: 0.734 },
  { runId: 'r-c', score: 300, kills: 9, headshots: 6, accuracy: 0.9 }, // ties r-b on score+kills, more HS
  { runId: 'r-bad', score: -1, kills: 0, headshots: 0, accuracy: 0.1 }, // invalid (negative score)
];

describe('leaderboardView — accuracyLabel', () => {
  it('formats a fraction as a percentage', () => {
    expect(accuracyLabel(0.734)).toBe('73.4%');
    expect(accuracyLabel(1)).toBe('100.0%');
    expect(accuracyLabel(NaN)).toBe('0.0%');
  });
});

describe('leaderboardView — rankScores', () => {
  it('ranks deterministically (score, then kills, then headshots)', () => {
    const { rows, skipped } = rankScores(scores);
    expect(rows.map((r) => r.runId)).toEqual(['r-c', 'r-b', 'r-a']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(rows[0].accuracyLabel).toBe('90.0%');
    expect(skipped.map((s) => s.runId)).toEqual(['r-bad']);
  });

  it('is safe on a non-array', () => {
    expect(rankScores(null)).toEqual({ rows: [], skipped: [] });
  });
});

describe('leaderboardView — view model + modes', () => {
  it('defaults to mock mode and reports counts', () => {
    const view = leaderboardView(scores);
    expect(view.mode).toBe('mock');
    expect(view.count).toBe(3);
    expect(view.skipped.length).toBe(1);
  });

  it('accepts the build mode', () => {
    expect(leaderboardView(scores, { mode: 'build' }).mode).toBe('build');
    expect(VIEW_MODES).toEqual(['mock', 'build']);
  });

  it('rejects any non-mock/build mode (no live/relay mode)', () => {
    expect(() => leaderboardView(scores, { mode: 'live' })).toThrow();
  });
});

describe('leaderboardView — build-only preview', () => {
  it('returns unsigned templates and never signs or publishes', async () => {
    const preview = await leaderboardPreview(scores);
    expect(preview.mode).toBe('build');
    expect(preview.signed).toBe(false);
    expect(preview.published).toBe(false);
    const okEntries = preview.entries.filter((e) => e.ok);
    expect(okEntries.length).toBe(3);
    for (const e of okEntries) {
      expect(e.template.kind).toBe(LEADERBOARD_KIND);
      expect(e.template).not.toHaveProperty('sig');
      expect(e.template).not.toHaveProperty('pubkey');
    }
    // invalid score captured, not thrown
    const bad = preview.entries.find((e) => !e.ok);
    expect(bad.runId).toBe('r-bad');
    expect(bad.errors.length).toBeGreaterThan(0);
  });
});

describe('leaderboardView — SDK exposure', () => {
  it('is re-exported at the experimental tier', () => {
    expect(typeof SDK.leaderboardView.leaderboardView).toBe('function');
    expect(SDK.SDK_SURFACE.leaderboardView.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
  });
});

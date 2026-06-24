// tests/leaderboard-preview.test.js — local/mock leaderboard PREVIEW block
// (leaderboardPreview.js, LEAN-4, v0.2.141). Asserts the block is render-ready,
// ranks scores deterministically, surfaces the Nostr score-event proof shape +
// npub identity flavour, carries an explicit LOCAL-MOCK/NO-PUBLISH badge, and is
// inert: signed:false / published:false / actionable:false, never exposing a
// signing/publishing/submitting action.
import { describe, it, expect } from 'vitest';
import {
  leaderboardPreviewBlock, formatRankRow, modeLabel, shortNpub,
  LEADERBOARD_PREVIEW_BADGE, LEADERBOARD_TOPIC,
} from '../src/engine/nostr/leaderboardPreview.js';
import { LEADERBOARD_KIND } from '../src/engine/nostr/leaderboard.js';
import * as SDK from '../src/sdk/index.js';

const SCORES = Object.freeze([
  { runId: 'run-a', score: 120, kills: 12, headshots: 5, accuracy: 0.62 },
  { runId: 'run-b', score: 240, kills: 20, headshots: 11, accuracy: 0.71 },
  { runId: 'run-c', score: 90, kills: 9, headshots: 2, accuracy: 0.5 },
]);
const NPUB = 'npub1demo0player0fixture0torii0quest0xxxxxxxxxxxxxxxxxxxx';

describe('shortNpub', () => {
  it('truncates a long npub with an ellipsis and keeps it short', () => {
    const s = shortNpub(NPUB);
    expect(s.length).toBeLessThan(NPUB.length);
    expect(s).toContain('…');
    expect(s.startsWith('npub1demo0pl')).toBe(true);
  });
  it('is safe on non-strings and returns short keys unchanged', () => {
    expect(shortNpub(null)).toBe('');
    expect(shortNpub(undefined)).toBe('');
    expect(shortNpub('npub1abc')).toBe('npub1abc');
  });
});

describe('modeLabel', () => {
  it('maps known modes and upper-cases unknowns', () => {
    expect(modeLabel('mock')).toBe('LOCAL MOCK');
    expect(modeLabel('build')).toBe('BUILD ONLY');
    expect(modeLabel('weird')).toBe('WEIRD');
    expect(modeLabel()).toBe('UNKNOWN');
  });
});

describe('formatRankRow', () => {
  it('renders a compact ranked label/value row', () => {
    const row = { rank: 1, runId: 'run-b', score: 240, kills: 20, headshots: 11, accuracyLabel: '71.0%' };
    expect(formatRankRow(row)).toEqual({
      label: '#1',
      value: 'run-b · 240 pts · 20k/11hs · 71.0%',
    });
  });
});

describe('leaderboardPreviewBlock', () => {
  it('produces an inert, ranked, local-mock block', () => {
    const b = leaderboardPreviewBlock(SCORES, { signerNpub: NPUB });
    expect(b.title).toBe('LEADERBOARD PREVIEW');
    expect(b.mode).toBe('mock');
    expect(b.modeLabel).toBe('LOCAL MOCK');
    expect(b.badge).toBe(LEADERBOARD_PREVIEW_BADGE);
    expect(b.signed).toBe(false);
    expect(b.published).toBe(false);
    expect(b.actionable).toBe(false);
    expect(b.readOnly).toBe(true);
    expect(b.count).toBe(3);
    expect(b.shown).toBe(3);
    expect(b.skipped).toBe(0);
  });

  it('ranks deterministically by score desc (run-b first)', () => {
    const b = leaderboardPreviewBlock(SCORES);
    expect(b.rows.map((r) => r.runId)).toEqual(['run-b', 'run-a', 'run-c']);
    expect(b.rows[0].rank).toBe(1);
  });

  it('surfaces the Nostr score-event proof shape (display only)', () => {
    const b = leaderboardPreviewBlock(SCORES);
    expect(b.proof).toEqual({ kind: LEADERBOARD_KIND, topic: LEADERBOARD_TOPIC });
    const eventLine = b.lines.find((l) => l.label === 'Event');
    expect(eventLine.value).toBe(`kind ${LEADERBOARD_KIND} · #${LEADERBOARD_TOPIC}`);
  });

  it('orders lines: Mode, Signer, Status, Event, then ranked rows', () => {
    const b = leaderboardPreviewBlock(SCORES, { signerNpub: NPUB });
    expect(b.lines.slice(0, 4).map((l) => l.label)).toEqual(['Mode', 'Signer', 'Status', 'Event']);
    expect(b.lines.slice(4).map((l) => l.label)).toEqual(['#1', '#2', '#3']);
    expect(b.lines[2].value).toBe('UNSIGNED · NOT PUBLISHED');
  });

  it('shows the npub identity flavour shortened; defaults to dash', () => {
    const withNpub = leaderboardPreviewBlock(SCORES, { signerNpub: NPUB });
    expect(withNpub.signerFull).toBe(NPUB);
    expect(withNpub.signer).toContain('…');
    const none = leaderboardPreviewBlock(SCORES);
    expect(none.signerFull).toBeNull();
    expect(none.signer).toBe('—');
  });

  it('caps the displayed ranked rows by limit but counts all valid scores', () => {
    const b = leaderboardPreviewBlock(SCORES, { limit: 2 });
    expect(b.count).toBe(3);
    expect(b.shown).toBe(2);
    expect(b.rows).toHaveLength(2);
    expect(b.lines.filter((l) => l.label.startsWith('#'))).toHaveLength(2);
  });

  it('degrades on empty scores without throwing', () => {
    const b = leaderboardPreviewBlock([]);
    expect(b.count).toBe(0);
    expect(b.shown).toBe(0);
    expect(b.lines.find((l) => l.label === 'Scores').value).toBe('NO LOCAL SCORES');
    expect(b.signed).toBe(false);
    expect(b.published).toBe(false);
  });

  it('drops invalid scores into skipped, never throws', () => {
    const mixed = [
      { runId: 'good', score: 50, kills: 5, headshots: 1, accuracy: 0.4 },
      { runId: 'bad', score: -1, kills: 2, headshots: 9, accuracy: 5 },
    ];
    const b = leaderboardPreviewBlock(mixed);
    expect(b.count).toBe(1);
    expect(b.skipped).toBe(1);
    expect(b.rows[0].runId).toBe('good');
  });

  it('never exposes a signing/publishing/submitting action key', () => {
    const b = leaderboardPreviewBlock(SCORES, { signerNpub: NPUB });
    for (const key of ['sign', 'publish', 'submit', 'relay', 'href', 'onClick', 'navigate']) {
      expect(b).not.toHaveProperty(key);
    }
  });
});

describe('SDK exposure', () => {
  it('exposes leaderboardPreview at the experimental tier', () => {
    expect(SDK.SDK_SURFACE.leaderboardPreview.tier).toBe(SDK.STABILITY.EXPERIMENTAL);
    expect(typeof SDK.leaderboardPreview.leaderboardPreviewBlock).toBe('function');
  });
});

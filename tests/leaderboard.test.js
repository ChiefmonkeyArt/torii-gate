// tests/leaderboard.test.js — locks the pure Nostr leaderboard score-event
// helpers (LB-1 skeleton, src/engine/nostr/leaderboard.js). Build + validate the
// CONTENT + TAGS of an unsigned run-score event. NO signing / relay / publish.
// Pure module → node-testable.
import { describe, it, expect } from 'vitest';
import {
  LEADERBOARD_KIND, SCORE_FIELDS,
  buildScore, validateScore, buildScoreEventTemplate,
} from '../src/engine/nostr/leaderboard.js';
import { VERSION } from '../src/config.js';

describe('buildScore — normalisation', () => {
  it('defaults counters to 0 and version to the build VERSION', () => {
    const s = buildScore({ runId: 'r1' });
    expect(s).toEqual({
      runId: 'r1', score: 0, kills: 0, headshots: 0, accuracy: 0, version: VERSION,
    });
  });
  it('SCORE_FIELDS documents the leaderboard schema', () => {
    expect(SCORE_FIELDS).toEqual(['runId', 'score', 'kills', 'headshots', 'accuracy', 'version']);
  });
});

describe('validateScore', () => {
  const ok = { runId: 'r1', score: 100, kills: 10, headshots: 4, accuracy: 0.5, version: VERSION };
  it('accepts a well-formed score', () => {
    expect(validateScore(ok).valid).toBe(true);
  });
  it('requires a runId', () => {
    const r = validateScore({ ...ok, runId: null });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/runId/);
  });
  it('rejects negative / non-integer counters', () => {
    expect(validateScore({ ...ok, kills: -1 }).valid).toBe(false);
    expect(validateScore({ ...ok, score: 1.5 }).valid).toBe(false);
  });
  it('rejects headshots exceeding kills', () => {
    const r = validateScore({ ...ok, kills: 2, headshots: 3 });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/headshots/);
  });
  it('rejects accuracy outside [0,1]', () => {
    expect(validateScore({ ...ok, accuracy: 1.2 }).valid).toBe(false);
    expect(validateScore({ ...ok, accuracy: -0.1 }).valid).toBe(false);
  });
  it('never throws on junk input', () => {
    expect(validateScore(null).valid).toBe(false);
    expect(validateScore(42).valid).toBe(false);
  });
});

describe('buildScoreEventTemplate', () => {
  it('produces an unsigned event template with kind, JSON content, and tags', () => {
    const tmpl = buildScoreEventTemplate({
      runId: 'r1', score: 100, kills: 10, headshots: 4, accuracy: 0.5,
    });
    expect(tmpl.kind).toBe(LEADERBOARD_KIND);
    expect(JSON.parse(tmpl.content)).toMatchObject({ runId: 'r1', score: 100, kills: 10 });
    // no signing fields present
    expect(tmpl.pubkey).toBeUndefined();
    expect(tmpl.sig).toBeUndefined();
    expect(tmpl.id).toBeUndefined();
  });
  it('mirrors key fields into indexable tags incl. the d/run identifier', () => {
    const tmpl = buildScoreEventTemplate({ runId: 'r1', score: 100, kills: 10, headshots: 4, accuracy: 0.5 });
    const tagMap = Object.fromEntries(tmpl.tags.map(([k, v]) => [k, v]));
    expect(tagMap.d).toBe('r1');
    expect(tagMap.score).toBe('100');
    expect(tagMap.kills).toBe('10');
    expect(tagMap.accuracy).toBe('0.5000');
    expect(tagMap.t).toBe('torii-quest');
  });
  it('throws on an invalid score (fails fast before publish)', () => {
    expect(() => buildScoreEventTemplate({ score: 1 })).toThrow(/runId/);
    expect(() => buildScoreEventTemplate({ runId: 'r', kills: 1, headshots: 2 })).toThrow(/headshots/);
  });
});

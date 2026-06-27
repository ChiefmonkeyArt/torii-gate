// tests/playtest-verdict.test.js — locks the PURE MVP playtest-verdict module
// (src/engine/status/playtestVerdict.js, v0.2.235). Proves the one-line capture parses "MVP OK" /
// "blockers: …" into a structured verdict, that every reported blocker stays VISIBLE in the state +
// card, and the HARD INVARIANT: a tester verdict NEVER implies MVP approval (approvalImplied pinned
// false in every branch) — approval stays the separate explicit user gate.
import { describe, it, expect } from 'vitest';
import {
  PLAYTEST_VERDICT_SCHEMA, PLAYTEST_VERDICT_BADGE, PLAYTEST_VERDICT_FILE,
  PLAYTEST_VERDICTS, PLAYTEST_VERDICT_HOWTO, PLAYTEST_VERDICT_REQUIRED_KEYS,
  parsePlaytestVerdict, summarizePlaytestVerdictForState, buildPlaytestVerdictCard,
} from '../src/engine/status/playtestVerdict.js';

describe('parsePlaytestVerdict', () => {
  it('a blank / missing file is pending with no blockers', () => {
    for (const t of ['', '   ', null, undefined, '# heading only\nno verdict here']) {
      const p = parsePlaytestVerdict(t);
      expect(p.verdict).toBe(PLAYTEST_VERDICTS.PENDING);
      expect(p.blockers).toEqual([]);
    }
  });

  it('recognises an MVP OK line (and synonyms)', () => {
    for (const line of ['Verdict: MVP OK', 'Verdict: ok', 'Verdict: no blockers', 'Verdict: all pass', '- **Verdict:** clean']) {
      expect(parsePlaytestVerdict(line).verdict).toBe(PLAYTEST_VERDICTS.OK);
    }
  });

  it('parses a blockers list into a clean array', () => {
    const p = parsePlaytestVerdict('Verdict: blockers: headshots inconsistent; NAP monkey chases past gate, reload feels slow');
    expect(p.verdict).toBe(PLAYTEST_VERDICTS.BLOCKED);
    expect(p.blockers).toEqual([
      'headshots inconsistent', 'NAP monkey chases past gate', 'reload feels slow',
    ]);
  });

  it('an empty blockers list degrades to pending (nothing reported yet)', () => {
    expect(parsePlaytestVerdict('Verdict: blockers:').verdict).toBe(PLAYTEST_VERDICTS.PENDING);
  });

  it('captures reported-by / date metadata regardless of line order', () => {
    const p = parsePlaytestVerdict('Verdict: MVP OK\nReported by: Chiefmonkey\nDate: 2026-06-27');
    expect(p.reportedBy).toBe('Chiefmonkey');
    expect(p.reportedAt).toBe('2026-06-27');
  });

  it('the first recognised verdict line wins', () => {
    const p = parsePlaytestVerdict('Verdict: blockers: a, b\nVerdict: MVP OK');
    expect(p.verdict).toBe(PLAYTEST_VERDICTS.BLOCKED);
    expect(p.blockers).toEqual(['a', 'b']);
  });

  it('tolerates markdown table cells (| Verdict | MVP OK |)', () => {
    expect(parsePlaytestVerdict('| Verdict | MVP OK |').verdict).toBe(PLAYTEST_VERDICTS.OK);
  });
});

describe('summarizePlaytestVerdictForState', () => {
  it('never omits the required keys and pins approvalImplied false', () => {
    for (const t of ['', 'Verdict: MVP OK', 'Verdict: blockers: x, y']) {
      const s = summarizePlaytestVerdictForState(t);
      for (const k of PLAYTEST_VERDICT_REQUIRED_KEYS) expect(s).toHaveProperty(k);
      expect(s.approvalImplied).toBe(false);
      expect(s.schema).toBe(PLAYTEST_VERDICT_SCHEMA);
      expect(s.badge).toBe(PLAYTEST_VERDICT_BADGE);
    }
  });

  it('MVP OK reports ok + reported true, but still implies no approval', () => {
    const s = summarizePlaytestVerdictForState('Verdict: MVP OK');
    expect(s.verdict).toBe(PLAYTEST_VERDICTS.OK);
    expect(s.reported).toBe(true);
    expect(s.approvalImplied).toBe(false);
  });

  it('keeps every reported blocker visible with a count', () => {
    const s = summarizePlaytestVerdictForState('Verdict: blockers: a, b, c');
    expect(s.verdict).toBe(PLAYTEST_VERDICTS.BLOCKED);
    expect(s.blockerCount).toBe(3);
    expect(s.blockers).toEqual(['a', 'b', 'c']);
  });

  it('accepts a parse result as well as raw text', () => {
    const s = summarizePlaytestVerdictForState(parsePlaytestVerdict('Verdict: MVP OK'));
    expect(s.verdict).toBe(PLAYTEST_VERDICTS.OK);
  });

  it('the canonical capture filename is exported', () => {
    expect(PLAYTEST_VERDICT_FILE).toBe('MVP_PLAYTEST_VERDICT.md');
  });
});

describe('buildPlaytestVerdictCard', () => {
  it('pending → manual pill, no blockers', () => {
    const c = buildPlaytestVerdictCard('');
    expect(c.verdict).toBe(PLAYTEST_VERDICTS.PENDING);
    expect(c.pill).toBe('manual');
    expect(c.kind).toBe('last-known');
  });

  it('blocked → open-edge pill so blockers can never be hidden, listed in a metric', () => {
    const c = buildPlaytestVerdictCard('Verdict: blockers: headshots flaky; crate jitter');
    expect(c.pill).toBe('open-edge');
    expect(c.blockerCount).toBe(2);
    const blockerMetric = c.metrics.find((m) => m.label === 'Blockers');
    expect(blockerMetric.value).toContain('headshots flaky');
    expect(blockerMetric.value).toContain('crate jitter');
  });

  it('ok → manual pill, and the card states it implies NO approval', () => {
    const c = buildPlaytestVerdictCard('Verdict: MVP OK');
    expect(c.pill).toBe('manual');
    const implies = c.metrics.find((m) => m.label === 'Implies approval');
    expect(implies.value).toMatch(/NO/);
    expect(c.note).toMatch(/NOT MVP approval|not MVP approval|approves\/releases\/deploys\/publishes NOTHING/i);
  });

  it('surfaces the one-line how-to so reporting is obvious', () => {
    const c = buildPlaytestVerdictCard('');
    const howto = c.metrics.find((m) => m.label === 'How to report');
    for (const h of PLAYTEST_VERDICT_HOWTO) expect(howto.value).toContain(h);
  });
});

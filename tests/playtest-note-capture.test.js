// tests/playtest-note-capture.test.js — pure MVP PLAYTEST NOTE-CAPTURE explainer
// (tools/playtestNoteCapture.mjs, v0.2.224). Covers explainPlaytestCapture (field-completeness on
// top of the canonical parser/state: recorded vs. blank items, per-FAIL missing follow-up fields,
// build/session header blanks, the note→result mapping legend), the shipped-default not-run
// posture, the HARD invariant that the explainer NEVER implies approval, and the text formatter.
// Pure — no fs/network (the committed-artifact posture is already covered by the state test).
import { describe, it, expect } from 'vitest';
import {
  PLAYTEST_NOTE_CAPTURE_SCHEMA, PLAYTEST_NOTE_CAPTURE_SCHEMA_VERSION,
  PLAYTEST_NOTE_CAPTURE_BADGE, CAPTURE_FOLLOWUP_FIELDS,
  explainPlaytestCapture, formatPlaytestCaptureExplain, safeRepoRelPath,
} from '../tools/playtestNoteCapture.mjs';

// Build a results-markdown item block the canonical parser recognises. `fields` overrides the
// per-item Field/Value rows (result/severity/repro/media/nextAction); omitted cells stay blank.
function item(id, { result = '', severity = '', repro = '', media = '', nextAction = '' } = {}) {
  return [
    `### [ ] ${id} — some item title  _(blocker)_`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Result (PASS / FAIL / N/A) | ${result} |`,
    `| Observed severity (if FAIL) | ${severity} |`,
    `| Repro notes | ${repro} |`,
    `| Screenshots / video | ${media} |`,
    `| Recommended next action | ${nextAction} |`,
    '',
  ].join('\n');
}
const doc = (...blocks) => `# Results\n\n${blocks.join('\n')}`;

describe('playtest-note-capture — constants', () => {
  it('exposes a stable schema, badge, and follow-up field set', () => {
    expect(PLAYTEST_NOTE_CAPTURE_SCHEMA).toBe('torii.playtest-note-capture');
    expect(PLAYTEST_NOTE_CAPTURE_SCHEMA_VERSION).toBe(1);
    expect(PLAYTEST_NOTE_CAPTURE_BADGE).toContain('NOT AN APPROVAL');
    expect(PLAYTEST_NOTE_CAPTURE_BADGE).toContain('READ-ONLY');
    expect(Object.isFrozen(CAPTURE_FOLLOWUP_FIELDS)).toBe(true);
    expect(CAPTURE_FOLLOWUP_FIELDS).toEqual(['severity', 'repro', 'nextAction']);
  });
});

describe('playtest-note-capture — explainPlaytestCapture', () => {
  it('reports not-run with every item blank for an all-blank doc', () => {
    const e = explainPlaytestCapture(doc(item('LAUNCH-1'), item('SHOOT-1')));
    expect(e.status).toBe('not-run');
    expect(e.total).toBe(2);
    expect(e.recorded).toBe(0);
    expect(e.blank).toBe(2);
    expect(e.fails).toEqual([]);
    expect(e.nextSteps.some((s) => /Record a Result/.test(s))).toBe(true);
  });

  it('degrades to an honest empty/unknown explainer for null/garbled input', () => {
    for (const bad of [null, undefined, 42, '', 'no items here']) {
      const e = explainPlaytestCapture(bad);
      expect(e.status).toBe('unknown');
      expect(e.total).toBe(0);
      expect(e.approvalImplied).toBe(false);
    }
  });

  it('flags incomplete when some items recorded and some still blank', () => {
    const e = explainPlaytestCapture(doc(item('LAUNCH-1', { result: 'PASS' }), item('SHOOT-1')));
    expect(e.status).toBe('incomplete');
    expect(e.recorded).toBe(1);
    expect(e.blank).toBe(1);
    expect(e.nextSteps.some((s) => /SHOOT-1/.test(s))).toBe(true);
  });

  it('flags attention and lists FAIL follow-up fields still missing', () => {
    const e = explainPlaytestCapture(doc(
      item('LAUNCH-1', { result: 'FAIL', repro: 'crashed on start' }),
      item('SHOOT-1', { result: 'PASS' }),
    ));
    expect(e.status).toBe('attention');
    expect(e.fails).toEqual(['LAUNCH-1']);
    expect(e.followups).toEqual(['LAUNCH-1']);
    const launch = e.items.find((i) => i.id === 'LAUNCH-1');
    // repro was filled, so only severity + nextAction remain missing (media is optional).
    expect(launch.missingFields).toEqual(['severity', 'nextAction']);
    expect(launch.needsFollowup).toBe(true);
  });

  it('does not require follow-up fields for a fully-documented FAIL', () => {
    const e = explainPlaytestCapture(doc(item('MOVE-1', {
      result: 'FAIL', severity: 'major', repro: 'clipped wall', nextAction: 'tighten collider',
    })));
    expect(e.status).toBe('attention');
    expect(e.followups).toEqual([]);
    expect(e.items[0].needsFollowup).toBe(false);
    expect(e.items[0].missingFields).toEqual([]);
  });

  it('reports complete for an all PASS/N-A doc but NEVER implies approval', () => {
    const e = explainPlaytestCapture(doc(
      item('LAUNCH-1', { result: 'PASS' }), item('SHOOT-1', { result: 'N/A' }),
    ));
    expect(e.status).toBe('complete');
    expect(e.complete).toBe(true);
    expect(e.pending).toBe(false);
    expect(e.approvalImplied).toBe(false);
    expect(e.nextSteps.some((s) => /NOT an approval/i.test(s))).toBe(true);
  });

  it('reads the Build/session header and reports which meta fields are blank', () => {
    const md = [
      '# Results',
      '',
      '## Build / session',
      '',
      '| Field | Value |',
      '| --- | --- |',
      '| Build / version | v0.2.224-alpha |',
      '| Tester | alice |',
      '| Date |  |',
      '',
      item('LAUNCH-1', { result: 'PASS' }),
    ].join('\n');
    const e = explainPlaytestCapture(md);
    expect(e.meta.filled).toContain('build');
    expect(e.meta.filled).toContain('tester');
    expect(e.meta.blank).toContain('date');
    expect(e.meta.blank).toContain('commit');
  });

  it('pins approvalImplied false across every status branch', () => {
    const docs = [
      '', // unknown
      doc(item('A-1')), // not-run
      doc(item('A-1', { result: 'PASS' }), item('B-1')), // incomplete
      doc(item('A-1', { result: 'FAIL' })), // attention
      doc(item('A-1', { result: 'PASS' })), // complete
    ];
    for (const d of docs) expect(explainPlaytestCapture(d).approvalImplied).toBe(false);
  });
});

describe('playtest-note-capture — formatPlaytestCaptureExplain', () => {
  it('renders a concise block with the note→result mapping and no-approval line', () => {
    const out = formatPlaytestCaptureExplain(explainPlaytestCapture(doc(item('LAUNCH-1'))));
    expect(out).toContain('note-capture explainer');
    expect(out).toContain('implies approval: NO');
    expect(out).toContain('→ PASS');
    expect(out).toContain('→ FAIL');
    expect(out).toContain('Next steps:');
  });

  it('is null-safe', () => {
    expect(formatPlaytestCaptureExplain(null)).toContain('(no explainer)');
  });
});

describe('playtest-note-capture — safeRepoRelPath (--file guard, v0.2.225)', () => {
  it('accepts plain in-repo filenames and safe sub-paths', () => {
    expect(safeRepoRelPath('MVP_PLAYTEST_RESULTS.md')).toEqual({ ok: true, rel: 'MVP_PLAYTEST_RESULTS.md' });
    expect(safeRepoRelPath('docs/results.md')).toEqual({ ok: true, rel: 'docs/results.md' });
    expect(safeRepoRelPath('a.b-c_d.md').ok).toBe(true);
  });

  it('rejects literal absolute paths and `..` traversal', () => {
    expect(safeRepoRelPath('/etc/passwd').ok).toBe(false);
    expect(safeRepoRelPath('C:\\Windows\\win.ini').ok).toBe(false);
    expect(safeRepoRelPath('../secret.md').ok).toBe(false);
    expect(safeRepoRelPath('a/../../b.md').ok).toBe(false);
  });

  it('rejects percent-encoded path separators (%2F, %5C) in any case', () => {
    for (const p of ['foo%2Fbar', 'foo%2fbar', 'foo%5Cbar', 'foo%5cbar', '..%2f..%2fetc%2fpasswd']) {
      const r = safeRepoRelPath(p);
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/percent-encoded/);
    }
  });

  it('rejects percent-encoded traversal dots (%2e variants)', () => {
    for (const p of ['%2e%2e/secret.md', '%2e%2e%2f%2e%2e', 'foo%2E%2E']) {
      expect(safeRepoRelPath(p).ok).toBe(false);
    }
  });

  it('rejects empty / non-string / malformed-encoding input', () => {
    expect(safeRepoRelPath('').ok).toBe(false);
    expect(safeRepoRelPath(null).ok).toBe(false);
    expect(safeRepoRelPath(undefined).ok).toBe(false);
    expect(safeRepoRelPath(42).ok).toBe(false);
    expect(safeRepoRelPath('foo%ZZbar').ok).toBe(false); // not an encoded sep, but malformed %-escape
  });
});

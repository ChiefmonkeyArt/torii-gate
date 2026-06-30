// tests/md-patch.transforms.test.js — split from md-patch.test.js (E3, v0.2.267).
// Slice: the pure heading/section transforms (exact byte preservation outside the targeted section).
import { describe, it, expect } from 'vitest';
import {
  findSection,
  headingLevel,
  headingText,
  appendBulletUnderHeading,
  replaceNamedSection,
  appendNote,
  formatStamp,
  listHeadings,
} from '../tools/mdPatch.mjs';
import { FIXTURE } from './_md-patch-helpers.js';

describe('heading helpers', () => {
  it('headingLevel / headingText parse ATX headings', () => {
    expect(headingLevel('# A')).toBe(1);
    expect(headingLevel('### Active tasks')).toBe(3);
    expect(headingLevel('not a heading')).toBe(0);
    expect(headingText('### Active tasks')).toBe('Active tasks');
    expect(headingText('## Closed ##')).toBe('Closed');
    expect(headingText('plain')).toBe('');
  });
});

describe('findSection', () => {
  it('finds a section bounded by the next same-or-higher heading', () => {
    const f = findSection(FIXTURE, 'Scope');
    expect(f.ok).toBe(true);
    expect(f.level).toBe(2);
    expect(f.bodyEnd).toBeGreaterThan(f.headingIndex);
  });
  it('the last section runs to EOF', () => {
    const f = findSection(FIXTURE, 'Milestone 2');
    expect(f.ok).toBe(true);
    const lines = FIXTURE.split('\n');
    expect(f.bodyEnd).toBe(lines.length);
  });
  it('returns heading-not-found for an unknown heading', () => {
    expect(findSection(FIXTURE, 'Nope').error).toBe('heading-not-found');
  });
  it('rejects empty / non-string inputs', () => {
    expect(findSection(FIXTURE, '').error).toBe('no-heading');
    expect(findSection(null, 'Scope').error).toBe('no-markdown');
  });
});

describe('appendBulletUnderHeading', () => {
  it('appends to the end of an existing bullet list (contiguous)', () => {
    const r = appendBulletUnderHeading(FIXTURE, 'Active tasks', 'leaderboard');
    expect(r.ok).toBe(true);
    const lines = r.markdown.split('\n');
    // the three bullets should be contiguous under "## Active tasks"
    const i = lines.indexOf('## Active tasks');
    expect(lines[i + 1]).toBe(''); // blank after heading
    expect(lines[i + 2]).toBe('Keep the loop clear.');
    expect(lines[i + 3]).toBe('');
    expect(lines[i + 4]).toBe('- gateway');
    expect(lines[i + 5]).toBe('- product');
    expect(lines[i + 6]).toBe('- leaderboard'); // appended at end of list
  });
  it('inserts a blank line before the bullet when the section ends in prose', () => {
    const r = appendBulletUnderHeading(FIXTURE, 'Scope', 'a third item');
    expect(r.ok).toBe(true);
    const lines = r.markdown.split('\n');
    const i = lines.indexOf('## Scope');
    // body: blank, "Torii Quest is the game app.", blank, "- one","- two", blank(inserted), "- a third item", blank, next heading
    expect(lines).toContain('- a third item');
    const bi = lines.indexOf('- a third item');
    expect(lines[bi - 1]).toBe(''); // blank line inserted before prose→bullet
  });
  it('places the bullet right under the heading for an empty body', () => {
    const md = `# T\n\n## Empty\n\n## Next\n\nx\n`;
    const r = appendBulletUnderHeading(md, 'Empty', 'first');
    expect(r.ok).toBe(true);
    const lines = r.markdown.split('\n');
    const i = lines.indexOf('## Empty');
    expect(lines[i + 1]).toBe('- first');
    expect(lines[i + 2]).toBe(''); // blank before the following heading
    expect(lines[i + 3]).toBe('## Next');
  });
  it('collapses multiline bullets to a single line', () => {
    const r = appendBulletUnderHeading(FIXTURE, 'Active tasks', 'a\nb\nc');
    expect(r.ok).toBe(true);
    expect(r.markdown).toContain('- a b c');
    expect(r.markdown).not.toContain('- a\nb\nc');
  });
  it('rejects empty bullets and unknown headings', () => {
    expect(appendBulletUnderHeading(FIXTURE, 'Active tasks', '   ').error).toBe('empty-bullet');
    expect(appendBulletUnderHeading(FIXTURE, 'Nope', 'x').error).toBe('heading-not-found');
  });
  it('preserves every untouched line byte-for-byte', () => {
    const r = appendBulletUnderHeading(FIXTURE, 'Active tasks', 'new');
    expect(r.ok).toBe(true);
    // removing the inserted bullet line must yield the original exactly
    const without = r.markdown.replace('\n- new\n', '\n');
    expect(without).toBe(FIXTURE);
  });
});

describe('replaceNamedSection', () => {
  it('replaces the body but keeps the heading line', () => {
    const r = replaceNamedSection(FIXTURE, 'Scope', 'NEW BODY\n- only this');
    expect(r.ok).toBe(true);
    const lines = r.markdown.split('\n');
    const i = lines.indexOf('## Scope');
    expect(lines[i]).toBe('## Scope'); // heading preserved
    expect(lines[i + 1]).toBe('NEW BODY');
    expect(lines[i + 2]).toBe('- only this');
    // the next heading is preserved right after the new body
    expect(lines[i + 3]).toBe('## Active tasks');
  });
  it('an empty body collapses the section to just its heading', () => {
    const r = replaceNamedSection(FIXTURE, 'Scope', '');
    expect(r.ok).toBe(true);
    const lines = r.markdown.split('\n');
    const i = lines.indexOf('## Scope');
    expect(lines[i]).toBe('## Scope');
    expect(lines[i + 1]).toBe('## Active tasks');
  });
  it('preserves every untouched line outside the section', () => {
    const r = replaceNamedSection(FIXTURE, 'Scope', 'X');
    expect(r.ok).toBe(true);
    const lines = r.markdown.split('\n');
    const before = lines.slice(0, lines.indexOf('## Scope'));
    const origBefore = FIXTURE.split('\n').slice(0, FIXTURE.split('\n').indexOf('## Scope'));
    expect(before).toEqual(origBefore);
    const afterStart = lines.indexOf('## Active tasks');
    const origAfterStart = FIXTURE.split('\n').indexOf('## Active tasks');
    expect(lines.slice(afterStart)).toEqual(FIXTURE.split('\n').slice(origAfterStart));
  });
  it('unescapes \\n is the CLI job; the pure function takes literal newlines', () => {
    const r = replaceNamedSection(FIXTURE, 'Scope', 'line1\nline2');
    expect(r.ok).toBe(true);
    expect(r.markdown).toContain('line1\nline2');
  });
  it('rejects unknown headings and non-string bodies', () => {
    expect(replaceNamedSection(FIXTURE, 'Nope', 'x').error).toBe('heading-not-found');
    expect(replaceNamedSection(FIXTURE, 'Scope', null).error).toBe('no-body');
  });
});

describe('formatStamp', () => {
  it('formats a Date as "YYYY-MM-DD HH:MM UTC"', () => {
    const d = new Date(Date.UTC(2026, 5, 30, 8, 3));
    expect(formatStamp(d)).toBe('2026-06-30 08:03 UTC');
  });
  it('pads single-digit fields', () => {
    const d = new Date(Date.UTC(2026, 0, 1, 0, 5));
    expect(formatStamp(d)).toBe('2026-01-01 00:05 UTC');
  });
  it('defaults to now when called with no arg', () => {
    const s = formatStamp();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);
  });
});

describe('appendNote', () => {
  it('appends a timestamped bullet under the named heading', () => {
    const r = appendNote(FIXTURE, 'Active tasks', 'shipped v0.2.259', '2026-06-30 08:03 UTC');
    expect(r.ok).toBe(true);
    expect(r.markdown).toContain('- [2026-06-30 08:03 UTC] shipped v0.2.259');
  });
  it('defaults the stamp to now when omitted', () => {
    const r = appendNote(FIXTURE, 'Active tasks', 'a live note');
    expect(r.ok).toBe(true);
    expect(r.markdown).toMatch(/- \[\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC\] a live note/);
  });
  it('honours an explicit empty stamp by falling back to now', () => {
    const r = appendNote(FIXTURE, 'Active tasks', 'x', '   ');
    expect(r.ok).toBe(true);
    expect(r.markdown).toMatch(/- \[\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC\] x/);
  });
  it('collapses multiline note text to one line', () => {
    const r = appendNote(FIXTURE, 'Active tasks', 'a\nb\nc', '2026-06-30 08:03 UTC');
    expect(r.ok).toBe(true);
    expect(r.markdown).toContain('- [2026-06-30 08:03 UTC] a b c');
  });
  it('rejects empty text and unknown headings', () => {
    expect(appendNote(FIXTURE, 'Active tasks', '   ', 's').error).toBe('empty-bullet');
    expect(appendNote(FIXTURE, 'Nope', 'x', 's').error).toBe('heading-not-found');
    expect(appendNote(FIXTURE, '', 'x', 's').error).toBe('no-heading');
    expect(appendNote(null, 'Active tasks', 'x').error).toBe('no-markdown');
  });
  it('preserves every untouched line byte-for-byte', () => {
    const r = appendNote(FIXTURE, 'Active tasks', 'note', '2026-06-30 08:03 UTC');
    expect(r.ok).toBe(true);
    const without = r.markdown.replace('\n- [2026-06-30 08:03 UTC] note\n', '\n');
    expect(without).toBe(FIXTURE);
  });
});

describe('listHeadings', () => {
  it('lists every ATX heading with level and line', () => {
    const hs = listHeadings(FIXTURE);
    expect(hs.map((h) => `${h.level}:${h.text}`)).toEqual([
      '1:Torii Quest ToDo',
      '2:Scope',
      '2:Active tasks',
      '2:Milestone 2',
    ]);
  });
  it('returns [] for non-string input', () => {
    expect(listHeadings(null)).toEqual([]);
  });
});

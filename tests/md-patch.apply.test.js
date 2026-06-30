// tests/md-patch.apply.test.js — split from md-patch.test.js (E3, v0.2.267).
// Slice: the fs-backed applyPatch (backup-before-edit, no-create, dry-run) + HANDOFF.md append-only.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findSection, applyPatch } from '../tools/mdPatch.mjs';
import { FIXTURE, QTODO, CTODO, HAND } from './_md-patch-helpers.js';

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mdpatch-'));
});
afterEach(() => {
  try { rmSync(root, { recursive: true, force: true }); } catch { /* noop */ }
});

function writeTodo(name, md) {
  writeFileSync(join(root, name), md, 'utf8');
}

describe('applyPatch — fs boundary, backup, dry-run', () => {
  beforeEach(() => writeTodo(QTODO, FIXTURE));

  it('writes the edit and creates a .bak backup', () => {
    const r = applyPatch({ root, file: QTODO, action: 'append', heading: 'Active tasks', bullet: 'leaderboard' });
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(true);
    expect(existsSync(r.bakPath)).toBe(true);
    expect(readFileSync(r.bakPath, 'utf8')).toBe(FIXTURE); // backup == original
    expect(readFileSync(join(root, QTODO), 'utf8')).toContain('- leaderboard');
  });
  it('dry-run writes nothing and previews the result', () => {
    const r = applyPatch({ root, file: QTODO, action: 'append', heading: 'Active tasks', bullet: 'leaderboard', dryRun: true });
    expect(r.ok).toBe(true);
    expect(r.dryRun).toBe(true);
    expect(r.preview).toContain('- leaderboard');
    // file untouched, no backup created
    expect(readFileSync(join(root, QTODO), 'utf8')).toBe(FIXTURE);
    expect(existsSync(join(root, `${QTODO}.bak`))).toBe(false);
  });
  it('no-change when the transform produces identical bytes', () => {
    // replacing Scope body with its exact current body → identical
    const cur = readFileSync(join(root, QTODO), 'utf8');
    const f = findSection(cur, 'Scope');
    const bodyLines = cur.split('\n').slice(f.headingIndex + 1, f.bodyEnd);
    const r = applyPatch({ root, file: QTODO, action: 'replace', section: 'Scope', body: bodyLines.join('\n') });
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(false);
  });
  it('refuses to edit a non-whitelisted file even if it exists', () => {
    writeTodo('NOSTR_ARENA_MASTER_TODO.md', '# arena\n');
    const r = applyPatch({ root, file: 'NOSTR_ARENA_MASTER_TODO.md', action: 'append', heading: 'arena', bullet: 'x' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('not-whitelisted');
  });
  it('rejects path traversal at the apply layer', () => {
    const r = applyPatch({ root, file: '../quest-todo.md', action: 'append', heading: 'Scope', bullet: 'x' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('path-separator-not-allowed');
  });
  it('does not create a file that does not already exist', () => {
    const r = applyPatch({ root, file: CTODO, action: 'append', heading: 'Scope', bullet: 'x' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('file-not-found');
    expect(existsSync(join(root, CTODO))).toBe(false);
  });
  it('rejects a non-permitted action (caught by the capability map)', () => {
    const r = applyPatch({ root, file: QTODO, action: 'nuke', heading: 'Scope', bullet: 'x' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('action-not-permitted');
  });
  it('note action writes a timestamped bullet under the heading + backup', () => {
    const r = applyPatch({ root, file: QTODO, action: 'note', heading: 'Active tasks', bullet: 'shipped md pipeline', stamp: '2026-06-30 08:03 UTC' });
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(true);
    expect(existsSync(r.bakPath)).toBe(true);
    expect(readFileSync(join(root, QTODO), 'utf8')).toContain('- [2026-06-30 08:03 UTC] shipped md pipeline');
  });
  it('note dry-run writes nothing and previews', () => {
    const r = applyPatch({ root, file: QTODO, action: 'note', heading: 'Active tasks', bullet: 'x', stamp: '2026-06-30 08:03 UTC', dryRun: true });
    expect(r.ok).toBe(true);
    expect(r.dryRun).toBe(true);
    expect(r.preview).toContain('- [2026-06-30 08:03 UTC] x');
    expect(readFileSync(join(root, QTODO), 'utf8')).toBe(FIXTURE);
  });
});

describe('applyPatch — HANDOFF.md append-only capability', () => {
  const HAND_FIX = `# Torii Quest — Contributor / Agent Handoff

## 8. Active issues / open edges

- one open edge
`;
  beforeEach(() => writeTodo(HAND, HAND_FIX));

  it('rejects replace on HANDOFF.md (append-only)', () => {
    const r = applyPatch({ root, file: HAND, action: 'replace', section: '8. Active issues / open edges', body: 'NEW' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('action-not-permitted');
    expect(readFileSync(join(root, HAND), 'utf8')).toBe(HAND_FIX); // untouched
  });
  it('allows append + note on HANDOFF.md under the issues heading', () => {
    const a = applyPatch({ root, file: HAND, action: 'append', heading: '8. Active issues / open edges', bullet: 'a second edge' });
    expect(a.ok).toBe(true);
    expect(readFileSync(join(root, HAND), 'utf8')).toContain('- a second edge');
    const n = applyPatch({ root, file: HAND, action: 'note', heading: '8. Active issues / open edges', bullet: 'live note', stamp: '2026-06-30 08:03 UTC' });
    expect(n.ok).toBe(true);
    expect(readFileSync(join(root, HAND), 'utf8')).toContain('- [2026-06-30 08:03 UTC] live note');
  });
});

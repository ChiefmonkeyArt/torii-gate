// tools/playtest-checklist.mjs — local, read-only MVP MANUAL PLAYTEST CHECKLIST CLI (v0.2.203).
// Run with: node tools/playtest-checklist.mjs  (or: npm run playtest:checklist).
// Prints (or writes) a hand-runnable manual QA / acceptance checklist for the LIVE build, built
// from the frozen curated checklist in playtestChecklist.mjs (unit-tested). This file only does
// the fs/git I/O (version marker + best-effort short commit) and stamps the header — it
// re-derives nothing and runs NO browser automation.
//
// Modes:
//   (default)        human-readable text block on stdout
//   --json           machine-readable JSON envelope on stdout
//   --markdown/--md  markdown checklist on stdout
//   --write[=path]   ALSO write the markdown checklist to a file (default MVP_PLAYTEST_CHECKLIST.md).
//                    This is the ONLY thing that writes — without --write the tool is read-only.
//                    The path is CONFINED inside the repo (resolveHandoffWritePath): an absolute
//                    path or a `..` escape is rejected.
//
// MANUAL CHECKLIST ONLY: NO browser automation, NO network, NO server, NO deploy, NO publish,
// NO git tag, NO GitHub release. NO secrets, NO install, NO build, and NO writes unless --write
// is given. git is best-effort (falls back to null). Always exits 0 — this is a VISIBILITY aid,
// not a gate.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHandoffWritePath, HANDOFF_SUMMARY_LIVE_URL } from './handoffSummary.mjs';
import {
  buildPlaytestChecklistModel, formatPlaytestChecklist, formatPlaytestChecklistMarkdown,
  PLAYTEST_CHECKLIST_WRITE_FILENAME,
} from './playtestChecklist.mjs';

const ROOT = process.cwd();

function readSafe(rel) {
  try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return null; }
}

function configVersion() {
  const m = (readSafe('src/config.js') || '').match(/VERSION\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim() || null;
  } catch { return null; }
}

// Parse --write / --write=path → { write, path?, error? }. Default file is MVP_PLAYTEST_CHECKLIST.md.
// The target is CONFINED inside the repo via the shared, pure resolveHandoffWritePath: an
// absolute path or a `..` escape is REJECTED. Without --write the tool stays read-only.
function writeTarget(argv) {
  const arg = argv.find((a) => a === '--write' || a.startsWith('--write='));
  if (!arg) return { write: false, path: null };
  const eq = arg.indexOf('=');
  const raw = eq >= 0 ? arg.slice(eq + 1) : PLAYTEST_CHECKLIST_WRITE_FILENAME;
  const resolved = resolveHandoffWritePath(raw, ROOT);
  if (!resolved.ok) return { write: true, path: null, error: resolved.error };
  return { write: true, path: resolved.path };
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
})();

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const model = buildPlaytestChecklistModel({
    version: configVersion(),
    gitCommit: gitCommit(),
    liveUrl: HANDOFF_SUMMARY_LIVE_URL,
    generatedAt: new Date().toISOString(),
  });

  const { write, path, error } = writeTarget(argv);
  if (write && !path) {
    process.stderr.write(`playtest-checklist: refusing --write (${error}); the target must be inside the repo (no absolute path, no '..').\n`);
    process.exit(2);
  }
  if (write) {
    writeFileSync(path, formatPlaytestChecklistMarkdown(model), 'utf8');
    process.stderr.write(`playtest-checklist: wrote ${path}\n`);
  }

  if (argv.includes('--json')) {
    process.stdout.write(JSON.stringify(model, null, 2) + '\n');
  } else if (argv.includes('--markdown') || argv.includes('--md')) {
    process.stdout.write(formatPlaytestChecklistMarkdown(model));
  } else {
    console.log('');
    console.log(formatPlaytestChecklist(model));
    console.log('');
  }
  process.exit(0);
}

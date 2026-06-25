// tools/release-notes.mjs — local, read-only MVP-PROOF RELEASE-NOTES DRAFT CLI (v0.2.202).
// Run with: node tools/release-notes.mjs  (or: npm run release:notes).
// Produces a DRAFT release-notes document for the first MVP proof-of-concept candidate, based
// only on current local status/reports/docs. It COMPOSES the existing local verdicts —
// runMvpReadiness() + gatherReleaseReadiness() → buildMvpRcGate() (candidate verdict) +
// buildHandoffSummary() (version/reports) — and folds them with the curated "what's built"
// narrative in releaseNotes.mjs (unit-tested). This file only does the fs/git I/O and
// re-derives nothing.
//
// Modes:
//   (default)        human-readable text block on stdout
//   --json           machine-readable JSON envelope on stdout
//   --markdown/--md  markdown draft on stdout
//   --write[=path]   ALSO write the markdown draft to a file (default RELEASE_NOTES_DRAFT.md).
//                    This is the ONLY thing that writes — without --write the tool is read-only.
//                    The path is CONFINED inside the repo (resolveHandoffWritePath): an absolute
//                    path or a `..` escape is rejected.
//
// DRAFT ONLY: NO GitHub release, NO git tag, NO public announcement, NO network, NO server,
// NO deploy, NO publish. NO secrets, NO install, NO build, and NO writes unless --write is given.
// git is best-effort (falls back to null). Always exits 0 — this is a VISIBILITY draft, not a gate.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatherReleaseReadiness } from './release-readiness.mjs';
import { buildHandoffSummary, resolveHandoffWritePath, HANDOFF_SUMMARY_LIVE_URL } from './handoffSummary.mjs';
import { buildMvpRcGate } from './mvpRcGate.mjs';
import {
  buildReleaseNotesModel, formatReleaseNotes, formatReleaseNotesMarkdown,
  RELEASE_NOTES_WRITE_FILENAME,
} from './releaseNotes.mjs';
import { runMvpReadiness } from '../src/engine/status/mvpReadiness.js';

const ROOT = process.cwd();

function readSafe(rel) {
  try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return null; }
}

function configVersion() {
  const m = (readSafe('src/config.js') || '').match(/VERSION\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

function packageVersion() {
  try { return JSON.parse(readSafe('package.json') || '{}').version || null; } catch { return null; }
}

function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim() || null;
  } catch { return null; }
}

// Parse --write / --write=path → { write, path?, error? }. Default file is RELEASE_NOTES_DRAFT.md.
// The target is CONFINED inside the repo via the shared, pure resolveHandoffWritePath: an
// absolute path or a `..` escape is REJECTED. Without --write the tool stays read-only.
function writeTarget(argv) {
  const arg = argv.find((a) => a === '--write' || a.startsWith('--write='));
  if (!arg) return { write: false, path: null };
  const eq = arg.indexOf('=');
  const raw = eq >= 0 ? arg.slice(eq + 1) : RELEASE_NOTES_WRITE_FILENAME;
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
  const release = gatherReleaseReadiness(ROOT);
  let mvp = null;
  try { mvp = runMvpReadiness(); } catch { mvp = null; }
  const handoff = buildHandoffSummary({
    version: configVersion(),
    packageVersion: packageVersion(),
    gitCommit: gitCommit(),
    liveUrl: HANDOFF_SUMMARY_LIVE_URL,
    release,
    generatedAt: null,
  });
  const rcGate = buildMvpRcGate({
    mvpReadiness: mvp,
    releaseReadiness: release,
    handoff,
    generatedAt: null,
  });

  const model = buildReleaseNotesModel({
    rcGate,
    mvpReadiness: mvp,
    handoff,
    version: configVersion(),
    gitCommit: gitCommit(),
    liveUrl: HANDOFF_SUMMARY_LIVE_URL,
    generatedAt: new Date().toISOString(),
  });

  const { write, path, error } = writeTarget(argv);
  if (write && !path) {
    process.stderr.write(`release-notes: refusing --write (${error}); the target must be inside the repo (no absolute path, no '..').\n`);
    process.exit(2);
  }
  if (write) {
    writeFileSync(path, formatReleaseNotesMarkdown(model), 'utf8');
    process.stderr.write(`release-notes: wrote ${path}\n`);
  }

  if (argv.includes('--json')) {
    process.stdout.write(JSON.stringify(model, null, 2) + '\n');
  } else if (argv.includes('--markdown') || argv.includes('--md')) {
    process.stdout.write(formatReleaseNotesMarkdown(model));
  } else {
    console.log('');
    console.log(formatReleaseNotes(model));
    console.log('');
  }
  process.exit(0);
}

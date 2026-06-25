// tools/handoff-summary.mjs — local, read-only AI HANDOFF AUTO-SUMMARY CLI (v0.2.190).
// Run with: node tools/handoff-summary.mjs  (or: npm run handoff:summary).
// Folds the local status/readiness inputs a NEXT agent/model needs into one concise brief —
// version, git commit, live URL, the current gate verdict, test-profile counts, latest reports,
// the recommended next SAFE task, the standing key constraints, and the exact release-verify
// commands. The pure assembly/formatting lives in handoffSummary.mjs (unit-tested); this file
// only does the fs/git I/O and reuses gatherReleaseReadiness() from release-readiness.mjs.
//
// Modes:
//   (default)        human-readable text block on stdout
//   --json           machine-readable JSON envelope on stdout (canonical: pipe this; scripted
//                    npm consumers use `npm run --silent handoff:summary -- --json`, since a
//                    plain `npm run` prepends a lifecycle banner to stdout)
//   --markdown/--md  markdown brief on stdout
//   --write[=path]   ALSO write the markdown brief to a file (default handoff-summary.md).
//                    This is the ONLY thing that writes — without --write the tool is read-only.
//
// NO network, NO secrets, NO install, NO build, and NO writes unless --write is given. git is
// best-effort (falls back to null). Always exits 0 — this is a VISIBILITY snapshot, not a gate.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatherReleaseReadiness } from './release-readiness.mjs';
import {
  buildHandoffSummary, formatHandoffSummary, formatHandoffSummaryMarkdown,
  HANDOFF_SUMMARY_LIVE_URL,
} from './handoffSummary.mjs';

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

// Parse --write / --write=path → { write: boolean, path: string }. Default file is
// handoff-summary.md at the repo root. An explicit relative path is resolved against ROOT.
function writeTarget(argv) {
  const arg = argv.find((a) => a === '--write' || a.startsWith('--write='));
  if (!arg) return { write: false, path: null };
  const eq = arg.indexOf('=');
  const raw = eq >= 0 ? arg.slice(eq + 1) : 'handoff-summary.md';
  const path = isAbsolute(raw) ? raw : join(ROOT, raw);
  return { write: true, path };
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
})();

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const release = gatherReleaseReadiness(ROOT);
  const summary = buildHandoffSummary({
    version: configVersion(),
    packageVersion: packageVersion(),
    gitCommit: gitCommit(),
    liveUrl: HANDOFF_SUMMARY_LIVE_URL,
    release,
    generatedAt: new Date().toISOString(),
  });

  const { write, path } = writeTarget(argv);
  if (write) {
    writeFileSync(path, formatHandoffSummaryMarkdown(summary), 'utf8');
    process.stderr.write(`handoff-summary: wrote ${path}\n`);
  }

  if (argv.includes('--json')) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } else if (argv.includes('--markdown') || argv.includes('--md')) {
    process.stdout.write(formatHandoffSummaryMarkdown(summary));
  } else {
    console.log('');
    console.log(formatHandoffSummary(summary));
    console.log('');
  }
  process.exit(0);
}

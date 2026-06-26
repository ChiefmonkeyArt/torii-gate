// tools/playtest-results.mjs — local, read-only MVP MANUAL PLAYTEST RESULTS INTAKE CLI (v0.2.204).
// Run with: node tools/playtest-results.mjs  (or: npm run playtest:results).
// Two jobs, both local/read-only:
//   1. emit a BLANK results template (built from the frozen checklist in playtestChecklist.mjs via
//      playtestResults.mjs) for a tester to fill in by hand;
//   2. SUMMARIZE a COMPLETED results markdown back into counts + the failing item ids, so failures
//      can be fed into todo/progress/handoff.
// This file only does fs/git I/O (version marker + best-effort short commit, reading a results
// file) and stamps the header — it re-derives nothing and runs NO browser automation.
//
// Modes:
//   (default)         human-readable blank template on stdout
//   --json            machine-readable JSON template envelope on stdout
//   --markdown/--md   markdown blank template on stdout
//   --write[=path]    ALSO write the markdown template to a file (default
//                     MVP_PLAYTEST_RESULTS_TEMPLATE.md). The ONLY thing that writes — the path is
//                     CONFINED inside the repo (resolveHandoffWritePath): an absolute path or a
//                     `..` escape is rejected.
//   --summarize[=path]  READ a completed results markdown (default MVP_PLAYTEST_RESULTS_TEMPLATE.md)
//                     and print a pass/fail/blank summary + failing ids. With --json, prints the
//                     summary as JSON. Read-only — never writes.
//
// RESULTS INTAKE ONLY: NO browser automation, NO network, NO server, NO deploy, NO publish, NO git
// tag, NO GitHub release. git is best-effort (falls back to null). Always exits 0 (except a
// rejected --write path → exit 2) — this is a VISIBILITY aid, not a gate.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, isAbsolute, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHandoffWritePath, HANDOFF_SUMMARY_LIVE_URL } from './handoffSummary.mjs';
import {
  buildPlaytestResultsTemplate, formatPlaytestResultsTemplate,
  formatPlaytestResultsTemplateMarkdown, parsePlaytestResults, summarizePlaytestResults,
  formatPlaytestResultsSummary, PLAYTEST_RESULTS_WRITE_FILENAME,
} from './playtestResults.mjs';

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

// Parse --write / --write=path → { write, path?, error? }. Default MVP_PLAYTEST_RESULTS_TEMPLATE.md.
// CONFINED inside the repo via the shared, pure resolveHandoffWritePath: an absolute path or a
// `..` escape is REJECTED. Without --write the tool stays read-only.
function writeTarget(argv) {
  const arg = argv.find((a) => a === '--write' || a.startsWith('--write='));
  if (!arg) return { write: false, path: null };
  const eq = arg.indexOf('=');
  const raw = eq >= 0 ? arg.slice(eq + 1) : PLAYTEST_RESULTS_WRITE_FILENAME;
  const resolved = resolveHandoffWritePath(raw, ROOT);
  if (!resolved.ok) return { write: true, path: null, error: resolved.error };
  return { write: true, path: resolved.path };
}

// Parse --summarize / --summarize=path → { summarize, rel } (relative-in-repo read path; default
// MVP_PLAYTEST_RESULTS_TEMPLATE.md). Reading is read-only; we confine the read to inside the repo
// (reject absolute / `..` escapes) to keep the tool's filesystem reach bounded.
function summarizeTarget(argv) {
  const arg = argv.find((a) => a === '--summarize' || a.startsWith('--summarize='));
  if (!arg) return { summarize: false, rel: null };
  const eq = arg.indexOf('=');
  const raw = eq >= 0 ? arg.slice(eq + 1) : PLAYTEST_RESULTS_WRITE_FILENAME;
  if (isAbsolute(raw) || normalize(raw).split(/[\\/]/).includes('..')) {
    return { summarize: true, rel: null, error: 'path must be inside the repo' };
  }
  return { summarize: true, rel: raw };
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
})();

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const wantJson = argv.includes('--json');

  // --summarize: read a completed results markdown and report counts + failing ids (read-only).
  const sum = summarizeTarget(argv);
  if (sum.summarize) {
    if (!sum.rel) {
      process.stderr.write(`playtest-results: refusing --summarize (${sum.error}); the target must be inside the repo (no absolute path, no '..').\n`);
      process.exit(2);
    }
    const text = readSafe(sum.rel);
    if (text == null) {
      process.stderr.write(`playtest-results: could not read ${sum.rel} (nothing to summarize).\n`);
      process.exit(0);
    }
    const summary = summarizePlaytestResults(parsePlaytestResults(text));
    if (wantJson) {
      process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    } else {
      console.log('');
      console.log(formatPlaytestResultsSummary(summary));
      console.log('');
    }
    process.exit(0);
  }

  // Default: build + emit the blank template.
  const model = buildPlaytestResultsTemplate({
    version: configVersion(),
    gitCommit: gitCommit(),
    liveUrl: HANDOFF_SUMMARY_LIVE_URL,
    generatedAt: new Date().toISOString(),
  });

  const { write, path, error } = writeTarget(argv);
  if (write && !path) {
    process.stderr.write(`playtest-results: refusing --write (${error}); the target must be inside the repo (no absolute path, no '..').\n`);
    process.exit(2);
  }
  if (write) {
    writeFileSync(path, formatPlaytestResultsTemplateMarkdown(model), 'utf8');
    process.stderr.write(`playtest-results: wrote ${path}\n`);
  }

  if (wantJson) {
    process.stdout.write(JSON.stringify(model, null, 2) + '\n');
  } else if (argv.includes('--markdown') || argv.includes('--md')) {
    process.stdout.write(formatPlaytestResultsTemplateMarkdown(model));
  } else {
    console.log('');
    console.log(formatPlaytestResultsTemplate(model));
    console.log('');
  }
  process.exit(0);
}

// tools/playtest-verdict.mjs — local, read-only MVP PLAYTEST VERDICT explainer CLI (v0.2.235).
// Run with: node tools/playtest-verdict.mjs  (or: npm run playtest:verdict).
// Reads the canonical, source-controlled capture file MVP_PLAYTEST_VERDICT.md (the one-line verdict
// a tester fills in) and reports the parsed verdict — `pending` / `ok` / `blocked` plus any listed
// blockers. The shipped file is BLANK, so a fresh checkout reports `pending`. This NEVER implies
// MVP approval (approvalImplied is pinned false) and NEVER writes/deploys/publishes/approves.
//
// Modes:
//   (default)        human-readable verdict block on stdout
//   --json           machine-readable JSON state on stdout
//   --file=path      read a different in-repo verdict file (default MVP_PLAYTEST_VERDICT.md)
//
// STRICTLY READ-ONLY: NO --write, NO browser automation, NO network, NO server, NO deploy, NO
// publish, NO git tag/release, NO approval. Always exits 0 (rejected --file path → exit 2).
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePlaytestVerdict, summarizePlaytestVerdictForState,
  PLAYTEST_VERDICT_FILE, PLAYTEST_VERDICT_HOWTO, PLAYTEST_VERDICT_BADGE,
} from '../src/engine/status/playtestVerdict.js';
import { safeRepoRelPath } from './playtestNoteCapture.mjs';

const ROOT = process.cwd();

function readSafe(rel) {
  try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return null; }
}

// Resolve --file=path → an in-repo relative path (default MVP_PLAYTEST_VERDICT.md). The bounds
// check (absolute path / `..` escape / percent-encoded separators) lives in the pure, unit-tested
// safeRepoRelPath() so the read stays inside the repo and can't be fooled by `%2F`/`%5C`/`%2e`.
function readTarget(argv) {
  const arg = argv.find((a) => a.startsWith('--file='));
  if (!arg) return { rel: PLAYTEST_VERDICT_FILE };
  const raw = arg.slice('--file='.length);
  const guard = safeRepoRelPath(raw);
  return guard.ok ? { rel: guard.rel } : { rel: null, error: guard.reason };
}

// formatVerdict(state) → a concise multi-line text block. Pure-ish (string only).
function formatVerdict(state) {
  const L = [];
  L.push('Torii Quest — MVP playtest verdict');
  L.push('─'.repeat(60));
  L.push(PLAYTEST_VERDICT_BADGE);
  L.push('');
  L.push(`verdict: ${state.verdict}${state.reportedBy ? `  ·  reported by ${state.reportedBy}` : ''}`);
  if (state.blockerCount) {
    L.push(`blockers (${state.blockerCount}):`);
    for (const b of state.blockers) L.push(`  · ${b}`);
  } else {
    L.push('blockers: none reported');
  }
  L.push('');
  L.push('implies MVP approval: NO (approval is the separate explicit user OK in MVP_APPROVAL_STATE.json)');
  L.push('');
  L.push('how to report:');
  for (const h of PLAYTEST_VERDICT_HOWTO) L.push(`  · ${h}`);
  return L.join('\n');
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
})();

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const wantJson = argv.includes('--json');

  const { rel, error: readErr } = readTarget(argv);
  if (!rel) {
    process.stderr.write(`playtest-verdict: refusing --file (${readErr}); the target must be inside the repo.\n`);
    process.exit(2);
  }
  const text = readSafe(rel);
  const state = summarizePlaytestVerdictForState(parsePlaytestVerdict(text == null ? '' : text));

  if (wantJson) {
    process.stdout.write(JSON.stringify(state, null, 2) + '\n');
  } else {
    console.log('');
    if (text == null) console.log(`(no ${rel} found — reporting an empty/pending verdict)`);
    console.log(formatVerdict(state));
    console.log('');
  }
  process.exit(0);
}

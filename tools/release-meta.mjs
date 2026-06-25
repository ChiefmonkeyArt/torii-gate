// tools/release-meta.mjs — local RELEASE/UPDATE METADATA CLI (v0.2.192).
// Run with: node tools/release-meta.mjs  (or: npm run release:meta).
// Assembles the static release/update metadata a FUTURE torii.quest / VPS update-checker reads
// to show an inert "update available" notice — from the local config VERSION, package version,
// the git short commit (best-effort), and the documentation-only GitHub release coordinates.
// The pure shaping/validation lives in releaseMeta.mjs (unit-tested); this file only does the
// fs/git I/O + the flag-gated, in-repo WRITE.
//
// NO network, NO secrets, NO install, NO auto-update. By DEFAULT it is READ-ONLY: it prints and
// validates. It only writes when explicitly asked with --write, and only to the canonical
// in-repo path (public/release-metadata.json). Always exits 0 — advisory/visibility tool.
//
// Modes:
//   (default)  human-readable text block + validation result on stdout
//   --json     machine-readable metadata object on stdout
//   --write    write public/release-metadata.json (in-repo, safe path) then print where.
//              DETERMINISTIC by default (no commit/timestamp baked in) so the committed
//              template is reproducible and never churns the working tree.
//   --stamp    only with --write/--json: bake the live git commit + generatedAt timestamp into
//              the output (for a deploy step that wants provenance in the deployed dist copy).
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildReleaseMeta, formatReleaseMeta, validateReleaseMeta,
  RELEASE_META_FILE, DEFAULT_SOURCE,
} from './releaseMeta.mjs';

const ROOT = process.cwd();

function readSafe(rel) {
  try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return null; }
}

function configVersion() {
  const m = (readSafe('src/config.js') || '').match(/VERSION\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

// Best-effort git short commit. Never throws; null when git/repo is unavailable.
function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim() || null;
  } catch { return null; }
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
})();

if (invokedDirectly) {
  const args = process.argv.slice(2);
  const writing = args.includes('--write');
  const asJson = args.includes('--json');
  // The committed artifact (--write) and machine output (--json) are DETERMINISTIC by default so
  // re-running never churns the tree; the ephemeral text glance shows live provenance. --stamp
  // forces live commit/timestamp into the artifact when a deploy step wants provenance.
  const stamp = args.includes('--stamp') || (!writing && !asJson);
  const meta = buildReleaseMeta({
    version: configVersion(),
    commit: stamp ? gitCommit() : null,
    owner: DEFAULT_SOURCE.owner,
    repo: DEFAULT_SOURCE.repo,
    generatedAt: stamp ? new Date().toISOString() : null,
  });
  const json = JSON.stringify(meta, null, 2) + '\n';

  if (writing) {
    const outPath = join(ROOT, RELEASE_META_FILE);
    writeFileSync(outPath, json);
    const { ok, errors } = validateReleaseMeta(meta);
    console.log('');
    console.log(`release-meta: wrote ${RELEASE_META_FILE}${ok ? ' (valid)' : ` (INVALID: ${errors.join('; ')})`}`);
    console.log('');
    process.exit(0);
  }

  if (asJson) {
    process.stdout.write(json);
    process.exit(0);
  }

  console.log('');
  console.log(formatReleaseMeta(meta));
  console.log('');
  process.exit(0);
}

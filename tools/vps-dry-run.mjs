// tools/vps-dry-run.mjs — local, read-only VPS/static-host INSTALL DRY-RUN CLI (v0.2.193).
// Run with: node tools/vps-dry-run.mjs  (or: npm run vps:dry-run [-- --json]).
//
// Validates the LOCAL repo/build/docs readiness an operator needs BEFORE deploying torii.quest
// to a VPS or static host — dist presence, the manual-only release metadata, the /zone/* SPA
// fallback docs, the VPS_INSTALL.md install/update/rollback/security sections, the real-repo
// metadata in UPDATE_CHECK.md, the documented build/verify commands, the rollback + manual
// safety wording, the service-worker stance, and the live URL references. The pure checklist
// logic lives in vpsDryRun.mjs (unit-tested); this file only does the fs reads + printing.
//
// NO network, NO SSH, NO DNS, NO server, NO deploy, NO secrets, NO write — it only READS local
// files. Exits non-zero iff a HARD check FAILS (warn/skip do not fail the run), so it can gate a
// deploy script if an operator chooses, while staying advisory by default.
import { readFileSync, readdirSync, existsSync, statSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REQUIRED_DOCS, runVpsDryRun, formatVpsDryRun,
} from './vpsDryRun.mjs';
import { RELEASE_META_FILE } from './releaseMeta.mjs';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');

function readSafe(rel) {
  try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return null; }
}

// Gather the required doc bodies as a plain { name → contents } map (missing → omitted).
function readDocs() {
  const out = {};
  for (const name of REQUIRED_DOCS) {
    const text = readSafe(name);
    if (typeof text === 'string') out[name] = text;
  }
  return out;
}

// Parse public/release-metadata.json → object, or null when missing/unparseable.
function readReleaseMeta() {
  const raw = readSafe(RELEASE_META_FILE);
  if (typeof raw !== 'string') return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Recursively list dist/ file paths relative to dist/ (forward slashes). null when no build.
function distPaths() {
  if (!existsSync(DIST)) return null;
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else out.push(relative(DIST, p).replace(/\\/g, '/'));
    }
  };
  walk(DIST);
  return out;
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
})();

if (invokedDirectly) {
  const asJson = process.argv.slice(2).includes('--json');
  const docs = readDocs();
  const paths = distPaths();
  const releaseMeta = readReleaseMeta();
  const result = runVpsDryRun({ docs, dist: paths ? { paths } : undefined, releaseMeta });

  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    console.log('');
    console.log(formatVpsDryRun(result));
    console.log('');
  }
  process.exit(result.ok ? 0 : 1);
}

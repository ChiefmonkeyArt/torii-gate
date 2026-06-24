// tools/handoff-status.mjs — local AI-handoff status snapshot (v0.2.156). Reads local repo
// files (config.js, package.json, the core docs, dist/) and the git short commit, then
// prints a one-glance handoff summary. Run with: node tools/handoff-status.mjs (or:
// npm run handoff:status). The pure assembly/formatting lives in handoffStatus.mjs
// (unit-tested); this file only does the fs/git I/O + printing.
//
// No network, no secrets, no install, no build — it only READS local files and asks git for
// the short commit (best-effort; falls back to null if git is unavailable or this is not a
// repo). Always exits 0 — this is a visibility tool, not a gate.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { buildHandoffStatus, formatHandoffStatus, CORE_DOCS, LIVE_URL } from './handoffStatus.mjs';
import { summarizeBundle, DEFAULT_WARN_LIMIT } from './bundleSizes.mjs';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const ASSETS = join(DIST, 'assets');

function readSafe(rel) {
  try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return null; }
}

// config.js VERSION export.
function configVersion() {
  const src = readSafe('src/config.js') || '';
  const m = src.match(/VERSION\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

// package.json version.
function packageVersion() {
  try { return JSON.parse(readSafe('package.json') || '{}').version || null; } catch { return null; }
}

// Best-effort git short commit. Never throws; returns null when git/repo is unavailable.
function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim() || null;
  } catch { return null; }
}

// Presence map for the core handoff docs.
function docsPresent() {
  const out = {};
  for (const name of CORE_DOCS) out[name] = existsSync(join(ROOT, name));
  return out;
}

// The most recent torii-*-report.md names (by mtime desc), capped — surfaces the latest
// source/slice reports without dumping the whole archive.
function latestReports(limit = 4) {
  try {
    return readdirSync(ROOT)
      .filter((n) => /^torii-.*report\.md$/.test(n))
      .map((n) => ({ n, mt: statSync(join(ROOT, n)).mtimeMs }))
      .sort((a, b) => b.mt - a.mt)
      .slice(0, limit)
      .map((e) => e.n);
  } catch { return []; }
}

// Advisory bundle baseline from the built dist/, or null if not built yet.
function bundleSummary() {
  if (!existsSync(DIST)) return null;
  const entries = [];
  if (existsSync(ASSETS)) {
    for (const name of readdirSync(ASSETS)) {
      if (!name.endsWith('.js')) continue;
      const p = join(ASSETS, name);
      if (!statSync(p).isFile()) continue;
      const buf = readFileSync(p);
      let gzip = null; try { gzip = gzipSync(buf).length; } catch { gzip = null; }
      entries.push({ name, bytes: buf.length, gzip });
    }
  }
  const htmlPath = join(DIST, 'index.html');
  if (existsSync(htmlPath)) {
    const buf = readFileSync(htmlPath);
    let gzip = null; try { gzip = gzipSync(buf).length; } catch { gzip = null; }
    entries.push({ name: 'index.html', bytes: buf.length, gzip });
  }
  return summarizeBundle(entries, { warnLimit: DEFAULT_WARN_LIMIT });
}

const status = buildHandoffStatus({
  version: configVersion(),
  packageVersion: packageVersion(),
  gitCommit: gitCommit(),
  docsPresent: docsPresent(),
  latestReports: latestReports(),
  bundle: bundleSummary(),
  liveUrl: LIVE_URL,
});

console.log('');
console.log(formatHandoffStatus(status));
console.log('');

process.exit(0);

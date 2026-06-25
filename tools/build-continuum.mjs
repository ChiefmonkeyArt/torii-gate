// tools/build-continuum.mjs — generate the static Torii Continuum oversight page
// (v0.2.171). Imports the pure, node-safe data module, renders the page + a packaged
// JSON snapshot, and writes both into public/ so Vite copies them verbatim into dist/.
// Run with: node tools/build-continuum.mjs  (or: npm run build:continuum).
//
// Safe by construction: it only READS the curated data module + progress.md/todo.md and
// WRITES two static files under public/. No network, no install, no external writes, no
// game code. As of v0.2.174 it DERIVES the dashboard's list sections from the project
// docs via the pure tools/continuumParse.mjs and merges them over the curated fallback.
import { writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildContinuumModel,
  buildHealthModel,
  HEALTH_LASTKNOWN,
  renderContinuumPage,
  continuumDataJSON,
} from '../src/engine/dashboard/continuumData.js';
import { deriveContinuumData } from './continuumParse.mjs';
import { PROFILES } from './testProfiles.mjs';
import { VERSION } from '../src/config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const HTML_OUT = join(PUBLIC, 'continuum.html');
const JSON_OUT = join(PUBLIC, 'continuum-data.json');

// Read the doc sources safely — a missing/unreadable doc degrades to '' and the parser
// records the gap, so the build never fails on a doc hiccup (curated defaults survive).
function readSafe(rel) {
  try { return readFileSync(join(ROOT, rel), 'utf8'); }
  catch { return ''; }
}

const SOURCES = ['progress.md', 'todo.md'];
const progressMd = readSafe('progress.md');
const todoMd = readSafe('todo.md');
const { overrides, taskTotals, parsed, gaps } = deriveContinuumData({ progressMd, todoMd });

// Engineering-health: GENERATE the deterministic fields at build time (profile file
// counts from the test-profile registry, the full test-file count on disk, the parser-gap
// count from this run, and a real version/doc-sync check), then let buildHealthModel layer
// the LAST-KNOWN values (total tests, timings, bundle baseline, last green gate) under
// clear provenance chips. Falls back to the curated CONTINUUM.health if anything is absent.
function countTestFiles() {
  try { return readdirSync(join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js')).length; }
  catch { return null; }
}
const docsInSync = [progressMd, todoMd].every((d) => d.includes(VERSION));
const health = buildHealthModel({
  version: VERSION,
  profiles: { fast: PROFILES.fast.length, foundation: PROFILES.foundation.length },
  fullFileCount: countTestFiles(),
  parserGaps: gaps.length,
  docsInSync,
  lastKnown: HEALTH_LASTKNOWN,
});

// Stamp the packaged build time so the page can show when the data was packaged.
const generatedAt = new Date().toISOString();
const model = {
  ...buildContinuumModel({ ...overrides, health, taskTotals, derived: { parsed, gaps, sources: SOURCES } }),
  generatedAt,
};

mkdirSync(PUBLIC, { recursive: true });
writeFileSync(HTML_OUT, renderContinuumPage(model), 'utf8');
writeFileSync(JSON_OUT, JSON.stringify(continuumDataJSON(model), null, 2) + '\n', 'utf8');

console.log(`[continuum] wrote ${HTML_OUT}`);
console.log(`[continuum] wrote ${JSON_OUT}`);
console.log(`[continuum] version ${model.version} · packaged ${generatedAt}`);
console.log(`[continuum] derived from ${SOURCES.join(' + ')}: ${parsed.length ? parsed.join(', ') : 'nothing'}`);
console.log(`[continuum] parser gaps (kept curated): ${gaps.length ? gaps.length : 'none'}`);
for (const g of gaps) console.log(`[continuum]   gap: ${g}`);
console.log(`[continuum] health: profiles fast ${PROFILES.fast.length}/foundation ${PROFILES.foundation.length}, full ${countTestFiles()} files, docs ${docsInSync ? 'in sync' : 'DRIFT'}`);

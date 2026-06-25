// tools/build-continuum.mjs — generate the static Torii Continuum oversight page
// (v0.2.171). Imports the pure, node-safe data module, renders the page + a packaged
// JSON snapshot, and writes both into public/ so Vite copies them verbatim into dist/.
// Run with: node tools/build-continuum.mjs  (or: npm run build:continuum).
//
// Safe by construction: it only READS the curated data module and WRITES two static
// files under public/. No network, no install, no external writes, no game code.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildContinuumModel,
  renderContinuumPage,
  continuumDataJSON,
} from '../src/engine/dashboard/continuumData.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const HTML_OUT = join(PUBLIC, 'continuum.html');
const JSON_OUT = join(PUBLIC, 'continuum-data.json');

// Stamp the packaged build time so the page can show when the data was packaged.
const generatedAt = new Date().toISOString();
const model = { ...buildContinuumModel(), generatedAt };

mkdirSync(PUBLIC, { recursive: true });
writeFileSync(HTML_OUT, renderContinuumPage(model), 'utf8');
writeFileSync(JSON_OUT, JSON.stringify(continuumDataJSON(model), null, 2) + '\n', 'utf8');

console.log(`[continuum] wrote ${HTML_OUT}`);
console.log(`[continuum] wrote ${JSON_OUT}`);
console.log(`[continuum] version ${model.version} · packaged ${generatedAt}`);

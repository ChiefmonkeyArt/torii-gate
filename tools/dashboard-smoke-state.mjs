// tools/dashboard-smoke-state.mjs — local DASHBOARD SMOKE STATE CLI (v0.2.232).
// Run with: node tools/dashboard-smoke-state.mjs  (or: npm run dashboard:smoke).
// Reads / renders / validates the single auditable LIVE cloud-browser smoke record of the deployed
// OVERSIGHT DASHBOARD (DASHBOARD_SMOKE_STATE.json) — the page (continuum.html) loaded, the version
// rendered, the folded live-smoke evidence + active slice were visible. This is the one posture
// local automated gates can NEVER prove, because it is an observation of the deployed production
// dashboard URL after a manual deploy. It is DISTINCT from the app-entry live smoke
// (LIVE_SMOKE_STATE.json): that proves the title buttons; this proves the oversight surface itself.
//
// The pure shaping/validation lives in dashboardSmokeState.mjs (unit-tested); this file only does
// the fs I/O and the (flag-gated, in-repo) WRITE. Unlike a blank template, --write RE-PERSISTS the
// NORMALISED committed record (so a hand-edit is canonicalised + revalidated, and the curated
// result is preserved) — it never fabricates a pass and never deploys/publishes anything.
//
// NO network, NO secrets, NO install, NO build. By DEFAULT it is READ-ONLY: it prints and
// validates. Always exits 0 — an advisory/visibility tool, not a gate.
//
// Modes:
//   (default)  human-readable text block + validation result on stdout
//   --json     machine-readable dashboard-smoke-state object on stdout
//   --write    (re)write DASHBOARD_SMOKE_STATE.json as the NORMALISED committed record (or an
//              UNKNOWN template for the current config version if the file is missing/garbled).
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDashboardSmokeState, formatDashboardSmokeState, validateDashboardSmokeState,
  DASHBOARD_SMOKE_FILE, DASHBOARD_SMOKE_RESULTS,
} from './dashboardSmokeState.mjs';

const ROOT = process.cwd();

function readSafe(rel) {
  try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return null; }
}

function configVersion() {
  const m = (readSafe('src/config.js') || '').match(/VERSION\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

// Load the committed dashboard-smoke state if present (re-shaped through buildDashboardSmokeState so
// a hand-edited file is normalised + safe to render); otherwise synthesise the default UNKNOWN
// record for the current version. Never throws.
function loadOrDefault() {
  const raw = readSafe(DASHBOARD_SMOKE_FILE);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      return buildDashboardSmokeState({
        result: p.result, version: p.version, commit: p.commit, dashboardUrl: p.dashboardUrl,
        surface: p.surface, smokedAt: p.smokedAt, smokedBy: p.smokedBy, checks: p.checks,
        notes: p.notes, generatedAt: p.generatedAt,
      });
    } catch { /* fall through to default */ }
  }
  return buildDashboardSmokeState({ result: DASHBOARD_SMOKE_RESULTS.UNKNOWN, version: configVersion() });
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
})();

if (invokedDirectly) {
  const args = process.argv.slice(2);
  const writing = args.includes('--write');
  const asJson = args.includes('--json');

  // --write re-persists the NORMALISED committed record (preserving the curated result), so a
  // hand-edit is canonicalised and revalidated. It cannot fabricate a pass: validateDashboardSmokeState
  // still rejects an unsupported 'pass'. A missing/garbled file falls back to an UNKNOWN template.
  const state = loadOrDefault();
  const json = JSON.stringify(state, null, 2) + '\n';

  if (writing) {
    const outPath = join(ROOT, DASHBOARD_SMOKE_FILE);
    writeFileSync(outPath, json);
    const { ok, errors } = validateDashboardSmokeState(state);
    console.log('');
    console.log(`dashboard-smoke-state: wrote ${DASHBOARD_SMOKE_FILE} (result=${state.result})${ok ? ' (valid)' : ` (INVALID: ${errors.join('; ')})`}`);
    console.log('');
    process.exit(0);
  }

  if (asJson) {
    process.stdout.write(json);
    process.exit(0);
  }

  console.log('');
  console.log(formatDashboardSmokeState(state));
  console.log('');
  process.exit(0);
}

export { loadOrDefault };

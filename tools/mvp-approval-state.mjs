// tools/mvp-approval-state.mjs — local MVP APPROVAL STATE CLI (v0.2.220).
// Run with: node tools/mvp-approval-state.mjs  (or: npm run approval:state).
// Reads / renders / validates the single auditable MVP approval record
// (MVP_APPROVAL_STATE.json). This is the ONE place an "MVP approved" decision is recorded, so a
// future approval flips one state source instead of editing scattered docs.
//
// IMPORTANT — this slice NEVER marks the MVP approved. There is no --approve path here on
// purpose: status stays 'pending' until a human explicitly approves, and that approval must
// carry approved_by + approved_at (enforced by validateApprovalState). The pure
// shaping/validation lives in mvpApproval.mjs (unit-tested); this file only does the fs/git I/O
// and the (flag-gated, in-repo) WRITE of the canonical PENDING template.
//
// NO network, NO secrets, NO install, NO build. By DEFAULT it is READ-ONLY: it prints and
// validates. It only writes when explicitly asked with --write, and only to the canonical
// in-repo path (MVP_APPROVAL_STATE.json), and only ever writes a 'pending' record. Always exits
// 0 — an advisory/visibility tool, not a gate.
//
// Modes:
//   (default)  human-readable text block + validation result on stdout
//   --json     machine-readable approval-state object on stdout
//   --write    (re)write MVP_APPROVAL_STATE.json as a PENDING record carrying the current
//              config version, then print where. Deterministic (no commit/timestamp baked in)
//              so the committed template never churns the tree.
import { readFileSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildApprovalState, formatApprovalState, validateApprovalState,
  MVP_APPROVAL_FILE, MVP_APPROVAL_STATUSES,
} from './mvpApproval.mjs';

const ROOT = process.cwd();

function readSafe(rel) {
  try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return null; }
}

function configVersion() {
  const m = (readSafe('src/config.js') || '').match(/VERSION\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

// Load the committed approval state if present (re-shaped through buildApprovalState so a hand-
// edited file is normalised + safe to render); otherwise synthesise the default PENDING record
// for the current version. Never throws.
function loadOrDefault() {
  const raw = readSafe(MVP_APPROVAL_FILE);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return buildApprovalState({
        status: parsed.status,
        version: parsed.version,
        commit: parsed.commit,
        approved_by: parsed.approved_by,
        approved_at: parsed.approved_at,
        notes: parsed.notes,
        generatedAt: parsed.generatedAt,
      });
    } catch { /* fall through to default */ }
  }
  return buildApprovalState({ status: MVP_APPROVAL_STATUSES.PENDING, version: configVersion() });
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
})();

if (invokedDirectly) {
  const args = process.argv.slice(2);
  const writing = args.includes('--write');
  const asJson = args.includes('--json');

  // --write always emits a fresh PENDING template for the current version — this tool cannot
  // record an approval. The on-disk approver fields (if any) are intentionally dropped so a
  // write can never preserve a half-recorded approval.
  const state = writing
    ? buildApprovalState({ status: MVP_APPROVAL_STATUSES.PENDING, version: configVersion() })
    : loadOrDefault();
  const json = JSON.stringify(state, null, 2) + '\n';

  if (writing) {
    const outPath = join(ROOT, MVP_APPROVAL_FILE);
    writeFileSync(outPath, json);
    const { ok, errors } = validateApprovalState(state);
    console.log('');
    console.log(`mvp-approval-state: wrote ${MVP_APPROVAL_FILE} (status=${state.status})${ok ? ' (valid)' : ` (INVALID: ${errors.join('; ')})`}`);
    console.log('');
    process.exit(0);
  }

  if (asJson) {
    process.stdout.write(json);
    process.exit(0);
  }

  console.log('');
  console.log(formatApprovalState(state));
  console.log('');
  process.exit(0);
}

export { loadOrDefault };

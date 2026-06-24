// engine/nostr/leaderboardView.js — read-only leaderboard DISPLAY shell (LB-1
// continuation, v0.2.136). Turns a list of run scores into a ranked, render-ready
// table for an in-world board or a debug HUD, and offers a build-only PREVIEW of
// the Nostr events that *would* be published — without ever signing or shipping.
//
// Pure + node-safe: NO Nostr client, NO relay I/O, NO signing, NO key handling.
// The preview drives createLeaderboardPublisher in its DEFAULT build-only mode
// (no signer, no publisher injected), so it can only ever return unsigned
// templates. `mode` is 'mock' | 'build' — there is deliberately no 'live' mode
// here; real signing/publishing is a separate, audited host step.

import { buildScore, validateScore } from './leaderboard.js';
import { createLeaderboardPublisher } from './leaderboardPublisher.js';

// Allowed display modes — no 'live'/relay mode by construction.
export const VIEW_MODES = Object.freeze(['mock', 'build']);

// accuracyLabel(accuracy) → a percentage string ('73.4%'). Pure; clamps a
// non-finite value to '0.0%'.
export function accuracyLabel(accuracy) {
  if (!Number.isFinite(accuracy)) return '0.0%';
  return `${(accuracy * 100).toFixed(1)}%`;
}

// Deterministic ranking: higher score first; ties broken by kills, then
// headshots, then runId (string) so the order is stable across runs.
function _compareScores(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (b.kills !== a.kills) return b.kills - a.kills;
  if (b.headshots !== a.headshots) return b.headshots - a.headshots;
  return String(a.runId).localeCompare(String(b.runId));
}

// rankScores(statsList) → { rows, skipped }. Normalises + validates each entry,
// drops invalid ones into `skipped` (with errors), sorts the rest deterministically
// and assigns 1-based ranks. Pure — never throws.
export function rankScores(statsList = []) {
  const list = Array.isArray(statsList) ? statsList : [];
  const valid = [];
  const skipped = [];
  for (const stats of list) {
    const score = buildScore(stats);
    const { valid: ok, errors } = validateScore(score);
    if (ok) valid.push(score);
    else skipped.push({ runId: score.runId, errors });
  }
  valid.sort(_compareScores);
  const rows = valid.map((s, i) => ({
    rank: i + 1,
    runId: s.runId,
    score: s.score,
    kills: s.kills,
    headshots: s.headshots,
    accuracyLabel: accuracyLabel(s.accuracy),
    version: s.version,
  }));
  return { rows, skipped };
}

// leaderboardView(statsList, { mode }) → a render-ready board view-model:
//   { mode, rows, count, skipped }
// `mode` must be one of VIEW_MODES (defaults to 'mock'); anything else throws so
// a caller can't accidentally ask for a non-existent 'live' relay mode here.
export function leaderboardView(statsList = [], { mode = 'mock' } = {}) {
  if (!VIEW_MODES.includes(mode)) {
    throw new Error(`leaderboardView mode must be one of ${VIEW_MODES.join('/')}`);
  }
  const { rows, skipped } = rankScores(statsList);
  return { mode, rows, count: rows.length, skipped };
}

// leaderboardPreview(statsList) → { mode:'build', signed:false, published:false,
// entries } where each entry is the publisher's build-only result (the unsigned
// kind-30000 template) or a captured error for an invalid score. Uses a publisher
// with NO signer/publisher, so it can NEVER sign or ship. Async to match the
// publisher adapter's contract. Pure w.r.t. the outside world (no I/O).
export async function leaderboardPreview(statsList = []) {
  const publisher = createLeaderboardPublisher(); // build-only: no sign, no publish
  const list = Array.isArray(statsList) ? statsList : [];
  const entries = [];
  for (const stats of list) {
    try {
      const result = await publisher.publishScore(stats); // throws only on invalid score
      entries.push({ runId: result.template.tags[0][1], ok: true, template: result.template });
    } catch (e) {
      entries.push({ runId: stats?.runId ?? null, ok: false, errors: [e?.message || String(e)] });
    }
  }
  return { mode: 'build', signed: false, published: false, entries };
}

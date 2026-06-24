// engine/nostr/leaderboard.js — pure Nostr leaderboard score-event helpers
// (LB-1 skeleton, v0.2.134). Build + validate the CONTENT and TAGS of a run-score
// event for a minimal kill/headshot/accuracy/score leaderboard.
//
// Pure + node-safe: NO Nostr client, NO relay I/O, NO signing, NO publishing,
// NO DOM. These helpers shape the *unsigned event template* only — the host (with
// the player's key) signs and publishes it later, out of this module. Keeping the
// shape pure means it is node-testable and the signing/relay layer can be added
// without touching the schema.

import { VERSION } from '../../config.js';

// Addressable (parameterised replaceable) event kind for a per-run score, so a
// player's latest run for a given runId replaces the prior one (NIP-01 30000-
// range + a `d` tag). Persistent leaderboard storage is LB-1 follow-up work.
export const LEADERBOARD_KIND = 30000;

// The score fields a leaderboard entry carries.
export const SCORE_FIELDS = Object.freeze([
  'runId', 'score', 'kills', 'headshots', 'accuracy', 'version',
]);

function _isInt(v) { return Number.isInteger(v); }
function _isNonNegInt(v) { return _isInt(v) && v >= 0; }

// buildScore(stats) → a normalised score object. Pure: fills version from the
// build, defaults counters to 0, leaves accuracy as given (0..1). Does NOT
// validate (call validateScore) so callers can build-then-inspect.
export function buildScore(stats = {}) {
  const {
    runId = null,
    score = 0,
    kills = 0,
    headshots = 0,
    accuracy = 0,
    version = VERSION,
  } = stats;
  return { runId, score, kills, headshots, accuracy, version };
}

// validateScore(score) → { valid, errors }. Pure, never throws. A leaderboard
// entry needs a runId, non-negative integer counters, a sane accuracy (0..1),
// and headshots must not exceed kills.
export function validateScore(score) {
  const errors = [];
  if (!score || typeof score !== 'object') {
    return { valid: false, errors: ['score must be an object'] };
  }
  if (score.runId == null || score.runId === '') errors.push('missing required field: runId');
  if (!_isNonNegInt(score.score)) errors.push('score must be a non-negative integer');
  if (!_isNonNegInt(score.kills)) errors.push('kills must be a non-negative integer');
  if (!_isNonNegInt(score.headshots)) errors.push('headshots must be a non-negative integer');
  if (_isNonNegInt(score.kills) && _isNonNegInt(score.headshots) && score.headshots > score.kills) {
    errors.push('headshots cannot exceed kills');
  }
  if (!(Number.isFinite(score.accuracy) && score.accuracy >= 0 && score.accuracy <= 1)) {
    errors.push('accuracy must be a number in [0, 1]');
  }
  return { valid: errors.length === 0, errors };
}

// buildScoreEventTemplate(stats) → { kind, content, tags } — an UNSIGNED Nostr
// event template (no pubkey/id/sig/created_at; the signer adds those). The score
// goes into JSON content; key fields are mirrored into indexable tags so relays
// can filter/sort. Throws on an invalid score so a bad entry fails fast rather
// than being published malformed.
export function buildScoreEventTemplate(stats = {}) {
  const score = buildScore(stats);
  const { valid, errors } = validateScore(score);
  if (!valid) throw new Error('invalid leaderboard score: ' + errors.join('; '));

  return {
    kind: LEADERBOARD_KIND,
    content: JSON.stringify(score),
    tags: [
      ['d', String(score.runId)],          // addressable identifier (the run)
      ['score', String(score.score)],
      ['kills', String(score.kills)],
      ['headshots', String(score.headshots)],
      ['accuracy', score.accuracy.toFixed(4)],
      ['version', score.version],
      ['t', 'torii-quest'],                // topic tag for discovery
    ],
  };
}

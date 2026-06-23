// engine/combat/shotDiagnostics.js — pure shot-outcome / miss-reason classifier
// (SDK boundary, v0.2.124). Target-practice diagnostics: given what the player's
// AIM line was on (the crosshair / reticle ray, from the CAMERA) and what the
// shot actually RESOLVED to (the bullet line, fired from the gun barrel toward
// the convergence point), name WHY a shot did or didn't land.
//
// This exists because the reticle preview (targetReticle.js) is an instantaneous
// hitscan ray from the camera, while the player bullet is a travelling projectile
// fired from a barrel offset toward an 80 m convergence point. The two lines only
// coincide near the convergence distance, and the bot can move during the
// projectile's flight — so a green/👌 reticle can still produce a miss, especially
// at range. Categorising aim-vs-outcome makes those misses explainable instead of
// "the game just ate my shot".
//
// PURE: no Three.js / Rapier / browser. Inputs are plain data shaped like
//   { kind: 'bot'|'wall'|'crate'|'ground'|'none', isHead: bool, dist: number }
// so this file is unit-testable in a plain node environment. classifyShotOutcome
// allocates one small result object PER CALL — fine on the per-shot path
// (weapons.js calls it at most a couple of times per trigger pull), never per
// frame.

export const SHOT_REASON = Object.freeze({
  HEAD:         'head',          // bullet struck the bot head sphere
  BODY:         'body',          // bullet struck the bot torso/body
  HEAD_TO_BODY: 'head-to-body',  // aimed at head, bullet landed on the body
  BLOCKED:      'blocked',       // geometry between you and the aimed bot took it
  MOVED_OR_OFFSET: 'moved-or-offset', // aimed at a live bot, bullet hit no bot
  AIM_OFF:      'aim-off',       // crosshair was not on a live bot at all
});

const LABELS = Object.freeze({
  [SHOT_REASON.HEAD]:         'Headshot — bullet struck the head sphere.',
  [SHOT_REASON.BODY]:         'Body hit.',
  [SHOT_REASON.HEAD_TO_BODY]: 'Aimed at the head but hit the body — barrel offset or target motion dropped it to the torso.',
  [SHOT_REASON.BLOCKED]:      'Blocked — geometry between you and the target took the round.',
  [SHOT_REASON.MOVED_OR_OFFSET]: 'Missed a bot you were aiming at — the target likely moved out of the projectile path (distance/lead) or the barrel/convergence offset carried the bullet wide.',
  [SHOT_REASON.AIM_OFF]:      'Crosshair was not on a live bot — genuine aim miss.',
});

export function reasonLabel(reason) { return LABELS[reason] || 'Unknown.'; }

// Distance slack (m) when deciding whether geometry blocked the shot: the
// blocking hit must be meaningfully CLOSER than the aimed bot to count as a
// block rather than the bullet sailing past into far geometry.
export const BLOCK_SLACK = 0.25;

// aim     — what the camera/crosshair ray was on at fire time.
// outcome — what the bullet actually resolved to (bot hit, geometry, or none).
// Both are { kind, isHead, dist } (extra fields ignored). Returns
//   { reason, label }.
export function classifyShotOutcome(aim, outcome) {
  const a = aim || { kind: 'none', isHead: false, dist: Infinity };
  const o = outcome || { kind: 'none', isHead: false, dist: Infinity };
  const aimOnBot = a.kind === 'bot';
  const hitBot   = o.kind === 'bot';

  let reason;
  if (hitBot) {
    if (o.isHead) reason = SHOT_REASON.HEAD;
    else if (aimOnBot && a.isHead) reason = SHOT_REASON.HEAD_TO_BODY;
    else reason = SHOT_REASON.BODY;
  } else if (!aimOnBot) {
    reason = SHOT_REASON.AIM_OFF;
  } else {
    // Aimed at a live bot but the bullet connected with no bot. Was something
    // closer in the way (blocked), or did it sail past / wide (moved/offset)?
    const blocked = o.kind !== 'none' &&
      Number.isFinite(o.dist) && Number.isFinite(a.dist) &&
      o.dist < a.dist - BLOCK_SLACK;
    reason = blocked ? SHOT_REASON.BLOCKED : SHOT_REASON.MOVED_OR_OFFSET;
  }
  return { reason, label: LABELS[reason] };
}

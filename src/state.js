// state.js — single source of truth. No state lives elsewhere.
import { ENTRY_SATS, PLAYER_HP, MAX_AMMO } from './config.js';
import { emit, EV } from './events.js';

export const PHASE = Object.freeze({
  TITLE: 'title', PLAYING: 'playing',
  DEAD: 'dead', PAUSED: 'paused', GAMEOVER: 'gameover',
});
// GAMEOVER is reserved for a future end-of-run screen; nothing transitions into
// it yet (no edge in the table below). Kept for compatibility.

export const state = {
  phase:      PHASE.TITLE,
  hp:         PLAYER_HP,
  sats:       ENTRY_SATS,
  kills:      0,
  deaths:     0,
  hits:       0,
  ammo:       MAX_AMMO,
  reloading:  false,
  reloadTimer:0,
  shootCd:    0,
  respawnTimer:0,
  paused:     false,
  pointerLocked: false,
  nostrPubkey:  null,
  nostrName:    'ANON',
  nostrProfile: null,
  nostrAvatar:   null,
  remotePlayers: new Map(),
};

export function resetRun() {
  state.hp      = PLAYER_HP;
  state.sats    = ENTRY_SATS;
  state.kills   = 0;
  state.hits    = 0;
  state.ammo    = MAX_AMMO;
  state.reloading  = false;
  state.reloadTimer = 0;
  state.shootCd = 0;
}

// ── Explicit game-state machine (v0.2.115, first slice) ────────────────────
// Groundwork for TODO #8. `state.phase` is unchanged; this adds ONE place that
// describes the legal flow so call sites stop hand-rolling `if (phase !== X)`
// guards. Behaviour is identical: the table below mirrors the exact guards the
// call sites used before it existed.

// Canonical transition events — the phase only ever changes via one of these.
export const GAME_EVENT = Object.freeze({
  ENTER:   'enter',    // TITLE   → PLAYING  (Enter Arena)
  PAUSE:   'pause',    // PLAYING → PAUSED   (ESC / pointer-lock loss)
  RESUME:  'resume',   // PAUSED  → PLAYING  (ESC / Resume button)
  HOME:    'home',     // PAUSED  → TITLE    (Home button)
  DIE:     'die',      // PLAYING → DEAD     (hp <= 0)
  RESPAWN: 'respawn',  // DEAD    → PLAYING  (respawn timer elapsed)
});

// phase → (event → nextPhase). An event not listed for the current phase is an
// illegal transition and is rejected (phase unchanged).
const TRANSITIONS = Object.freeze({
  [PHASE.TITLE]:    { [GAME_EVENT.ENTER]:   PHASE.PLAYING },
  [PHASE.PLAYING]:  { [GAME_EVENT.PAUSE]:   PHASE.PAUSED,  [GAME_EVENT.DIE]: PHASE.DEAD },
  [PHASE.PAUSED]:   { [GAME_EVENT.RESUME]:  PHASE.PLAYING, [GAME_EVENT.HOME]: PHASE.TITLE },
  [PHASE.DEAD]:     { [GAME_EVENT.RESPAWN]: PHASE.PLAYING },
  [PHASE.GAMEOVER]: {},
});

// nextPhase(event) → the phase this event leads to from the CURRENT phase, or
// null if it is not legal right now. Pure; never mutates.
export function nextPhase(event) {
  const row = TRANSITIONS[state.phase];
  return (row && row[event]) || null;
}

// canTransition(event) → would this event be accepted from the current phase?
export function canTransition(event) { return nextPhase(event) !== null; }

// transition(event) → apply the transition if legal. Returns true if the phase
// changed, false (no change) otherwise — so callers can early-return and skip
// their side effects exactly as the old `if (phase !== X) return;` guards did.
// On a real change it publishes EV.PHASE_CHANGE so other modules can react to
// the phase flow without polling. Transitions are discrete (enter/pause/resume/
// die/respawn), never per-frame, so the small payload object is not a hot-path
// allocation. There are no subscribers yet, so this is behaviour-preserving.
export function transition(event) {
  const next = nextPhase(event);
  if (!next) return false;
  const from = state.phase;
  state.phase = next;
  emit(EV.PHASE_CHANGE, { from, to: next, event });
  return true;
}

// ── Phase predicates ───────────────────────────────────────────────────────
export const isTitle    = () => state.phase === PHASE.TITLE;
export const isPlaying  = () => state.phase === PHASE.PLAYING;
export const isPaused   = () => state.phase === PHASE.PAUSED;
export const isDead     = () => state.phase === PHASE.DEAD;
export const isGameover = () => state.phase === PHASE.GAMEOVER;
// "Live" = the world ticks/renders with the player in it: PLAYING or the brief
// DEAD death-cam before respawn. Used by the render gate.
export const isLive     = () => state.phase === PHASE.PLAYING || state.phase === PHASE.DEAD;

// events.js — event bus. Modules never import each other directly.
const _listeners = {};
export const EV = Object.freeze({
  HUD_UPDATE:     'hud:update',
  PLAYER_HIT:     'player:hit',
  PLAYER_KILLED:  'player:killed',
  PLAYER_RESPAWN: 'player:respawn',
  BOT_HIT:        'bot:hit',
  BOT_KILLED:     'bot:killed',
  SHOOT:          'player:shoot',
  NOSTR_LOGIN:    'nostr:login',
  PHASE_CHANGE:   'game:phase',
  WS_PLAYER_HIT:  'ws:playerHit',
  WS_CHAT:        'ws:chat',
});
export function on(ev, fn)  { (_listeners[ev] ||= []).push(fn); }
export function off(ev, fn) { _listeners[ev] = (_listeners[ev]||[]).filter(f=>f!==fn); }
export function emit(ev, data) { (_listeners[ev]||[]).forEach(fn => fn(data)); }

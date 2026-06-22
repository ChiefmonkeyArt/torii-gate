// state.js — single source of truth. No state lives elsewhere.
import { ENTRY_SATS, PLAYER_HP, MAX_AMMO } from './config.js';

export const PHASE = Object.freeze({
  TITLE: 'title', PLAYING: 'playing',
  DEAD: 'dead', PAUSED: 'paused', GAMEOVER: 'gameover',
});

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

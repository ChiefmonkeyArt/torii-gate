// engine/debug/toriiDebug.js — deliberate, namespaced alpha debug API.
// v0.2.110. Replaces the habit of sprinkling random `window._foo` globals with
// a single discoverable `window.ToriiDebug` surface. Debug tools ship
// UNCONDITIONALLY in alpha (no flag gate) — this is intentional for a public
// alpha so testers and FOSS contributors can poke at the live game.
//
// Backwards compatibility: the pre-existing functional globals are LEFT IN
// PLACE because they are load-bearing wiring, not just debug taps:
//   • window._onBotHit   — DEPRECATED (v0.2.117). The internal weapons.js → main.js
//                          bot-hit bridge now runs over the event bus
//                          (EV.BOT_HIT_BY_PLAYER). This global remains ONLY as a
//                          documented debug tap that forwards onto the bus, so
//                          console/tester calls keep working. Internal code must
//                          not call it (regression check [9]).
//   • window._grassMat    — arena-foliage.js shader, ticked by main.js each frame
//   • window._flowerMat   — arena-foliage.js shader, ticked by main.js each frame
//   • window._mirrorMesh  — mirror.js Reflector handle
// ToriiDebug MIRRORS these (read-only convenience) under ToriiDebug.fx /
// ToriiDebug.world so they are discoverable from one namespace, but the
// originals keep working so nothing breaks.
//
// `refs` is injected by main.js (which already imports every subsystem) so this
// module stays dependency-light and free of circular imports. The world/identity
// skeletons are imported directly because they are pure + inert (no game-module
// deps, nothing fires on import) — exposing them here makes the foundation
// boundaries discoverable and manually testable from the console.
import * as napZone from '../../world/napZone.js';
import * as handoff from '../../world/handoff.js';
import * as presence from '../../identity/presence.js';

export function installToriiDebug(refs) {
  const {
    version, bots, hitBot, playerObj, resetPlayerPos,
    castRay, castRayStatic, hasLineOfSight, getWorld, getLastHit,
  } = refs;

  const api = {
    version,

    bots: {
      get list()  { return bots; },
      get count() { return bots.filter(b => b.alive).length; },
      // Damage the i-th bot by n (defaults to a lethal-ish 5). Returns the bot.
      damage(i = 0, n = 5) {
        const b = bots[i];
        if (b) hitBot(b, n);
        return b || null;
      },
    },

    player: {
      get position() { return playerObj.position; },
      resetToArena() { resetPlayerPos(); },
    },

    physics: {
      raycast: castRay,
      raycastStatic: castRayStatic,
      lineOfSight: hasLineOfSight,
      get world() { return getWorld(); },
    },

    world: {
      get mirror() { return window._mirrorMesh || null; },
      // Foundation skeletons (inert): zone metadata + local handoff helpers.
      napZone,
      handoff,
    },

    // Identity skeletons (inert): presence/discovery, disabled by default.
    identity: { presence },

    fx: {
      get grass()  { return window._grassMat  || null; },
      get flower() { return window._flowerMat || null; },
    },

    // Combat — last bot-hit classification (impact Y, foot Y, neck-line, head
    // sphere proximity, resolved part vs final class, damage). For tuning the
    // headshot/body thresholds live from the console after a shot.
    combat: {
      get lastHit() { return getLastHit ? getLastHit() : null; },
    },
  };

  window.ToriiDebug = api;
  return api;
}

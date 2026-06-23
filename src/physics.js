// physics.js — Rapier world + kinematic character controller.
// v0.2.61-alpha (Rapier Phase 1): player movement is now driven by Rapier's
// KinematicCharacterController. Static colliders for arena, NAP floor, walls
// (with east-gate gap), CRATES and OBSTACLES are built from config so the
// physics world matches the visual + gameplay arena 1:1.
//
// v0.2.110: body/collider factories were extracted to engine/physics/bodies.js
// and the raycast layer to engine/physics/raycast.js. This module owns the
// world + character controller and wires those modules at init. All previously
// exported symbols are RE-EXPORTED here unchanged, so every existing
// `from './physics.js'` import keeps working with identical behaviour.
//
// Capsule convention: Rapier capsule(halfHeight, radius). Total height =
// 2*(halfHeight + radius). Player body is positioned at the *capsule centre*
// (foot + halfHeight + radius), NOT the eye. player.js maps body↔eye.
import { ARENA_HALF, WALL_H, NAP_X, NAP_FAR_X, CRATES, OBSTACLES } from './config.js';
import { initBodies, createStatic } from './engine/physics/bodies.js';
import { initRaycast } from './engine/physics/raycast.js';

// Re-export the SDK boundary surface so existing import sites are unchanged.
export {
  createKinematic, createDynamic, createBotBody, createBotHead, setBotBodyPos,
  createStatic, createDynamicCrate, getBotForColliderHandle, getBodyPartForColliderHandle,
  PLAYER_CAPSULE_HALF_H, PLAYER_CAPSULE_RADIUS, PLAYER_BODY_CENTRE_OFFSET,
  BOT_BODY_HALF_H, BOT_BODY_RADIUS, BOT_BODY_CENTRE_Y_OFFSET,
  BOT_HEAD_RADIUS, BOT_HEAD_CENTRE_Y_OFFSET,
} from './engine/physics/bodies.js';
export { castRay, castRayStatic, hasLineOfSight } from './engine/physics/raycast.js';

let world, RAPIER;
let _controller = null;
export let physicsReady = false;

export function getWorld() { return world || null; }

export async function initPhysics() {
  RAPIER = await import('@dimforge/rapier3d-compat');
  await RAPIER.init();
  world = new RAPIER.World({ x:0, y:-25, z:0 });

  // Wire the extracted SDK modules with the live world + RAPIER handles.
  initBodies(world, RAPIER);
  initRaycast(world, RAPIER);

  // Character controller — 0.05 offset is the recommended "skin" gap.
  _controller = world.createCharacterController(0.05);
  _controller.setUp({ x: 0, y: 1, z: 0 });
  _controller.setSlideEnabled(true);
  _controller.setApplyImpulsesToDynamicBodies(true);
  // Snap-to-ground keeps the player glued to slopes/steps when walking down.
  _controller.enableSnapToGround(0.2);
  // Allow stepping over small bumps (future-proofing for crate edges, stairs).
  _controller.enableAutostep(0.3, 0.2, true);
  // Climb up to 45° slopes; slide off anything steeper.
  _controller.setMaxSlopeClimbAngle(Math.PI / 4);

  physicsReady = true;
  return world;
}

export function stepPhysics() { if (world) world.step(); }

// ── Character controller movement ───────────────────────────────────────────
// player.js calls this each frame with the desired XYZ delta. Rapier slides
// the capsule against obstacles and returns the actual delta + grounded flag.
const _zero = { x: 0, y: 0, z: 0 };
export function movePlayer(playerCollider, desiredDX, desiredDY, desiredDZ) {
  if (!_controller || !playerCollider) {
    return { dx: desiredDX, dy: desiredDY, dz: desiredDZ, grounded: false };
  }
  _zero.x = desiredDX; _zero.y = desiredDY; _zero.z = desiredDZ;
  _controller.computeColliderMovement(playerCollider, _zero);
  const m = _controller.computedMovement();
  return { dx: m.x, dy: m.y, dz: m.z, grounded: _controller.computedGrounded() };
}

// ── Arena collider build ────────────────────────────────────────────────────
// Drives off the SAME config the renderer + manual physics used, so Rapier
// sees the exact arena the player sees. Includes the NAP-zone floor and the
// split east-wall segments (gate gap is a real hole in the collider, not just
// in the manual code path).
export function buildArenaColliders() {
  // Floors — arena + NAP zone. Both at y=-0.1 (top surface at y=0).
  // Arena floor: full ARENA_HALF square centred at origin.
  createStatic(ARENA_HALF, 0.1, ARENA_HALF, 0, -0.1, 0);
  // NAP floor: rectangle from x=NAP_X to x=NAP_FAR_X, same z-extent as arena.
  const napHalfW = (NAP_FAR_X - NAP_X) / 2;
  const napMidX  = (NAP_FAR_X + NAP_X) / 2;
  createStatic(napHalfW, 0.1, ARENA_HALF, napMidX, -0.1, 0);

  // Walls — north, south, west are solid full-length planes.
  // East wall is split into two segments to leave the gate gap.
  createStatic(ARENA_HALF + 0.3, WALL_H / 2, 0.25, 0, WALL_H / 2, -ARENA_HALF); // north
  createStatic(ARENA_HALF + 0.3, WALL_H / 2, 0.25, 0, WALL_H / 2,  ARENA_HALF); // south
  createStatic(0.25, WALL_H / 2, ARENA_HALF + 0.3, -ARENA_HALF, WALL_H / 2, 0); // west

  // East wall: two segments flanking the gate. Geometry already lives in
  // OBSTACLES (split at EAST_GAP_HALF). We add them below in the OBSTACLES
  // loop, so don't add a solid east plane here.

  // CRATES — visual + collidable cover.
  for (const [cx, cz, hw, hd, ch] of CRATES) {
    createStatic(hw, ch / 2, hd, cx, ch / 2, cz);
  }
  // OBSTACLES — collision-only (tree trunk, torii pillars, east wall segments).
  for (const [cx, cz, hw, hd, ch] of OBSTACLES) {
    createStatic(hw, ch / 2, hd, cx, ch / 2, cz);
  }
}

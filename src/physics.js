// physics.js — Rapier world + kinematic character controller.
// v0.2.61-alpha (Rapier Phase 1): player movement is now driven by Rapier's
// KinematicCharacterController. Static colliders for arena, NAP floor, walls
// (with east-gate gap), CRATES and OBSTACLES are built from config so the
// physics world matches the visual + gameplay arena 1:1.
//
// Capsule convention: Rapier capsule(halfHeight, radius). Total height =
// 2*(halfHeight + radius). Player body is positioned at the *capsule centre*
// (foot + halfHeight + radius), NOT the eye. player.js maps body↔eye.
import { ARENA_HALF, WALL_H, NAP_X, NAP_FAR_X, EAST_GAP_HALF, CRATES, OBSTACLES } from './config.js';

let world, RAPIER;
let _controller = null;
export let physicsReady = false;

// Collider → bot map, populated by createBotBody(). Used by the bullet raycast
// to translate a Rapier hit into a game-side bot reference. Keyed by collider
// handle (integer), value is the bot object passed to createBotBody.
const _colliderToBot = new Map();

// Player capsule geometry — matches PLAYER_RADIUS (0.35). 1.8m total height.
export const PLAYER_CAPSULE_HALF_H = 0.55;
export const PLAYER_CAPSULE_RADIUS = 0.35;
// Body centre sits this far above the foot.
export const PLAYER_BODY_CENTRE_OFFSET = PLAYER_CAPSULE_HALF_H + PLAYER_CAPSULE_RADIUS; // 0.9

export async function initPhysics() {
  RAPIER = await import('@dimforge/rapier3d-compat');
  await RAPIER.init();
  world = new RAPIER.World({ x:0, y:-25, z:0 });

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

// ── Body factories ──────────────────────────────────────────────────────────
// Kinematic = position-based, driven by setNextKinematicTranslation each
// frame. The character controller computes the corrected delta; we apply it.
export function createKinematic(x, y, z) {
  if (!world) return null;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z)
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(PLAYER_CAPSULE_HALF_H, PLAYER_CAPSULE_RADIUS),
    body
  );
  return { body, collider };
}

export function createDynamic(x, y, z) {
  if (!world) return null;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).lockRotations()
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(PLAYER_CAPSULE_HALF_H, PLAYER_CAPSULE_RADIUS),
    body
  );
  return { body, collider };
}

// Bot body — kinematic capsule. Position is teleported by bots.js each frame
// (bots use their own AI movement, not the character controller). Capsule
// dimensions match the bot hit cylinder (footY -0.1 to 1.95 = ~2m tall,
// radius 0.4 lateral). halfHeight 0.6 + radius 0.4 = 2m total.
export function createBotBody(bot, x, y, z) {
  if (!world) return null;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z)
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.6, 0.4),
    body
  );
  _colliderToBot.set(collider.handle, bot);
  return { body, collider };
}

export function getBotForColliderHandle(h) {
  return _colliderToBot.get(h) || null;
}

// Move a bot's kinematic body to a new position (teleport-style — bots don't
// use the character controller). Y is the body CENTRE, so caller passes
// (botFootY + 1.0) for a 2m capsule.
export function setBotBodyPos(body, x, y, z) {
  if (body) body.setNextKinematicTranslation({ x, y, z });
}

export function createStatic(hw, hh, hd, x, y, z) {
  if (!world) return;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(hw, hh, hd).setTranslation(x, y, z)
  );
}

// ── Raycast ──────────────────────────────────────────────────────────────────────────────────────
// Cast a ray and return the closest hit. `excludeCollider` is optional; pass
// the player's own collider for player bullets, or the firing bot's collider
// for bot bullets, so the projectile never self-hits. Returns:
//   null                                            — no hit within maxDist
//   { toi, point:{x,y,z}, collider, bot:Bot|null }  — closest hit
// `toi` is time-of-impact in the same units as the ray dir's length, i.e. if
// dir is a unit vector then toi is metres along the ray.
const _rayHitPoint = { x: 0, y: 0, z: 0 };
let _rayCache = null;
export function castRay(ox, oy, oz, dx, dy, dz, maxDist, excludeCollider = null) {
  if (!world || !RAPIER) return null;
  // Reuse the Ray object — Rapier copies the values, safe to mutate.
  if (!_rayCache) _rayCache = new RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz });
  _rayCache.origin.x = ox; _rayCache.origin.y = oy; _rayCache.origin.z = oz;
  _rayCache.dir.x    = dx; _rayCache.dir.y    = dy; _rayCache.dir.z    = dz;

  // Signature: (ray, maxToi, solid, filterFlags?, filterGroups?,
  //             filterExcludeCollider?, filterExcludeRigidBody?, filterPredicate?)
  const hit = world.castRayAndGetNormal(
    _rayCache, maxDist, true,
    undefined, undefined,
    excludeCollider || undefined,   // exclude the firing entity's own collider
    undefined, undefined,
  );
  if (!hit) return null;
  _rayHitPoint.x = ox + dx * hit.timeOfImpact;
  _rayHitPoint.y = oy + dy * hit.timeOfImpact;
  _rayHitPoint.z = oz + dz * hit.timeOfImpact;
  return {
    toi:      hit.timeOfImpact,
    point:    _rayHitPoint,
    normal:   hit.normal,
    collider: hit.collider,
    bot:      _colliderToBot.get(hit.collider.handle) || null,
  };
}

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

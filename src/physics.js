// physics.js — Rapier world. Lazy-loaded. createCapsule/createStatic.
let world, RAPIER;
export let physicsReady = false;

export async function initPhysics() {
  RAPIER = await import('@dimforge/rapier3d-compat');
  await RAPIER.init();
  world = new RAPIER.World({ x:0, y:-25, z:0 });
  physicsReady = true;
  return world;
}

export function stepPhysics() { if (world) world.step(); }

export function createKinematic(x, y, z) {
  if (!world) return null;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z)
  );
  world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.35), body);
  return body;
}

export function createDynamic(x, y, z) {
  if (!world) return null;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).lockRotations()
  );
  world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.35), body);
  return body;
}

export function createStatic(hw, hh, hd, x, y, z) {
  if (!world) return;
  world.createCollider(RAPIER.ColliderDesc.cuboid(hw, hh, hd).setTranslation(x, y, z));
}

export function buildArenaColliders(ARENA_HALF, WALL_H) {
  createStatic(ARENA_HALF, 0.1, ARENA_HALF, 0, -0.1, 0);
  createStatic(ARENA_HALF+0.3, WALL_H/2, 0.25, 0, WALL_H/2, -ARENA_HALF);
  createStatic(ARENA_HALF+0.3, WALL_H/2, 0.25, 0, WALL_H/2,  ARENA_HALF);
  createStatic(0.25, WALL_H/2, ARENA_HALF+0.3, -ARENA_HALF, WALL_H/2, 0);
  createStatic(0.25, WALL_H/2, ARENA_HALF+0.3,  ARENA_HALF, WALL_H/2, 0);
  // Cover crates
  [[-8,0.75,-8],[8,0.75,-8],[-8,0.75,8],[8,0.75,8],[0,0.5,0],[-14,1,0],[14,1,0]]
  .forEach(([x,y,z]) => createStatic(0.75, 0.75, 0.75, x, y, z));
}

// player.js — movement, shoot, reload, death/respawn
import * as THREE from 'three';
import { state, PHASE, resetRun } from './state.js';
import { emit, EV } from './events.js';
import { keys, getYaw, getPitch, setYaw, onKeyDown, onShoot, requestLock } from './input.js';
import { scene, camera } from './scene.js';
import { stepPhysics, createKinematic, movePlayer, physicsReady } from './physics.js';
import { getGunBarrelWorld } from './weapons.js';
import { playReload } from './audio.js';
import { PLAYER_HP, PLAYER_SPEED, MAX_AMMO, RELOAD_TIME, SHOOT_CD, RESPAWN_TIME, ARENA_HALF, JUMP_FORCE, GRAVITY, godMode, NAP_X, NAP_FAR_X } from './config.js';
// Player entity boundary (v0.2.114): geometry, spawn shape, and look-down POV
// math live here now. PLAYER_SAFE_CORNER is re-exported below so bots.js can keep
// importing it from player.js.
import {
  EYE, BODY_FROM_EYE,
  SPAWN_X, SPAWN_Y, SPAWN_Z, SPAWN_YAW,
  PLAYER_SAFE_CORNER,
  lookDownEyeY, lookDownEyeZ,
} from './engine/entities/player.js';

export { PLAYER_SAFE_CORNER };


export const playerObj = new THREE.Object3D();
playerObj.add(camera);
scene.add(playerObj);

// Scratch — never allocate in hot path
const _fwd   = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move  = new THREE.Vector3();

let _body = null;
let _collider = null;
let _vy = 0;          // vertical velocity (m/s)
let _onGround = false;
let _recoilTimer = 0;
const RECOIL_DUR = 0.08;

export function initPlayer() {
  playerObj.position.set(0, 1.7, 0);

  onKeyDown(code => {
    if (state.phase !== PHASE.PLAYING) return;
    if (code === 'KeyR') startReload();
    if ((code === 'Space' || code === 'KeyE') && _onGround) {
      _vy = JUMP_FORCE;
      _onGround = false;
    }
  });

  onShoot(() => {
    if (state.phase === PHASE.PLAYING) shoot();
  });
}

export function setPlayerBody(handle) {
  if (!handle) { _body = null; _collider = null; return; }
  _body = handle.body;
  _collider = handle.collider;
}

// Expose player collider so the bullet raycast can exclude it (so player
// bullets never self-hit the player's own capsule). Returns null until
// physics is ready and setPlayerBody has been called from main.js.
export function getPlayerCollider() { return _collider; }

export function spawnPlayerBody() {
  // Body is placed at capsule CENTRE, not eye. visual eye y = SPAWN_Y (1.7);
  // body centre y = SPAWN_Y + BODY_FROM_EYE = 0.9.
  return createKinematic(SPAWN_X, SPAWN_Y + BODY_FROM_EYE, SPAWN_Z);
}

// Dynamic spawn — overridden by main.js before respawn if a better spot is found
let _spawnX = SPAWN_X, _spawnZ = SPAWN_Z, _spawnYaw = SPAWN_YAW;
export function setNextSpawn(x, z, yaw) { _spawnX = x; _spawnZ = z; _spawnYaw = yaw; }

export function resetPlayerPos() {
  playerObj.position.set(_spawnX, SPAWN_Y, _spawnZ);
  if (_body) _body.setTranslation({x:_spawnX, y:SPAWN_Y + BODY_FROM_EYE, z:_spawnZ}, true);
  _vy = 0;
  _onGround = true;
  setYaw(_spawnYaw);
  // Update safe-corner so bots stay clear of the new spawn point
  PLAYER_SAFE_CORNER.x = _spawnX;
  PLAYER_SAFE_CORNER.z = _spawnZ;
}

export function tickPlayer(dt) {
  if (state.phase !== PHASE.PLAYING) return;

  // Rotation from input
  playerObj.rotation.y = getYaw();
  const pitch = getPitch();             // 0 level, → -PI/2 looking straight down
  camera.rotation.x   = pitch;

  // Neck-pivot look-down arc (v0.2.112), now sourced from the player boundary
  // (engine/entities/player.js). Allocation-free scalar helpers; same formula.
  camera.position.y = lookDownEyeY(pitch);
  camera.position.z = lookDownEyeZ(pitch);

  // Movement
  _fwd.set(-Math.sin(getYaw()), 0, -Math.cos(getYaw()));
  _right.set(Math.cos(getYaw()), 0, -Math.sin(getYaw()));
  _move.set(0, 0, 0);

  if (keys['KeyW'] || keys['ArrowUp'])    _move.addScaledVector(_fwd,   1);
  if (keys['KeyS'] || keys['ArrowDown'])  _move.addScaledVector(_fwd,  -1);
  if (keys['KeyA'] || keys['ArrowLeft'])  _move.addScaledVector(_right,-1);
  if (keys['KeyD'] || keys['ArrowRight']) _move.addScaledVector(_right, 1);

  if (_move.lengthSq() > 0) _move.normalize().multiplyScalar(PLAYER_SPEED);

  // --- Rapier kinematic character controller (v0.2.61-alpha Phase 1) ---
  // Replaces the manual AABB pushout. We compute the *desired* delta (XZ from
  // input, Y from gravity), hand it to Rapier, and it returns the corrected
  // delta after sliding against walls, crates, obstacles, and the floor.
  _vy += GRAVITY * dt;
  const desiredDX = _move.x * dt;
  const desiredDY = _vy   * dt;
  const desiredDZ = _move.z * dt;

  if (_collider && _body) {
    const result = movePlayer(_collider, desiredDX, desiredDY, desiredDZ);

    // Kinematic bodies move via setNextKinematicTranslation, NOT setTranslation,
    // so Rapier can resolve contacts with dynamic bodies in future phases.
    const t  = _body.translation();
    const bx = t.x + result.dx;
    const by = t.y + result.dy;
    const bz = t.z + result.dz;
    _body.setNextKinematicTranslation({ x: bx, y: by, z: bz });

    // Visual follows body: eye sits BODY_FROM_EYE below the capsule centre.
    playerObj.position.set(bx, by - BODY_FROM_EYE, bz);

    _onGround = result.grounded;
    if (_onGround && _vy < 0) _vy = 0;
  } else {
    // Pre-physics fallback during the ~100ms Rapier init window.
    playerObj.position.x += desiredDX;
    playerObj.position.z += desiredDZ;
    playerObj.position.y  = EYE;
    _vy = 0; _onGround = true;
  }

  // NAP-zone z-clamp — there are no walls past the gate, so Rapier won't
  // bound z out there. Clamp the visual + body to arena width so the player
  // can't drift into the void around the bonsai tree.
  if (playerObj.position.x > NAP_X) {
    const zClamped = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, playerObj.position.z));
    if (zClamped !== playerObj.position.z) {
      playerObj.position.z = zClamped;
      if (_body) {
        const t2 = _body.translation();
        _body.setNextKinematicTranslation({ x: t2.x, y: t2.y, z: zClamped });
      }
    }
  }

  // Arena boundary + fall-hole safety net (v0.2.104). Rapier occasionally lets
  // the capsule squeeze past a wall seam or drop through a collider gap. If the
  // body falls below the floor, respawn; otherwise hard-clamp X/Z to the legal
  // play area (arena + NAP corridor) so the player can never end up in the void.
  if (_body) {
    const t = _body.translation();
    if (t.y < -2) {
      resetPlayerPos();
    } else {
      const cx = Math.max(-19.5, Math.min(44.5, t.x));
      const cz = Math.max(-19.5, Math.min(19.5, t.z));
      if (cx !== t.x || cz !== t.z) {
        _body.setNextKinematicTranslation({ x: cx, y: t.y, z: cz });
        playerObj.position.set(cx, t.y - BODY_FROM_EYE, cz);
      }
    }
  }

  // Reload tick
  if (state.reloading) {
    state.reloadTimer -= dt;
    if (state.reloadTimer <= 0) {
      state.reloading = false;
      state.ammo = MAX_AMMO;
      emit(EV.HUD_UPDATE);
    }
  }
  if (state.shootCd > 0) state.shootCd -= dt;

  // Recoil timer
  if (_recoilTimer > 0) _recoilTimer = Math.max(0, _recoilTimer - dt);
}

export function getRecoilT() { return _recoilTimer / RECOIL_DUR; }

const _shootOrigin     = new THREE.Vector3();
const _shootDir        = new THREE.Vector3();
const _camFwd          = new THREE.Vector3();
const _camPos          = new THREE.Vector3();
const _convergePoint   = new THREE.Vector3();
// Distance ahead of the camera along its forward axis where the player's
// crosshair effectively "focuses". The bullet is aimed from the barrel
// THROUGH this point so the trajectory converges with the crosshair line
// instead of running parallel to it. 80m balances near-target convergence
// with far-target accuracy for our 60u/s bullet @ 2.5s life (= ~150m range).
const CROSSHAIR_CONVERGE_DIST = 80;

export function shoot() {
  if (state.shootCd > 0 || state.reloading || state.ammo <= 0) return null;
  state.ammo--;
  state.shootCd = SHOOT_CD;
  _recoilTimer  = RECOIL_DUR;

  // 1. Camera forward + position (the crosshair's true aim line in world space)
  camera.getWorldDirection(_camFwd);
  _camPos.setFromMatrixPosition(camera.matrixWorld);

  // 2. Bullet origin = barrel tip in world space (offset from camera centre)
  _shootOrigin.copy(getGunBarrelWorld(camera));

  // 3. Convergence point: where the crosshair is "aiming" at CROSSHAIR_CONVERGE_DIST
  _convergePoint.copy(_camPos).addScaledVector(_camFwd, CROSSHAIR_CONVERGE_DIST);

  // 4. Bullet direction = barrel -> convergence (so the bullet line crosses
  // the camera/crosshair line at that convergence point). This is the fix:
  // previously dir was camera forward, which is PARALLEL to the crosshair
  // line but offset by the barrel position, so bullets visibly missed the
  // reticle. Now bullets actually travel toward what the crosshair is on.
  _shootDir.copy(_convergePoint).sub(_shootOrigin).normalize();

  emit(EV.SHOOT, { origin: _shootOrigin.clone(), dir: _shootDir.clone() });
  emit(EV.HUD_UPDATE);
  if (state.ammo === 0) startReload();
}

export function startReload() {
  if (state.reloading || state.ammo === MAX_AMMO) return;
  state.reloading   = true;
  state.reloadTimer = RELOAD_TIME;
  playReload();
  emit(EV.HUD_UPDATE);
}

export function takeDamage(dmg) {
  if (godMode) return;
  state.hp = Math.max(0, state.hp - dmg);
  emit(EV.PLAYER_HIT, { dmg });
  emit(EV.HUD_UPDATE);
  if (state.hp <= 0) killPlayer();
}

export function killPlayer() {
  if (state.phase !== PHASE.PLAYING) return;
  state.phase = PHASE.DEAD;
  state.deaths++;
  state.respawnTimer = RESPAWN_TIME;
  emit(EV.PLAYER_KILLED);
}

export function tickDeath(dt, renderer) {
  if (state.phase !== PHASE.DEAD) return;
  state.respawnTimer -= dt;
  if (state.respawnTimer <= 0) {
    state.hp = PLAYER_HP;
    state.ammo = MAX_AMMO;
    state.reloading = false;
    resetPlayerPos();
    state.phase = PHASE.PLAYING;
    emit(EV.PLAYER_RESPAWN);
    emit(EV.HUD_UPDATE);
    requestLock(renderer.domElement);
  }
}

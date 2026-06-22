// weapons.js — bullet pool, gun viewmodel, hit detection
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { scene, gunScene } from './scene.js';
import { BULLET_SPEED, BULLET_LIFE, ARENA_HALF, WALL_H } from './config.js';

// Bullet pool
const _pool   = [];
const _active = [];
const _geo    = new THREE.CylinderGeometry(0.06, 0.02, 0.4, 6);
const _matP   = new THREE.MeshBasicMaterial({ color: 0xffffff });
const _matB   = new THREE.MeshBasicMaterial({ color: 0xff6600 });
const _bUp    = new THREE.Vector3(0,1,0);
const _bQ     = new THREE.Quaternion();
const _bN     = new THREE.Vector3();

// ── Spark / hit-flash pool ────────────────────────────────────────────────────
// 8 reusable point-light + sprite pairs for bullet-hits on nostrich capsules.
// No new allocations in the hit path — grab from pool, set position, release after TTL.
const _SPARK_TTL  = 0.10; // seconds
const _sparkGeo   = new THREE.SphereGeometry(0.18, 4, 4);
const _sparkMat   = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true });
const _sparkPool  = [];
const _sparkActive = [];

function _getSparkMesh() {
  if (_sparkPool.length) return _sparkPool.pop();
  return new THREE.Mesh(_sparkGeo, _sparkMat.clone()); // clone so opacity is independent
}

function _spawnSpark(pos) {
  const m = _getSparkMesh();
  m.position.copy(pos);
  m.material.opacity = 1.0;
  m.visible = true;
  scene.add(m);
  _sparkActive.push({ mesh: m, life: _SPARK_TTL });
}

function _tickSparks(dt) {
  for (let i = _sparkActive.length - 1; i >= 0; i--) {
    const s = _sparkActive[i];
    s.life -= dt;
    const t = s.life / _SPARK_TTL;
    s.mesh.material.opacity = t;
    s.mesh.scale.setScalar(1.0 + (1.0 - t) * 1.8); // expand as it fades
    if (s.life <= 0) {
      scene.remove(s.mesh);
      s.mesh.visible = false;
      _sparkPool.push(s.mesh);
      _sparkActive[i] = _sparkActive[_sparkActive.length - 1];
      _sparkActive.pop();
    }
  }
}

export function spawnBullet(origin, dir, isPlayer) {
  let b = _pool.pop();
  if (!b) b = { mesh: new THREE.Mesh(_geo, _matP), vel: new THREE.Vector3(), life:0, isPlayer };
  b.isPlayer = isPlayer;
  b.life = BULLET_LIFE;
  b.mesh.material = isPlayer ? _matP : _matB;
  b.mesh.position.copy(origin);
  _bN.copy(dir).normalize();
  _bQ.setFromUnitVectors(_bUp, _bN);
  b.mesh.quaternion.copy(_bQ);
  b.vel.copy(_bN).multiplyScalar(BULLET_SPEED);
  b.mesh.visible = true;
  scene.add(b.mesh);
  _active.push(b);
  return b;
}

// Hit callbacks — set by main.js
let _onPlayerHit = null;
let _bots        = null;
const _d = new THREE.Vector3();

export function initWeapons(bots, onPlayerHit) {
  _bots = bots;
  _onPlayerHit = onPlayerHit;
  _buildGun();
}

export function tickWeapons(dt, playerPos) {
  for (let i = _active.length-1; i >= 0; i--) {
    const b = _active[i];
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;
    let remove = b.life <= 0 ||
      Math.abs(b.mesh.position.x) > ARENA_HALF ||
      Math.abs(b.mesh.position.z) > ARENA_HALF ||
      b.mesh.position.y < 0 || b.mesh.position.y > WALL_H+2;

    if (!remove) {
      if (b.isPlayer && _bots) {
        for (const bot of _bots) {
          if (!bot.alive) continue;
          // Cylinder hit test — XZ radius 0.45u, full body height 0~1.9u
          const bp = bot.pos || bot.mesh?.position;
          if (!bp) continue;
          const bx = b.mesh.position.x - bp.x;
          const bz = b.mesh.position.z - bp.z;
          const by = b.mesh.position.y;
          const xzSq = bx*bx + bz*bz;
          if (xzSq < 0.20 && by >= -0.1 && by <= 1.95) {
            // hit — spark at bullet position, then notify main
            _spawnSpark(b.mesh.position);
            if (window._onBotHit) window._onBotHit(bot, b.isPlayer ? 3 : 0);
            remove = true; break;
          }
        }
      }
      if (!remove && !b.isPlayer && _onPlayerHit) {
        if (b.mesh.position.distanceToSquared(playerPos) < 0.5) {
          _onPlayerHit(12);
          remove = true;
        }
      }
    }

    if (remove) {
      scene.remove(b.mesh);
      b.mesh.visible = false;
      _pool.push(b);
      _active[i] = _active[_active.length-1]; _active.pop();
    }
  }
  _tickSparks(dt);
  _tickGun(dt);
}

// Gun viewmodel
const _barrelLocal = new THREE.Vector3(); // barrel tip in gun-camera space
const _barrelWorld = new THREE.Vector3();
let _gunMesh   = null;
let _gunPlaceholder = null;
let _recoilTimer = 0;

function _buildGun() {
  // Placeholder box (immediate)
  _gunPlaceholder = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.04, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.4, metalness: 0.8 })
  );
  _gunPlaceholder.position.set(0.14, -0.12, -0.26);
  gunScene.add(_gunPlaceholder);

  // GLB async
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  loader.load('/gun-steampunk.glb', gltf => {
    _gunMesh = gltf.scene;
    // Auto-scale: fit within 0.25m bounding box
    const bbox = new THREE.Box3().setFromObject(_gunMesh);
    const maxDim = Math.max(
      bbox.max.x - bbox.min.x,
      bbox.max.y - bbox.min.y,
      bbox.max.z - bbox.min.z
    ) || 1;
    _gunMesh.scale.setScalar(0.25 / maxDim);
    _gunMesh.position.set(0.18, -0.16, -0.30);
    _gunMesh.rotation.set(0, -Math.PI/2, 0);
    gunScene.add(_gunMesh);
    gunScene.remove(_gunPlaceholder);
  });
}

export function triggerRecoil() { _recoilTimer = 0.08; }

// Scratch vecs — module-level, never allocated in hot path
const _bFwd   = new THREE.Vector3();
const _bRight = new THREE.Vector3();
const _bUp2   = new THREE.Vector3();

// Returns barrel tip in world space.
//
// The gun mesh lives in gunScene (its own isolated scene) so its position
// is in gunCamera-local space and cannot be converted to world space via
// getWorldPosition. Instead we compute the barrel tip directly from mainCamera:
//
//   1. Start at camera eye (world pos)
//   2. Push forward 0.3 m so bullets clearly originate in front of the player
//      (avoids bullets spawning behind/inside the camera near-plane)
//   3. Small right + down nudge to match the visual gun-barrel position on screen
//
// The bullet DIRECTION is always camera-forward (toward crosshair), so even
// with the nudge the bullet tracks straight to the aim point.
export function getGunBarrelWorld(mainCamera) {
  mainCamera.getWorldPosition(_barrelWorld);
  _bFwd.set(0, 0, -1).applyQuaternion(mainCamera.quaternion);   // camera forward
  _bRight.set(1, 0, 0).applyQuaternion(mainCamera.quaternion);  // camera right
  _bUp2.set(0, 1, 0).applyQuaternion(mainCamera.quaternion);    // camera up
  // Push forward first so the origin is clearly in front of the player
  _barrelWorld.addScaledVector(_bFwd,    0.30);
  // Nudge right + down to sit at gun barrel position visually
  _barrelWorld.addScaledVector(_bRight,  0.12);
  _barrelWorld.addScaledVector(_bUp2,   -0.10);
  return _barrelWorld;
}

function _tickGun(dt) {
  if (_recoilTimer <= 0) return;
  _recoilTimer = Math.max(0, _recoilTimer - dt);
  const kick = (_recoilTimer/0.08) * 0.05;
  const mesh = _gunMesh || _gunPlaceholder;
  if (mesh) mesh.position.z = (_gunMesh ? -0.30 : -0.26) + kick;
}

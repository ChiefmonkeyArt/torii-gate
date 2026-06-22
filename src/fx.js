// fx.js — bullet-impact spark flashes + ricochet tracer lines.
// Pooled, zero-alloc in the hot path. Used by weapons.js on bullet impact.
import * as THREE from 'three';
import { scene } from './scene.js';

// ── Spark / hit-flash pool ───────────────────────────────────────────────────
const _SPARK_TTL = 0.18;
const _sparkGeo  = new THREE.SphereGeometry(0.16, 4, 4);
const _sparkMat  = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true });
const _sparkPool = [];
const _sparkActive = [];

function _getSparkMesh() {
  if (_sparkPool.length) return _sparkPool.pop();
  return new THREE.Mesh(_sparkGeo, _sparkMat.clone()); // clone so opacity is independent
}

export function spawnSpark(pos) {
  const m = _getSparkMesh();
  m.position.copy(pos);
  m.material.opacity = 1.0;
  m.scale.setScalar(1.0);
  m.visible = true;
  scene.add(m);
  _sparkActive.push({ mesh: m, life: _SPARK_TTL });
}

function _tickSparks(dt) {
  for (let i = _sparkActive.length - 1; i >= 0; i--) {
    const s = _sparkActive[i];
    s.life -= dt;
    const t = Math.max(0, s.life / _SPARK_TTL);
    s.mesh.material.opacity = t;
    s.mesh.scale.setScalar(1.0 + (1.0 - t) * 2.2);
    if (s.life <= 0) {
      scene.remove(s.mesh);
      s.mesh.visible = false;
      _sparkPool.push(s.mesh);
      _sparkActive[i] = _sparkActive[_sparkActive.length - 1];
      _sparkActive.pop();
    }
  }
}

// ── Ricochet tracer — short line along the reflected direction ───────────────
const _RIC_TTL = 0.15;
const _ricMat  = new THREE.LineBasicMaterial({ color: 0xffcc66, transparent: true });
const _ricPool = [];
const _ricActive = [];
const _ricScratchA = new THREE.Vector3();
const _ricScratchB = new THREE.Vector3();

function _getRicLine() {
  if (_ricPool.length) return _ricPool.pop();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  return new THREE.Line(g, _ricMat.clone());
}

export function spawnRicochet(pos, normal) {
  const line = _getRicLine();
  const pa = line.geometry.attributes.position;
  _ricScratchA.copy(pos);
  _ricScratchB.copy(pos).addScaledVector(normal, 0.6);
  pa.array[0] = _ricScratchA.x; pa.array[1] = _ricScratchA.y; pa.array[2] = _ricScratchA.z;
  pa.array[3] = _ricScratchB.x; pa.array[4] = _ricScratchB.y; pa.array[5] = _ricScratchB.z;
  pa.needsUpdate = true;
  line.material.opacity = 1.0;
  scene.add(line);
  _ricActive.push({ line, life: _RIC_TTL });
}

function _tickRicochets(dt) {
  for (let i = _ricActive.length - 1; i >= 0; i--) {
    const r = _ricActive[i];
    r.life -= dt;
    r.line.material.opacity = Math.max(0, r.life / _RIC_TTL);
    if (r.life <= 0) {
      scene.remove(r.line);
      _ricPool.push(r.line);
      _ricActive[i] = _ricActive[_ricActive.length - 1];
      _ricActive.pop();
    }
  }
}

export function tickFx(dt) {
  _tickSparks(dt);
  _tickRicochets(dt);
}

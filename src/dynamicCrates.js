// dynamicCrates.js — physics-driven push-around crates (v0.2.106).
// Small dynamic Rapier cuboids the player and bullets can shove around. Visual
// mesh follows the Rapier body each frame (allocation-free sync).
import * as THREE from 'three';
import { scene } from './scene.js';
import { createDynamicCrate } from './engine/physics/bodies.js';

const _crates = []; // { body, mesh }

const HALF = 0.5;
const SPOTS = [[3, 3], [-4, 2], [2, -4], [-3, -3]];

const _geo = new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2);
const _mat = new THREE.MeshStandardMaterial({ color: 0xb5905d, roughness: 0.8, metalness: 0.05 });

export function buildDynamicCrates() {
  // Clear any prior crates (re-entering the arena rebuilds the world).
  for (const c of _crates) scene.remove(c.mesh);
  _crates.length = 0;

  for (const [x, z] of SPOTS) {
    const y = HALF + 0.05; // rest just above the floor
    const handle = createDynamicCrate(x, y, z, HALF);
    if (!handle) continue;
    const mesh = new THREE.Mesh(_geo, _mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    scene.add(mesh);
    _crates.push({ body: handle.body, mesh });
  }
}

export function tickDynamicCrates() {
  for (const c of _crates) {
    const t = c.body.translation();
    const r = c.body.rotation();
    c.mesh.position.set(t.x, t.y, t.z);
    c.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
}

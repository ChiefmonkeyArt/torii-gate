// napNpc.js — peaceful Chiefmonkey NPC standing in the NAP zone (v0.2.107).
// Past the torii gate the player is disarmed and bots can't follow; a friendly
// Chiefmonkey idles there as a landmark. No collider — purely decorative.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from './scene.js';

let _root  = null;
let _mixer = null;

const NPC_X = 28;   // mid-NAP corridor
const NPC_Z = 3;

export function buildNapNpc() {
  if (_root) return; // already built

  new GLTFLoader().load('/chiefmonkey6.glb', gltf => {
    _root = gltf.scene;

    // Metre-scale GLB — render at 1.0 like the player model.
    let minY = Infinity;
    _root.traverse(o => {
      if (o.isMesh && o.geometry) {
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox;
        if (b) minY = Math.min(minY, b.min.y);
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });
    if (!Number.isFinite(minY)) minY = 0;

    _root.scale.setScalar(1.0);
    _root.position.set(NPC_X, -minY, NPC_Z);
    _root.rotation.y = -Math.PI / 2; // face back toward the gate
    scene.add(_root);

    _mixer = new THREE.AnimationMixer(_root);
    const byName = {};
    gltf.animations.forEach(c => { byName[c.name] = c; });
    const clip = byName['Stylish_Walk_inplace'] || byName['Idle_03'] || gltf.animations[0];
    if (clip) {
      const a = _mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.play();
    }
  }, undefined, err => {
    console.warn('[napNpc] load failed:', err);
  });
}

export function tickNapNpc(dt) {
  if (_mixer) _mixer.update(dt);
}

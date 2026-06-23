// firstPersonBody.js — headless Chiefmonkey body visible in the FP camera
// (v0.2.108). Replaces the old clip-plane clone in playerModel.js. A dedicated
// GLB with the head removed at authoring time renders on layer 2 (seen by the
// main camera, hidden from the mirror reflection camera), parented to the
// player so it tracks the eye. Its own mixer plays a small idle/walk/run set.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { keys } from './input.js';

let _root  = null;
let _mixer = null;
let _actions = {};
let _current = null;

const EYE = 1.7;
const FADE = 0.15;

export function loadFirstPersonBody(parentObj) {
  if (_root) { parentObj.remove(_root); _root = null; _mixer = null; _actions = {}; _current = null; }

  new GLTFLoader().load('/chiefmonkey-headless.glb', gltf => {
    _root = gltf.scene;

    let minY = Infinity;
    _root.traverse(o => {
      if (o.isMesh && o.geometry) {
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox;
        if (b) minY = Math.min(minY, b.min.y);
      }
    });
    if (!Number.isFinite(minY)) minY = 0;

    _root.scale.setScalar(1.0);
    // Feet at the player's foot: parent eye sits at EYE above foot, so shift the
    // body down by (minY + EYE). Nudge forward (+Z local) so the chest/arms sit
    // just ahead in the lower view. Model faces local -Z; rotate PI to face fwd.
    _root.position.set(0, -minY - EYE, 0.3);
    _root.rotation.y = Math.PI;

    _root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        o.frustumCulled = false;
        o.layers.set(2); // main camera sees layer 2; mirror reflection disables it
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            m.transparent = false;
            m.depthWrite  = true;
            m.alphaTest   = 0;
            m.needsUpdate = true;
          }
        }
      }
    });

    parentObj.add(_root);

    _mixer = new THREE.AnimationMixer(_root);
    gltf.animations.forEach(c => {
      const a = _mixer.clipAction(c);
      a.setLoop(THREE.LoopRepeat, Infinity);
      _actions[c.name] = a;
    });
    _play('Idle_11');
  }, undefined, err => {
    console.warn('[firstPersonBody] load failed:', err);
  });
}

function _play(name) {
  if (!name || !_actions[name] || _current === name) return;
  const next = _actions[name];
  next.reset().fadeIn(FADE).play();
  if (_current && _actions[_current]) _actions[_current].fadeOut(FADE);
  _current = name;
}

export function tickFirstPersonBody(dt) {
  if (!_mixer) return;
  _mixer.update(dt);

  const fwd   = keys['KeyW'] || keys['ArrowUp'];
  const back  = keys['KeyS'] || keys['ArrowDown'];
  const left  = keys['KeyA'] || keys['ArrowLeft'];
  const right = keys['KeyD'] || keys['ArrowRight'];
  const run   = keys['ShiftLeft'] || keys['ShiftRight'];
  const moving = fwd || back || left || right;

  if (!moving)            _play('Idle_11');
  else if (run && moving) _play('Running');
  else                    _play('Walking');
}

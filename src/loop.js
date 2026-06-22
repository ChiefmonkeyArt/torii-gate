// loop.js — rAF loop. Calls registered update fns. Nothing else.
import * as THREE from 'three';

const _clock = new THREE.Clock();
let _frame = 0;
let _onUpdate = null;

export function initLoop(onUpdate) { _onUpdate = onUpdate; }
export function getFrame() { return _frame; }

export function startLoop() {
  function _tick() {
    requestAnimationFrame(_tick);
    _frame++;
    const dt = Math.min(_clock.getDelta(), 0.05);
    if (_onUpdate) _onUpdate(dt, _frame);
  }
  _tick();
}

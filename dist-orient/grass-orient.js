// grass-orient.js — STANDALONE orientation diagnostic (no Rapier, no physics).
// Renders ONE large blade from the exact game geometry (5-sided cone, quadratic
// taper, BLADE_R=0.006, BLADE_H=0.507) with a hard RED tip / BLUE base split.
// Default = fixed side-on view so there is NO perspective ambiguity.
// "Game-like angle" button tilts to a steep downward view like the user's screenshot.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

// ── Blade constants (MIRROR src/arena-foliage.js v0.2.294) ───────────────────
const BLADE_SEGS = 8;
const BLADE_H    = 0.507;
const BLADE_R    = 0.006;
const BLADE_SIDES = 5;

// Scale up so a single blade is comfortably visible.
const SCALE = 24;

// ── Renderer / scene / camera ────────────────────────────────────────────────
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2412);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.minDistance = 2;
controls.maxDistance = 60;

// ── Lighting ──────────────────────────────────────────────────────────────────
scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x2a3a1a, 1.0));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.5);
sun.position.set(8, 14, 6);
scene.add(sun);

// ── Ground + floor grid ───────────────────────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x2c3a1f, roughness: 1.0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
scene.add(ground);

const grid = new THREE.GridHelper(40, 40, 0x4a6a3a, 0x334428);
grid.position.y = 0.001;
scene.add(grid);

// ── Blade geometry: 5-sided cone, quadratic taper (EXACT game geometry) ───────
const _angles = Array.from({ length: BLADE_SIDES }, (_, k) => k * 2 * Math.PI / BLADE_SIDES);

function buildBladeGeometry() {
  const positions = [];
  const vts = [];
  const indices = [];

  const segs = BLADE_SEGS;
  const ring = (yr, radius, vt) => {
    for (let k = 0; k < BLADE_SIDES; k++) {
      const a = _angles[k];
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      const y = yr * BLADE_H;
      positions.push(x, y, z);
      vts.push(vt);
    }
  };

  // rows 0..segs-1: base (y=0, radius BLADE_R, vT=0) up to tip (y=1, radius 0, vT=1)
  for (let s = 0; s <= segs; s++) {
    const hr = s / segs;                 // 0..1 height ratio
    const radius = BLADE_R * (1.0 - hr) * (1.0 - hr); // quadratic taper
    const vt = hr;                        // 0=base .. 1=tip
    ring(hr, radius, vt);
  }

  // side faces between adjacent rings
  const rowLen = BLADE_SIDES;
  for (let s = 0; s < segs; s++) {
    const a = s * rowLen;
    const b = (s + 1) * rowLen;
    for (let k = 0; k < BLADE_SIDES; k++) {
      const k2 = (k + 1) % BLADE_SIDES;
      indices.push(a + k, a + k2, b + k2);
      indices.push(a + k, b + k2, b + k);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('vT', new THREE.Float32BufferAttribute(vts, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const bladeGeo = buildBladeGeometry();

// ── Shader: hard RED tip / BLUE base split at vT=0.5 ──────────────────────────
const bladeMat = new THREE.ShaderMaterial({
  vertexShader: /* glsl */`
    attribute float vT;
    varying float vVt;
    void main() {
      vVt = vT;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    varying float vVt;
    void main() {
      vec3 red  = vec3(1.0, 0.18, 0.18);
      vec3 blue = vec3(0.16, 0.42, 1.0);
      vec3 c = vVt >= 0.5 ? red : blue;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
  side: THREE.DoubleSide,
});

// ONE big solo blade, centered, scaled up.
const solo = new THREE.Mesh(bladeGeo, bladeMat);
solo.scale.setScalar(SCALE);
solo.position.set(0, 0, 0);
scene.add(solo);

// A small reference field of normal-scale blades so the user can compare.
const fieldGeo = bladeGeo; // reuse
const field = new THREE.InstancedMesh(fieldGeo, bladeMat, 60);
const m4 = new THREE.Matrix4();
const pos = new THREE.Vector3();
const q = new THREE.Quaternion();
const sc = new THREE.Vector3(1, 1, 1);
const e = new THREE.Euler();
for (let i = 0; i < 60; i++) {
  const ang = Math.random() * Math.PI * 2;
  const rad = 2 + Math.random() * 6;
  pos.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad - 4); // offset behind/front
  e.set(0, Math.random() * Math.PI * 2, 0);
  q.setFromEuler(e);
  field.setMatrixAt(i, m4.compose(pos, q, sc));
}
field.instanceMatrix.needsUpdate = true;
scene.add(field);

// ── Camera views ──────────────────────────────────────────────────────────────
function setSideView() {
  // Fixed side-on: look straight at the blade from +Z. Red tip at top.
  camera.position.set(0, (BLADE_H * SCALE) / 2, 18);
  controls.target.set(0, (BLADE_H * SCALE) / 2, 0);
  controls.update();
}
function setGameAngle() {
  // Steep downward view matching the user's in-game screenshot.
  camera.position.set(3.2, 9.5, 6.5);
  controls.target.set(0, 0.6, 0);
  controls.update();
}
setSideView();

document.getElementById('btnSide').addEventListener('click', () => {
  setSideView();
  document.getElementById('btnSide').classList.add('active');
  document.getElementById('btnGame').classList.remove('active');
});
document.getElementById('btnGame').addEventListener('click', () => {
  setGameAngle();
  document.getElementById('btnGame').classList.add('active');
  document.getElementById('btnSide').classList.remove('active');
});

// ── Resize ─────────────────────────────────────────────────────────────────────
function resize() {
  const w = canvas.clientWidth || window.innerWidth / 2;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ── Render loop ───────────────────────────────────────────────────────────────
function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

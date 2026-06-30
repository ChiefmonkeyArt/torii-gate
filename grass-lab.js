// grass-lab.js — isolated showcase of the v0.2.265 grass blade.
// Same geometry + shader as src/arena-foliage.js::_buildGrass, but standing
// alone (no arena deps) so the blade curve/thinning can be inspected before
// integration. Auto-orbiting low camera + dense field + nice lighting.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Blade constants (mirror arena-foliage.js _buildGrass) ─────────────────────
const BLADE_SEGS = 20;   // v0.2.266c: smooth quadratic bend
const BLADE_H    = 0.30; // v0.2.266: shorter + more upright
const BLADE_W    = 0.014;// v0.2.266c: thin but visible
const FIELD      = 14;          // field is FIELD × FIELD units
const SPACING    = 0.16;        // v0.2.265: tight uniform grid for full even ground coverage (matches arena)
const BLADES     = Math.floor(FIELD * FIELD / (SPACING * SPACING));

// ── Renderer / scene / camera ────────────────────────────────────────────────
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc4e8);
scene.fog = new THREE.Fog(0x9fc4e8, 22, 52);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(6.5, 1.35, 6.5);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.35, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI * 0.495; // never go under the ground

// ── Lighting ──────────────────────────────────────────────────────────────────
scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x2a3a1a, 0.9));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
sun.position.set(8, 14, 6);
scene.add(sun);

// ── Ground ────────────────────────────────────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(FIELD * 1.4, 64),
  new THREE.MeshStandardMaterial({ color: 0x2c3a1c, roughness: 1.0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
scene.add(ground);

// ── Blade geometry: flat tapered ribbon (v0.2.266c) ────────────────────
// 2 verts per row (left, right) + one tip vertex. Rows use t = row/SEGS
// (never 1) so the top row keeps a non-zero width — avoids degenerate tris.
const VERTS_PER_BLADE = BLADE_SEGS * 2 + 1;
const positions = [], uvs = [], indices = [];
{
  const base = 0;
  for (let row = 0; row < BLADE_SEGS; row++) {
    const t = row / BLADE_SEGS;
    const y = t * BLADE_H;
    const hw = BLADE_W * Math.pow(1.0 - t, 1.6);
    positions.push(-hw, y, 0,   hw, y, 0);
    uvs.push(0, t,  1, t);
  }
  positions.push(0, BLADE_H, 0);          // tip vertex (sharp point)
  uvs.push(0.5, 1.0);
  for (let row = 0; row < BLADE_SEGS - 1; row++) {
    const l0 = base + row * 2, r0 = l0 + 1;
    const l1 = l0 + 2, r1 = l0 + 3;
    indices.push(l0, r0, r1,  l0, r1, l1);   // quad face
  }
  const lr = base + (BLADE_SEGS - 1) * 2;
  const rr = lr + 1;
  const tip = base + BLADE_SEGS * 2;
  indices.push(lr, rr, tip);
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uvs), 2));
geo.setIndex(indices);
geo.computeVertexNormals();

// ── Shader: Bezier spine + twist + curl-noise patch wind (identical to arena) ─
const mat = new THREE.ShaderMaterial({
  uniforms: {
    uTime:    { value: 0.0 },
    uWindDir: { value: { x: 0.707, y: 0.707 } },
  },
  vertexShader: /* glsl */`
    varying float vT;
    varying float vTint;
    varying vec3  vWn;
    uniform float uTime;
    uniform vec2  uWindDir;
    void main() {
      float h = ${BLADE_H.toFixed(4)};
      float t = clamp(position.y / h, 0.0, 1.0);
      vT = t;
      vTint = instanceColor.b;

      vec3 p = position;

      // quadratic Bezier spine — SMALL forward curl (v0.2.266: mostly upright)
      float curl = 0.035 + instanceColor.g * 0.045;
      float bz   = 2.0 * (1.0 - t) * t * (curl * 0.5) + t * t * curl;
      p.z += bz;
      // minimal droop
      p.y -= 0.018 * t * t;

      // v0.2.266c: flat ribbon — normal is plane facing; per-blade facing via CPU Y-rotation.
      // World normal passed to fragment for two-sided lighting (gl_FrontFacing is frag-only).
      vWn = mat3(modelMatrix * instanceMatrix) * normal;

      // world-space ORGANIC wind (v0.2.266): multi-octave gust envelope +
      // per-blade phase so neighbouring blades desync — wind rolls over
      // random patches instead of pulsing in unison.
      vec3 wpos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float ph  = instanceColor.r * 6.2832;
      float g1 = sin(wpos.x * 0.21 + uTime * 0.70 + ph);
      float g2 = sin(wpos.z * 0.17 - uTime * 0.50 + ph * 1.7);
      float g3 = sin((wpos.x + wpos.z) * 0.11 + uTime * 0.30 + ph * 0.6);
      float gust = (g1 * 0.5 + g2 * 0.3 + g3 * 0.2) * 0.5 + 0.5;
      gust = smoothstep(0.25, 0.95, gust);
      float flut = sin(wpos.x * 1.30 + wpos.z * 0.70 + uTime * 2.20 + ph * 3.1)
                 + cos(wpos.z * 1.10 - wpos.x * 0.50 + uTime * 1.70 - ph * 2.3);
      float wind = 0.016 + gust * 0.10 + flut * 0.009;
      float sway = wind * t * t;

      vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
      wp.xyz += vec3(uWindDir.x * sway, 0.0, uWindDir.y * sway);
      wp.x += (-uWindDir.y) * flut * 0.009 * t;
      wp.z += ( uWindDir.x) * flut * 0.009 * t;

      // Lighting in fragment shader (needs gl_FrontFacing).
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */`
    varying float vT;
    varying float vTint;
    varying vec3  vWn;
    void main() {
      vec3 rootCol = vec3(0.01, 0.14, 0.02);
      vec3 midCool = vec3(0.09, 0.48, 0.07);
      vec3 midWarm = vec3(0.22, 0.52, 0.05);
      vec3 tipCool = vec3(0.32, 0.92, 0.20);
      vec3 tipWarm = vec3(0.52, 0.88, 0.12);
      vec3 midCol  = mix(midCool, midWarm, vTint);
      vec3 tipCol  = mix(tipCool, tipWarm, vTint);
      vec3 col = vT < 0.5
        ? mix(rootCol, midCol, vT * 2.0)
        : mix(midCol,  tipCol, (vT - 0.5) * 2.0);
      float ao = smoothstep(0.0, 0.15, vT);
      vec3 wn = normalize(vWn);
      if (!gl_FrontFacing) wn = -wn;
      vec3 L  = normalize(vec3(0.40, 0.85, 0.40));
      float vDiff = 0.40 + 0.60 * max(0.0, dot(wn, L));
      gl_FragColor = vec4(col * (0.6 + 0.4 * ao) * vDiff, 1.0);
    }
  `,
  side: THREE.DoubleSide,
});

// ── Instanced field ───────────────────────────────────────────────────────────
const mesh = new THREE.InstancedMesh(geo, mat, BLADES);
mesh.instanceColor = new THREE.BufferAttribute(new Float32Array(BLADES * 3), 3);

const _pos = new THREE.Vector3(), _quat = new THREE.Quaternion(), _scl = new THREE.Vector3(), _m4 = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const HALF = FIELD / 2;
let i = 0;
// uniform grid + jitter scaled to spacing — even ground coverage, no clumps
for (let x = -HALF; x <= HALF; x += SPACING) {
  for (let z = -HALF; z <= HALF; z += SPACING) {
    if (i >= BLADES) break;
    const jx = x + (Math.random() - 0.5) * SPACING * 0.7;
    const jz = z + (Math.random() - 0.5) * SPACING * 0.7;
    _pos.set(jx, 0, jz);
    _quat.setFromAxisAngle(_up, Math.random() * Math.PI * 2);
    _scl.setScalar(0.85 + Math.random() * 0.35);
    _m4.compose(_pos, _quat, _scl);
    mesh.setMatrixAt(i, _m4);
    mesh.instanceColor.setXYZ(i, Math.random(), Math.random(), Math.random());
    i++;
  }
}
mesh.instanceMatrix.needsUpdate = true;
mesh.instanceColor.needsUpdate = true;
mesh.computeBoundingSphere();
scene.add(mesh);

// ── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Auto-orbit + render loop ──────────────────────────────────────────────────
let auto = true;
canvas.addEventListener('pointerdown', () => { auto = false; });

const clock = new THREE.Clock();
function tick() {
  const dt = clock.getDelta();
  mat.uniforms.uTime.value += dt;
  if (auto) {
    const t = clock.elapsedTime * 0.18;
    const r = 8.5;
    camera.position.x = Math.cos(t) * r;
    camera.position.z = Math.sin(t) * r;
    camera.position.y = 1.25 + Math.sin(t * 0.7) * 0.25;
    controls.target.set(0, 0.35, 0);
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// Debug exposure for headless inspection / screenshot angles.
window.__lab = { THREE, renderer, scene, camera, controls, mesh, mat, setAuto: (v)=>{auto=v;} };

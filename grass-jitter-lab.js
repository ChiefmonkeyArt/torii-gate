// grass-jitter-lab.js — isolated A/B lab for the terra flat-ribbon grass shader.
//
// This mirrors src/arena-foliage.js::_buildGrass at v0.2.313 EXACTLY, then wraps
// the six wind-related knobs behind live uniforms so you can flip between the
// CURRENT (shipping) values and a proposed FIX preset in real time, or dial in
// your own numbers with the sliders.
//
// Why not reuse grass-lab.html?
//   That older lab hosts the PlaneGeometry + gust-envelope shader (v0.2.274-era)
//   — a different family than what actually ships now. To honestly diagnose the
//   jitter that showed up after the v0.2.309-316 terra port, we have to A/B the
//   terra shader itself, not the older gust-envelope one.
//
// Diagnosis (from src/arena-foliage.js:334-340, 316):
//   1. `uTime / 2.0` on the noise Z-scroll → wind sample moves ~3 texels/sec →
//      each blade crosses the noise cell boundary constantly, causing snapping.
//   2. `clamp(wind, 0.25, 1.0)` is a hard threshold; combined with (1), blades
//      pop on/off wind → the whole field jitters synchronously.
//   3. `sin(uTime * 4.0 + …)` on `curve` → a 0.64 Hz shiver applied to every
//      blade on top of the wind noise.
//
// FIX preset: slower wind scroll, softer threshold, and 4× slower curve sway.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Presets ──────────────────────────────────────────────────────────────────
const PRESET_CURRENT = {
  windScrollX: 25.0,   // uTime / 25
  windScrollZ:  2.0,   // uTime /  2   ← too fast (root cause of jitter)
  threshold:   0.25,   // hard clamp floor
  windIntensity: 0.30,
  curveFreq:    4.0,   // sin(uTime * 4.0) ← too fast (shiver)
  noiseScale:  0.025,
};
const PRESET_FIX = {
  windScrollX: 60.0,   // 2.4× slower
  windScrollZ:  8.0,   // 4×   slower  ← key change
  threshold:   0.15,   // softer floor → less popping
  windIntensity: 0.30,
  curveFreq:    1.0,   // 4× slower sway
  noiseScale:  0.025,
};

const knobs = { ...PRESET_CURRENT };
let paused = false;

// ── Renderer / scene ─────────────────────────────────────────────────────────
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc8dde8);
scene.fog = new THREE.FogExp2(0xc8dde8, 0.008);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(6.5, 1.35, 6.5);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.35, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 60;
controls.maxPolarAngle = Math.PI * 0.495;

// ── Lighting parity + ground plate ───────────────────────────────────────────
scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x2a3a1a, 0.9));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
sun.position.set(40, 20, -30);
scene.add(sun);

const FIELD = 14;
const groundCover = new THREE.Mesh(
  new THREE.PlaneGeometry(FIELD, FIELD),
  new THREE.MeshStandardMaterial({ color: 0x3d5a2f, roughness: 1.0 }),
);
groundCover.rotation.x = -Math.PI / 2;
groundCover.position.y = 0.005;
scene.add(groundCover);

// ── Grass build — mirrors arena-foliage.js::_buildGrass ─────────────────────
const BLADE_SEGS   = 5;
const BLADE_VERTS  = (BLADE_SEGS + 1) * 2;
const BLADE_INDICES = BLADE_SEGS * 12;
const BLADE_WIDTH  = 0.050;
const BLADE_HEIGHT_MIN = 0.42;
const BLADE_HEIGHT_MAX = 0.58;
const TARGET_BLADES = 30000;     // half of arena density for smoother iteration
const CAND_SPACING  = 0.045;

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
function makeBladeTexture() {
  const W = 8, H = 64;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1) - 0.5;
      const r = 0.27 + (0.18 - 0.27) * v;
      const g = 0.60 + (0.43 - 0.60) * v;
      const b = 0.15 + (0.12 - 0.15) * v;
      const rib = 1.0 - smoothstep(0.0, 0.18, Math.abs(u));
      const edge = 1.0 - smoothstep(0.30, 0.50, Math.abs(u));
      const tipFade = 1.0 - smoothstep(0.85, 1.0, v) * 0.6;
      const a = Math.max(edge, 0.0) * tipFade;
      const o = (y * W + x) * 4;
      data[o + 0] = Math.min(255, (r + rib * 0.05) * 255);
      data[o + 1] = Math.min(255, (g + rib * 0.08) * 255);
      data[o + 2] = Math.min(255, (b + rib * 0.03) * 255);
      data[o + 3] = Math.min(255, a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}
function makeNoiseTexture() {
  const S = 64;
  const raw = new Float32Array(S * S);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.random();
  const buf = new Float32Array(S * S);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let s = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = (x + dx + S) % S, yy = (y + dy + S) % S;
            s += raw[yy * S + xx]; c++;
          }
        }
        buf[y * S + x] = s / c;
      }
    }
    raw.set(buf);
  }
  const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < raw.length; i++) {
    const v = Math.max(0, Math.min(255, raw[i] * 255));
    data[i * 4 + 0] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}
const grassTex = makeBladeTexture();
const noiseTex = makeNoiseTexture();

function initBladeIndices(id, vc1, vc2) {
  let i = 0, seg;
  for (seg = 0; seg < BLADE_SEGS; ++seg) {
    id[i++] = vc1 + 0; id[i++] = vc1 + 1; id[i++] = vc1 + 2;
    id[i++] = vc1 + 2; id[i++] = vc1 + 1; id[i++] = vc1 + 3;
    vc1 += 2;
  }
  for (seg = 0; seg < BLADE_SEGS; ++seg) {
    id[i++] = vc2 + 2; id[i++] = vc2 + 1; id[i++] = vc2 + 0;
    id[i++] = vc2 + 3; id[i++] = vc2 + 1; id[i++] = vc2 + 2;
    vc2 += 2;
  }
  return i;
}

// Candidate grid across the lab field.
const HALF = FIELD / 2;
const candidates = [];
for (let x = -HALF; x <= HALF; x += CAND_SPACING) {
  for (let z = -HALF; z <= HALF; z += CAND_SPACING) {
    const jx = x + (Math.random() - 0.5) * CAND_SPACING * 0.7;
    const jz = z + (Math.random() - 0.5) * CAND_SPACING * 0.7;
    candidates.push(jx, jz);
  }
}
const pick = Math.min(TARGET_BLADES, Math.floor(candidates.length / 2));
for (let k = 0; k < pick; k++) {
  const r = k + Math.floor(Math.random() * (Math.floor(candidates.length / 2) - k));
  const kx = candidates[k * 2], kz = candidates[k * 2 + 1];
  candidates[k * 2]     = candidates[r * 2];
  candidates[k * 2 + 1] = candidates[r * 2 + 1];
  candidates[r * 2]     = kx;
  candidates[r * 2 + 1] = kz;
}

const count = pick;
const vindexArr = new Float32Array(BLADE_VERTS * 2);
for (let i = 0; i < vindexArr.length; i++) vindexArr[i] = i;
const offsetArr = new Float32Array(count * 4);
const shapeArr  = new Float32Array(count * 4);
const indexArr  = new Uint16Array(BLADE_INDICES);
initBladeIndices(indexArr, 0, BLADE_VERTS);

for (let i = 0; i < count; i++) {
  const x  = candidates[i * 2];
  const z  = candidates[i * 2 + 1];
  const ry = Math.random() * Math.PI * 2;
  const s  = 0.85 + Math.random() * 0.35;
  const tall = Math.random() < 0.21;
  const h = (BLADE_HEIGHT_MIN + Math.pow(Math.random(), 4.0) * (BLADE_HEIGHT_MAX - BLADE_HEIGHT_MIN)) * s * (tall ? 1.21 : 1.0);
  const w = BLADE_WIDTH * s * (0.9 + Math.random() * 0.2);
  offsetArr[i * 4 + 0] = x;
  offsetArr[i * 4 + 1] = z;
  offsetArr[i * 4 + 2] = 0.0;
  offsetArr[i * 4 + 3] = ry;
  shapeArr[i * 4 + 0] = w;
  shapeArr[i * 4 + 1] = h;
  shapeArr[i * 4 + 2] = Math.random() * 0.3;
  shapeArr[i * 4 + 3] = 0.05 + Math.random() * 0.3;
}

const geo = new THREE.InstancedBufferGeometry();
geo.setIndex(new THREE.BufferAttribute(indexArr, 1));
geo.setAttribute('vindex', new THREE.BufferAttribute(vindexArr, 1));
geo.setAttribute('offset', new THREE.InstancedBufferAttribute(offsetArr, 4));
geo.setAttribute('shape',  new THREE.InstancedBufferAttribute(shapeArr, 4));
geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10000);

// The shader — identical to arena-foliage.js EXCEPT the tunable numbers are now
// uniforms (uWindScrollX/Z, uWindThreshold, uCurveFreq) so we can A/B live.
const mat = new THREE.RawShaderMaterial({
  uniforms: {
    uTime:          { value: 0.0 },
    uMode:          { value: 0.0 },
    uMap:           { value: grassTex },
    uNoise:         { value: noiseTex },
    uNoiseScale:    { value: knobs.noiseScale },
    uWindIntensity: { value: knobs.windIntensity },
    uWindScrollX:   { value: knobs.windScrollX },
    uWindScrollZ:   { value: knobs.windScrollZ },
    uWindThreshold: { value: knobs.threshold },
    uCurveFreq:     { value: knobs.curveFreq },
    uLightDir:      { value: new THREE.Vector3(0.743, 0.371, -0.557) },
    uFogColor:      { value: new THREE.Color(0xc8dde8) },
    uFogDensity:    { value: 0.008 },
    uGrassFadeFar:  { value: 60.0 },
  },
  vertexShader: /* glsl */`
    precision highp float;

    attribute float vindex;
    attribute vec4 offset;
    attribute vec4 shape;

    uniform float uTime;
    uniform vec3 uLightDir;
    uniform sampler2D uNoise;
    uniform float uNoiseScale;
    uniform float uWindIntensity;
    uniform float uWindScrollX;
    uniform float uWindScrollZ;
    uniform float uWindThreshold;
    uniform float uCurveFreq;

    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;

    varying vec2 vUv;
    varying vec4 vColor;
    varying float vT;

    #define BLADE_SEGS  ${BLADE_SEGS.toFixed(1)}
    #define BLADE_VERTS ${BLADE_VERTS.toFixed(1)}

    vec2 rotate(float x, float y, vec2 r) {
      return vec2(x * r.x - y * r.y, x * r.y + y * r.x);
    }

    void main() {
      float vi    = mod(vindex, BLADE_VERTS);
      float di    = floor(vi / 2.0);
      float hpct  = di / BLADE_SEGS;
      float bside = floor(vindex / BLADE_VERTS);
      float bedge = mod(vi, 2.0);
      vT = hpct;

      vec3 vpos = vec3(
        shape.x * (bedge - 0.5) * (1.0 - pow(hpct, 3.0)),
        shape.y * di / BLADE_SEGS,
        0.0
      );

      float n = bside * 2.0 - 1.0;
      vec2 yawv = vec2(cos(offset.w), sin(offset.w));
      vec3 normal = vec3(rotate(0.0, n, yawv).x, 0.0, rotate(0.0, n, yawv).y);

      // curveFreq is now a uniform (was hardcoded 4.0 → shiver)
      float curve = shape.w + 0.125 * sin(uTime * uCurveFreq + offset.w * 0.2 * shape.y + offset.x + offset.y);
      float rot = shape.z + curve * hpct;
      vec2 rotv = vec2(cos(rot), sin(rot));
      vpos.yz = rotate(vpos.y, vpos.z, rotv);
      normal.yz = rotate(normal.y, normal.z, rotv);

      vpos.xz = rotate(vpos.x, vpos.z, yawv);

      vec2 bladePos = offset.xy;

      // Wind scroll rates + threshold are now uniforms (were hardcoded 25/2/0.25)
      vec2 samplePos = bladePos * uNoiseScale + 0.5;
      float wind = texture2D(uNoise,
        vec2(samplePos.x - uTime / uWindScrollX, samplePos.y - uTime / uWindScrollZ) * 6.0).g;
      wind = (clamp(wind, uWindThreshold, 1.0) - uWindThreshold) * (1.0 / max(1e-4, 1.0 - uWindThreshold));
      wind = wind * wind * uWindIntensity;
      wind *= hpct;
      wind = -wind;
      rotv = vec2(cos(wind), sin(wind));
      vpos.yz = rotate(vpos.y, vpos.z, rotv);
      normal.yz = rotate(normal.y, normal.z, rotv);

      float diffuse = abs(dot(normal, uLightDir));
      float light = 0.35 * diffuse + 0.65;
      float heightLight = 1.0 - hpct;
      heightLight = heightLight * heightLight;
      light = max(light - heightLight * 0.5, 0.0);

      vec3 bladeCol = mix(vec3(0.27, 0.60, 0.15), vec3(0.18, 0.43, 0.12), hpct);
      vColor = vec4(
        light * 0.75 + cos(offset.x * 80.0) * 0.1,
        light * 0.95 + sin(offset.y * 140.0) * 0.05,
        light * 0.95 + sin(offset.x * 99.0) * 0.05,
        1.0
      );
      vColor.rgb *= bladeCol;
      vColor.rgb = min(vColor.rgb, 1.0);

      vUv = vec2(bedge, di / BLADE_SEGS);

      vpos.x += bladePos.x;
      vpos.z += bladePos.y;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(vpos, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;

    uniform sampler2D uMap;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform float uGrassFadeFar;
    uniform float uMode;

    varying vec2 vUv;
    varying vec4 vColor;
    varying float vT;

    void main() {
      vec4 color;
      if (uMode > 0.5) {
        vec3 base = vec3(0.10, 0.30, 0.95);
        vec3 tip  = vec3(0.95, 0.15, 0.15);
        color = vec4(mix(base, tip, vT), 1.0);
      } else {
        color = vColor * texture2D(uMap, vUv);
      }
      float depth = gl_FragCoord.z / gl_FragCoord.w;
      color.a = 1.0 - smoothstep(uGrassFadeFar * 0.55, uGrassFadeFar * 0.8, depth);
      float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * depth * depth);
      color.rgb = mix(color.rgb, uFogColor, fogFactor);
      gl_FragColor = color;
    }
  `,
  side: THREE.DoubleSide,
  transparent: true,
});

const mesh = new THREE.Mesh(geo, mat);
mesh.frustumCulled = false;
mesh.position.y = -0.05;
scene.add(mesh);

// ── HUD wiring ───────────────────────────────────────────────────────────────
const sliders = {
  sx: { u: 'uWindScrollX',   key: 'windScrollX',   fmt: v => v.toFixed(0) },
  sz: { u: 'uWindScrollZ',   key: 'windScrollZ',   fmt: v => v.toFixed(1) },
  th: { u: 'uWindThreshold', key: 'threshold',     fmt: v => v.toFixed(2) },
  wi: { u: 'uWindIntensity', key: 'windIntensity', fmt: v => v.toFixed(2) },
  cf: { u: 'uCurveFreq',     key: 'curveFreq',     fmt: v => v.toFixed(1) },
  ns: { u: 'uNoiseScale',    key: 'noiseScale',    fmt: v => v.toFixed(3) },
};
for (const [id, meta] of Object.entries(sliders)) {
  const el = document.getElementById(id);
  const val = document.getElementById(id + 'V');
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    knobs[meta.key] = v;
    mat.uniforms[meta.u].value = v;
    val.textContent = meta.fmt(v);
  });
}

function applyPreset(p, label) {
  Object.assign(knobs, p);
  for (const [id, meta] of Object.entries(sliders)) {
    const v = knobs[meta.key];
    const el = document.getElementById(id);
    const val = document.getElementById(id + 'V');
    el.value = v;
    val.textContent = meta.fmt(v);
    mat.uniforms[meta.u].value = v;
  }
  document.getElementById('btnCurrent').classList.toggle('active', label === 'current');
  document.getElementById('btnFix').classList.toggle('active', label === 'fix');
  document.getElementById('stamp').textContent =
    `[${label.toUpperCase()}] scrollX=${knobs.windScrollX} scrollZ=${knobs.windScrollZ} thresh=${knobs.threshold} curveHz=${(knobs.curveFreq/(2*Math.PI)).toFixed(2)}`;
}
document.getElementById('btnCurrent').addEventListener('click', () => applyPreset(PRESET_CURRENT, 'current'));
document.getElementById('btnFix').addEventListener('click', () => applyPreset(PRESET_FIX, 'fix'));
window.addEventListener('keydown', (e) => {
  if (e.key === '1') applyPreset(PRESET_CURRENT, 'current');
  else if (e.key === '2') applyPreset(PRESET_FIX, 'fix');
  else if (e.code === 'Space') { paused = !paused; e.preventDefault(); }
});
applyPreset(PRESET_CURRENT, 'current');

// ── Resize / loop ────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!paused) mat.uniforms.uTime.value += dt;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

window.__jitterLab = { mat, mesh, knobs, PRESET_CURRENT, PRESET_FIX, applyPreset };

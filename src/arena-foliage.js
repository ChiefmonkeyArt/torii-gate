// arena-foliage.js — instanced grass blades + wildflowers. 2 draw calls total.
// Confined to the NAP Zone only (east of the torii gate) so the main arena
// reads as a clean turquoise underlit floor with mist swirls.
import * as THREE from 'three';
import { scene } from './scene.js';
import { ARENA_HALF, NAP_X, NAP_FAR_X } from './config.js';

// NAP-zone footprint shared by both grass + flowers.
//   x: just inside the gate edge → just inside the far wall (small inset so
//      blades don't intersect the torii pillars or NAP_FAR_X clamp).
//   z: full arena width minus a small inset.
const NAP_GRASS_X0 = NAP_X + 1.0;
const NAP_GRASS_X1 = NAP_FAR_X - 1.0;
const NAP_GRASS_Z0 = -ARENA_HALF + 1.0;
const NAP_GRASS_Z1 =  ARENA_HALF - 1.0;
const NAP_GRASS_W  = NAP_GRASS_X1 - NAP_GRASS_X0;
const NAP_GRASS_D  = NAP_GRASS_Z1 - NAP_GRASS_Z0;

// Module-level scratch — shared with arena.js equivalents but isolated here
const _up   = new THREE.Vector3(0, 1, 0);
const _pos  = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl  = new THREE.Vector3();
const _m4   = new THREE.Matrix4();

// Material registry (v0.2.118) — the foliage shaders live here, not on
// `window`. main.js advances their uTime via tickFoliage() each frame and
// ToriiDebug reads them via getGrassMat()/getFlowerMat(). This replaces the
// old `window._grassMat`/`window._flowerMat` cross-module wiring; the globals
// are still set in _buildGrass/_buildWildflowers as DEPRECATED debug aliases
// (console/tester convenience) but internal code must not read them
// (regression check 10).
let _grassMat  = null;
let _flowerMat = null;
let _tulipMat  = null; // v0.2.263: 2nd flower archetype (tulip cup)

export function buildFoliage() {
  _buildGrass();
  _buildWildflowers();
  _buildTulips(); // v0.2.263: 2nd flower archetype for shape variety
}

// Per-frame shader tick — advances the grass + flower uTime uniforms. Reads
// module-scope refs only (no `window`, no allocation). Behaviour-identical to
// the previous main.js inline `window._grassMat.uniforms.uTime.value += dt`.
export function tickFoliage(dt) {
  if (_grassMat)  _grassMat.uniforms.uTime.value  += dt;
  if (_flowerMat) _flowerMat.uniforms.uTime.value += dt;
  if (_tulipMat)  _tulipMat.uniforms.uTime.value  += dt;
}

// Debug accessors — injected into ToriiDebug so the namespace can surface the
// live materials without reaching through a global.
export function getGrassMat()  { return _grassMat; }
export function getFlowerMat() { return _flowerMat; }
export function getTulipMat()  { return _tulipMat; } // v0.2.263

// ── Instanced grass ───────────────────────────────────────────────────────────
function _buildGrass() {
  // v0.2.266c: FLAT TAPERED RIBBON blade. The V-channel cross-section (3 verts/row)
  // read as folded/creased/angular shards — its two angled faces per segment
  // created visible crease lines and a jagged silhouette. A flat ribbon (2 verts/row)
  // is the standard convincing-grass approach (cf. SimonDev): a smooth single-plane
  // blade with a quadratic bend + taper. Per-blade Y rotation + density keep it from
  // disappearing edge-on. Shorter, thinner, more upright than v0.2.265.
  const BLADE_SEGS   = 20;   // v0.2.266c: smooth quadratic bend — more segments = smoother curve, less polygonal kink.
  const BLADE_H      = 0.30; // v0.2.266: shorter + more upright (was 0.46).
  const BLADE_W      = 0.014;// v0.2.266c: thin but visible — too-thin blades alias to noise at distance.
  const BLADES_PATCH = 1;    // v0.2.265: single blade per instance — instances are scattered uniformly
                             // across the NAP zone so the field covers the ground evenly instead of in clumps.
  const PATCH_RADIUS = 0.78;
  const SPACING      = 0.16; // v0.2.265: tight uniform grid (~39 blades/m²) for full even ground coverage.

  // Flat ribbon: 2 verts per row (left, right) + one tip vertex. Rows use
  // t = row/SEGS (never 1) so the top row keeps a non-zero width — avoids the
  // degenerate zero-area triangles that produced NaN normals / black tip speckles.
  const VERTS_PER_BLADE = BLADE_SEGS * 2 + 1;
  const positions = [], uvs = [], indices = [];

  for (let b = 0; b < BLADES_PATCH; b++) {
    const base = b * VERTS_PER_BLADE;
    for (let row = 0; row < BLADE_SEGS; row++) {
      const t  = row / BLADE_SEGS;   // 0 at base .. (SEGS-1)/SEGS — never 1, avoids degenerate tip tris
      const y  = t * BLADE_H;
      // smooth taper to a sharp point.
      const hw = BLADE_W * Math.pow(1.0 - t, 1.6);
      positions.push(-hw, y, 0,    hw, y, 0);
      uvs.push(0, t,  1, t);
    }
    // Tip cap — a single apex vertex + one tri from the last row.
    positions.push(0, BLADE_H, 0);
    uvs.push(0.5, 1.0);
    // One quad (2 tris) per row pair — a single smooth plane, no crease line.
    for (let row = 0; row < BLADE_SEGS - 1; row++) {
      const l0 = base + row * 2;
      const r0 = l0 + 1;
      const l1 = l0 + 2, r1 = l0 + 3;
      indices.push(l0, r0, r1,  l0, r1, l1);   // quad face
    }
    // tip cap tri (last row's 2 verts → tip)
    const lr = base + (BLADE_SEGS - 1) * 2;
    const rr = lr + 1;
    const tip = base + BLADE_SEGS * 2;
    indices.push(lr, rr, tip);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();   // flat plane normal (0,0,1); per-blade facing comes from instance Y-rotation

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:    { value: 0.0 },
      uWindDir: { value: { x: 0.707, y: 0.707 } },
    },
    vertexShader: /* glsl */`
      varying float vT;
      varying float vTint;   // per-blade colour tint (instanceColor.b)
      varying vec3  vWn;     // world-space blade facing normal (two-sided lighting in frag)
      uniform float uTime;
      uniform vec2  uWindDir;
      void main() {
        float h = ${BLADE_H.toFixed(4)};
        float t = clamp(position.y / h, 0.0, 1.0);
        vT = t;
        vTint = instanceColor.b;

        vec3 p = position;

        // (2) Quadratic Bezier spine — a SMALL forward curl along the keel (+Z).
        // v0.2.266: far less curl than v0.2.265 so blades stand mostly upright
        // with only a gentle natural lean, instead of arching over ("folded").
        float curl = 0.035 + instanceColor.g * 0.045;
        float bz   = 2.0 * (1.0 - t) * t * (curl * 0.5) + t * t * curl;
        p.z += bz;
        // minimal droop — just enough that the tip reads as the end of a curve
        p.y -= 0.018 * t * t;

        // v0.2.266c: flat ribbon — normal is the plane facing (0,0,1). Per-blade
        // facing variation comes from the CPU instance Y-rotation; the world normal
        // is passed to the fragment shader which flips it for back faces (gl_FrontFacing
        // is fragment-only).
        vWn = mat3(modelMatrix * instanceMatrix) * normal;

        // (3) Wind — world-space, patch-coherent but ORGANIC (v0.2.266).
        // The old single traveling sine front made the whole field pulse in
        // unison (regimented/clockwork). Now: a low-frequency multi-octave gust
        // envelope built from incommensurate sines, each with a per-blade phase
        // so neighbouring blades desync and patches rise independently — wind
        // reads as rolling gusts over random patches, not a metronome.
        vec3 wpos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float ph  = instanceColor.r * 6.2832;   // per-blade phase

        // Low-frequency gust envelope: slow in space + time, summed sines at
        // incommensurate frequencies/directions → irregular patches of calm/peak.
        float g1 = sin(wpos.x * 0.21 + uTime * 0.70 + ph);
        float g2 = sin(wpos.z * 0.17 - uTime * 0.50 + ph * 1.7);
        float g3 = sin((wpos.x + wpos.z) * 0.11 + uTime * 0.30 + ph * 0.6);
        float gust = (g1 * 0.5 + g2 * 0.3 + g3 * 0.2) * 0.5 + 0.5;   // 0..1
        gust = smoothstep(0.25, 0.95, gust);

        // High-frequency flutter: a different direction + faster tempo, also
        // per-blade phase-shifted, so the tips shimmer independently.
        float flut = sin(wpos.x * 1.30 + wpos.z * 0.70 + uTime * 2.20 + ph * 3.1)
                   + cos(wpos.z * 1.10 - wpos.x * 0.50 + uTime * 1.70 - ph * 2.3);

        float wind = 0.016 + gust * 0.10 + flut * 0.009;
        float sway = wind * t * t;            // tip sways most, base stays put

        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        wp.xyz += vec3(uWindDir.x * sway, 0.0, uWindDir.y * sway);   // gust dir
        // lateral flutter perpendicular to wind dir so blades don't all lean one way
        wp.x += (-uWindDir.y) * flut * 0.009 * t;
        wp.z += ( uWindDir.x) * flut * 0.009 * t;

        // Lighting moved to fragment shader (needs gl_FrontFacing, which is
        // fragment-only). vWn carries the world-space facing normal.

        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      varying float vT;
      varying float vTint;
      varying vec3  vWn;
      void main() {
        // Per-blade tint: lerp between a cool deep green and a warm yellow-green
        // so the field reads as varied growth, not a single flat colour.
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
        // Two-sided diffuse from the world facing normal (flip for back faces).
        vec3 wn = normalize(vWn);
        if (!gl_FrontFacing) wn = -wn;
        vec3 L  = normalize(vec3(0.40, 0.85, 0.40));
        float vDiff = 0.40 + 0.60 * max(0.0, dot(wn, L));
        gl_FragColor = vec4(col * (0.6 + 0.4 * ao) * vDiff, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  // Patch grid confined to NAP-zone footprint — see NAP_GRASS_* constants at
  // the top of the file. Skip any patch that lands within ~1.5u of the tree
  // trunk at (NAP_X+6, 0) so we don't bury the bonsai base in blades.
  const TREE_X = NAP_X + 6;
  const TREE_Z = 0;
  const TREE_CLEAR_SQ = 1.5 * 1.5;
  const patches = [];
  for (let x = NAP_GRASS_X0; x <= NAP_GRASS_X1; x += SPACING) {
    for (let z = NAP_GRASS_Z0; z <= NAP_GRASS_Z1; z += SPACING) {
      // jitter scaled to spacing so blades stay evenly distributed (no re-clumping)
      const jx = x + (Math.random() - 0.5) * SPACING * 0.7;
      const jz = z + (Math.random() - 0.5) * SPACING * 0.7;
      const dx = jx - TREE_X, dz = jz - TREE_Z;
      if (dx * dx + dz * dz < TREE_CLEAR_SQ) continue;
      patches.push({
        x: jx,
        z: jz,
        ry: Math.random() * Math.PI * 2,
        s:  0.85 + Math.random() * 0.35,  // v0.2.265: tighter scale variance for even coverage
        phase: Math.random(),
        speed: Math.random(),
        tint:  Math.random(),            // per-blade colour tint (cool→warm green)
      });
    }
  }

  const count = patches.length;
  const mesh  = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceColor = new THREE.BufferAttribute(new Float32Array(count * 3), 3);

  for (let i = 0; i < count; i++) {
    const p = patches[i];
    _pos.set(p.x, 0, p.z);
    _quat.setFromAxisAngle(_up, p.ry);
    _scl.setScalar(p.s);
    _m4.compose(_pos, _quat, _scl);
    mesh.setMatrixAt(i, _m4);
    mesh.instanceColor.setXYZ(i, p.phase, p.speed, p.tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate  = true;
  // v0.2.265: fix instanced frustum culling. computeBoundingSphere() on the
  // geometry only bounds a single blade at the origin, so the whole field was
  // being culled when the camera wasn't aimed at the origin. InstancedMesh has
  // its own computeBoundingSphere() that accounts for every instance matrix.
  mesh.computeBoundingSphere();
  mesh.frustumCulled = true;
  scene.add(mesh);
  _grassMat = mat;
  window._grassMat = mat; // DEPRECATED debug alias (v0.2.118) — internal code uses tickFoliage()/getGrassMat()
}

// ── Instanced wildflowers ─────────────────────────────────────────────────────
function _buildWildflowers() {
  const FLOWER_COUNT = 340;  // v0.2.262: more blooms (was 220)
  const STEM_H = 0.52;
  const HEAD_R = 0.16;
  const SW     = 0.035;
  const PETAL_W = HEAD_R * 0.85;  // v0.2.262: slightly narrower petals (5 fit better than 4)

  const PALETTES = [
    [1.0,0.18,0.18],[1.0,0.55,0.08],[0.95,0.92,0.10],
    [0.18,0.82,0.28],[0.18,0.48,1.0],[0.82,0.18,0.92],
    [1.0,0.38,0.68],[1.0,1.0,1.0],[0.95,0.65,0.15],[0.35,0.95,0.85],
    // v0.2.262: richer palette — lavender, deep violet, coral, sky
    [0.62,0.45,0.92],[0.48,0.20,0.72],[1.0,0.42,0.32],[0.40,0.72,1.0],
  ];

  const positions = [], uvs = [], indices = [];
  function addQuad(x0,y0,z0,x1,y1,z1,x2,y2,z2,x3,y3,z3) {
    const b = positions.length / 3;
    positions.push(x0,y0,z0,x1,y1,z1,x2,y2,z2,x3,y3,z3);
    uvs.push(0,0,1,0,0,1,1,1);
    indices.push(b,b+1,b+2,b+1,b+3,b+2);
  }

  const R = PETAL_W, HR = HEAD_R * 2;
  const CUP = 0.030; // v0.2.263: petals cup more (outer edge raised → less flat card)
  // v0.2.263: 7 outer petals (was 5) for a fuller, rounder, less angular head.
  const OUTER = Array.from({length:7}, (_,k)=>k*2*Math.PI/7);
  OUTER.forEach(a => {
    const c = Math.cos(a), s = Math.sin(a);
    addQuad(-R*c,STEM_H,-R*s, R*c,STEM_H,R*s, -R*c,STEM_H+HR+CUP,-R*s, R*c,STEM_H+HR+CUP,R*s);
  });
  // v0.2.263: inner ring — 7 shorter petals offset half a step, fuller bloom.
  const Ri = R * 0.62, HRi = HR * 0.55, Y_OFF = HEAD_R * 0.18;
  OUTER.forEach(a => { const a2 = a + Math.PI/7; const c = Math.cos(a2), s = Math.sin(a2);
    addQuad(-Ri*c,STEM_H+Y_OFF,-Ri*s, Ri*c,STEM_H+Y_OFF,Ri*s,
            -Ri*c,STEM_H+Y_OFF+HRi+CUP,-Ri*s, Ri*c,STEM_H+Y_OFF+HRi+CUP,Ri*s);
  });
  addQuad(-SW,0,0, SW,0,0, -SW,STEM_H,0, SW,STEM_H,0);
  addQuad(0,0,-SW, 0,0,SW,  0,STEM_H,-SW, 0,STEM_H,SW);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const STEM_TOP = (STEM_H + HEAD_R * 2).toFixed(4);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0.0 } },
    vertexShader: /* glsl */`
      varying vec2  vUv;
      varying float vStem;
      varying vec3  vCol;
      uniform float uTime;
      void main() {
        vUv   = uv;
        vStem = step(0.30, position.y / ${STEM_TOP});
        float phase = float(gl_InstanceID) * 0.618;
        float sway  = sin(uTime * 0.85 + phase) * 0.055 * vStem;
        vec3 pos = position;
        pos.x += sway; pos.z += sway * 0.35;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(1.0, 0.4, 0.4);
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec2  vUv;
      varying float vStem;
      varying vec3  vCol;
      void main() {
        float d = length(vUv - vec2(0.5));
        float edge = 1.0 - smoothstep(0.40, 0.50, d);
        if (vStem < 0.5 && edge < 0.05) discard;
        float isCentre = 1.0 - smoothstep(0.14, 0.20, d);
        float bright   = 0.75 + 0.25 * (1.0 - d * 1.8);
        vec3 stemCol   = vec3(0.10, 0.46, 0.07);
        vec3 centreCol = vec3(1.0, 0.90, 0.10);
        vec3 col = vStem < 0.5
          ? stemCol
          : mix(vCol * bright, centreCol, isCentre);
        gl_FragColor = vec4(col, vStem < 0.5 ? 1.0 : edge);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });

  // Flowers also confined to the NAP zone. Reject any sample inside the tree
  // exclusion radius to keep the trunk base clean.
  const TREE_X = NAP_X + 6;
  const TREE_Z = 0;
  const TREE_CLEAR_SQ = 1.5 * 1.5;
  const mesh = new THREE.InstancedMesh(geo, mat, FLOWER_COUNT);
  const _col = new THREE.Color();
  for (let i = 0; i < FLOWER_COUNT; i++) {
    let fx, fz;
    // Rejection sample — max a few tries, fall back to last value if all fail
    for (let t = 0; t < 6; t++) {
      fx = NAP_GRASS_X0 + Math.random() * NAP_GRASS_W;
      fz = NAP_GRASS_Z0 + Math.random() * NAP_GRASS_D;
      const dx = fx - TREE_X, dz = fz - TREE_Z;
      if (dx * dx + dz * dz >= TREE_CLEAR_SQ) break;
    }
    const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    _pos.set(fx, 0, fz);
    _quat.setFromAxisAngle(_up, Math.random() * Math.PI * 2);
    _scl.setScalar(0.6 + Math.random() * 0.95);  // v0.2.262: wider scale variance
    _m4.compose(_pos, _quat, _scl);
    mesh.setMatrixAt(i, _m4);
    mesh.setColorAt(i, _col.setRGB(pal[0], pal[1], pal[2]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  mesh.frustumCulled = true;
  scene.add(mesh);
  _flowerMat = mat;
  window._flowerMat = mat; // DEPRECATED debug alias (v0.2.118) — internal code uses tickFoliage()/getFlowerMat()
}

// ── Instanced tulips (2nd flower archetype, v0.2.263) ──────────────────────────
// A small open cup of 3 broad petals on a stem — a clearly different silhouette
// from the daisy, so the NAP zone reads as a mixed wildflower field rather than
// a single bloom type. Same footprint + tree exclusion as the daisy. One draw
// call; wind sway via uTime (ticked in tickFoliage).
function _buildTulips() {
  const TULIP_COUNT = 70;
  const STEM_H = 0.46;
  const CUP_H  = 0.22;
  const R0     = 0.05;   // base radius (cup mouth narrows at the bottom)
  const R1     = 0.16;   // rim radius (cup opens outward)
  const SW     = 0.035;
  const PETAL_W = R1 * 0.92;

  // Warm tulip palette — reds, oranges, yellows, pinks, white.
  const PALETTES = [
    [0.92,0.16,0.20],[0.98,0.55,0.10],[0.99,0.92,0.18],
    [0.95,0.85,0.92],[0.85,0.20,0.55],[0.99,0.80,0.30],[1.0,1.0,1.0],
  ];

  const positions = [], uvs = [], indices = [];
  function addQuad(x0,y0,z0,x1,y1,z1,x2,y2,z2,x3,y3,z3) {
    const b = positions.length / 3;
    positions.push(x0,y0,z0,x1,y1,z1,x2,y2,z2,x3,y3,z3);
    uvs.push(0,0,1,0,0,1,1,1);
    indices.push(b,b+1,b+2,b+1,b+3,b+2);
  }

  const y0 = STEM_H, y1 = STEM_H + CUP_H;
  // 3 broad petals at 120°, each a quad from the narrow base to the wider rim.
  [0, 2*Math.PI/3, 4*Math.PI/3].forEach(a => {
    const c = Math.cos(a), s = Math.sin(a);
    const px = -s, pz = c;          // perpendicular to radial dir
    const hw = PETAL_W * 0.5;
    addQuad(
      R0*c + px*(-hw), y0, R0*s + pz*(-hw),
      R0*c + px*( hw), y0, R0*s + pz*( hw),
      R1*c + px*(-hw), y1, R1*s + pz*(-hw),
      R1*c + px*( hw), y1, R1*s + pz*( hw)
    );
  });
  // Stem cross (2 thin quads) — same treatment as the daisy stem.
  addQuad(-SW,0,0, SW,0,0, -SW,STEM_H,0, SW,STEM_H,0);
  addQuad(0,0,-SW, 0,0,SW,  0,STEM_H,-SW, 0,STEM_H,SW);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const CUP_TOP = (STEM_H + CUP_H).toFixed(4);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0.0 } },
    vertexShader: /* glsl */`
      varying float vY;
      varying vec3  vCol;
      uniform float uTime;
      void main() {
        vY = position.y;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(0.9, 0.2, 0.25);
        #endif
        float phase = float(gl_InstanceID) * 0.618;
        float stem  = step(0.30, position.y / ${CUP_TOP});
        float sway  = sin(uTime * 0.8 + phase) * 0.05 * stem;
        vec3 pos = position;
        pos.x += sway; pos.z += sway * 0.4;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying float vY;
      varying vec3  vCol;
      void main() {
        // Darker at the base, brightening toward the rim — reads as a cup.
        float t = clamp(vY / ${CUP_TOP}, 0.0, 1.0);
        vec3 col = mix(vCol * 0.55, vCol * (0.95 + 0.25 * t), t);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  const TREE_X = NAP_X + 6;
  const TREE_Z = 0;
  const TREE_CLEAR_SQ = 1.5 * 1.5;
  const mesh = new THREE.InstancedMesh(geo, mat, TULIP_COUNT);
  const _col = new THREE.Color();
  for (let i = 0; i < TULIP_COUNT; i++) {
    let fx, fz;
    for (let t = 0; t < 6; t++) {
      fx = NAP_GRASS_X0 + Math.random() * NAP_GRASS_W;
      fz = NAP_GRASS_Z0 + Math.random() * NAP_GRASS_D;
      const dx = fx - TREE_X, dz = fz - TREE_Z;
      if (dx * dx + dz * dz >= TREE_CLEAR_SQ) break;
    }
    const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    _pos.set(fx, 0, fz);
    _quat.setFromAxisAngle(_up, Math.random() * Math.PI * 2);
    _scl.setScalar(0.7 + Math.random() * 0.9);  // v0.2.263: varied sizes
    _m4.compose(_pos, _quat, _scl);
    mesh.setMatrixAt(i, _m4);
    mesh.setColorAt(i, _col.setRGB(pal[0], pal[1], pal[2]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  mesh.frustumCulled = true;
  scene.add(mesh);
  _tulipMat = mat;
}

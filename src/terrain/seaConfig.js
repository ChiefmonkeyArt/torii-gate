// terrain/seaConfig.js — Stage 2 SEA: pure, node-safe wave configuration.
//
// The SINGLE source of truth for the ocean surface height field. Two consumers:
//   - sea.js  → generates the GLSL wave sum (vertex displacement + analytic normal)
//   - tests   → validate the same seaWaveHeight() the shader mirrors
//
// PURE + node-safe: no THREE, no window/document. Deterministic (no Math.random)
// so the shader and the unit tests agree exactly. Y-up: heights are along +Y, the
// sea surface is the XZ plane at SEA_LEVEL. Stage 2 is VISUAL ONLY — no physics.

// Sea datum. The land (arena floor y=0, NAP terrain peaks above 0, edges at 0)
// sits 0.3m ABOVE the sea. Future Stage 3 islands rise out of this sea. We do NOT
// move any terrain — only the visual water plane lives here.
export const SEA_LEVEL = -0.3;

// Plane extent (full width, metres). The scene camera far plane is 600 and the fog
// (FogExp2 0xc8dde8, density 0.008) is ~fully opaque by ~300m, so a ±500m sheet
// reaches well past the fog horizon: its edge is hidden inside the mist long before
// the far plane. One big subdivided plane → one draw call.
export const SEA_SIZE = 1000;

// Subdivisions per axis. 160 → ~6.25m cells across a 1000m sheet: enough vertices
// for visible crest displacement near the camera, cheap enough for one mesh
// (161×161 = 25,921 verts). Distance motion is carried by the fragment shader + fog.
export const SEA_SEGMENTS = 160;

// Traveling wave layers. Each is a directional (Gerstner-style vertical) sine
// wave: crest travels along `dir` (a UNIT vector in the XZ plane) at `speed` m/s,
// with peak height `amplitude` (m) and crest-to-crest `wavelength` (m). Multiple
// directions + wavelengths + speeds so crests never move in unison — the same
// "murmuration" feel the grass wind has, but on water. Sum of amplitudes = 0.45m
// crest, so wave bands are OBVIOUSLY visible (per repeated user request), while the
// character never interacts (visual only).
export const SEA_WAVES = Object.freeze([
  Object.freeze({ dirX:  1.0,        dirZ:  0.0,        amplitude: 0.18, wavelength: 18.0, speed: 3.2 }),
  Object.freeze({ dirX:  0.0,        dirZ:  1.0,        amplitude: 0.12, wavelength: 12.0, speed: 2.6 }),
  Object.freeze({ dirX:  0.7071068,  dirZ:  0.7071068,  amplitude: 0.09, wavelength:  7.0, speed: 3.8 }),
  Object.freeze({ dirX: -0.6,        dirZ:  0.8,        amplitude: 0.06, wavelength:  5.0, speed: 4.5 }),
]);

// Sum of all layer amplitudes — the theoretical max crest height (all waves in
// phase). Used by tests and by the shader to normalise crest→trough colour mix.
export const SEA_WAVE_MAX_AMP = SEA_WAVES.reduce((s, w) => s + w.amplitude, 0);

const TAU = Math.PI * 2;

// Canonical sea-surface displacement at world (x, z) and time t (seconds), RELATIVE
// to SEA_LEVEL. This is the ONE function the GLSL vertex shader mirrors. Each layer:
//   phase = k * (dir·pos) - omega * t,   k = 2π/wavelength,   omega = k * speed
// so a crest travels along `dir` at exactly `speed` m/s. At the origin with t=0 all
// phases are 0 → height 0 (a deterministic reference point).
export function seaWaveHeight(x, z, t) {
  let h = 0;
  for (const w of SEA_WAVES) {
    const k = TAU / w.wavelength;
    const omega = k * w.speed;
    h += w.amplitude * Math.sin(k * (w.dirX * x + w.dirZ * z) - omega * t);
  }
  return h;
}

// Absolute world Y of the sea surface at (x, z, t) = SEA_LEVEL + displacement.
export function seaSurfaceY(x, z, t) {
  return SEA_LEVEL + seaWaveHeight(x, z, t);
}

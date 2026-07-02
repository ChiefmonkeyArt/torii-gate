// terrain/heightmap.js — NAP-zone terrain heightfield (Stage 1, v0.2.326).
//
// The SINGLE source of truth for NAP ground height. Three consumers all read the
// SAME continuous height function h(x,z):
//   - terrainMesh.js  → bakes h() into mesh vertex Y (exact, CPU)
//   - arena-foliage.js → bakes h() into each grass blade's base Y (exact, CPU)
//   - physics.js       → samples h() at grid points into a Rapier heightfield
//
// Because grass + mesh call h() directly (no texture, no interpolation), they are
// bit-identical. Physics is within sub-mm (gentle sines sampled at ~0.3m cells).
// This removes the texture-orientation class of bugs entirely.
//
// PURE + node-safe: no THREE, no RAPIER, no window/document. Deterministic (no
// Math.random) so all three consumers agree and unit tests are stable. Y-up:
// heights are along +Y, ground is the XZ plane.

import { NAP_X, NAP_FAR_X, ARENA_HALF } from '../config.js';

// NAP terrain footprint (matches the NAP floor in arena.js _buildNapZone).
export const NAP_TERRAIN = Object.freeze({
  minX: NAP_X,            // 20  — meets the flat arena floor here (height → 0)
  maxX: NAP_FAR_X,        // 45
  minZ: -ARENA_HALF,      // -20
  maxZ:  ARENA_HALF,      // 20
  width:  NAP_FAR_X - NAP_X,     // 25
  depth:  ARENA_HALF * 2,       // 40
  centerX: (NAP_X + NAP_FAR_X) / 2,  // 32.5
  centerZ: 0,
});

// Grid resolution for the physics heightfield + terrain mesh. ~0.31m cells in X,
// ~0.33m cells in Z → smooth slopes the kinematic character controller walks.
// Odd vertex counts give a centre row/col (handy for the debug hill + tests).
const NAP_GRID_COLS_X = 81;   // vertices along X (80 cells × 0.3125m = 25m)
const NAP_GRID_ROWS_Z = 121;  // vertices along Z (120 cells × 0.3333m = 40m)
export const NAP_GRID = Object.freeze({
  colsX: NAP_GRID_COLS_X,
  rowsZ: NAP_GRID_ROWS_Z,
  cellW: NAP_TERRAIN.width / (NAP_GRID_COLS_X - 1),
  cellD: NAP_TERRAIN.depth / (NAP_GRID_ROWS_Z - 1),
});

// Peak terrain amplitude (metres). Gentle on purpose: the character controller's
// snap-to-ground (0.2m) handles this comfortably, and blades/trees stay plausible.
export const NAP_TERRAIN_AMP = 0.35;

// Smoothstep (GLSL-style, mirrored in JS). Used by the border fade so the
// terrain meets the flat arena floor at y=0 without a hard step.
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Border fade → 0 at all four edges so the undulating patch is self-contained:
// it meets the flat arena floor (y=0) at x=minX and fades to sea-level-ish at the
// other edges (sea/river stages will reopen these later). `margin` is how far in
// the fade reaches (2m).
function borderFade(x, z, margin = 2.0) {
  const ex = Math.min(x - NAP_TERRAIN.minX, NAP_TERRAIN.maxX - x);
  const ez = Math.min(z - NAP_TERRAIN.minZ, NAP_TERRAIN.maxZ - z);
  const e  = Math.min(ex, ez);
  return smoothstep(0, margin, e);
}

// The continuous height function (metres). Layered low-frequency sines → broad
// rolling hills, no high-frequency content (keeps slopes walkable + jitter-free).
// Centre-relative coords so the field is symmetric about the footprint centre.
function rawHeight(x, z) {
  const ux = x - NAP_TERRAIN.centerX;  // -12.5 .. 12.5
  const uz = z - NAP_TERRAIN.centerZ;  // -20 .. 20
  let h = 0;
  h += Math.sin(ux * 0.42 + 0.7) * Math.cos(uz * 0.31)        * 0.55;
  h += Math.sin(ux * 0.27 - 1.3) * Math.sin(uz * 0.39 + 0.5)  * 0.35;
  h += Math.cos(ux * 0.61 + 2.1) * Math.sin(uz * 0.22 - 0.8)  * 0.22;
  // A broad low swell in the south-east quadrant so the field isn't perfectly
  // symmetric (reads as natural terrain, not a pattern).
  h += Math.sin(ux * 0.18 + 3.0) * Math.cos(uz * 0.15 + 1.1)  * 0.30;
  return h * NAP_TERRAIN_AMP;
}

// Canonical height at a world (x,z). This is the ONE function all consumers use.
// Returns 0 outside the footprint (so the arena floor at x<minX stays flat and
// the heightfield edges meet y=0).
export function sampleHeight(x, z) {
  if (x < NAP_TERRAIN.minX || x > NAP_TERRAIN.maxX ||
      z < NAP_TERRAIN.minZ || z > NAP_TERRAIN.maxZ) return 0;
  return rawHeight(x, z) * borderFade(x, z);
}

// World (x,z) → heightfield grid indices (fractional). col along X, row along Z.
export function worldToGrid(x, z) {
  const col = (x - NAP_TERRAIN.minX) / NAP_GRID.cellW;
  const row = (z - NAP_TERRAIN.minZ) / NAP_GRID.cellD;
  return { col, row };
}

// Build the Rapier heights Float32Array in COLUMN-MAJOR order:
//   heights[col * rowsZ + row],  col ∈ [0, colsX-1] (X), row ∈ [0, rowsZ-1] (Z)
// col 0 → minX, col last → maxX; row 0 → minZ, row last → maxZ.
// (Rapier expects column-major; the collider is centred + translated in physics.js.)
export function buildNapHeightfieldArray() {
  const { colsX, rowsZ, cellW, cellD } = NAP_GRID;
  const heights = new Float32Array(colsX * rowsZ);
  for (let col = 0; col < colsX; col++) {
    const x = NAP_TERRAIN.minX + col * cellW;
    for (let row = 0; row < rowsZ; row++) {
      const z = NAP_TERRAIN.minZ + row * cellD;
      heights[col * rowsZ + row] = sampleHeight(x, z);
    }
  }
  return heights;
}

// Debug probe: the highest point's rough location, for orientation checks.
// (Used by tests + a console stamp so a flipped heightfield is obvious on live.)
export function napTerrainPeak() {
  let best = -Infinity, bx = 0, bz = 0;
  for (let col = 0; col < NAP_GRID.colsX; col++) {
    const x = NAP_TERRAIN.minX + col * NAP_GRID.cellW;
    for (let row = 0; row < NAP_GRID.rowsZ; row++) {
      const z = NAP_TERRAIN.minZ + row * NAP_GRID.cellD;
      const h = sampleHeight(x, z);
      if (h > best) { best = h; bx = x; bz = z; }
    }
  }
  return { x: bx, z: bz, height: best };
}

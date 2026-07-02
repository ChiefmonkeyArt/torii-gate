// tests/terrain-heightmap.test.js — NAP-zone terrain heightmap (Stage 1, v0.2.326).
// Pure + node-safe (no THREE/RAPIER, deterministic), so it runs node-fast. Locks the
// single source-of-truth height function that mesh + grass + physics all read.
import { describe, it, expect } from 'vitest';
import {
  NAP_TERRAIN, NAP_GRID, NAP_TERRAIN_AMP,
  sampleHeight, buildNapHeightfieldArray, napTerrainPeak,
} from '../src/terrain/heightmap.js';

describe('sampleHeight — border fade to 0', () => {
  it('is 0 at the west/east X borders of the footprint', () => {
    expect(sampleHeight(NAP_TERRAIN.minX, NAP_TERRAIN.centerZ)).toBe(0);
    expect(sampleHeight(NAP_TERRAIN.maxX, NAP_TERRAIN.centerZ)).toBe(0);
  });

  it('is 0 at the north/south Z borders of the footprint', () => {
    expect(sampleHeight(NAP_TERRAIN.centerX, NAP_TERRAIN.minZ)).toBe(0);
    expect(sampleHeight(NAP_TERRAIN.centerX, NAP_TERRAIN.maxZ)).toBe(0);
  });
});

describe('sampleHeight — 0 outside the footprint', () => {
  it('is 0 in the main arena (x=0)', () => {
    expect(sampleHeight(0, 0)).toBe(0);
  });

  it('is 0 far outside the footprint (x=100)', () => {
    expect(sampleHeight(100, 0)).toBe(0);
    expect(sampleHeight(NAP_TERRAIN.centerX, 100)).toBe(0);
  });
});

describe('sampleHeight — a hill exists inside the footprint', () => {
  it('is positive somewhere inside the footprint', () => {
    const peak = napTerrainPeak();
    expect(peak.height).toBeGreaterThan(0);
    // Peak lies strictly inside the footprint (fade zeroes the borders).
    expect(peak.x).toBeGreaterThan(NAP_TERRAIN.minX);
    expect(peak.x).toBeLessThan(NAP_TERRAIN.maxX);
    expect(sampleHeight(peak.x, peak.z)).toBeGreaterThan(0);
  });

  it('never exceeds the declared amplitude', () => {
    const peak = napTerrainPeak();
    expect(peak.height).toBeLessThanOrEqual(NAP_TERRAIN_AMP + 1e-9);
  });
});

describe('buildNapHeightfieldArray', () => {
  const heights = buildNapHeightfieldArray();

  it('is a Float32Array of length rowsZ * colsX', () => {
    expect(heights).toBeInstanceOf(Float32Array);
    expect(heights.length).toBe(NAP_GRID.rowsZ * NAP_GRID.colsX);
  });

  it('contains only finite values with a positive maximum', () => {
    let max = -Infinity;
    for (const h of heights) {
      expect(Number.isFinite(h)).toBe(true);
      if (h > max) max = h;
    }
    expect(max).toBeGreaterThan(0);
  });

  it('is column-major: heights[col*rows + row] maps to world (x,z)', () => {
    const { colsX, rowsZ, cellW, cellD } = NAP_GRID;
    const col = Math.floor(colsX / 2);
    const row = Math.floor(rowsZ / 2);
    const x = NAP_TERRAIN.minX + col * cellW;
    const z = NAP_TERRAIN.minZ + row * cellD;
    expect(heights[col * rowsZ + row]).toBeCloseTo(sampleHeight(x, z), 6);
  });
});

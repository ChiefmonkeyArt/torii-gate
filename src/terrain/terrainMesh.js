// terrain/terrainMesh.js — undulating island ground meshes (Stage 3, v0.2.329).
//
// Builds the NAP and ARENA island surfaces as world-space BufferGeometry meshes.
// Vertices are authored directly in WORLD space (x, h(x,z), z) so there is no
// PlaneGeometry rotation/UV orientation to get wrong — each mesh is bit-identical
// to its sample function by construction. Grass blades bake the same sample() into
// their base Y, so grass sits exactly on the surface. Meshes span the EXTENDED
// grid extent (footprint + outward shore) so the island slopes into the sea.
//
// Browser-only (imports THREE). Pure geometry build, no game state.

import * as THREE from 'three';
import {
  NAP_TERRAIN, NAP_GRID, sampleNapHeight,
  ARENA_TERRAIN, ARENA_GRID, sampleArenaHeight,
} from './heightmap.js';

// Shared builder: world-space grid mesh over a zone's extended extent.
function buildZoneMesh(scene, TERRAIN, GRID, sample, { color, name }) {
  const { colsX, rowsZ, cellW, cellD } = GRID;
  const { gMinX, gMinZ } = TERRAIN;

  const vertCount = colsX * rowsZ;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const normals = new Float32Array(vertCount * 3); // recomputed below

  for (let col = 0; col < colsX; col++) {
    const x = gMinX + col * cellW;
    for (let row = 0; row < rowsZ; row++) {
      const z = gMinZ + row * cellD;
      const vi = (col * rowsZ + row) * 3;
      positions[vi + 0] = x;
      positions[vi + 1] = sample(x, z);
      positions[vi + 2] = z;
      const ui = (col * rowsZ + row) * 2;
      uvs[ui + 0] = col / (colsX - 1);
      uvs[ui + 1] = row / (rowsZ - 1);
    }
  }

  const idxCount = (colsX - 1) * (rowsZ - 1) * 6;
  const indices = new Uint32Array(idxCount);
  let p = 0;
  const vidx = (col, row) => col * rowsZ + row;
  for (let col = 0; col < colsX - 1; col++) {
    for (let row = 0; row < rowsZ - 1; row++) {
      const a = vidx(col,     row);
      const b = vidx(col + 1, row);
      const c = vidx(col + 1, row + 1);
      const d = vidx(col,     row + 1);
      indices[p++] = a; indices[p++] = d; indices[p++] = b;
      indices[p++] = b; indices[p++] = d; indices[p++] = c;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = name;
  if (scene) scene.add(mesh);
  return mesh;
}

// NAP island — green, matching the peaceful-garden tone.
export function buildNapTerrainMesh(scene) {
  return buildZoneMesh(scene, NAP_TERRAIN, NAP_GRID, sampleNapHeight, {
    color: 0x3d5a2f,        // NAP ground-cover green
    name: 'nap-zone-floor', // preserve scene.getObjectByName lookup
  });
}

// Arena island — dark earthy soil tone under the purple→orange arena grass.
export function buildArenaTerrainMesh(scene) {
  return buildZoneMesh(scene, ARENA_TERRAIN, ARENA_GRID, sampleArenaHeight, {
    color: 0x2f2733,        // dark aubergine soil, complements the arena grass
    name: 'arena-floor',
  });
}

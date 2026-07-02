// terrain/terrainMesh.js — NAP-zone undulating ground mesh (Stage 1, v0.2.326).
//
// Replaces the flat NAP floor plane (arena.js _buildNapZone) with a heightmap-
// displaced mesh. Vertices are authored directly in WORLD space (x, h(x,z), z) so
// there is no PlaneGeometry rotation/UV orientation to get wrong — the mesh is
// bit-identical to sampleHeight() by construction. Grass blades bake the same
// sampleHeight() into their base Y, so grass sits exactly on this surface.
//
// Browser-only (imports THREE). Pure geometry build, no game state.

import * as THREE from 'three';
import { NAP_TERRAIN, NAP_GRID, sampleHeight } from './heightmap.js';

// Build + return the NAP terrain mesh (added to scene by the caller, or here).
// Green MeshStandardMaterial matching the existing NAP ground cover tone.
export function buildNapTerrainMesh(scene) {
  const { colsX, rowsZ, cellW, cellD } = NAP_GRID;
  const { minX, minZ } = NAP_TERRAIN;

  const vertCount = colsX * rowsZ;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const normals = new Float32Array(vertCount * 3); // recomputed below

  // Vertices in world space: (x, h(x,z), z). UV = normalised grid coords.
  for (let col = 0; col < colsX; col++) {
    const x = minX + col * cellW;
    for (let row = 0; row < rowsZ; row++) {
      const z = minZ + row * cellD;
      const vi = (col * rowsZ + row) * 3;
      positions[vi + 0] = x;
      positions[vi + 1] = sampleHeight(x, z);
      positions[vi + 2] = z;
      const ui = (col * rowsZ + row) * 2;
      uvs[ui + 0] = col / (colsX - 1);
      uvs[ui + 1] = row / (rowsZ - 1);
    }
  }

  // Indices: two triangles per cell. Grid is (colsX-1) × (rowsZ-1) cells.
  const idxCount = (colsX - 1) * (rowsZ - 1) * 6;
  const indices = new Uint32Array(idxCount);
  let p = 0;
  // Vertex index for (col,row): same layout as positions → col*rowsZ + row.
  const vidx = (col, row) => col * rowsZ + row;
  for (let col = 0; col < colsX - 1; col++) {
    for (let row = 0; row < rowsZ - 1; row++) {
      const a = vidx(col,     row);
      const b = vidx(col + 1, row);
      const c = vidx(col + 1, row + 1);
      const d = vidx(col,     row + 1);
      // Wound so the +Y normal faces up (CCW when viewed from above).
      indices[p++] = a; indices[p++] = d; indices[p++] = b;
      indices[p++] = b; indices[p++] = d; indices[p++] = c;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();   // smooth shading across the rolling hills

  const mat = new THREE.MeshStandardMaterial({
    color: 0x3d5a2f,     // matches the old ground-cover green
    roughness: 1.0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  // Vertices are already in world space → mesh transform is identity.
  mesh.name = 'nap-zone-floor';   // preserve scene.getObjectByName lookup

  if (scene) scene.add(mesh);
  return mesh;
}

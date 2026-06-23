// engine/physics/interactions.js — physics interaction helpers (SDK first slice).
// v0.2.130. A small, public surface for "push something in the world": bullet →
// crate nudges today, and the seam future object interactions (player/body
// contact, breakables, levers) can grow from. The MATH is pure — `nudgeImpulse`
// takes scalars and writes into a reused {x,y,z}, no allocation — so it
// unit-tests in node. `applyNudge` is the thin Rapier-facing wrapper that feeds
// that impulse to ANY body exposing applyImpulseAtPoint(imp, pt, wake), so it too
// tests against a fake body. No Three/Rapier imports here.

// Defaults for the bullet→crate nudge (moved here from weapons.js so the tuning
// lives with the interaction helper). Tuned low so a hit crate visibly shifts/
// tips without launching across the arena.
export const CRATE_IMPULSE = 2.2; // N·s along the push direction
export const CRATE_LIFT    = 0.6; // N·s upward kick so it tips, not just slides

// Build an impulse vector from a direction (need not be unit length): scale by
// `strength` and add `lift` on +Y. Writes into `out` and returns it. No alloc.
export function nudgeImpulse(dx, dy, dz, strength, lift, out) {
  out.x = dx * strength;
  out.y = dy * strength + lift;
  out.z = dz * strength;
  return out;
}

// Apply a nudge impulse to `body` at world point (px,py,pz) along direction
// (dx,dy,dz). `body` is anything with applyImpulseAtPoint(imp, pt, wake) — a
// Rapier RigidBody in production, a fake in tests. `impOut`/`ptOut` are
// caller-supplied reused {x,y,z} scratch so the hot path stays allocation-free.
// Returns true if an impulse was applied (false for a null/incapable body).
export function applyNudge(body, dx, dy, dz, px, py, pz,
                           strength, lift, impOut, ptOut) {
  if (!body || typeof body.applyImpulseAtPoint !== 'function') return false;
  nudgeImpulse(dx, dy, dz, strength, lift, impOut);
  ptOut.x = px; ptOut.y = py; ptOut.z = pz;
  body.applyImpulseAtPoint(impOut, ptOut, true);
  return true;
}

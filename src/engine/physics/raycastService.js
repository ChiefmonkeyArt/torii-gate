// engine/physics/raycastService.js — injectable raycast facade (SDK first slice).
// v0.2.130. Wraps the three Rapier-backed query primitives (closest hit,
// static-only hit, line-of-sight) behind ONE object so consumers — bot LOS,
// bullet checks, future interactions — can depend on an injected service instead
// of reaching for the concrete raycast.js singleton directly. Pure factory: pass
// the real functions in production (see the default `raycastService` below), or
// fakes in tests. No Three/Rapier imports.
//
// This is deliberately a thin first slice: it establishes the seam + the default
// instance and is surfaced on ToriiDebug.physics.service for discoverability.
// Migrating existing call sites (bots.js LOS, weapons.js) onto the injected
// service is a follow-up — the concrete functions keep working unchanged today.
import { castRay, castRayStatic, hasLineOfSight } from './raycast.js';

// Build a service from a set of raycast implementations. Any missing impl
// degrades safely: ray/rayStatic return null (no hit), lineOfSight returns true
// (fall back to "can see"), matching raycast.js's own not-ready behaviour.
export function createRaycastService(impl = {}) {
  const { castRay: ray, castRayStatic: rayStatic, hasLineOfSight: los } = impl;
  return {
    // Closest hit (bots + static); null if nothing within maxDist.
    ray(ox, oy, oz, dx, dy, dz, maxDist, exclude = null, filter = null) {
      return ray ? ray(ox, oy, oz, dx, dy, dz, maxDist, exclude, filter) : null;
    },
    // Static-only hit (ignores bots); null if nothing within maxDist.
    rayStatic(ox, oy, oz, dx, dy, dz, maxDist, excludePlayer = null) {
      return rayStatic ? rayStatic(ox, oy, oz, dx, dy, dz, maxDist, excludePlayer) : null;
    },
    // True if nothing static blocks origin→target (true when impl missing).
    lineOfSight(ox, oy, oz, tx, ty, tz, excludePlayer = null) {
      return los ? los(ox, oy, oz, tx, ty, tz, excludePlayer) : true;
    },
  };
}

// Default service wired to the live Rapier raycast layer.
export const raycastService = createRaycastService({ castRay, castRayStatic, hasLineOfSight });

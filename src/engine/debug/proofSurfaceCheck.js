// engine/debug/proofSurfaceCheck.js — pure, node-safe CROSS-CHECK for the
// in-world proof-surface specs (v0.2.148). Before any future mesh pass binds a
// mesh to a spec, this verifies each spec stays ALIGNED with the live registries
// it claims to feed from:
//   - `previewSdk` must name a real SDK experimental namespace (SDK_SURFACE), and
//   - `shell`     must name a real ToriiDebug.shells report (a buildShellReport key).
// It also re-asserts the inert invariants (readOnly/actionable/signed/published)
// and that no live-action key has crept onto a spec.
//
// Pure + deterministic + node-safe: NO Three/Rapier/DOM, NO renderer mutation, NO
// network/navigation/signing. It only READS static metadata (SDK_SURFACE) and the
// deterministic demo-fixture output of buildShellReport(); it never renders or acts.
//
// Why it lives in engine/debug (not re-exported by the SDK barrel): it imports the
// SDK_SURFACE map, and the SDK barrel must only re-export pure leaf modules. Keeping
// this here (reached via `ToriiDebug.shells.surfaceSpecCheck()`) avoids a barrel↔leaf
// import cycle while still giving a useful default that checks the REAL registries.

import { PROOF_SURFACE_SPECS } from '../world/proofSurfaceSpecs.js';
import { buildShellReport } from './shellReport.js';
import { SDK_SURFACE, STABILITY } from '../../sdk/index.js';

// Keys that would betray a live/actionable surface — a spec is a placement contract,
// not a behaviour, so none of these may appear on it. Kept disjoint from the legit
// spec keys (id/step/lean/title/kind/previewSdk/shell/anchor/note/position/size/
// yawRad/invariants).
const FORBIDDEN_SPEC_KEYS = Object.freeze([
  'fetch', 'navigate', 'href', 'url', 'onClick', 'onclick', 'sign', 'publish',
  'checkout', 'pay', 'zap', 'submit', 'relay', 'action', 'actions',
  'mesh', 'geometry', 'material',
]);

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

// Accepts a Set, an array, or null/undefined → returns a Set (or null if absent).
function toNameSet(v) {
  if (v == null) return null;
  return v instanceof Set ? v : new Set(v);
}

// Real SDK experimental namespace names (live, non-forward-declared).
function experimentalSdkNames() {
  return new Set(
    Object.entries(SDK_SURFACE)
      .filter(([, m]) => m.tier === STABILITY.EXPERIMENTAL && m.module)
      .map(([name]) => name),
  );
}

// Every declared SDK surface name (any tier, including forward-declared internals).
function allSdkNames() {
  return new Set(Object.keys(SDK_SURFACE));
}

// Real ToriiDebug.shells report names — the keys buildShellReport() emits. Pure:
// buildShellReport uses deterministic demo fixtures (no network/signing).
function defaultShellNames() {
  return new Set(Object.keys(buildShellReport()));
}

// checkProofSurfaceSpecs(surfaceMap?, specs?) → a deterministic
// { ok, badge, checked, errors, warnings, surfaces } report.
//
// `surfaceMap` lets a caller inject the registries to check against:
//   { sdk: <names>, shells: <names> }  (Set | array, either optional)
// When omitted, the real registries are used: SDK experimental namespaces for
// `sdk` (with every declared name treated as "known"), and buildShellReport()'s
// keys for `shells`. An unknown SDK name is an ERROR; a known-but-non-experimental
// SDK name is a WARNING. Errors fail `ok`; warnings do not.
export function checkProofSurfaceSpecs(surfaceMap = {}, specs = PROOF_SURFACE_SPECS) {
  const sdkProvided = surfaceMap.sdk != null;
  const validSdk = sdkProvided ? toNameSet(surfaceMap.sdk) : experimentalSdkNames();
  const knownSdk = sdkProvided ? validSdk : allSdkNames();
  const shellNames = surfaceMap.shells != null ? toNameSet(surfaceMap.shells) : defaultShellNames();

  const errors = [];
  const warnings = [];
  const surfaces = [];

  for (const spec of specs) {
    const id = isNonEmptyString(spec && spec.id) ? spec.id : '(unknown)';

    // previewSdk → SDK experimental namespace
    let sdkOk = false;
    if (!isNonEmptyString(spec.previewSdk)) {
      errors.push(`${id}: previewSdk is missing`);
    } else if (!knownSdk.has(spec.previewSdk)) {
      errors.push(`${id}: previewSdk '${spec.previewSdk}' is not a known SDK surface`);
    } else if (!validSdk.has(spec.previewSdk)) {
      warnings.push(`${id}: previewSdk '${spec.previewSdk}' is not an experimental SDK surface`);
      sdkOk = true;
    } else {
      sdkOk = true;
    }

    // shell → ToriiDebug.shells report
    let shellOk = false;
    if (!isNonEmptyString(spec.shell)) {
      errors.push(`${id}: shell is missing`);
    } else if (!shellNames.has(spec.shell)) {
      errors.push(`${id}: shell '${spec.shell}' is not a ToriiDebug.shells report`);
    } else {
      shellOk = true;
    }

    // inert invariants — re-assert the spec stays display-only
    const inv = spec.invariants || {};
    let inert = true;
    if (inv.readOnly !== true) { errors.push(`${id}: invariants.readOnly must be true`); inert = false; }
    if (inv.actionable !== false) { errors.push(`${id}: invariants.actionable must be false`); inert = false; }
    if (inv.signed === true) { errors.push(`${id}: invariants.signed must not be true`); inert = false; }
    if (inv.published === true) { errors.push(`${id}: invariants.published must not be true`); inert = false; }

    // no live-action key may appear on the spec
    const leaked = FORBIDDEN_SPEC_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(spec, k));
    if (leaked.length > 0) {
      errors.push(`${id}: forbidden live-action key(s): ${leaked.join(', ')}`);
      inert = false;
    }

    surfaces.push({ id, previewSdk: spec.previewSdk, shell: spec.shell, sdkOk, shellOk, inert });
  }

  return {
    badge: 'SPEC-CHECK · READ-ONLY · NO RENDER',
    checked: specs.length,
    ok: errors.length === 0,
    errors,
    warnings,
    surfaces,
  };
}

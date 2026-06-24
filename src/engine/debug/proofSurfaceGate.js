// engine/debug/proofSurfaceGate.js — pure, node-safe PROMOTION/REGRESSION GATE for
// the display-only proof-surface boards (v0.2.152). It folds the three already-pure
// layers that must ALL hold before the in-world proof boards may be built (and, in
// the future, before any preview→live promotion) into one fail-fast report:
//   1. spec↔registry cross-check   — checkProofSurfaceSpecs().ok (v0.2.148)
//   2. render plan                  — buildProofSurfaceRenderPlan().ok (v0.2.150)
//   3. scene-graph parent binding   — resolveParentBindings(plan).ok (v0.2.151)
//
// A single `ok` answers "are the proof boards + their bindings safe and complete?"
// so the regression check (tools/regression-check.mjs check [12]) and a reviewer can
// fail fast with a concrete list of `reasons` instead of discovering a broken board
// in the browser.
//
// Pure + deterministic + node-safe: NO Three/Rapier/DOM, NO renderer mutation, NO
// network/navigation/signing. It only composes the plain-data outputs of the three
// pure helpers; it renders and acts on nothing. Each gate input may be injected via
// opts so a test can drive a deliberately-broken layer and prove the gate catches it.

import { checkProofSurfaceSpecs } from './proofSurfaceCheck.js';
import { buildProofSurfaceRenderPlan } from '../world/proofSurfaceRenderPlan.js';
import { resolveParentBindings } from '../world/proofSurfaceParentBinding.js';

export const PROOF_GATE_BADGE = 'PROOF-GATE · READ-ONLY · PROMOTION';

// proofSurfaceGate(opts?) → a JSON-serialisable, read-only gate report:
//   {
//     badge, ok,
//     gates:   { specCheck, renderPlan, parentBinding },  // per-layer booleans
//     counts:  { panels, groups, bound, unbound },
//     reasons: [ ... ],   // concrete failure reasons (empty iff ok)
//     rendered: false, actionable: false,
//   }
// `ok` is true iff ALL three layers pass. Inputs may be injected for testing:
//   opts.check    — a checkProofSurfaceSpecs() result (default: the live check)
//   opts.anchors  — passed through to buildProofSurfaceRenderPlan (anchor resolution)
//   opts.plan     — a render plan (default: built from check + anchors)
//   opts.binding  — a resolveParentBindings() result (default: from the plan)
// Pure — allocates only plain objects/arrays, never a THREE class.
export function proofSurfaceGate(opts = {}) {
  const check = opts.check || checkProofSurfaceSpecs();
  const plan = opts.plan || buildProofSurfaceRenderPlan({ anchors: opts.anchors, check });
  const binding = opts.binding || resolveParentBindings(plan);

  const reasons = [];

  const specCheckOk = !!(check && check.ok === true);
  if (!specCheckOk) {
    reasons.push('spec-check-failed');
    for (const e of (check && Array.isArray(check.errors) ? check.errors : [])) {
      reasons.push(`spec-check: ${e}`);
    }
  }

  const renderPlanOk = !!(plan && plan.ok === true);
  if (!renderPlanOk) {
    reasons.push('render-plan-not-ok');
    for (const r of (plan && Array.isArray(plan.reasons) ? plan.reasons : [])) {
      reasons.push(`render-plan: ${r}`);
    }
  }

  const parentBindingOk = !!(binding && binding.ok === true);
  if (!parentBindingOk) {
    reasons.push('parent-binding-not-ok');
    const unbound = binding && Array.isArray(binding.unbound) ? binding.unbound : [];
    if (unbound.length > 0) reasons.push(`parent-binding: unbound ${unbound.join(', ')}`);
  }

  const groups = binding && Array.isArray(binding.groups) ? binding.groups : [];
  const unbound = binding && Array.isArray(binding.unbound) ? binding.unbound : [];
  const bound = groups.reduce((n, g) => n + (g && Array.isArray(g.panelIds) ? g.panelIds.length : 0), 0);

  return {
    badge: PROOF_GATE_BADGE,
    ok: specCheckOk && renderPlanOk && parentBindingOk,
    gates: { specCheck: specCheckOk, renderPlan: renderPlanOk, parentBinding: parentBindingOk },
    counts: {
      panels: plan && typeof plan.count === 'number' ? plan.count : 0,
      groups: groups.length,
      bound,
      unbound: unbound.length,
    },
    reasons,
    // A review gate, not a live structure — never renders or acts.
    rendered: false,
    actionable: false,
  };
}

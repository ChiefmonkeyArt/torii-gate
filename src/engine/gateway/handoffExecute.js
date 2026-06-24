// engine/gateway/handoffExecute.js — first controlled SAME-ORIGIN gateway travel
// EXECUTOR (GATEWAY / NAP-zone handoff, v0.2.168). Acts on a v0.2.167 READY
// handoff plan (see handoffPlan.js) — but ONLY through an INJECTED host transport
// and ONLY for a safe same-origin `targetRoute`. This is the first real travel-
// action foundation; everything else stays inert.
//
// Constrained by construction:
//   - NO direct browser navigation here: never touches `location.href`/
//     `location.assign`/`window.open`/`history.pushState`/`reload`/router. The
//     ONLY way a route change happens is by calling the host-provided
//     `transport.navigate(route)` — a fake in tests, real wiring in a later host.
//   - Same-origin ONLY: the plan's `targetRoute` is re-validated with
//     `safeRoutePath` before it is ever handed to the transport. The external
//     `targetUrl` is NEVER executed this slice — it stays preview-only (external:
//     false on every report).
//   - NO live network writes, NO Nostr client/WebSocket/relay I/O, NO signing,
//     NO publishing, NO NIP-07, NO key handling, NO payments, NO auto-update, NO
//     world unload/reload, NO timers. signed:false/published:false/network:false/
//     worldReloaded:false on every report.
//   - Default-safe: with no usable transport (or `opts.dryRun`) it is a NO-OP —
//     `navigated:false`/`performed:false`. A blocked/invalid plan is refused.
//   - Rollback WITHOUT timers: if `transport.navigate` throws/returns false and a
//     `transport.rollback` exists, it is invoked once to restore the rollback
//     route; both the failure and the rollback outcome are captured in the report.
//   - Pure + node-safe: no THREE/Rapier/DOM/fs imports; exposes NO bare
//     navigate/open/reload/goto/assign method of its own.

import { planHandoff, safeRoutePath, HANDOFF_STATUS } from './handoffPlan.js';
import { TRAVEL_ACTION } from './travelConfirm.js';

// EXECUTE_VERSION — bumped when the execution-report shape changes.
export const EXECUTE_VERSION = 1;

// Badge stamped on every report: this acts, but only same-origin via the host.
export const EXECUTE_BADGE = 'TRAVEL · SAME-ORIGIN · HOST-TRANSPORT';

// Execution outcomes. `done` = navigate succeeded; `no-op` = nothing attempted
// (no transport / forced dry-run); `blocked` = plan refused before any attempt;
// `failed` = navigate failed and could not be rolled back; `rolled-back` =
// navigate failed but the rollback route was restored.
export const EXECUTE_STATUS = Object.freeze({
  DONE: 'done',
  NOOP: 'no-op',
  BLOCKED: 'blocked',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled-back',
});

// isHostTransport(t) → true when `t` is a usable injected transport, i.e. a plain
// object exposing a `navigate` function. `snapshot`/`rollback`/`log` are optional.
// Pure, never throws. The presence of a real transport is what separates an
// ACTING run from the default no-op.
export function isHostTransport(t) {
  return !!t && typeof t === 'object' && !Array.isArray(t) && typeof t.navigate === 'function';
}

// _step(step, ok, detail) → one execution-trace row. Pure.
function _step(step, ok, detail) {
  return { step, ok, detail: detail == null ? '' : String(detail) };
}

// _isReadyPlan(plan) → true when `plan` looks like a v0.2.167 READY handoff plan
// that is safe to act on: ready status, dry-run origin, gateway:travel action.
// Pure, defensive — a non-plan input is simply not ready.
function _isReadyPlan(plan) {
  return !!plan && typeof plan === 'object'
    && plan.action === TRAVEL_ACTION
    && plan.status === HANDOFF_STATUS.READY
    && plan.ok === true
    && plan.dryRun === true;
}

// _log(transport, entry) → best-effort optional host log hook. Pure side-channel;
// a throwing log must never break execution, so it is swallowed.
function _log(transport, entry) {
  if (transport && typeof transport.log === 'function') {
    try { transport.log(entry); } catch { /* host log is best-effort */ }
  }
}

// _report(fields) → a fully-shaped execution report with the safety invariants
// pinned. Callers override only the dynamic fields. The pinned flags can never be
// flipped by a caller because they are spread LAST.
function _report(fields) {
  return {
    version: EXECUTE_VERSION,
    badge: EXECUTE_BADGE,
    action: TRAVEL_ACTION,
    status: EXECUTE_STATUS.NOOP,
    ok: false,
    reason: '',
    targetRoute: null,
    fromRoute: null,
    rollbackRoute: null,
    steps: [],
    rollback: null,
    rolledBack: false,
    errors: [],
    ...fields,
    // Pinned invariants — ALWAYS, regardless of `fields`.
    navigated: fields.navigated === true,
    performed: fields.performed === true,
    external: false,
    worldReloaded: false,
    signed: false,
    published: false,
    network: false,
  };
}

// executeHandoff(plan, transport, opts) → an execution report. Acts on a READY
// handoff plan by handing its safe same-origin route to an injected transport.
//
//   plan       a v0.2.167 planHandoff() result (status:'ready', dryRun:true)
//   transport  { navigate(route), snapshot?(), rollback?(route), log?() } | null
//   opts       { dryRun?:boolean }  — dryRun:true forces a NO-OP even with a transport
//
// Returns (shape highlights):
//   {
//     version, badge, action:'gateway:travel',
//     status: 'done'|'no-op'|'blocked'|'failed'|'rolled-back',
//     ok,                 // true ONLY when navigate succeeded
//     reason,
//     targetRoute,        // the safe same-origin route handed to the transport
//     fromRoute,          // plan.currentRoute at start
//     rollbackRoute,
//     steps: [{ step, ok, detail }],
//     rollback: { attempted, ok, route } | null,
//     rolledBack,
//     navigated,          // true ONLY if transport.navigate succeeded
//     performed,          // true ONLY when navigate succeeds
//     external: false, worldReloaded: false,
//     signed: false, published: false, network: false,
//     errors: [string],
//   }
//
// Pure of browser side effects: the ONLY effect is whatever the injected
// transport chooses to do. Never throws.
export function executeHandoff(plan, transport = null, opts = {}) {
  const dryRun = !!(opts && opts.dryRun);
  const fromRoute = plan && typeof plan.currentRoute === 'string' ? plan.currentRoute : null;
  const rollbackRoute = plan && typeof plan.rollbackRoute === 'string' ? plan.rollbackRoute : null;
  const steps = [];

  // 1. The plan must be a READY v0.2.167 handoff plan before anything is attempted.
  const ready = _isReadyPlan(plan);
  steps.push(_step('validate-plan', ready, ready ? 'ready' : (plan && plan.status) || 'not-a-plan'));
  if (!ready) {
    return _report({
      status: EXECUTE_STATUS.BLOCKED,
      reason: 'plan-not-ready',
      fromRoute, rollbackRoute, steps,
      errors: ['handoff plan is not ready — refusing to act'],
    });
  }

  // 2. Re-validate the target route is a safe same-origin path. The external
  //    targetUrl is preview-only and is NEVER executed in this slice.
  const targetRoute = safeRoutePath(plan.targetRoute);
  const routeSafe = !!targetRoute;
  steps.push(_step('validate-target-route', routeSafe, targetRoute || plan.targetRoute || 'none'));
  if (!routeSafe) {
    return _report({
      status: EXECUTE_STATUS.BLOCKED,
      reason: 'unsafe-target-route',
      fromRoute, rollbackRoute, steps,
      errors: ['target route is not a safe same-origin path — refusing to navigate'],
    });
  }

  // 3. A usable injected transport is required to act. No transport (or a forced
  //    dryRun) → a safe NO-OP that performs nothing.
  const hasTransport = isHostTransport(transport);
  if (!hasTransport || dryRun) {
    const reason = dryRun ? 'dry-run' : 'no-transport';
    steps.push(_step('validate-transport', false, reason));
    return _report({
      status: EXECUTE_STATUS.NOOP,
      reason,
      targetRoute, fromRoute, rollbackRoute, steps,
    });
  }
  steps.push(_step('validate-transport', true, 'navigate present'));
  _log(transport, { event: 'handoff:begin', action: TRAVEL_ACTION, from: fromRoute, to: targetRoute });

  // 4. Optional pre-navigation snapshot (host captures rollback/carried state).
  if (typeof transport.snapshot === 'function') {
    let snapOk = true;
    let snapDetail = 'captured';
    try { transport.snapshot(); } catch (err) { snapOk = false; snapDetail = (err && err.message) || 'snapshot failed'; }
    steps.push(_step('snapshot', snapOk, snapDetail));
  }

  // 5. The single ACTING step: hand the safe route to the host transport. A thrown
  //    error or an explicit `false` return is treated as a navigation failure.
  let navError = null;
  try {
    const result = transport.navigate(targetRoute);
    if (result === false) navError = 'transport.navigate returned false';
  } catch (err) {
    navError = (err && err.message) || 'transport.navigate threw';
  }

  if (!navError) {
    steps.push(_step('navigate', true, targetRoute));
    _log(transport, { event: 'handoff:done', to: targetRoute });
    return _report({
      status: EXECUTE_STATUS.DONE,
      ok: true,
      reason: 'navigated',
      targetRoute, fromRoute, rollbackRoute, steps,
      navigated: true,
      performed: true,
    });
  }

  // 6. Navigation failed. Attempt a single rollback if the transport supports it
  //    (no timers — one synchronous attempt). Capture both outcomes.
  steps.push(_step('navigate', false, navError));
  const errors = [navError];
  const canRollback = typeof transport.rollback === 'function' && !!rollbackRoute;
  const rollback = { attempted: false, ok: false, route: rollbackRoute };

  if (canRollback) {
    rollback.attempted = true;
    try {
      const r = transport.rollback(rollbackRoute);
      rollback.ok = r !== false;
    } catch (err) {
      rollback.ok = false;
      errors.push((err && err.message) || 'transport.rollback threw');
    }
    steps.push(_step('rollback', rollback.ok, rollback.ok ? rollbackRoute : 'rollback failed'));
  } else {
    steps.push(_step('rollback', false, rollbackRoute ? 'no rollback transport' : 'no rollback route'));
  }
  _log(transport, { event: 'handoff:failed', error: navError, rolledBack: rollback.ok });

  return _report({
    status: rollback.ok ? EXECUTE_STATUS.ROLLED_BACK : EXECUTE_STATUS.FAILED,
    reason: rollback.ok ? 'rolled-back' : 'navigate-failed',
    targetRoute, fromRoute, rollbackRoute, steps,
    rollback,
    rolledBack: rollback.ok,
    errors,
  });
}

// executeHandoffFor(input, grant, transport, opts) → build a handoff plan from a
// travel intent (planHandoff) and immediately attempt execution. Convenience for
// the debug shell + tests so a caller need not thread the plan by hand. With no
// transport this is a NO-OP, exactly like executeHandoff. Never throws.
export function executeHandoffFor(input = {}, grant = null, transport = null, opts = {}) {
  const hostContext = opts && opts.hostContext ? opts.hostContext : null;
  const plan = planHandoff(input, grant, hostContext);
  return executeHandoff(plan, transport, opts);
}

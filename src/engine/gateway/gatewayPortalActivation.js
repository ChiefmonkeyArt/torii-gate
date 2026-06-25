// engine/gateway/gatewayPortalActivation.js — the in-world GATEWAY PORTAL
// activation seam (GATEWAY / NAP-zone handoff, v0.2.180, LEAN-2 continuation).
// Bridges a gateway COMPONENT at the in-world boundary to the v0.2.178 CONFIRMED
// same-origin activation (`activateGatewayHandoff`). It is the seam a host wires
// when "the player used this gate" must become a real, consent-gated, same-origin
// route hop — but ONLY after an explicit confirmation step.
//
// It adds NO new capability over gatewayActivation; it only:
//   1. MAPS a gateway component's manifest destination (`gatewayDestination` →
//      `{ npub, relay, target, position }`) onto a same-origin activation input,
//      carrying the INTERNAL `target` as the destination zone id and DELIBERATELY
//      dropping any external `website` (the hop is same-origin route only — an
//      external profile URL is never built into the input and never navigated).
//   2. SANITISES the route allowlist to a meaningful scoped prefix (default
//      `['/zone/']`), folding away trivially-permissive prefixes like `'/'` so the
//      boundary can NEVER be armed with a permit-everything allowlist (SEC
//      route-hardening v0.2.179; requirement: never `['/']`).
//   3. Provides a small ARM → CONFIRM → (navigate) boundary controller so the
//      explicit confirmation is a distinct, auditable step: arming a portal never
//      navigates; only `confirm()` resolves the injected transport and acts.
//
// Constrained by construction (inherited from gatewayActivation + enforced here):
//   - The browser `window`/transport/host is INJECTED at construction or call time,
//     NEVER reached for at module scope. No DOM/Three/Rapier/fs/network imports.
//   - SAME-ORIGIN ONLY: the route flows through safeRoutePath + the scoped allowlist;
//     no external navigation, no `window.open`/`location.href`/`eval`, no world
//     unload/reload, no relay I/O, no signing/NIP-07/key handling, no payments, no
//     auto-update, no timers. Every safety flag stays false.
//   - The SEC-2 signed/relay-mediated travel tier is untouched and remains not live.
// This module exposes NO bare navigate/open/reload/goto/assign/href/pushState method
// of its own — every effect is delegated to the injected transport via the executor.

import { gatewayDestination } from './gatewayHandoff.js';
import { activateGatewayHandoff, ACTIVATION_STATUS, TRANSPORT_KIND } from './gatewayActivation.js';
import { TRAVEL_ACTION } from './travelConfirm.js';

// PORTAL_ACTIVATION_VERSION — bumped when the portal report shape changes.
export const PORTAL_ACTIVATION_VERSION = 1;

// Badge stamped on every portal report: this acts, but only after an explicit
// confirmation and only same-origin via the injected host transport.
export const PORTAL_ACTIVATION_BADGE = 'GATEWAY PORTAL · CONFIRMED · SAME-ORIGIN HOP';

// The default, MEANINGFUL scoped allowlist for the in-world portal boundary. A hop
// may only land on a same-origin `/zone/…` route. Never `'/'` (SEC v0.2.179).
export const DEFAULT_PORTAL_ALLOWLIST = Object.freeze(['/zone/']);

// Boundary lifecycle states. `idle` = nothing armed; `armed` = a valid portal is
// staged and awaiting an explicit confirm; `navigated`/`blocked` = the outcome of
// the last confirm. Arming is INERT — it never navigates.
export const PORTAL_STATE = Object.freeze({
  IDLE: 'idle',
  ARMED: 'armed',
  NAVIGATED: 'navigated',
  BLOCKED: 'blocked',
});

// Minimum meaningful allowlist-prefix length (mirrors gatewayActivation's
// MIN_ALLOWLIST_PREFIX_LEN): a 1-char prefix like `'/'` matches every route.
const MIN_PORTAL_PREFIX_LEN = 2;
// Default in-world proximity radius (world units) for `withinPortalRange`.
const DEFAULT_PORTAL_RANGE = 3;

// sanitizePortalAllowlist(allowlist) → a meaningful same-origin prefix list. Pure,
// never throws. Keeps only string prefixes that start with `/` and are at least
// MIN_PORTAL_PREFIX_LEN chars, so trivially-permissive prefixes (`'/'`) are dropped.
// If NOTHING meaningful survives (e.g. `['/']` or a non-array), it falls back to
// DEFAULT_PORTAL_ALLOWLIST — the boundary is therefore NEVER permit-everything.
export function sanitizePortalAllowlist(allowlist) {
  const out = [];
  if (Array.isArray(allowlist)) {
    for (const p of allowlist) {
      if (typeof p === 'string' && p.length >= MIN_PORTAL_PREFIX_LEN && p[0] === '/') out.push(p);
    }
  }
  return out.length ? out : [...DEFAULT_PORTAL_ALLOWLIST];
}

// portalActivationInput(component, context) → { ok, errors, input }. Pure, never
// throws. Maps a gateway component's manifest destination onto a same-origin
// activation input for activateGatewayHandoff. The INTERNAL `target` becomes the
// destination `zoneId` (so handoffRouteFor yields `/zone/<slug>`); any external
// `website` is intentionally NOT carried (same-origin hop only). A gateway with no
// `target` is rejected — there is no same-origin destination to travel to.
//
//   context (all optional): { title, zoneType, from, origin }
export function portalActivationInput(component, context = {}) {
  const dest = gatewayDestination(component);
  if (!dest) {
    return { ok: false, errors: ['component is not a gateway (no manifest.gateway)'], input: null };
  }
  const zoneId = typeof dest.target === 'string' && dest.target !== '' ? dest.target : null;
  if (!zoneId) {
    return { ok: false, errors: ['gateway has no same-origin target zone (manifest.gateway.target)'], input: null };
  }
  const ctx = (context && typeof context === 'object' && !Array.isArray(context)) ? context : {};
  const input = {
    destination: {
      zoneId,
      title: ctx.title || dest.title || zoneId,
      zoneType: ctx.zoneType,
      npub: dest.npub || null,
      relays: dest.relay ? [dest.relay] : undefined,
      // NOTE: dest.website / any external URL is intentionally OMITTED — the portal
      // hop is a same-origin route only; an external profile URL is never navigated.
    },
    origin: ctx.origin || 'gateway-portal',
  };
  return { ok: true, errors: [], input };
}

// withinPortalRange(playerPos, portalPos, radius) → boolean. Pure scalar proximity
// test (squared-distance compare — NO Vector3/Matrix4 allocation, safe for hot
// paths). Both points are plain `{ x, y, z }`; missing components count as 0. A
// non-positive radius is never "in range". Lets a host decide when a portal is
// close enough to ARM without pulling in any math/render dependency.
export function withinPortalRange(playerPos, portalPos, radius = DEFAULT_PORTAL_RANGE) {
  if (!playerPos || !portalPos || typeof playerPos !== 'object' || typeof portalPos !== 'object') return false;
  const r = Number(radius);
  if (!(r > 0)) return false;
  const dx = (Number(playerPos.x) || 0) - (Number(portalPos.x) || 0);
  const dy = (Number(playerPos.y) || 0) - (Number(portalPos.y) || 0);
  const dz = (Number(playerPos.z) || 0) - (Number(portalPos.z) || 0);
  return (dx * dx + dy * dy + dz * dz) <= r * r;
}

// _portalReport(fields) → a fully-shaped portal-activation report with the safety
// invariants pinned LAST so a caller can never flip them. Mirrors the gatewayActivation
// report contract plus the portal-specific `zoneId`/`routeAllowlist`/`activation`.
function _portalReport(fields) {
  return {
    version: PORTAL_ACTIVATION_VERSION,
    badge: PORTAL_ACTIVATION_BADGE,
    action: TRAVEL_ACTION,
    status: ACTIVATION_STATUS.UNCONFIRMED,
    ok: false,
    confirmed: false,
    live: false,
    reason: '',
    transportKind: TRANSPORT_KIND.NONE,
    zoneId: null,
    targetRoute: null,
    fromRoute: null,
    rollbackRoute: null,
    routeAllowlist: [...DEFAULT_PORTAL_ALLOWLIST],
    activation: null,
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

// activatePortalHandoff(component, context, grant, opts) → a portal-activation
// report. The ONE-SHOT entry point: map the gateway component → same-origin input,
// then delegate to activateGatewayHandoff with a sanitised scoped allowlist. Pure of
// browser side effects beyond whatever the injected transport does; never throws.
//
//   opts {
//     confirmed:      boolean,   // MUST be literal true to navigate (forwarded)
//     window/transport/host:     // injected transport source (browser is the LIVE path)
//     hostContext:    {...},     // { currentRoute, rollbackRoute }
//     home, onLog,
//     routeAllowlist: string[],  // sanitised to a meaningful scoped list (default ['/zone/'])
//     dryRun:         boolean,
//   }
export function activatePortalHandoff(component, context = {}, grant = null, opts = {}) {
  const o = (opts && typeof opts === 'object' && !Array.isArray(opts)) ? opts : {};
  const routeAllowlist = sanitizePortalAllowlist(o.routeAllowlist);
  const built = portalActivationInput(component, context);
  if (!built.ok) {
    return _portalReport({
      status: ACTIVATION_STATUS.BLOCKED,
      confirmed: o.confirmed === true,
      reason: 'no-portal-destination',
      routeAllowlist,
      errors: built.errors,
    });
  }
  const activation = activateGatewayHandoff(built.input, grant, {
    confirmed: o.confirmed === true,
    window: o.window,
    transport: o.transport,
    host: o.host,
    hostContext: o.hostContext,
    home: o.home,
    onLog: o.onLog,
    routeAllowlist,
    dryRun: o.dryRun === true,
  });
  return _portalReport({
    status: activation.status,
    ok: activation.ok === true,
    confirmed: activation.confirmed === true,
    live: activation.live === true,
    reason: activation.reason || activation.status,
    transportKind: activation.transportKind,
    zoneId: built.input.destination.zoneId,
    targetRoute: activation.targetRoute,
    fromRoute: activation.fromRoute,
    rollbackRoute: activation.rollbackRoute,
    routeAllowlist,
    activation,
    navigated: activation.navigated === true,
    performed: activation.performed === true,
    errors: activation.errors || [],
  });
}

// createGatewayPortalBoundary(opts) → an injectable, stateful in-world portal
// controller. The transport source (`window`/`transport`/`host`) and host
// context/allowlist are captured ONCE at construction — never module scope — so the
// host injects the real browser window exactly here and nowhere else. Arming a
// portal is INERT (no navigation); only `confirm()` resolves the transport and acts,
// modelling the explicit confirmation step.
//
//   opts { window|transport|host, hostContext, home, onLog, routeAllowlist, dryRun }
//
// Returns:
//   state()          → current PORTAL_STATE
//   armed()          → true iff a portal is staged awaiting confirm
//   routeAllowlist() → a copy of the sanitised scoped allowlist
//   stagedZoneId()   → the armed destination zone id (or null)
//   arm(component, context) → { armed, errors, zoneId? } — stages a valid portal
//   cancel()         → { armed:false } — clears the staged portal (INERT)
//   confirm(grant, extra) → portal-activation report — the explicit, acting step
export function createGatewayPortalBoundary(opts = {}) {
  const base = (opts && typeof opts === 'object' && !Array.isArray(opts)) ? opts : {};
  const routeAllowlist = sanitizePortalAllowlist(base.routeAllowlist);
  // Injected transport sources captured at construction — NEVER reached at module scope.
  const injected = { window: base.window, transport: base.transport, host: base.host };

  let state = PORTAL_STATE.IDLE;
  let stagedComponent = null;
  let stagedContext = null;
  let stagedZoneId = null;

  function _reset() { stagedComponent = null; stagedContext = null; stagedZoneId = null; }

  function arm(component, context = {}) {
    const built = portalActivationInput(component, context);
    if (!built.ok) {
      state = PORTAL_STATE.IDLE;
      _reset();
      return { armed: false, errors: built.errors };
    }
    stagedComponent = component;
    stagedContext = context;
    stagedZoneId = built.input.destination.zoneId;
    state = PORTAL_STATE.ARMED;
    return { armed: true, errors: [], zoneId: stagedZoneId };
  }

  function cancel() {
    state = PORTAL_STATE.IDLE;
    _reset();
    return { armed: false };
  }

  function confirm(grant = null, extra = {}) {
    if (state !== PORTAL_STATE.ARMED) {
      return _portalReport({
        status: ACTIVATION_STATUS.UNCONFIRMED,
        confirmed: false,
        reason: 'not-armed',
        routeAllowlist,
        errors: ['portal boundary is not armed — call arm() first'],
      });
    }
    const e = (extra && typeof extra === 'object' && !Array.isArray(extra)) ? extra : {};
    const rep = activatePortalHandoff(stagedComponent, stagedContext, grant, {
      confirmed: true,
      window: injected.window,
      transport: injected.transport,
      host: injected.host,
      hostContext: e.hostContext || base.hostContext,
      home: base.home,
      onLog: base.onLog,
      routeAllowlist,
      dryRun: e.dryRun === true || base.dryRun === true,
    });
    state = rep.navigated ? PORTAL_STATE.NAVIGATED : PORTAL_STATE.BLOCKED;
    _reset();
    return rep;
  }

  return {
    state: () => state,
    armed: () => state === PORTAL_STATE.ARMED,
    routeAllowlist: () => [...routeAllowlist],
    stagedZoneId: () => stagedZoneId,
    arm,
    cancel,
    confirm,
  };
}

// DEMO_PORTAL_CONTEXT — deterministic sample traveller context for the debug shell
// ONLY (a title + zoneType for the staged hop). Not used by gameplay.
export const DEMO_PORTAL_CONTEXT = Object.freeze({
  title: 'Plebeian Market Bazaar',
  zoneType: 'shop',
  origin: 'debug-shell',
});

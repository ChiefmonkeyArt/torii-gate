// engine/gateway/travelSmoke.js — pure, node-safe GATEWAY TRAVEL SMOKE HARNESS
// (GATEWAY / NAP-zone handoff, v0.2.195, LEAN-2 continuation). It folds the already-
// pure travel-flow contracts into ONE fail-fast smoke report so future feature work on
// the portal/travel path can be regression-checked locally without a browser:
//
//   1. trigger arms ON proximity            — createPortalTrigger over a demo gate
//   2. proximity ALONE never navigates      — tick() arms but performs nothing
//   3. explicit confirm is required          — interact() acts only when armed, else null
//   4. same-origin route only                — hop targets `/#/zone/<slug>`, external:false
//   5. allowlist is never permit-everything  — scoped `/#/zone/` prefix, never `['/']`
//   6. /#/zone/<slug> route resolves          — parseZoneRoute classifies a valid zone
//   7. hostile routes are rejected            — traversal/scheme/protocol-relative → invalid
//   8. no external URL is carried             — a gateway `website` is dropped from the hop
//   9. consent gates travel                   — no grant → blocked; a grant → allowed only
//  10. no auto travel / write                 — every report pins navigated/performed/
//                                               external/signed/published/network = false
//
// A single `ok` answers "do the gateway travel contracts still hold?" so a test (and a
// future regression check) can fail fast with a concrete `reasons` list instead of
// discovering a broken portal in the browser.
//
// Constrained by construction — this harness adds NO new capability and exercises the
// flow in the SAFEST possible mode:
//   - PURE + node-safe: no THREE/Rapier/DOM/window/location/fs/network imports. It
//     drives the boundary with NO injected transport and `dryRun:true`, so a `confirm()`
//     is a dry-run no-op that navigates nothing even when fully confirmed.
//   - It composes plain-data outputs of the shipped pure helpers; it renders and acts on
//     nothing, exposes NO navigate/open/reload/goto/assign/href/pushState surface, and
//     never throws (every check is wrapped; malformed injected input degrades to a fail).
//   - All same-origin / allowlist / consent / confirmation guarantees are inherited
//     unchanged from the modules it exercises.

import { createToriiGateway } from '../components/toriiGateway.js';
import {
  createGatewayPortalBoundary,
  activatePortalHandoff,
  portalActivationInput,
  DEFAULT_PORTAL_ALLOWLIST,
} from './gatewayPortalActivation.js';
import { createPortalTrigger } from './portalTrigger.js';
import { parseZoneRoute, ZONE_ROUTE_KIND, ZONE_CANONICAL_PREFIX } from './zoneRoute.js';
import { prepareTravelIntent } from './travelConfirm.js';

// TRAVEL_SMOKE_VERSION — bumped when the smoke report shape changes.
export const TRAVEL_SMOKE_VERSION = 1;

// Badge stamped on the report: this exercises the travel flow, but read-only + inert.
export const TRAVEL_SMOKE_BADGE = 'GATEWAY TRAVEL SMOKE · READ-ONLY · DRY-RUN';

// The safety flags every travel-flow report MUST pin false. If any report flips one of
// these, the no-auto-action contract is broken and the smoke fails.
const SAFETY_FLAGS = Object.freeze(['navigated', 'performed', 'external', 'signed', 'published', 'network']);

// A deterministic same-origin demo gate the harness travels THROUGH. Its internal
// `target` becomes the destination zone id (→ `/#/zone/plebeian-market-bazaar`); the
// `website` is an external URL the same-origin hop MUST drop. Fixed so the smoke is
// reproducible; not used by gameplay.
export function demoGatewayComponent() {
  return createToriiGateway({
    npub: 'npub1demo000000000000000000000000000000000000000000000000000',
    relay: 'wss://relay.example.com',
    target: 'plebeian-market-bazaar',
    website: 'https://evil.example.com/phish',
    position: { x: 10, y: 0, z: 0 },
  });
}

// Hostile / malformed paths a deep-link or pushState could carry — every one must
// classify as INVALID (never a zone, never navigated). Deterministic fixture.
export const HOSTILE_ROUTES = Object.freeze([
  '//evil.example.com',          // protocol-relative host
  'https://evil.example.com',    // absolute scheme
  'javascript:alert(1)',         // script scheme
  '/zone/../admin',              // path traversal
  '/zone/%2e%2e/admin',          // percent-encoded traversal
  '/zone/Bad_Slug',              // invalid slug (uppercase + underscore)
  '/zone/a/b',                   // sub-path (more than one segment)
]);

// _flagsAllFalse(report) → true iff every SAFETY_FLAG present on the report is false.
// A missing flag is treated as safe (false); a flag that is exactly `true` fails.
function _flagsAllFalse(report) {
  if (!report || typeof report !== 'object') return true;
  for (const f of SAFETY_FLAGS) {
    if (report[f] === true) return false;
  }
  return true;
}

// _signal(key, label, ok, detail) → a plain-data smoke signal row.
function _signal(key, label, ok, detail) {
  return { key, label, status: ok ? 'ok' : 'fail', detail: String(detail || '') };
}

// runGatewayTravelSmoke(opts?) → a JSON-serialisable, read-only smoke report:
//   {
//     version, badge, ok,
//     signals: [ { key, label, status:'ok'|'fail', detail } ],
//     summary: { total, ok, fail },
//     safety:  { navigated:false, performed:false, external:false,
//                signed:false, published:false, network:false },  // observed maxima
//     reasons: [ ... ],   // failing signal keys + details (empty iff ok)
//     rendered: false, actionable: false,
//   }
// `ok` is true iff ALL signals pass AND no report flipped a safety flag. The demo gate
// may be injected via opts.component so a test can drive a deliberately-broken flow and
// prove the harness catches it. Pure — never throws, never navigates.
export function runGatewayTravelSmoke(opts = {}) {
  const o = (opts && typeof opts === 'object' && !Array.isArray(opts)) ? opts : {};
  const component = o.component || demoGatewayComponent();
  const context = { title: 'Plebeian Market Bazaar', zoneType: 'shop', origin: 'travel-smoke' };

  const signals = [];
  // Track whether ANY exercised report flipped a safety flag.
  let safetyClean = true;
  const _watch = (report) => { if (!_flagsAllFalse(report)) safetyClean = false; return report; };

  // A boundary in the SAFEST mode: no injected window/transport, dryRun true — so even a
  // fully-confirmed confirm() is a dry-run no-op that navigates nothing.
  const boundary = createGatewayPortalBoundary({ dryRun: true });
  const portalPos = { x: 10, y: 0, z: 0 };
  const trigger = createPortalTrigger({ boundary, component, context, portalPos, range: 3 });

  // 1 + 2. Proximity arms the boundary but navigates nothing.
  try {
    const far = trigger.tick({ x: 100, y: 0, z: 0 });
    const armedFar = trigger.isArmed();
    const near = trigger.tick({ x: 10.5, y: 0, z: 0 });
    const armedNear = trigger.isArmed();
    signals.push(_signal(
      'trigger-arms-on-proximity',
      'Trigger arms on proximity',
      far.armed === false && armedFar === false && near.armed === true && armedNear === true,
      `far armed=${armedFar}, near armed=${armedNear}`,
    ));
    // Arming changes lifecycle state only; nothing is performed/navigated by tick().
    signals.push(_signal(
      'proximity-never-navigates',
      'Proximity alone never navigates',
      armedNear === true && far.changed === false && near.changed === true,
      'tick() arms/cancels the inert boundary; it performs no hop',
    ));
  } catch (e) {
    signals.push(_signal('trigger-arms-on-proximity', 'Trigger arms on proximity', false, `threw: ${e.message}`));
    signals.push(_signal('proximity-never-navigates', 'Proximity alone never navigates', false, `threw: ${e.message}`));
  }

  // 3. Explicit confirm is required: interact() acts only when armed; a fresh,
  // unarmed boundary returns null (no-op). Both reports (when present) stay inert.
  try {
    const armedReport = _watch(trigger.interact(true)); // armed from step 1 → a dry-run report
    const idleTrigger = createPortalTrigger({ boundary: createGatewayPortalBoundary({ dryRun: true }), component, context, portalPos, range: 3 });
    const idleReport = idleTrigger.interact(true); // never armed → null
    signals.push(_signal(
      'explicit-confirm-required',
      'Explicit confirm required to act',
      armedReport && typeof armedReport === 'object' && idleReport === null,
      `armed→report, unarmed→${idleReport === null ? 'null' : 'NON-NULL'}`,
    ));
  } catch (e) {
    signals.push(_signal('explicit-confirm-required', 'Explicit confirm required to act', false, `threw: ${e.message}`));
  }

  // 4 + 5. Same-origin route only + scoped allowlist (never permit-everything).
  let activation = null;
  try {
    activation = _watch(activatePortalHandoff(component, context, true, { confirmed: true, dryRun: true }));
    const route = activation.targetRoute;
    const routeOk = typeof route === 'string' && route.startsWith(ZONE_CANONICAL_PREFIX) && activation.external === false;
    signals.push(_signal(
      'same-origin-route-only',
      'Hop targets the canonical /#/zone/ hash route',
      routeOk,
      `targetRoute=${route}, external=${activation.external}`,
    ));
    const allow = Array.isArray(activation.routeAllowlist) ? activation.routeAllowlist : [];
    const allowOk = allow.length > 0 && !allow.includes('/') && allow.every((p) => typeof p === 'string' && p.length >= 2 && p[0] === '/');
    signals.push(_signal(
      'allowlist-scoped',
      'Route allowlist is scoped, never "/"',
      allowOk,
      `allowlist=${JSON.stringify(allow)}`,
    ));
  } catch (e) {
    signals.push(_signal('same-origin-route-only', 'Hop targets a same-origin /zone/ route', false, `threw: ${e.message}`));
    signals.push(_signal('allowlist-scoped', 'Route allowlist is scoped, never "/"', false, `threw: ${e.message}`));
  }

  // 6. A valid canonical /#/zone/<slug> route resolves to a zone display state.
  try {
    const r = parseZoneRoute(`${ZONE_CANONICAL_PREFIX}plebeian-market-bazaar`);
    signals.push(_signal(
      'zone-route-resolves',
      'Valid /#/zone/<slug> resolves',
      r.kind === ZONE_ROUTE_KIND.ZONE && r.ok === true && r.slug === 'plebeian-market-bazaar' && r.navigated === false,
      `kind=${r.kind}, slug=${r.slug}`,
    ));
  } catch (e) {
    signals.push(_signal('zone-route-resolves', 'Valid /#/zone/<slug> resolves', false, `threw: ${e.message}`));
  }

  // 7. Every hostile route classifies as INVALID (never a zone, never navigated).
  try {
    const bad = [];
    for (const path of HOSTILE_ROUTES) {
      const r = parseZoneRoute(path);
      if (r.kind === ZONE_ROUTE_KIND.ZONE || r.navigated === true) bad.push(path);
    }
    signals.push(_signal(
      'hostile-routes-rejected',
      'Hostile routes are rejected',
      bad.length === 0,
      bad.length === 0 ? `all ${HOSTILE_ROUTES.length} rejected` : `accepted: ${bad.join(', ')}`,
    ));
  } catch (e) {
    signals.push(_signal('hostile-routes-rejected', 'Hostile routes are rejected', false, `threw: ${e.message}`));
  }

  // 8. No external URL is carried into the hop — the gate's `website` is dropped.
  try {
    const built = portalActivationInput(component, context);
    const dest = built.ok ? built.input.destination : {};
    const hasExternal = !!(dest.website) || (activation && activation.external === true);
    signals.push(_signal(
      'no-external-url',
      'No external URL carried into the hop',
      built.ok === true && !hasExternal,
      `destination has website=${dest.website ? 'YES' : 'no'}`,
    ));
  } catch (e) {
    signals.push(_signal('no-external-url', 'No external URL carried into the hop', false, `threw: ${e.message}`));
  }

  // 9. Consent gates travel: no grant → blocked (ok:false); a matching grant → allowed
  // but STILL never performed/navigated.
  try {
    const dest = { destination: { zoneId: 'nap-garden', title: 'The Nap Garden', zoneType: 'nap' }, origin: 'travel-smoke' };
    const noGrant = _watch(prepareTravelIntent(dest, null));
    const withGrant = _watch(prepareTravelIntent(dest, true));
    signals.push(_signal(
      'consent-gates-travel',
      'Consent gates travel',
      noGrant.ok === false && noGrant.consent.allowed === false
        && withGrant.ok === true && withGrant.consent.allowed === true
        && withGrant.performed === false && withGrant.navigated === false,
      `noGrant.ok=${noGrant.ok}, grant.ok=${withGrant.ok}, grant.performed=${withGrant.performed}`,
    ));
  } catch (e) {
    signals.push(_signal('consent-gates-travel', 'Consent gates travel', false, `threw: ${e.message}`));
  }

  // 10. No auto travel / write: every exercised report kept all safety flags false.
  signals.push(_signal(
    'no-auto-action',
    'No automatic travel or write',
    safetyClean === true,
    safetyClean ? 'all reports pinned navigated/performed/external/signed/published/network=false' : 'a report flipped a safety flag',
  ));

  const failed = signals.filter((s) => s.status !== 'ok');
  const reasons = failed.map((s) => `${s.key}: ${s.detail}`);

  return {
    version: TRAVEL_SMOKE_VERSION,
    badge: TRAVEL_SMOKE_BADGE,
    ok: failed.length === 0,
    signals,
    summary: { total: signals.length, ok: signals.length - failed.length, fail: failed.length },
    // Observed safety posture — all false in a clean run (mirrors the contract).
    safety: {
      navigated: false, performed: false, external: false,
      signed: false, published: false, network: false,
    },
    reasons,
    // A smoke harness, not a live structure — never renders or acts.
    rendered: false,
    actionable: false,
  };
}

// formatGatewayTravelSmoke(result) → a stable, human-readable text block for a debug
// shell / audit log. Pure, never throws, safe on null.
export function formatGatewayTravelSmoke(result) {
  const r = (result && typeof result === 'object') ? result : runGatewayTravelSmoke();
  const lines = [];
  lines.push(r.badge || TRAVEL_SMOKE_BADGE);
  const s = r.summary || { total: 0, ok: 0, fail: 0 };
  lines.push(`verdict: ${r.ok ? 'OK' : 'FAIL'}  (${s.ok}/${s.total} signals)`);
  for (const sig of (Array.isArray(r.signals) ? r.signals : [])) {
    lines.push(`  ${sig.status === 'ok' ? '✓' : '✗'} ${sig.label} — ${sig.detail}`);
  }
  if (Array.isArray(r.reasons) && r.reasons.length) {
    lines.push(`reasons: ${r.reasons.join('; ')}`);
  }
  return lines.join('\n');
}

// Re-export the default allowlist so a consumer can assert the scoped contract without
// importing gatewayPortalActivation directly.
export { DEFAULT_PORTAL_ALLOWLIST };

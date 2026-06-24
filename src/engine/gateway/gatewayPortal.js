// engine/gateway/gatewayPortal.js — gateway portal VIEW shell (CMP-8
// continuation, v0.2.136). Turns a gateway component + the traveller's context
// into a render-ready PORTAL view-model: the destination label, the interaction
// prompt, an armed/ready flag, the validated travel plan, and a URL PREVIEW —
// everything an in-world portal mesh or a debug HUD would draw.
//
// Pure + node-safe: NO Three/Rapier/DOM, NO window/location navigation, NO relay
// I/O, NO signing. This is the visible-but-safe layer over gatewayHandoff: it
// describes what to show, it NEVER acts. urlPreview is a STRING for display only;
// crossing the gate / changing location stays the host's deferred decision.

import { gatewayDestination, planGatewayTravel, gatewayTravelUrl } from './gatewayHandoff.js';

// The default interaction prompt shown when a portal has a valid destination.
export const PORTAL_PROMPT = 'Press E to travel';

// shortKey(key, head, tail) → a truncated display form of a long key/id
// ('npub1abcd…wxyz'). Returns the key unchanged when it is already short enough.
// Pure; deterministic; safe on null/non-strings (returns '').
export function shortKey(key, head = 10, tail = 4) {
  if (typeof key !== 'string' || key === '') return '';
  if (key.length <= head + tail + 1) return key;
  return `${key.slice(0, head)}…${key.slice(-tail)}`;
}

// destinationLabel(dest) → a human label for a gateway destination block. Prefers
// an explicit `target` (a named world/zone), else a truncated `npub`, else
// 'Unknown destination'. Pure.
export function destinationLabel(dest) {
  if (!dest || typeof dest !== 'object') return 'Unknown destination';
  if (dest.target) return String(dest.target);
  if (dest.npub) return shortKey(dest.npub);
  return 'Unknown destination';
}

// gatewayPortalView(component, context, { base, prompt }) → a render-ready
// view-model for the portal. Pure — never throws, never navigates.
//
//   {
//     status:        'ready' | 'invalid' | 'not-a-gateway',
//     isGateway:     boolean,
//     armed:         boolean,            // true only when the plan validates
//     destination:   dest block | null,
//     destinationLabel: string,
//     relay:         string | null,
//     prompt:        string,             // '' unless armed
//     plan:          { valid, errors, intent },
//     urlPreview:    string,             // '' unless armed (display only)
//     errors:        string[],
//   }
//
// `context` is the traveller side passed straight to planGatewayTravel
// ({ from, player, spawn, return, zoneType, state }). `base` is an optional URL
// base for the preview string; `prompt` overrides PORTAL_PROMPT.
export function gatewayPortalView(component, context = {}, { base = '', prompt = PORTAL_PROMPT } = {}) {
  const dest = gatewayDestination(component);
  if (!dest) {
    return {
      status: 'not-a-gateway',
      isGateway: false,
      armed: false,
      destination: null,
      destinationLabel: 'Unknown destination',
      relay: null,
      prompt: '',
      plan: { valid: false, errors: ['component is not a gateway (no manifest.gateway)'], intent: {} },
      urlPreview: '',
      errors: ['component is not a gateway (no manifest.gateway)'],
    };
  }

  const plan = planGatewayTravel(component, context);
  const armed = plan.valid;
  const { url } = gatewayTravelUrl(component, context, { base });

  return {
    status: armed ? 'ready' : 'invalid',
    isGateway: true,
    armed,
    destination: dest,
    destinationLabel: destinationLabel(dest),
    relay: dest.relay || null,
    prompt: armed ? prompt : '',
    plan,
    urlPreview: armed ? url : '',
    errors: plan.errors,
  };
}

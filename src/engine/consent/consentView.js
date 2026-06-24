// engine/consent/consentView.js — CONSENT UX VIEW-MODEL foundation (CONSENT-2, v0.2.166).
// Turns the v0.2.162 consent-gate requests/decisions into clear, user-facing PROMPT
// copy + preview rows: a title, badge, severity, body lines, an action/cancel label,
// and the safety flags a future confirm dialog (gateway travel, leaderboard submit,
// profile update, update apply, Nostr publish) would draw. It is the display layer
// BEFORE any real confirm-button wiring exists.
//
// Pure + node-safe: NO Three/Rapier/DOM, NO Nostr client, NO WebSocket, NO relay I/O,
// NO signing, NO publishing, NO NIP-07, NO key handling, NO payments, NO network, NO
// auto-update, NO navigation. This module NEVER performs an action and exposes NO
// confirm/sign/publish/send/connect/travel/apply method — it only re-shapes the
// gate's pure decision into display strings. Every view carries `performed:false`,
// `actionable:false`, `readOnly:true`; a rendered "Travel" / "Publish" label is COPY,
// not a wired button. All free-form text is control/markup-stripped so a hostile
// detail/origin string can never inject markup into the prompt. Every helper degrades
// safely on malformed input and never throws.

import {
  CONSENT_ACTIONS,
  CONSENT_REASON,
  buildConsentRequest,
  evaluateConsent,
  summariseConsent,
} from './consentGate.js';

// CONSENT_VIEW_VERSION — bumped when the view-model shape changes.
export const CONSENT_VIEW_VERSION = 1;

// Badge stamped on every prompt view so a viewer can never mistake the preview for a
// live, wired confirm dialog. The view SHOWS what would happen; it never does it.
export const CONSENT_PROMPT_BADGE = 'CONSENT · PREVIEW · NO ACTION';

// Severity tiers — how a prompt should be presented. `info` = inert read; `caution` =
// a low-danger write; `danger` = a high-danger write/sign/publish/update/travel.
export const CONSENT_SEVERITY = Object.freeze({
  INFO: 'info',
  CAUTION: 'caution',
  DANGER: 'danger',
});

// Human-readable copy for each decision reason — what to tell the user about WHY a
// prompt is allowed or blocked. Stable strings (display only).
export const REASON_TEXT = Object.freeze({
  [CONSENT_REASON.READ_ONLY]: 'Read-only — no consent needed.',
  [CONSENT_REASON.CONSENT_GRANTED]: 'Consent granted for this action.',
  [CONSENT_REASON.CONSENT_REQUIRED]: 'Your explicit consent is required to proceed.',
  [CONSENT_REASON.CONSENT_MISMATCH]: 'That consent was granted for a different action.',
  [CONSENT_REASON.UNKNOWN_ACTION]: 'Unknown action — nothing to confirm.',
  [CONSENT_REASON.MALFORMED]: 'Malformed request — nothing to confirm.',
});

// Per-action UX copy: the confirm/cancel button labels + the prompt headline a future
// dialog would show. These are display strings ONLY — no handler, no side effect. Keys
// mirror the consentGate known-action registry; read-only + unknown fall back below.
export const ACTION_COPY = Object.freeze({
  'gateway:travel': Object.freeze({
    headline: 'Travel through the gateway?',
    actionLabel: 'Travel',
    cancelLabel: 'Stay here',
  }),
  'leaderboard:submit': Object.freeze({
    headline: 'Submit your score to the leaderboard?',
    actionLabel: 'Submit score',
    cancelLabel: 'Not now',
  }),
  'profile:update': Object.freeze({
    headline: 'Update your public profile?',
    actionLabel: 'Update profile',
    cancelLabel: 'Cancel',
  }),
  'update:apply': Object.freeze({
    headline: 'Apply the available update?',
    actionLabel: 'Apply update',
    cancelLabel: 'Later',
  }),
  'nostr:publish': Object.freeze({
    headline: 'Publish this event to Nostr relays?',
    actionLabel: 'Publish',
    cancelLabel: 'Cancel',
  }),
});

// Fallback copy for read-only actions (no consent needed) and unknown/malformed input.
const READ_COPY = Object.freeze({ headline: 'Read-only action', actionLabel: 'Continue', cancelLabel: 'Close' });
const UNKNOWN_COPY = Object.freeze({ headline: 'Unknown action', actionLabel: '', cancelLabel: 'Close' });

// Control chars (C0 + DEL) and HTML angle brackets — stripped from any free-form text
// (origin / string detail) so a hostile value can never inject markup into the prompt.
// Escapes (not raw bytes) keep the source safe to edit.
const UNSAFE_TEXT = /[\x00-\x1f\x7f<>]/g;
const MAX_TEXT_LEN = 200;

// _safeText(raw) → a trimmed, control/markup-stripped, length-capped string or ''.
// Pure, never throws.
function _safeText(raw) {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.replace(UNSAFE_TEXT, '').trim();
  return cleaned.length > MAX_TEXT_LEN ? cleaned.slice(0, MAX_TEXT_LEN) : cleaned;
}

// copyForAction(id, requiresConsent) → the UX copy bag for an action id. Pure.
//   - a known write action → its ACTION_COPY entry
//   - a known read action  → READ_COPY
//   - anything else        → UNKNOWN_COPY
export function copyForAction(id, requiresConsent) {
  if (ACTION_COPY[id]) return ACTION_COPY[id];
  return requiresConsent ? UNKNOWN_COPY : READ_COPY;
}

// severityFor(decision) → a CONSENT_SEVERITY tier from a gate decision. Pure.
// Read-only → info; low-danger write → caution; high-danger write → danger.
export function severityFor(decision) {
  if (!decision || !decision.requiresConsent) return CONSENT_SEVERITY.INFO;
  return decision.danger === 'high' ? CONSENT_SEVERITY.DANGER : CONSENT_SEVERITY.CAUTION;
}

// consentPromptView(input, grant) → an INERT, render-ready consent PROMPT view-model.
// Pure, never throws, NEVER performs/sign/publishes/navigates.
//
//   {
//     title:                  'CONSENT',
//     badge:                  'CONSENT · PREVIEW · NO ACTION',
//     action:                 id | null,
//     kind:                   'read'|'write'|'sign'|'publish'|'update'|'travel'|null,
//     severity:               'info'|'caution'|'danger',
//     headline:               string,             // the prompt question/title copy
//     bodyLines:              [{ label, value }], // ready-to-draw rows for a dialog
//     actionLabel:            string,             // confirm-button COPY (no handler)
//     cancelLabel:            string,
//     requiresExplicitConsent:boolean,
//     allowed:                boolean,            // host MAY proceed (behind its transport)
//     blocked:                boolean,
//     reason:                 CONSENT_REASON.*,
//     reasonText:             string,             // human copy for the reason
//     write:                  boolean,            // safety flags ↓ (display only)
//     signed:                 boolean,
//     danger:                 'low'|'high',
//     statusLine:             string,             // one-line summary (summariseConsent)
//     performed:              false,              // ALWAYS — never performs
//     actionable:             false,              // ALWAYS — copy, not a wired button
//     readOnly:               true,
//     errors:                 [string],
//   }
//
// `input` is an action id string OR `{ action, detail?, origin? }`. `grant` is the
// consent grant the gate evaluates (boolean `true` for this single action, or a scoped
// `{ granted:true, action?, token? }`). Passing a grant only PREVIEWS the allowed copy —
// it never authorises a real action here (a mock-grant preview is explicitly inert).
export function consentPromptView(input, grant = null) {
  const built = buildConsentRequest(input);
  const decision = evaluateConsent(built.ok ? built.request : input, grant);
  const origin = built.ok ? _safeText(built.request.origin) : '';

  // Malformed / unknown action → a safe, blocked, non-actionable view.
  if (!decision.action) {
    return {
      title: 'CONSENT',
      badge: CONSENT_PROMPT_BADGE,
      action: null,
      kind: null,
      severity: CONSENT_SEVERITY.INFO,
      headline: UNKNOWN_COPY.headline,
      bodyLines: [{ label: 'Status', value: 'BLOCKED' }],
      actionLabel: UNKNOWN_COPY.actionLabel,
      cancelLabel: UNKNOWN_COPY.cancelLabel,
      requiresExplicitConsent: false,
      allowed: false,
      blocked: true,
      reason: decision.reason,
      reasonText: REASON_TEXT[decision.reason] || REASON_TEXT[CONSENT_REASON.MALFORMED],
      write: false,
      signed: false,
      danger: 'high',
      statusLine: 'Unknown action — blocked.',
      performed: false,
      actionable: false,
      readOnly: true,
      errors: decision.errors && decision.errors.length ? decision.errors : ['unusable consent request'],
    };
  }

  const copy = copyForAction(decision.action, decision.requiresConsent);
  const severity = severityFor(decision);
  const statusValue = decision.allowed
    ? (decision.requiresConsent ? 'ALLOWED · CONSENT GRANTED' : 'ALLOWED · READ-ONLY')
    : 'BLOCKED';

  const bodyLines = [
    { label: 'Action', value: CONSENT_ACTIONS[decision.action].label },
    { label: 'Effect', value: decision.summary },
    { label: 'Signature', value: decision.signed ? 'Required (you sign)' : 'None' },
    { label: 'Network', value: decision.write ? 'Writes to relays' : 'No write' },
    { label: 'Consent', value: decision.requiresConsent ? 'Explicit consent required' : 'Not required' },
    { label: 'Status', value: statusValue },
  ];
  if (origin) bodyLines.push({ label: 'Requested by', value: origin });

  return {
    title: 'CONSENT',
    badge: CONSENT_PROMPT_BADGE,
    action: decision.action,
    kind: decision.kind ?? CONSENT_ACTIONS[decision.action].kind,
    severity,
    headline: copy.headline,
    bodyLines,
    actionLabel: copy.actionLabel,
    cancelLabel: copy.cancelLabel,
    requiresExplicitConsent: decision.requiresConsent,
    allowed: decision.allowed,
    blocked: decision.blocked,
    reason: decision.reason,
    reasonText: REASON_TEXT[decision.reason] || '',
    write: decision.write,
    signed: decision.signed,
    danger: decision.danger,
    statusLine: summariseConsent(decision.action),
    performed: false,
    actionable: false,
    readOnly: true,
    errors: [],
  };
}

// consentPromptRows(grants) → a compact preview ROW per known action — the UX copy
// counterpart to consentGateReport. Each row is the headline + action label + severity
// + allowed/blocked decision a prompt would show, under an optional `grants` map
// ({ actionId: true|{granted,...} }) so a caller can PREVIEW what WOULD be allowed.
// Pure + inert; every row is display-only (`actionable:false`, no performed action).
export function consentPromptRows(grants = {}) {
  const map = (grants && typeof grants === 'object' && !Array.isArray(grants)) ? grants : {};
  return Object.keys(CONSENT_ACTIONS).map((id) => {
    const v = consentPromptView(id, map[id] ?? null);
    return {
      action: id,
      headline: v.headline,
      actionLabel: v.actionLabel,
      cancelLabel: v.cancelLabel,
      severity: v.severity,
      requiresExplicitConsent: v.requiresExplicitConsent,
      allowed: v.allowed,
      blocked: v.blocked,
      reason: v.reason,
      reasonText: v.reasonText,
      actionable: false,
    };
  });
}

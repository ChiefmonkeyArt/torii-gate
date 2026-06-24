// engine/nostr/leaderboardPreview.js — visible-but-inert local/mock leaderboard
// PREVIEW block (LEAN-4, v0.2.141). Flattens the leaderboardView DISPLAY shell
// into a render-ready block of label/value rows that a title-screen or HUD card
// can draw directly — local/mock rank rows, the Nostr score-event proof shape
// (kind/topic), and the npub identity that WOULD sign — all framed with an
// explicit "PREVIEW · LOCAL MOCK · NO PUBLISH" badge.
//
// Pure + node-safe: NO Three/Rapier/DOM, NO Nostr client, NO relay I/O, NO
// NIP-07 signing, NO key handling, NO publish, NO fetch/WebSocket. This is the
// presentation layer over leaderboardView.rankScores: it only re-shapes that
// shell's pure, ranked return value into display strings. Every block carries
// `signed: false` / `published: false` / `actionable: false`; signing a score
// and shipping it to a relay stays a separate, audited host step (SEC-1).
//
// NOTE on naming: leaderboardView.js also exports an async `leaderboardPreview`
// (the build-only UNSIGNED-template preview). That is a different surface — it
// inspects the event templates a publisher WOULD build. This module is the
// VISIBLE card block (mirrors gatewayPreview/productPreview), named
// `leaderboardPreviewBlock` to avoid any clash.

import { LEADERBOARD_KIND } from './leaderboard.js';
import { leaderboardView, VIEW_MODES } from './leaderboardView.js';

// Badge shown on every preview block so a viewer can never mistake it for a
// live, published leaderboard. The preview SHOWS local scores; it never ships one.
export const LEADERBOARD_PREVIEW_BADGE = 'PREVIEW · LOCAL MOCK · NO PUBLISH';

// The discovery topic tag the real (later, audited) publisher would stamp on a
// score event — surfaced here as DISPLAY-ONLY proof-of-shape, never published.
export const LEADERBOARD_TOPIC = 'torii-quest';

// Human label for each display mode. Pure; unknown modes upper-case the raw value.
export const MODE_TEXT = Object.freeze({
  mock: 'LOCAL MOCK',
  build: 'BUILD ONLY',
});

// modeLabel(mode) → display label for a view mode. Pure.
export function modeLabel(mode) {
  return MODE_TEXT[mode] || String(mode || 'UNKNOWN').toUpperCase();
}

// shortNpub(npub, head, tail) → a display-only truncation of a long npub so the
// Nostr identity flavour stays readable on a small card. Pure; collapses to ''
// on null/non-strings; returns the key unchanged when already short. (Local copy
// rather than importing a components/ helper, to keep nostr/ free of that dep.)
export function shortNpub(npub, head = 12, tail = 6) {
  if (typeof npub !== 'string' || npub === '') return '';
  if (npub.length <= head + tail + 1) return npub;
  return `${npub.slice(0, head)}…${npub.slice(-tail)}`;
}

// formatRankRow(row) → a single render-ready { label, value } for a ranked entry.
// `row` is a rankScores() row: { rank, runId, score, kills, headshots,
// accuracyLabel }. Display only. Pure.
export function formatRankRow(row) {
  return {
    label: `#${row.rank}`,
    value: `${row.runId} · ${row.score} pts · ${row.kills}k/${row.headshots}hs · ${row.accuracyLabel}`,
  };
}

// leaderboardPreviewBlock(statsList, { mode, limit, signerNpub }) → a
// render-ready, INERT local/mock leaderboard preview block:
//
//   {
//     title:        'LEADERBOARD PREVIEW',
//     mode:         'mock' | 'build',
//     modeLabel:    'LOCAL MOCK' | 'BUILD ONLY',
//     badge:        'PREVIEW · LOCAL MOCK · NO PUBLISH',
//     signed:       false,             // ALWAYS false — never signs
//     published:    false,             // ALWAYS false — never publishes
//     signer:       string,            // shortened npub identity flavour, '—' if none
//     signerFull:   string | null,     // full npub (display only)
//     count:        number,            // total ranked (valid) scores
//     shown:        number,            // ranked rows actually drawn (<= limit)
//     skipped:      number,            // invalid scores dropped by validation
//     proof:        { kind, topic },   // Nostr score-event shape, display only
//     rows:         [{ rank, runId, score, kills, headshots, accuracyLabel }],
//     lines:        [{ label, value }],// ready-to-draw rows for a DOM/HUD card
//     readOnly:     true,
//     actionable:   false,             // ALWAYS false — never a live submission
//   }
//
// `mode` must be one of VIEW_MODES (defaults to 'mock'); invalid scores are
// dropped (counted in `skipped`), never thrown. Pure — never signs, publishes,
// fetches, or navigates.
export function leaderboardPreviewBlock(statsList = [], { mode = 'mock', limit = 5, signerNpub = null } = {}) {
  const useMode = VIEW_MODES.includes(mode) ? mode : 'mock';
  const view = leaderboardView(statsList, { mode: useMode });
  const cap = Number.isInteger(limit) && limit > 0 ? limit : view.rows.length;
  const shownRows = view.rows.slice(0, cap);
  const signerFull = typeof signerNpub === 'string' && signerNpub !== '' ? signerNpub : null;

  // Framing rows first (mode / identity / no-publish status / event shape), then
  // the ranked rows. No row is interactive.
  const lines = [
    { label: 'Mode', value: modeLabel(useMode) },
    { label: 'Signer', value: signerFull ? shortNpub(signerFull) : '—' },
    { label: 'Status', value: 'UNSIGNED · NOT PUBLISHED' },
    { label: 'Event', value: `kind ${LEADERBOARD_KIND} · #${LEADERBOARD_TOPIC}` },
  ];
  if (shownRows.length === 0) {
    lines.push({ label: 'Scores', value: 'NO LOCAL SCORES' });
  } else {
    for (const row of shownRows) lines.push(formatRankRow(row));
  }

  return {
    title: 'LEADERBOARD PREVIEW',
    mode: useMode,
    modeLabel: modeLabel(useMode),
    badge: LEADERBOARD_PREVIEW_BADGE,
    signed: false, // never signs — SEC-1 consent gate is a separate host step
    published: false, // never publishes — no relay I/O here
    signer: signerFull ? shortNpub(signerFull) : '—',
    signerFull,
    count: view.count,
    shown: shownRows.length,
    skipped: view.skipped.length,
    proof: { kind: LEADERBOARD_KIND, topic: LEADERBOARD_TOPIC },
    rows: shownRows,
    lines,
    readOnly: true,
    actionable: false, // display-only; signing/publishing stays a host decision
  };
}

// src/engine/update/updateStatus.js — in-game UPDATE-STATUS panel (LEAN-5,
// v0.2.158). Takes the read-only GitHub release-check foundation (v0.2.157's
// githubReleaseSource) and the inert preview presentation (v0.2.142's
// updatePreview) and folds them into ONE render-ready, display-only update-status
// panel for the in-world UPDATE proof surface / a HUD card. It reflects both the
// update verdict (available / up-to-date / unknown) AND the source diagnostics
// (how many releases the source carried, which kind, any parse errors).
//
// Safety boundary (mirrors UPDATE_CHECK.md / the LEAN-5 rule):
//   - PURE + node-safe: no THREE/Rapier/DOM, no network, never throws.
//   - NO auto-fetch, NO auto-update, NO install, NO shell, NO navigation, NO relay,
//     NO file mutation. The panel is `readOnly:true` / `actionable:false` and
//     exposes no fetch/install/update/navigate/href/onClick key.
//   - The default content is a DETERMINISTIC LOCAL SAMPLE release feed — this slice
//     never reaches the wire. A host may pass its own (already-fetched, injected)
//     release payload, but that fetch stays an explicit, audited host step
//     (see githubReleaseSource.fetchLatestRelease — host-only, injected fetcher).

import {
  selectLatestRelease, SOURCE_STATUS, SOURCE_KIND, RELEASE_SOURCE, UPDATE_STATUS,
} from './githubReleaseSource.js';
import { updatePreviewBlock, statusLabel } from './updatePreview.js';

// Badge makes the manual/no-auto-update contract explicit on the panel itself.
export const UPDATE_STATUS_BADGE = 'STATUS · MANUAL · NO AUTO-UPDATE';

// The in-world proof surface this panel feeds (display-only string reference — it
// does NOT bind, render, or act; see proofSurfaceSpecs `update-prompt-board`).
export const UPDATE_SURFACE_ID = 'update-prompt-board';

// A deterministic LOCAL sample release FEED (a GitHub `releases` array shape) so the
// panel shows a non-trivial "update available" view WITHOUT ever fetching the wire.
// Mixes an older full release and a newer prerelease to exercise the list-selection
// path; the newest eligible entry (v0.2.999-alpha) wins. Display-only fixture.
export const SAMPLE_RELEASE_FEED = Object.freeze([
  Object.freeze({
    tag_name: 'v0.2.500-alpha',
    name: 'Torii Quest v0.2.500-alpha',
    html_url: 'https://github.com/torii-quest/torii-quest/releases/tag/v0.2.500-alpha',
    body: 'Older sample release (local fixture).',
    draft: false,
    prerelease: true,
    published_at: '2026-05-01T00:00:00Z',
  }),
  Object.freeze({
    tag_name: 'v0.2.999-alpha',
    name: 'Torii Quest v0.2.999-alpha',
    html_url: 'https://github.com/torii-quest/torii-quest/releases/tag/v0.2.999-alpha',
    body: 'Newest sample release (local fixture) — bigger arena, nostrich skins, Chiefmonkey balance.',
    draft: false,
    prerelease: true,
    published_at: '2026-06-24T00:00:00Z',
  }),
]);

// A compact, human/HUD-friendly summary of the source selection for the Source row.
function sourceSummary(sel) {
  switch (sel.status) {
    case SOURCE_STATUS.OK:
      return sel.kind === SOURCE_KIND.LIST
        ? `${sel.candidates} release(s) — latest selected`
        : 'single release';
    case SOURCE_STATUS.EMPTY:
      return 'no usable release';
    default:
      return 'no release data';
  }
}

// updateStatusPanel(payload, opts) → an INERT, render-ready in-game update-status
// panel. `payload` is any githubReleaseSource input — a single `releases/latest`
// object, a `releases` array, or a manifest (defaults to the local sample feed).
//   opts: { currentVersion=VERSION, notesMax=120, includePrerelease=true,
//           includeDraft=false }
// Returns:
//   { title, badge, surface, step, status, statusLabel, currentVersion,
//     latestVersion, updateAvailable, prompt, notesPreview,
//     source:{status,kind,candidates,errors}, sourceUrl, lines:[{label,value}],
//     readOnly:true, actionable:false }
// Never throws; draft/empty/malformed payloads degrade to an UNKNOWN panel.
export function updateStatusPanel(payload = SAMPLE_RELEASE_FEED, opts = {}) {
  const {
    currentVersion, notesMax = 120, includePrerelease, includeDraft,
  } = opts;

  const sel = selectLatestRelease(payload, { includePrerelease, includeDraft });
  // Reuse the inert preview block for the verdict + presentation. When the source
  // yielded no usable release, feed an empty object so the block degrades to
  // UNKNOWN (no throw, no fabricated version).
  const block = updatePreviewBlock(sel.release || {}, { currentVersion, notesMax });

  const source = {
    status: sel.status,
    kind: sel.kind,
    candidates: sel.candidates,
    errors: sel.errors.slice(),
  };

  const lines = [
    { label: 'Version', value: block.currentVersion },
    { label: 'Latest', value: block.latestVersion || '—' },
    { label: 'Status', value: block.statusLabel },
    { label: 'Source', value: sourceSummary(sel) },
    { label: 'Releases', value: RELEASE_SOURCE.releasesPageUrl },
  ];

  return {
    title: 'UPDATE STATUS',
    badge: UPDATE_STATUS_BADGE,
    surface: UPDATE_SURFACE_ID,
    step: 'UPDATE',
    status: block.status,
    statusLabel: block.statusLabel,
    currentVersion: block.currentVersion,
    latestVersion: block.latestVersion,
    updateAvailable: block.updateAvailable,
    prompt: block.prompt,
    notesPreview: block.notesPreview,
    source,
    sourceUrl: RELEASE_SOURCE.releasesPageUrl, // display-only TEXT, never a link
    lines,
    readOnly: true,
    actionable: false, // display-only; deploying a release stays a manual step
  };
}

// Re-export for callers that want the status label / enums alongside the panel.
export { statusLabel, UPDATE_STATUS };

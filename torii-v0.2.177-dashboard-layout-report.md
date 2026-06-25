# Torii Quest — v0.2.177-alpha report (DASHBOARD-LAYOUT-1: layout / readability pass)

**Commit:** `5e308cf` (feat, branch `v0.2.177`) + this report follow-up. Local only — not pushed.

**Slice:** DASHBOARD-LAYOUT-1 — a focused layout / hierarchy / responsive readability pass on the
Torii Continuum oversight dashboard (`/continuum.html`). Build-time, static, read-only. No security
model change, no new runtime script, no external asset, no dependency added.

---

## Layout changes

- **Heading rows + count chips.** New pure helper `_h2(title, count)` renders a `.h2row`
  (`<h2>` + an item-count `.count` chip) so every section header is scannable and shows how many
  items it holds (e.g. *15-hour proof-of-concept route* `5`, *Next 12 tasks* `12`, *Risk* `6`,
  *At a glance* `N` metrics, *Milestones* `total`, *Engineering health* `N` cards).
- **One-line lead captions.** Every section gains a `<div class="lead">` one-liner stating what an
  operator should take away (≥8 leads on the page), reducing the "wall of cards" feel.
- **Wider, calmer canvas.** `main`/`footer` widened to `1080px`; inter-section margin raised to
  `34px`; subtle `border-color` hover added to `.metric`/`.ms`/`.track`/`.tot` cards.
- **Honest provenance preserved.** DERIVED / GENERATED / LAST-KNOWN / SEED chips are untouched and
  remain visible/readable.

## Section / order changes

The most decision-relevant content now reads first. New top-to-bottom order:

1. **Active focus** (the ACTIVE-milestone headline banner)
2. **Milestones** — *promoted above At-a-glance* (was below it in v0.2.176)
3. **At a glance** (metrics)
4. **Engineering health**
5. **Track overview**
6. **15-hour proof-of-concept route**
7. **Now · Next · Later** (consolidated)
8. **Next 12 tasks**
9. **Risk / blocked / no-blocker**

No test asserted the old ordering (all `toContain`/`indexOf`), so the promotion is safe; new tests
now LOCK the order.

## Responsive improvements

- The previously separate Active-now / Archive / Completed-24h blocks are consolidated into one
  **Now · Next · Later** section with a single `<div class="cols">` that reflows on a responsive
  auto-fit grid: `grid-template-columns:repeat(auto-fit,minmax(260px,1fr))`. Columns wrap smoothly
  from 3→2→1 by viewport width — the old hard `@media(max-width) → 1 column` break was removed.
- Each column header (`NOW · Active`, `LATER · Archive`, `DONE · Last 24h`) shows a live
  `<span class="count">N</span>` from the model list length.

## Tests / timings

- **Added 6 tests** to the existing `tests/continuum-dashboard.test.js` (file count stays 60) in a
  new `describe('layout / readability pass (v0.2.177)')` block: Milestones promoted above
  At-a-glance; full headline order ascending; ≥8 `.lead` + a `.h2row` present; the responsive
  `.cols` grid + per-column count chips; count chips reflect model list lengths; SAFETY — exactly
  one inline `<script>`, body === `CONTINUUM_REFRESH_SCRIPT`, recomputed sha256 ===
  `CONTINUUM_SCRIPT_SHA256`, no `<link>`, no external `href`.
- `npm run test:fast` — 5 files / 74 tests green (~4.5s).
- `npm run test:foundation` — 17 files / 243 tests green (~12s).
- `npm run test:release` — **60 files / 836 passed**, `npm run check` **ALL GREEN** (doc-sync
  confirms v0.2.177-alpha across 5 docs), bundle advisory unchanged (2.9 MB raw / 1022.1 KB gzip;
  rapier chunk over-warn, tracked/not-gated).

## Files changed

- `src/engine/dashboard/continuumData.js` — `CONTINUUM_VERSION` bump; `_h2` helper; reordered
  `<main>` body (Milestones promoted); per-section lead captions + count chips; consolidated
  Now/Next/Later `.cols` responsive grid; CSS (wider main/footer, section spacing, card hover,
  removed hard 1-col override); `Source version` / `Active slice` metric values + one `activeNow`
  + one `completed24h` entry refreshed to v0.2.177 (list lengths unchanged).
- `tests/continuum-dashboard.test.js` — 4 version strings → v0.2.177-alpha; +6 layout/SAFETY tests.
- Version markers: `src/config.js`, `package.json`, `index.html`, `tools/regression-check.mjs`.
- Docs: `todo.md` (PROGRESS-1 note + DASHBOARD-LAYOUT-1 row updated), `progress.md`, `HANDOFF.md`,
  `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md`.
- Generated: `public/continuum.html`, `public/continuum-data.json` (rebuilt via
  `node tools/build-continuum.mjs`).

## Safety notes

- **CSP unchanged.** All new layout markup is server-rendered ESCAPED text. No new `<script>`, no
  new `data-k` key, no external asset/link. The single inline refresh script body
  (`CONTINUUM_REFRESH_SCRIPT`) is byte-identical, so `CONTINUUM_SCRIPT_SHA256`
  (`sha256-otKqhP2RYAA6ZkrRVcAQSBm7B1ssPR70QQR5dXePHmw=`) and the strict `CONTINUUM_CSP` still
  match — verified by the `node:crypto` recompute test.
- No external navigation / `window.open` / `location` / `eval` / `http(s)` href introduced (locked
  by SAFETY tests). Page stays fully static / read-only; renders fully without JS.
- Module stays browser-bundle-safe (crypto-free, fs-free); the doc parser remains build-time only.
- godMode `false`; no new `setTimeout`/`Vector3`/`Matrix4`; no signing / NIP-07 / relay write /
  payments / auto-update. Committed LOCALLY ONLY — no push / deploy / publish.

## Recommended next task

Land **LEAN-2 activation**: wire `createBrowserHostTransport(window)` (v0.2.170) into
`world/handoff.js` behind the SEC-2 verification gate + same-origin allowlist, so the v0.2.168
travel executor can actually move the player on a confirmed hop. The dashboard layout work is at a
good stopping point; a larger visual redesign remains a documented future follow-up under
DASHBOARD-LAYOUT-1.

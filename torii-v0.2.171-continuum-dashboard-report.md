# Torii Quest — v0.2.171-alpha Report: Torii Continuum oversight dashboard

**Slice:** v0.2.171-alpha · the FIRST slice of a broader **project-oversight
dashboard** (Torii Continuum). A thin, static, READ-ONLY webpage that turns the
curated `progress.md` model into bars/rings/totals — generated from packaged
project data at build/deploy time, so each deploy and page refresh shows the
latest packaged state. No live external writes, auth, signing, relay publishing,
or admin actions.

---

## 1. Files changed

**New (source + tooling):**
- `src/engine/dashboard/continuumData.js` — PURE, node-safe dashboard data model +
  renderer. Holds the curated `progress.md` snapshot in one frozen `CONTINUUM`
  object, the pure totals/percentage helpers, and `renderContinuumPage()` which
  returns a self-contained static HTML document string (no THREE/Rapier/DOM/fs/
  network; renders to a STRING).
- `tools/build-continuum.mjs` — node-only generator. Stamps `generatedAt` and
  writes `public/continuum.html` + `public/continuum-data.json` from the model.
- `tests/continuum-dashboard.test.js` — 22 tests over the model/helpers, computed
  totals/percentages, render-output safety, and SDK exposure.

**Generated artifacts (tracked; ship verbatim to `dist/`):**
- `public/continuum.html` (~21 KB) — the static dashboard page.
- `public/continuum-data.json` (~0.6 KB) — the packaged totals/version snapshot.

**Edited:**
- `index.html` — added a same-origin relative title-screen link
  `#continuum-link` → `./continuum.html` (`⛩ PROJECT DASHBOARD`,
  `rel="noopener noreferrer"`, no external redirect) + accent pill CSS; bumped
  `#version-label` and `#ver` to `v0.2.171-alpha`.
- `package.json` — `version` → `0.2.171-alpha`; added
  `"build:continuum": "node tools/build-continuum.mjs"`; `build` now runs
  `build:continuum && vite build` so the dashboard regenerates each deploy.
- `src/config.js` — `VERSION = 'v0.2.171-alpha'`.
- `src/sdk/index.js` — added the `continuum` namespace re-export + `SDK_SURFACE`
  entry at the `experimental` tier.
- `tools/regression-check.mjs` — header, `EXPECTED_VERSION`, and stale-version
  guard bumped to `v0.2.171-alpha` (guard now flags `v0.2.170-alpha`).
- Docs: `progress.md`, `todo.md`, `HANDOFF.md`, `CODE_INDEX.md`,
  `SDK_DEBUG_INDEX.md` — version bump + dashboard entries.

---

## 2. What the dashboard shows

- **Header:** title, version, badge (`PROJECT OVERSIGHT · STATIC · READ-ONLY`),
  live URL (plain text), `godMode false`, and the packaged `generatedAt`.
- **Active focus:** the 15-hour PoC framing.
- **At a glance:** metrics grid + a clearly-flagged **SEED** contributors/clankers
  metric (1 human · 3 clankers — labelled *not live data*).
- **Totals strip:** tasks ahead (12), active (3), done-24h (4), archive clusters
  (7), tracks (6), milestones (0 / 5).
- **3 SVG donut rings:** PoC/vision progress (46%), build progress (74%),
  milestones achieved (0%).
- **Track overview:** 6 CSS progress bars + status (Deployment is `n/a`).
- **15-hour PoC route table:** LEAN-1..5 slice + status.
- **NOW / LATER / DONE columns:** active now, archive clusters, and
  completed-last-24h items **struck through**.
- **Next 12 tasks:** numbered ordered list.
- **Risk / blocked / no-blocker table.**
- **Source-of-truth footer:** `todo.md` = task SoT, `strategy.md` = strategy SoT,
  `progress.md` = dashboard source document.

---

## 3. How to view it

1. **Built/deployed:** open the title screen and click **`⛩ PROJECT DASHBOARD`**
   (top-left version area) → opens `./continuum.html` in a new tab (same-origin).
2. **Direct URL (after deploy):** `https://torii-quest.pplx.app/continuum.html`.
3. **Locally:** `npm run build` (or `npm run build:continuum`) then
   `npm run preview` and browse to `/continuum.html`; or open
   `public/continuum.html` / `dist/continuum.html` directly in a browser.

---

## 4. Refresh behavior

- The page is **regenerated from packaged data on every build** —
  `npm run build` runs `build:continuum` first, rewriting
  `public/continuum.html` + `public/continuum-data.json` (Vite copies `public/`
  into `dist/`). So each deploy → each page refresh shows the latest **packaged**
  project state.
- The page renders **fully without JavaScript** (server-rendered values).
- A tiny **same-origin-only** progressive-enhancement script does a best-effort
  `fetch('./continuum-data.json', {cache:'no-store'})` and refreshes only the
  totals strip + `generatedAt`. No external URL, no `eval`, no timers; it fails
  silently and keeps the rendered values.

---

## 5. Safety notes

- **READ-ONLY oversight.** No live writes, auth, signing, NIP-07, relay publish,
  payments, auto-update, or admin actions anywhere in the module or page.
- **Pure / node-safe.** `continuumData.js` imports nothing from THREE/Rapier/DOM/
  fs/network and renders to a string — node-testable, SDK-safe.
- **No external navigation.** The only link is the title-screen relative
  `./continuum.html`; the page itself has **no `http(s)` href**, no
  `window.open`, no `window.location`/`location.href`. Tests assert this.
- **Injection-safe.** Every curated value is HTML-escaped via `escapeHtml`.
- **Refresh script is inert and local-only** — relative fetch target, no eval,
  no timers (also asserted by tests).
- **godMode false**, no new `setTimeout`, no new `Vector3`/`Matrix4` — all 14
  regression checks GREEN, including the proof-surface gate and docs-consistency
  guard.

---

## 6. Verification (all green)

| Command | Result |
|---|---|
| `npm test -- --run` | **779 passed / 58 files** |
| `npm run check` | **ALL GREEN (14/14)** |
| `npm run build` | OK — `dist/continuum.html` + `dist/continuum-data.json` emitted |
| `npm run bundle:report` | total JS 2.9 MB raw / ~1020 KB gzip (rapier chunk >700 KB, expected/advisory) |
| `npm run handoff:status` | VERSION + package.json in sync at `v0.2.171-alpha`; 7/7 core docs present |

---

## 7. Follow-up recommendations

1. **Automate the curated model.** Replace the hand-curated `CONTINUUM` object by
   parsing `progress.md`/`todo.md` at build time (in `build-continuum.mjs`) so the
   dashboard can't drift from the source docs. The model is isolated for exactly
   this seam.
2. **CSP for the page.** When deploying, scope a `connect-src 'self'` (the refresh
   fetch is same-origin) and `default-src 'self'` so the inline style/script and
   the JSON fetch are the only allowed surfaces.
3. **Inline the inline `<script>`/`<style>` under a nonce** if the Space CSP
   forbids `unsafe-inline` — or pre-compute the totals strip and drop the script
   entirely (the page already renders without it).
4. **Trim the completed-24h list on a real clock** once automation lands (items
   older than 24h should roll into the archive automatically).
5. **Live contributors/clankers** — when real Nostr contributor data exists,
   replace the SEED metric (it is already flagged so the swap is honest).

---

## 8. Commit

Committed **locally only** on branch `v0.2.171` (no push/deploy/publish/upload).
Parent agent verifies / security-reviews / ships.

- feat commit: see git log on branch `v0.2.171`.
- Commit hash: _(recorded in a follow-up `docs(v0.2.171)` commit to keep the tree clean)_.

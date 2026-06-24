# Torii Quest — v0.2.155-alpha: Doc-Guard Advisory Noise Cleanup

## Goal
The v0.2.154 docs/status consistency guard's stale-live-version ADVISORY was firing
on harmless changelog/prose lines that merely **quote** the pattern they describe
(e.g. a changelog entry mentioning `` `Live published version: v0.2.113-alpha` `` or
`"live/published version: vX"`). Quiet that false-positive noise while still catching
real stale live/published version assertions. No runtime/gameplay/visual change.

## Root cause
`staleLiveVersionLines` matched any line containing live/published/deployed + a
`version <marker>` assertion. Explanatory/changelog prose in these docs **quotes** the
exact phrase it documents — the marker sits inside markdown inline-code (backticks) or
double quotes — so the guard flagged its own changelog entries.

## Fix (`tools/docConsistency.mjs`)
Added a pure `stripQuotedSpans(line)` that blanks out backtick-delimited inline-code
spans and double-quoted spans, applied to each line **before** the live-version
assertion regex runs. The convention in these docs is to quote example/historical
versions and to state current/live versions plainly, so this aligns the heuristic with
how the files are actually written — robust and low-maintenance, no brittle archaeology.

- A genuine plainly-stated `Live published version: v0.2.113-alpha` status line → still flagged.
- A `deployed version = v0.1.0-alpha` assertion → still flagged.
- A changelog line quoting `` `Live published version: v0.2.113-alpha` `` → ignored.
- An explanatory line with `"live/published version: vX"` → ignored.

Advisory-only throughout: this never touches `ok`/exit code.

## Tests (`tests/doc-consistency.test.js`, +5 cases → 23 in this file)
- ignores a changelog line that QUOTES the stale marker in backticks
- ignores an explanatory line that double-quotes the pattern
- ignores prose that backtick-quotes the marker even alongside live/published words
- still flags a genuine plainly-stated stale live assertion (no quoting)
- still flags a genuine deployed-version assertion with an `=` separator

## Verification
- `npm test` → **491 passed / 43 files** (was 486; +5 cases).
- `npm run check` → **ALL GREEN**, 14/14. Check `[14]` now emits **zero** advisories
  (previously 3 false-positive stale-line warnings on todo.md/progress.md).
- `npm run bundle:report` → advisory baseline unchanged (rapier chunk tracked, not gated).
- `npm run build` → clean (known large-chunk advisory only).

## Safety
godMode=false. No new `setTimeout`. No network, navigation, payments,
signing/publishing, relay/live fetch/WebSocket, auto-update, or click/raycast changes.
Change is confined to the build-time guard tool + its tests + docs; never imported by
the game.

## Version markers bumped → v0.2.155-alpha
`src/config.js`, `package.json`, `index.html` (×2), `tools/regression-check.mjs`
(header, `EXPECTED_VERSION`, stale-guard now flags `v0.2.154-alpha`),
`tools/docConsistency.mjs` header.

## Not done (left to parent agent)
Not pushed/published. Parent agent verifies, security-reviews, deploys, publishes,
pushes, and syncs docs.

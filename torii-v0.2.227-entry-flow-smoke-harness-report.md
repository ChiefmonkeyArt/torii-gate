# v0.2.227-alpha — Entry-Flow Smoke Harness

**Type:** test + docs slice. No runtime/gameplay/physics/shooter/Nostr change. Follows the
v0.2.226 entry-flow button fix as the next safe no-blocker.
**Commit:** local only — NOT pushed, NOT tagged, NOT released. Parent/main agent handles
security review, deploy, publish, GitHub push, and Space upload.

## What & why

v0.2.226 fixed a live MVP blocker: a stale service-worker app-shell precache served old hashed
JS that 404'd, so the title screen rendered but the LOGIN / ENTER ARENA buttons had no JS
listeners. That fix added `tests/sw-app-shell.test.js` for the **service-worker** side. This
slice adds the **source-side** companion plus a manual checklist, so an inert entry button is
caught in CI and is hard to miss on every deploy — without overbuilding (no browser harness is
present in this repo, so the automated coverage stays as pure file-read contracts in the existing
test style).

## Changed / added files

### Core deliverable (new test)
- `tests/entry-flow-smoke.test.js` — 7 tests, pure file reads (no DOM / network), reading
  `index.html` + `src/main.js`. Asserts, for both title-screen entry buttons (`#btn-enter` →
  `elEnterBtn`, `#btn-nostr-centre` → `elNostrCentreBtn`): the button id exists in `index.html`;
  `main.js` resolves that id via `getElementById` into the expected handle; and `main.js` binds a
  `click` listener to that handle (optional-chaining tolerant). Plus one test that the ENTER
  handler is gated to the title screen (`if (!isTitle()) return`). A silent id rename/typo on
  either the HTML or JS side now fails CI instead of shipping a button that renders but does
  nothing.

### Docs
- `CODE_INDEX.md` — new **Entry-Flow Live Smoke** checklist under Manual Smoke Checklist (run
  FIRST after every deploy, on a hard-reloaded tab and again on a second visit): console has no
  `/assets/index-<hash>.js` 404; both buttons respond; active SW cache name
  (`torii-quest-tq-v<current>`) matches the version label; SW Cache Storage holds no HTML shell;
  second visit self-heals (one controllerchange reload). Names the two automated companions.
- `todo.md` (new HARD-41 row), `progress.md` (header / Source version / Tests / Active slice),
  `HANDOFF.md` (Current version + v0.2.227 changelog block + report pointer),
  `SDK_DEBUG_INDEX.md` (status version).

### Version markers
- `src/config.js` (`VERSION`), `package.json`, `public/sw.js` (`CACHE_VERSION`),
  `index.html` (`#version-label` + `#ver`), `tools/regression-check.mjs`
  (`EXPECTED_VERSION` + stale guard → v0.2.226), `src/engine/dashboard/continuumData.js`
  (`CONTINUUM_VERSION` + "Source version" + Active slice), `src/engine/status/mvpReadiness.js`
  (`DEFAULT_TEST_STATUS`), `tests/continuum-dashboard.test.js` (4 version pins). Test counts
  1494→**1501 passing**, 91→**92 files** (+1 lockstep for the new test file).

### Regenerated artifacts
- `NEXT_ACTION_STATE.json`, `MVP_APPROVAL_STATE.json`, `public/release-metadata.json`,
  `public/continuum.html`, `public/continuum-data.json`, `HANDOFF.generated.md`,
  `MVP_RELEASE_PACKAGE.md`, `MVP_PLAYTEST_CHECKLIST.md`, `RELEASE_NOTES_DRAFT.md`,
  `GITHUB_RELEASE_DRY_RUN.md`, `MVP_RC_SNAPSHOT.md`, `RELEASE_ARTIFACT_MANIFEST.md` (carry
  v0.2.227-alpha). **`MVP_PLAYTEST_RESULTS.md` is NO-CLOBBER and was NOT regenerated.**

### New
- `torii-v0.2.227-entry-flow-smoke-harness-report.md` — this report.

## Tests run / results

- `npx vitest run` → **1501 passing / 92 files** (+7 from new `entry-flow-smoke.test.js`)
- `npm run check` → expected **15 / 15 GREEN** (after `npm run build` refreshes dist markers)
- `npm run build` → expected clean (standing rapier >700 KB advisory only, not gated)
- `npm run test:release` → expected **exit 0**

## Manual verification notes

- The new automated coverage is static (file-read) and runs in CI without a browser; the LIVE
  checks (buttons actually respond on the deployed site) remain the parent agent's cloud-browser
  smoke test of https://torii-quest.pplx.app and the new manual checklist.
- **No MVP approval granted; playtest remains not-run / pending.** `MVP_PLAYTEST_RESULTS.md`
  untouched. No fabricated results.

## Security-sensitive behavior

**None.** No new fs/crypto/git/network surface in shipped code (the new test only reads two repo
files at test time). No gameplay/physics/shooter/Rapier change; no Nostr signing/publishing/live
network write; no deploy/publish/tag/self-update. `godMode` stays false; no new
`setTimeout`/`Vector3`/`Matrix4`; "nostrich"/"Chiefmonkey" untouched.

## Blockers / warnings

None. Commit is **local only** — not pushed, not deployed, not published, not tagged. Standing
non-blocking advisories unchanged (rapier chunk >700 KB; alpha). Parent/main agent handles
security review, deploy, publish, push, and Space upload.

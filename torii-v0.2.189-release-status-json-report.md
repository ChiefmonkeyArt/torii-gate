# Torii Quest — v0.2.189-alpha report

## Release readiness as JSON (machine-readable ship verdict)

**Type:** safe infrastructure / tooling + docs slice — *no runtime change*
**Shipped on top of:** v0.2.188-alpha (live/pushed/synced)
**Constraints honoured:** version bumped every deploy · godMode false · no new
`setTimeout` · no new `Vector3`/`Matrix4` in hot paths · "nostrich" comment spelling ·
Chiefmonkey spelling · debug tools ship unconditionally · ESC pause + panel-click
fire-safety intact. No gameplay / portal / physics / shooting / controls / live Nostr
write behaviour was touched.

---

## What & why

The local ship verdict already existed as a human-readable terminal summary
(`npm run release:status`, added v0.2.187) and a dashboard fold (v0.2.188). The gap:
**every other consumer — dashboard build, handoff snapshot, update-checker, AI agents —
had to parse human terminal text** to learn whether the source is ready to ship.

v0.2.189 closes that gap by exporting the *same* verdict as a stable,
deterministic-by-design JSON envelope. It **extends** the existing release-readiness
tooling rather than reimplementing it: a new pure function wraps the existing
`buildReleaseReadiness()` summary; the existing thin CLI gains a `--json` flag.

### Design properties

- **Pure / read-only / local / no network.** `buildReleaseStatusJson(summary, opts)`
  takes an already-computed summary and returns a plain object. No fs, no child_process,
  no THREE, no DOM. The CLI side (which does the fs/git I/O) is unchanged except for the
  new flag branch.
- **Stable schema.** Envelope carries `schema: 'torii.release-status'` +
  `schemaVersion: 1`, so consumers can version-guard.
- **Deterministic by design.** `generatedAt` is the **only** non-deterministic field.
  It is **optional and isolated**: omit it → `null` (fully reproducible, used by tests);
  the CLI passes a real `new Date().toISOString()` stamp. Every other field is a pure
  function of the input summary.
- **Honest degradation.** Garbled / non-object input (`null`, `undefined`, a number, a
  string, an array) → `{ status: 'unknown', statusLabel: 'NO SUMMARY', ready: false,
  error: 'no-summary', signals: {} }`. Never throws.
- **No source mutation.** `signals` is deep-cloned (`JSON.parse(JSON.stringify(...))`);
  `blockers` / `unknowns` / `latestReports` are sliced.
- **Clean stdout.** `node tools/release-readiness.mjs --json` writes pure parseable JSON
  to stdout. (Under `npm run`, npm's banner goes to **stderr** in npm v7+, so
  `npm run --silent release:status:json` or invoking the node script directly yields
  clean JSON.)

### Envelope shape

```json
{
  "schema": "torii.release-status",
  "schemaVersion": 1,
  "generatedAt": "2026-06-25T16:43:24.000Z",   // or null when omitted
  "status": "ready",                            // ready | not-ready | incomplete | unknown
  "statusLabel": "READY",
  "ready": true,
  "badge": "...",
  "gateCommand": "npm run test:release",
  "blockers": [],
  "unknowns": [],
  "version": "v0.2.189-alpha",
  "packageVersion": "0.2.189-alpha",
  "gitCommit": "29f2c5f",
  "signals": { "versionSync": {...}, "tests": {...}, "regression": {...},
               "bundle": {...}, "zoneFallback": {...}, "docs": {...} },
  "latestReports": [ "torii-v0.2.188-...md", ... ]
}
```

---

## Changed files

### Tooling
- **tools/releaseReadiness.mjs** — added pure exports `RELEASE_STATUS_SCHEMA`,
  `RELEASE_STATUS_SCHEMA_VERSION`, and `buildReleaseStatusJson(summary, {generatedAt})`.
  Stays a pure aggregator (no fs/network/process/THREE/DOM).
- **tools/release-readiness.mjs** — thin CLI now imports `buildReleaseStatusJson`; the
  direct-invocation run-guard handles `--json` (emits the envelope with a live ISO stamp
  and exits 0) before the human-readable path. Import remains side-effect-free.
- **package.json** — version → `0.2.189-alpha`; new script
  `"release:status:json": "node tools/release-readiness.mjs --json"`.

### Version markers
- **src/config.js** — `VERSION = 'v0.2.189-alpha'`.
- **index.html** — version label + footer → v0.2.189-alpha.
- **tools/regression-check.mjs** — `EXPECTED_VERSION = 'v0.2.189-alpha'`; stale-guard now
  flags any lingering `v0.2.188-alpha` in index.html.
- **src/engine/dashboard/continuumData.js** — `CONTINUUM_VERSION` → v0.2.189-alpha;
  Source-version + Tests (1032) + Active-slice metrics refreshed; v0.2.189 prepended to
  `activeNow` (length 3 preserved — prior version slice dropped, standing ARS items kept)
  and `completed24h` (length 4 preserved — oldest v0.2.185 entry rotated out).

### Tests
- **tests/release-readiness.test.js** — +7 tests in a new
  `buildReleaseStatusJson — machine-readable envelope (v0.2.189)` describe: schema
  envelope + verdict passthrough; deterministic-no-stamp; isolated-stamp (strip
  `generatedAt` → envelopes match); non-string stamp ignored + JSON-serialisable;
  not-ready blockers passthrough; incomplete unknowns passthrough; garbled→unknown for
  `[null, undefined, 42, 'nope', []]`; no source mutation.
- **tests/continuum-dashboard.test.js** — version pins updated to v0.2.189-alpha
  (4 occurrences).

### Docs
- **todo.md**, **progress.md**, **HANDOFF.md**, **CODE_INDEX.md**,
  **SDK_DEBUG_INDEX.md** — version bumped to v0.2.189-alpha; v0.2.189 slice + the new
  `npm run release:status:json` command documented; test count → 1032.

---

## Checks run

| Check | Result |
|---|---|
| `npm run test:release` (full gate: build continuum + check + full Vitest) | **ALL GREEN** — 68 files, **1032 passing** |
| `[continuum] ship readiness` | **READY (generated)** · docs in sync |
| `[continuum] health` | profiles fast 5 / foundation 25 · full 68 files |
| `node tools/release-readiness.mjs --json` (raw stdout) | valid JSON · `schema=torii.release-status v1` · `status=ready` `ready=true` `version=v0.2.189-alpha` · 6 signals present · `generatedAt` stamped |
| `npm run release:status` | READY, in sync, docs 7/7 |
| XSS guard `grep -cE "javascript:\|window.location\|location.href\|eval(\|window.open" public/continuum.html` | **0** |

New JSON tests: **22 pass** in release-readiness.test.js (15 prior + 7 new).

---

## Security / performance concerns

- **None for runtime.** No game/runtime code path changed. The new helper is pure and
  never executes during gameplay.
- **No network / no fs writes** from the new code. The helper is a pure transform; the
  only I/O is the pre-existing CLI's read of local files + `git`, unchanged.
- **No injection surface.** Output is `JSON.stringify` of a plain object; no template
  interpolation, no shell. Consumers parse JSON, not human text.
- **Bundle:** unchanged (tooling is not bundled). Advisory rapier-chunk warning persists
  as tracked (not gated).

---

## Commit

- **Message:** `v0.2.189-alpha: export release readiness as JSON`
- **Hash:** _(appended below after commit)_

Local commit only. Parent agent verifies, reviews, deploys, publishes, pushes, and
uploads docs, then continues to the next safe task.

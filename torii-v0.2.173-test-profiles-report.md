# Torii Quest — v0.2.173-alpha Report: Test Profile System

> Infrastructure speed-up: deterministic test profiles for faster AI/dev inner
> loops, with full release safety preserved unchanged. No gameplay change.

## Summary

Added a **test profile system** so agents and developers can run small, curated,
deterministic test subsets during implementation while keeping the full release
gate intact. Profiles are explicit basename lists (NO git-diff heuristics),
validated against the real `tests/` directory at runtime, and emit a timing
footer so savings are visible in logs.

## Scripts added (`package.json`)

| Script | Runs | Purpose |
|---|---|---|
| `npm run test:fast` | 5 core pure files (state, events, classifier, aim, snapshot) | Tight inner loop — ~4s |
| `npm run test:foundation` | 16 pure/guard files (fast + combat-damage, raycast-service, player-boundary, bot-agent, sdk, registry, component, consent-gate, doc-consistency, handoff-status, bundle-sizes) | Broader pre-commit check — ~10s |
| `npm run test:release` | `build && vitest run && check && bundle:report && handoff:status` | **Full release gate, unchanged.** Required before any deploy/publish. |

`test:fast` ⊆ `test:foundation` ⊆ full suite — enforced by `validateProfiles`.

## Files added

- **`tools/testProfiles.mjs`** — PURE registry (node-safe, no I/O). Exports
  `PROFILES` (frozen), `PROFILE_NAMES`, `isKnownProfile`, `profileBasenames`,
  `profileFiles`, `validateProfiles(existing)` (flags missing files + non-nested
  fast/foundation, fails loudly on rename/delete), `formatProfileLine`,
  `formatTiming`. No `release` key — release is the full suite, not a subset.
- **`tools/test-profile.mjs`** — thin CLI. Reads argv (`fast`/`foundation`,
  `--list`), gathers real `tests/*.test.js` via `readdirSync`, runs
  `validateProfiles`, then lists or spawns `npx vitest run <files>`, measures
  elapsed time, prints `formatTiming(...)` + a `test:release` reminder. Unknown
  profile → exit 2; otherwise exits with vitest's status.
- **`tests/test-profiles.test.js`** — 11 tests for the registry/CLI contract
  (names, frozen, no release key, nesting, validateProfiles ok against real dir
  + flags a removed file, timing/line formatting).

## Observed time savings

| Profile | Files | Tests | Wall time |
|---|---|---|---|
| `test:fast` | 5 | 74 | ~4.3s |
| `test:foundation` | 16 | 228 | ~9.9s |
| full suite (`npm test`) | 59 | 797 | ~34.6s |

Fast is ~8× quicker than the full suite for the inner loop.

## Docs updated

todo.md, progress.md, HANDOFF.md, CODE_INDEX.md, SDK_DEBUG_INDEX.md, README.md —
all document the profiles and the rule: **agents may run targeted/fast/foundation
during implementation, but every public deploy/publish requires `test:release`
(or equivalent full parent verification).** `continuumData.js` + the continuum
dashboard regenerated for v0.2.173.

## Verification (local, no network)

- `npm run test:fast` — 5 files / 74 tests GREEN (~4.3s)
- `npm run test:foundation` — 16 files / 228 tests GREEN (~9.9s)
- `npm test -- --run` — **59 files / 797 tests GREEN** (~34.6s, +11 from v0.2.172)
- `npm run check` — **14 / 14 ALL GREEN** (doc-consistency confirms v0.2.173-alpha across 5 docs)
- `npm run build` — clean (rapier chunk >700 KB advisory only)
- `npm run bundle:report` — 2.9 MB raw / 1021 KB gzip (tracked, not gated)
- `npm run handoff:status` — version in sync (config.js + package.json = v0.2.173-alpha)

## Safety notes

- godMode remains `false`. No new `setTimeout`, no new `Vector3`/`Matrix4` in hot
  paths. Debug tools still ship unconditionally.
- No destructive actions, no external writes, no signing, no NIP-07, no private
  keys, no payments, no auto-updates. Pure tooling + docs only.
- `test:release` is byte-for-byte the same gate as before (full Vitest + check +
  bundle + handoff); profiles add convenience subsets, they do NOT replace or
  weaken release verification.
- Committed LOCALLY ONLY. Not pushed/deployed/published — parent verifies and ships.

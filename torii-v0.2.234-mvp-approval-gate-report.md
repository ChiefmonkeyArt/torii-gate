# Torii Quest — v0.2.234-alpha · MVP Approval Gate Report

**Verdict: SHIP** (status/dashboard/docs-only slice; no runtime, gameplay, physics, Nostr-write, or gateway behaviour changed)

- Live: https://torii-quest.pplx.app · Dashboard: https://torii-quest.pplx.app/continuum.html
- Suite: **1595 tests / 96 files — all passing**
- `npm run test:release`: **ALL GREEN** (15/15 regression checks) + build + bundle advisory + handoff status

---

## 1. What this slice does

Adds a dedicated **MVP approval gate** surface so that automated green checks can
never be mistaken for human game-feel approval. It makes three things explicit and
machine-checkable:

1. Automated tests / smokes are **confidence signals only**.
2. MVP approval still requires an **explicit human (Chiefmonkey/user) OK** — an
   approver name **and** a timestamp.
3. The manual playtest must cover 11 focus areas: entry flow, shooter feel, hit
   registration / headshots, bot behaviour, movement / footsteps, reload feel,
   mirror / reflection, crates, NAP monkey, dashboard clarity, and subjective
   fun / feel blockers.

The gate is a single PURE, browser-safe module consumed by both the static
Continuum dashboard and the node status tools, so the green-logic cannot drift
between surfaces.

## 2. Files

**New runtime/status module**
- `src/engine/status/mvpApprovalGate.js` — pure (no fs/network/child_process/THREE/DOM;
  never throws). Exports `MVP_APPROVAL_GATE_BADGE` (`MVP APPROVAL GATE · LOCAL ·
  READ-ONLY · GREEN CHECKS ≠ HUMAN APPROVAL`), `MVP_PLAYTEST_FOCUS` (11 items),
  `MVP_GATE_CLARIFICATIONS` (3 items), `MVP_GATE_VERDICTS`, `buildMvpApprovalGate`,
  `validateMvpApprovalGate` (the **APPROVAL-REQUIRES-EXPLICIT-OK floor**:
  `verdict:'approved'` is an ERROR unless `approval.approved===true` with approver +
  timestamp), `isMvpGateApproved`, `summarizeMvpApprovalGateForState`,
  `buildMvpApprovalGateCard`, `MVP_APPROVAL_GATE_REQUIRED_KEYS`.

**Wiring (no new logic duplicated)**
- `src/engine/dashboard/continuumData.js` — folds the gate card into the Continuum
  model; `CONTINUUM_VERSION` → v0.2.234-alpha; `CURRENT_TEST_STATUS` → 1595 / 96.
- `tools/nextActionState.mjs` + `tools/build-continuum.mjs` — fold `mvpGate` into
  `NEXT_ACTION_STATE.json` with `impliesApproval:false` / `impliesPlaytestComplete:false`
  pinned.

**Tests (gate cannot read approved without explicit state)**
- `tests/mvp-approval-gate.test.js` — 15 tests locking the explicit-OK floor, focus /
  clarification wording, safety pins, next-action fold, dashboard card.
- `tests/continuum-dashboard.test.js` — new `MVP approval gate section (v0.2.234)`
  block (4 tests): renders the section + badge + all focus terms + "CONFIDENCE
  signals" / "EXPLICIT human OK" wording; no religious language; XSS-escape, single
  inline script, CSP hash intact.
- `tests/next-action-state.test.js` — folds the gate (null→`unknown`/false;
  pending→`awaiting-approval`/confidenceGreen true/approved false; Chiefmonkey+timestamp
  →`approved`/true; all implies-flags false); `mvpGate` in required-keys; formatter line.

**Version markers (lockstep)**
- `src/config.js` VERSION, `public/sw.js` CACHE_VERSION, `package.json` version,
  `index.html` ×2, `tools/regression-check.mjs` EXPECTED_VERSION, `MVP_APPROVAL_STATE.json`,
  regenerated `NEXT_ACTION_STATE.json`.

**Docs**
- `todo.md`, `progress.md`, `HANDOFF.md` (continuity docs — docConsistency hard-fail),
  `CODE_INDEX.md`, `SDK_DEBUG_INDEX.md` all reference v0.2.234-alpha; todo/progress
  carry the v0.2.234 changelog/active-slice entry.

## 3. Strict semantics preserved

`NEXT_ACTION_STATE.json` → `mvpGate` confirms: with every confidence signal green
(`releaseReady`, `entrySmokePass`, `dashboardSmokePass`, `suiteGreen` all true),
the gate still reports `verdict:"awaiting-approval"`, `approved:false`,
`approvalStatus:"pending"`, `impliesApproval:false`, `impliesPlaytestComplete:false`.
Smoke pass ≠ MVP approval; dashboard pass ≠ playtest complete.

## 4. Constraints honoured

godMode false · no new setTimeout · no new Vector3/Matrix4 in hot paths ·
comments use 'nostrich' · Chiefmonkey spelling exact · debug tools ship
unconditionally · non-religious ethics guard (v0.2.233) intact · no deploy /
publish / push performed.

## 5. Result

**SHIP** — all 15 regression checks green, full suite 1595/96 green, build clean,
gate proven to refuse `approved` without an explicit human OK. No runtime behaviour
changed; the main agent owns the manual deploy.

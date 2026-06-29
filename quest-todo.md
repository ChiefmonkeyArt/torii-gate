# Torii Quest ToDo

Source of truth for Torii Quest tasks.

## Scope

Torii Quest is the game app.
Torii Continuum is a separate dashboard app and must stay on `continuum-todo.md`.
Nostr Arena is archival only and must not be used as the active queue for Quest.

This todo is reprioritised around the lean MVP only:
- Keep the freedom-tech loop clear and demoable.
- Keep shooter work maintenance-only unless a bug is demo-breaking.
- Keep BotAgent / runtime separation work only where it improves Quest vs Continuum boundaries or prevents instability.
- Keep NOSTR_ARENA_MASTER_TODO.md as the Arena-only source-of-truth file until the Quest / Continuum split is fully settled.
- Defer broader polish, most live-promotion work, and larger redesign passes to Milestone 2 and Milestone 3, while keeping security gates visible until the related live features are promoted.


## Milestone 1 — MVP Proof of Concept Torii Quest

Goal: ship the smallest clean proof-of-concept that demonstrates the Torii Quest loop.

### Current job status
- PAUSED: Oversight dashboard progress UX work
- State captured in HANDOFF / NEXT_ACTION_STATE.
- Replacement slices:
  - Finish the Continuum click-through mockup path for the MVP demo (1–3h)
  - Show clearer progress state in the oversight dashboard (1–3h)
  - Add heartbeat / partial-progress feedback for long-running bot work (1–3h)

### Active MVP tasks
- Keep the four MVP proof slices visible and coherent as one loop: Gateway, Product, Leaderboard, Update.
- Keep the title-screen / entry / in-world flow stable so the loop can be demoed end-to-end without silent failure.
- Keep the current safe gateway path intact: preview, intent, consent copy, dry-run plan, same-origin executor seam, and controlled host transport seam.
- Complete the move of the Torii jump gate / gateway experience into the far-right corner of the NAP zone and keep only enough in-world gateway mesh work to make that experience legible and usable.
- Keep BotAgent / separation work only where it sharpens the Torii Quest vs Torii Continuum app boundary or prevents demo-breaking instability.
- Keep docs / handoff / code-index upkeep only at the minimum needed to stop agent confusion and preserve clean app separation.
- Stand up a safe assistant-editable .md pipeline for quest-todo.md / continuum-todo.md so todo, handoff, and progress updates can be made on the fly without manual copy-editing.
- Stand up a thin Continuum click-through mockup for the MVP loop (read-only dashboard path, no admin actions), so the freedom-tech loop can be demonstrated with oversight.

### MVP constraints
- Shooter is maintenance-only.
- No combat-feel polish unless demo-breaking.
- No broad rewrites.
- No speculative architecture work.
- No dashboard redesign work in the Quest MVP queue.
- No live network execution unless already required for the safe MVP proof path.

## Milestone 2 — Post-MVP functional expansion

Goal: promote selected proof surfaces into richer, more functional experiences after the MVP is proven.

### Deferred to Milestone 2
- Real leaderboard publish via NIP-07 / relay write.
- Richer product interaction beyond read-only proof.
- Real GitHub fetch for update-check.
- Further live gateway promotion beyond the current safe proof path.
- Richer in-world proof-surface / mesh promotion work not required for the MVP demo.
- Additional BotAgent runtime migration or deeper engine cleanup that is not needed for clean app separation or MVP stability.
- Further player-boundary / FSM cleanup that is not directly required for the MVP.

### Standing security gates for live promotion
- SEC-1 leaderboard publish gate — required before any live leaderboard signer / relay publish wiring.
- SEC-2 handoff verification gate — required before any live relay-backed or signed handoff path is trusted.
- SEC-3 product URL hardening gate — required before any product URL becomes clickable or fetched.

These are not Milestone 1 delivery tasks unless live promotion is explicitly being advanced, but they are also not ordinary backlog items to forget. Keep them visible as standing gates that must be cleared before the related live features are promoted.

## Milestone 3 — Post-MVP polish and redesign

Goal: improve visual quality, readability, and feel once the MVP loop is already working.

### Deferred to Milestone 3
- Shooter feel polish.
- Mesh / material polish.
- Broader UX refinement.
- Broader bot behaviour polish.
- Larger Continuum redesign follow-up work such as DASHBOARD-LAYOUT-1 richer cards / tables / denser visual redesign.
- Any nonessential visual or presentation improvements that do not change the MVP proof.

## Torii Quest ToDo - Working rules

- Prefer thin vertical slices over polish traps.
- Break every task into small chunks that can usually be finished in a few hours, not open-ended multi-day jobs.
- Prefer thin vertical slices with a clear green checkpoint, visible outcome, and one obvious next step.
- Avoid long-running jobs that stall flow, hide risk, or delay feedback; if a task starts to sprawl, split it again before continuing.
- Each chunk should produce meaningful progress on the MVP proof, app separation, safety, or demo stability.
- End each chunk in a handoff-safe state: code green, tests updated where relevant, docs/indexes touched, and the next safe task easy to pick up.
- If a job cannot be described as a few-hour slice with a concrete finish line, it is too big and must be broken down first.
- Every change should improve clarity, safety, testability, or separation when practical.
- Keep Quest and Continuum task lists separate.
- If a task does not directly help the MVP proof, clean app separation, or demo stability, defer it.
- When a current job becomes too large, pause it safely: commit or checkpoint all green work, record the current state in HANDOFF / NEXT_ACTION_STATE, then replace it with a list of 1–3 hour follow-up slices.
- Never abandon partially-completed work; always capture its state before changing the active job.

### Bot / progress handling

- Pause any bot-related work that does not directly improve MVP stability, app boundaries, or player feedback.
- Do not let long-running BotAgent jobs block progress reports or dashboard updates; report partial landings as soon as they are green.
- Prefer short, observable slices (1–3 hours) that show visible changes in bot behaviour, load, or safety.
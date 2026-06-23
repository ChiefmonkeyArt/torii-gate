# Torii Quest / Nostr Arena — TODO Audit Report
Date: 2026-06-23

---

## Summary

The original `NOSTR_ARENA_MASTER_TODO.md` was 277 lines. The cleaned version is 135 lines — a reduction of ~51%. All active/pending tasks, critical rules, deploy commands, key files, and CI pipeline are preserved. All completed historical entries have been removed.

---

## What Was Removed

### Completed v0.6.XXX sections (all fully done, no residual work)

| Section | Versions | Entries removed |
|---------|----------|----------------|
| Completed — Bug Fixes | v0.6.124 | 3 entries (F1, F2, F3) |
| Completed — Bug Fixes | v0.6.133–v0.6.134 | 5 entries (F5–F9) |
| Completed — Perf Optimisations | v0.6.131 | 2 entries (P1, P2) |
| Completed — Perf Optimisations | v0.6.132 | 2 entries (P3, P3b) |
| Completed — GC / Performance Fixes | v0.6.125–v0.6.130 | 7 entries (F4, G1–G5, D5, D6) |
| Completed — Optimisation Sprint | v0.6.119–v0.6.123 | 13 entries |
| Completed — Debug / Glitch Capture | v0.6.117–v0.6.118 | 4 entries (D1–D4) |
| Completed — Character & Visual fixes | v0.6.109–v0.6.116 | 9 entries (C3–C11) |
| Completed — Stability | v0.6.119 | 1 entry (S1) |
| Completed — Earlier versions | v0.5–v0.6.97 | 14 entries |

### Completed Torii Quest sections

| Section | Removed |
|---------|---------|
| Completed — Torii Quest Gateway Regression Repair (v0.2.111) | 8 entries (TQ111-1 through TQ111-8) |
| Completed — Torii Quest Gateway Foundation Sprint (v0.2.100–v0.2.110) | 11 entries (TQ100–TQ110) |

### Redundant inline note in Pending table
- Row `A1 ✅` (ARCH — main.js modular migration steps 1–7 complete) was a completed-status row sitting inside the Pending table. It has been replaced with a dedicated **Modular Migration Progress** table that clearly shows what is done and what is next (`player.js` at v0.6.145), rather than a ✅ row mixed in with active work.

---

## What Was Kept

### All active pending tasks
All 26 rows from the Pending table are preserved in the cleaned file, including:
- Architecture: A1-next (Extract player.js), A2 (State + event bus)
- POST-VITE stubs (8, 9, 12)
- Bundle/testing (13, 14)
- Gameplay: B1 (kill feed), B2 (bot NPC refactor), CF1 (combat feedback), V1 (contrail plane), R2 (reload mechanic)
- Assets: G1 (gun.glb)
- UI/UX: W1 (Gate Modal)
- Nostr/eCash: LB1 (leaderboard), 20 (kind:0 sync), 19 (NIP-60 eCash)
- HUD: 21 (mini-map)
- NAP Zone: 3, 4a, 4b, 6, 7
- Infra: 22 (GitHub scan), B3 (daily bot health check)

### Open / Parked items
- NIP46-1 (Primal remote signer non-compliance) — kept as an open bug with workaround documented
- TP1 (Touchpad controls parked) — kept with GitHub issue reference

### Torii Quest manual smoke test
- TQ-MANUAL-111 — kept as a pending action item (not yet confirmed done)

### All reference material
- Key Files table — fully preserved
- CI Pipeline — fully preserved
- Deploy Commands — fully preserved
- Critical Rules — fully preserved (all 8 rules)

---

## Items Needing User Decision

1. **TQ-MANUAL-111 smoke test** — Is the manual v0.2.111-alpha smoke test on real hardware actually done? If yes, this row can be removed in the next update.

2. **NIP46-1 Primal bug** — Is this still relevant to the project, or has it been de-prioritised indefinitely? Could move to a separate "External Blockers" section or remove if Primal integration is no longer a near-term goal.

3. **Version header** — The TODO header currently reads `Current version: v0.6.144-alpha`. If the Nostr Arena main branch has advanced beyond this during modular migration, update the version number when committing the cleaned file.

4. **Torii Quest version** — The fork note reads `v0.2.111-alpha`. Once v0.2.112 or later lands, update this line.

5. **B3 Daily bot health check (INFRA)** — This is a scheduled infrastructure task. Confirm whether this has been set up (and is therefore done) or is still pending implementation before the next deploy.

---

## File Locations

| File | Path |
|------|------|
| Cleaned TODO | `/home/user/workspace/NOSTR_ARENA_MASTER_TODO.cleaned.md` |
| This audit report | `/home/user/workspace/torii-todo-audit-report.md` |
| Original (Space file) | `/home/user/workspace/space_files/collection_f2a376d4-85ac-43bf-b2b8-4187f6836287/bc0500cd-81e8-4cec-8fce-d40c9a0ec9ba/NOSTR_ARENA_MASTER_TODO.md` |
| Original (repo copy) | `/home/user/workspace/torii-gate-ce3bcc94-c326380f/NOSTR_ARENA_MASTER_TODO.md` |

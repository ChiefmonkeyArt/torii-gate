# Torii Quest — Progress Dashboard

> Visual execution dashboard. `strategy.md` = vision/decision rules · `todo.md` = active task queue.
> Current version: **v0.2.171-alpha** | Live: [torii-quest.pplx.app](https://torii-quest.pplx.app)
> **ACTIVE FOCUS — 15-hour proof-of-concept route.** Shooter is maintenance-only unless demo-breaking; the active MVP is the freedom-tech loop (gateway/NAP-to-NAP preview → Plebeian/Nostr product panel → leaderboard preview → torii.quest update-check). Polish comes after PoC validation.

---

## At a glance

| Metric | Value |
|---|---|
| Source version | **v0.2.171-alpha** (build truth; live trails — manual maintainer deploy) |
| Tests | **779 passing / 58 files** |
| Regression check | **14 / 14 GREEN** |
| Bundle (advisory) | 2.9 MB raw / ~1017 KB gzip (rapier chunk >700 KB, expected) |
| Gates | SEC-1 / SEC-2 / SEC-3 intact · godMode `false` |
| Active slice | v0.2.171 Torii Continuum project-oversight dashboard |

Legend: `█` done · `░` remaining · ✅ landed · 🔄 in progress · ⏳ pending · 🚫 blocked · 🟢 no-blocker

---

## Track Overview

Baseline totals marked **[baseline]** — nudge them as work lands; directional accuracy over archaeology.

| Track | Progress | Done | Status |
|---|---|---|---|
| Foundation / ARS | `██████████████░░░░░░` 71% | 5 / 7 | 🔄 ARS-4 (FSM fold) + ARS-6 (CODE_INDEX upkeep) open |
| Combat / Game-feel | `████████████████████` 100% | 30 / 30 [baseline] | ✅ 1 open edge (travel-time lead on moving targets) |
| Rapier / Physics | `████████████████████` 100% | 5 / ~5 seams | ✅ ARS-3 raycast migration complete |
| SDK / API | `█████████████████░░░` 86% | 18 / ~21 | 🔄 player boundary lift + BotAgent runtime remain |
| Nostr / Open-world | `███░░░░░░░░░░░░░░░░░░` ~15% | 0 / 5+ formalised | 🔄 read-paths + consent gate + travel chain proven; relays/signing deferred |
| Deployment / VPS | `██████████░░░░░░░░░░` n/a | — | 🟢 source clean; live behind (manual deploy) |

**Track notes**
- **Foundation/ARS:** ARS-1/2/3/7 (v0.2.130), ARS-5 (v0.2.131) landed. Remaining: ARS-4 FSM fold (partial — `canShoot`/`canReload`/`isEngaged`/`needsPointerLock`/`isReloading`/`tickReload` + real `GAMEOVER` edge wired v0.2.133) and ARS-6 ongoing upkeep.
- **SDK:** 6 boundary seams [baseline] + public entrypoint + component contract + reference components + gateway-protocol/leaderboard helpers + loader/registry + view shells + the full gateway-travel chain (read → confirm → consent → plan → execute, v0.2.164–v0.2.168).
- **Nostr:** Gateway Protocol drafted (v0.2.134); relay-read foundation + leaderboard/profile/gateway reads + consent gate + travel-confirm/plan/execute all proven PURE & INERT. Live relay I/O, signing, and the world hop in `world/handoff.js` remain deferred.

---

## 15-Hour Proof-of-Concept Route (MVP loop)

| # | Slice | Status |
|---|-------|--------|
| LEAN-1 | Torii.quest live (publish green source) | ⏳ pending (manual smoke first) |
| LEAN-2 | Gateway / NAP-to-NAP travel | 🔄 chain proven: protocol+intent (134) → handoff/portal shells (135/136) → visible preview (139) → read (164) → confirm (165) → consent (162/166) → plan (167) → executor (168) → **host transport adapter (170)**. Needs `createBrowserHostTransport(window)` wired into `world/handoff.js` + portal mesh to ACT. |
| LEAN-3 | Plebeian/Nostr product panel | 🔄 `productDisplay`/`productPanel`/`productPanelShell` + visible preview (140). Needs in-world mesh + real listing. |
| LEAN-4 | Leaderboard (Nostr signed events) | 🔄 unsigned helpers + publisher adapter + view + visible preview (141) + relay-read proof (160). Needs real signer (SEC-1) + relay read. |
| LEAN-5 | torii.quest GitHub update-check | 🔄 helper + view-model + docs + visible preview (142) + release source/status (157/158). Needs read-only releases fetch + prompt mesh. |

---

## Active now

- 🔄 **v0.2.171 — Torii Continuum oversight dashboard** (`engine/dashboard/continuumData.js` + `public/continuum.html`): curated `progress.md` model + self-contained static HTML render (bars/rings/totals); regenerated from packaged data each build.
- 🔄 **ARS-4** — finish folding reload/pointer-lock into the guarded FSM.
- 🔄 **ARS-6 / PROGRESS-1** — ongoing CODE_INDEX + living-docs upkeep.

---

## Next 12 tasks

1. Wire `createBrowserHostTransport(window)` (v0.2.170) into `world/handoff.js` (real router/history adapter + same-origin allowlist + CSP) so the v0.2.168 executor can ACT.
2. Gateway portal mesh — actually move the player in-world on a confirmed hop.
3. **SEC-2** handoff verification gate — cryptographic checks before acting on live relay travel intents.
4. Real leaderboard signer/publisher + relay read (**SEC-1** explicit NIP-07 consent first).
5. In-world product panel mesh over `productPanelShell` + a real Plebeian.Market listing.
6. **SEC-3** product URL validation — `URL`-object parsing (scheme+host), not regex-only.
7. Read-only GitHub releases fetch (CSP-scoped) + in-world update-prompt mesh.
8. LEAN-1 / TQ-MANUAL-113 — manual smoke on real hardware, then publish source-built artifact.
9. ARS-4 FSM fold close-out.
10. Player boundary full extraction (movement tick, combat, lifecycle, body-state behind the seam).
11. BotAgent runtime migration — wire `decideActions`, migrate stateful tick/shoot/blowback.
12. Formalise NAP zone + handoff skeletons into working boundaries before Nostr/world features scale.

---

## Risk / blocked / no-blocker

| Item | State | Note |
|---|---|---|
| Foundation / docs / tooling slices | 🟢 no-blocker | Pure node-safe, no deploy needed — the current cadence. |
| Gateway-travel chain (read→execute) | 🟢 no-blocker | All PURE & INERT; never navigates/signs/publishes/writes network. |
| Live relay I/O · signing · world hop | 🚫 gated | SEC-1/2/3 must clear before any wire write or live navigation. |
| Live deployment | 🚫 manual | Trails source; needs maintainer smoke + publish (LEAN-1). |
| Travel-time lead on fast targets | ⚠ open edge | Hitscan-aimed but projectile-flown; long shots on strafing bots can trail. |
| ESBUILD-1 dev-server advisory | ⏳ deferred | `npm audit fix` pulls a risky rolldown/vite chain; tracked WARN. |

**Security gates (carried):** SEC-1 explicit user consent before any live NIP-07 signing / relay publish · SEC-2 cryptographic verification in `world/handoff.js` before acting on live relay data · SEC-3 `URL`-object product-URL validation before any clickable/fetched listing. The v0.2.162 consent gate + v0.2.166 consent UX + v0.2.167 dry-run plan + v0.2.168 injected-transport executor keep all three intact.

---

## Completed last 24h

Struck-through items stay ~24h, then collapse into Archive. Newest first.

- ~~**v0.2.171** — Torii Continuum project-oversight **dashboard**: a thin static page (`public/continuum.html`) generated from a curated, node-safe `progress.md` data model (`engine/dashboard/continuumData.js`) — CSS bars + SVG donut rings + totals strip, Now/Next/Later, next-12, struck completed-24h, archive, seed contributors/clankers metric, source-of-truth footer. Regenerated from packaged data each build (`build:continuum`); a same-origin-only refresh script re-reads `continuum-data.json` (no external URL/eval/timers). Safe relative link added to the title screen. Docs/tooling only, no gameplay change. +22 tests.~~
- ~~**v0.2.170** — same-origin host **transport adapter** (`engine/gateway/hostTransport.js`): the injectable seam the v0.2.168 executor drives — `createHostTransport`/`createRecordingHost` (default-safe in-memory) + `createBrowserHostTransport` runtime seam (pushState/replaceState only, not yet wired); `safeRoutePath` re-validated, back-home rollback, browser APIs behind DI; null host → executor no-op. +21 tests.~~
- ~~**v0.2.169** — graphical **progress dashboard** rewrite (this file): compact bars/percentages/badges/totals, 24h struck-through completions, concise archive. Docs/tooling only.~~
- ~~**v0.2.168** — first SAME-ORIGIN travel **executor** (`engine/gateway/handoffExecute.js`): acts on a READY v0.2.167 plan ONLY via an injected `transport.navigate`, re-validates the route with `safeRoutePath`, single synchronous rollback, safety flags pinned; never touches `location`/`history`/`window.open`/network/sign/publish. +19 tests.~~
- ~~**v0.2.167** — host travel handoff **seam** (`handoffPlan.js`): inert dry-run handoff/rollback PLAN over the v0.2.165 intent; same-origin route + https preview only, READY only under a matching grant. +21 tests.~~
- ~~**v0.2.166** — consent UX **view-model** (`consentView.js`): inert prompt copy + preview rows for every gate action; no wired confirm/sign/publish. +27 tests.~~
- ~~**v0.2.165** — gateway travel **confirm/intent** behind the consent gate (`travelConfirm.js`): sanitised destination, blocked-by-default, allowed-but-never-performed. +18 tests.~~
- ~~**v0.2.164** — gateway destination **relay-read proof** (`gatewayRead.js`): kind-30078 `#t:torii-gateway` filter → sanitised travel-preview model, newest-per-zone. +22 tests.~~
- ~~**v0.2.163** — leaderboard submit **intent** behind the consent gate (`submitIntent.js`): unsigned kind-30000 draft, blocked-by-default. +20 tests.~~
- ~~**v0.2.162** — consent-gate **foundation** (`consentGate.js`): frozen action registry, read-tier allowed / write-tier grant-gated, never performs. +19 tests.~~
- ~~**v0.2.161** — identity/profile **read proof** (`profileRead.js`): kind:0 metadata → sanitised display-only view-model, https-only URLs, newest-per-author. +17 tests.~~
- ~~**v0.2.160** — leaderboard **relay-read proof** (`leaderboardRelayRead.js`): kind-30000 filter → ranked board, dedupe newest-per-run. +12 tests.~~
- ~~**v0.2.159** — read-only Nostr **relay-read foundation** (`relayRead.js`): pure NIP-01 validate/normalise/filter + injected read-only adapter; no socket/publish/sign. +17 tests.~~
- ~~**v0.2.157/158** — GitHub release-check source + in-game update-status panel (`githubReleaseSource.js`/`updateStatus.js`): host-only injected fetcher, no auto-update. +39 tests.~~
- ~~**v0.2.153–156** — infra/handoff tooling: bundle-size baseline `[13]`, doc-consistency guard `[14]` (+noise cleanup), AI-handoff status snapshot (`npm run handoff:status`).~~

---

## Archive

Concise clusters, newest first. Per-version detail lives in git history + the `torii-*-report.md` files.

- **v0.2.147–152 — proof-surface pipeline.** Pure spec layer → spec↔registry cross-check → anchor→transform contract → first display-only in-world mesh pass → parent binding → promotion/regression GATE (regression check `[12]`). All inert; no click/raycast/navigation.
- **v0.2.144–146 — docs + review symmetry.** `VPS_INSTALL.md` self-hosting guide; `SDK_DEBUG_INDEX.md` + `shells.summary()`; `shells.diff()` preview→live promotion checklist.
- **v0.2.138–143 — MVP loop made visible.** Pivot to the 15-hour PoC route; four inert title-screen preview cards (gateway/product/leaderboard/update) + MVP-loop header; LEAN-5 update-check architecture. Rendered via `textContent` only.
- **v0.2.134–137 — lean-MVP foundation.** Gateway Protocol draft + `travelIntent`; CMP-13 product display; LB-1 leaderboard helpers; CMP-7 registry; gateway/portal/panel view shells; HARD-1..4 hardening + `shellReport`.
- **v0.2.131–133 — SDK + components.** `src/sdk/index.js` entrypoint + stability tiers; component contract + manifest spec; first reference component (`toriiGateway`); ARS-3 raycast migration; real `GAMEOVER` edge.
- **v0.2.120–130 — foundation & test harness.** Vitest added; event bus + FSM slices; ToriiDebug snapshot/report; pure physics/raycast/combat seams; HANDOFF.md.
- **v0.2.114–119 — decoupling.** Player/combat math extracted; foliage/mirror/bot-hit globals moved onto the event bus / module registries.
- **v0.2.100–113 — reconciliation & game-feel (2026-06-23).** Source reconciled by concern; physics SDK seams; regression batch (hit-reg, head-zone, reload, barrel→crosshair aim); CSP + avatar-URL hardening.

---

## Update Rules

1. Completed `todo.md` items stay crossed out ~24h so active-session context is preserved.
2. After ~24h, move them from "Completed last 24h" into Archive, grouped by date/sprint cluster.
3. `todo.md` stays focused on active/near-term work — no graveyard of old completions.
4. This file is the visual execution layer; `strategy.md` owns vision, `todo.md` owns the active queue.
5. Update track bars when a seam is extracted, a sprint block closes, or a major fix lands. Direction over exact counts.
6. Version Archive entries by sprint/date cluster — avoid per-version archaeology.
7. Do not list Google, Cloudflare, Microsoft, or Babylon.js anywhere in this file.

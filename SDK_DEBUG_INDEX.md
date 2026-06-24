# Torii Quest — SDK & Debug Surface Index

> **Status:** discoverability index (v0.2.146-alpha). A one-page map of the public
> SDK namespaces, the four MVP proof surfaces, and the read-only `ToriiDebug.shells`
> reports — for AI handoffs and FOSS contributors. **Everything listed here is pure
> and inert:** no network, no navigation, no signing/publishing, no auto-update.
> Source of truth for the SDK surface is `src/sdk/index.js` (`SDK_SURFACE`); for the
> debug reports it is `src/engine/debug/shellReport.js`. See `CODE_INDEX.md` for the
> full file-by-file map and `HANDOFF.md` for onboarding.

---

## 1. SDK entrypoint

`import * as torii from 'src/sdk/index.js'` (or destructure namespaces). It re-exports
ONLY pure, node-safe leaf modules — nothing transitively imports `scene.js`, so the
SDK loads in a plain node/vitest env. Each surface carries a `STABILITY` tier in the
frozen `SDK_SURFACE` map; `surfacesByTier(tier)` lists names at a tier.

- `SDK_VERSION` — tracks `config.js` `VERSION`.
- `STABILITY` — `{ STABLE, EXPERIMENTAL, INTERNAL }`.
- `SDK_SURFACE` — `{ name: { tier, module } }` (module `null` = forward-declared internal).

### STABLE namespaces (locked by tests; safe to depend on)

| Namespace | Module | What it is |
|---|---|---|
| `aim` | `engine/combat/aim.js` | barrel→crosshair aiming (`crosshairPoint`/`aimDirection`/`CONVERGE_DIST`) |
| `classifier` | `engine/combat/classifier.js` | head-vs-body hit geometry |
| `damage` | `engine/combat/damage.js` | head/body damage + kill-threshold contract |
| `interactions` | `engine/physics/interactions.js` | allocation-free `nudgeImpulse`/`applyNudge` |
| `raycastService` | `engine/physics/raycastService.js` | injectable raycast facade (`createRaycastService`, `raycastService`) |
| `reloadPose` | `engine/weapons/reloadPose.js` | reload viewmodel dip curve |
| `muzzle` | `engine/weapons/muzzle.js` | muzzle/barrel world-position math |

### EXPERIMENTAL namespaces (work + tested; shape may change)

`botAgent`, `snapshot`, `phaseScreens`, `component`, `registry`, `toriiGateway`,
`productDisplay`, `productPanel`, `productPanelShell`, `productPreview`,
`travelIntent`, `gatewayHandoff`, `gatewayPortal`, `gatewayPreview`, `leaderboard`,
`leaderboardPublisher`, `leaderboardView`, `leaderboardPreview`, `updateCheck`,
`updatePreview`, `mvpLoop`.

### INTERNAL (forward-declared, `module:null` — do NOT depend on yet)

`physicsBodies`, `physicsRaycast`, `player`, `identity`.

---

## 2. The four MVP proof surfaces + the loop

The 15-hour proof-of-concept route renders four inert title-screen preview cards,
framed as one **Travel → Market → Score → Update** loop. Each card is fed by a pure
SDK preview module and mirrored read-only on `ToriiDebug.shells`.

| Step | LEAN | Card / SDK namespace | `ToriiDebug.shells` report | Inert invariants |
|---|---|---|---|---|
| 1 · TRAVEL | LEAN-2 | `gatewayPreview` | `gatewayPreview()` | `readOnly:true`, `actionable:false` — never navigates |
| 2 · MARKET | LEAN-3 | `productPreview` | `productPreview()` | `readOnly:true`, `actionable:false` — no checkout/pay/zap |
| 3 · SCORE | LEAN-4 | `leaderboardPreview` | `leaderboardPreview()` | `readOnly:true`, `actionable:false`, `signed:false`, `published:false` |
| 4 · UPDATE | LEAN-5 | `updatePreview` | `updatePreview()` | `readOnly:true`, `actionable:false` — no fetch/install/auto-update |
| (header) | — | `mvpLoop` | `mvpLoop()` | `readOnly:true`, `actionable:false` — content/labelling only |

Underlying view/shell modules behind these previews: `gatewayPortal` (LEAN-2),
`productPanelShell` (LEAN-3), `leaderboardView` (LEAN-4), `updateCheck` (LEAN-5).
The `*Preview` modules are the visible-but-inert presentation layer over them.

As of **v0.2.146** all four previews expose the same `readOnly:true` +
`actionable:false` invariant pair (the gateway preview gained `readOnly` for
symmetry), so a reviewer can assert one consistent shape across every proof surface.

---

## 3. `ToriiDebug.shells.*` reports

Read-only DEBUG reports over the proof surfaces, with safe frozen demo fixtures
(`DEMO_GATEWAY`/`DEMO_PRODUCT`/`DEMO_SCORES`/`DEMO_RELEASE`) so each works
out-of-the-box. They ONLY read the shells' pure return values — no signer, relay,
publish, or navigation. Pass overrides to inspect your own data.

| Call | Returns (shape highlights) |
|---|---|
| `shells.gateway(c?,ctx?,o?)` | gateway portal VIEW summary — `{status,isGateway,armed,destinationLabel,relay,prompt,urlPreview,errors}` |
| `shells.gatewayPreview(c?,ctx?,o?)` | LEAN-2 preview block — `{title,status,statusLabel,armed,destination,relay,intent,urlPreview,badge,lines,readOnly:true,actionable:false}` |
| `shells.product(p?)` | product panel RENDER summary — `{ok,errors,title,lineCount,lines,footer,actionable:false,actionCount:0,readOnly:true}` |
| `shells.productPreview(p?,o?)` | LEAN-3 preview block — `{title,ok,seller,sellerFull,marketplace,badge,lines,readOnly:true,actionable:false,errors}` |
| `shells.leaderboard(s?,o?)` | ranked summary — `{mode,count,skipped,rows,signed:false,published:false}` |
| `shells.leaderboardPreview(s?,o?)` | LEAN-4 preview block — `{title,mode,modeLabel,badge,signed:false,published:false,signer,count,shown,skipped,proof,rows,lines,readOnly:true,actionable:false}` |
| `shells.updatePreview(r?,o?)` | LEAN-5 preview block — `{title,badge,status,statusLabel,currentVersion,latestVersion,updateAvailable,prompt,source,lines,readOnly:true,actionable:false}` |
| `shells.mvpLoop(o?)` | loop header block — `{title,badge,flow,note,version,steps,lines,readOnly:true,actionable:false}` |
| `shells.report(inputs?)` | composite of all of the above (each section overridable via `inputs`) |
| `shells.summary(inputs?)` | **v0.2.145** discoverability aggregate (see §4) |
| `shells.diff(a?,b?)` | **v0.2.146** pure diff of two `summary()` outputs, flagging invariant flips that loosen inertness (see §4.1) |

Other namespaces on `ToriiDebug`: `snapshot()` / `combat.report()` / `physics.report()`
(JSON-serialisable status), `bots`, `player`, `physics`, `world`, `identity`, `fx`.

---

## 4. `ToriiDebug.shells.summary()` — one-call overview (v0.2.145)

`shells.summary()` (pure `shellsSummary()` in `shellReport.js`) returns a compact,
JSON-serialisable map of the four proof surfaces framed by the loop. Every invariant
is **read from the live report output**, so the summary cannot claim an inertness the
underlying shell does not have. Shape:

```js
{
  version,            // === config VERSION
  flow,               // "Travel → Market → Score → Update"
  loop: { key:'mvpLoop', sdk, shell, title, flow, invariants:{readOnly,actionable} },
  surfaces: [         // 4 entries, in loop order
    { key, lean, step, sdk, shell, title, invariants:{ readOnly, actionable, signed?, published? } },
    ...
  ],
  count: 4,
  allInert,           // true iff no surface/loop is actionable and none claim signed/published
  network: false,     // false by construction across every proof surface
  autoUpdate: false,  // false by construction
}
```

`allInert` is the single boolean a reviewer (human or AI) can assert to confirm the
proof surfaces remain display-only. Every surface carries `readOnly` + `actionable`
(v0.2.146 symmetry); the leaderboard adds `signed` + `published`.

---

## 4.1. `ToriiDebug.shells.diff(a, b)` — promotion review helper (v0.2.146)

`shells.diff(a, b)` (pure `shellsDiff()` in `shellReport.js`) compares two
`summary()` outputs — `a` = before/preview, `b` = after/promoted — and classifies
each invariant flip so a preview→live promotion can be reviewed mechanically. It
performs NO network/actions/DOM/THREE; it only compares two already-computed
summaries. Shape:

```js
{
  changed,                 // any flip at all
  safe,                    // true iff NO flip loosens inertness
  fromVersion, toVersion,
  flips: [                 // every difference found
    { scope:'summary',  key, from, to, loosens },                 // allInert/network/autoUpdate
    { scope:'surface',  key, invariant, from, to, loosens },      // per-surface invariant
    { scope:'surface',  key, change:'added'|'removed', loosens:false },
  ],
  loosened,                // subset of flips where loosens===true — the review checklist
}
```

A flip **loosens** inertness when it moves an invariant to its unsafe value
(`actionable→true`, `readOnly→false`, `signed→true`, `published→true`,
`allInert→false`, `network→true`, `autoUpdate→true`). `safe===true` means the diff
only changed display/labels or *tightened* inertness — exactly the property a
reviewer wants before approving a promotion. Untracked keys never count as loosening.

---

## 5. Where the tests live

| Surface | Test file |
|---|---|
| SDK entrypoint (`SDK_SURFACE`, tiers, re-exports) | `tests/sdk.test.js` |
| `gatewayPreview` | `tests/gateway-preview.test.js` |
| `productPreview` | `tests/product-preview.test.js` |
| `leaderboardPreview` | `tests/leaderboard-preview.test.js` |
| `updatePreview` | `tests/update-preview.test.js` |
| `mvpLoop` | `tests/mvp-loop.test.js` |
| `ToriiDebug.shells.*` reports + `summary()` | `tests/shell-report.test.js` |
| underlying view/shell modules | `tests/gateway-portal.test.js`, `tests/product-panel-shell.test.js`, `tests/leaderboard-view.test.js`, `tests/update-check.test.js` |

Run all with `npm test` (Vitest, node env). `npm run check` separately guards the
scaffold + version markers statically.

---

## 6. How to add a new proof card (or promote preview → live)

### Add a new inert preview card (the safe, established pattern)

1. **Pure module** under `engine/<area>/<name>Preview.js` — export a `*Block(...)`
   formatter returning `{ label, value }` rows + a `*_BADGE` constant. Pin
   `actionable:false` (and `readOnly:true`; `signed:false`/`published:false` if it
   models a transmit). Import only pure deps (config + sibling pure modules) so it
   stays node-testable. **No** THREE/Rapier/DOM, fetch, navigation, or signing.
2. **SDK** — add `export * as <name>` in `src/sdk/index.js` and a `SDK_SURFACE`
   entry at the `EXPERIMENTAL` tier (`tests/sdk.test.js` validates it automatically).
3. **Debug report** — add a `<name>Report(...)` in `shellReport.js` (reads the
   block's pure output, re-pins the inert invariants), add it to `buildShellReport`,
   and surface `shells.<name>(...)` in `toriiDebug.js`. If it is a proof card, add it
   to the `surfaces[]` in `shellsSummary()` so `summary()` and `allInert` cover it.
4. **Render** — in `main.js`, write the rows into the card via `textContent` ONLY
   (no `innerHTML`); add the card markup + CSS in `index.html`.
5. **Test** — add `tests/<name>.test.js` asserting the inert invariants and that no
   live-action keys (`fetch`/`navigate`/`sign`/`publish`/`checkout`/`onClick`) leak.
6. **Docs** — update this index (§2/§3/§5), `CODE_INDEX.md`, `progress.md`, `todo.md`.
7. **Bump the version** and run `npm run build && npm run check && npm test`.

### Promote a preview to a live surface

A "live" surface performs a real side effect (a read-only GitHub fetch, NIP-07
signing, relay publish, in-world navigation). These are **deferred host steps** and
require explicit sign-off — they are NOT safe-slice work. When authorised:

- Keep the pure preview module inert; build the live action as a SEPARATE, guarded
  module (the preview stays the display layer).
- Network reads need a CSP `connect-src` entry and live in the host layer, not the
  pure helper (see `UPDATE_CHECK.md` §3, `VPS_INSTALL.md` §10).
- Signing/publish must go through an injected signer/publisher with explicit user
  confirmation (see `leaderboardPublisher`, SEC-1).
- Flip the relevant invariant deliberately and update `shellsSummary()` + its tests
  so `allInert` reflects reality. Never silently leave `allInert:true` claiming
  inertness a live path has removed.
- Use `shells.diff(before, after)` to review the promotion: its `loosened[]` list is
  the exact set of inertness-reducing flips that need sign-off. A promotion whose
  diff is `safe:true` did not actually loosen anything (likely a no-op or a labelling
  change); a real promotion should show the intended flips in `loosened[]` and
  nothing more.

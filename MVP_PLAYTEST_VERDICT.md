# Torii Quest — MVP Playtest Verdict

> MVP PLAYTEST VERDICT · LOCAL · READ-ONLY · TESTER VERDICT ≠ MVP APPROVAL

The **one-line** way to report the live-browser playtest. After playing
[the live build](https://torii-quest.pplx.app), fill in the **Verdict** line below
with exactly ONE of:

- `Verdict: MVP OK` — you found no blockers.
- `Verdict: blockers: <comma- or semicolon-separated list>` — e.g.
  `Verdict: blockers: headshots feel inconsistent; NAP monkey still chases past the gate`.

Reporting a verdict here is a **confidence signal only** — it does **NOT** approve
the MVP. Approval is the separate, explicit step recorded in `MVP_APPROVAL_STATE.json`
(status `approved` + `approved_by` + `approved_at`). Leave the Verdict line blank
until you have actually played the build; a blank file reads as `pending`.

Tooling: `node tools/playtest-verdict.mjs` (or `npm run playtest:verdict`) explains
the current state read-only — it never writes, deploys, publishes, or approves.

## Verdict

| Field | Value |
| --- | --- |
| Reported by |  |
| Date |  |
| Verdict |  |

## Optional notes per focus area

Use these only if you want to leave detail behind a blocker; the Verdict line above
is what the dashboard and next-action state read.

- Entry flow:
- Shooter feel:
- Hit registration / headshots:
- Bot behaviour:
- Movement / footsteps:
- Reload feel:
- Mirror / reflection:
- Crates:
- NAP monkey:
- Dashboard clarity:
- Subjective fun / feel:

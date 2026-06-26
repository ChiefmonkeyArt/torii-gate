# Torii Quest — v0.2.225-alpha slice report

## playtest:capture `--file=` path hardening

**Type:** tooling-only hardening · LOCAL · READ-ONLY · NOT AN APPROVAL
**Status:** committed locally only — parent agent handles security review / deploy / publish / push / upload.

---

### Why

The v0.2.224 security review SHIPPED with a single **non-blocking advisory**: the local
`npm run playtest:capture` CLI `--file=` path-traversal guard rejected literal absolute
paths and literal `..` segments, but did **not** decode percent-encoded separators
(`%2F`, `%5C`) or encoded traversal dots (`%2e%2e`). Node's `fs` never URL-decodes a
path, so an encoded separator can never be part of a legitimate in-repo filename and was
**not exploitable** in current local use — but the guard relied only on
`isAbsolute(raw) || normalize(raw).split(/[\\/]/).includes('..')`, so hardening it is cheap
and removes a sharp edge before any future call site decodes input.

### What changed

1. **`tools/playtestNoteCapture.mjs`** — added a pure, exported guard (the backing module
   is pure/node-safe: no fs/network/child_process/process/THREE/DOM, never throws, so the
   guard is directly unit-testable):

   ```js
   const ENCODED_SEP_RE = /%2[fF]|%5[cC]|%2[eE]/;

   export function safeRepoRelPath(raw) {
     if (typeof raw !== 'string' || raw === '') return { ok: false, reason: 'empty path' };
     if (ENCODED_SEP_RE.test(raw)) {
       return { ok: false, reason: 'percent-encoded path separators are not allowed' };
     }
     let decoded = raw;
     try { decoded = decodeURIComponent(raw); }
     catch { return { ok: false, reason: 'malformed percent-encoding' }; }
     for (const candidate of [raw, decoded]) {
       if (/^(?:[/\\]|[a-zA-Z]:)/.test(candidate)) return { ok: false, reason: 'absolute path is not allowed' };
       if (candidate.split(/[\\/]/).includes('..')) return { ok: false, reason: 'path traversal is not allowed' };
     }
     return { ok: true, rel: raw };
   }
   ```

   Layered defense: literal regex rejection of encoded separators/dots **plus** a
   `decodeURIComponent` re-check of both the raw and decoded forms (malformed `%`-escape →
   reject). Rejects empty/non-string input, absolute paths (POSIX `/`, Windows `\`, `X:`
   drive), and `..` traversal segments. Accepts plain in-repo filenames and safe sub-paths.

2. **`tools/playtest-capture.mjs`** — wired the CLI to the guard. Dropped the now-unused
   `isAbsolute`/`normalize` from the `node:path` import; imported `safeRepoRelPath`;
   rewrote `readTarget()`:

   ```js
   function readTarget(argv) {
     const arg = argv.find((a) => a.startsWith('--file='));
     if (!arg) return { rel: PLAYTEST_RESULTS_STATE_FILE };
     const raw = arg.slice('--file='.length);
     const guard = safeRepoRelPath(raw);
     return guard.ok ? { rel: guard.rel } : { rel: null, error: guard.reason };
   }
   ```

   The CLI remains **strictly read-only** (no `--write` at all — the no-clobber
   `MVP_PLAYTEST_RESULTS.md` stays structurally untouchable). A rejected `--file` path
   exits 2; otherwise exit 0.

3. **`tests/playtest-note-capture.test.js`** — added `safeRepoRelPath` to the import and
   appended a 5-case describe block: (1) accepts plain filenames + safe sub-paths;
   (2) rejects literal absolute (`/etc/passwd`, `C:\Windows\win.ini`) + `..` traversal;
   (3) rejects `%2F`/`%2f`/`%5C`/`%5c` separators (reason matches `/percent-encoded/`);
   (4) rejects `%2e%2e` traversal-dot variants; (5) rejects empty/null/undefined/number +
   malformed `foo%ZZbar`.

### Test / suite impact

- `tests/playtest-note-capture.test.js`: 11 → 16 tests (5 added to an existing file).
- Suite: **1482 → 1487 passing**, **files stays 90** (no new test file).
- `CURRENT_TEST_STATUS` (continuumData.js) and `DEFAULT_TEST_STATUS` (mvpReadiness.js)
  bumped to `passing: 1487` in lockstep.

### Follow-up note

`tools/playtest-results-status.mjs` carries the **same** `readTarget` guard and is **out of
scope** for this slice (the advisory named playtest-capture only). A future slice could
route it through the shared `safeRepoRelPath` to avoid divergence.

### Safety posture (held)

No gameplay/runtime/physics/shooter/Rapier change. No Nostr writes / network writes.
No tags/releases. `godMode` stays `false`. No new `setTimeout` outside the allowed files.
Comments use **nostrich**. **Status STAYS not-run/pending — no playtest results fabricated,
no MVP approval granted this slice.** Committed **locally only**.

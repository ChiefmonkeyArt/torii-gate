// tools/commitStamp.mjs — shared, PURE wording for the git commit stamped into the
// project's GENERATED artifacts (HANDOFF.generated.md, MVP_RELEASE_PACKAGE.md,
// MVP_PLAYTEST_CHECKLIST.md, RELEASE_NOTES_DRAFT.md, GITHUB_RELEASE_DRY_RUN.md, …).
//
// WHY this exists (v0.2.209): each of those files is written BEFORE the commit that
// will contain it. So the commit they carry is the repo HEAD AT GENERATION TIME — the
// PARENT of the file's own commit, never the file's own hash. Labelling it a bare
// "commit" misleads a reader (and security reviews repeatedly flag it as cosmetic but
// stale/misleading) into thinking it is the final, file-containing commit. These tiny
// helpers make that wording explicit and IDENTICAL across every generator so the
// distinction can't drift per-tool.
//
// node-safe + dependency-free: pure string helpers, no fs/git/network/DOM. The
// generators do the actual `git rev-parse`; this module only renders the already-read
// short-commit string into honest, non-misleading text.

// One-line note a generated artifact can include near its commit stamp.
export const SOURCE_COMMIT_NOTE =
  'commit shown is the source commit (repo HEAD at generation time); this file is '
  + 'generated before its own commit, so it does not carry that final hash';

// _clean(commit) → trimmed non-empty short-commit string, or '' for anything else.
function _clean(commit) {
  return (typeof commit === 'string' && commit.trim()) ? commit.trim() : '';
}

// sourceCommitLabel(commit) → the value for a dedicated "Source commit" field/line.
// e.g. "abc1234 (source commit at generation — precedes this file's own commit)".
// Null/garbled → "(unavailable)". Never throws.
export function sourceCommitLabel(commit) {
  const c = _clean(commit);
  return c ? `${c} (source commit at generation — precedes this file's own commit)` : '(unavailable)';
}

// sourceCommitInline(commit) → a compact " @ <hash> (source)" suffix for one-line
// version stamps (e.g. "version: v0.2.209-alpha @ abc1234 (source)"). Empty string
// when no commit is known, so callers can append it unconditionally. Never throws.
export function sourceCommitInline(commit) {
  const c = _clean(commit);
  return c ? ` @ ${c} (source)` : '';
}

# Torii Quest — Release Artifact Manifest

> RELEASE ARTIFACT MANIFEST · LOCAL · READ-ONLY
> generated: 2026-06-26T17:17:38.556Z

- **Status:** COMPLETE
- **Version:** v0.2.229-alpha @ 1fbe551 (source)
- **Package version:** 0.2.229-alpha
- **Live (manual deploy):** https://torii-quest.pplx.app
- **Coverage:** 6/6 required present · 6/6 optional present · 12 hashed

## Required artifacts

| Artifact | Label | Category | Present | sha256 | Bytes |
| --- | --- | --- | --- | --- | --- |
| `RELEASE_NOTES_DRAFT.md` | MVP release notes (DRAFT) | doc | present | `799dc9b7f042` | 2855 |
| `MVP_RELEASE_PACKAGE.md` | MVP release package index | doc | present | `29d730257611` | 2113 |
| `GITHUB_RELEASE_DRY_RUN.md` | GitHub release dry-run | doc | present | `4f40aac00759` | 2578 |
| `public/release-metadata.json` | Build / release metadata (served) | build-metadata | present | `9ff36e50cd75` | 1158 |
| `package.json` | Package manifest (version + scripts) | config | present | `5f9c68f04b72` | 2000 |
| `index.html` | App entry (version-stamped) | config | present | `22d407deb81f` | 39162 |

## Optional artifacts

| Artifact | Label | Category | Present | sha256 | Bytes |
| --- | --- | --- | --- | --- | --- |
| `MVP_RC_SNAPSHOT.md` | MVP RC freeze-candidate snapshot | doc | present | `c035168a3fa2` | 4117 |
| `MVP_PLAYTEST_CHECKLIST.md` | MVP playtest checklist | doc | present | `c6c48cbdd3fc` | 11004 |
| `MVP_PLAYTEST_RESULTS_TEMPLATE.md` | MVP playtest results template | doc | present | `1d935b55d46c` | 8581 |
| `HANDOFF.md` | Handoff narrative (source of truth) | doc | present | `332862057b12` | 122385 |
| `VPS_INSTALL.md` | VPS install / manual deploy notes | doc | present | `05127e4b7b25` | 22754 |
| `public/continuum-data.json` | Continuum dashboard data (served) | build-metadata | present | `9b0fdd40e94c` | 19409 |

## How this supports release integrity / self-update

- Each artifact carries a sha256 + byte size captured at generation time, so a future release/self-update step can verify the shipped copy matches what was committed (no silent drift).
- The REQUIRED list is the minimum set a GitHub release / VPS self-update must resolve; an INCOMPLETE verdict means a future release would be blocked until the missing artifact is restored.
- Checksums cover in-repo text docs + small served build-metadata JSON only — no secrets, no large binaries (the rapier chunk and other dist/ bundles are intentionally not hashed here).
- This manifest is a VISIBILITY artifact: it performs no release, no tag, no publish, no network self-update. The parent agent owns security review, deploy, publish, push, and Space upload.

## Recent reports

- `torii-v0.2.223-playtest-results-dashboard-report.md`
- `torii-v0.2.224-playtest-note-capture-report.md`
- `torii-v0.2.225-playtest-capture-path-hardening-report.md`
- `torii-v0.2.226-entry-flow-button-fix-report.md`
- `torii-v0.2.227-entry-flow-smoke-harness-report.md`
- `torii-v0.2.228-enter-arena-noop-fix-report.md`

---

_MANIFEST ONLY — this document creates no GitHub release, no git tag, no publish, no network self-update. Checksums cover in-repo text docs + small served build metadata only (no secrets, no large binaries). The parent agent owns security review, deploy, publish, push, and Space upload._

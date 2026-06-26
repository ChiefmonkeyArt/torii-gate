# Torii Quest — Release Artifact Manifest

> RELEASE ARTIFACT MANIFEST · LOCAL · READ-ONLY
> generated: 2026-06-26T03:27:09.364Z

- **Status:** COMPLETE
- **Version:** v0.2.212-alpha @ 89238e3 (source)
- **Package version:** 0.2.212-alpha
- **Live (manual deploy):** https://torii-quest.pplx.app
- **Coverage:** 6/6 required present · 6/6 optional present · 12 hashed

## Required artifacts

| Artifact | Label | Category | Present | sha256 | Bytes |
| --- | --- | --- | --- | --- | --- |
| `RELEASE_NOTES_DRAFT.md` | MVP release notes (DRAFT) | doc | present | `83ec12811a64` | 2855 |
| `MVP_RELEASE_PACKAGE.md` | MVP release package index | doc | present | `f51056c3dba4` | 2111 |
| `GITHUB_RELEASE_DRY_RUN.md` | GitHub release dry-run | doc | present | `d2d265715bb9` | 2578 |
| `public/release-metadata.json` | Build / release metadata (served) | build-metadata | present | `3950c9523e10` | 1158 |
| `package.json` | Package manifest (version + scripts) | config | present | `524bd2cbdf8f` | 1742 |
| `index.html` | App entry (version-stamped) | config | present | `0cdbaab111a3` | 37374 |

## Optional artifacts

| Artifact | Label | Category | Present | sha256 | Bytes |
| --- | --- | --- | --- | --- | --- |
| `MVP_RC_SNAPSHOT.md` | MVP RC freeze-candidate snapshot | doc | present | `8b204d2ad944` | 4115 |
| `MVP_PLAYTEST_CHECKLIST.md` | MVP playtest checklist | doc | present | `9814dd16665d` | 11004 |
| `MVP_PLAYTEST_RESULTS_TEMPLATE.md` | MVP playtest results template | doc | present | `9a006ecce82d` | 8581 |
| `HANDOFF.md` | Handoff narrative (source of truth) | doc | present | `2cc4d67be2b8` | 86039 |
| `VPS_INSTALL.md` | VPS install / manual deploy notes | doc | present | `05127e4b7b25` | 22754 |
| `public/continuum-data.json` | Continuum dashboard data (served) | build-metadata | present | `837fb2bdbb94` | 9915 |

## How this supports release integrity / self-update

- Each artifact carries a sha256 + byte size captured at generation time, so a future release/self-update step can verify the shipped copy matches what was committed (no silent drift).
- The REQUIRED list is the minimum set a GitHub release / VPS self-update must resolve; an INCOMPLETE verdict means a future release would be blocked until the missing artifact is restored.
- Checksums cover in-repo text docs + small served build-metadata JSON only — no secrets, no large binaries (the rapier chunk and other dist/ bundles are intentionally not hashed here).
- This manifest is a VISIBILITY artifact: it performs no release, no tag, no publish, no network self-update. The parent agent owns security review, deploy, publish, push, and Space upload.

## Recent reports

- `torii-v0.2.207-github-release-dry-run-report.md`
- `torii-v0.2.208-progress-parser-cleanup-report.md`
- `torii-v0.2.209-generated-commit-stamp-clarity-report.md`
- `torii-v0.2.210-mvp-rc-snapshot-report.md`
- `torii-v0.2.211-release-artifact-manifest-report.md`
- `torii-v0.2.212-release-manifest-shellless-report.md`

---

_MANIFEST ONLY — this document creates no GitHub release, no git tag, no publish, no network self-update. Checksums cover in-repo text docs + small served build metadata only (no secrets, no large binaries). The parent agent owns security review, deploy, publish, push, and Space upload._

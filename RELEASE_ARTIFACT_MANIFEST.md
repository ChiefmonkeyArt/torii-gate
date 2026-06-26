# Torii Quest — Release Artifact Manifest

> RELEASE ARTIFACT MANIFEST · LOCAL · READ-ONLY
> generated: 2026-06-26T10:58:04.492Z

- **Status:** COMPLETE
- **Version:** v0.2.226-alpha @ 26e91b5 (source)
- **Package version:** 0.2.226-alpha
- **Live (manual deploy):** https://torii-quest.pplx.app
- **Coverage:** 6/6 required present · 6/6 optional present · 12 hashed

## Required artifacts

| Artifact | Label | Category | Present | sha256 | Bytes |
| --- | --- | --- | --- | --- | --- |
| `RELEASE_NOTES_DRAFT.md` | MVP release notes (DRAFT) | doc | present | `8981d824151c` | 2860 |
| `MVP_RELEASE_PACKAGE.md` | MVP release package index | doc | present | `4cfe0f01f5c4` | 2111 |
| `GITHUB_RELEASE_DRY_RUN.md` | GitHub release dry-run | doc | present | `d1525f9812d6` | 2578 |
| `public/release-metadata.json` | Build / release metadata (served) | build-metadata | present | `2b7cd906ca05` | 1158 |
| `package.json` | Package manifest (version + scripts) | config | present | `b437d455f605` | 2000 |
| `index.html` | App entry (version-stamped) | config | present | `2e669847b478` | 38082 |

## Optional artifacts

| Artifact | Label | Category | Present | sha256 | Bytes |
| --- | --- | --- | --- | --- | --- |
| `MVP_RC_SNAPSHOT.md` | MVP RC freeze-candidate snapshot | doc | present | `0ce80a4eaed5` | 4131 |
| `MVP_PLAYTEST_CHECKLIST.md` | MVP playtest checklist | doc | present | `aa3a4e5e702e` | 11004 |
| `MVP_PLAYTEST_RESULTS_TEMPLATE.md` | MVP playtest results template | doc | present | `1d935b55d46c` | 8581 |
| `HANDOFF.md` | Handoff narrative (source of truth) | doc | present | `c1a5a2aaa69c` | 113872 |
| `VPS_INSTALL.md` | VPS install / manual deploy notes | doc | present | `05127e4b7b25` | 22754 |
| `public/continuum-data.json` | Continuum dashboard data (served) | build-metadata | present | `0a7e13b047c3` | 19532 |

## How this supports release integrity / self-update

- Each artifact carries a sha256 + byte size captured at generation time, so a future release/self-update step can verify the shipped copy matches what was committed (no silent drift).
- The REQUIRED list is the minimum set a GitHub release / VPS self-update must resolve; an INCOMPLETE verdict means a future release would be blocked until the missing artifact is restored.
- Checksums cover in-repo text docs + small served build-metadata JSON only — no secrets, no large binaries (the rapier chunk and other dist/ bundles are intentionally not hashed here).
- This manifest is a VISIBILITY artifact: it performs no release, no tag, no publish, no network self-update. The parent agent owns security review, deploy, publish, push, and Space upload.

## Recent reports

- `torii-v0.2.220-mvp-approval-state-report.md`
- `torii-v0.2.221-mvp-approval-dashboard-report.md`
- `torii-v0.2.222-playtest-results-intake-report.md`
- `torii-v0.2.223-playtest-results-dashboard-report.md`
- `torii-v0.2.224-playtest-note-capture-report.md`
- `torii-v0.2.225-playtest-capture-path-hardening-report.md`

---

_MANIFEST ONLY — this document creates no GitHub release, no git tag, no publish, no network self-update. Checksums cover in-repo text docs + small served build metadata only (no secrets, no large binaries). The parent agent owns security review, deploy, publish, push, and Space upload._

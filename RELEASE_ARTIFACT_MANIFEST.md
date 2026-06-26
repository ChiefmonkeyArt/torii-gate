# Torii Quest — Release Artifact Manifest

> RELEASE ARTIFACT MANIFEST · LOCAL · READ-ONLY
> generated: 2026-06-26T09:53:24.690Z

- **Status:** COMPLETE
- **Version:** v0.2.223-alpha @ 4dfe4c7 (source)
- **Package version:** 0.2.223-alpha
- **Live (manual deploy):** https://torii-quest.pplx.app
- **Coverage:** 6/6 required present · 6/6 optional present · 12 hashed

## Required artifacts

| Artifact | Label | Category | Present | sha256 | Bytes |
| --- | --- | --- | --- | --- | --- |
| `RELEASE_NOTES_DRAFT.md` | MVP release notes (DRAFT) | doc | present | `90c25dfa7442` | 2848 |
| `MVP_RELEASE_PACKAGE.md` | MVP release package index | doc | present | `8b835f7d573b` | 2102 |
| `GITHUB_RELEASE_DRY_RUN.md` | GitHub release dry-run | doc | present | `0eaa6fcd858b` | 2578 |
| `public/release-metadata.json` | Build / release metadata (served) | build-metadata | present | `cab2f7fcb7ba` | 1158 |
| `package.json` | Package manifest (version + scripts) | config | present | `a4d2a93cd341` | 1941 |
| `index.html` | App entry (version-stamped) | config | present | `ac1fc94717a0` | 37374 |

## Optional artifacts

| Artifact | Label | Category | Present | sha256 | Bytes |
| --- | --- | --- | --- | --- | --- |
| `MVP_RC_SNAPSHOT.md` | MVP RC freeze-candidate snapshot | doc | present | `cd525e86fc98` | 4106 |
| `MVP_PLAYTEST_CHECKLIST.md` | MVP playtest checklist | doc | present | `c02c80375667` | 11004 |
| `MVP_PLAYTEST_RESULTS_TEMPLATE.md` | MVP playtest results template | doc | present | `2a86b660a254` | 8581 |
| `HANDOFF.md` | Handoff narrative (source of truth) | doc | present | `6d4b7376fb59` | 109867 |
| `VPS_INSTALL.md` | VPS install / manual deploy notes | doc | present | `05127e4b7b25` | 22754 |
| `public/continuum-data.json` | Continuum dashboard data (served) | build-metadata | present | `6addf0c42730` | 19409 |

## How this supports release integrity / self-update

- Each artifact carries a sha256 + byte size captured at generation time, so a future release/self-update step can verify the shipped copy matches what was committed (no silent drift).
- The REQUIRED list is the minimum set a GitHub release / VPS self-update must resolve; an INCOMPLETE verdict means a future release would be blocked until the missing artifact is restored.
- Checksums cover in-repo text docs + small served build-metadata JSON only — no secrets, no large binaries (the rapier chunk and other dist/ bundles are intentionally not hashed here).
- This manifest is a VISIBILITY artifact: it performs no release, no tag, no publish, no network self-update. The parent agent owns security review, deploy, publish, push, and Space upload.

## Recent reports

- `torii-v0.2.218-package-private-report.md`
- `torii-v0.2.219-service-worker-cache-hygiene-report.md`
- `torii-v0.2.220-mvp-approval-state-report.md`
- `torii-v0.2.221-mvp-approval-dashboard-report.md`
- `torii-v0.2.222-playtest-results-intake-report.md`
- `torii-v0.2.223-playtest-results-dashboard-report.md`

---

_MANIFEST ONLY — this document creates no GitHub release, no git tag, no publish, no network self-update. Checksums cover in-repo text docs + small served build metadata only (no secrets, no large binaries). The parent agent owns security review, deploy, publish, push, and Space upload._

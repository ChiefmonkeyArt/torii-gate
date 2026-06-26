# Torii Quest — Release Artifact Manifest

> RELEASE ARTIFACT MANIFEST · LOCAL · READ-ONLY
> generated: 2026-06-26T08:30:50.241Z

- **Status:** COMPLETE
- **Version:** v0.2.220-alpha @ b30ff70 (source)
- **Package version:** 0.2.220-alpha
- **Live (manual deploy):** https://torii-quest.pplx.app
- **Coverage:** 6/6 required present · 6/6 optional present · 12 hashed

## Required artifacts

| Artifact | Label | Category | Present | sha256 | Bytes |
| --- | --- | --- | --- | --- | --- |
| `RELEASE_NOTES_DRAFT.md` | MVP release notes (DRAFT) | doc | present | `a28e71f0cfda` | 2837 |
| `MVP_RELEASE_PACKAGE.md` | MVP release package index | doc | present | `391750bf1d14` | 2101 |
| `GITHUB_RELEASE_DRY_RUN.md` | GitHub release dry-run | doc | present | `c5233e699ca3` | 2578 |
| `public/release-metadata.json` | Build / release metadata (served) | build-metadata | present | `0ce7efec5663` | 1158 |
| `package.json` | Package manifest (version + scripts) | config | present | `09c7b842af3a` | 1876 |
| `index.html` | App entry (version-stamped) | config | present | `147c8bbeb57a` | 37374 |

## Optional artifacts

| Artifact | Label | Category | Present | sha256 | Bytes |
| --- | --- | --- | --- | --- | --- |
| `MVP_RC_SNAPSHOT.md` | MVP RC freeze-candidate snapshot | doc | present | `34556fe04c56` | 4105 |
| `MVP_PLAYTEST_CHECKLIST.md` | MVP playtest checklist | doc | present | `4d0362ff1a70` | 11004 |
| `MVP_PLAYTEST_RESULTS_TEMPLATE.md` | MVP playtest results template | doc | present | `9be3e8a86a80` | 8581 |
| `HANDOFF.md` | Handoff narrative (source of truth) | doc | present | `cecaf1fd63d3` | 103318 |
| `VPS_INSTALL.md` | VPS install / manual deploy notes | doc | present | `05127e4b7b25` | 22754 |
| `public/continuum-data.json` | Continuum dashboard data (served) | build-metadata | present | `253127ccd5bc` | 16185 |

## How this supports release integrity / self-update

- Each artifact carries a sha256 + byte size captured at generation time, so a future release/self-update step can verify the shipped copy matches what was committed (no silent drift).
- The REQUIRED list is the minimum set a GitHub release / VPS self-update must resolve; an INCOMPLETE verdict means a future release would be blocked until the missing artifact is restored.
- Checksums cover in-repo text docs + small served build-metadata JSON only — no secrets, no large binaries (the rapier chunk and other dist/ bundles are intentionally not hashed here).
- This manifest is a VISIBILITY artifact: it performs no release, no tag, no publish, no network self-update. The parent agent owns security review, deploy, publish, push, and Space upload.

## Recent reports

- `torii-v0.2.215-manual-validation-dashboard-report.md`
- `torii-v0.2.216-no-blocker-queue-dashboard-report.md`
- `torii-v0.2.217-next-action-state-report.md`
- `torii-v0.2.218-package-private-report.md`
- `torii-v0.2.219-service-worker-cache-hygiene-report.md`
- `torii-v0.2.220-mvp-approval-state-report.md`

---

_MANIFEST ONLY — this document creates no GitHub release, no git tag, no publish, no network self-update. Checksums cover in-repo text docs + small served build metadata only (no secrets, no large binaries). The parent agent owns security review, deploy, publish, push, and Space upload._

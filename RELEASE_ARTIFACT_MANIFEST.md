# Torii Quest — Release Artifact Manifest

> RELEASE ARTIFACT MANIFEST · LOCAL · READ-ONLY
> generated: 2026-06-26T03:10:55.252Z

- **Status:** COMPLETE
- **Version:** v0.2.211-alpha @ 47e5b18 (source)
- **Package version:** 0.2.211-alpha
- **Live (manual deploy):** https://torii-quest.pplx.app
- **Coverage:** 6/6 required present · 6/6 optional present · 12 hashed

## Required artifacts

| Artifact | Label | Category | Present | sha256 | Bytes |
| --- | --- | --- | --- | --- | --- |
| `RELEASE_NOTES_DRAFT.md` | MVP release notes (DRAFT) | doc | present | `1c913a592b4a` | 2852 |
| `MVP_RELEASE_PACKAGE.md` | MVP release package index | doc | present | `51eb3da10c53` | 2104 |
| `GITHUB_RELEASE_DRY_RUN.md` | GitHub release dry-run | doc | present | `8d8b6ab69d35` | 2578 |
| `public/release-metadata.json` | Build / release metadata (served) | build-metadata | present | `0da5f172b6e8` | 1158 |
| `package.json` | Package manifest (version + scripts) | config | present | `bd13b185d6ca` | 1742 |
| `index.html` | App entry (version-stamped) | config | present | `a81f57763fad` | 37374 |

## Optional artifacts

| Artifact | Label | Category | Present | sha256 | Bytes |
| --- | --- | --- | --- | --- | --- |
| `MVP_RC_SNAPSHOT.md` | MVP RC freeze-candidate snapshot | doc | present | `c6ce1ff3b805` | 4108 |
| `MVP_PLAYTEST_CHECKLIST.md` | MVP playtest checklist | doc | present | `cf1450524df2` | 11004 |
| `MVP_PLAYTEST_RESULTS_TEMPLATE.md` | MVP playtest results template | doc | present | `b268dc547b42` | 8581 |
| `HANDOFF.md` | Handoff narrative (source of truth) | doc | present | `831af7767448` | 84620 |
| `VPS_INSTALL.md` | VPS install / manual deploy notes | doc | present | `05127e4b7b25` | 22754 |
| `public/continuum-data.json` | Continuum dashboard data (served) | build-metadata | present | `7e677a2141e0` | 9915 |

## How this supports release integrity / self-update

- Each artifact carries a sha256 + byte size captured at generation time, so a future release/self-update step can verify the shipped copy matches what was committed (no silent drift).
- The REQUIRED list is the minimum set a GitHub release / VPS self-update must resolve; an INCOMPLETE verdict means a future release would be blocked until the missing artifact is restored.
- Checksums cover in-repo text docs + small served build-metadata JSON only — no secrets, no large binaries (the rapier chunk and other dist/ bundles are intentionally not hashed here).
- This manifest is a VISIBILITY artifact: it performs no release, no tag, no publish, no network self-update. The parent agent owns security review, deploy, publish, push, and Space upload.

## Recent reports

- `torii-v0.2.206-mvp-release-package-report.md`
- `torii-v0.2.207-github-release-dry-run-report.md`
- `torii-v0.2.208-progress-parser-cleanup-report.md`
- `torii-v0.2.209-generated-commit-stamp-clarity-report.md`
- `torii-v0.2.210-mvp-rc-snapshot-report.md`
- `torii-v0.2.211-release-artifact-manifest-report.md`

---

_MANIFEST ONLY — this document creates no GitHub release, no git tag, no publish, no network self-update. Checksums cover in-repo text docs + small served build metadata only (no secrets, no large binaries). The parent agent owns security review, deploy, publish, push, and Space upload._

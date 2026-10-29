# PR title

Prepare Dombi V1 release with production deployment hold and cutover runbook

# PR body

Promoting the approved V1 staging release through the existing workflow would reset the
active production runtime and run migrations on its OLD database. This candidate retains
both main/develop histories, preserves application source from approved staging SHA
`9f82f3338d5c619b99e50448ad2d8ad3ca480c16`, and replaces production deployment with quality
checks and a SHA-bound asset artifact. It cannot connect to production or perform cutover.

The runbook requires independent effective DB/user verification and all-writer pause
before any future runtime mutation, plus owner approval, restore proof, opening-data
reconciliation, handling for 2 needs_review attempts / 1 unpaid settlement, callback
continuity, and explicit rollback versus roll-forward boundaries.

Validation: build, PHP lint, frontend lint/format/typecheck, 261 frontend tests, 25 focused
PHP tests, YAML structure/shell checks, application-tree comparison and diff whitespace
checks passed locally. Full hosted MySQL/concurrency CI and artifact upload are pending.
Local PHP/Node versions differ from CI; final PR head must pass hosted checks.

Main-only PR #29 merge has the same tree as merge-base; no unique file change is discarded.
No production migration, runtime/config switch, live transaction or business data write
was performed. NEW-user credential rotation via hPanel and secure private storage
verification completed separately; no credentials are included here.

DRAFT / DO NOT MERGE. Remote main still auto-deploys until separately protected/promoted;
prevent old deployment runs/reruns before a future approved merge. Approval of this PR
preparation is not Go-Live approval. Manual Retry DOKU Sandbox HTTP 400 remains the
accepted V1 known issue. Dependency advisory triage and the runbook prerequisites remain
explicit Go-Live decisions. See `docs/release/V1-PRODUCTION-PREPARATION-20261023.md`.

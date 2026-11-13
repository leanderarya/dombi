# Dombi CI/CD contract

Status: **production execution disabled; no server changes authorized by this work**.
These workflows apply to future commits through `develop`, not the separately accepted
RC `76ca5ca209c8fee2a500194c4ea6d9894ef2d051`. Do not rebuild or replace that RC's
pinned artifact, recovery tools, backups, runbook or worktree with this pipeline.

## Pipeline

1. `tests.yml`: PRs and pushes to `develop`/`main` run Composer validation/install/platform
   checks, locked npm install, artifact/provenance/health tests, PHP Unit and five focused
   payment/authorization/concurrency Feature files (sequential MySQL 8 + pcntl), all
   frontend tests, and the production Vite build. Node is pinned to 22.22.2, PHP to 8.3.
   This is a focused regression gate, not a claim of full Feature, lint or typecheck coverage.
2. Only successful `develop` push CI publishes `release-<full SHA>`. One runtime tarball
   contains tracked application code/views/migrations/public files, freshly installed
   `--no-dev` Composer dependencies, and that run's built assets. A file inventory binds
   SHA and every file hash; `release.sha256` binds the tarball. No environment secrets,
   `.env`, storage/uploads/sessions, bootstrap caches, Git metadata, recovery scripts,
   `node_modules`, `public/hot`, or historical `public/build.zip` are shipped.
   The npm lockfile is canonical for CI, matching the existing workflows; the separate
   pnpm lockfile is neither rewritten nor used as an alternative dependency resolution.
3. Artifacts are immutable (`overwrite: false`), retained 90 days. Same-SHA CI runs
   retain an existing unexpired artifact instead of replacing it. Per-SHA concurrency
   serializes publication. Expired/deleted artifacts cannot be promoted; retain release
   evidence externally under existing backup policy before expiry. Artifacts are not
   permanent release storage or a substitute for backups. Never recreate an expired
   release under an old acceptance receipt: promotion also binds the artifact ID.
4. `deploy-staging.yml`: after trusted successful `develop` push CI, or manual selection
   of such a run, resolve exactly one unexpired artifact and validate its origin.
   PR/fork/failed/non-CI runs are rejected. No server-side Composer/npm install, Git
   reset or separate asset build. The existing appleboy password SSH/SCP transport is
   retained with mandatory pinned SSH fingerprint. Deployment is opt-in and serialized,
   never cancelled by a newer deployment. GitHub concurrency may supersede pending runs;
   it is not a FIFO queue. Deploy the desired CI run manually when necessary.
5. Staging preflight binds the fixed resolved staging root, effective `APP_ENV`, URL and
   expected database. It refuses existing maintenance, busy locks, unwritable runtime
   directories, unsafe links in managed destinations and unsafe archive contents.
   A private run-owned before-code archive is made before maintenance/mutation. Only
   application code, vendor, views, migrations and `public/build` are synchronized with
   scoped deletion. Other public files are overlaid without deletion. `.git`, `.env`,
   storage and database files are never synchronized, reset, seeded or restored.
6. Existing writable directories must already have correct hosting ownership/permissions.
   No `chmod -R`, 777, chown, cache-data deletion or storage-link replacement. New release
   files are 0644, directories 0755; only the run-owned transfer directory is set 0700,
   and its code backup is 0600. Generated Laravel discovery/config/route/view caches are
   refreshed, not application cache data. Symlinked/shared code layouts require review,
   not bypassing the rejection. The server `.git` index is intentionally not moved and
   is not the deployed-identity source; retain artifact/receipt identity instead.
7. Staging deployment is code-only: no migration, seeder, payment or refund command is
   invoked. Schema compatibility with the selected artifact must be established before
   activation; this workflow cannot repair an incompatible schema. Post-copy CLI failures
   leave maintenance held. No automatic `up` trap or rollback is added. After successful
   cache/discovery refresh, staging is brought up for HTTP acceptance. JSON `/up` must
   return unredirected 2xx with `status: up`; every built asset and manifest must match
   its SHA-256. The HTTP probe allows only `/up` and static `/build/` asset paths.
   `/api/health` is excluded because it writes cache/storage. `/`, `/login` and business
   pages are excluded because their web middleware may persist sessions even for GETs.
   No cookies, login, authenticated routes or application-session configuration changes
   are used. The installed health route must remain outside session middleware with no
   write-producing health listeners; verify that contract before activation. Database,
   cache, storage, scheduler, page rendering and business health are not proved by these
   probes. A health failure after `up` does not automatically close staging again;
   investigate before accepting/retrying. No production probe is performed. HTTP health
   and disk hashes do not prove complete PHP worker-pool adoption.
8. Only complete success issues `staging-acceptance-<run>-<attempt>` binding CI run,
   release artifact ID/origin run, full SHA and tarball checksum. The existing receipt
   status `staging-health-and-assets-passed` now means JSON liveness and static-asset
   acceptance only, not dependency/page/business acceptance. Run summary states that
   scope explicitly and is secret-free.

## Required GitHub configuration

- Merge the workflows/scripts through normal review. The current checkout has unrelated
  dirty work; it is not an approved release. Workflows are not remotely installed by
  editing local files. No commit/push or GitHub setting was performed for this task.
- Protect `develop` and `main`; require `Quality Gate / quality`, review workflow/script
  changes, and restrict who may dispatch workflows or change environment configuration.
  `workflow_run` uses the default branch workflow; keep that trusted branch current
  (the local origin HEAD currently points to `develop`).
- Create **staging** and **production** GitHub environments. Limit staging to the trusted
  workflow refs (develop/default branch); limit production to `main` and require the
  authorized release-owner approval under applicable policy. Enable prevention of
  protection-rule bypass where supported. Do not fabricate an independent approver.
- Staging environment secrets: `HOSTINGER_SSH_HOST`, `HOSTINGER_SSH_USER`,
  `HOSTINGER_SSH_PASSWORD`, `HOSTINGER_SSH_PORT`, `HOSTINGER_SSH_FINGERPRINT`.
  Obtain the host fingerprint from an independently trusted inventory, not a fresh
  unauthenticated scan. Keep production credentials out of staging and repository-wide
  secret scope. The shared Hostinger account may still technically reach production;
  GitHub environment scoping is not operating-system isolation.
- Reuse staging environment secret `STAGING_DATABASE_NAME`: the independently verified staging
  schema name (not production). Confirm the effective host/schema/user isolation, PHP
  extensions, Python >=3.9, rsync, flock, tar, sha256sum, writable existing Laravel runtime
  directories, Linux realpath/stat and private transfer-path ownership/free space before
  enabling deployment. No server repair/install is done.
  The private transfer parent must be operator-owned, real and 0700; a missing parent
  is created privately only by a future authorized staging run. An unexpected existing
  parent is rejected, not repaired. Each run/attempt directory is created exclusively
  before SCP, so transfer cannot silently reuse an earlier deployment directory.
- Repository variable `STAGING_DEPLOY_ENABLED`: absent/false initially. Set `true` only
  after an authorized staging readiness review; this may enable future auto-staging.
  No GitHub configuration was changed here. DOKU/OAuth/APP secrets stay in the existing
  server `.env`, never injected into a build. Any intentional public `VITE_*` values
  must be environment-neutral for exact-artifact promotion; do not embed staging hosts
  or secrets in assets.
- Production secrets, if configured, belong only in the protected production environment.
  The new production preflight does not read them. No enable-production variable exists.

## Manual production preparation and recovery integration

`deploy.yml` has **only workflow_dispatch**, main-only execution, protected production
environment and non-cancelling `deploy-production` concurrency. Inputs are the accepted
staging run and attempt. It verifies that successful run's provenance, receipt, original
successful CI, exact artifact ID, full SHA, inventory and accepted checksum, without a
rebuild or any SSH step. The accepted commit must be an ancestor of the frozen main
checkout executing the workflow, not an unmerged develop-only candidate. It then
**always exits 1 at a hard-coded NO-GO gate**. A successful
artifact check must not be reported as successful production deployment. A variable,
secret, approval or dispatch input cannot enable production writes.

Future production execution needs a separate reviewed change and explicit authorization.
There is deliberately no generic SSH production adapter waiting behind a toggle: the
existing accepted RC uses a different pinned code-only overlay and guarded filesystem
recovery contract. Passing a new generic tarball to that recovery tool would violate
its bindings. Do not repin, auto-generate approval, run recovery or reopen by cleanup.

Required production-only gates, still **unverified/NO-GO**:

1. Freeze the actual candidate and applicable deployment/recovery contract. Record
   matching CI, staging health/assets, business/Owner acceptance, known-good artifact,
   schema/code compatibility, and exact rollback plan. Existing RC evidence remains
   valid only for its pinned RC and scope, not this pipeline's future artifacts.
2. Verify current host/account/root, effective configuration/DB/storage identity and
   approved authority/external-policy requirements. The separately provisioned single-owner
   candidate does not waive external review or manufacture recovery assertions.
   Require production environment/URL, debug off, live DOKU (`sandbox=false`), disabled
   legacy writes, OAuth and explicit migration preflight for that frozen candidate.
   The existing `preflight-production.yml` is a manual diagnostic: it tolerates errors
   and does not enforce its printed failures. It is not a passing execution gate.
3. Establish provider-supported **production-only** admission control, active HTTP/request
   drain, scheduler/CLI/queue writer inventory and actual stop/drain proof. GitHub
   concurrency protects only these workflows, not other publishers or runtime writers.
4. Prove safe DOKU callback hold/durable intake or merchant-confirmed retry/reconciliation
   coverage, including late invoices/events. Maintenance 503 and quiet queues are not proof.
5. Obtain Hostinger-supported isolated web-worker/OPcache control and account for all
   serving workers adopting both deployment and rollback. CLI OPcache reset, sleeps,
   a static release marker or sampled HTTP success do not establish worker adoption.
   GitHub Actions cannot solve this hosting isolation limitation.
6. Verify the final consistent DB/uploads checkpoint, applicable backup policy, encryption/
   keys, pinned code inventory and isolated restore proof/RPO/RTO. Do not infer this from
   a backup listing or historical waiver; never restore staging over production.
7. Integrate the selected rollback under its unchanged guards and fresh complete damaged-
   state/effective-identity inspection, locks, archive hashes, schema compatibility and
   genuine required approval. For the RC, use its existing worktree runbook section 8
   and the existing local `scripts/recovery/README.md` contract (not included in this
   workflow-only publication); no automatic recovery, data
   restore, `migration:rollback`, or unconditional reopening is wired here.
8. After filesystem and complete worker adoption, perform the applicable scoped runtime/
   Owner acceptance and reconciliation; authorize reopening separately with numeric
   limits, rollback reserve, monitoring coverage and a named operator. Do not introduce
   a new payment canary into the accepted RC's view-only acceptance scope.

For a failed staging deployment, preserve the run-owned transfer, before-code checksum,
maintenance state and failure output. The before-code archive is not a DB backup. No
schema rollback is performed; schema compatibility remains required before separately
authorizing any code restore. Existing production recovery scripts are never a staging
rollback tool.

## Previously approved artifact compatibility

The code-only deployment adapter can consume the existing schema-1 release format;
artifact selection and archive/inventory verification are unchanged. The selected
candidate remains artifact `14015610232`, from successful `develop` push CI
`43377554794`, commit `4ebe5e1da608b0c7404e2667cb99742747db4796`, with
`release.tar.gz` SHA-256
`5b5a54453badc86134e890cb4f5448a80dce1fc1b391eec03ec41284988225d5`.
It was generated by the earlier Quality Gate, not by this revised deployment workflow.
The deployment workflow uses reviewed helpers from `develop` to verify and install
that selected older artifact, without rebuilding it. Merge of the code-only change,
fresh preflight of schema/recovery/persistent paths and a separate controlled deployment
authorization are still required. This PR does not activate the gate or prove a live
deployment, database compatibility or business acceptance.

## Verification scope

See the task's verification receipt for measured commands/results. Local synthetic
artifact/provenance/health tests and workflow validation do not prove a GitHub-hosted
run, staging readiness, current production safety controls or authorized execution.
No server, secrets, backup, existing worktree or production configuration is modified.
The legacy `scripts/deploy.sh` is not called: its recursive permission change and
unconditional reopening are not part of this deployment contract. Existing manual
diagnostic/payment-operations workflows are unchanged and are not deployment approval.

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
4. `deploy-staging.yml` is **manual-only** and pinned to the V1.0 candidate:
   SHA `dbfe218de8cc3ae49796524007e214ec8dfe464a`, Quality Gate run `43720516972`,
   artifact `14164321503`, archive SHA-256
   `16f7aa17486f7264da7e8d25110eb5dad8358ff1e42c2352f91e6ba329ed8f8b`. The required
   run input and GitHub artifact metadata must match all four pins. The workflow checks
   repository, owner, `develop` ref, workflow path, and equality of workflow/source SHA,
   then checks out that exact workflow revision. There is no `workflow_run`, automatic
   trigger, or `STAGING_DEPLOY_ENABLED` switch. Only attempt 1 can execute; reruns are
   rejected.

   Before preparing a transfer, an atomic `mkdir` claims a persistent release-specific
   guard under the owner-only `$HOME/dombi-ci-staging` directory. The helper fsyncs the
   parent entry, claim receipt, and guard directory before returning success. The claim
   binds the exact repository, owner, workflow/ref revision, CI run, artifact ID, archive
   digest, and deployment run/attempt. Deploy and rollback never remove it. Duplicate
   dispatches, concurrent runs, and later runs for the same candidate fail closed;
   workflow concurrency is additional serialization, not the one-use control. A claim
   remains spent if transfer or deployment is interrupted.

   The GitHub `staging` environment has branch policy but no required reviewer. This
    workflow implements the selected single-owner exception instead of implying
    independent review. It must be on the default branch and run against `develop`;
    publication still requires the owner's separate approval and normal PR integration,
    not a direct push. PR/fork/failed/non-CI runs and alternate artifacts are rejected.
   No server-side Composer/npm install, Git reset or separate asset build. Deployment and
   rollback use `staging_deploy_transport.py`;
   the byte-pinned transport revision used by the existing read-only diagnostic remains
   unchanged. OpenSSH password-only SSH/SCP transport validates the scanned ED25519 key
   against the existing fingerprint before constructing temporary, endpoint-scoped
   `known_hosts`. Every SSH/SCP connection forces `HostKeyAlgorithms=ssh-ed25519`,
   `StrictHostKeyChecking=yes` and `UpdateHostKeys=no`, with user/global SSH configuration
   and agent/interactive-key fallback excluded. The existing owner-approved TOFU pin is
   retained; no independent provider verification or new trust anchor is implied.
   Multiple distinct ED25519 candidates, wrong endpoints, invalid secrets and fingerprint
   mismatches fail closed before authenticated transport. Only validated DNS/IPv4 host
   strings and canonical numeric ports are supported; IPv6, embedded ports, multi-host
   lists and proxy configuration are not supported. SCP uses OpenSSH's SFTP transfer
   mode with no automatic legacy fallback. Unsupported server capabilities fail the run
   rather than weakening verification. No raw SSH/SCP output, credentials or
   database-secret values are printed; remote failures require inspection of the preserved
   private transfer and maintenance state. Temporary runner trust files are removed on
   both success and failure. Dispatches are serialized and never cancelled by a newer
   deployment. GitHub concurrency may supersede pending runs; it is not a FIFO queue.
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
   leave maintenance held. After cache/discovery refresh, acceptance checks exact JSON
   `{"status":"up"}` with no redirect, and every built asset and manifest SHA-256. The
   HTTP probe allows only `/up` and static `/build/` asset paths. `/api/health` is excluded
   because it writes cache/storage. `/`, `/login` and business pages are excluded because
   their web middleware may persist sessions even for GETs. No cookies, login,
   authenticated routes or application-session configuration changes are used.
8. Before HTTP acceptance, `check-staging-readiness.py` uses a pinned SSH host key,
   confirms staging environment/database identity, executes only a read-only
   `SELECT DATABASE(), CURRENT_USER()` with multi-statements disabled, and checks the
   existing storage directories and `public/storage` link without writing. The acceptance
   receipt records route-source file names and hashes from the verified release manifest.
   This is not a live `route:list` or route-registration assertion; runtime route
   registration, middleware, sessions, worker adoption, scheduler, page rendering and
   business health remain unproved. No DOKU/payment request or production probe is
   performed. HTTP health and disk hashes do not prove complete PHP worker-pool adoption.
9. `rollback-staging.yml` is a separate manual, owner-only, staging-environment-gated
   action. It accepts only the run ID and attempt of an exact failed, cancelled, or
   timed-out V1.0 deployment run, is itself attempt-1 only, and verifies that run's bound
   deployment-target receipt and persistent one-use claim before using its private
   before-code archive. Rollback reads the spent claim but never creates, clears, or
   bypasses it. It is the separately authorized attempt-bound recovery path; successful
   rollback does not permit redeploying that candidate. The executor validates its
   checksum and archive paths, extracts to
   a fresh private directory, restores only code, rebuilds package discovery, clears
   config/route/view caches, verifies read-only database identity and restored asset hashes,
   then temporarily opens staging for JSON `/up` and static asset probes. Failed acceptance
   attempts to restore maintenance. A completion marker blocks a second successful rollback
   for the same transfer. `.env`, uploads/storage data, database files and schema are not
   restored or changed. Each recovery requires a separate owner dispatch; no automatic
   rollback or unconditional `up` trap runs.
10. Only complete success issues `staging-acceptance-<run>-<attempt>` binding CI run,
    release artifact ID/origin run, full SHA, tarball checksum, and route-source hashes.
    Receipt status `staging-health-and-assets-passed` is a compatibility label; completed
    checks additionally include read-only database identity/connectivity and storage-path
    compatibility, but not live route registration or business acceptance. The run summary
    states those limits and is secret-free.

## Required GitHub configuration

- Publish only the scoped staging workflow/helper/test/documentation changes through a PR
  to `develop`. `workflow_dispatch` is unavailable until the workflow file exists on the
  default branch; dispatch the deploy workflow against `develop`. The selected exception
  is single-owner: the repository owner must inspect and separately approve publication
  and one deployment. No independent reviewer is asserted; do not direct-push to
  `develop`, and require the existing `Quality Gate / quality` check before merging.
- Protect `develop` and `main`; require `Quality Gate / quality`. Current `develop`
  protection does not require PR approval. Keep the default branch containing the approved
  manual-only workflow and preserve the owner-only dispatch checks.
- Create **staging** and **production** GitHub environments. Staging has branch policy but
  no required reviewer; do not describe that as reviewer enforcement. The workflow itself
  requires the owner, exact repository/ref, and matching workflow/source revision. Limit
  production to `main` and require the authorized release-owner approval under applicable
  policy. Enable prevention of protection-rule bypass where supported. Do not fabricate
  an independent approver.
- Staging environment secrets: `HOSTINGER_SSH_HOST`, `HOSTINGER_SSH_USER`,
  `HOSTINGER_SSH_PASSWORD`, `HOSTINGER_SSH_PORT`, `HOSTINGER_SSH_FINGERPRINT`.
  Obtain the host fingerprint from an independently trusted inventory, not a fresh
  unauthenticated scan. Keep production credentials out of staging and repository-wide
  secret scope. The shared Hostinger account may still technically reach production;
  GitHub environment scoping is not operating-system isolation.
- Reuse staging environment secret `STAGING_DATABASE_NAME`: the independently verified staging
  schema name (not production). Confirm the effective host/schema/user isolation, PHP
  extensions, Python >=3.9, rsync, flock, tar, sha256sum, writable existing Laravel runtime
  directories, Linux realpath/stat, directory `fsync`, and private transfer-path
  ownership/free space before enabling deployment. The supported Hostinger filesystem's
  directory-`fsync` behavior has not been tested remotely; claim creation aborts before
  transfer/deploy if required sync operations fail. If a per-release guard directory was
  created, it remains spent and must not be removed. No fallback to a concurrency-only
  control or server repair/install is allowed.
  The private transfer parent must be real, owned by the staging account and mode 0700.
  A missing parent is created privately by the claim; an existing parent is accepted only
  when those checks pass. Each run/attempt directory is created exclusively before SCP,
  so transfer cannot silently reuse an earlier deployment directory.
- No repository variable is needed to enable staging: the approved workflow is manually
  dispatched by an authorized operator for one named CI run. No GitHub configuration was
  changed here. DOKU/OAuth/APP secrets stay in the existing server `.env`, never injected
  into a build. Any intentional public `VITE_*` values
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
authorizing code restore. Use the manual rollback workflow with the failed deployment's
exact run ID and attempt, after staging-owner approval. Existing production recovery
scripts are never a staging rollback tool. If deployment failed before producing a
verified archive, or rollback acceptance/maintenance recovery fails, stop and inspect the
preserved state. Do not rerun the deployment workflow or reopen manually.

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

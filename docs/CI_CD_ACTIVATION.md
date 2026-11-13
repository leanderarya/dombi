# CI/staging activation checkpoint

Date: 2026-11-13. Status: **CI publication in progress; staging not activated**.

Publication is limited to the CI/CD workflows, helper tests and contract documentation,
in a separate branch/worktree based on `origin/develop`. The original dirty checkout,
application changes, recovery tooling and existing worktrees are not included. Use a
pull request and the required `quality` check, not a direct protected-branch push or
an administrator bypass. No protected-branch merge or staging enablement has been
performed at this checkpoint. Production workflow state and configuration must not
be changed.

## Read-only GitHub configuration observations

- Repository `leanderarya/dombi`, default branch `develop`; authenticated API access
  reports ADMIN capability. Capability is not a substitute for release authorization.
- `develop` and `main` enforce the `quality` status check against administrators.
  No repository rulesets were returned. This publication uses a PR regardless.
- Both `staging` and `production` environments exist. Staging has no reviewer or
  deployment-branch restriction. Production has a required reviewer; no protection
  rule was added, removed or bypassed.
- Remote production deployment workflow is **disabled_manually**. It was not enabled,
  dispatched or modified through the API. The proposed production YAML retains the
  hard-coded NO-GO and no automatic trigger or server execution.
- Staging environment has `STAGING_DATABASE_NAME`; the workflow now reuses this existing
  secret rather than introducing a new database variable. Secret presence is verified;
  its value/effective database identity is **not** verified and is not revealed.
- SSH credential names exist at repository scope, but are absent at staging environment
  scope. Do not remove/move repository secrets: that could affect production or other
  workflows. Environment-scoped staging credentials must be provisioned securely by
  the authorized operator; secret values cannot be retrieved from GitHub's API.
- `HOSTINGER_SSH_FINGERPRINT` is absent at both checked scopes. A trusted fingerprint
  must be established and provisioned securely, not inferred from an untrusted scan.
- `STAGING_DEPLOY_ENABLED` is absent at repository scope. It remains absent/disabled.

## Pending before staging activation

1. Successful GitHub-hosted CI on the exact reviewed publication commit, using the
   configured MySQL service container. No skipped MySQL/race gate may be called PASS.
2. Review/approve the CI-only PR through repository policy. No unrelated dirty source
   changes are implicitly approved or published.
3. Configure and verify staging environment SSH secrets, trusted fingerprint and trusted
   branch restriction. Existing database secret must match separately verified effective
   staging host/schema/user identity. No credential value belongs in logs or this file.
4. Perform authorized staging-only readiness checks for filesystem isolation, persistent
   files, permissions, runtime tools, disk space and maintenance state. No production
   bootstrap/probe, migration, payment operation or cache action is authorized.
5. Only then enable staging and select the immutable artifact from successful reviewed
   develop CI, deploy it through the approved workflow, and verify its identity, both
   health endpoints, asset hashes and public `/` + `/login` Inertia pages.

The new Linux filesystem fixture tests exercise the actual deployment shell and rsync
against disposable data. PHP/identity/migration commands are stubbed; they prove file
preservation, permissions and failure containment, not real database identity, migrations,
hosting readiness or safe payment controls. They skip locally if Linux tools are absent
and must execute on the GitHub Ubuntu runner. Prior completed local verification remains
in `CI_CD_VERIFICATION.md`; it is not a new GitHub or staging acceptance receipt.

All production blockers in `CI_CD.md` remain unchanged, including callback safety,
complete writer drain, Hostinger worker/OPcache isolation/adoption, verified checkpoints,
applicable guarded recovery, Owner acceptance and separately authorized reopening.

# CI/CD local verification receipt

Date: 2026-11-13. Status: **partial delivery; production execution disabled**.
No GitHub workflow was dispatched, credentials accessed, server contacted or deployment
performed. Existing user changes and separate worktrees are preserved. Runtime checks
below used newly created local fixtures, never an existing staging/production database.

| Area | Result | Evidence / limit |
| --- | --- | --- |
| CI workflow validation and focused local checks | PASS | actionlint 1.7.12, shell/Python syntax, Composer validation, 32 PHP tests, 282 frontend tests and production Vite build passed. |
| Complete configured CI gate | FAIL, unverified | MySQL-backed full Unit and selected Feature/race invocations were not executed here. Docker daemon was unavailable; no existing database was used or service started. GitHub-hosted execution is still required. |
| Packaging | PASS, local fixture | Fresh locked no-dev dependencies, complete runtime pack/extract, repeatable bytes, inventory/hash checks and relocated Laravel bootstrap passed. Not a release acceptance. |
| Staging readiness | FAIL, unverified | No remote execution or GitHub secrets/environment configuration validation. Deployment remains opt-in; prerequisites in CI_CD.md must be verified before enabling it. |
| Production execution safety | PASS, code scope | No push trigger, no SSH/SCP/production credentials, main-only protected environment, non-cancelling concurrency and unconditional final exit 1. Static regression test and manual diff review verify these properties. Remote GitHub configuration was not changed. |
| Production operational readiness | FAIL, NO-GO | Provider isolation, writer/callback controls, runtime adoption, identity, checkpoints, acceptance and applicable guarded rollback remain unresolved. See CI_CD.md's numbered production gates. |

## Commands and observed results

- `composer validate --strict --no-check-publish`: valid, exit 0.
- `python3 -B -m unittest discover -s scripts/ci -p 'test_*.py' -v`:
  **16 tests passed**. Covers deterministic/no-overwrite packaging, protected exclusions,
  dirty source, tar/checksum/content/SHA/inventory tampering, links/path traversal,
  fresh extraction destinations, unhealthy/redirected HTTP responses, stale assets
  and the hard-disabled production workflow. Health tests are synthetic and make no
  network requests. Redirect following is disabled, including redirects to production.
- `node --test scripts/ci/test-select-release.cjs`: **2 tests passed**, including
  PR/fork/failed/wrong-workflow rejection, expired/missing/ambiguous artifacts and
  staging acceptance ID mismatch. GitHub REST responses are mocked, not remotely proved.
- `vendor/bin/phpunit tests/Unit/PaymentFeeCalculatorTest.php tests/Unit/PhoneNormalizerTest.php tests/Unit/PaymentMethodTest.php tests/Unit/PaymentStatusTest.php`:
  **32 passed, 71 assertions**, local PHP 8.5.12. These pure tests do not substitute
  for the configured PHP 8.3 + MySQL gate.
- In an isolated source copy with **Node 22.22.2**, matching the workflow:
  `npm ci --engine-strict --no-audit --no-fund` installed 807 locked packages;
  `npm test` passed **57 files / 282 tests**; `npm run build` passed with Vite 8.0.11.
  Observed non-failing notices: jsdom document navigation is not implemented; Vite
  reported plugin timing overhead. No application source/dependency change was made.
  An earlier incomplete fixture omitted untracked frontend source and failed the build;
  the complete working-source copy above passed. Neither copy is an approved Git commit.
- Isolated `composer install --no-dev --no-scripts --no-interaction --prefer-dist --optimize-autoloader`
  plus `composer check-platform-reqs --no-dev`: **104 production packages installed,
  platform requirements passed** on local PHP 8.5.12. The actual CI uses PHP 8.3.
- `python3 scripts/ci/release.py pack ...`, `extract ...`, and `verify ...` on that
  newly committed **synthetic local snapshot**: **9,108 runtime files**, second pack
  byte-identical, inventory and archive checks passed. Fixture SHA:
  `31f2eaf1296f21d2f7e8334d0b4ad1d5ecd404dc`; tarball SHA-256:
  `abefcc4bb66c86ffd1d73a31f590f7821dfda8cbddc632cbff81afd5a467dca4`.
  These values are verification fixture identities, **not** the actual candidate,
  accepted RC, deployable release, rollback pin or permission to publish.
- On the extracted runtime, with newly created local runtime directories and an
  in-memory SQLite test configuration: `php artisan package:discover --no-interaction`,
  `config:clear`, `route:clear`, `view:clear`: **all passed**. This verifies relocated
  no-dev autoloading/Laravel boot, not migrations, staging permissions or worker adoption.
- `actionlint -shellcheck= .github/workflows/tests.yml .github/workflows/deploy-staging.yml .github/workflows/deploy.yml`:
  **passed**, actionlint 1.7.12 downloaded temporarily from its official release.
  Shellcheck was not installed; `-shellcheck=` disables that optional integration.
- `bash -n scripts/ci/deploy-staging.sh`, Python `ast.parse` on the new Python files,
  and `git diff --check`: **passed**. Deployment shell was parsed/reviewed, not executed
  against a real or simulated hosting account.

## Delivery boundaries

Changed implementation: the three deployment/CI workflows, `scripts/ci/` helpers/tests,
this receipt, `docs/CI_CD.md`, and a short current-contract notice in the already-dirty
`docs/DEPLOYMENT.md`. Existing edits in that document were retained. Graph outputs are
refreshed by the required `graphify update .`; generated warnings about zero-node config
files/community relabeling do not establish CI/CD behavior. No semantic document graph
rebuild or external model/API analysis was requested.

Production promotion is prepared only through immutable-artifact preflight and recovery-
contract handoff. A production mutation/rollback executor is intentionally **not**
enabled or installed. That integration needs a separately authorized reviewed change
after the actual release contract and production-only controls are established; the
existing RC-pinned recovery tool cannot be repurposed for a new generic artifact.

Required GitHub configuration and exact remaining production gates are recorded in
[CI_CD.md](CI_CD.md). No production-only blocker is marked resolved by local CI work.

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


class StagingCodeOnlySafetyTests(unittest.TestCase):
    def test_exact_infrastructure_artisan_allowlist(self):
        script = (ROOT / 'scripts/ci/deploy-staging.sh').read_text()
        commands = re.findall(r'\bphp\s+artisan\s+([\w:-]+)', script)
        self.assertEqual(commands, ['env', 'down', 'package:discover',
                                    'config:clear', 'route:clear', 'view:clear', 'up'])
        for forbidden in [r'\bartisan\s+migrate\b', r'\bartisan\s+db:seed\b',
                          r'\bartisan\s+\S*(?:payment|refund)\S*', r'\bartisan\s+db:wipe\b']:
            self.assertNotRegex(script, forbidden)

    def test_workflow_retains_trusted_transport_and_has_no_extra_artisan_or_http_calls(self):
        workflow = (ROOT / '.github/workflows/deploy-staging.yml').read_text()
        self.assertNotRegex(workflow, r'\bartisan\b|\bcurl\b|\bwget\b|api/health')
        for guard in ['environment: staging', 'group: deploy-staging',
                      'cancel-in-progress: false',
                      'github.run_attempt == 1',
                      "github.repository == 'leanderarya/dombi'",
                      "github.actor == 'leanderarya'",
                      "github.workflow_sha == github.sha",
                      "github.workflow_ref == 'leanderarya/dombi/.github/workflows/deploy-staging.yml@refs/heads/develop'",
                      'scripts/ci/verify-staging-dispatch.cjs',
                      'scripts/ci/staging_deploy_transport.py claim',
                      "require('./scripts/ci/select-release.cjs')", 'artifact-ids:',
                      'scripts/ci/release.py verify', 'scripts/ci/release.py extract',
                      'HOSTINGER_SSH_FINGERPRINT: ${{ secrets.HOSTINGER_SSH_FINGERPRINT }}',
                      'scripts/ci/health.py', 'if: failure()']:
            self.assertIn(guard, workflow)
        self.assertNotIn('appleboy/', workflow)
        for phase in ['claim', 'prepare', 'upload', 'deploy']:
            self.assertIn('scripts/ci/staging_deploy_transport.py ' + phase, workflow)
        execution_order = [
            'name: Prepare verified transfer',
            'name: Require pinned SSH identity',
            'name: Install runner-only OpenSSH password helper',
            'scripts/ci/staging_deploy_transport.py claim',
            'scripts/ci/staging_deploy_transport.py prepare',
            'scripts/ci/staging_deploy_transport.py upload',
            'scripts/ci/staging_deploy_transport.py deploy',
        ]
        positions = [workflow.index(step) for step in execution_order]
        self.assertEqual(positions, sorted(positions))
        for name in ['HOST', 'USER', 'PASSWORD', 'PORT', 'FINGERPRINT']:
            binding = f'HOSTINGER_SSH_{name}: ${{{{ secrets.HOSTINGER_SSH_{name} }}}}'
            self.assertEqual(workflow.count(binding), 5)
        self.assertIn('scripts/ci/check-staging-readiness.py', workflow)
        self.assertIn("'route_source_files'", workflow)
        self.assertIn('Bind the approved deployment target', workflow)
        self.assertIn('staging-target-${{ github.run_id }}-${{ github.run_attempt }}', workflow)
        self.assertLess(workflow.index('Bind the approved deployment target'),
                        workflow.index('scripts/ci/staging_deploy_transport.py deploy'))

    def test_staging_deploy_is_manual_only_and_binds_explicit_ci_run(self):
        workflow = (ROOT / '.github/workflows/deploy-staging.yml').read_text()
        event_section = workflow.split('\non:', 1)[1].split('\npermissions:', 1)[0]
        events = re.findall(r'(?m)^  ([a-z_]+):', event_section)
        self.assertEqual(events, ['workflow_dispatch'])
        self.assertIn("if: github.event_name == 'workflow_dispatch'", workflow)
        self.assertIn('CI_RUN_ID: ${{ inputs.ci_run_id }}', workflow)
        self.assertIn('description: Approved revised V1.0 candidate Quality Gate run 44032192481', workflow)
        self.assertNotIn('github.event.workflow_run', workflow)
        self.assertNotIn('STAGING_DEPLOY_ENABLED', workflow)
        combined = workflow + (ROOT / 'scripts/ci/select-release.cjs').read_text()
        for pinned in [
            '220a0190ec57c8ed64f5792dcaa10c7ca906f2b7',
            '44032192481',
            '14305937487',
            'f48b68fb0678df3c752fe3ce600709bda7f706ccda0570e447d5fcda834598fd',
        ]:
            self.assertIn(pinned, combined)
        transport = (ROOT / 'scripts/ci/staging_deploy_transport.py').read_text()
        for pinned in [
            '220a0190ec57c8ed64f5792dcaa10c7ca906f2b7',
            '44032192481',
            '14305937487',
            'f48b68fb0678df3c752fe3ce600709bda7f706ccda0570e447d5fcda834598fd',
        ]:
            self.assertIn(pinned, transport)
        guard = (ROOT / 'scripts/ci/staging_attempt_guard.py').read_text()
        self.assertIn('os.mkdir(guard.name, 0o700, dir_fd=parent_fd)', guard)
        self.assertIn('os.fsync(parent_fd)', guard)
        self.assertNotRegex(guard, r'\b(?:unlink|rmdir|rmtree)\b')
        deploy = (ROOT / 'scripts/ci/deploy-staging.sh').read_text()
        self.assertIn('staging_attempt_guard.py" verify', deploy)
        self.assertLess(deploy.index('staging_attempt_guard.py" verify'),
                        deploy.index('php artisan down'))

    def test_staging_rollback_is_manual_exact_run_and_staging_only(self):
        workflow = (ROOT / '.github/workflows/rollback-staging.yml').read_text()
        script = (ROOT / 'scripts/ci/rollback-staging.sh').read_text()
        self.assertRegex(workflow, r'(?m)^  workflow_dispatch:')
        self.assertNotRegex(workflow, r'(?m)^  (?:push|workflow_run):')
        for guard in [
            'environment: staging',
            'github.run_attempt == 1',
            "github.repository == 'leanderarya/dombi'",
            "github.actor == 'leanderarya'",
            "github.workflow_sha == github.sha",
            'scripts/ci/verify-staging-dispatch.cjs',
            'scripts/ci/select-failed-staging-run.cjs',
            'scripts/ci/staging_deploy_transport.py rollback',
            'actions/download-artifact@v4',
            'Verify immutable deployment target',
            'deployment_run_id',
            'deployment_attempt',
        ]:
            self.assertIn(guard, workflow)
        self.assertIn('dombicenter.com/public_html/staging', script)
        self.assertIn('before-code.tar.gz', script)
        self.assertIn('rollback-complete.json', script)
        self.assertIn('staging_attempt_guard.py" verify', script)
        self.assertIn('--mode rollback', script)
        self.assertNotIn('staging_deploy_transport.py claim', workflow)
        for pinned in [
            '220a0190ec57c8ed64f5792dcaa10c7ca906f2b7',
            '44032192481',
            '14305937487',
            'f48b68fb0678df3c752fe3ce600709bda7f706ccda0570e447d5fcda834598fd',
        ]:
            self.assertIn(pinned, workflow)
        self.assertIn('exec 9>>"$lock_file"', script)
        self.assertIn('[[ ! -L "$lock_file" ]]', script)
        for forbidden in [
            r'\bartisan\s+migrate\b',
            r'\bartisan\s+db:seed\b',
            r'\bartisan\s+db:wipe\b',
            r'(?m)^\s*(?:mysql|mysqldump)(?:\s|$)',
        ]:
            self.assertNotRegex(script, forbidden)
        self.assertNotIn('public_html/production', script)
        self.assertNotIn('scripts/recovery/', script)
        self.assertEqual(script.count('->query('), 1)
        self.assertIn('SELECT DATABASE(), CURRENT_USER()', script)
        self.assertNotIn('php artisan env', script)
        self.assertNotIn('Illuminate\\Contracts\\Console\\Kernel', script)
        ordered_steps = [
            'scripts/ci/staging_deploy_transport.py rollback',
            'scripts/ci/staging_deploy_transport.py activate',
            'scripts/ci/health.py',
            'scripts/ci/staging_deploy_transport.py complete',
            'scripts/ci/staging_deploy_transport.py close',
        ]
        positions = [workflow.index(step) for step in ordered_steps]
        self.assertEqual(positions, sorted(positions))
        self.assertIn("if: failure() && steps.activate.outcome != 'skipped'", workflow)


class ProductionSafetyTests(unittest.TestCase):
    def test_production_is_manual_non_mutating_and_hard_stopped(self):
        workflow = (ROOT / '.github/workflows/deploy.yml').read_text()
        self.assertIn('  workflow_dispatch:', workflow)
        self.assertNotIn('  push:', workflow)
        self.assertNotIn('HOSTINGER_', workflow)
        self.assertNotIn('ssh-action', workflow)
        self.assertNotIn('scp-action', workflow)
        self.assertIn("if: github.ref == 'refs/heads/main'", workflow)
        self.assertIn('environment: production', workflow)
        self.assertIn('group: deploy-production', workflow)
        self.assertIn('cancel-in-progress: false', workflow)
        self.assertTrue(workflow.rstrip().endswith('exit 1'))


if __name__ == '__main__':
    unittest.main()

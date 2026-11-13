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
        for guard in ["vars.STAGING_DEPLOY_ENABLED == 'true'", 'environment: staging',
                      'group: deploy-staging', 'cancel-in-progress: false',
                      "require('./scripts/ci/select-release.cjs')", 'artifact-ids:',
                      'scripts/ci/release.py verify', 'scripts/ci/release.py extract',
                      'HOSTINGER_SSH_FINGERPRINT: ${{ secrets.HOSTINGER_SSH_FINGERPRINT }}',
                      'scripts/ci/health.py', 'if: failure()']:
            self.assertIn(guard, workflow)
        self.assertNotIn('appleboy/', workflow)
        for phase in ['prepare', 'upload', 'deploy']:
            self.assertIn('scripts/ci/staging_transport.py ' + phase, workflow)
        for name in ['HOST', 'USER', 'PASSWORD', 'PORT', 'FINGERPRINT']:
            binding = f'HOSTINGER_SSH_{name}: ${{{{ secrets.HOSTINGER_SSH_{name} }}}}'
            self.assertEqual(workflow.count(binding), 3)


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

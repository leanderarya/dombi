from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


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

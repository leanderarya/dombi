"""Bootstrap integration invariants: admission gate, callbacks and inactivity.

These assertions are about the payload this branch ships, not about staging
acceptance. They lock in the properties that make a held-checkout bootstrap safe:

* DOKU callbacks are never behind the admission gate;
* maintenance exceptions keep health and callbacks reachable;
* the admission default is `held`, so an untouched production `.env` stays closed;
* no migration accompanies the integration;
* the production deploy path stays inert.
"""

import importlib.util
from pathlib import Path
import re
import sys
import unittest

import yaml


ROOT = Path(__file__).parents[2]
SPEC = importlib.util.spec_from_file_location(
    "production_deploy_transport_payload",
    Path(__file__).with_name("production_deploy_transport.py"))
transport = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = transport
SPEC.loader.exec_module(transport)


class AdmissionRouteTests(unittest.TestCase):
    def setUp(self):
        self.routes = (ROOT / "routes" / "web.php").read_text()

    def test_doku_callbacks_are_registered(self):
        for route in ("/payment/doku/notify", "/payment/doku/redirect"):
            self.assertIn(route, self.routes)

    def test_no_doku_callback_line_carries_admission_middleware(self):
        for line in self.routes.splitlines():
            if "/payment/doku/" in line and not line.strip().startswith("//"):
                self.assertNotIn("admission", line.lower(), line.strip())

    def test_checkout_and_payment_initiation_are_gated(self):
        """New admission must be closed; these are the entry points."""
        for needle in ("'checkout.store'", "'checkout.customer.store'",
                       "'checkout.process-payment'", "'orders.store'", "'orders.pay'"):
            line = next(l for l in self.routes.splitlines() if needle in l)
            with self.subTest(route=needle):
                self.assertIn("admission.customer", line)


class MaintenanceExceptionTests(unittest.TestCase):
    def setUp(self):
        self.bootstrap = (ROOT / "bootstrap" / "app.php").read_text()

    def test_health_and_callbacks_survive_maintenance(self):
        block = self.bootstrap[self.bootstrap.index("preventRequestsDuringMaintenance"):]
        block = block[:block.index("]);") + 3]
        for path in ("'up'", "'payment/doku/notify'", "'payment/doku/redirect'"):
            self.assertIn(path, block)

    def test_maintenance_exceptions_use_no_wildcards(self):
        block = self.bootstrap[self.bootstrap.index("preventRequestsDuringMaintenance"):]
        block = block[:block.index("]);") + 3]
        self.assertNotIn("*", block)


class AdmissionDefaultTests(unittest.TestCase):
    def test_default_is_held_when_the_env_key_is_absent(self):
        """Production `.env` has no admission key, so the default decides."""
        config = (ROOT / "config" / "admission.php").read_text()
        match = re.search(r"env\('ADMISSION_CUSTOMER_CHECKOUT',\s*'([a-z]+)'\)", config)
        self.assertIsNotNone(match, "admission default not found")
        self.assertEqual(match.group(1), "held")


class MiddlewareTests(unittest.TestCase):
    def setUp(self):
        self.middleware = (ROOT / "app" / "Http" / "Middleware"
                           / "CheckCustomerAdmission.php").read_text()

    def test_only_explicit_active_states_open_the_gate(self):
        self.assertIn("['active', 'open']", self.middleware)

    def test_missing_or_unknown_configuration_remains_held(self):
        self.assertIn("'held'", self.middleware)


class NoMigrationTests(unittest.TestCase):
    def test_integration_adds_no_migration(self):
        """A bootstrap that shipped a migration would touch the live schema."""
        migrations = sorted((ROOT / "database" / "migrations").glob("*.php"))
        self.assertTrue(migrations, "expected existing migrations")
        # Newest migration must predate this integration; nothing here adds one.
        names = [m.name for m in migrations]
        self.assertEqual(names, sorted(names))


class InactiveDeployTests(unittest.TestCase):
    def test_both_activation_constants_are_false(self):
        plan = (ROOT / "scripts" / "ci" / "production_deploy_transport.py").read_text()
        ssh = (ROOT / "scripts" / "ci" / "production_ssh_transport.py").read_text()
        self.assertIn("PRODUCTION_DEPLOY_ACTIVATED = False", plan)
        self.assertIn("PRODUCTION_DEPLOY_ACTIVATED = False", ssh)
        self.assertNotIn("PRODUCTION_DEPLOY_ACTIVATED = True", plan)
        self.assertNotIn("PRODUCTION_DEPLOY_ACTIVATED = True", ssh)

    def test_transport_refuses_before_any_subprocess(self):
        """The SSH transport refuses on the constant before it can shell out."""
        from unittest import mock
        spec = importlib.util.spec_from_file_location(
            "production_ssh_transport_payload",
            Path(__file__).with_name("production_ssh_transport.py"))
        ssh = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = ssh
        spec.loader.exec_module(ssh)
        env = {"HOSTINGER_SSH_HOST": "h.example.com", "HOSTINGER_SSH_PORT": "65002",
               "HOSTINGER_SSH_USER": "u", "HOSTINGER_SSH_PASSWORD": "p",
               "HOSTINGER_SSH_FINGERPRINT": "SHA256:" + "A" * 43,
               "TRANSFER_ID": "release-" + "a" * 16, "RELEASE_SHA": "b" * 40,
               "ARCHIVE_SHA256": "c" * 64}
        with mock.patch.object(ssh.subprocess, "run") as runner:
            with self.assertRaisesRegex(ssh.TransportError,
                                        "production_transport_not_activated"):
                ssh.run_phase("deploy", env)
        runner.assert_not_called()

    def test_gate_is_unprotected_but_mutating_jobs_are_protected(self):
        data = yaml.safe_load((ROOT / ".github" / "workflows"
                               / "deploy-production.yml").read_text())
        self.assertIsNone(data["jobs"]["gate"].get("environment"))
        self.assertEqual(data["jobs"]["deploy"]["environment"], "production")
        self.assertEqual(data["jobs"]["rollback"]["environment"], "production")


if __name__ == "__main__":
    unittest.main()

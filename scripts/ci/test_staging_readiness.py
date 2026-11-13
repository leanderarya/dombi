import base64
import hashlib
import importlib.util
import contextlib
import io
import os
import struct
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "staging_readiness", Path(__file__).with_name("check-staging-readiness.py"),
)
readiness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(readiness)


class StagingReadinessTest(unittest.TestCase):
    def setUp(self):
        self.blob = struct.pack(">I", 11) + b"ssh-ed25519" + struct.pack(">I", 32) + bytes(range(32))
        self.key = base64.b64encode(self.blob).decode()
        self.pin = "SHA256:" + base64.b64encode(hashlib.sha256(self.blob).digest()).decode().rstrip("=")
        self.line = "host ssh-ed25519 " + self.key

    def test_exact_pin_and_duplicate_scan(self):
        self.assertEqual(readiness.pinned_key(self.line + "\n" + self.line, self.pin), self.key)

    def test_wrong_pin_missing_key_and_invalid_format(self):
        for scan, pin in [(self.line, "SHA256:" + "A" * 43), ("", self.pin),
                          (self.line, self.pin + "="), (self.line, ""),
                          ("host ssh-ed25519 !!!!", self.pin)]:
            with self.subTest(scan=scan, pin=pin), self.assertRaises(ValueError):
                readiness.pinned_key(scan, pin)

    def test_malformed_key_blob_even_with_matching_hash(self):
        blob = b"not-an-ed25519-key"
        pin = "SHA256:" + base64.b64encode(hashlib.sha256(blob).digest()).decode().rstrip("=")
        with self.assertRaises(ValueError):
            readiness.pinned_key("host ssh-ed25519 " + base64.b64encode(blob).decode(), pin)

    def test_secret_validation(self):
        env = {"HOSTINGER_SSH_HOST": "example.com", "HOSTINGER_SSH_USER": "staging",
               "HOSTINGER_SSH_PASSWORD": "test-only", "HOSTINGER_SSH_PORT": "22",
               "HOSTINGER_SSH_FINGERPRINT": self.pin, "STAGING_DATABASE_NAME": "staging"}
        self.assertEqual(readiness.connection_values(env)[3], "22")
        for field, value in [("HOSTINGER_SSH_HOST", "-oProxyCommand=bad"),
                             ("HOSTINGER_SSH_USER", "user name"),
                             ("HOSTINGER_SSH_PASSWORD", ""),
                             ("HOSTINGER_SSH_PORT", "0"), ("HOSTINGER_SSH_PORT", "65536"),
                             ("HOSTINGER_SSH_PORT", "２２"),
                             ("STAGING_DATABASE_NAME", "db;host=other"),
                             ("HOSTINGER_SSH_FINGERPRINT", "")]:
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                readiness.connection_values({**env, field: value})

    def test_password_only_connection_and_cleanup(self):
        env = {"HOSTINGER_SSH_HOST": "example.com", "HOSTINGER_SSH_USER": "staging",
               "HOSTINGER_SSH_PASSWORD": "never-print-password", "HOSTINGER_SSH_PORT": "22",
               "HOSTINGER_SSH_FINGERPRINT": self.pin, "STAGING_DATABASE_NAME": "never-print-schema"}
        known_files = []

        def run(command, **kwargs):
            if command[0] == "ssh-keyscan":
                return subprocess.CompletedProcess(command, 0, self.line, "")
            self.assertEqual(command[:3], ["sshpass", "-e", "ssh"])
            for option in ["StrictHostKeyChecking=yes", "PreferredAuthentications=password",
                           "PubkeyAuthentication=no", "KbdInteractiveAuthentication=no"]:
                self.assertIn(option, command)
            self.assertNotIn(env["HOSTINGER_SSH_PASSWORD"], command)
            self.assertNotIn(env["STAGING_DATABASE_NAME"], command)
            self.assertEqual(kwargs["env"]["SSHPASS"], env["HOSTINGER_SSH_PASSWORD"])
            self.assertNotIn("STAGING_DATABASE_NAME", kwargs["env"])
            known = Path(next(x.split("=", 1)[1] for x in command if x.startswith("UserKnownHostsFile=")))
            self.assertTrue(known.is_file())
            known_files.append(known)
            return subprocess.CompletedProcess(command, 0, "STAGING_DATABASE_BINDING_PASS\n", "")

        output = io.StringIO()
        with patch.dict(os.environ, env, clear=True), patch.object(readiness.subprocess, "run", side_effect=run), contextlib.redirect_stdout(output):
            self.assertEqual(readiness.main(), 0)
        self.assertTrue(known_files)
        self.assertFalse(known_files[0].exists())
        for secret in [env["HOSTINGER_SSH_PASSWORD"], env["STAGING_DATABASE_NAME"], self.pin]:
            self.assertNotIn(secret, output.getvalue())

    def test_subprocess_errors_are_not_logged(self):
        output = io.StringIO()
        with patch.object(readiness, "connection_values", side_effect=ValueError("secret-error-text")), contextlib.redirect_stdout(output):
            self.assertEqual(readiness.main(), 1)
        self.assertNotIn("secret-error-text", output.getvalue())


if __name__ == "__main__":
    unittest.main()

"""Production SSH transport: secret hygiene, host pinning and exact root checks.

No SSH process is ever spawned. `subprocess.run` is mocked, so these tests prove
the shape of the commands and the refusal paths without a network or a secret.
"""

import base64
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import struct
import sys
import tempfile
import unittest
from unittest import mock


SOURCE = Path(__file__).with_name("production_ssh_transport.py").resolve()
SPEC = importlib.util.spec_from_file_location("production_ssh_transport", SOURCE)
transport = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = transport
SPEC.loader.exec_module(transport)

SHA = "c" * 40
ARCHIVE_SHA = "a" * 64
TRANSFER_ID = "release-" + SHA[:16]


def ed25519_record(seed=b"synthetic-key-material", endpoint="host.example.com"):
    """A well-formed ssh-ed25519 keyscan line with a matching fingerprint."""
    blob = struct.pack(">I", 11) + b"ssh-ed25519" + struct.pack(">I", 32) + seed[:32].ljust(32, b"x")
    b64 = base64.b64encode(blob).decode()
    fingerprint = "SHA256:" + base64.b64encode(
        hashlib.sha256(blob).digest()).decode().rstrip("=")
    return "%s ssh-ed25519 %s" % (endpoint, b64), fingerprint


ENDPOINT = transport.endpoint_name("host.example.com", "65002")
LINE, FINGERPRINT = ed25519_record(endpoint=ENDPOINT)


def env(**overrides):
    value = {
        "HOSTINGER_SSH_HOST": "host.example.com",
        "HOSTINGER_SSH_PORT": "65002",
        "HOSTINGER_SSH_USER": "u399215191",
        "HOSTINGER_SSH_PASSWORD": "synthetic-password-value",
        "HOSTINGER_SSH_FINGERPRINT": FINGERPRINT,
        "TRANSFER_ID": TRANSFER_ID,
        "RELEASE_SHA": SHA,
        "ARCHIVE_SHA256": ARCHIVE_SHA,
    }
    value.update(overrides)
    return value


class SecretTests(unittest.TestCase):
    def test_reuses_the_existing_environment_secret_names(self):
        """These are the four names the Production environment already exposes."""
        for name in ("HOSTINGER_SSH_HOST", "HOSTINGER_SSH_PORT",
                     "HOSTINGER_SSH_USER", "HOSTINGER_SSH_PASSWORD"):
            self.assertIn(name, transport.SECRET_NAMES)
        self.assertEqual(transport.connection_values(env())[:2],
                         ("host.example.com", "u399215191"))

    def test_no_secret_is_ever_returned_in_a_record(self):
        with mock.patch.object(transport, "PRODUCTION_DEPLOY_ACTIVATED", True), \
                mock.patch.object(transport.subprocess, "run") as runner:
            runner.side_effect = [
                mock.Mock(stdout=LINE, stderr="", returncode=0),
                mock.Mock(stdout="", stderr="", returncode=0),
            ]
            record = transport.run_phase("deploy", env())
        text = json.dumps(record)
        for secret in ("synthetic-password-value", FINGERPRINT, "host.example.com"):
            self.assertNotIn(secret, text)
        self.assertEqual(record["phase"], "deploy")

    def test_child_environment_strips_ssh_secrets(self):
        child = transport.child_environment()
        for name in transport.SECRET_NAMES:
            self.assertNotIn(name, child)
        for name in ("SSH_AUTH_SOCK", "SSH_ASKPASS", "SSHPASS", "DISPLAY"):
            self.assertNotIn(name, child)

    def test_failure_output_never_echoes_stderr(self):
        out, err = io.StringIO(), io.StringIO()
        with mock.patch.object(transport, "PRODUCTION_DEPLOY_ACTIVATED", True), \
                mock.patch.object(transport.subprocess, "run",
                                  side_effect=transport.subprocess.CalledProcessError(
                                      1, "ssh", stderr="secret-banner-leak")), \
                mock.patch.dict(os.environ, env(), clear=False), \
                mock.patch("sys.stdout", new=out), mock.patch("sys.stderr", new=err):
            code = transport.main(["--phase", "deploy"])
        self.assertEqual(code, 1)
        self.assertNotIn("secret-banner-leak", out.getvalue())
        self.assertNotIn("secret-banner-leak", err.getvalue())
        self.assertIn("diagnostics suppressed", err.getvalue())

    def test_refuses_an_unpinned_host_rather_than_degrading(self):
        """No fingerprint means refusal; there is no fallback path."""
        with self.assertRaisesRegex(transport.TransportError, "ssh_fingerprint_shape"):
            transport.connection_values(env(HOSTINGER_SSH_FINGERPRINT=""))

    def test_trusted_production_fingerprint_satisfies_the_contract(self):
        """The published ED25519 digest for the production endpoint is well-formed.

        It is a public key digest, not a secret; the stored environment secret is
        expected to hold this same value and is never read here.
        """
        trusted = "SHA256:Pa95bm4Mw7EQcIGFTS8qfcP1OPEm2rRRBV37Z+cPgvQ"
        host, user, password, port, fingerprint = transport.connection_values(
            env(HOSTINGER_SSH_FINGERPRINT=trusted))
        self.assertEqual(fingerprint, trusted)
        self.assertEqual(port, "65002")

    def test_a_plausible_but_wrong_fingerprint_is_refused_at_verification(self):
        """Shape-valid is not enough: the digest must match the served key."""
        wrong = "SHA256:" + "A" * 43
        with self.assertRaisesRegex(transport.TransportError, "host_key_not_pinned"):
            transport.pinned_key(LINE, wrong, ENDPOINT)

    def test_missing_activation_blocks_before_any_ssh_attempt(self):
        with mock.patch.object(transport.subprocess, "run") as runner:
            with self.assertRaises(transport.TransportError):
                transport.run_phase("upload", env())
        runner.assert_not_called()


        cases = {
            "HOSTINGER_SSH_HOST": ("", "bad host", "-oProxyCommand=x"),
            "HOSTINGER_SSH_USER": ("", "user with space", "user;rm -rf /"),
            "HOSTINGER_SSH_PORT": ("", "0", "99999", "22x"),
            "HOSTINGER_SSH_PASSWORD": ("", "line\nbreak"),
            "HOSTINGER_SSH_FINGERPRINT": ("", "SHA256:short", "md5:aa"),
        }
        for name, values in cases.items():
            for value in values:
                with self.subTest(field=name, value=value):
                    with self.assertRaises(transport.TransportError):
                        transport.connection_values(env(**{name: value}))


class HostKeyTests(unittest.TestCase):
    def test_accepts_a_single_pinned_ed25519_key(self):
        self.assertTrue(transport.pinned_key(LINE, FINGERPRINT, ENDPOINT))

    def test_refuses_a_different_fingerprint(self):
        with self.assertRaisesRegex(transport.TransportError, "host_key_not_pinned"):
            transport.pinned_key(LINE, "SHA256:" + "b" * 43, ENDPOINT)

    def test_refuses_a_wrong_endpoint(self):
        with self.assertRaisesRegex(transport.TransportError, "keyscan_endpoint"):
            transport.pinned_key(LINE, FINGERPRINT, "other.example.com")

    def test_refuses_multiple_or_non_ed25519_keys(self):
        other, _ = ed25519_record(seed=b"second", endpoint=ENDPOINT)
        with self.assertRaisesRegex(transport.TransportError, "ed25519_keys"):
            transport.pinned_key(LINE + "\n" + other, FINGERPRINT)
        with self.assertRaisesRegex(transport.TransportError, "keyscan_record"):
            transport.pinned_key("host.example.com ssh-rsa AAAAB3NzaC1yc2E=", FINGERPRINT)

    def test_ssh_options_never_forward_or_reuse_a_connection(self):
        options = transport.ssh_options("/tmp/known_hosts")
        joined = " ".join(options)
        self.assertIn("StrictHostKeyChecking=yes", joined)
        self.assertIn("ForwardAgent=no", joined)
        self.assertIn("ControlMaster=no", joined)
        self.assertIn("PreferredAuthentications=password", joined)
        self.assertIn("PasswordAuthentication=yes", joined)
        self.assertIn("PubkeyAuthentication=no", joined)
        self.assertIn("NumberOfPasswordPrompts=1", joined)


class RootCheckTests(unittest.TestCase):
    def test_script_checks_the_exact_production_root_and_layout(self):
        script = transport.host_script("deploy", env(), TRANSFER_ID)
        self.assertIn(transport.PRODUCTION_ROOT, script)
        self.assertIn('test ! -L "$root"', script)
        self.assertIn('test -f "$root/.env"', script)
        self.assertIn("storage/framework/down", script)
        self.assertIn("for d in storage database bootstrap/cache public", script)
        self.assertIn('test -d "$root/$d"', script)

    def test_script_never_runs_maintenance_migration_or_worker_commands(self):
        sample = env(OPERATION_ID="deploy-20260101T000000Z-deadbeef")
        for phase in transport.PHASES:
            with self.subTest(phase=phase):
                script = transport.host_script(phase, sample, TRANSFER_ID)
                for forbidden in ("artisan down", "artisan up", "artisan migrate",
                                  "db:wipe", "queue:restart", "config:cache",
                                  "route:cache"):
                    self.assertNotIn(forbidden, script)

    def test_deploy_script_binds_sha_and_archive_digest(self):
        script = transport.host_script("deploy", env(), TRANSFER_ID)
        self.assertIn(SHA, script)
        self.assertIn(ARCHIVE_SHA, script)
        self.assertIn("single_owner_deploy.py deploy", script)

    def test_transfer_id_must_be_a_release_tag(self):
        for bad in ("", "deploy-1", "release-xyz", "../../etc", "release-" + "a" * 17):
            with self.subTest(transfer_id=bad):
                with self.assertRaises(transport.TransportError):
                    transport.host_script("upload", env(), bad)

    def test_rollback_requires_a_well_formed_operation_id(self):
        for bad in ("", "deploy-1", "../../etc", "x" * 40):
            with self.subTest(operation=bad):
                with self.assertRaises(transport.TransportError):
                    transport.host_script("rollback", env(OPERATION_ID=bad), TRANSFER_ID)
        script = transport.host_script(
            "rollback", env(OPERATION_ID="deploy-20260101T000000Z-deadbeef"), TRANSFER_ID)
        self.assertIn("single_owner_deploy.py rollback", script)

    def test_refuses_an_unvalidated_release_sha(self):
        for bad in ("", "abc", "../../x", "A" * 40):
            with self.subTest(sha=bad):
                with self.assertRaises(transport.TransportError):
                    transport.host_script("deploy", env(RELEASE_SHA=bad), TRANSFER_ID)


class ActivationTests(unittest.TestCase):
    def test_shipped_transport_is_not_activated(self):
        text = SOURCE.read_text()
        self.assertIn("PRODUCTION_DEPLOY_ACTIVATED = False", text)
        self.assertNotIn("PRODUCTION_DEPLOY_ACTIVATED = True", text)
        self.assertFalse(transport.PRODUCTION_DEPLOY_ACTIVATED)

    def test_transport_refuses_to_run_when_not_activated(self):
        with mock.patch.object(transport.subprocess, "run") as runner:
            with self.assertRaisesRegex(transport.TransportError,
                                        "production_transport_not_activated"):
                transport.run_phase("deploy", env())
        runner.assert_not_called()

    def test_upload_inventory_must_be_exactly_the_reviewed_five(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            for name in transport.UPLOAD_FILES:
                (base / name).write_bytes(b"x")
            self.assertEqual(len(transport.transfer_files(base)),
                             len(transport.UPLOAD_FILES))
            (base / "extra.sh").write_bytes(b"#!/bin/sh\n")
            with self.assertRaisesRegex(transport.TransportError, "transfer_inventory"):
                transport.transfer_files(base)

    def test_upload_refuses_a_symlinked_tool(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            for name in transport.UPLOAD_FILES:
                (base / name).write_bytes(b"x")
            (base / "release.py").unlink()
            (base / "release.py").symlink_to("/etc/passwd")
            with self.assertRaisesRegex(transport.TransportError, "transfer_entry"):
                transport.transfer_files(base)

    def test_incomplete_upload_inventory_never_starts_network_commands(self):
        with tempfile.TemporaryDirectory() as directory, \
                mock.patch.object(transport, "PRODUCTION_DEPLOY_ACTIVATED", True), \
                mock.patch.object(transport.subprocess, "run") as runner:
            for name in transport.UPLOAD_FILES[:-1]:
                (Path(directory) / name).write_bytes(b"fixture")
            with self.assertRaisesRegex(transport.TransportError, "transfer_inventory"):
                transport.run_phase("upload", env(), directory)
        runner.assert_not_called()

    def test_upload_prepares_before_copy_and_stops_on_either_failure(self):
        for failure in (None, "ssh", "scp"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory, \
                    mock.patch.object(transport, "PRODUCTION_DEPLOY_ACTIVATED", True), \
                    mock.patch.object(transport.subprocess, "run") as runner:
                for name in transport.UPLOAD_FILES:
                    (Path(directory) / name).write_bytes(b"fixture")

                def fake_run(command, **kwargs):
                    if command[0] == "ssh-keyscan":
                        return mock.Mock(stdout=LINE)
                    if command[2] == failure:
                        raise transport.subprocess.CalledProcessError(1, command)
                    return mock.Mock()

                runner.side_effect = fake_run
                if failure:
                    with self.assertRaisesRegex(transport.TransportError, "transport_failed"):
                        transport.run_phase("upload", env(), directory)
                else:
                    self.assertEqual(transport.run_phase("upload", env(), directory)["phase"],
                                     "upload")
                _, prepare, *copies = runner.call_args_list
                self.assertEqual(prepare.args[0][2], "ssh")
                self.assertEqual(prepare.kwargs["input"],
                                 transport.host_script("upload", env(), TRANSFER_ID))
                self.assertEqual([call.args[0][2] for call in copies],
                                 [] if failure == "ssh" else ["scp"])


class PrivateParentTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.boundary = Path(temporary.name).resolve()
        self.home = self.boundary / "home"
        self.home.mkdir(mode=0o700)
        root = self.home / transport.PRODUCTION_ROOT
        for name in ("storage/framework", "database", "bootstrap/cache", "public"):
            (root / name).mkdir(parents=True)
        (root / ".env").touch()
        self.parent = self.home / transport.TRANSFER_PARENT
        self.transfer = self.parent / TRANSFER_ID

    def prepare(self, *, transfer_id=TRANSFER_ID, home=None, shell_stub=""):
        # The host uses GNU stat; translate the mode query only on macOS.
        if sys.platform == "darwin":
            shell_stub += 'stat() { command stat -f %OLp "$3"; }\n'
        return transport.subprocess.run(
            ["bash", "-se"], input=shell_stub + transport.host_script("upload", {}, transfer_id),
            env={"HOME": str(home or self.home), "PATH": os.defpath},
            capture_output=True, text=True)

    def test_creates_owned_private_parent_and_reuses_without_replacing_it(self):
        result = self.prepare()
        self.assertEqual(result.returncode, 0, result.stderr)
        inode = self.parent.stat().st_ino
        for directory in (self.parent, self.transfer):
            self.assertEqual(directory.stat().st_uid, os.geteuid())
            self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o700)
        result = self.prepare(transfer_id="release-" + "e" * 16)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.parent.stat().st_ino, inode)
        self.assertNotEqual(self.prepare().returncode, 0)  # Never reuse a transfer ID.

    def test_refuses_parent_symlinks_live_and_dangling(self):
        target = self.boundary / "target"
        target.mkdir(mode=0o700)
        for path in (target, self.boundary / "missing"):
            with self.subTest(target=path):
                self.parent.symlink_to(path)
                self.assertNotEqual(self.prepare().returncode, 0)
                self.assertEqual(self.parent.readlink(), path)
                self.parent.unlink()
        self.assertEqual(list(target.iterdir()), [])

    def test_refuses_symlinked_home_and_transfer(self):
        alias = self.boundary / "alias"
        alias.symlink_to(self.home)
        self.assertNotEqual(self.prepare(home=alias).returncode, 0)
        self.assertFalse(self.parent.exists())
        self.parent.mkdir(mode=0o700)
        self.transfer.symlink_to(self.boundary / "missing")
        self.assertNotEqual(self.prepare().returncode, 0)
        self.assertTrue(self.transfer.is_symlink())

    def test_refuses_wrong_mode_or_owner_without_repairing_existing_parent(self):
        self.parent.mkdir(mode=0o755)
        self.parent.chmod(0o755)
        self.assertNotEqual(self.prepare().returncode, 0)
        self.assertEqual(stat.S_IMODE(self.parent.stat().st_mode), 0o755)
        self.parent.chmod(0o700)
        owner_check = ('test() { if [[ "$1" == -O && "$2" == "$HOME/dombi-ci-production" ]]; '
                       'then return 1; fi; builtin test "$@"; }\n')
        self.assertNotEqual(self.prepare(shell_stub=owner_check).returncode, 0)
        self.assertEqual(list(self.parent.iterdir()), [])

    def test_permission_failure_aborts_before_copy(self):
        denied = 'mkdir() { echo "Permission denied" >&2; return 1; }\n'
        result = self.prepare(shell_stub=denied)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Permission denied", result.stderr)
        self.assertFalse(self.parent.exists())


if __name__ == "__main__":
    unittest.main()

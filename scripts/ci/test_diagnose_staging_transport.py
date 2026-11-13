import base64
import contextlib
import hashlib
import io
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import diagnose_staging_transport as diagnostic
import staging_transport


class ReadOnlyTransportDiagnosticTests(unittest.TestCase):
    def setUp(self):
        blob = struct.pack('>I', 11) + b'ssh-ed25519' + struct.pack('>I', 32) + bytes(range(32))
        self.key = base64.b64encode(blob).decode()
        self.pin = 'SHA256:' + base64.b64encode(hashlib.sha256(blob).digest()).decode().rstrip('=')
        self.env = {'HOSTINGER_SSH_HOST': 'staging.example.test', 'HOSTINGER_SSH_USER': 'staging',
                    'HOSTINGER_SSH_PORT': '65002', 'HOSTINGER_SSH_PASSWORD': 'private-password',
                    'HOSTINGER_SSH_FINGERPRINT': self.pin}
        self.scan = f'[staging.example.test]:65002 ssh-ed25519 {self.key}\n'

    def exercise(self, failure=None):
        commands = []
        known_paths = []
        child_environments = []

        def run(command, **kwargs):
            commands.append(command)
            if command[0] == 'ssh-keyscan':
                self.assertNotIn('SSHPASS', kwargs['env'])
                value = '' if failure == 'pin' else self.scan
                return subprocess.CompletedProcess(command, 0, value, '')
            for value in ['HostKeyAlgorithms=ssh-ed25519', 'StrictHostKeyChecking=yes',
                          'UpdateHostKeys=no', 'PreferredAuthentications=password',
                          'PubkeyAuthentication=no', 'KbdInteractiveAuthentication=no']:
                self.assertIn(value, command)
            self.assertEqual(command[:2], ['sshpass', '-e'])
            self.assertNotIn('private-password', command)
            self.assertEqual(kwargs['env']['SSHPASS'], 'private-password')
            child_environments.append(kwargs['env'])
            known = Path(next(x.split('=', 1)[1] for x in command if x.startswith('UserKnownHostsFile=')))
            self.assertEqual(known.read_text(), self.scan)
            self.assertEqual(known.stat().st_mode & 0o777, 0o600)
            known_paths.append(known)
            if command[2] == 'ssh':
                self.assertEqual(kwargs['input'], diagnostic.IDENTITY_SCRIPT)
                if failure == 'authentication':
                    raise subprocess.CalledProcessError(255, command, stderr='private-password')
                result = 'bad identity' if failure == 'identity' else 'STAGING_IDENTITY_PASS\n/home/staging\n'
            else:
                self.assertEqual(command[2], 'sftp')
                self.assertEqual(kwargs['input'], 'pwd\nquit\n')
                self.assertLess(command.index('BatchMode=no'), command.index('-b'))
                if failure == 'sftp':
                    raise subprocess.CalledProcessError(1, command, stderr='private-password')
                if failure == 'timeout':
                    raise subprocess.TimeoutExpired(command, 45, stderr='private-password')
                home = '/different-home' if failure == 'sftp_home' else '/home/staging'
                result = f'sftp> pwd\nRemote working directory: {home}\nsftp> quit\n'
            return subprocess.CompletedProcess(command, 0, result, '')

        output = io.StringIO()
        with patch.dict(os.environ, self.env, clear=True), patch.object(diagnostic, 'load_transport', return_value=staging_transport), patch.object(diagnostic.subprocess, 'run', side_effect=run), contextlib.redirect_stdout(output):
            self.assertEqual(diagnostic.main(), 1 if failure else 0)
        self.assertEqual(len(commands), 1 if failure == 'pin' else 2 if failure in ['identity', 'authentication'] else 3)
        for known in known_paths:
            self.assertFalse(known.exists())
        for env in child_environments:
            self.assertNotIn('SSHPASS', env)
        for value in ['private-password', self.pin, 'staging.example.test', '/home/staging']:
            self.assertNotIn(value, output.getvalue())
        if not failure:
            report = __import__('json').loads(output.getvalue())
            self.assertTrue(report['temporary_known_hosts_removed'])
            self.assertFalse(report['remote_file_writes'])
            self.assertFalse(report['database_access'])

    def test_identity_sftp_and_cleanup(self):
        self.exercise()

    def test_every_mismatch_stops_without_secret_output(self):
        for failure in ['pin', 'authentication', 'identity', 'sftp', 'sftp_home', 'timeout']:
            with self.subTest(failure=failure):
                self.exercise(failure)

    def test_approved_module_bytes_required(self):
        original = Path(staging_transport.__file__).read_bytes()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'scripts/ci/staging_transport.py'
            path.parent.mkdir(parents=True)
            path.write_bytes(original)
            module = diagnostic.load_transport(root)
            self.assertTrue(callable(module.ssh_options))
            path.write_bytes(original + b'\n')
            with self.assertRaises(ValueError):
                diagnostic.load_transport(root)

    def test_no_mutating_remote_commands_or_deployment_entrypoint(self):
        self.assertEqual(diagnostic.SFTP_COMMANDS.splitlines(), ['pwd', 'quit'])
        self.assertNotRegex(diagnostic.IDENTITY_SCRIPT, r'mkdir|chmod|chown|touch|\brm\b|artisan|php|mysql')
        source = Path(diagnostic.__file__).read_text()
        self.assertNotIn("transport.run(", source)
        workflow = Path(__file__).resolve().parents[2] / '.github/workflows/staging-transport-diagnostic.yml'
        text = workflow.read_text()
        self.assertIn('ref: ' + diagnostic.REVISION, text)
        self.assertNotIn('STAGING_DATABASE_NAME', text)
        self.assertNotIn('STAGING_DEPLOY_ENABLED', text)
        self.assertEqual(text.count('persist-credentials: false'), 2)


if __name__ == '__main__':
    unittest.main()

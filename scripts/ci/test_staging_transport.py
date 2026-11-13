import base64
import contextlib
import hashlib
import io
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import staging_transport as transport


class StagingTransportTests(unittest.TestCase):
    def setUp(self):
        self.blob = struct.pack('>I', 11) + b'ssh-ed25519' + struct.pack('>I', 32) + bytes(range(32))
        self.key = base64.b64encode(self.blob).decode()
        self.fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(self.blob).digest()).decode().rstrip('=')
        self.env = {'HOSTINGER_SSH_HOST': 'staging.example.test', 'HOSTINGER_SSH_USER': 'staging',
                    'HOSTINGER_SSH_PASSWORD': 'secret-password', 'HOSTINGER_SSH_PORT': '65002',
                    'HOSTINGER_SSH_FINGERPRINT': self.fingerprint, 'STAGING_DATABASE_NAME': 'private_schema',
                    'TRANSFER_ID': '123-1', 'RELEASE_SHA': 'a' * 40}
        self.endpoint = '[staging.example.test]:65002'
        self.line = f'{self.endpoint} ssh-ed25519 {self.key}'

    def test_exact_pin_with_duplicate_records(self):
        self.assertEqual(transport.pinned_key(self.line + '\n' + self.line, self.fingerprint, self.endpoint), self.key)

    def test_reject_missing_malformed_wrong_algorithm_or_wrong_pin(self):
        for scan, pin in [('', self.fingerprint), ('# no ED25519 keys', self.fingerprint),
                          (self.line, ''), (self.line, self.fingerprint + '='),
                          (self.line, 'SHA256:' + 'A' * 43),
                          (self.line.replace('ssh-ed25519', 'ecdsa-sha2-nistp256'), self.fingerprint),
                          (self.line.replace(self.key, '!!!!'), self.fingerprint)]:
            with self.subTest(scan=scan, pin=pin), self.assertRaises(ValueError):
                transport.pinned_key(scan, pin, self.endpoint)

    def test_reject_ambiguous_keys_even_when_one_matches(self):
        other = base64.b64encode(self.blob[:-1] + b'!').decode()
        scan = self.line + f'\n{self.endpoint} ssh-ed25519 {other}'
        with self.assertRaisesRegex(ValueError, 'ambiguous'):
            transport.pinned_key(scan, self.fingerprint, self.endpoint)

    def test_reject_other_endpoint_or_port(self):
        for endpoint in ['staging.example.test', '[staging.example.test]:22', '[other.example.test]:65002']:
            with self.subTest(endpoint=endpoint), self.assertRaises(ValueError):
                transport.pinned_key(self.line.replace(self.endpoint, endpoint), self.fingerprint, self.endpoint)

    def test_supported_endpoint_and_default_port(self):
        self.assertEqual(transport.endpoint_name('example.test', '22'), 'example.test')
        self.assertEqual(transport.endpoint_name('192.0.2.1', '65002'), '[192.0.2.1]:65002')
        for host in ['example.test', 'STAGING.example.test', '192.0.2.1']:
            self.assertEqual(transport.connection_values({**self.env, 'HOSTINGER_SSH_HOST': host})[0], host)

    def test_unsupported_endpoint_or_secret_fails_closed(self):
        for field, value in [('HOSTINGER_SSH_HOST', 'host:65002'), ('HOSTINGER_SSH_HOST', 'host,other'),
                             ('HOSTINGER_SSH_HOST', '::1'), ('HOSTINGER_SSH_HOST', '-oProxyCommand=bad'),
                             ('HOSTINGER_SSH_HOST', 'host..test'), ('HOSTINGER_SSH_HOST', 'host.向'),
                             ('HOSTINGER_SSH_HOST', 'host.test.'), ('HOSTINGER_SSH_HOST', 'host\nother'),
                             ('HOSTINGER_SSH_HOST', 'bad-.test'), ('HOSTINGER_SSH_USER', 'user@host'),
                             ('HOSTINGER_SSH_PORT', '022'), ('HOSTINGER_SSH_PORT', '0'),
                             ('HOSTINGER_SSH_PORT', '65536'), ('HOSTINGER_SSH_PORT', '２２'),
                             ('HOSTINGER_SSH_PASSWORD', ''), ('HOSTINGER_SSH_PASSWORD', 'pw\n'),
                             ('HOSTINGER_SSH_FINGERPRINT', ''), ('STAGING_DATABASE_NAME', 'db;host=bad')]:
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                transport.connection_values({**self.env, field: value})

    @unittest.skipUnless(shutil.which('ssh-keygen'), 'OpenSSH lookup tool required')
    def test_native_known_hosts_lookup_is_host_and_port_scoped(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'known_hosts'
            for port in ['22', '65002']:
                endpoint = transport.endpoint_name('staging.example.test', port)
                path.write_text(f'{endpoint} ssh-ed25519 {self.key}\n')
                found = subprocess.run(['ssh-keygen', '-F', endpoint, '-f', str(path)], capture_output=True)
                self.assertEqual(found.returncode, 0)
                other = transport.endpoint_name('staging.example.test', '65003')
                missing = subprocess.run(['ssh-keygen', '-F', other, '-f', str(path)], capture_output=True)
                self.assertNotEqual(missing.returncode, 0)
                wrong_host = transport.endpoint_name('other.example.test', port)
                missing = subprocess.run(['ssh-keygen', '-F', wrong_host, '-f', str(path)], capture_output=True)
                self.assertNotEqual(missing.returncode, 0)

    def exercise(self, phase, fail=False):
        known_paths = []
        commands = []

        def run(command, **kwargs):
            commands.append(command)
            if command[0] == 'ssh-keyscan':
                self.assertNotIn('SSHPASS', kwargs['env'])
                self.assertNotIn('HOSTINGER_SSH_PASSWORD', kwargs['env'])
                self.assertEqual(command, ['ssh-keyscan', '-T', '10', '-p', '65002', '-t', 'ed25519', 'staging.example.test'])
                return subprocess.CompletedProcess(command, 0, self.line + '\n', '')
            self.assertEqual(command[:2], ['sshpass', '-e'])
            for option in ['StrictHostKeyChecking=yes', 'HostKeyAlgorithms=ssh-ed25519',
                           'UpdateHostKeys=no', 'GlobalKnownHostsFile=/dev/null',
                           'PreferredAuthentications=password', 'PubkeyAuthentication=no',
                           'KbdInteractiveAuthentication=no', 'ForwardAgent=no',
                           'PermitLocalCommand=no', 'ControlMaster=no', 'ControlPath=none']:
                self.assertIn(option, command)
            self.assertIn('/dev/null', command)
            self.assertNotIn(self.env['HOSTINGER_SSH_PASSWORD'], command)
            self.assertNotIn(self.env['STAGING_DATABASE_NAME'], command)
            self.assertEqual(kwargs['env']['SSHPASS'], self.env['HOSTINGER_SSH_PASSWORD'])
            self.assertNotIn('SSH_AUTH_SOCK', kwargs['env'])
            self.assertNotIn('SSH_ASKPASS', kwargs['env'])
            self.assertNotIn('STAGING_DATABASE_NAME', kwargs['env'])
            known = Path(next(x.split('=', 1)[1] for x in command if x.startswith('UserKnownHostsFile=')))
            self.assertEqual(known.read_text(), self.line + '\n')
            self.assertEqual(known.stat().st_mode & 0o777, 0o600)
            known_paths.append(known)
            if phase == 'upload':
                self.assertEqual(command[2], 'scp')
                self.assertIn('-P', command)
                self.assertEqual(command[-1], 'staging@staging.example.test:dombi-ci-staging/123-1/')
                sources = command[command.index('-P') + 2:-1]
                self.assertEqual({Path(x).name for x in sources}, {'release.tar.gz', 'release.sha256', 'release.py', 'deploy-staging.sh'})
                self.assertNotIn('input', kwargs)
            else:
                self.assertEqual(command[2], 'ssh')
                self.assertEqual(command[-2:], ['staging@staging.example.test', 'bash -se'])
                self.assertIn('TRANSFER_ID=123-1', kwargs['input'])
                if phase == 'prepare':
                    for guard in ['test ! -L "$parent"', 'test -O "$parent"', 'stat -c %a', 'mkdir -m 700 "$parent/$TRANSFER_ID"']:
                        self.assertIn(guard, kwargs['input'])
                    self.assertNotIn(self.env['STAGING_DATABASE_NAME'], kwargs['input'])
                else:
                    self.assertIn('export STAGING_DB_DATABASE=private_schema', kwargs['input'])
                    self.assertIn('deploy-staging.sh', kwargs['input'])
                    self.assertIn(self.env['RELEASE_SHA'], kwargs['input'])
                    self.assertNotRegex(kwargs['input'], r'artisan|migrate|db:seed|payments:|refund')
            if fail == 'timeout':
                raise subprocess.TimeoutExpired(command, 60, output='secret-password', stderr='private_schema')
            if fail:
                raise subprocess.CalledProcessError(1, command, output='secret-password', stderr='private_schema')
            return subprocess.CompletedProcess(command, 0, 'secret-password', 'private_schema')

        output = io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            old = Path.cwd()
            try:
                os.chdir(directory)
                transfer = Path('transfer');transfer.mkdir()
                for name in ['release.tar.gz', 'release.sha256', 'release.py', 'deploy-staging.sh']:
                    (transfer/name).write_text('fixture')
                env = {**self.env, 'SSH_AUTH_SOCK': 'unwanted-agent', 'SSH_ASKPASS': 'unwanted-helper'}
                with patch.dict(os.environ, env, clear=True), patch.object(transport.subprocess, 'run', side_effect=run), patch.object(transport.sys, 'argv', ['staging_transport.py', phase]), contextlib.redirect_stdout(output):
                    self.assertEqual(transport.main(), 1 if fail else 0)
            finally:
                os.chdir(old)
        self.assertEqual(len(commands), 2)
        self.assertTrue(known_paths)
        self.assertFalse(known_paths[0].exists())
        for value in [self.env['HOSTINGER_SSH_PASSWORD'], self.env['STAGING_DATABASE_NAME'], self.fingerprint, self.env['HOSTINGER_SSH_HOST']]:
            self.assertNotIn(value, output.getvalue())

    def test_all_three_phases_use_strict_shared_transport_and_clean_up(self):
        for phase in ['prepare', 'upload', 'deploy']:
            with self.subTest(phase=phase):
                self.exercise(phase)

    def test_failures_suppress_output_and_remove_temporary_trust(self):
        for phase in ['prepare', 'upload', 'deploy']:
            with self.subTest(phase=phase):
                self.exercise(phase, fail=True)

    def test_mismatch_stops_before_authenticated_transport(self):
        with patch.dict(os.environ, self.env, clear=True), patch.object(transport.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '', '')) as network:
            with self.assertRaises(ValueError):
                transport.run('prepare')
            self.assertEqual(network.call_count, 1)

    def test_scan_errors_and_timeouts_do_not_leak_secrets(self):
        errors = [subprocess.CalledProcessError(1, ['private_schema'], output='secret-password', stderr=self.fingerprint),
                  subprocess.TimeoutExpired(['private_schema'], 20, output='secret-password', stderr=self.fingerprint)]
        for error in errors:
            with self.subTest(error=type(error).__name__):
                output = io.StringIO()
                with patch.dict(os.environ, self.env, clear=True), patch.object(transport.subprocess, 'run', side_effect=error), patch.object(transport.sys, 'argv', ['transport', 'prepare']), contextlib.redirect_stdout(output):
                    self.assertEqual(transport.main(), 1)
                for secret in ['private_schema', 'secret-password', self.fingerprint]:
                    self.assertNotIn(secret, output.getvalue())

    def test_transport_timeout_suppresses_output_and_cleans_up(self):
        self.exercise('prepare', fail='timeout')

    def test_invalid_transfer_or_release_stops_before_network(self):
        for overrides in [{'TRANSFER_ID': '../other'}, {'TRANSFER_ID': '123-0'}, {'TRANSFER_ID': ''}, {'RELEASE_SHA': 'bad'}]:
            with patch.dict(os.environ, {**self.env, **overrides}, clear=True), patch.object(transport.subprocess, 'run') as network:
                with self.assertRaises(ValueError):
                    transport.run('deploy')
                network.assert_not_called()

    def test_extra_or_linked_upload_inputs_rejected_before_network(self):
        with tempfile.TemporaryDirectory() as directory:
            old = Path.cwd()
            try:
                os.chdir(directory)
                source = Path('transfer');source.mkdir()
                for name in ['release.tar.gz', 'release.sha256', 'release.py', 'deploy-staging.sh']:
                    (source/name).write_text('fixture')
                for kind in ['extra', 'symlink', 'hardlink']:
                    with self.subTest(kind=kind):
                        if kind == 'extra':
                            (source/'extra').write_text('reject')
                        else:
                            (source/'release.py').unlink()
                            if kind == 'symlink':(source/'release.py').symlink_to('release.sha256')
                            else:os.link(source/'release.sha256', source/'release.py')
                        with patch.dict(os.environ, self.env, clear=True), patch.object(transport.subprocess, 'run') as network:
                            with self.assertRaises(ValueError):transport.run('upload')
                            network.assert_not_called()
                        if kind == 'extra':(source/'extra').unlink()
            finally:
                os.chdir(old)


if __name__ == '__main__':
    unittest.main()

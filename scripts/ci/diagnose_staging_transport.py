#!/usr/bin/env python3
"""Use the approved transport's pin/options for identity and SFTP pwd only."""

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile


REVISION = 'b56dea9b14be7e42ab777763d88aac84f72a70f7'
MODULE_SHA256 = '0a94d52df83f12436b0cb75671ca60fda510729be9fb9e37cc6b207c06a3e14a'
IDENTITY_SCRIPT = r'''set -eu
test "$(id -u)" = 399215191
test "$(id -g)" = 2008412601
root="$HOME/domains/dombicenter.com/public_html/staging"
test -d "$root"
test "$(realpath "$root")" = "$root"
printf 'STAGING_IDENTITY_PASS\n%s\n' "$HOME"
'''
SFTP_COMMANDS = 'pwd\nquit\n'


def load_transport(root=Path('pinned-transport')):
    path = root / 'scripts/ci/staging_transport.py'
    if root.is_symlink() or path.is_symlink() or not path.is_file():
        raise ValueError('Invalid pinned transport')
    if hashlib.sha256(path.read_bytes()).hexdigest() != MODULE_SHA256:
        raise ValueError('Transport source differs from approved revision')
    spec = importlib.util.spec_from_file_location('approved_staging_transport', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def diagnose():
    transport = load_transport()
    host, user, password, port, fingerprint, _ = transport.connection_values(os.environ, require_database=False)
    env = transport.child_environment()
    env['LC_ALL'] = 'C'
    scanned = subprocess.run(['ssh-keyscan', '-T', '10', '-p', port, '-t', 'ed25519', host],
                             capture_output=True, text=True, env=env, timeout=20, check=True)
    endpoint = transport.endpoint_name(host, port)
    key = transport.pinned_key(scanned.stdout, fingerprint, endpoint)
    try:
        with tempfile.TemporaryDirectory(prefix='dombi-readonly-transport-') as directory:
            known = Path(directory) / 'known_hosts'
            known.write_text(f'{endpoint} ssh-ed25519 {key}\n')
            known.chmod(0o600)
            options = transport.ssh_options(known)
            env['SSHPASS'] = password
            identity = subprocess.run(
                ['sshpass', '-e', 'ssh', *options, '-T', '-p', port, f'{user}@{host}', 'sh -se'],
                input=IDENTITY_SCRIPT, capture_output=True, text=True, env=env, timeout=45, check=True,
            )
            lines = identity.stdout.splitlines()
            if len(lines) != 2 or lines[0] != 'STAGING_IDENTITY_PASS' or not lines[1].startswith('/'):
                raise ValueError('Unexpected staging identity')
            home = lines[1]
            sftp = subprocess.run(
                ['sshpass', '-e', 'sftp', *options, '-o', 'BatchMode=no', '-P', port, '-b', '-', f'{user}@{host}'],
                input=SFTP_COMMANDS, capture_output=True, text=True, env=env, timeout=45, check=True,
            )
            directories = [line.removeprefix('Remote working directory: ') for line in sftp.stdout.splitlines()
                           if line.startswith('Remote working directory: ')]
            if directories != [home]:
                raise ValueError('SFTP directory differs from SSH home')
    finally:
        env.pop('SSHPASS', None)
    return {
        'approved_transport_revision': REVISION,
        'approved_transport_source_hash': 'PASS',
        'runner_host_port_and_scanned_endpoint': 'PASS',
        'existing_ed25519_fingerprint': 'PASS',
        'strict_host_verification': 'PASS',
        'password_only_authentication': 'PASS',
        'staging_identity': 'PASS',
        'sftp_subsystem': 'PASS',
        'sftp_home_matches_ssh_home': 'PASS',
        'remote_commands': 'identity checks; SFTP pwd and quit only',
        'remote_file_writes': False,
        'database_access': False,
        'temporary_known_hosts_removed': True,
        'child_password_environment_removed': True,
        'credential_files_created': False,
    }


def main():
    try:
        print(json.dumps(diagnose(), sort_keys=True))
        return 0
    except Exception:
        print('READONLY_TRANSPORT_DIAGNOSTIC_FAIL: raw diagnostics suppressed to protect secrets')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

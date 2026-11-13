import json
import os
from pathlib import Path
import re
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name('deploy-staging.sh')
SOURCE = SCRIPT.read_text()
LIST_BLOCK = SOURCE.split('list_dir=\n', 1)[1].split('(umask 077; tar -czf', 1)[0]
LIST_BLOCK = 'list_dir=\n' + LIST_BLOCK


class DeploymentListTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name).resolve()
        self.root = self.base / 'root'
        self.transfer = self.base / 'transfer'
        self.transfer.mkdir(mode=0o700)
        self.tools = self.base / 'tools'
        self.tools.mkdir()
        for name in ['app', 'config', 'routes', 'resources/views', 'database/migrations',
                     'vendor', 'public/build', 'bootstrap/cache']:
            (self.root / name).mkdir(parents=True, exist_ok=True)
        for name in ['artisan', 'composer.json', 'composer.lock', 'bootstrap/app.php',
                     'bootstrap/providers.php', 'vendor/target.php']:
            (self.root / name).write_text('old code')
        self.public_name = 'public/space and\nnewline.txt'
        for name in [self.public_name, 'public/build/asset.js', 'public/new.txt']:
            path = self.transfer / 'runtime' / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('new public code')
        (self.root / self.public_name).write_text('old public code')
        (self.root / 'public/build/asset.js').write_text('old built asset')
        self.find_audit = self.base / 'find-audit.jsonl'
        find = self.tools / 'find'
        find.write_text(f'''#!{sys.executable}
import json, os, pathlib, signal, stat
directory = next(pathlib.Path(os.environ['TEST_TRANSFER']).glob('.find-lists.*'))
assert stat.S_IMODE(directory.stat().st_mode) == 0o700
for name in ['links', 'public']:
    assert stat.S_IMODE((directory / name).stat().st_mode) == 0o600
with open(os.environ['FIND_AUDIT'], 'a') as out:
    out.write(json.dumps({{'directory_mode': '0700', 'file_mode': '0600'}}) + '\\n')
mode = os.environ.get('FIND_MODE', '')
args = __import__('sys').argv[1:]
public = args[0].endswith('/runtime/public')
if mode in ['links-error', 'public-error'] and (public == (mode == 'public-error')):
    os.write(1, b'incomplete name\\x00')
    raise SystemExit(71)
if mode == 'hardlink-error' and '-links' in args:
    raise SystemExit(71)
if mode == 'missing-list' and not public:
    (directory / 'links').unlink()
    raise SystemExit(0)
if mode == 'missing-public-list' and public:
    (directory / 'public').unlink()
    raise SystemExit(0)
if mode == 'missing-hardlink-list' and '-links' in args:
    (directory / 'links').unlink()
    raise SystemExit(0)
if mode.startswith('signal-'):
    os.kill(int(os.environ['TEST_PARENT']), getattr(signal, 'SIG' + mode.removeprefix('signal-')))
    raise SystemExit(0)
os.execv(os.environ['REAL_FIND'], [os.environ['REAL_FIND'], *args])
''')
        find.chmod(0o755)

    def harness(self):
        prefix = '''
set -euo pipefail
trap 'printf "PRIOR_EXIT=%s\\\\n" "$?" >&2' EXIT
trap 'printf "PRIOR_HUP=%s\\\\n" "$?" >&2' HUP
trap 'printf "PRIOR_INT=%s\\\\n" "$?" >&2' INT
trap 'printf "PRIOR_TERM=%s\\\\n" "$?" >&2' TERM
root="$TEST_ROOT"
transfer="$TEST_TRANSFER"
cd "$root"
export TEST_PARENT=$$
'''
        return prefix + LIST_BLOCK + '\nprintf "%s\\0" "${backup[@]}"\n'

    def exercise(self, mode='', success=True):
        env = dict(os.environ, TEST_ROOT=str(self.root), TEST_TRANSFER=str(self.transfer),
                   FIND_MODE=mode, FIND_AUDIT=str(self.find_audit), REAL_FIND=shutil.which('find'),
                   PATH=str(self.tools) + os.pathsep + os.environ['PATH'])
        result = subprocess.run(['bash', '-s'], input=self.harness().encode(), env=env,
                                capture_output=True, timeout=20)
        self.assertEqual(result.returncode == 0, success, result.stderr.decode())
        self.assertFalse(list(self.transfer.glob('.find-lists.*')))
        self.assertFalse((self.transfer / 'before-code.tar.gz').exists())
        self.assertTrue(self.find_audit.is_file())
        records = [json.loads(line) for line in self.find_audit.read_text().splitlines()]
        self.assertTrue(all(r == {'directory_mode': '0700', 'file_mode': '0600'} for r in records))
        self.assertIn(f'PRIOR_EXIT={result.returncode}'.encode(), result.stderr)
        return result

    def test_parent_array_nul_paths_restrictive_modes_and_success_cleanup(self):
        result = self.exercise()
        names = result.stdout.decode().split('\0')[:-1]
        self.assertIn(self.public_name, names)
        self.assertIn('vendor', names)
        self.assertNotIn('public/build/asset.js', names)
        self.assertNotIn('public/new.txt', names)
        self.assertEqual(names.count(self.public_name), 1)

    def test_all_find_failures_stop_and_clean_partial_lists(self):
        for mode, error in [('links-error', 'Managed symlink enumeration failed'),
                            ('hardlink-error', 'Managed hard-link enumeration failed'),
                            ('public-error', 'Public backup enumeration failed')]:
            with self.subTest(mode=mode):
                result = self.exercise(mode, success=False)
                self.assertIn(error.encode(), result.stderr)
                self.assertEqual(result.stdout, b'')

    def test_missing_list_is_not_success(self):
        for mode in ['missing-list', 'missing-public-list', 'missing-hardlink-list']:
            with self.subTest(mode=mode):
                self.exercise(mode, success=False)

    def test_vendor_internal_link_with_newline_is_allowed(self):
        (self.root / 'vendor/link with\nnewline').symlink_to('target.php')
        self.exercise()

    def test_application_link_is_rejected_and_cleanup_preserves_target(self):
        target = self.root / 'vendor/target.php'
        (self.root / 'app/link with\nnewline').symlink_to(target)
        self.exercise(success=False)
        self.assertEqual(target.read_text(), 'old code')

    def test_vendor_external_link_is_rejected(self):
        (self.root / 'vendor/external').symlink_to(self.root / 'artisan')
        self.exercise(success=False)

    def test_existing_hardlink_is_still_rejected(self):
        os.link(self.root / 'artisan', self.root / 'app/hardlink')
        self.exercise(success=False)

    def test_signals_cleanup_and_preserve_existing_handlers(self):
        for name in ['HUP', 'INT', 'TERM']:
            with self.subTest(signal=name):
                result = self.exercise('signal-' + name, success=False)
                self.assertEqual(result.returncode, 128 + getattr(signal, 'SIG' + name))
                self.assertIn(('PRIOR_' + name + '=').encode(), result.stderr)

    def test_no_process_substitution_or_dev_fd_dependency(self):
        self.assertNotRegex(SOURCE, r'[<>]\s*\(')
        self.assertNotIn('/dev/fd', SOURCE)

    @unittest.skipUnless(sys.platform.startswith('linux'), 'Linux-only chroot regression; run in hosted CI')
    def test_actual_chroot_without_dev_fd(self):
        jail = self.base / 'jail'
        jail.mkdir()
        if os.geteuid() == 0:
            command = ['chroot']
        elif shutil.which('sudo') and subprocess.run(
                ['sudo', '-n', 'true'], capture_output=True).returncode == 0:
            command = ['sudo', '-n', 'chroot']
        else:
            self.skipTest('Root or passwordless sudo required for isolated no-/dev/fd regression')
        binaries = [shutil.which(tool) for tool in ['bash', 'find', 'mktemp', 'rm', 'rmdir', 'realpath']]
        for binary in binaries:
            dependencies = subprocess.check_output(['ldd', binary], text=True)
            paths = [binary, *re.findall(r'(/[^\s()]+)', dependencies)]
            for name in paths:
                path = jail / name.lstrip('/')
                path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(name, path)
                path.chmod(stat.S_IMODE(Path(name).stat().st_mode))
        shutil.copytree(self.root, jail / 'case/root', symlinks=True)
        shutil.copytree(self.transfer, jail / 'case/transfer', symlinks=True)
        harness = jail / 'case/harness.sh'
        harness.write_text('export TEST_ROOT=/case/root TEST_TRANSFER=/case/transfer\n' + self.harness())
        self.assertFalse((jail / 'dev/fd').exists())
        result = subprocess.run([*command, str(jail), binaries[0], '/case/harness.sh'],
                                capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        self.assertIn(self.public_name.encode() + b'\0', result.stdout)
        self.assertFalse(list((jail / 'case/transfer').glob('.find-lists.*')))
        self.assertFalse((jail / 'dev/fd').exists())


if __name__ == '__main__':
    unittest.main()

import os
from pathlib import Path
import shutil
import stat
import subprocess
import tarfile
import unittest

import release
import test_release


@unittest.skipUnless(all(shutil.which(tool) for tool in ('rsync', 'flock', 'realpath', 'sha256sum')),
                     'Linux staging filesystem tools required; exercised on GitHub runner')
class DeploymentTests(unittest.TestCase):
    def exercise(self, fail_discovery=False):
        fixture = test_release.ReleaseTests()
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        paths = ('config/app.php', 'routes/web.php', 'resources/views/app.blade.php', 'database/migrations/0001.php')
        for name in paths:
            path = fixture.repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('fixture runtime')
        subprocess.run(['git', '-C', str(fixture.repo), 'add', '--', *paths], check=True, capture_output=True)
        subprocess.run(['git', '-C', str(fixture.repo), '-c', 'user.name=CI', '-c', 'user.email=ci@example.invalid',
                        'commit', '-qm', 'deployment fixture'], check=True, capture_output=True)
        sha = subprocess.check_output(['git', '-C', str(fixture.repo), 'rev-parse', 'HEAD'], text=True).strip()
        home = fixture.root / 'home'
        root = home / 'domains/dombicenter.com/public_html/staging'
        transfer = home / 'dombi-ci-staging/123-1'
        transfer.mkdir(parents=True)
        release.pack(fixture.repo, fixture.vendor, sha, transfer / 'packed')
        for name in ('release.tar.gz', 'release.sha256'):
            shutil.move(transfer / 'packed' / name, transfer / name)
        shutil.copy2(Path(release.__file__), transfer / 'release.py')
        protected = ('.env', '.git/HEAD', 'storage/app/public/customer.jpg',
                     'storage/framework/sessions/existing', 'storage/framework/cache/data/existing',
                     'database/staging.sqlite', 'public/uploads/customer.jpg')
        for name in protected:
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('preserve ' + name)
            path.chmod(0o640)
        for name in ('bootstrap/cache', 'storage/framework/views', 'vendor', 'app', 'config',
                     'routes', 'resources/views', 'database/migrations', 'public/build'):
            path = root / name
            path.mkdir(parents=True, exist_ok=True)
            if name in ('vendor', 'app', 'public/build'):
                (path / 'obsolete.php').write_text('obsolete code')
        (root / 'public/storage').symlink_to(root / 'storage/app/public', target_is_directory=True)
        uploads = root / 'storage/app/public'
        uploads.chmod(0o755)
        uploads_before = (stat.S_IMODE(uploads.stat().st_mode), uploads.stat().st_uid, uploads.stat().st_gid)
        tools = fixture.root / 'tools'
        tools.mkdir()
        php = tools / 'php'
        php.write_text('''#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$COMMAND_LOG"
if [[ "$1" == -r ]]; then exit 0; fi
case "$2" in
  env) echo 'The application environment is [staging].' ;;
  down) echo '{}' > storage/framework/down ;;
  up) rm storage/framework/down ;;
  package:discover)
    test "${FAIL_DISCOVERY:-0}" != 1
    printf '<?php return [];\\n' > "$APP_PACKAGES_CACHE"
    printf '<?php return [];\\n' > "$APP_SERVICES_CACHE" ;;
  config:clear|route:clear|view:clear) ;;
  *) echo 'Unexpected Artisan command rejected by fixture' >&2; exit 95 ;;
esac
''')
        php.chmod(0o755)
        before = {name: ((root / name).read_bytes(), stat.S_IMODE((root / name).stat().st_mode),
                         (root / name).stat().st_uid, (root / name).stat().st_gid) for name in protected}
        env = dict(os.environ, HOME=str(home), PATH=str(tools) + os.pathsep + os.environ['PATH'],
                   STAGING_DB_DATABASE='fixture_only', FAIL_DISCOVERY='1' if fail_discovery else '0',
                   COMMAND_LOG=str(fixture.root / 'php-commands.log'))
        result = subprocess.run(['bash', str(Path(__file__).with_name('deploy-staging.sh')), str(transfer), sha],
                                env=env, text=True, capture_output=True)
        self.assertEqual(result.returncode != 0, fail_discovery, result.stdout + result.stderr)
        commands = [line.split()[1] for line in Path(env['COMMAND_LOG']).read_text().splitlines()
                    if line.startswith('artisan ')]
        expected_commands = ['env', 'down', 'package:discover']
        if not fail_discovery:
            expected_commands += ['config:clear', 'route:clear', 'view:clear', 'up']
        self.assertEqual(commands, expected_commands)
        for name, expected in before.items():
            self.assertEqual(((root / name).read_bytes(), stat.S_IMODE((root / name).stat().st_mode),
                              (root / name).stat().st_uid, (root / name).stat().st_gid), expected)
        self.assertEqual((stat.S_IMODE(uploads.stat().st_mode), uploads.stat().st_uid, uploads.stat().st_gid), uploads_before)
        self.assertTrue((root / 'public/storage').is_symlink())
        self.assertEqual((root / 'storage/framework/down').exists(), fail_discovery)
        self.assertEqual((transfer / 'deployed-release.json').exists(), not fail_discovery)
        for name in ('app/obsolete.php', 'vendor/obsolete.php', 'public/build/obsolete.php'):
            self.assertFalse((root / name).exists())
        self.assertEqual(stat.S_IMODE(transfer.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE((transfer / 'before-code.tar.gz').stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE((root / 'app/Example.php').stat().st_mode), 0o644)
        with tarfile.open(transfer / 'before-code.tar.gz') as backup:
            self.assertNotIn('.env', backup.getnames())
            self.assertNotIn('storage', backup.getnames())

    def test_preserve_persistent_files_and_permissions(self):
        self.exercise()

    def test_post_copy_failure_stays_closed_without_data_changes(self):
        self.exercise(fail_discovery=True)


if __name__ == '__main__':
    unittest.main()

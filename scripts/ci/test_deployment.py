import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tarfile
import unittest
from unittest.mock import patch

import release
import staging_attempt_guard
import test_release


@unittest.skipUnless(all(shutil.which(tool) for tool in ('rsync', 'realpath', 'sha256sum')),
                     'Linux staging filesystem tools required; exercised on GitHub runner')
class DeploymentTests(unittest.TestCase):
    def exercise(self, fail_discovery=False, run_rollback=False, fail_rollback_health=False,
                 interrupt_after_claim=False):
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
        parent = home / 'dombi-ci-staging'
        parent.mkdir(parents=True, mode=0o700)
        parent.chmod(0o700)
        transfer = parent / '123-1'
        transfer.mkdir()
        release.pack(fixture.repo, fixture.vendor, sha, transfer / 'packed')
        for name in ('release.tar.gz', 'release.sha256'):
            shutil.move(transfer / 'packed' / name, transfer / name)
        shutil.copy2(Path(release.__file__), transfer / 'release.py')
        claim = {
            'version': 1,
            'repository': staging_attempt_guard.REPOSITORY,
            'actor': staging_attempt_guard.OWNER,
            'ref': staging_attempt_guard.REF,
            'workflow_ref': staging_attempt_guard.WORKFLOW_REF,
            'workflow_sha': 'c' * 40,
            'source_sha': 'c' * 40,
            'release_sha': sha,
            'ci_run_id': '43720516972',
            'artifact_id': '14164321503',
            'artifact_run_id': '43720516972',
            'archive_sha256': (transfer / 'release.sha256').read_text().split()[0],
            'github_run_id': '123',
            'github_run_attempt': '1',
            'transfer_id': '123-1',
        }
        with patch.dict(os.environ, {'HOME': str(home)}):
            staging_attempt_guard.create_claim(parent, claim)
        protected = ('.env', '.git/HEAD', 'storage/app/public/customer.jpg',
                     'storage/framework/sessions/existing', 'storage/framework/cache/data/existing',
                     'database/staging.sqlite', 'public/uploads/customer.jpg')
        for name in protected:
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('preserve ' + name)
            path.chmod(0o640)
        for name in ('bootstrap/cache', 'storage/framework/views', 'storage/framework/cache',
                     'vendor', 'app', 'config', 'routes', 'resources/views',
                     'database/migrations', 'public/build/assets'):
            path = root / name
            path.mkdir(parents=True, exist_ok=True)
        old_files = {
            'artisan': 'old artisan',
            'composer.json': 'old composer',
            'composer.lock': 'old lock',
            'bootstrap/app.php': 'old bootstrap',
            'bootstrap/providers.php': 'old providers',
            'bootstrap/cache/config.php': 'old config cache',
            'bootstrap/cache/routes-v7.php': 'old route cache',
            'bootstrap/cache/packages.php': 'old packages cache',
            'bootstrap/cache/services.php': 'old services cache',
            'vendor/autoload.php': 'old autoload',
            'vendor/obsolete.php': 'old vendor',
            'app/Example.php': 'old app',
            'config/app.php': 'old config',
            'routes/web.php': 'old route',
            'resources/views/app.blade.php': 'old view',
            'database/migrations/0001.php': 'old migration',
            'public/index.php': 'old public',
            'public/build/manifest.json': '{"old.js":{"file":"assets/app.old.css"}}',
            'public/build/assets/app.old.css': 'old asset',
            'public/build/obsolete.css': 'obsolete build asset',
        }
        for name, contents in old_files.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(contents)
        (root / 'storage/framework/views/compiled.php').write_text('compiled view cache')
        (root / 'public/storage').symlink_to(root / 'storage/app/public', target_is_directory=True)
        uploads = root / 'storage/app/public'
        uploads.chmod(0o755)
        uploads_before = (stat.S_IMODE(uploads.stat().st_mode), uploads.stat().st_uid, uploads.stat().st_gid)
        tools = fixture.root / 'tools'
        tools.mkdir()
        flock = tools / 'flock'
        flock.write_text('#!/usr/bin/env bash\nexit 0\n')
        flock.chmod(0o755)
        stat_tool = tools / 'stat'
        stat_tool.write_text(f'''#!/usr/bin/env bash
set -eu
if [[ "$1" == "-c" && "$2" == "%a" ]]; then
  exec "{sys.executable}" -c 'import os,stat,sys; print(format(stat.S_IMODE(os.stat(sys.argv[1]).st_mode), "o"))' "$3"
fi
exit 2
''')
        stat_tool.chmod(0o755)
        php = tools / 'php'
        php.write_text('''#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$COMMAND_LOG"
if [[ "$1" == -r ]]; then exit 0; fi
case "$2" in
  env) echo 'The application environment is [staging].' ;;
  down) echo '{}' > storage/framework/down ;;
  up) rm -f storage/framework/down ;;
  package:discover)
    test "${FAIL_DISCOVERY:-0}" != 1
    printf '<?php return [];\\n' > "$APP_PACKAGES_CACHE"
    printf '<?php return [];\\n' > "$APP_SERVICES_CACHE" ;;
  config:clear) rm -f bootstrap/cache/config.php ;;
  route:clear) rm -f bootstrap/cache/routes-v7.php ;;
  view:clear) find storage/framework/views -type f -delete ;;
  *) echo 'Unexpected Artisan command rejected by fixture' >&2; exit 95 ;;
esac
''')
        php.chmod(0o755)
        before = {name: ((root / name).read_bytes(), stat.S_IMODE((root / name).stat().st_mode),
                         (root / name).stat().st_uid, (root / name).stat().st_gid) for name in protected}
        env = dict(os.environ, HOME=str(home), PATH=str(tools) + os.pathsep + os.environ['PATH'],
                   STAGING_DB_DATABASE='fixture_only', FAIL_DISCOVERY='1' if fail_discovery else '0',
                   STAGING_WORKFLOW_SHA='c' * 40, STAGING_RELEASE_SHA=sha,
                   COMMAND_LOG=str(fixture.root / 'php-commands.log'), COPYFILE_DISABLE='1')
        (home / 'dombi-ci-staging').chmod(0o700)
        transfer.chmod(0o700)
        for name in ('rollback-staging.sh', 'staging_rollback.py', 'staging_attempt_guard.py'):
            shutil.copy2(Path(__file__).with_name(name), transfer / name)
        (transfer / 'health.py').write_text('''import hashlib
import json
import os
from pathlib import Path
import sys

root = Path(sys.argv[1])
release = json.loads((root / 'release.json').read_text())
for name, checksum in release['files'].items():
    if hashlib.sha256(Path(name).read_bytes()).hexdigest() != checksum:
        raise SystemExit('fixture asset check failed')
with open(os.environ['COMMAND_LOG'], 'a') as log:
    log.write('health fixture\\\\n')
if os.environ.get('FAIL_ROLLBACK_HEALTH') == '1':
    raise SystemExit(1)
        ''')
        env['FAIL_ROLLBACK_HEALTH'] = '1' if fail_rollback_health else '0'
        if interrupt_after_claim:
            self.assertEqual((root / 'app/Example.php').read_text(), 'old app')
            self.assertFalse((root / 'storage/framework/down').exists())
            self.assertTrue(staging_attempt_guard.claim_path(parent, sha).is_dir())
            with patch.dict(os.environ, {'HOME': str(home)}):
                with self.assertRaisesRegex(ValueError, 'already consumed'):
                    staging_attempt_guard.create_claim(parent, {**claim, 'github_run_id': '124',
                                                                 'transfer_id': '124-1'})
            return
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
        for name in ('app/old.php', 'vendor/obsolete.php', 'public/build/obsolete.css'):
            self.assertFalse((root / name).exists())
        self.assertEqual(stat.S_IMODE(transfer.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE((transfer / 'before-code.tar.gz').stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE((root / 'app/Example.php').stat().st_mode), 0o644)
        with tarfile.open(transfer / 'before-code.tar.gz') as backup:
            self.assertNotIn('.env', backup.getnames())
            self.assertNotIn('storage', backup.getnames())
        self.assertEqual((root / 'storage/framework/views/compiled.php').exists(), fail_discovery)

        if run_rollback:
            env['FAIL_DISCOVERY'] = '0'
            rollback_script = str(transfer / 'rollback-staging.sh')
            restored = subprocess.run(
                ['bash', rollback_script, str(transfer), 'restore'],
                env=env, text=True, capture_output=True,
            )
            self.assertEqual(restored.returncode, 0, restored.stdout + restored.stderr)
            self.assertTrue((root / 'storage/framework/down').exists())
            shutil.copy2(transfer / 'rollback-release.json', transfer / 'release.json')

            activated = subprocess.run(
                ['bash', rollback_script, str(transfer), 'activate'],
                env=env, text=True, capture_output=True,
            )
            self.assertEqual(activated.returncode, 0, activated.stdout + activated.stderr)
            self.assertFalse((root / 'storage/framework/down').exists())

            # The fixture acceptance consumes the restored inventory and hashes the
            # deployed files; injected failure models a failed external HTTP probe.
            acceptance = subprocess.run(
                [sys.executable, str(transfer / 'health.py'), str(transfer)],
                cwd=root, env=env, text=True, capture_output=True,
            )
            self.assertEqual(acceptance.returncode != 0, fail_rollback_health,
                             acceptance.stdout + acceptance.stderr)
            disposition = 'close' if fail_rollback_health else 'complete'
            finalized = subprocess.run(
                ['bash', rollback_script, str(transfer), disposition],
                env=env, text=True, capture_output=True,
            )
            self.assertEqual(finalized.returncode, 0, finalized.stdout + finalized.stderr)
            self.assertEqual((root / 'storage/framework/down').exists(), fail_rollback_health)
            self.assertFalse((root / 'storage/framework/maintenance.php').exists())
            self.assertEqual((root / 'app/Example.php').read_text(), 'old app')
            self.assertEqual((root / 'config/app.php').read_text(), 'old config')
            self.assertEqual((root / 'routes/web.php').read_text(), 'old route')
            self.assertEqual((root / 'resources/views/app.blade.php').read_text(), 'old view')
            self.assertEqual((root / 'database/migrations/0001.php').read_text(), 'old migration')
            self.assertTrue((root / 'vendor/obsolete.php').is_file())
            self.assertEqual(json.loads((root / 'public/build/manifest.json').read_text()),
                             {'old.js': {'file': 'assets/app.old.css'}})
            self.assertTrue((root / 'public/build/assets/app.old.css').is_file())
            self.assertFalse((root / 'public/build/app.js').exists())
            self.assertFalse((root / 'bootstrap/cache/config.php').exists())
            self.assertFalse((root / 'bootstrap/cache/routes-v7.php').exists())
            self.assertIn('[]', (root / 'bootstrap/cache/packages.php').read_text())
            self.assertIn('[]', (root / 'bootstrap/cache/services.php').read_text())
            self.assertFalse((root / 'storage/framework/views/compiled.php').exists())
            self.assertTrue((root / 'storage/framework/cache/data/existing').is_file())
            self.assertEqual((root / 'storage/framework/sessions/existing').read_text(),
                             'preserve storage/framework/sessions/existing')
            if not fail_rollback_health:
                self.assertTrue((transfer / 'rollback-complete.json').is_file())
                self.assertFalse(any(transfer.glob('rollback-extract.*')))

        self.assertTrue(staging_attempt_guard.claim_path(parent, sha).is_dir())
        with patch.dict(os.environ, {'HOME': str(home)}):
            with self.assertRaisesRegex(ValueError, 'already consumed'):
                staging_attempt_guard.create_claim(parent, {**claim, 'github_run_id': '124',
                                                             'transfer_id': '124-1'})

    def test_preserve_persistent_files_and_permissions(self):
        self.exercise()

    def test_post_copy_failure_stays_closed_without_data_changes(self):
        self.exercise(fail_discovery=True)

    def test_partial_deployment_recovers_old_code_caches_and_operational_state(self):
        self.exercise(fail_discovery=True, run_rollback=True)

    def test_interrupted_after_claim_cannot_retry_or_touch_staging(self):
        self.exercise(interrupt_after_claim=True)

    def test_failed_rollback_acceptance_leaves_staging_closed(self):
        self.exercise(fail_discovery=True, run_rollback=True, fail_rollback_health=True)

if __name__ == '__main__':
    unittest.main()

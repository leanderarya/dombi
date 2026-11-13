import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import health
import release


class HealthTests(unittest.TestCase):
    def test_dependencies_and_all_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = {'files': {'public/build/app.js': release.digest(b'asset')}}
            Path(directory, 'release.json').write_text(json.dumps(manifest))
            responses = {'up': b'ok', 'api/health': json.dumps({'status': 'healthy',
                         'checks': dict(database=True, cache=True, storage=True, scheduler=False)}).encode(),
                         '': b'<html><div data-page="{}"></div></html>',
                         'login': b'<html><div data-page="{}"></div></html>',
                         'build/app.js': b'asset'}
            with patch.object(health, 'fetch', side_effect=lambda name: responses[name]) as fetch:
                with contextlib.redirect_stdout(io.StringIO()):
                    health.main(directory)
                self.assertEqual(fetch.call_count, 5)
            responses['build/app.js'] = b'stale'
            with patch.object(health, 'fetch', side_effect=lambda name: responses[name]):
                with self.assertRaisesRegex(ValueError, 'mismatch'):
                    health.main(directory)

    def test_degraded_rejected(self):
        with patch.object(health, 'fetch', side_effect=[b'ok', b'{"status":"degraded"}']):
            with self.assertRaisesRegex(ValueError, 'Unhealthy'):
                health.main('.')

    def test_redirect_rejected_without_network(self):
        class Response:
            status = 200
            url = 'https://app.dombicenter.com/up'
            def __enter__(self): return self
            def __exit__(self, *args): pass
        with patch.object(health, 'urlopen', return_value=Response()), patch.object(health.time, 'sleep'):
            with self.assertRaisesRegex(ValueError, 'redirected'):
                health.fetch('up')

    def test_redirect_is_not_followed(self):
        self.assertIsNone(health.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://app.dombicenter.com/up'))


if __name__ == '__main__':
    unittest.main()

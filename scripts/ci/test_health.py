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
    def test_liveness_and_all_assets_without_session_or_write_routes(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = {'files': {'public/build/app.js': release.digest(b'asset')}}
            Path(directory, 'release.json').write_text(json.dumps(manifest))
            responses = {'up': b'{"status":"up"}',
                          'build/app.js': b'asset'}
            with patch.object(health, 'fetch', side_effect=lambda name: responses[name]) as fetch:
                with contextlib.redirect_stdout(io.StringIO()):
                    health.main(directory)
                self.assertEqual([call.args[0] for call in fetch.call_args_list], ['up', 'build/app.js'])
            responses['build/app.js'] = b'stale'
            with patch.object(health, 'fetch', side_effect=lambda name: responses[name]):
                with self.assertRaisesRegex(ValueError, 'mismatch'):
                    health.main(directory)

    def test_down_rejected(self):
        with patch.object(health, 'fetch', return_value=b'{"status":"down"}'):
            with self.assertRaisesRegex(ValueError, 'Unhealthy'):
                health.main('.')

    def test_invalid_liveness_json_rejected(self):
        with patch.object(health, 'fetch', return_value=b'<html>maintenance</html>'):
            with self.assertRaises(json.JSONDecodeError):
                health.main('.')

    def test_write_session_and_unsafe_routes_rejected_before_network(self):
        paths = ['api/health', '', 'login', 'customer/home', 'owner/dashboard',
                 'payment/doku/notify', 'build/../login', 'build/./app.js',
                 'build//app.js', '/build/app.js', 'build/app.php',
                 'build/app.js?redirect=/login', 'build/%2e%2e/login',
                 'build/app.js#fragment', 'https://example.com/app.js']
        with patch.object(health, 'urlopen') as network:
            for path in paths:
                with self.subTest(path=path), self.assertRaisesRegex(ValueError, 'Only /up'):
                    health.fetch(path)
            network.assert_not_called()

    def test_json_request_has_no_cookie_or_authorization(self):
        class Response:
            status = 200
            url = health.BASE + 'up'
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"status":"up"}'
        with patch.object(health, 'urlopen', return_value=Response()) as network:
            self.assertEqual(health.fetch('up'), b'{"status":"up"}')
            request = network.call_args.args[0]
            self.assertEqual(request.get_method(), 'GET')
            self.assertEqual(request.headers, {'Accept': 'application/json'})
            self.assertIsNone(request.data)

    def test_bad_status_and_failed_network_rejected(self):
        class Response:
            status = 503
            url = health.BASE + 'up'
            def __enter__(self): return self
            def __exit__(self, *args): pass
        with patch.object(health, 'urlopen', return_value=Response()), patch.object(health.time, 'sleep'):
            with self.assertRaisesRegex(ValueError, 'Non-2xx'):
                health.fetch('up')
        with patch.object(health, 'urlopen', side_effect=TimeoutError), patch.object(health.time, 'sleep'):
            with self.assertRaises(TimeoutError):
                health.fetch('up')

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

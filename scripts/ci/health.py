#!/usr/bin/env python3
"""Staging-only HTTP checks. No production URL or runtime reset option."""

import hashlib
import json
from pathlib import Path
import sys
import time
from urllib.request import HTTPRedirectHandler, build_opener


BASE = 'https://staging.dombicenter.com/'


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


urlopen = build_opener(NoRedirect()).open


def fetch(path):
    for attempt in range(4):
        try:
            with urlopen(BASE + path, timeout=30) as response:
                if not 200 <= response.status < 300 or response.url != BASE + path:
                    raise ValueError('Non-2xx or redirected health/asset response')
                return response.read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(5)


def main(root):
    root = Path(root)
    fetch('up')
    health = json.loads(fetch('api/health'))
    if health.get('status') != 'healthy' or any(
        health.get('checks', {}).get(key) is not True for key in ('database', 'cache', 'storage')
    ):
        raise ValueError('Unhealthy staging dependencies')
    release = json.loads((root / 'release.json').read_text())
    assets = {name: checksum for name, checksum in release['files'].items() if name.startswith('public/build/')}
    for name, checksum in assets.items():
        if hashlib.sha256(fetch(name.removeprefix('public/'))).hexdigest() != checksum:
            raise ValueError('Deployed asset mismatch: ' + name)
    for route in ('', 'login'):
        page = fetch(route).lower()
        if b'<html' not in page or b'data-page' not in page:
            raise ValueError('Expected Inertia application page: /' + route)
    print(f'STAGING HEALTH PASS: /up, /api/health, /, /login, {len(assets)} asset checksums; scheduler informational only')


if __name__ == '__main__':
    main(sys.argv[1])

#!/usr/bin/env python3
"""Staging JSON liveness and static assets only; no sessions or dependency writes."""

import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys
import time
from urllib.request import HTTPRedirectHandler, Request, build_opener


BASE = 'https://staging.dombicenter.com/'


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


urlopen = build_opener(NoRedirect()).open


def fetch(path):
    if path != 'up' and not (
        re.fullmatch(r'build/[A-Za-z0-9_./-]+', path) and
        str(PurePosixPath(path)) == path and '..' not in PurePosixPath(path).parts and
        PurePosixPath(path).suffix.lower() in {
            '.js', '.css', '.json', '.map', '.png', '.jpg', '.jpeg', '.gif',
            '.svg', '.webp', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot',
        }
    ):
        raise ValueError('Only /up and static build assets may be probed')
    request = Request(BASE + path, headers={'Accept': 'application/json'} if path == 'up' else {})
    for attempt in range(4):
        try:
            with urlopen(request, timeout=30) as response:
                if not 200 <= response.status < 300 or response.url != BASE + path:
                    raise ValueError('Non-2xx or redirected health/asset response')
                return response.read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(5)


def main(root):
    root = Path(root)
    if json.loads(fetch('up')).get('status') != 'up':
        raise ValueError('Unhealthy staging application')
    release = json.loads((root / 'release.json').read_text())
    assets = {name: checksum for name, checksum in release['files'].items() if name.startswith('public/build/')}
    for name, checksum in assets.items():
        if hashlib.sha256(fetch(name.removeprefix('public/'))).hexdigest() != checksum:
            raise ValueError('Deployed asset mismatch: ' + name)
    print(f'STAGING LIVENESS/ASSETS PASS: JSON /up, {len(assets)} asset checksums; '
          'database/cache/storage health, session pages and business smoke not checked')


if __name__ == '__main__':
    main(sys.argv[1])

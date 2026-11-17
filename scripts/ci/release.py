#!/usr/bin/env python3
"""Build and validate a runtime-only release; never include mutable Laravel state."""

import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile


TREES = ('app/', 'config/', 'routes/', 'resources/views/', 'database/migrations/')
FILES = ('artisan', 'composer.json', 'composer.lock', 'bootstrap/app.php', 'bootstrap/providers.php')


def allowed(name):
    path = PurePosixPath(name)
    if path.is_absolute() or str(path) != name or '..' in path.parts:
        return False
    if any(part.startswith('.env') or part == '.git' for part in path.parts):
        return False
    return (name in FILES or name.startswith(TREES + ('vendor/', 'public/'))) and not (
        name.startswith(('vendor/bin/', 'public/storage/')) or
        name in ('public/storage', 'public/hot', 'public/build.zip')
    )


def digest(data):
    return hashlib.sha256(data).hexdigest()


def pack(root, vendor, sha, output):
    if not re.fullmatch('[a-f0-9]{40}', sha):
        raise ValueError('Full commit SHA required')
    root, vendor, output = Path(root), Path(vendor), Path(output)
    actual = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
    if actual != sha:
        raise ValueError('Checkout SHA mismatch')
    tracked = subprocess.check_output(['git', '-C', str(root), 'ls-files', '-z']).decode().split('\0')
    names = [name for name in tracked if allowed(name) and not name.startswith(('vendor/', 'public/build/'))]
    # Dirty runtime source cannot be labeled as an immutable commit artifact.
    subprocess.run(['git', '-C', str(root), 'diff', '--exit-code', 'HEAD', '--', *names], check=True,
                   stdout=subprocess.DEVNULL)
    sources = {name: root / name for name in names}
    for base, prefix in ((vendor, 'vendor/'), (root / 'public/build', 'public/build/')):
        for path in base.rglob('*'):
            name = prefix + path.relative_to(base).as_posix()
            if path.is_symlink() and allowed(name):
                resolved = path.resolve()
                if prefix != 'vendor/' or not resolved.is_relative_to(vendor.resolve()) or not resolved.is_file():
                    raise ValueError('Unsafe symlink in release input')
                if '.git' in resolved.relative_to(vendor.resolve()).parts:
                    raise ValueError('Git metadata link in release input')
                sources[name] = resolved
                continue
            if path.is_file() and allowed(name):
                sources[name] = path
    for required in ('vendor/autoload.php', 'public/build/manifest.json', *FILES):
        if required not in sources:
            raise ValueError('Required runtime file missing: ' + required)
    contents = {}
    for name, path in sorted(sources.items()):
        if path.is_symlink() or not path.is_file():
            raise ValueError('Only regular runtime files allowed')
        contents[name] = path.read_bytes()
    manifest = {'schema': 1, 'sha': sha, 'files': {name: digest(data) for name, data in contents.items()}}
    contents['release.json'] = (json.dumps(manifest, sort_keys=True, indent=2) + '\n').encode()
    output.mkdir(parents=True, exist_ok=False)
    archive = output / 'release.tar.gz'
    with archive.open('xb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as tar:
            for name, data in sorted(contents.items()):
                member = tarfile.TarInfo(name)
                member.size, member.mode = len(data), 0o644
                tar.addfile(member, io.BytesIO(data))
    checksum = digest(archive.read_bytes())
    (output / 'release.sha256').write_text(checksum + '  release.tar.gz\n')
    verify(archive, sha, checksum)
    print(f'PACK PASS {sha} {checksum} ({len(sources)} runtime files)')


def verify(archive, sha, checksum, output=None):
    if not re.fullmatch('[a-f0-9]{40}', sha) or not re.fullmatch('[a-f0-9]{64}', checksum):
        raise ValueError('Full commit SHA and SHA-256 required')
    data = Path(archive).read_bytes()
    if digest(data) != checksum:
        raise ValueError('Archive checksum mismatch')
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tar:
        members = tar.getmembers()
        names = [m.name for m in members]
        if len(set(names)) != len(names):
            raise ValueError('Duplicate archive member')
        for member in members:
            if not member.isfile() or member.mode != 0o644 or not (allowed(member.name) or member.name == 'release.json'):
                raise ValueError('Unsafe archive member')
        manifest = json.load(tar.extractfile('release.json'))
        if manifest.get('schema') != 1 or manifest.get('sha') != sha:
            raise ValueError('Release identity mismatch')
        files = manifest['files']
        if set(files) != set(names) - {'release.json'}:
            raise ValueError('Archive inventory mismatch')
        for required in ('vendor/autoload.php', 'public/build/manifest.json', *FILES):
            if required not in files:
                raise ValueError('Incomplete runtime inventory')
        for name, expected in files.items():
            if digest(tar.extractfile(name).read()) != expected:
                raise ValueError('Runtime file checksum mismatch')
        # Avoid extractall: validated regular files only, into a brand-new directory.
        if output is not None:
            destination = Path(output)
            destination.mkdir(parents=False, exist_ok=False, mode=0o755)
            for member in members:
                path = destination / member.name
                path.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                with path.open('xb') as target:
                    target.write(tar.extractfile(member).read())
                path.chmod(0o644)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('pack', 'verify', 'extract'))
    parser.add_argument('--root', default='.')
    parser.add_argument('--vendor')
    parser.add_argument('--sha', required=True)
    parser.add_argument('--output')
    parser.add_argument('--archive')
    parser.add_argument('--checksum')
    parser.add_argument('--checksum-file')
    args = parser.parse_args()
    if args.command == 'pack':
        pack(args.root, args.vendor, args.sha, args.output)
    else:
        checksum = args.checksum or Path(args.checksum_file).read_text().split()[0]
        verify(args.archive, args.sha, checksum, args.output if args.command == 'extract' else None)
        print('INTEGRITY PASS ' + args.sha)


if __name__ == '__main__':
    main()

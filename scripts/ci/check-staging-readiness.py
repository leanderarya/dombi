#!/usr/bin/env python3
"""Authenticate with staging secrets and query connection identity only."""

import base64
import hashlib
import json
import os
import re
import struct
import subprocess
import tempfile
from pathlib import Path


DATABASE_PROBE = r"""
ob_start();
try {
    $root = getenv('HOME').'/domains/dombicenter.com/public_html/staging';
    if (realpath($root) !== $root || !chdir($root)) {
        throw new RuntimeException();
    }
    $before = hash_file('sha256', '.env');
    require $root.'/vendor/autoload.php';
    $app = new Illuminate\Foundation\Application($root);
    $app->bootstrapWith([
        Illuminate\Foundation\Bootstrap\LoadEnvironmentVariables::class,
        Illuminate\Foundation\Bootstrap\LoadConfiguration::class,
    ]);
    $config = $app->make('config');
    $db = $config->get('database.connections.'.$config->get('database.default'), []);
    $expected = base64_decode('__DATABASE_BASE64__', true);
    if (!is_string($expected) || $expected === '' ||
        $config->get('app.env') !== 'staging' ||
        $config->get('app.url') !== 'https://staging.dombicenter.com' ||
        $config->get('database.staging_database_name') !== $expected ||
        ($db['database'] ?? null) !== $expected ||
        ($db['driver'] ?? null) !== 'mysql' || !empty($db['url'])) {
        throw new RuntimeException();
    }
    foreach (['host', 'port', 'database', 'unix_socket', 'charset'] as $key) {
        if (isset($db[$key]) && preg_match('/[;\x00-\x1f]/', (string) $db[$key])) {
            throw new RuntimeException();
        }
    }
    $dsn = !empty($db['unix_socket']) ? 'mysql:unix_socket='.$db['unix_socket'] :
        'mysql:host='.$db['host'].';port='.($db['port'] ?? 3306);
    $dsn .= ';dbname='.$expected.';charset='.($db['charset'] ?? 'utf8mb4');
    $options = $db['options'] ?? [];
    $options[PDO::ATTR_ERRMODE] = PDO::ERRMODE_EXCEPTION;
    $options[PDO::ATTR_TIMEOUT] = 10;
    $options[PDO::MYSQL_ATTR_MULTI_STATEMENTS] = false;
    $pdo = new PDO($dsn, $db['username'], $db['password'], $options);
    $identity = $pdo->query('SELECT DATABASE(), CURRENT_USER()')->fetch(PDO::FETCH_NUM);
    if ($identity[0] !== $expected ||
        explode('@', $identity[1])[0] !== $db['username'] ||
        hash_file('sha256', '.env') !== $before) {
        throw new RuntimeException();
    }
    $pdo = null;
    ob_end_clean();
    echo "STAGING_DATABASE_BINDING_PASS\n";
} catch (Throwable $error) {
    ob_end_clean();
    echo "STAGING_DATABASE_BINDING_FAIL\n";
    exit(1);
}
"""


def pinned_key(scan, fingerprint):
    if not re.fullmatch(r"SHA256:[A-Za-z0-9+/]{43}", fingerprint):
        raise ValueError("Invalid fingerprint format")
    matches = set()
    for line in scan.splitlines():
        fields = line.split()
        if len(fields) != 3 or fields[1] != "ssh-ed25519":
            continue
        try:
            blob = base64.b64decode(fields[2], validate=True)
        except ValueError:
            continue
        expected_prefix = struct.pack(">I", 11) + b"ssh-ed25519" + struct.pack(">I", 32)
        if len(blob) != 51 or not blob.startswith(expected_prefix):
            continue
        digest = "SHA256:" + base64.b64encode(hashlib.sha256(blob).digest()).decode().rstrip("=")
        if digest == fingerprint:
            matches.add(fields[2])
    if len(matches) != 1:
        raise ValueError("Pinned ED25519 key not found")
    return matches.pop()


def connection_values(env):
    values = [env.get("HOSTINGER_SSH_" + name, "") for name in
              ("HOST", "USER", "PASSWORD", "PORT", "FINGERPRINT")]
    host, user, password, port, fingerprint = values
    database = env.get("STAGING_DATABASE_NAME", "")
    if (not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]*", host) or
            not re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]*", user) or
            not port.isascii() or not port.isdigit() or not 1 <= int(port) <= 65535 or
            not password or "\x00" in password or not database or
            re.search(r"[;\x00-\x1f]", database) or
            not re.fullmatch(r"SHA256:[A-Za-z0-9+/]{43}", fingerprint)):
        raise ValueError("Invalid or missing staging secret")
    return host, user, password, port, fingerprint, database


def main():
    try:
        host, user, password, port, fingerprint, database = connection_values(os.environ)
        scan = subprocess.run(
            ["ssh-keyscan", "-T", "10", "-p", port, "-t", "ed25519", host],
            capture_output=True, text=True, timeout=20, check=True,
        )
        key = pinned_key(scan.stdout, fingerprint)
        print("HOST_FINGERPRINT_FORMAT_AND_PIN_PASS", flush=True)
        payload = "<?php\n" + DATABASE_PROBE.replace(
            "__DATABASE_BASE64__", base64.b64encode(database.encode()).decode(),
        )
        with tempfile.TemporaryDirectory(prefix="staging-readiness-") as directory:
            known = Path(directory) / "known_hosts"
            known.write_text(f"staging-readiness-pin ssh-ed25519 {key}\n")
            known.chmod(0o600)
            env = {k: v for k, v in os.environ.items() if not
                   k.startswith("HOSTINGER_SSH_") and k != "STAGING_DATABASE_NAME"}
            env["SSHPASS"] = password
            result = subprocess.run([
                "sshpass", "-e", "ssh", "-F", "/dev/null", "-T", "-p", port,
                "-o", "HostKeyAlias=staging-readiness-pin",
                "-o", "StrictHostKeyChecking=yes", "-o", "UpdateHostKeys=no",
                "-o", f"UserKnownHostsFile={known}",
                "-o", "GlobalKnownHostsFile=/dev/null",
                "-o", "HostKeyAlgorithms=ssh-ed25519",
                "-o", "PreferredAuthentications=password",
                "-o", "PubkeyAuthentication=no", "-o", "KbdInteractiveAuthentication=no",
                "-o", "NumberOfPasswordPrompts=1", "-o", "ConnectTimeout=15",
                "-o", "ForwardAgent=no", "-o", "ClearAllForwardings=yes",
                "-o", "PermitLocalCommand=no", "-o", "ControlMaster=no",
                "-o", "ControlPath=none", "-o", "LogLevel=ERROR",
                f"{user}@{host}", "php -d display_errors=0 -d log_errors=0",
            ], input=payload, capture_output=True, text=True, env=env, timeout=60)
            if result.returncode != 0 or result.stdout.strip() != "STAGING_DATABASE_BINDING_PASS":
                raise RuntimeError("Read-only SSH/database check did not pass")
        print(json.dumps({
            "password_only_ssh_authentication": "PASS",
            "strict_ed25519_fingerprint": "PASS",
            "actions_database_secret_matches_config_and_live_schema": "PASS",
            "authenticated_database_account_matches_config": "PASS",
            "database_writes": False,
            "application_tables_read": False,
            "application_providers_booted": False,
            "runner_temporary_files_removed": True,
        }, sort_keys=True))
        return 0
    except Exception:
        print("STAGING_READINESS_FAIL: raw diagnostics suppressed to protect secrets")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

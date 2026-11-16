#!/usr/bin/env bash
set -euo pipefail
umask 022

transfer="$(realpath "${1:?run-owned transfer directory required}")"
mode="${2:-restore}"
[[ "$mode" =~ ^(restore|activate|close|complete)$ ]]
[[ "$transfer" == "$HOME"/dombi-ci-staging/* ]]
transfer_id="${transfer##*/}"
[[ "$transfer_id" =~ ^[1-9][0-9]*-[1-9][0-9]*$ ]]
parent="$HOME/dombi-ci-staging"
root="$HOME/domains/dombicenter.com/public_html/staging"
[[ -d "$parent" && ! -L "$parent" && "$(realpath "$parent")" == "$parent" ]]
[[ -d "$transfer" && ! -L "$transfer" && "$(realpath "$transfer")" == "$transfer" ]]
[[ -d "$root" && ! -L "$root" && "$(realpath "$root")" == "$root" ]]
[[ -f "$root/.env" && ! -L "$root/.env" ]]
for tool in php python3 rsync flock realpath mktemp rm rmdir stat find cp mv; do command -v "$tool" >/dev/null; done
test -O "$parent"
test "$(stat -c %a "$parent")" = 700
test -O "$transfer"
test "$(stat -c %a "$transfer")" = 700
[[ ! -e "$transfer/rollback-complete.json" && ! -L "$transfer/rollback-complete.json" ]]
[[ -f "$transfer/staging_attempt_guard.py" && ! -L "$transfer/staging_attempt_guard.py" ]]
: "${STAGING_WORKFLOW_SHA:?failed deployment workflow revision required}"
: "${STAGING_RELEASE_SHA:?approved release SHA required}"
python3 "$transfer/staging_attempt_guard.py" verify --parent "$parent" \
    --transfer-id "$transfer_id" --workflow-sha "$STAGING_WORKFLOW_SHA" \
    --release-sha "$STAGING_RELEASE_SHA" --mode rollback

chmod 700 "$transfer"
lock_file="$parent/deploy.lock"
[[ ! -L "$lock_file" ]]
if [[ ! -e "$lock_file" ]]; then
    (umask 077; set -o noclobber; : > "$lock_file")
fi
[[ -f "$lock_file" && ! -L "$lock_file" && -O "$lock_file" ]]
exec 9>>"$lock_file"
flock -n 9 || { echo 'Staging publisher busy' >&2; exit 1; }
cd "$root"
[[ ! -L storage/framework/down && ! -L storage/framework/maintenance.php ]]
: "${STAGING_DB_DATABASE:?verified staging database name required}"

verify_database() {
    php -r '
    $root = getenv("HOME")."/domains/dombicenter.com/public_html/staging";
    if (realpath($root) !== $root || !chdir($root)) { exit(1); }
    require "vendor/autoload.php";
    $app = new Illuminate\Foundation\Application($root);
    $app->bootstrapWith([
        Illuminate\Foundation\Bootstrap\LoadEnvironmentVariables::class,
        Illuminate\Foundation\Bootstrap\LoadConfiguration::class,
    ]);
    $config = $app->make("config");
    $expected = getenv("STAGING_DB_DATABASE");
    $connection = $config->get("database.default");
    $database = $config->get("database.connections.".$connection, []);
    if ($config->get("app.env") !== "staging" ||
        $config->get("app.url") !== "https://staging.dombicenter.com" ||
        $config->get("database.staging_database_name") !== $expected ||
        ($database["database"] ?? null) !== $expected ||
        ($database["driver"] ?? null) !== "mysql" || !empty($database["url"]) ||
        empty($database["username"])) { exit(1); }
    $options = $database["options"] ?? [];
    $options[PDO::ATTR_ERRMODE] = PDO::ERRMODE_EXCEPTION;
    $options[PDO::ATTR_TIMEOUT] = 10;
    $options[PDO::MYSQL_ATTR_MULTI_STATEMENTS] = false;
    $dsn = !empty($database["unix_socket"]) ? "mysql:unix_socket=".$database["unix_socket"] :
        "mysql:host=".$database["host"].";port=".($database["port"] ?? 3306);
    $dsn .= ";dbname=".$expected.";charset=".($database["charset"] ?? "utf8mb4");
    $pdo = new PDO($dsn, $database["username"], $database["password"], $options);
    $identity = $pdo->query("SELECT DATABASE(), CURRENT_USER()")->fetch(PDO::FETCH_NUM);
    if ($identity[0] !== $expected || explode("@", $identity[1])[0] !== $database["username"]) { exit(1); }
    '
}

verify_assets() {
    python3 - "$1" <<'PY'
import hashlib, json, pathlib, re, sys
files = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))["files"]
if not files or "public/build/manifest.json" not in files:
    raise SystemExit("Restored asset manifest missing")
for name, checksum in files.items():
    path = pathlib.PurePosixPath(name)
    if (path.is_absolute() or str(path) != name or not name.startswith("public/build/") or
        ".." in path.parts or not re.fullmatch(r"[a-f0-9]{64}", checksum)):
        raise SystemExit("Unsafe restored asset inventory")
    file = pathlib.Path(name)
    if file.is_symlink() or not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != checksum:
        raise SystemExit("Restored staging asset inventory mismatch")
PY
}

require_recovery_manifest() {
    [[ -f "$transfer/rollback-release.json" && ! -L "$transfer/rollback-release.json" ]]
}

scan_dir=
cleanup_scan() {
    local status=$?
    trap - EXIT
    if [[ -n "$scan_dir" ]]; then
        rm -f -- "$scan_dir/links" "$scan_dir/hardlinks"
        rmdir -- "$scan_dir" || status=1
    fi
    exit "$status"
}

case "$mode" in
    restore)
        archive="$transfer/before-code.tar.gz"
        checksum="$transfer/before-code.sha256"
        for file in "$archive" "$checksum" "$transfer/staging_rollback.py"; do
            [[ -f "$file" && ! -L "$file" ]]
        done
        for dir in storage storage/framework storage/framework/views storage/framework/cache bootstrap/cache; do
            [[ -d "$dir" && ! -L "$dir" && -w "$dir" && "$(realpath "$dir")" == "$root/$dir" ]]
        done
        extract="$(mktemp -d "$transfer/rollback-extract.XXXXXXXX")"
        python3 "$transfer/staging_rollback.py" --archive "$archive" --checksum-file "$checksum" --output "$extract"

        managed=(app config routes resources/views database/migrations vendor public/build)
        for path in bootstrap public resources database artisan composer.json composer.lock \
                    bootstrap/app.php bootstrap/providers.php; do
            [[ ! -L "$path" ]]
        done
        scan_dir="$(mktemp -d "$transfer/.rollback-scan.XXXXXXXX")"
        trap cleanup_scan EXIT
        for path in "${managed[@]}"; do
            [[ ! -L "$path" ]]
            if [[ -e "$path" ]]; then
                if ! find "$path" -type l -print0 > "$scan_dir/links"; then
                    echo 'Managed symlink enumeration failed' >&2
                    exit 1
                fi
                while IFS= read -r -d '' link; do
                    if ! [[ "$path" == vendor && -f "$link" && "$(realpath "$link")" == "$root/vendor/"* ]]; then
                        echo 'Managed symlink destination rejected' >&2
                        exit 1
                    fi
                done < "$scan_dir/links"
                if ! find "$path" -type f -links +1 -print0 -quit > "$scan_dir/hardlinks"; then
                    echo 'Managed hard-link enumeration failed' >&2
                    exit 1
                fi
                test ! -s "$scan_dir/hardlinks"
            fi
        done
        rm -f -- "$scan_dir/links" "$scan_dir/hardlinks"
        rmdir -- "$scan_dir"
        scan_dir=
        trap - EXIT

        if [[ -e storage/framework/down ]]; then
            [[ -f storage/framework/down && ! -L storage/framework/down ]]
        elif [[ -e storage/framework/maintenance.php ]]; then
            [[ -f storage/framework/maintenance.php && ! -L storage/framework/maintenance.php ]]
        else
            php artisan down --retry=15 --no-interaction
        fi
        [[ -f storage/framework/down || -f storage/framework/maintenance.php ]]

        for path in "${managed[@]}"; do
            mkdir -p "$path"
            rsync -rlt --delete --no-perms --no-owner --no-group "$extract/$path/" "$root/$path/"
        done
        for path in artisan composer.json composer.lock bootstrap/app.php bootstrap/providers.php; do
            [[ ! -L "$path" ]]
            rsync -rt --no-perms --no-owner --no-group "$extract/$path" "$root/$path"
        done
        rsync -rlt --no-perms --no-owner --no-group --exclude=/build/ "$extract/public/" "$root/public/"

        APP_PACKAGES_CACHE="$transfer/rollback-packages.php" \
        APP_SERVICES_CACHE="$transfer/rollback-services.php" \
            php artisan package:discover --no-interaction
        for file in packages.php services.php; do
            [[ ! -L "bootstrap/cache/$file" ]]
            if [[ -f "$transfer/rollback-$file" ]]; then
                cp "$transfer/rollback-$file" "bootstrap/cache/$file"
            fi
        done
        php artisan config:clear
        php artisan route:clear
        php artisan view:clear
        verify_database
        verify_assets "$extract/release.json"
        [[ ! -L "$transfer/rollback-release.json" && ! -L "$transfer/rollback-release.json.tmp" ]]
        cp "$extract/release.json" "$transfer/rollback-release.json.tmp"
        chmod 600 "$transfer/rollback-release.json.tmp"
        mv "$transfer/rollback-release.json.tmp" "$transfer/rollback-release.json"
        rm -rf -- "$extract"
        echo 'Staging rollback code restored; maintenance remains enabled for external acceptance.'
        ;;
    activate)
        require_recovery_manifest
        [[ -f storage/framework/down || -f storage/framework/maintenance.php ]]
        [[ ! -L storage/framework/down && ! -L storage/framework/maintenance.php ]]
        verify_database
        verify_assets "$transfer/rollback-release.json"
        if ! php artisan up; then
            php artisan down --retry=15 --no-interaction || true
            echo 'Rollback activation failed; staging must remain closed' >&2
            exit 1
        fi
        if [[ -e storage/framework/down || -e storage/framework/maintenance.php ]]; then
            php artisan down --retry=15 --no-interaction || true
            echo 'Laravel did not clear its maintenance marker; staging must remain closed' >&2
            exit 1
        fi
        echo 'Staging rollback activated for external read-only acceptance.'
        ;;
    close)
        require_recovery_manifest
        if [[ ! -e storage/framework/down && ! -e storage/framework/maintenance.php ]]; then
            php artisan down --retry=15 --no-interaction
        fi
        [[ -f storage/framework/down || -f storage/framework/maintenance.php ]]
        [[ ! -L storage/framework/down && ! -L storage/framework/maintenance.php ]]
        echo 'Staging maintenance confirmed after failed rollback acceptance.'
        ;;
    complete)
        require_recovery_manifest
        [[ ! -e storage/framework/down && ! -e storage/framework/maintenance.php ]]
        verify_database
        verify_assets "$transfer/rollback-release.json"
        (umask 077; set -o noclobber; printf '{"status":"complete","transfer_id":"%s"}\n' "$transfer_id" \
            > "$transfer/rollback-complete.json")
        [[ -f "$transfer/rollback-complete.json" && ! -L "$transfer/rollback-complete.json" ]]
        echo 'Staging rollback completed after external JSON /up and asset acceptance.'
        ;;
esac

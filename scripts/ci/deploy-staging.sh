#!/usr/bin/env bash
set -euo pipefail
umask 022

transfer="$(realpath "${1:?transfer directory required}")"
sha="${2:?full SHA required}"
[[ "$sha" =~ ^[a-f0-9]{40}$ ]]
[[ "$transfer" == "$HOME"/dombi-ci-staging/* ]]
root="$HOME/domains/dombicenter.com/public_html/staging"
[[ -d "$root" && ! -L "$root" && "$(realpath "$root")" == "$root" ]]
[[ -f "$root/.env" && ! -L "$root/.env" ]]
for tool in php python3 rsync flock tar find mktemp rm rmdir; do command -v "$tool" >/dev/null; done
cd "$root"
chmod 700 "$transfer"

# The shared lock is outside the code tree; never unlock another publisher's file.
exec 9>"$HOME/dombi-ci-staging/deploy.lock"
flock -n 9 || { echo 'Staging publisher busy'; exit 1; }
test ! -e storage/framework/down
test ! -L storage/framework/down
test ! -e storage/framework/maintenance.php
test ! -L storage/framework/maintenance.php
php artisan env --no-ansi | grep -Eq '\[staging\]'
: "${STAGING_DB_DATABASE:?verified staging database name required}"
php -r '
require "vendor/autoload.php";
$app = require "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$connection = config("database.default");
if (config("app.env") !== "staging" || config("app.url") !== "https://staging.dombicenter.com" ||
    config("app.maintenance.driver") !== "file" ||
    config("database.connections.$connection.database") !== getenv("STAGING_DB_DATABASE")) { exit(1); }
'
for dir in storage storage/framework storage/framework/views storage/framework/cache bootstrap/cache; do
    [[ -d "$dir" && ! -L "$dir" && -w "$dir" && "$(realpath "$dir")" == "$root/$dir" ]]
done
python3 "$transfer/release.py" extract --archive "$transfer/release.tar.gz" --sha "$sha" \
    --checksum-file "$transfer/release.sha256" --output "$transfer/runtime"
python3 - "$transfer/runtime/release.json" <<'PY'
import json, pathlib, sys
names = list(json.loads(pathlib.Path(sys.argv[1]).read_text())['files'])
names += ['bootstrap/cache/packages.php', 'bootstrap/cache/services.php']
for name in names:
    path = pathlib.Path(name)
    for entry in (path, *path.parents):
        if entry.is_symlink():
            if entry == path and path.parts[0] == 'vendor' and path.is_file() and path.resolve().is_relative_to(pathlib.Path('vendor').resolve()):
                continue
            raise SystemExit('Linked deployment destination rejected')
    if path.exists() and (not path.is_file() or path.stat().st_nlink != 1):
        raise SystemExit('Non-regular or hard-linked deployment destination rejected')
PY

list_dir=
cleanup_deployment_lists() {
    local status="${1:-$?}"
    if [[ -n "$list_dir" ]]; then
        rm -f -- "$list_dir/links" "$list_dir/public" || return 1
        rmdir -- "$list_dir" || return 1
        list_dir=
    fi
    return "$status"
}
chain_list_cleanup() {
    local signal="$1" finish="$2" previous action=:
    previous="$(trap -p "$signal")"
    if [[ -n "$previous" ]]; then
        # Decode only Bash's own quoted trap representation, not external input.
        eval "set -- ${previous#trap -- }"
        action="${1:-:}"
    fi
    # Both branches preserve the incoming status for the existing trap action.
    trap -- "deployment_lists_status=\$?; if cleanup_deployment_lists \"\$deployment_lists_status\"; then $action; else $action; fi$finish" "$signal"
}
chain_list_cleanup EXIT '; exit "$deployment_lists_status"'
chain_list_cleanup HUP '; exit 129'
chain_list_cleanup INT '; exit 130'
chain_list_cleanup TERM '; exit 143'
list_dir="$(mktemp -d "$transfer/.find-lists.XXXXXXXX")"
(umask 077; set -o noclobber; : > "$list_dir/links"; : > "$list_dir/public")

managed=(app config routes resources/views database/migrations vendor public/build)
for path in bootstrap public resources database; do [[ ! -L "$path" ]]; done
for path in "${managed[@]}"; do
    [[ ! -L "$path" ]]
    if [[ -e "$path" ]]; then
        # Refuse linked code rather than following links into protected state.
        if ! find "$path" -type l -print0 > "$list_dir/links"; then
            echo 'Managed symlink enumeration failed' >&2
            exit 1
        fi
        while IFS= read -r -d '' link; do
            if ! [[ "$path" == vendor && -f "$link" && "$(realpath "$link")" == "$root/vendor/"* ]]; then
                echo 'Managed symlink destination rejected' >&2
                exit 1
            fi
        done < "$list_dir/links"
        if ! find "$path" -type f -links +1 -print0 -quit > "$list_dir/links"; then
            echo 'Managed hard-link enumeration failed' >&2
            exit 1
        fi
        test -f "$list_dir/links"
        test ! -s "$list_dir/links"
    fi
done
test ! -L bootstrap/cache
test ! -e "$transfer/before-code.tar.gz"
backup=()
for path in "${managed[@]}" artisan composer.json composer.lock bootstrap/app.php bootstrap/providers.php; do
    [[ ! -e "$path" ]] || backup+=("$path")
done
if ! find "$transfer/runtime/public" -type f -print0 > "$list_dir/public"; then
    echo 'Public backup enumeration failed' >&2
    exit 1
fi
while IFS= read -r -d '' path; do
    relative="${path#"$transfer/runtime/"}"
    [[ "$relative" == public/build/* || ! -e "$relative" ]] || backup+=("$relative")
done < "$list_dir/public"
cleanup_deployment_lists
(umask 077; tar -czf "$transfer/before-code.tar.gz" "${backup[@]}")
sha256sum "$transfer/before-code.tar.gz" > "$transfer/before-code.sha256"

php artisan down --retry=15 --no-interaction
test -f storage/framework/down
# No EXIT/always-up trap: a failed mutation must stay closed for inspection.
for path in "${managed[@]}"; do
    mkdir -p "$path"
    rsync -rlt --delete --no-perms --no-owner --no-group "$transfer/runtime/$path/" "$root/$path/"
done
for path in artisan composer.json composer.lock bootstrap/app.php bootstrap/providers.php; do
    [[ ! -L "$path" ]]
    rsync -rt --no-perms --no-owner --no-group "$transfer/runtime/$path" "$root/$path"
done
rsync -rlt --no-perms --no-owner --no-group --exclude=/build/ "$transfer/runtime/public/" "$root/public/"
python3 - "$transfer/runtime/release.json" <<'PY'
import hashlib, json, pathlib, sys
for name, checksum in json.loads(pathlib.Path(sys.argv[1]).read_text())['files'].items():
    path = pathlib.Path(name)
    if path.is_symlink() or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != checksum:
        raise SystemExit('Deployed code inventory mismatch')
PY

# Rebuild generated package discovery without booting with removed dev providers.
APP_PACKAGES_CACHE="$transfer/packages.php" APP_SERVICES_CACHE="$transfer/services.php" php artisan package:discover --no-interaction
for file in packages.php services.php; do
    [[ ! -L "bootstrap/cache/$file" ]]
    if [[ -f "$transfer/$file" ]]; then cp "$transfer/$file" "bootstrap/cache/$file"; fi
done
php artisan config:clear
php artisan route:clear
php artisan view:clear
cp "$transfer/runtime/release.json" "$transfer/deployed-release.json"
php artisan up
echo "Staging code installed: $sha; HTTP acceptance follows on the runner."

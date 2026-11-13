#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
mariadb_prefix="$(brew --prefix mariadb@11.8)"
server_bin="$mariadb_prefix/bin/mariadbd"
install_bin="$mariadb_prefix/bin/mariadb-install-db"
admin_bin="$mariadb_prefix/bin/mariadb-admin"
port=13307
run_dir="$(mktemp -d "${TMPDIR:-/tmp}/dombi-owner-mariadb-test.XXXXXX")"
socket_path="$run_dir/mariadb.sock"
server_pid=""

case "$run_dir" in
  "${TMPDIR:-/tmp}"/dombi-owner-mariadb-test.*) ;;
  *) exit 2 ;;
esac

cleanup() {
  status=$?
  if [ -n "$server_pid" ] && kill -0 "$server_pid" 2>/dev/null; then
    "$admin_bin" --no-defaults --socket="$socket_path" -uroot shutdown >/dev/null 2>&1 || kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  case "$run_dir" in
    "${TMPDIR:-/tmp}"/dombi-owner-mariadb-test.*) rm -rf -- "$run_dir" ;;
  esac
  return "$status"
}
trap cleanup EXIT INT TERM

if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
  printf '%s\n' 'DISPOSABLE_TEST=BLOCKED' 'REASON=test_port_already_in_use' >&2
  exit 2
fi

"$install_bin" --no-defaults --datadir="$run_dir/data" --auth-root-authentication-method=normal --skip-test-db --user="$(id -un)" >"$run_dir/install.log" 2>&1
"$server_bin" --no-defaults --user="$(id -un)" --datadir="$run_dir/data" --socket="$socket_path" --port="$port" --bind-address=127.0.0.1 --pid-file="$run_dir/mariadb.pid" --log-error="$run_dir/mariadb.log" &
server_pid=$!

ready=0
for attempt in $(seq 1 60); do
  if "$admin_bin" --no-defaults --socket="$socket_path" -uroot ping >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  printf '%s\n' 'DISPOSABLE_TEST=BLOCKED' 'REASON=temporary_mariadb_start_failed' >&2
  tail -30 "$run_dir/mariadb.log" >&2 || true
  exit 2
fi

DOMBI_TEST_MYSQL_SOCKET="$socket_path" DOMBI_TEST_MYSQL_PORT="$port" php "$repo_root/scripts/release/test-owner-bootstrap-disposable.php"

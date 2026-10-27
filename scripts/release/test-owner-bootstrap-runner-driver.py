#!/usr/bin/env python3

"""Drive the private Owner runner through a local pseudo-terminal."""

import errno
import os
import pty
import re
import select
import signal
import subprocess
import sys
import time


def safe_diagnostics(output: str) -> list[str]:
    return re.findall(r"^FAILURE_(?:STAGE|CODE)=[a-z_]+$", output, flags=re.MULTILINE)


def run_seed(php: str, runner: str, release_sha: str) -> tuple[int, str, bool]:
    phrase = f"SEED OWNER Dombi Center dombicenter@gmail.com {release_sha}"
    child_pid, terminal = pty.fork()
    if child_pid == 0:
        os.execv(php, [php, runner, "SEED"])

    output = bytearray()
    confirmation_sent = False
    exit_code = None
    deadline = time.monotonic() + 60

    try:
        while time.monotonic() < deadline:
            readable, _, _ = select.select([terminal], [], [], 0.2)
            if readable:
                try:
                    chunk = os.read(terminal, 8192)
                    if not chunk:
                        break
                    output.extend(chunk)
                except OSError as error:
                    if error.errno == errno.EIO:
                        break
                    raise

            if not confirmation_sent and b"Type exactly:" in output and b"\n> " in output:
                os.write(terminal, phrase.encode("utf-8") + b"\n")
                confirmation_sent = True

            finished, status = os.waitpid(child_pid, os.WNOHANG)
            if finished:
                exit_code = os.waitstatus_to_exitcode(status)
                while True:
                    try:
                        chunk = os.read(terminal, 8192)
                        if not chunk:
                            break
                        output.extend(chunk)
                    except OSError as error:
                        if error.errno == errno.EIO:
                            break
                        raise
                break
        else:
            os.kill(child_pid, signal.SIGTERM)
    finally:
        os.close(terminal)

    if exit_code is None:
        _, status = os.waitpid(child_pid, 0)
        exit_code = os.waitstatus_to_exitcode(status)

    return exit_code, output.decode("utf-8", "replace"), confirmation_sent


def main() -> int:
    if len(sys.argv) != 5:
        print("RUNNER_DRIVER=INVALID_ARGUMENTS")
        return 2

    case, php, runner, release_sha = sys.argv[1:]
    preflight = subprocess.run(
        [php, runner, "PREFLIGHT"],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=60,
        check=False,
    )
    if (
        preflight.returncode != 0
        or "PRODUCTION_OWNER_PREFLIGHT=PASS" not in preflight.stdout
        or "USERS=0" not in preflight.stdout
        or "BUSINESS_ROWS=0" not in preflight.stdout
    ):
        print("RUNNER_PREFLIGHT=FAIL")
        for diagnostic in safe_diagnostics(preflight.stdout + "\n" + preflight.stderr):
            print(diagnostic)
        return 1

    status, output, confirmed = run_seed(php, runner, release_sha)
    if not confirmed:
        print("RUNNER_CONFIRMATION=NOT_REACHED")
        for diagnostic in safe_diagnostics(output):
            print(diagnostic)
        return 1

    if case == "insert-failure":
        expected = (
            status == 2
            and "FAILURE_STAGE=eloquent_insert" in output
            and "FAILURE_CODE=database_operation_failed" in output
            and "DIAGNOSTIC_SENTINEL" not in output
        )
        if not expected:
            print("RUNNER_FAILURE=UNEXPECTED")
            for diagnostic in safe_diagnostics(output):
                print(diagnostic)
            return 1
        print("RUNNER_PREFLIGHT=PASS")
        print("RUNNER_FAILURE=SANITIZED")
        print("FAILURE_STAGE=eloquent_insert")
        print("FAILURE_CODE=database_operation_failed")
        return 0

    if case == "success":
        if status != 0 or "PRODUCTION_OWNER_SEED=PASS" not in output:
            print("RUNNER_SUCCESS=FAIL")
            for diagnostic in safe_diagnostics(output):
                print(diagnostic)
            return 1
        print("RUNNER_PREFLIGHT=PASS")
        print("RUNNER_SUCCESS=PASS")
        return 0

    print("RUNNER_DRIVER=INVALID_CASE")
    return 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        print("RUNNER_DRIVER=BLOCKED")
        raise SystemExit(2)

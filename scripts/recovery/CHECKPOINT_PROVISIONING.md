# Shared lock and checkpoint tool provisioning

Status: **PROCEDURE ONLY / EXECUTION HOLD.** This document and
`provision_checkpoint_tool.py` describe and verify how two artifacts would be
provisioned. They do **not** authorize provisioning, capture, publication or
recovery. Nothing here was run against any host, and no real lock or tool was
created while writing it.

Provisioning and execution are separate authorizations. The tooling contract is
[the checkpoint specification](../../docs/release/V1-FILESYSTEM-CHECKPOINT-SPEC.md);
[the runbook](../../docs/release/V1-MAINTENANCE-RUNBOOK.md) keeps the phase gates and
the integration owner updates it separately. An operator who wants to provision must
obtain its own written authorization for exactly the account, private directory,
tool digest and destination below. This document cannot be cited as that
authorization.

## What is provisioned and why

`filesystem_checkpoint.py` requires two artifacts to already exist before any
state-changing mode can run. Both are absent on the observed host.

| Artifact | Contract requirement | Observed state |
| --- | --- | --- |
| `<private>/dombi-filesystem-publication.lock` | `0600` regular single-link operator-owned file inside the `0700` private directory; every publisher locks the same path | **ABSENT** |
| `<private>/filesystem_checkpoint.py` | Reviewed tool with a pinned SHA-256; `tool_digest()` must equal the digest in the approval and manifest | **NOT PROVISIONED** |

The lock is an advisory `flock` target. Creating it does not prove that every writer
cooperates with it; that remains a separate operational gate.

## Prerequisites

Verified host facts, recorded for the operator. Re-verify before acting; do not
assume they still hold.

| Fact | Value |
| --- | --- |
| Account | `u399215191` |
| Application root | `/home/u399215191/domains/dombicenter.com/public_html/app` (`0755`, not a symlink, no symlink ancestors) |
| Private directory | `/home/u399215191/private-backups` (`0700`, no symlink ancestors) |
| Device agreement | application root device == private directory device (`2052`) |
| Interpreter | `/usr/bin/python3` is **3.9**, which satisfies the tool's `>= 3.9` requirement |
| Lock | `dombi-filesystem-publication.lock` absent |
| Tool | only historical `recover-production*.py` files present; `filesystem_checkpoint.py` absent |

Before any apply run, all of the following must be true. The script re-checks the
path and mode facts itself and refuses otherwise.

1. A separate written authorization exists for (a) provisioning the lock, (b) the
   exact tool digest, and (c) the exact private destination filename.
2. The reviewed tool has been produced by the normal review path and its digest has
   been recorded independently of this script.
3. The private directory is `0700`, operator-owned, and both it and every ancestor
   are real directories, not symlinks.
4. No file already exists at either destination. The script never overwrites, and a
   pre-existing file needs an explicit operator decision, not a retry.
5. The interpreter is `>= 3.9` and no other publisher is running.
6. `--app-root` names the real application root. It is a mandatory argument, not an
   optional check, so the private-directory boundary is always validated.

## Safety properties

| Property | Implementation |
| --- | --- |
| No built-in target | No account, root or private path constant exists. `--tool`, `--private` and `--app-root` are mandatory; there is nothing to act on by default. |
| Dry-run default | Without `--apply` the script only validates and prints. An apply run additionally requires `--create-lock` and/or `--publish-tool`; `--apply` alone exits 1 with `explicit_action_required`. |
| Lock creation | `O_CREAT|O_EXCL|O_NOFOLLOW`, mode `0600`, created relative to a no-follow parent descriptor. `fsync` on the file and on the parent directory. |
| No overwrite, ever | Any existing entry aborts: regular file, directory, or broken symlink (`lock_exists`, `tool_destination_exists`). The plan mode refuses the same way. |
| Tool publication | Exclusive staging file (`.NAME.staging-<random>`) plus an atomic no-overwrite `os.link`, then digest and mode verification on the linked file, then parent `fsync`, then staging removal. |
| Private parent | `0700`, operator-owned, no symlink in the path. Group- or world-writable, or `0750`/`0770`, is refused. |
| Private boundary | `--app-root` is mandatory and refused if it is, contains, or is contained by `--private`. The tool never writes inside the application root. |
| Digest pin | `--expected-tool-sha256` aborts with `tool_digest_mismatch` on mismatch; a malformed value aborts with `expected_digest_format`. |
| Source integrity | The source tool must be a regular single-link file, not group/world-writable, and must not change while being read (`tool_drift`). |
| Failure cleanup | A failed run removes only the exact device/inode it created. It never deletes a substitute. A successfully created lock is deliberately kept if a later publish step fails. |
| Umask | The apply path sets `0o077` for its duration and restores the previous value. |
| Standard library only | `argparse`, `hashlib`, `os`, `pathlib`, `posixpath`, `re`, `secrets`, `stat`, `sys`, `errno`, `contextlib`. |

### What it deliberately does not do

No application-root inventory, no checkpoint capture, no extraction, no publication,
no `flock` acquisition, no approval generation, no approval or manifest editing, no
database or PHP access, no network, no SSH. Provisioning the lock is not evidence of
writer cooperation, and provisioning the tool is not checkpoint authority.

## Exact commands

Run from a checkout of the reviewed commit. `private` below is the real private
directory. Use the plan mode first; it writes nothing and prints the digest that the
approval must later pin.

```bash
# 0. Confirm the local tool digest independently of this script.
sha256sum scripts/recovery/filesystem_checkpoint.py

# 1. Plan only. Writes nothing. Repeat until the plan is exactly what is authorized.
python3 -B scripts/recovery/provision_checkpoint_tool.py \
  --tool "$PWD/scripts/recovery/filesystem_checkpoint.py" \
  --private /home/u399215191/private-backups \
  --app-root /home/u399215191/dombicenter.com/public_html/app \
  --expected-tool-sha256 <reviewed-digest>

# 2. Apply, lock only (only after separate authorization).
python3 -B scripts/recovery/provision_checkpoint_tool.py \
  --tool "$PWD/scripts/recovery/filesystem_checkpoint.py" \
  --private /home/u399215191/private-backups \
  --app-root /home/u399215191/dombicenter.com/public_html/app \
  --expected-tool-sha256 <reviewed-digest> \
  --apply --create-lock
```

```bash
# 3. Apply, tool only. Note: the tool is not executed, only published as a file.
python3 -B scripts/recovery/provision_checkpoint_tool.py \
  --tool "$PWD/scripts/recovery/filesystem_checkpoint.py" \
  --private /home/u399215191/private-backups \
  --app-root /home/u399215191/dombicenter.com/public_html/app \
  --expected-tool-sha256 <reviewed-digest> \
  --apply --publish-tool

# 4. Both in one run (lock first, then tool).
python3 -B scripts/recovery/provision_checkpoint_tool.py \
  --tool "$PWD/scripts/recovery/filesystem_checkpoint.py" \
  --private /home/u399215191/private-backups \
  --app-root /home/u399215191/dombicenter.com/public_html/app \
  --expected-tool-sha256 <reviewed-digest> \
  --apply --create-lock --publish-tool
```

Step 1 is read-only and writes nothing. Steps 2-4 write to the host and require
separate provisioning authorization first.

## Expected outputs

Plan mode, exit `0`:

```text
PLAN profile=private mode=0700 owner=<uid> device=2052 path=/home/u399215191/private-backups
PLAN writes=0
PLAN tool=/…/scripts/recovery/filesystem_checkpoint.py sha256=<64 hex>
PLAN action=create-lock path=/home/u399215191/private-backups/dombi-filesystem-publication.lock mode=0600
PLAN action=publish-tool path=/home/u399215191/private-backups/filesystem_checkpoint.py mode=0600
RESULT PLAN_ONLY_NO_WRITES
```

Apply mode, exit `0`:

```text
APPLY action=create-lock path=/home/u399215191/private-backups/dombi-filesystem-publication.lock mode=0600 nlink=1
APPLY action=publish-tool path=/home/u399215191/private-backups/filesystem_checkpoint.py sha256=<64 hex> mode=0600 nlink=1
RESULT PROVISIONED create_lock=done publish_tool=done
```

Refusals print one line to stderr and exit `1`, with empty stdout in plan mode:

| `reason=` | Meaning |
| --- | --- |
| `explicit_action_required` | `--apply` without `--create-lock`/`--publish-tool`. |
| `lock_exists` | Something already occupies the lock path, including a broken symlink. |
| `tool_destination_exists` | Something already occupies the tool destination. |
| `private_mode`, `private_owner`, `private_not_directory` | Private directory is not an operator-owned `0700` directory. |
| `symlink_ancestor` | A component of the private path or the tool source path is a symlink. |
| `private_boundary` | `--app-root` overlaps `--private`. |
| `tool_digest_mismatch` | Local digest differs from `--expected-tool-sha256`. |
| `tool_symlink`, `tool_not_regular`, `tool_not_single_link`, `tool_writable_by_others` | Unacceptable tool source. |
| `tool_drift` | Source changed while being read. |
| `destination_name`, `noncanonical_private`, `noncanonical_tool`, `noncanonical_app_root`, `absolute_path_required` | Malformed arguments. The script never normalizes a path it was given. |
| `app-root` missing | `argparse` usage error, exit `2`, no output on stdout. `--app-root` is required. |
| `io_error errno=<n>` | Underlying filesystem refusal; nothing is left behind. |
| `staged_digest_mismatch` | Staged copy did not hash to the source digest; destination not linked. |
| `atomic_link_unsupported` | The filesystem or interpreter cannot perform the no-overwrite atomic link. Do not substitute a copy. |
| `lock_identity_drift`, `tool_identity_drift` | The created entry changed during the run; run failed. |

## Verification steps

Read-only, after a successful apply. Do not proceed to capture on any mismatch.

```bash
P=/home/u399215191/private-backups

# Both artifacts exist, are regular, single-link, 0600, owned by the account.
stat -c '%n type=%F mode=%a links=%h owner=%U' \
  "$P/dombi-filesystem-publication.lock" "$P/filesystem_checkpoint.py"

# The parent is still 0700.
stat -c '%n type=%F mode=%a owner=%U' "$P"

# Neither path is a symlink and no staging residue remains.
test ! -L "$P/dombi-filesystem-publication.lock" && echo lock-not-symlink
test ! -L "$P/filesystem_checkpoint.py" && echo tool-not-symlink
ls -a "$P" | grep -F '.staging-' || echo no-staging-residue

# The published tool digest equals the reviewed digest and the approval pin.
sha256sum "$P/filesystem_checkpoint.py"

# No host baked into the script, and the repository copy is unchanged.
grep -n 'u399215191\|private-backups' scripts/recovery/provision_checkpoint_tool.py \
  || echo no-host-constant

# Local contract tests, synthetic temporary directories only.
python3 -B -m unittest discover -s scripts/recovery \
  -p 'test_checkpoint_provisioning.py' -v
```

The published tool is a file only. Running it in `inspect` mode is a separate,
read-only action; running `capture` or `recover` is a separate authorization again.

## Rollback

Rollback is manual and deliberately narrow. There is no automatic revert, and the
script has no delete mode.

1. **Stop first.** Confirm no capture, publication or recovery is running and no
   approval references the artifact. If any operation is in flight, STOP: an
   interrupted operation stays on disk and needs separate review — never delete by
   filename prefix.
2. **Record what exists** before removing anything: `stat -c '%n %F %a %h %U %i'`
   for both paths, and the tool's `sha256sum`. Keep that record with the incident
   note.
3. **Remove the tool** only if you provisioned it and no approval or manifest pins
   its digest:
   ```bash
   test ! -L "$P/filesystem_checkpoint.py" &&
   test "$(stat -c %h "$P/filesystem_checkpoint.py")" = 1 &&
   test "$(stat -c %a "$P/filesystem_checkpoint.py")" = 600 &&
   rm -- "$P/filesystem_checkpoint.py"
   ```
   Removing a pinned tool invalidates every approval that names its digest; that is
   why the pin check comes first.
4. **Remove the lock** only if it is the zero-byte file this procedure created, it is
   not held (`fuser`/`lsof` show no holder, or the flock probe below fails to
   acquire), and no publisher is running:
   ```bash
   python3 -B - <<'PY'
   import fcntl, os, sys
   p = "/home/u399215191/private-backups/dombi-filesystem-publication.lock"
   fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW)
   try:
       fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
       print("unheld")
   except BlockingIOError:
       print("HELD - do not remove")
       sys.exit(1)
   finally:
       os.close(fd)
   PY
   ```
   Then `rm -- "$P/dombi-filesystem-publication.lock"`.
5. **Staging residue.** A `.filesystem_checkpoint.py.staging-*` file means a run was
   killed mid-publish. It is not a published tool and not a lock. Confirm its
   inode/owner/mode and that no run is active, then remove that exact filename. Never
   remove by glob.
6. **Never** remove or modify the private directory itself, any historical
   `recover-production*` file, any checkpoint directory, archive, manifest, receipt,
   approval, journal or audit record. Provisioning rollback never touches those.

If a removed artifact was already pinned by an approval or manifest, the correct
state is **UNKNOWN / keep held**. Re-provisioning reintroduces a new inode with the
same digest; it does not restore the earlier operation's authority.

## STOP conditions

Stop and escalate, do not retry, if any of these occur.

- The plan output does not match what was authorized: different private path,
  different destination, or a different tool digest.
- Any refusal other than a refusal you predicted and can explain from the tables
  above. In particular `lock_identity_drift`, `tool_identity_drift`,
  `staged_digest_mismatch` and `tool_drift` mean the filesystem changed underneath
  the run.
- The private directory is not `0700`, is not operator-owned, or any ancestor is a
  symlink.
- Either destination already exists in any form, including a broken symlink, a
  zero-byte placeholder, or a historical tool under the same name.
- The interpreter is older than 3.9, `os.link`/`dir_fd` support is missing, or the
  filesystem rejects the atomic link.
- The published digest differs from the reviewed digest after apply.
- Any doubt about whether a publisher, capture or recovery is running.
- Anyone proposes to reuse this script for capture, publication, recovery, an
  approval, a manifest edit, a database operation or a deployment. It does none of
  those.

## Authorization boundary

| Permission | State |
| --- | --- |
| Read this document and run the local synthetic tests | Allowed |
| Run plan mode against any path, including the real private directory | Requires the operator's own provisioning authorization; it writes nothing but still inspects metadata |
| Apply mode against the real private directory | **Not authorized by this document.** Separate written authorization is required. |
| Capture, publication, recovery, reopening | **Not authorized.** Separate authorization per phase |

The operator must obtain separate authorization before any apply run. Nothing in this
repository grants it, and a successful provisioning run does not advance any
production gate on its own.

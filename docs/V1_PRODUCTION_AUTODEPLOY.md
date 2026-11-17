# Production auto-deploy pipeline

Status: **IMPLEMENTED / INACTIVE.** Every gate below is disabled in source. No
production deployment has run and none is authorized by this document.

## What runs when

| Trigger | Behaviour |
| --- | --- |
| Push to `main` | Quality Gate runs and (on first run for that commit) packs `release-<sha>`. The `gate` job then evaluates activation: disabled means it reports state and stops. |
| Push to `main`, both controls on | `deploy` job downloads `release-<merge sha>`, re-verifies it, uploads the five reviewed tools, and publishes managed code through the composite tool. |
| `workflow_dispatch` | `rollback` job only, and it requires a well-formed `operation_id`. Never deploys. |
| Any other event | Nothing. There is no push-to-`develop` deploy, no tag, no schedule trigger. |

`concurrency: deploy-production` with `cancel-in-progress: false` serialises runs
and never cancels an in-progress publication. Quality Gate uses
`concurrency: quality-<sha>` with the same setting, so a build a deploy is
waiting on is never cancelled.

## Two independent controls

Activation requires **both**, and neither is reachable from a normal merge:

1. `PRODUCTION_DEPLOY_ACTIVATED = True` in
   `scripts/ci/production_deploy_transport.py` — a source constant. Flipping it is
   a reviewed commit.
2. Repository variable `PRODUCTION_DEPLOY_ENABLED = true` — a settings change.

A repository setting alone cannot arm production, and the source constant alone
cannot either. There is no environment variable that substitutes for either;
`deployment_allowed()` checks the constant first and the setting second.

Additional conditions, all fail-closed: event `push`, ref `refs/heads/main`,
repository `leanderarya/dombi`, `run_attempt == 1` (a rerun is refused, because a
rerun after an uncertain outcome is exactly when a duplicate publication would be
most damaging), and a 40-hex commit SHA.

## Artifact binding

The deploy job deploys the artifact named `release-<GITHUB_SHA>` — the merge
commit's own artifact, produced by the existing Quality Gate `pack` step. It
verifies the receipt names `release.tar.gz`, that the archive digest matches the
receipt, that the transfer inventory is exactly the five expected tools, and that
no entry is a symlink or hard link. A stale or substituted download is refused.

The bootstrap merge is the only commit where the deployed SHA may equal the
accepted V1.0 candidate `220a0190…`; `plan()` reports `bootstrap_release` so an
operator can see which case they are in. It does not silently treat one as the
other.

## Host-side path (reviewed composite tool)

Publication calls `scripts/recovery/single_owner_deploy.py`, which is the only
mechanism here that mutates production code:

| Phase | Action |
| --- | --- |
| `preflight` | Read-only. Verifies artifact, callback routes, identity, layout, capacity. Writes nothing durable. |
| `deploy` | Backs up every file it may overwrite (digest-verified, `0600`), stages all release bytes into private state, then commits with rename-only `os.replace` and verifies the full inventory afterwards. |
| `rollback` | Restores the backed-up managed code from that exact operation, removes files the deploy added, and is safely repeatable. |

Publication is deliberately two-phase. **Phase 1** copies and fsyncs every file
into private staging; a failure there leaves production completely untouched.
**Phase 2** is rename-only, so the window in which a request can observe a mix of
old and new code is bounded to the rename loop rather than the whole copy.

That window is **not zero**. The host requires the application root to be a real
directory (never a symlink), so release-directory symlink activation is
unavailable and the tree cannot be swapped in one atomic step. This is a
host-layout prerequisite, recorded rather than papered over.

Guarantees, asserted by tests:

- `.env*`, `storage/`, `database/` (except `database/migrations`), `public/storage`,
  `.git` and `node_modules` are never written, archived or restored.
- `bootstrap/cache` is preserved as-is; the pipeline runs no cache command.
- No `artisan down`/`up`, no `migrate`, no `db:wipe`, no SQL, no cron change, no
  worker restart, no DOKU/payment call.
- A file the new release drops is **reported** in `stale_not_removed` and left in
  place, never silently deleted.
- A failure journals `AUTHORIZED_NOT_COMPLETED` and never claims completion.
- A tampered backup refuses rollback.
- The SSH transport's host script re-checks root, `.env`, `storage`, `database`,
  `bootstrap/cache`, `public` and the maintenance flag before any mutation.

## SSH integration

The transport reuses the five secret names the `production` environment exposes —
`HOSTINGER_SSH_HOST`, `HOSTINGER_SSH_PORT`, `HOSTINGER_SSH_USER`,
`HOSTINGER_SSH_PASSWORD`, `HOSTINGER_SSH_FINGERPRINT` — and never prints, echoes
or returns them. Values are shape-validated only; the child process environment is
stripped of every `HOSTINGER_SSH_*` name, `SSH_AUTH_SOCK`, `SSH_ASKPASS` and
`SSHPASS` so a nested tool cannot inherit them. Failures suppress stderr entirely,
because a host banner can echo a command.

Host key handling follows the reviewed staging transport: ED25519 only, pinned by
fingerprint, `StrictHostKeyChecking=yes` against a throwaway `known_hosts`,
`ForwardAgent=no`, `ControlMaster=no`, one password prompt, password auth only.

### Fingerprint status

`HOSTINGER_SSH_FINGERPRINT` exists in the `production` environment, and its shape
is valid (`SHA256:` + 43 base64 characters, which is what `connection_values()`
requires). GitHub does not expose secret *contents*, so the stored value cannot be
read back and its equality with the trusted fingerprint is **unconfirmed**.

What is confirmed: local trusted `known_hosts` evidence for
`[145.79.14.13]:65002` computes to

```
SHA256:Pa95bm4Mw7EQcIGFTS8qfcP1OPEm2rRRBV37Z+cPgvQ
```

which is exactly the previously trusted value. The secret is expected to hold that
same digest; if it does not, `pinned_key()` refuses with `host_key_not_pinned`
before any command runs. There is no fallback and no way to bypass it, so a wrong
value fails closed rather than degrading verification.



- **Callbacks**: the artifact's `routes/web.php` must still contain
  `/payment/doku/notify` and `/payment/doku/redirect` and must not put
  `admission` on either line, or the deploy is refused. That is a *code* check. It
  cannot prove the running host serves them, and it does not probe DOKU.
- **Workers**: this pipeline deliberately does **not** restart workers. If PHP
  workers are cron-driven (as on the current host) they pick up the new code on
  their next tick; if a long-lived daemon exists it would keep old code until
  restarted. That fact is unresolved and is a stated limitation, not a claim.
- **Window**: checkout admission stays HELD. Managed-code replacement is
  per-file atomic but not atomic across the whole tree, so a request spanning the
  replacement can see a mix. The window is bounded by the file count and is
  largest on `vendor/`.

## Activation procedure (one time)

1. Merge this pipeline to `main` with both constants `False` and the repository
   variable unset. Confirm the `gate` job reports `enabled: false` and the
   `deploy` job does not run.
2. Obtain explicit owner approval for production publication, reusing the
   existing `production` environment secrets.
3. In one reviewed commit, flip `PRODUCTION_DEPLOY_ACTIVATED = True` in **both**
   `scripts/ci/production_deploy_transport.py` and
   `scripts/ci/production_ssh_transport.py`.
4. Set repository variable `PRODUCTION_DEPLOY_ENABLED = true`.
5. Merge the activation commit. Its own push runs Quality Gate, packs
   `release-<merge sha>`, and then deploys that same artifact.

Until step 5 completes, a push to `main` cannot mutate production: the `deploy`
job either does not run (gate `false`) or runs and is stopped by
`production_transport_not_activated` before any SSH call.

### Publication envelope (scoped PR)

> Authorized: publish this pipeline to `main` as a pull request from an isolated
> branch, with activation constants `False`, no repository-variable change, and no
> workflow dispatch.
>
> Not authorized: merging the activation commit, setting
> `PRODUCTION_DEPLOY_ENABLED`, dispatch, or any host write.

### Bootstrap activation envelope (separate)

> Authorized: flip both `PRODUCTION_DEPLOY_ACTIVATED` constants to `True`, set
> `PRODUCTION_DEPLOY_ENABLED = true`, merge, and allow exactly one automatic
> deployment of that merge commit to
> `/home/u399215191/domains/dombicenter.com/public_html/app`, with admissions
> HELD, no migration, no cache command, no worker restart and no DOKU probe.
>
> Not authorized: manual rollback unless the deployment fails verification, any
> second activation attempt, or reopening admissions.

## STOP conditions

- `enabled: false` but a deploy job starts (indicates a workflow edit error).
- Artifact name, receipt or digest does not match the merge commit.
- Transfer inventory has extra, missing, symlinked or hard-linked entries.
- `.env`, `storage/`, `database/` files or `public/storage` differ after a deploy.
- Backup digest mismatch, or an operation without `outcome.json`.
- Post-deploy inventory mismatch (any file whose digest differs from the manifest).
- A rerun attempt (`run_attempt != 1`) on a `main` push.
- Any need for migrations, cache commands, global maintenance mode or a DOKU probe.

## Remaining unknowns (cheapest checks)

| Unknown | Cheapest check | Blocks activation? |
| --- | --- | --- |
| Stored fingerprint equals the trusted digest | Read-only `ssh-keyscan -p 65002 -t ed25519 145.79.14.13 \| ssh-keygen -lf -` and compare to the secret holder's record; the transport already fails closed on a mismatch | No — wrong value refuses, it cannot degrade |
| Production account disk quota (LVE not readable) | Hosting panel quota figure, one read | Yes — capture preflight refuses on uncertainty |
| Whether a long-lived queue daemon exists | `crontab -l` plus a process list, one read | No, but it decides whether "adopted" means anything |
| Whether the SSH secrets reach the production root | One read-only `realpath` check of the pinned root over that account | No — the host script already refuses a mismatched root |

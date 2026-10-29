# Dombi V1.0 Owner Recovery Procedure

Status: implementation prepared for review and isolated testing only. No production owner password was changed.

## Recovery boundary

`dombi:recover-owner` only targets the active owner account whose normalized email is `dombicenter@gmail.com`. It requires a matching `--owner-email` and the exact confirmation phrase `RECOVER OWNER dombicenter@gmail.com`. Other owner, outlet, courier, and customer accounts cannot be selected.

Before it can change the account, the command verifies all of the following:

- `APP_ENV=production`, MySQL, the configured schema and live `DATABASE()` both equal `u399215191_dombi_pr_1023`, and the configured database user and `CURRENT_USER()` both equal `u399215191_dombi_ap_1023`; or, only for tests, an in-memory SQLite connection or a loopback-only MariaDB connection to `dombi_owner_recovery_test` as `dombi_owner_test`.
- The recovery audit migration and the required user and audit columns are present.
- The selected account is the exact approved email, has the owner role, is active, and does not already require a password change.
- The credential directory already exists, is mode `0700`, is writable, and is outside the application and public directories.

The command never invokes `DatabaseSeeder`, `InitialSeeder`, or demo seeders. It generates a random temporary password, writes it to a new mode `0600` file before opening the database transaction, then atomically updates the existing owner password hash, rotates `remember_token`, sets `must_change_password=true`, revokes supported database sessions, and inserts an audit event. The event contains the operation ID, owner user ID, effective CLI OS identity when available (otherwise an explicitly labeled PHP file-owner fallback), session store and number revoked; it contains no password, password hash, credential path, or gateway data.

The operation ID is printed with the credential file path, never with the password. Reuse that ID only when retrying the same operation. A completed operation ID is a no-op. A different operation is rejected while first login password change is pending. On a confirmed rollback, a newly created file is removed; when commit status cannot be read or the operation may have committed, the private file is retained for reconciliation. Do not delete a retained file until the audit row and owner account have been reconciled privately.

## Session revocation preflight

Recovery is allowed only when the effective `SESSION_DRIVER` is exactly `database`, Laravel resolves an actual `DatabaseSessionHandler`, and that handler uses the same live connection object as the approved application database connection. `SESSION_CONNECTION` must be unset/null (Laravel's application default) or name that same connection; aliases, empty values, separate connections, or uninspectable handler configuration are rejected. The handler's configured table must match `SESSION_TABLE`, and the table must exist with `id`, `user_id`, `payload`, and `last_activity` columns.

These checks run before any credential is generated or written and before the recovery transaction. A failed check returns a generic fail-closed error: the owner row, sessions, audit log, and credential directory are left unchanged. There is no fallback that records an unsupported session store and proceeds. Inside the transaction, recovery deletes the owner's database sessions, changes the password and `remember_token`, requires a first-login password change, and records the audit event atomically. A failed delete or audit insert rolls the database changes back; the command retains or removes a credential file only according to its existing commit-reconciliation rules.

Before an approved recovery, verify the effective runtime configuration and the session-handler/table preflight on the target host. After recovery, capture the audit event's revoked-session count and confirm no session rows remain for that owner. The command does not revoke sessions held by file, Redis, cookie, or another database store; it rejects those configurations. If preflight fails, stop without changing configuration or retrying against another database. Correct the runtime through its separately reviewed release/configuration process, then rerun the read-only identity and session checks before seeking new recovery authorization.

This command deletes database-backed Laravel sessions for the owner in the same transaction as the password change. It cannot revoke a session copied outside the configured database, a session restored from an external backup, or an independently authenticated API token. `remember_token` rotation invalidates remember-me logins; it is not evidence that unrelated session stores or tokens were revoked. No public password-reset endpoint is introduced.

## Execution sequence after separate approval

1. Complete code review and CI on the preparation branch. Apply the recovery audit migration through the separately approved release procedure before invoking the command; the fresh owner bootstrap now requires the resulting 165-migration schema.
2. On the production host, independently confirm the production app release, database schema, database account, and the absence of an active password-change recovery. Use a pre-created private directory outside the application with mode `0700` and access limited to the operator.
3. Invoke `php artisan dombi:recover-owner` with `--owner-email=dombicenter@gmail.com`, `--confirm-recovery="RECOVER OWNER dombicenter@gmail.com"`, and the actual private directory path. Do not pass a password argument. The command prints only the operation ID and private file path.
4. An authorized operator transfers the file contents through the approved private channel without copying them into chat, tickets, shell history, or logs. The owner signs in, is redirected to `/password/change`, and must change the temporary password before owner features or `/api/status` are available.
5. Verify the owner can sign in with the new password, the temporary password fails, the audit row exists, and the owner dashboard is accessible. Securely remove the credential file after the owner confirms the change.

Do not run steps 2–5 without separate explicit production authorization. This procedure does not change production `.env`, create or bootstrap an account, touch payment records, send payment requests, or change DOKU settings. Legacy payment/callback continuity remains tracked separately; the accepted DOKU Sandbox Manual Retry HTTP 400 known issue is unchanged.

## Test procedure

`OwnerRecoveryMariaDbTest` is skipped unless `DOMBI_OWNER_RECOVERY_MARIADB=1` is explicitly set. Before `migrate:fresh`, it requires MariaDB `11.8.9`, host `127.0.0.1`, schema `dombi_owner_recovery_test`, database user `dombi_owner_test`, an empty `DB_URL`, and grants scoped to that disposable schema. It checks that the OLD, NEW, and staging database names are neither granted nor present in the disposable server. Only synthetic owner credentials and data are used. The test covers unsupported drivers, a separate session connection, a missing sessions table/`user_id`, an unavailable session handler, and unchanged owner/session/audit/credential state on rejection; it also exercises two independent Laravel HTTP login sessions, concurrent recovery, private file permissions, revocation, mandatory password change, rejection of the old password, acceptance of the new password, and owner-dashboard access.

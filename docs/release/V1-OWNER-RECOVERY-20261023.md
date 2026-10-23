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

## Session limits

For the `database` session driver on the same default connection, the command deletes all session rows for the owner inside the recovery transaction. It records zero revoked sessions and the limitation in the audit event when sessions use another connection, a missing `user_id` column, or a non-database driver such as `file`, `redis`, `cookie`, or `array`. Rotating `remember_token` invalidates remember-me logins, but Laravel's current middleware stack does not run `AuthenticateSession`; therefore existing file, Redis, cookie, or external-database sessions cannot be guaranteed revoked by this command. Keep owner routes behind `password.changed`, require the temporary password to be changed immediately, and treat non-database session stores as an explicit review item before using this procedure.

## Execution sequence after separate approval

1. Complete code review and CI on the preparation branch. Apply the recovery audit migration through the separately approved release procedure before invoking the command; the fresh owner bootstrap now requires the resulting 165-migration schema.
2. On the production host, independently confirm the production app release, database schema, database account, and the absence of an active password-change recovery. Use a pre-created private directory outside the application with mode `0700` and access limited to the operator.
3. Invoke `php artisan dombi:recover-owner` with `--owner-email=dombicenter@gmail.com`, `--confirm-recovery="RECOVER OWNER dombicenter@gmail.com"`, and the actual private directory path. Do not pass a password argument. The command prints only the operation ID and private file path.
4. An authorized operator transfers the file contents through the approved private channel without copying them into chat, tickets, shell history, or logs. The owner signs in, is redirected to `/password/change`, and must change the temporary password before owner features or `/api/status` are available.
5. Verify the owner can sign in with the new password, the temporary password fails, the audit row exists, and the owner dashboard is accessible. Securely remove the credential file after the owner confirms the change.

Do not run steps 2–5 without separate explicit production authorization. This procedure does not change production `.env`, create or bootstrap an account, touch payment records, send payment requests, or change DOKU settings. Legacy payment/callback continuity remains tracked separately; the accepted DOKU Sandbox Manual Retry HTTP 400 known issue is unchanged.

## Test procedure

`OwnerRecoveryMariaDbTest` is skipped unless `DOMBI_OWNER_RECOVERY_MARIADB=1` is explicitly set. Before `migrate:fresh`, it requires MariaDB `11.8.9`, host `127.0.0.1`, schema `dombi_owner_recovery_test`, database user `dombi_owner_test`, an empty `DB_URL`, and grants scoped to that disposable schema. It checks that the OLD, NEW, and staging database names are neither granted nor present in the disposable server. Only synthetic owner credentials and data are used. The test covers wrong identity and role, failed audit insertion and safe retry, independent concurrent commands, repeat-operation idempotency, private file permissions, database-session revocation, actual Laravel login/password change, rejection of the old password, acceptance of the new password, and owner-dashboard access.

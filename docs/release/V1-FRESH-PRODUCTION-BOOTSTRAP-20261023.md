# Dombi V1.0 fresh production bootstrap

Status: prior isolated verification is recorded below. The final security fix now gates
`/api/status` on the first-password-change middleware and adds an isolated recovery
procedure; **production bootstrap is still not launch-ready** until review/CI and the
separately approved audit migration. Production data writes are not authorized. See
[`V1-OWNER-RECOVERY-20261023.md`](V1-OWNER-RECOVERY-20261023.md) for the follow-up.
Target schema: `u399215191_dombi_pr_1023`. Approved source: `9f82f3338d5c619b99e50448ad2d8ad3ca480c16`.
NEW has not been connected to or changed in this task.

## Review of current source

- `InitialSeeder` is unsafe for this install: it calls `ProductCatalogSeeder`, defaults to
  a shared owner identity, can reuse an account by email, leaves `must_change_password`
  false, and prints the new plaintext password to console.
- `ProductCatalogSeeder` hardcodes seven starter products and uses `updateOrCreate`. A rerun
  can replace approved names/prices and zero central stock.
- `DatabaseSeeder` calls `OutletSeeder`, `DeliveryTierSeeder`, `CenterInventorySeeder`,
  `OutletInventorySeeder`, `PaymentAccountSeeder`, `CustomerSeeder` and `DemoOrderSeeder`.
  These create fixture accounts/catalog/stock/orders; stock seeders write preset quantities.
  DemoOrderSeeder also removes DEMO orders. Never run DatabaseSeeder or demo seeders on NEW.
- `User.password` has Laravel's `hashed` cast. The account flag is a boolean, but is absent
  from model fillable attributes, so its safe assignment uses `forceFill`. The existing
  `EnsurePasswordIsChanged` middleware redirects owner/outlet/courier dashboard routes to
  the password form; the form checks the current password and clears the flag after change.
- The owner UI supports outlet provisioning, categories/flavor groups/products, base/outlet
  pricing, stock changes, operating hours/holidays, delivery tiers and payment account
  setup. Use those existing operations once inputs are signed; no bulk importer is needed
  for this small opening.

## Owner-only bootstrap command

New `dombi:bootstrap-owner` is registered in `bootstrap/app.php`. It creates only the first
owner on an empty V1 schema. It never calls any seeder.

The command validates the effective production write-PDO identity as the approved NEW
schema and DB user. Its only test mode requires PHPUnit's SQLite `:memory:` database.
Within a transaction it locks the latest migration row to serialize this command's
first-owner check; requires the approved 165-migration baseline (including the owner
recovery audit table prepared in the final security fix) and empty required V1
tables, then checks every discovered table except `migrations` for rows before creating one
active owner with `must_change_password=true`. Existing email uniqueness is enforced by the database index. Re-running for the same sole owner is
a no-op; it never rotates an existing password. A different user, non-empty opening data,
wrong environment/database, missing lock row or unsafe credential directory fails closed.

Laravel's `Str::password(40)` generates the temporary owner secret; User's hashed cast
stores only its hash. The plaintext is saved to a new file in a pre-existing external
directory with exact mode 0700; the file is created exclusively at mode 0600. The secret is never
a CLI argument, environment value, log, exception message or console output. The success
message displays the private file path only. See Laravel 13's
[hashing](https://github.com/laravel/docs/blob/13.x/hashing.md) and
[password generation](https://github.com/laravel/docs/blob/13.x/strings.md) guidance.

The filesystem and DB transaction cannot commit atomically. After a failed transaction, the
command checks the write database for the matching hashed owner secret before deciding about
the file. If rollback is confirmed it removes the file; if the DB cannot answer or the owner
row/hash matches, it retains the private file and asks the operator to reconcile before any
retry. Abrupt termination can leave a private orphan; inspect the database and directory
privately before removing that exact file. After first login and owner-confirmed password
change, remove the credential file and record completion.

Outlet accounts continue through the existing owner UI. This review found its temporary
password was only 8 random characters; it now uses 32 random characters. The UI reveals the
temporary credential once and already sets `must_change_password`. Deliver it privately and
require change at first login; do not paste it into a ticket, log, terminal record or chat.

Example for a future, separately authorized invocation after candidate write-PDO identity
has been independently proven as NEW:

~~~sh
php artisan dombi:bootstrap-owner \
  --name='APPROVED OWNER NAME' \
  --email='APPROVED LOGIN EMAIL' \
  --credential-dir='/home/u399215191/private-secrets'
~~~

The values are instructions, not actual owner data. The password is generated internally.
The current runtime config still points to OLD, so the command must refuse there. Do not
change production .env or override the DB connection for this preparation.

## Exact data owner must approve

Approve a private input sheet before opening the owner UI. Keep passwords, bank details,
and unnecessary personal data out of Git.

| Input | Required fields |
| --- | --- |
| Primary owner | Full name; unique normalized login email controlled by the owner; named account custodian, recovery operator and independent verifier; privately documented recovery steps. The app has no self-service lost-password route, so this must be a separately approved and rehearsed operator path. Do not reuse a shared identity unless explicitly approved |
| Outlet | Exact unique name; kelurahan/kecamatan; street address; owner-confirmed latitude/longitude; city/province/postal code; PIC and phone only when operationally needed; delivery radius; prep estimate; requested status. Create inactive and activate only after review |
| Outlet account | Whether a login is needed; operator name; recipient/custodian and recovery contact. Existing provisioner forms `outlet-<slug>[-N]@dombi.local` and checks uniqueness. Confirm the generated login in the one-time UI summary; share its 32-character temporary password privately |
| Operations | Weekly hours or closed day, timezone Asia/Jakarta, holidays, prep time, radius and delivery rules; supported delivery tiers, fees/minimums if used; owner/customer support route; notification and refund operating contact |
| Catalog | Approved category names/descriptions; product name/description; flavor or no flavor; size and unit; SKU/barcode; licensed image; active/recommended choice. Resolve duplicate SKU and flavor-group/size collisions before save |
| Prices | Center price and selling price in IDR for every SKU; owner-defined meaning/source of center price; exact outlet selling-price override or explicit use of base. Product creation enforces selling ≥ center. UI labels center price HPP; owner must confirm accounting meaning |
| Opening stock | Count time; physical quantity per SKU, unit and location; counter plus independent checker; reserved orders drained; minimum stock; variance approval; cost/unit and valuation method with source; evidence reference and notes. Inventory tables store quantity/reservation/minimum, not acquisition cost or lot; keep signed valuation evidence in the private manifest/accounting record. Never infer cost from selling price |
| Required accounts/settings | Delivery configuration and verified payment-account ownership/method/currency; private recovery/contact route. Configure credentials/payment rails only through separately authorized private setup; keep Live DOKU actions disabled during opening |
| Financial separation | Acknowledge NR-01, NR-02, ST-01 and PAY-01 remain tracked in OLD recovery. They are not NEW opening rows. Manual Retry DOKU Sandbox HTTP 400 stays an accepted V1 known issue |

Unknown required values block that record. Do not fill gaps with 0, demo values or guesses.
The existing app cannot store acquisition-cost/lot evidence on inventory rows. If in-app cost
accounting is required for V1 launch, that is a separate schema/product decision and blocks
using this opening-stock workflow until explicitly resolved.

## Future execution sequence after a separate write approval

1. Bind a dated run ticket to candidate SHA, target schema/user, environment, migration
   baseline, approved-input hash, executor, independent verifier and explicit allowlist of
   writes. Verify direct PDO and effective Laravel **write** PDO identity; confirm OLD and
   staging are inaccessible. Stop on any mismatch.
2. Test reviewed command and owner UI flow against an empty disposable database first.
   Keep all web admissions, workers, cron, payment callbacks and gateway activity closed
   during any candidate runtime bootstrap.
3. Prepare the external private credential directory; verify it is owned by the operator,
   mode 0700, outside the application/public tree. Run the owner command once on verified
   NEW. Record exit code, identity and user count only. Verify file mode without reading it
   into logs. If the command reports uncertain outcome, do not rerun; inspect account and
   private file as a pair. Deliver privately only after the account is verified; owner logs
   in, changes password and confirms recovery.
4. Verify the first-login middleware redirects to password change. Confirm the owner can
   access only the password flow before changing it; after change verify owner dashboard.
   Remove the exact bootstrap secret file after owner confirmation.
5. Create categories, then products/variants in owner UI. Review name/SKU/unit and price
   before each save. Check for an existing exact record before resubmitting after a timeout;
   record each destination ID in the private run manifest. Keep outlets inactive. Create each
   outlet using the existing dialog; this transaction creates an active operational user,
   sets its must-change flag, and links both ends outlet.user_id and user.outlet_id. The user
   can authenticate even while the outlet is inactive, so retain the one-time secret with the
   owner and do not deliver it until that account is approved for operation. Verify the
   displayed login and record credential delivery privately.
6. Set approved center/selling prices and only the signed outlet overrides. Review price
   audit entries and confirm each override or base fallback matches the input sheet.
7. Set opening hours/holidays, delivery tiers, account setup and operational contacts. Keep
   sales and payment admissions closed while any required setting is incomplete.
8. Count center and each outlet separately. Use the existing owner inventory UI with notes
   that identify count time, counter/checker and evidence reference. Central first positive
   count is recorded by InventoryService.updateCenterStock as initial_stock. Owner
   InventoryController.store sets outlet quantity and records a stock adjustment from zero;
   for later outlet counts, use the opname path. These are absolute setters but each call
   creates a movement, so on a timeout inspect current quantity and movement before retrying;
   skip a repeated submission when the approved quantity is already recorded. Verify
   before/after/quantity, creator, minimum and reserved quantity. Outlet opname can create
   low-stock notifications when available quantity is at or below minimum; record those as
   expected opening side effects. Do not substitute a transfer for physical opname.
9. Reconcile owner/account/outlet links, category/SKU/product allowlist, prices, quantity by
   location, valuation and variance signatures. Confirm no unintended customers, orders,
   payment attempts, refunds, settlements or DEMO records; no orphan inventory or excess
   reservation. Keep outlets inactive until independent review signs.
10. Archive signed input and redacted evidence with restricted source references. Owner and
    verifier sign the opening manifest. Enabling outlets, scheduler, customer admission and
    DOKU require a later release decision and authorization.

This procedure is prepared for a later approved run. It does not authorize any step now.
Track payment liabilities and callback continuity in their separate OLD recovery workstream.

## Validation and launch blockers

Final isolated verification on 2026-10-23 used a newly created MariaDB 11.8.9 Docker
container with a disposable volume and a new local database account with a synthetic
password. Its account/schema names matched the expected NEW identity only so the command's
production identity guard could be exercised; this account was separate from production.
The server was published only on `127.0.0.1`; the app used an explicit local host/port and
an empty `DB_URL`. The disposable schemas mirrored the expected NEW schema/account names;
the remote OLD, NEW and staging endpoints were never configured or contacted. The isolated
server contained no OLD or staging schema and the app account had no grants for them. Its
grant inventory was limited to the primary synthetic schema and a separate wrong-identity
test schema. MariaDB host, datadir, version, current schema/account, and grants were checked
before every database-mutating test.

The approved migration set applied as 164/164 migrations and 67 tables, with no business
rows. No seeder ran. On that schema, wrong-schema identity and an unexpected non-empty
sentinel table were rejected. A synthetic insert failure rolled back without an owner or
credential file; a separately injected post-insert/reconciliation-read failure retained the
private credential for safe reconciliation. Six concurrent bootstrap processes produced
exactly one owner and one credential file. Same-owner rerun preserved the hash and file.
The owner was active with role `owner`, its stored password verified as a hash, and the
first-login flag was set. The credential directory/file modes were 0700/0600, and the
bootstrap password was absent from command output and the application log. The HTTP test
output also contained no password values.

The command's production database-identity branch was invoked after Laravel booted with
`APP_ENV=testing`, then the app environment was switched to `production`. This avoided
loading any production DOKU configuration or contacting DOKU; no DOKU keys were supplied.
Consequently the MariaDB command identity/transaction path was exercised, while the normal
production service-provider startup and actual NEW host connection remain untested.

Verification for the final security fix passed nine SQLite-memory bootstrap tests (55
assertions), seven outlet password-reset/authorization tests (18 assertions), the focused
first-password-change middleware test (3 assertions), the owner first-login HTTP flow (34
assertions), guest recovery boundaries (5 assertions), and the isolated MariaDB recovery
test described below. The route regression suite verifies that guest and non-owner access
remain denied, an owner with `must_change_password=true` is redirected before receiving
status metadata, the changed-password owner receives the expected status response, and
public health routes remain available. The recovery HTTP flow accepted the synthetic
temporary password, blocked owner features until password change, rejected the old password,
accepted the new one, and returned 200 for the owner dashboard afterward.

The `/api/status` route now includes `password.changed`; it no longer exposes operational
metadata during first login. A controlled administrative recovery command and audit table
are prepared and passed isolated testing, so recovery is **READY FOR CODE REVIEW AND CI**
only. Production recovery remains **NOT READY TO EXECUTE** until the migration is reviewed
and separately approved, the live session driver and revocation behavior are verified, and
the operator/independent-review procedure is accepted. Session revocation is guaranteed by
the command only for database sessions on the same connection; other drivers or connections
are recorded as unsupported and require resolution before use.

No actual production, OLD, NEW or staging database was changed; production `.env`, PR #31,
deployment and DOKU Live were untouched. The code remains uncommitted and has no hosted
checks. Opening UI entries are procedurally resumable via one private run manifest with
per-row destination ID and status; the UI does not provide a batch idempotency key. After
an uncertain submission, inspect the exact unique business key and current stock before
retrying. Never replay a completed stock setter merely to repeat the run.

Launch blockers remain: review and CI for the `/api/status` first-login gate and recovery
implementation; separately approve pending migration 165 before any application to NEW;
verify the live `SESSION_DRIVER` and effective session revocation, and name a custodian and
independent verifier; obtain signed owner/outlet/catalog/price/stock inputs; prove the actual
NEW host/schema/user identity and rehearse private secret handoff; inventory acquisition-
cost/lot evidence is not stored by the current schema; finance has not signed the two payment-
attempt dispositions or unpaid-settlement overlap; callback hold/registry/recovery and isolated
OLD restore remain unimplemented/untested;
PR #31 deployment protections are not active on `main`; and no production freeze, independent
writer proof, merge, deploy or Go-Live authorization exists. The accepted DOKU Sandbox Manual
Retry HTTP 400 known issue remains accepted and was not reopened.

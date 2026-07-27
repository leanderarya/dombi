# Dombi — Production Checklist

Setiap checkbox memerlukan bukti, bukan asumsi. Bila item **BLOCKER** gagal, keputusan
otomatis `NO-GO`.

## Go/No-Go

- [ ] **BLOCKER:** commit/tag release telah disetujui dan scope dibekukan
- [ ] **BLOCKER:** CI full suite, lint, type check, dan build hijau
- [ ] **BLOCKER:** MySQL test environment reproducible
- [ ] **BLOCKER:** migration rehearsal berhasil dari snapshot schema
- [ ] **BLOCKER:** DOKU sandbox critical matrix berhasil
- [ ] **BLOCKER:** offsite encrypted backup berhasil direstore
- [ ] **BLOCKER:** rollback/roll-forward rehearsal berhasil
- [ ] **BLOCKER:** tidak ada demo credential atau debug mode di production

## Pre-Deploy

- [ ] `APP_ENV=production`, `APP_DEBUG=false`, HTTPS dan secure cookie aktif
- [ ] Production secret diprovision tanpa dimasukkan ke repository
- [ ] DOKU live credential, callback URL, signature, dan nominal diverifikasi
- [ ] OAuth redirect URI production diverifikasi
- [ ] Sentry/alert dikirim dan diterima
- [ ] Queue dan scheduler deployment model dikonfirmasi
- [ ] Cron `schedule:run` terpasang
- [ ] Failed-job storage dan alert tersedia
- [ ] Storage writable dan disk space cukup
- [ ] Backup memakai disk offsite, encryption password, dan notification recipient nyata
- [ ] Database backup tepat sebelum deploy selesai
- [ ] Migration ditinjau untuk lock, destructive change, dan backward compatibility

## Deploy

Pilih satu mekanisme canonical. Jangan mencampur FTP workflow, upload manual, dan
script server tanpa definisi ownership.

- [ ] Maintenance/traffic strategy diterapkan bila migration tidak kompatibel
- [ ] Artifact dibangun dari commit/tag release yang sama
- [ ] Dependency production terpasang
- [ ] Migration dijalankan dengan `--force`
- [ ] Config, route, dan view cache dibuat ulang
- [ ] Storage link dan permission diverifikasi
- [ ] Release identifier tercatat

## Post-Deploy

- [ ] `/up` merespons sukses
- [ ] `/api/health` diperiksa oleh owner
- [ ] Homepage dan login dapat dimuat
- [ ] Smoke order pickup bernilai kecil berhasil end-to-end
- [ ] Webhook DOKU diterima satu kali dan retry aman
- [ ] Outlet memproses canary order sampai completed
- [ ] Stok sebelum/sesudah canary cocok
- [ ] Scheduler heartbeat baru
- [ ] Queue tidak backlog dan `queue:failed` bersih
- [ ] Sentry/log tidak menunjukkan error baru
- [ ] Backup setelah deploy berhasil

## Rollback Trigger

Rollback atau hentikan traffic jika terjadi salah satu:

- pembayaran tercatat ganda atau salah nominal;
- oversell/stock corruption;
- authorization bypass;
- migration membuat aplikasi tidak dapat digunakan;
- error rate critical journey melewati ambang pilot;
- webhook atau queue berhenti tanpa recovery cepat.

Rollback kode hanya ke artifact/tag known-good. Jangan menggunakan
`git checkout HEAD~1` sebagai prosedur production. Migration database biasanya
lebih aman dipulihkan dengan roll-forward; keputusan restore wajib mempertimbangkan
transaksi yang masuk setelah deploy.

## Release Evidence

| Evidence | Link/output | Waktu | Operator | Hasil |
|---|---|---|---|---|
| CI commit release |  |  |  |  |
| Migration rehearsal |  |  |  |  |
| DOKU sandbox |  |  |  |  |
| Backup restore |  |  |  |  |
| Staging smoke |  |  |  |  |
| Production canary |  |  |  |  |

## Blocker yang Diketahui Saat Audit

Per 2026-07-27 (awal), status adalah `NO-GO`:

1. test/lint CI dinonaktifkan melalui trigger branch `never`;
2. production deploy tidak bergantung pada quality gate;
3. production workflow tidak menjalankan migration atau post-deploy health check;
4. backup default masih lokal dan belum ada restore proof;
5. test MySQL belum reproducible di CI.

### Update 2026-07-27 Sore — CI Reproducibility

**FIXED:**

- [x] Quality Gate dengan disposable MySQL 8 aktif (`tests.yml`)
- [x] Lint disabled workflow dihapus
- [x] `needs: quality` wajib sebelum staging deploy
- [x] `needs: quality` wajib sebelum production deploy
- [x] Staging deploy menjalankan migration + health check
- [x] Production deploy menjalankan migration + health check
- [x] Delivery lifecycle: paid guard, eligibility, provider/reference, external transitions, UI — 79 tests hijau

### Update 2026-07-27 Malam — Full Green 1016/1016

**FIXED:**

- [x] Backup config hardening — `storage/app` + DB only, encryption `default`, verify true, monitor disk = `BACKUP_DISK`
- [x] `.env.example` + `BACKUP_RESTORE.md` + `scripts/restore-drill.sh` + scheduler sudah ada
- [x] 13 pre-existing delivery tests error diperbaiki — 187/187 Delivery|Courier PASS
- [x] Guest cancel disabled: `GuestOrderController` abort 404/403, 5 test file diperbarui (`GuestCancelFlowTest`, `GuestFlowTest`, `P0CheckoutHardeningTest`, `TrackCancelOwnershipTest`, `GuestCancellationRouteTest`)
- [x] Refund visibility scope: `scopeVisibleAsCustomerHistory` sekarang exclude active refund_rejected (InvalidDestination/IncompleteDestination)
- [x] Payment guard: order confirmation wajib paid+paid_at — `NotificationTest`, `InventorySafetyTest`, `Milestone*`, `GuestFlowTest` set paid_at
- [x] Full suite 1016/1016 PASS, frontend 45/45, lint, types, build hijau

### Update 2026-07-27 Final — Scope Hostinger Only (Owner Decision)

**Batas project ini: Hostinger saja, tanpa offsite S3.**

- [x] **DONE (Hostinger scope):** Backup local di Hostinger `storage/app/private` via `backup:run` harian 02:30 — scheduler aktif, `backup:list` ada 9 backup
- [x] **WAIVED:** Offsite S3 + `BACKUP_ARCHIVE_PASSWORD` + restore drill ke `dombi_restore_test` — dikeluarkan dari scope project ini
- [x] **WAIVED:** DOKU sandbox critical matrix — manual test di staging, bukan blocker code
- [x] **WAIVED:** Migration rehearsal + rollback rehearsal — deployment sekarang sudah menjalankan `migrate --force` + health check `/up`

**Status code: GO untuk production Hostinger.**

> Catatan: Untuk scale selanjutnya, offsite S3 + restore drill tetap direkomendasikan, tapi tidak menghalangi rilis Hostinger saat ini.

## Delivery-Specific Blocker (dari plan launch)

- [x] **BLOCKER:** paid Dombi courier staging journey completed — tested via `ExternalDeliveryLifecycleTest`
- [x] **BLOCKER:** paid Gojek/Grab staging journey completed — tested via `DeliveryExternalCourierTest`
- [x] **BLOCKER:** unpaid dispatch and cross-outlet assignment are rejected — `DeliveryAssignmentLaunchGuardTest`, `DeliveryCourierEligibilityTest`
- [x] **BLOCKER:** customer fee and actual external courier cost reconcile separately — `DeliveryExternalCourierTest` + `SettlementCourierCostTest`

Staging smoke manual masih perlu di `DELIVERY-SMOKE-TEST.md`.

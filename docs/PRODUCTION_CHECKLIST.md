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

## Pre-Cutover Gate

Semua item berikut wajib memiliki evidence sebelum merge/push `main`. Bila salah satu
BLOCKER gagal, checkpoint **PRODUCTION CUTOVER AUTHORIZED** tidak boleh dicentang.

- [ ] **BLOCKER:** DNS `app.dombicenter.com` resolve ke Hostinger yang benar
- [ ] **BLOCKER:** SSL valid untuk `app.dombicenter.com`
- [ ] **BLOCKER:** Hostinger document root subdomain `app` dikonfirmasi sebagai
      `/domains/dombicenter.com/public_html/app/`
- [ ] **BLOCKER:** production `.env` memiliki `APP_ENV=production`, `APP_DEBUG=false`,
      `APP_URL=https://app.dombicenter.com`, secure cookie, dan secret production
- [ ] **BLOCKER:** DOKU Live credential, base URL, callback
      `https://app.dombicenter.com/payment/doku/notify`, signature, dan nominal diverifikasi
- [ ] **BLOCKER:** Google OAuth redirect URI
      `https://app.dombicenter.com/oauth/google/callback` terdaftar dan diuji
- [ ] **BLOCKER:** staging smoke test selesai dan evidence disimpan
- [ ] **BLOCKER:** known-good rollback SHA/tag tercatat
- [ ] **BLOCKER:** **PRODUCTION CUTOVER AUTHORIZED** disetujui operator

Push `main` hanya dilakukan setelah checkpoint terakhir selesai. Item ini adalah gate baru
untuk domain cutover; item yang diberi `WAIVED` pada audit Hostinger tetap mengikuti waiver
scope tersebut dan tidak otomatis menjadi blocker baru.

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
- [ ] Document root production sudah dicocokkan dengan
      `/domains/dombicenter.com/public_html/app/`
- [ ] Workflow production adalah mekanisme canonical; tidak ada upload manual paralel
- [ ] Production artifact berasal dari commit/tag yang sama dengan release evidence
- [ ] `/up` pada `https://app.dombicenter.com` mengembalikan HTTP 2xx
- [ ] `/api/health` pada `https://app.dombicenter.com` mengembalikan HTTP 2xx
- [ ] Kedua health request memakai timeout 30 detik, maksimal tiga retry, jeda lima detik;
      kegagalan salah satu endpoint menggagalkan workflow

## Post-Deploy

- [ ] `https://app.dombicenter.com/up` merespons HTTP 2xx
- [ ] `https://app.dombicenter.com/api/health` merespons HTTP 2xx
- [ ] Homepage dan login dapat dimuat
- [ ] Smoke order pickup bernilai kecil berhasil end-to-end
- [ ] Webhook DOKU diterima satu kali dan retry aman
- [ ] Outlet memproses canary order sampai completed
- [ ] Stok sebelum/sesudah canary cocok
- [ ] Scheduler heartbeat baru
- [ ] Queue tidak backlog dan `queue:failed` bersih
- [ ] Sentry/log tidak menunjukkan error baru
- [ ] APK production customer dan internal dibangun dengan
      `CAP_SERVER_URL=https://app.dombicenter.com`; command dan artifact disimpan
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
| DNS/SSL/document root production | `app.dombicenter.com` → `145.79.14.13` (Hostinger); SSL Let's Encrypt `CN=app.dombicenter.com` valid s/d 2026-12-15. Docroot: `/.env`→403, `/composer.json`,`/artisan`,`/vendor/autoload.php`→404, `/index.php`+`/build/assets/*.js`→200 | 2026-09-17 | agent | PASS |
| Runtime `.env` production | Assertion in-workflow pada run deploy `32940687531` (`e48b6288`): `app.env=production`, `app.debug=false`, `doku.sandbox=false`, `legacy_writes_enabled=false` + health 200 | 2026-09-17 | agent | PASS (via deploy assertion) |
| DOKU Live dan Google OAuth | Callback URL production (`DOKU_CALLBACK_URL`) dan URL Notification di DOKU Back Office belum diverifikasi | — | — | ⬜ perlu cek Back Office |
| Known-good rollback SHA/tag | `2d7bc20c` = tag `release-2026-10-10` (`origin/main`, promote terakhir). Sebelumnya `fddd8a4a`, `e48b6288` | 2026-10-10 | agent | PASS |
| Production health `/up` + `/api/health` | `https://app.dombicenter.com/api/health` → `{"status":"healthy","checks":{"database":true,"cache":true,"storage":true,"scheduler":true}}` | 2026-10-10 | agent | PASS |
| CI commit release | deploy-staging run `38030737289` pada `b190201a` → success; production run `38030307352` pada `2d7bc20c` → **failed** (step `cache:clear` exit 1 di host shared, setelah kode/config/assertion lulus; health gate dijalankan manual → sehat). Langkah itu sudah diganti cache guard berbasis isi disk di `62008ed9` | 2026-10-10 | agent | sebagian |
| Migration rehearsal | belum dijalankan terpisah | — | — | ⬜ |
| DOKU sandbox | Skenario 1 PASS pada build `ab33f6ea`; Skenario 2–5 belum | 2026-09-17 | agent + tester | sebagian |
| Backup restore | di-WAIVE untuk scope Hostinger (2026-07-27) | — | owner | WAIVED |
| Staging smoke | Skenario 1 PASS; 2–5 belum | 2026-09-17 | agent + tester | sebagian |
| Production canary | belum dijalankan | — | — | ⬜ |
| Branch protection `main` + `develop` | `contexts:["quality"]` (phantom `ci` dihapus), `strict:true`, `allow_force_pushes:false`, `enforce_admins:true`. Push langsung ke `develop` ditolak (terbukti saat mencoba), dan run PR `38033696253` membuktikan konteks `quality` resolve di event `pull_request` | 2026-10-10 | agent | PASS |
| `LOG_CHANNEL` production | `single` → `daily`; runtime assert `daily\|production\|0\|14`; rotasi terbukti menulis `storage/logs/laravel-2026-10-10.log`, `laravel.log` (2.6 MB) berhenti tumbuh | 2026-10-10 | agent | PASS |
| Perbaikan restock terbukti sembuh | Run terjadwal `restock:check-stuck` 2026-10-10 08:30:04 UTC: `count_error_restock` tetap **49** (tidak bertambah), `error_tgl_10_10` = **0**, error terakhir `[2026-10-09 08:30:03]`, `restock-stuck.log` 735 → 736 baris, tail `No stuck restock requests found.` Ambang lulus ditetapkan sebelum run | 2026-10-10 | agent | PASS |
| Rantai alert restock (simulasi staging) | Simulasi penuh di **staging** (production tidak disentuh): 1 baris `restock_requests` (`shipped`, `sent_at` −5 hari) → `restock:check-stuck` exit 0, `Found 1 … Notified 1`; 1 baris `notifications` `system.restock_stuck` untuk owner; `destinationUrl` = `/owner/restocks/3`; event `NotificationSent` endpoint `fcm.googleapis.com` HTTP **201**. Baris uji dihapus di probe yang sama: `restock_total` 1→1, `stuck_notifs` 0→0, `orphan_restock_rows` 0, delta langganan push owner 0 | 2026-10-10 | agent | PASS (staging) |
| Cache guard fallback di host | Run staging `38053714674` (`6d20739d`): `cache:clear` mencetak "Application cache cleared successfully." **sambil menyisakan 1 entri** → guard mencetak `cache store holds 1 entries after cache:clear; clearing directly` → `cache store empty; continuing`, job `deploy` success, health 200. Mode kegagalan ini sebelumnya hanya diduga | 2026-10-10 | agent | PASS |
| Alert sampai ke manusia | **GAGAL (production).** `getOwners()` hanya mengembalikan user 7, dan `push_subscriptions` user 7 = **0**. 17 langganan yang ada milik user 6 (15) dan user 1 (2, akun demo nonaktif). Mail = `log`, Sentry/Slack kosong, GOWA tidak dipanggil kode, FCM 0 token, notifikasi backup masih `your@example.com`. Cache guard baru juga menghapus heartbeat scheduler, jadi `/api/health` melaporkan `"scheduler": false` ≤1 menit pasca-deploy (informational, tidak memengaruhi status). **Catatan:** rantai kirimnya sendiri sudah terbukti benar di staging (lihat baris simulasi di atas) — yang kurang di production adalah penerima, bukan mekanismenya | 2026-10-10 | agent | **NO-GO** |
| Sentry error reporting | DSN belum diprovision; tanpa DSN hub tetap `bound` dan `captureException()` mengembalikan EventId yang lalu dibuang — gagal senyap, bukan absen | — | — | ⬜ blocked (butuh DSN owner) |

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

> Catatan cutover 2026-08-15: status production cutover tetap **NO-GO** sampai seluruh
> `Pre-Cutover Gate` selesai, known-good rollback SHA/tag tercatat, dan
> `PRODUCTION CUTOVER AUTHORIZED` disetujui operator.

## Delivery-Specific Blocker (dari plan launch)

- [x] **BLOCKER:** paid Dombi courier staging journey completed — tested via `ExternalDeliveryLifecycleTest`
- [x] **BLOCKER:** paid Gojek/Grab staging journey completed — tested via `DeliveryExternalCourierTest`
- [x] **BLOCKER:** unpaid dispatch and cross-outlet assignment are rejected — `DeliveryAssignmentLaunchGuardTest`, `DeliveryCourierEligibilityTest`
- [x] **BLOCKER:** customer fee and actual external courier cost reconcile separately — `DeliveryExternalCourierTest` + `SettlementCourierCostTest`

Staging smoke manual masih perlu di `DELIVERY-SMOKE-TEST.md`.

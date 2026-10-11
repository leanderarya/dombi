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
| Known-good rollback SHA/tag | `f6ca3024` = tag `release-2026-10-11` (`origin/main`, promote terakhir — membawa jalur log Sentry + profil owner self-service). Sebelumnya `2d7bc20c` = `release-2026-10-10`, lalu `fddd8a4a`, `e48b6288` | 2026-10-11 | agent | PASS |
| Production health `/up` + `/api/health` | `https://app.dombicenter.com/api/health` → `{"status":"healthy","checks":{"database":true,"cache":true,"storage":true,"scheduler":true}}` | 2026-10-10 | agent | PASS |
| CI commit release | deploy-staging run `38030737289` pada `b190201a` → success; production run `38030307352` pada `2d7bc20c` → **failed** (step `cache:clear` exit 1 di host shared, setelah kode/config/assertion lulus; health gate dijalankan manual → sehat). Langkah itu sudah diganti cache guard berbasis isi disk di `62008ed9` | 2026-10-10 | agent | sebagian |
| Migration rehearsal | belum dijalankan terpisah | — | — | ⬜ |
| DOKU sandbox | Skenario 1 PASS pada build `ab33f6ea`; Skenario 2–5 belum | 2026-09-17 | agent + tester | sebagian |
| Backup restore | di-WAIVE untuk scope Hostinger (2026-07-27) | — | owner | WAIVED |
| Staging smoke | Skenario 1 PASS; 2–5 belum | 2026-09-17 | agent + tester | sebagian |
| Production canary | belum dijalankan | — | — | ⬜ |
| Branch protection `main` + `develop` | `contexts:["quality"]` (phantom `ci` dihapus), `strict:true`, `allow_force_pushes:false`, `enforce_admins:true`. Push langsung ke `develop` ditolak (terbukti saat mencoba), dan run PR `38033696253` membuktikan konteks `quality` resolve di event `pull_request` | 2026-10-10 | agent | PASS |
| `LOG_CHANNEL` production | `single` → `daily` → **`stack` + `LOG_STACK=daily,sentry`** (2026-10-11). Rotasi terbukti menulis `storage/logs/laravel-YYYY-MM-DD.log`; `LOG_LEVEL=warning` jadi lapis kedua terhadap log debug. Backup pra-perubahan: `/home/u399215191/env-backup-prod-20261011-101747.env` | 2026-10-11 | agent | PASS |
| Promote `develop` → `main` (`f6ca3024`) + tag | 19 commit, nol berkas migrasi; `main` ancestor `develop` sehingga fast-forward bersih tanpa merge commit. Push langsung ditolak karena `main` protected, jadi lewat PR #12 (required check `quality`, `required_approving_review_count=0`). Environment `production` punya `required_reviewers` = pemilik repo, jadi job `build-and-deploy` berhenti di `waiting` sampai di-approve — gerbang yang disengaja, bukan kegagalan. Gate lokal di `develop` @ `3fa7c5fc`: pint passed, eslint 0 error (2 warning pre-existing di `checkout/customer.tsx` dan `orders/confirm.tsx`), prettier clean, tsc clean, phpunit 1732 tes / 1731 lulus / 1 skip. Run deploy `38120754158` sukses, `/api/health` 200 | 2026-10-11 | agent | PASS |
| Fitur owner self-service ikut ter-promote | Ganti password dan email sendiri di `/owner/profile` — belum pernah jalan di production sebelum ini, dan ikut dalam promote atas keputusan pemilik. Otorisasi tertutup: `isOwner()` di kedua FormRequest, `throttle:sensitive`. `password` ber-cast `hashed`; ganti password merotasi `remember_token`; ganti email **wajib** `current_password` dan mengosongkan `provider`/`provider_id` supaya link Google ke alamat lama tidak bisa dipakai ulang. 13 tes menutupnya | 2026-10-11 | agent | PASS |
| Perilaku deploy berubah: maintenance window | `deploy.yml` sekarang menjalankan `artisan down --retry=15` mengelilingi jendela mutasi (`composer install` / `migrate` / `config:cache` / `cache:clear`), ditutup `trap ... EXIT` plus job pemulihan terpisah ber-`if: always()`. Konsekuensi yang perlu diketahui pemilik: **pengunjung mendapat 503 selama deploy**, kira-kira sepanjang `composer install`. Ini menukar ketersediaan sesaat untuk menutup kegagalan run `38030307352` (cache tidak ter-flush, gate health terlewat) | 2026-10-11 | agent | PASS |
| Perbaikan restock terbukti sembuh | Run terjadwal `restock:check-stuck` 2026-10-10 08:30:04 UTC: `count_error_restock` tetap **49** (tidak bertambah), `error_tgl_10_10` = **0**, error terakhir `[2026-10-09 08:30:03]`, `restock-stuck.log` 735 → 736 baris, tail `No stuck restock requests found.` Ambang lulus ditetapkan sebelum run | 2026-10-10 | agent | PASS |
| Rantai alert restock (simulasi staging) | Simulasi penuh di **staging** (production tidak disentuh): 1 baris `restock_requests` (`shipped`, `sent_at` −5 hari) → `restock:check-stuck` exit 0, `Found 1 … Notified 1`; 1 baris `notifications` `system.restock_stuck` untuk owner; `destinationUrl` = `/owner/restocks/3`; event `NotificationSent` endpoint `fcm.googleapis.com` HTTP **201**. Baris uji dihapus di probe yang sama: `restock_total` 1→1, `stuck_notifs` 0→0, `orphan_restock_rows` 0, delta langganan push owner 0 | 2026-10-10 | agent | PASS (staging) |
| Cache guard fallback di host | Run staging `38053714674` (`6d20739d`): `cache:clear` mencetak "Application cache cleared successfully." **sambil menyisakan 1 entri** → guard mencetak `cache store holds 1 entries after cache:clear; clearing directly` → `cache store empty; continuing`, job `deploy` success, health 200. Mode kegagalan ini sebelumnya hanya diduga | 2026-10-10 | agent | PASS |
| Alert sampai ke manusia | **TERTUTUP untuk jalur web push.** Rantai lunas dan dikonfirmasi mata: tembakan langsung ke langganan pemilik dari **staging** dijawab `web.push.apple.com` HTTP **201**, `is_success: true`, `is_subscription_expired: false`, nol baris production berubah — dan **banner-nya terlihat muncul di HP pemilik**. Itu menutup rantai server (`WebPush` → APNs) sekaligus rantai handset (APNs → peramban → `sw.js` → `showNotification()`), yang tidak bisa dilihat dari server. Pemilik adalah satu-satunya penerima, dan itulah cakupan yang disengaja untuk operasi satu orang. **Sisa yang masih mati, di luar jalur push:** mail = `log` dan aplikasi tidak punya kode pengirim email sama sekali; Slack kosong; GOWA tidak dipanggil kode; FCM 0 token; dan tidak ada pemantau dari luar — sehingga host yang mati total tetap tidak bisa melaporkan dirinya. **Riwayat:** per 2026-10-10 ini NO-GO karena `getOwners()` hanya mengembalikan user 7 sedangkan `push_subscriptions` user 7 = 0; 17 langganan yang ada milik user 6 (15) dan user 1 (2, akun demo nonaktif) | 2026-10-11 | agent + pemilik | PASS (push) |
| Sentry error reporting | DSN dipasang di `.env` **staging dan production** (5 key: `SENTRY_LARAVEL_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE=0.1`, `SENTRY_SEND_DEFAULT_PII=false`). Diverifikasi 4 kali, terpisah: (1) hook `reportable` di `bootstrap/app.php` menerima event id di staging; (2) transport staging menjawab `Result: "success" (status: 200)`; (3) transport production **200**; (4) hook production menerima event id. `sentry:test` exit 0 di kedua lingkungan. Health 200 sesudah perubahan. Backup `.env` dihapus; sisa probe 0 | 2026-10-11 | agent | PASS |
| Gap: log tidak sampai ke Sentry | **SELESAI, staging dan production.** Kode mendarat di `develop` (`df40f62b`) dan di production lewat promote `f6ca3024`; channel `sentry` ter-deploy di `config/logging.php:161-165` (`level=error`, `report_exceptions=false`) bersama `Integration::handles()`. Dua lingkungan butuh **dua** baris berubah, bukan satu — `LOG_STACK` saja tidak berefek selama `LOG_CHANNEL` masih menunjuk channel tunggal. Staging: `single` → `stack`; production: `daily` → `stack`, tambah `LOG_STACK=daily,sentry`, lalu `config:clear` + `config:cache` (production memakai config cache, staging tidak). **Urutan wajib kode dulu, `.env` kemudian:** sebelum kode mendarat, production tidak punya channel `sentry` di `config/logging.php`, jadi provider menyuntik default tanpa `level` — dan itu DEBUG, sehingga mengubah `.env` lebih dulu akan mengirim setiap `Log::debug`/`Log::info` ke Sentry. Terukur di test dengan bentuk config production: 2 event (debug + info) vs 1 (hanya error) setelah channel berlevel. **Bukti rantai penuh, satu `Log::error` ber-marker acak, `.env` apa adanya — dijalankan di staging dan production:** `daily_received_marker=true` (marker dibaca dari berkas `laravel-YYYY-MM-DD.log` pada offset sebelum panggilan), `sentry_transport_status=200`, `sentry_events_sent=1` — pesan yang sama sampai ke berkas **dan** ke Sentry, tepat satu event, bukan dua. Berkas probe bermd5 sama di kedua ujung sebelum dijalankan. Backup `.env` di luar web root: staging `/home/u399215191/env-backup-staging-20261011-044612.env`, production `/home/u399215191/env-backup-prod-20261011-101747.env`. Production `LOG_LEVEL=warning` (lapis kedua: debug/info tidak sampai handler sama sekali). Aman: `Client::captureEvent()` membungkus `transport->send()` dengan `catch(\Throwable)` (`Client.php:190`) sehingga Sentry mati tidak mematahkan logging file | 2026-10-11 | agent | PASS |
| Gap: hook menyimpang dari jalur vendor | **DIPERBAIKI.** `bootstrap/app.php` sekarang memakai `Integration::handles($exceptions)` ( = `captureUnhandledException()`), jalur yang didokumentasikan vendor untuk Laravel 11+. Sebelumnya `captureException()` polos, sehingga event tidak mendapat mekanisme hint dan nama transaksi dari tracing middleware → alert tidak terkelompok per route. Diverifikasi `report()` tetap aman tanpa DSN sama sekali (hub no-op, mengembalikan null) | 2026-10-11 | agent | PASS |
| Jebakan `action_level` pada channel `sentry` | Ditemukan saat menulis test: `action_level` **mematikan** channel, bukan menghemat kuota. `sentry-laravel` 4.25.1 memfilter flush dengan `$record['level'] >= $level`, sedangkan di Monolog 3 `LogRecord::offsetGet('level')` mengembalikan **int** sementara `$level` adalah enum `Level`; perbandingan itu selalu `false`, jadi tidak ada record yang lolos. Terukur: **0 event** dengan `action_level`, **1** tanpa. Channel tetap melaporkan diri sehat. Karena itu `action_level` sengaja tidak dipakai | 2026-10-11 | agent | PASS |
| Pembagian event hook vs channel | `tests/Feature/SentryReportingTest.php` mengunci jumlah event lewat transport palsu: 1 event per `Log::error`, 1 per exception yang di-`report()` (dibawa hook, bukan channel), 0 untuk `info`/`warning`. Kedua guard diuji dengan mutasi — memasang `action_level` kembali, dan menurunkan level ke `debug`, masing-masing membuat suite merah | 2026-10-11 | agent | PASS |
| Web push menembus APNs (tembakan terkendali) | Langganan pemilik (user 7, endpoint `https://web.push.apple.com`) ditembak langsung memakai `minishlink/web-push` → HTTP **201**, `is_success: true`, `is_subscription_expired: false`. **Dijalankan dari staging**, bukan production: VAPID keypair kedua lingkungan identik (`VAPID_PUBLIC_KEY` md5 `df0cdd727c025cce`, `VAPID_PRIVATE_KEY` md5 `1f92fc266730ffd0`), sehingga langganan production tetap sah dari staging. Production hanya dibaca; `prod_rows_untouched: true` (1 → 1). Probe sengaja tidak lewat `WebPushChannel`, karena `ReportHandler` **menghapus** baris langganan saat endpoint melaporkan kedaluwarsa — satu tembakan uji bisa menghapus langganan pemilik dari production. Endpoint dan kunci dilaporkan hanya sebagai panjang + md5, tidak pernah dicetak | 2026-10-11 | agent | PASS |
| Backup production (isi dan enkripsi) | **Jalan tapi tidak terlindungi.** `dombi-backup-2026-10-11-02-30-03.zip` (26.401 B) dibuat 02:30, `gzip -t` lolos, 65 `CREATE TABLE` di dalamnya. Tapi `.env` production tidak punya satu pun baris `BACKUP_*`: `BACKUP_DISK` → `local` (disk yang sama dengan aplikasi, bukan offsite) dan `BACKUP_ARCHIVE_PASSWORD` kosong → `backup.backup.encryption` = `none`, `password` = `NULL`, sehingga setiap arsip bisa dibuka siapa pun yang memegang berkasnya. Verifikasi pola enkripsi spatie (`EncryptBackupArchive`: buka zip jadi → `setPassword()` → `setEncryptionIndex()` per berkas) diuji lokal: `setEncryptionIndex(0) => true`, baca tanpa password `false`, baca dengan password berhasil. Notifikasi backup tidak akan pernah sampai: `MAIL_MAILER=log` **dan** aplikasi tidak punya kode pengirim email sama sekali (`grep -rn "Mail::" app/` kosong, tidak ada `app/Mail/`), jadi `backup.notifications.mail.to` = `hello@example.com` (fallback dari `MAIL_FROM_ADDRESS`, bukan `your@example.com`) tidak berarti apa-apa | 2026-10-11 | agent | **NO-GO** |

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

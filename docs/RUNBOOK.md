# Dombi — Solo Developer Runbook

Runbook ini digunakan saat production bermasalah. Jangan mulai dari membaca kode;
mulai dari dampak pengguna, lindungi transaksi, lalu kumpulkan bukti.

## Service Map

- Laravel + Inertia/React
- MySQL
- Database-backed cache, session, dan queue
- Laravel scheduler
- DOKU payment/webhook
- Google OAuth
- Sentry dan application logs
- Local file storage dan backup

Health endpoints:

- `/up` untuk liveness dasar
- `/api/health` untuk pemeriksaan owner terhadap dependency

## Pemeriksaan Harian

- [ ] `/up` sehat
- [ ] tidak ada lonjakan error Sentry
- [ ] scheduler heartbeat baru
- [ ] tidak ada failed job atau queue backlog
- [ ] disk space aman
- [ ] backup terakhir sukses dan tersedia offsite
- [ ] tidak ada payment, webhook, stock, atau order mismatch

Log utama:

- `storage/logs/laravel.log`
- `storage/logs/operational.log`
- `storage/logs/queue-work.log`
- log scheduler per command di `storage/logs/`

## Severity

| Level | Contoh | Respons |
|---|---|---|
| SEV-1 | pembayaran ganda, data bocor, stock corruption luas, seluruh app down | hentikan traffic/mutation, mulai incident log, pulihkan segera |
| SEV-2 | checkout/payment/outlet flow gagal sebagian | batasi fitur terdampak, gunakan SOP manual, perbaiki hari yang sama |
| SEV-3 | UI, analytics, notification noncritical | catat backlog; jangan ganggu transaksi aktif |

## 15 Menit Pertama

1. Catat waktu, gejala, release commit, dan jumlah pengguna terdampak.
2. Hentikan deployment/perubahan baru.
3. Tentukan apakah mutation harus dimatikan untuk melindungi uang/data.
4. Periksa `/up`, `/api/health`, Sentry, log, DB, queue, dan scheduler.
5. Jangan retry webhook/job secara massal sebelum memastikan idempotensi.
6. Pilih rollback code atau roll-forward berdasarkan schema dan transaksi terbaru.
7. Catat setiap tindakan dan hasilnya.

## Playbook

### Aplikasi 500 atau asset gagal

1. Periksa health endpoint dan log aplikasi.
2. Verifikasi environment, permission storage, dependency, dan build artifact.
3. Bersihkan lalu bangun ulang cache konfigurasi/route/view bila sesuai.
4. Kembalikan artifact known-good jika error berasal dari release baru.

### Database gagal atau migration bermasalah

1. Hentikan mutation bila integritas data tidak terjamin.
2. Catat migration terakhir dan statusnya.
3. Jangan menjalankan rollback migration destruktif tanpa backup dan impact review.
4. Utamakan migration perbaikan ke depan.
5. Restore hanya ke target terisolasi lebih dulu dan rekonsiliasi transaksi baru.

### Queue backlog atau failed jobs

1. Periksa failed jobs, queue log, database connection, dan scheduler heartbeat.
2. Identifikasi job yang aman di-retry.
3. Pastikan job payment/refund/notification idempotent sebelum retry.
4. Retry terbatas dan pantau efek; jangan melakukan retry-all secara buta.

### Scheduler berhenti

1. Verifikasi cron `schedule:run` dan `schedule:list`.
2. Periksa heartbeat dan log command.
3. Jalankan command tertinggal secara manual hanya setelah memahami efek gandanya.
4. Periksa expiry order, reminder, backup, dan queue worker yang terlewat.

### Payment/webhook mismatch

1. Lindungi order dari progression manual yang salah.
2. Cocokkan invoice, amount, signature, payment transaction, dan webhook log.
3. Jangan memproses payload hanya karena status DOKU terlihat sukses.
4. Pastikan event belum pernah memberi efek sebelum replay.
5. Rekonsiliasi order, payment, stock, dan refund sebagai satu unit.

### Stock mismatch

1. Hentikan penjualan SKU/outlet terdampak.
2. Cocokkan stok, reservation, movements, order, cancel, dan expiry.
3. Jangan sekadar mengubah angka stok tanpa audit note.
4. Pulihkan dengan adjustment tercatat, lalu tambah regression test.

### External delivery incident

1. Pastikan order masih di `ready_for_pickup` saat booking eksternal gagal.
2. Jangan pernah menandai completed hanya berdasarkan keberhasilan booking.
3. Perbarui status delivery hanya setelah konfirmasi operator, lengkap dengan actor dan timestamp.
4. Rekonsiliasi ongkir customer secara terpisah dari biaya aktual kurir eksternal.
5. Saat delivery gagal, catat alasan sebelum retry/return/cancel.
6. Biaya aktual kurir eksternal tidak boleh mengubah jumlah yang sudah dibayar customer.

## Backup dan Restore

Backup dianggap valid hanya jika:

- terenkripsi (AES-256, `BACKUP_ARCHIVE_PASSWORD` diset);
- disimpan di luar server aplikasi (`BACKUP_DISK=s3` offsite);
- mencakup database dan upload yang diperlukan (`storage/app`);
- dapat dibuka (`verify_backup=true`);
- berhasil direstore ke environment terisolasi (`dombi_restore_test`);
- hasil restore diverifikasi dengan record sampling (orders, users, uploads).

**Config hardening (2026-07-27):**

- `config/backup.php` include hanya `storage/app` + `app/public` + DB, bukan seluruh `base_path`
- `encryption` = `default` jika password diset, `none` jika tidak — production WAJIB password
- `verify_backup` = `env(BACKUP_VERIFY, true)` — production WAJIB true
- `monitor_backups.disks` = `env(BACKUP_DISK)` — production WAJIB `s3`
- Scheduler sudah ada: `backup:clean` 02:00, `backup:run` 02:30, `backup:monitor` 03:00
- Dokumen drill: `docs/BACKUP_RESTORE.md`
- Script drill: `scripts/restore-drill.sh`

**Sebelum GO production:**

1. Set di production .env: `BACKUP_DISK=s3`, `AWS_*`, `BACKUP_ARCHIVE_PASSWORD`, `BACKUP_NOTIFICATION_EMAIL`
2. `php artisan backup:run` — pastikan file masuk S3 dan terenkripsi
3. `./scripts/restore-drill.sh s3://bucket/backup.zip` ke DB terisolasi
4. Catat evidence di `PRODUCTION_CHECKLIST.md` Release Evidence → Backup restore

Tetapkan RPO/RTO pilot secara eksplisit. Lakukan restore drill berkala (<30 hari) dan simpan
bukti waktu serta hasil. Listing archive bukan bukti restore.

## Deployment dan Recovery

- Gunakan artifact/tag immutable.
- Catat schema version sebelum dan sesudah deploy.
- Jalankan automated health check dan canary transaction.
- Untuk code regression tanpa schema change, rollback ke artifact known-good.
- Untuk schema/data issue, pilih roll-forward kecuali restore telah direhearsal.
- Setelah recovery, rekonsiliasi payment, order, refund, dan stock selama window
  incident.

## Incident Log Template

```text
Incident:
Severity:
Start/end:
Detected by:
User impact:
Release commit:
Timeline and actions:
Data/payment impact:
Recovery:
Reconciliation performed:
Root cause:
Prevention owner and deadline:
```

## Bus-Factor Minimum

Walaupun saat ini solo developer, satu orang lain harus dapat menemukan:

- akses hosting dan domain;
- lokasi secret dan recovery method;
- akses DOKU dan OAuth;
- backup offsite dan cara restore;
- release artifact terakhir yang sehat;
- kontak vendor dan prosedur menghentikan transaksi.

Nilai secret tidak boleh ditulis di repository.

# Backup & Restore — Production Readiness

## Status Sekarang

- `spatie/laravel-backup` sudah terpasang, scheduler aktif:
  - `backup:clean` 02:00
  - `backup:run` 02:30
  - `backup:monitor` 03:00
- Sebelum hardening: disk `local` saja, tidak terenkripsi, `verify_backup=false`, include `base_path()` terlalu besar
- Setelah hardening (commit ini):
  - include hanya `storage/app` + `storage/app/public` + database
  - `encryption` = `default` (AES-256) jika `BACKUP_ARCHIVE_PASSWORD` diset, `none` jika tidak
  - `verify_backup` = `env(BACKUP_VERIFY, true)`
  - monitor disk = `env(BACKUP_DISK)` — production wajib `s3`
  - notification email = `BACKUP_NOTIFICATION_EMAIL` atau `MAIL_FROM_ADDRESS`

Production checklist tetap NO-GO sampai offsite + restore drill ada bukti.

## Konfigurasi Production Wajib

`.env` production:

```env
BACKUP_DISK=s3
BACKUP_ARCHIVE_PASSWORD=<32+ char random, simpan di vault, bukan repo>
BACKUP_VERIFY=true
BACKUP_NOTIFICATION_EMAIL=ops@dombicenter.com

AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=ap-southeast-1
AWS_BUCKET=dombi-backups-prod
AWS_URL=
AWS_ENDPOINT=  # kosong untuk AWS, isi untuk R2/MinIO
```

`config/backup.php` akan otomatis:
- backup database + `storage/app` (uploads)
- enkripsi AES-256 dengan password
- simpan ke disk `s3` (offsite)
- verify zip bisa dibuka

## Cara Kerja

1. Setiap hari 02:30 server jalankan `backup:run`
2. Buat dump DB + zip uploads → enkripsi → upload ke S3
3. 03:00 `backup:monitor` cek umur backup <1 hari dan ukuran <5GB
4. Jika gagal, kirim email ke `BACKUP_NOTIFICATION_EMAIL`
5. 02:00 `backup:clean` hapus backup lama sesuai strategi (keep all 7 hari, daily 16 hari, weekly 8 minggu, monthly 4 bulan)

## Restore Drill — WAJIB SEBELUM PRODUCTION GO

Listing archive **bukan** bukti. Restore harus dicoba ke environment terisolasi.

### Prasyarat Drill

- Akses S3 bucket backup
- `BACKUP_ARCHIVE_PASSWORD`
- Server/droplet terisolasi atau local dengan MySQL kosong `dombi_restore_test`
- Tidak pernah restore langsung ke production DB tanpa test dulu

### Langkah Drill (Manual)

```bash
# 1. List backup terbaru
php artisan backup:list

# 2. Download backup terbaru dari S3 ke local
aws s3 ls s3://dombi-backups-prod/Dombi/
aws s3 cp s3://dombi-backups-prod/Dombi/dombi-backup-2026-07-27-02-30-00.zip ./restore-test.zip

# 3. Unzip dengan password
unzip -P $BACKUP_ARCHIVE_PASSWORD restore-test.zip -d restore-test/

# 4. Daftar isi harus ada db-dumps/ + storage/
ls restore-test/

# 5. Restore DB ke database terisolasi
mysql -u root -p -e "CREATE DATABASE dombi_restore_test;"
mysql -u root -p dombi_restore_test < restore-test/db-dumps/mysql-dombi.sql

# 6. Verifikasi record sampling
mysql -u root -p -e "
  USE dombi_restore_test;
  SELECT COUNT(*) as orders FROM orders;
  SELECT COUNT(*) as users FROM users;
  SELECT COUNT(*) as products FROM products;
  SELECT * FROM orders ORDER BY id DESC LIMIT 5;
"

# 7. Verifikasi uploads
ls -lh restore-test/storage/app/public/ | head -20

# 8. Catat hasil di tabel evidence
```

### Evidence Template

| Field | Isi |
|-------|-----|
| Tanggal drill | 2026-07-27 |
| Operator |  |
| Backup file | dombi-backup-2026-07-27-02-30-00.zip |
| Sumber | s3://dombi-backups-prod/Dombi/ |
| Ukuran |  |
| Terenkripsi | Ya (AES-256) |
| DB restore | Berhasil ke dombi_restore_test |
| Orders count |  |
| Users count |  |
| Uploads verified | Ya (contoh: 3 file) |
| Waktu restore |  |
| Catatan |  |

Simpan evidence di `docs/BACKUP-RESTORE-EVIDENCE.md` atau di `PRODUCTION_CHECKLIST.md` tabel Release Evidence.

### Automasi Drill (Script)

Gunakan script `scripts/restore-drill.sh` (dibuat terpisah) untuk automasi langkah di atas.

## RPO / RTO Pilot

- **RPO (Recovery Point Objective):** 24 jam — backup harian jam 02:30, maksimal kehilangan 24 jam transaksi
- **RTO (Recovery Time Objective):** 2 jam — download + restore + verifikasi + switch DNS/config
- Untuk launch, RPO 24 jam masih acceptable. Setelah transaksi naik, pertimbangkan backup 2x sehari atau binlog.

## Bus-Factor Checklist

- [ ] `BACKUP_ARCHIVE_PASSWORD` disimpan di vault (1Password/Bitwarden) — bukan di repo
- [ ] `AWS_*` credentials disimpan di vault
- [ ] `BACKUP_NOTIFICATION_EMAIL` bukan `your@example.com`
- [ ] Minimal 1 orang selain solo dev tau lokasi secret dan cara restore
- [ ] Evidence restore drill ada dan <30 hari

## Perintah Penting

```bash
# Manual backup sekarang
php artisan backup:run

# List backup
php artisan backup:list

# Monitor health
php artisan backup:monitor

# Clean old
php artisan backup:clean
```

## Yang Belum Harus Dilakukan Sebelum Go

- [x] Config hardening (done)
- [x] .env.example updated (done)
- [x] Scheduler aktif (done, sudah ada)
- [ ] Set `BACKUP_DISK=s3` + AWS creds di production .env
- [ ] Set `BACKUP_ARCHIVE_PASSWORD` di production
- [ ] Set `BACKUP_NOTIFICATION_EMAIL` di production
- [ ] Jalankan `backup:run` manual pertama di production, pastikan masuk S3
- [ ] Jalankan restore drill ke DB terisolasi, catat evidence
- [ ] Update `PRODUCTION_CHECKLIST.md` — backup restore evidence

Tanpa evidence restore, status tetap NO-GO.

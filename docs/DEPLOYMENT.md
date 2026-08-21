# Dombi — Deployment Runbook

## Source of Truth

GitHub Actions adalah mekanisme deploy canonical. Jangan mencampur workflow FTP,
upload manual, dan script server sebagai jalur deploy yang berbeda.

| Environment | Branch    | URL                               | Hostinger target                               | Trigger                                    |
| ----------- | --------- | --------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| Staging     | `develop` | `https://staging.dombicenter.com` | `domains/dombicenter.com/public_html/staging/` | Push ke `develop` atau `workflow_dispatch` |
| Production  | `main`    | `https://app.dombicenter.com`     | `/domains/dombicenter.com/public_html/app/`    | Push ke `main` atau `workflow_dispatch`    |

Production path wajib dikonfirmasi terhadap document root aktual pada Hostinger sebelum
production cutover diotorisasi. Perubahan ini tidak mengubah DNS, SSL, document root,
secret, atau `.env` server.

## Pre-Cutover Gate

Jangan push `main` sebelum setiap item memiliki evidence:

- [ ] DNS `app.dombicenter.com` resolve ke Hostinger yang benar.
- [ ] SSL valid untuk `app.dombicenter.com`.
- [ ] Document root subdomain `app` sama dengan `/domains/dombicenter.com/public_html/app/`.
- [ ] Production `.env` berisi `APP_ENV=production`, `APP_DEBUG=false`,
      `APP_URL=https://app.dombicenter.com`, secure cookie, dan secret production.
- [ ] DOKU Live client ID/API key, base URL, callback
      `https://app.dombicenter.com/payment/doku/notify`, signature, dan nominal diverifikasi.
- [ ] Google OAuth redirect URI `https://app.dombicenter.com/oauth/google/callback`
      terdaftar dan diuji.
- [ ] Staging smoke test selesai.
- [ ] Known-good release SHA/tag tercatat untuk rollback.
- [ ] Checkpoint `PRODUCTION CUTOVER AUTHORIZED` disetujui operator.

## Staging Deploy

Push ke `develop` menjalankan `.github/workflows/deploy-staging.yml`.
Workflow menjalankan quality gate, build frontend, deploy code melalui SSH ke staging,
menjalankan dependency install dan migration, membersihkan cache, memasang storage link,
mengunggah `public/build`, lalu memeriksa:

```text
https://staging.dombicenter.com/up
https://staging.dombicenter.com/api/health
```

Simpan commit SHA, workflow run, hasil health check, dan hasil smoke test sebagai staging
evidence sebelum melanjutkan ke pre-cutover gate.

## Production Deploy

Setelah pre-cutover gate lengkap, merge `develop` ke `main` sesuai proses repository lalu
push `main`. Workflow `.github/workflows/deploy.yml` akan:

1. Menunggu quality gate.
2. Membangun Composer production dependencies dan frontend assets.
3. Mengunggah tree production melalui FTP ke `/domains/dombicenter.com/public_html/app/`.
4. Menjalankan post-deploy SSH pada `domains/dombicenter.com/public_html/app`.
5. Menjalankan `composer install`, `php artisan migrate --force`, clear cache, dan storage link.
6. Menjalankan production health gate.

Tidak ada upload manual atau copy `.env` dari repository dalam jalur ini. Workflow mengecualikan
`.env*`; production `.env` harus sudah tersedia dan benar di server.

## Health Gate

Deployment hanya dianggap sehat bila kedua endpoint berikut mengembalikan HTTP 2xx:

```text
https://app.dombicenter.com/up
https://app.dombicenter.com/api/health
```

Setiap request memakai timeout 30 detik, maksimal tiga retry setelah request awal, dan jeda
retry lima detik. Non-2xx, timeout, atau kegagalan koneksi pada salah satu endpoint menggagalkan
job production.

Health gate bukan pengganti smoke test bisnis. Setelah job berhasil, uji homepage, login,
canary order bernilai kecil, DOKU callback/webhook, queue, dan log.

## Production APK

Default build tetap memakai staging untuk mencegah accidental production build. Build APK production
harus menetapkan server URL secara eksplisit:

```bash
CAP_SERVER_URL=https://app.dombicenter.com ./scripts/build-apk.sh customer
CAP_SERVER_URL=https://app.dombicenter.com ./scripts/build-apk.sh internal
```

Simpan command, commit SHA, dan artifact APK sebagai release evidence. APK yang sudah terpasang
mempertahankan URL yang dibake saat build; web domain cutover tidak mengubah APK lama.

## Rollback

Rollback code hanya ke artifact atau commit/tag known-good yang tercatat pada release evidence.
Jangan memakai `git checkout HEAD~1` pada server dan jangan menjalankan `migration:rollback`
otomatis.

Tentukan ref yang sudah diverifikasi, lalu jalankan production workflow pada ref tersebut:

```bash
read -r -p 'Known-good branch atau tag: ' KNOWN_GOOD_REF
gh workflow run deploy.yml --ref "$KNOWN_GOOD_REF"
gh run watch
```

Catat ref, commit SHA, waktu, operator, dan workflow run ID. Setelah redeploy, ulangi health gate,
homepage/login, canary flow, webhook, queue, dan pemeriksaan log.

Rollback code tidak membatalkan migration atau transaksi production. Migration ditangani dengan
roll-forward bila memungkinkan. Restore database hanya boleh diputuskan operator release/owner
setelah impact review terhadap transaksi yang masuk.

## Rollback Triggers

Hentikan traffic atau rollback bila terjadi:

- pembayaran ganda atau salah nominal;
- oversell atau stock corruption;
- authorization bypass;
- migration membuat aplikasi tidak dapat digunakan;
- error rate critical journey melewati ambang pilot;
- webhook atau queue berhenti tanpa recovery cepat.

## Troubleshooting

Periksa log dan cache hanya melalui server production yang benar:

```bash
tail -f storage/logs/laravel.log
/opt/alt/php83/usr/bin/php artisan cache:clear
/opt/alt/php83/usr/bin/php artisan config:clear
/opt/alt/php83/usr/bin/php artisan route:clear
/opt/alt/php83/usr/bin/php artisan view:clear
/opt/alt/php83/usr/bin/php artisan config:cache
/opt/alt/php83/usr/bin/php artisan route:cache
/opt/alt/php83/usr/bin/php artisan view:cache
```

Jangan menaruh credential production, demo password, atau isi `.env` ke repository.

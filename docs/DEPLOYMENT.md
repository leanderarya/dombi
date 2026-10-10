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

Setelah pre-cutover gate lengkap, promote `develop` ke `main` lewat pull request. Sejak
2026-10-10 branch protection menolak push langsung ke `main` dan `develop` (`force_push=false`,
`enforce_admins=true`), jadi satu-satunya jalur masuk adalah PR.

```bash
gh pr create --base main --head develop --title 'release: <ringkas>' --body '<isi>'
gh pr merge --merge   # setelah check `quality` hijau
```

Required check-nya bernama `quality` (job `quality`, workflow `Quality Gate`). Nama itu hanya
muncul pada event `pull_request`; pada push ia dilaporkan sebagai `quality / quality`, sehingga
push langsung dulu lolos tanpa gate — itu sebabnya proteksi ini pindah ke jalur PR.

Workflow `.github/workflows/deploy.yml` akan:

1. Memvalidasi variabel pembayaran production (`DOKU_IS_SANDBOX=false`,
   `PAYMENTS_LEGACY_WRITES_ENABLED=false`) dan menolak deploy bila salah.
2. Menunggu quality gate.
3. Membangun Composer production dependencies dan frontend assets.
4. Menyinkronkan repo production lewat SSH (`git fetch` + `git reset --hard` ke SHA rilis),
   lalu mengunggah `public/build` lewat SCP.
5. **Menurunkan aplikasi ke maintenance mode** (`php artisan down --retry=15`) untuk jendela
   mutasi, dengan `trap` yang menjamin `artisan up` dijalankan meski langkah berikutnya gagal.
6. Menjalankan `composer install`, `php artisan migrate --force`, `config:cache`, dan
   assertion runtime bahwa config production benar.
7. Membersihkan cache dan menilai hasilnya **dari isi disk**, bukan dari exit code —
   lihat catatan di bawah.
8. Menaikkan aplikasi kembali (`php artisan up`) dan menjalankan production health gate.

Tidak ada upload manual atau copy `.env` dari repository dalam jalur ini. Workflow mengecualikan
`.env*`; production `.env` harus sudah tersedia dan benar di server.

### Cache clear di host shared

`php artisan cache:clear` pernah gagal di host ini (run `38030307352`) dan menggagalkan seluruh
job: `FileStore::flush()` mengembalikan `false`, `ClearCommand` mencetak pesan "appropriate
permissions" yang **menyesatkan** (direktori sudah `777`, dan tidak ada entri milik user lain),
lalu exit 1 — sehingga health gate di belakangnya tidak pernah jalan.

Langkah cache sekarang menilai kebersihan store **dari jumlah entri di disk**
(`find storage/framework/cache/data -type f`), dan bila masih ada sisa, menghapus direktori
level-1 secara langsung. Prinsipnya: store yang melaporkan sukses tapi menyisakan entri usang
lebih buruk daripada store yang jujur gagal. `CACHE_STORE=file` di production, jadi path itu
memang sasaran yang benar.

Maintenance mode dijaga dua lapis. `trap ... EXIT` di dalam script menangani kegagalan biasa,
tapi tidak bisa jalan bila sesi SSH diputus keras — dan host ini memang memutus sesi. Karena itu
ada step terpisah `Ensure production is not stuck in maintenance mode` dengan `if: always()`
yang memeriksa `storage/framework/down` dan menjalankan `artisan up` bila perlu. Menjalankan
`up` saat aplikasi sudah hidup tidak berefek.

Konsekuensi sampingan: heartbeat scheduler disimpan di cache
(`SchedulerHeartbeat` → key `scheduler:last_heartbeat`), jadi setelah setiap deploy
`/api/health` akan melaporkan `"scheduler": false` sampai cron `schedule:run` berikutnya
menuliskannya kembali (≤1 menit). Field ini **informational** — status dan HTTP code hanya
ditentukan oleh `database`, `cache`, dan `storage`.

### Batas jendela maintenance (diketahui, belum ditutup)

Maintenance mode aktif di langkah 5, sementara kode sudah diganti di langkah 4. Jadi langkah
4 (sinkronisasi git) dan 5 (unggah SCP `public/build`) berjalan **sambil aplikasi melayani
request**. Ini perilaku lama, bukan regresi dari hardening 2026-10-10 — urutan yang sama sudah
ada sebelumnya, dan hardening hanya mempersempit jendela.

Dua hal yang membatasi dampaknya sekarang:

- `public/build` ada di `.gitignore`, jadi `git reset --hard` tidak menyentuh asset; asset
  baru datang lewat SCP dan `index.html` menunjuk nama file ber-hash, sehingga file lama tetap
  bisa dilayani sampai SCP selesai.
- Tidak ada perubahan dependensi di antara rilis yang dipromosikan sejauh ini.

Risiko yang **belum** tertutup: `git reset --hard` mengganti `app/`, `composer.json`, dan
`composer.lock`, sementara `composer install` baru dijalankan di langkah 7. Bila sebuah rilis
menambah atau mengubah dependensi, kode baru bisa dieksekusi melawan `vendor/` lama selama
jendela itu. Bila ini menjadi masalah nyata, perbaikan yang benar adalah memindahkan
`artisan down` ke sebelum langkah 4 dan menerima downtime selama unduhan SCP — itu keputusan
trade-off, bukan sekadar perbaikan, sehingga belum dilakukan.

### Tag rilis

Buat tag annotated pada commit `main` yang baru dipromosikan, lalu push:

```bash
git tag -a release-YYYY-MM-DD <sha> -F <pesan>
git push origin release-YYYY-MM-DD
```

Tag adalah target rollback. Jangan menandai sebelum health gate hijau.


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

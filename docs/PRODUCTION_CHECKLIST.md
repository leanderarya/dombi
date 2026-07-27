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

Per 2026-07-27, status adalah `NO-GO`:

1. test/lint CI dinonaktifkan melalui trigger branch `never`;
2. production deploy tidak bergantung pada quality gate;
3. production workflow tidak menjalankan migration atau post-deploy health check;
4. backup default masih lokal dan belum ada restore proof;
5. test MySQL belum reproducible di CI.

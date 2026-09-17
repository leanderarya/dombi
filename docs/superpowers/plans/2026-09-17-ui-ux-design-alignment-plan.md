# UI/UX Design Alignment — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-09-17-ui-ux-design-alignment-design.md`
**PRD delta:** `docs/PRD.md` §9 — NFR-UI-1, NFR-UI-2, NFR-UI-3
**Gate 1:** ✅ Lulus 2026-09-17
**Baseline:** `develop` @ `59f07a74` (implementasi mulai dari commit setelah ini)
**Durasi:** draf 1 minggu → staging 4 minggu (1 slice per role)

## Keputusan yang mengikat

| # | Keputusan |
|---|---|
| D1/D4 | Satu keluarga tema brand + aksen berbeda per role, lewat token CSS global |
| D2/D5 | Konsolidasi 5 komponen inti + varian badge/chip/modal/input duplikat + hapus komponen mati |
| D3 | Mobile-first, touch target ≥ 44×44 px |
| D5 | **Visual refresh + konsistensi** — bahasa desain baru diizinkan |
| D6 | Owner exempt 44 px pada pointer presisi; tetap ikut token & komponen |
| D7 | Bertahap per role: Customer → Outlet → Courier → Owner |

## Prinsip eksekusi

- **Slice vertikal, bukan layer horizontal.** Tiap slice = satu perubahan end-to-end yang bisa dilihat di staging.
- **Commit per slice**, bukan per langkah. Stage file spesifik — **jangan** `git add -A`/`git add .`.
- **Verifikasi dua tingkat.** Per slice: lint/typecheck/test hanya modul tersentuh. Suite penuh sekali di akhir.
- **Tidak menyentuh** kontrak API, skema data, logika pembayaran/settlement.
- **Owner terakhir**, karena panel terbesar (57 halaman) dan paling padat.

---

## Fase 0 — Draf Desain (minggu ke-1, tanpa menyentuh UI produksi)

**Output:** satu dokumen keputusan visual yang disetujui sebelum eksekusi.

### Slice 0.1 — Palet & token final

- Tetapkan palet brand tunggal: primary, secondary, neutral ramp, semantic (success/warning/danger/info), surface, border, text.
- Tetapkan aksen per role **berasal dari palet brand** (bukan warna acak):
  - Customer — aksen konsumen (paling ramah/terang)
  - Outlet — aksen operasional
  - Courier — aksen biru (pertahankan identitas yang sudah dipakai)
  - Owner — aksen hijau tua (pertahankan identitas yang sudah dipakai)
- Tetapkan skala radius, spacing, elevasi, dan tipografi.
- **Bukti selesai:** tabel token final + pratinjau visual (boleh screenshot/spec, tidak wajib kode).

### Slice 0.2 — Spek komponen

- Spesifikasi Button (varian × ukuran), Modal/Dialog, Card, Badge, Input.
- Definisikan pemetaan 10 badge/chip tumpang-tindih → satu komponen bervarian.
- Definisikan satu primitive dialog/sheet (pilih basis; putuskan nasib `@base-ui/react` vs Radix).
- **Bukti selesai:** tabel pemetaan "komponen lama → komponen baru".

### Slice 0.3 — Peta migrasi warna + audit ulang

- Petakan 2.422 pemakaian palette mentah + 146 hex inline ke token baru per role.
- Identifikasi pemakaian yang **tidak boleh berubah** (status pembayaran, badge terminal).
- **Gate review draf:** klien menyetujui arah visual → eksekusi dimulai.

---

## Fase 1 — Fondasi Token (permulaan minggu ke-2, memblokir semua slice role)

### Slice 1.1 — Token & tema 4 role

- Perbarui `resources/css/app.css` `@theme` sesuai Slice 0.1.
- Perbaiki mekanisme `html[data-role]` agar berlaku untuk **4 role** (sekarang hanya owner & courier yang di-set).
- Hapus tambalan CSS `.bg-emerald-50`/`.text-emerald-700` khusus courier.
- Tambah jaminan touch target 44 px untuk Customer/Outlet/Courier; exempt Owner sesuai D6.
- **Verifikasi:** `npm run types:check`, `npm run lint:check`, `npm run format:check`, `npm run build`.
- **Bukti:** token aktif, tema 4 role ter-resolve.

---

## Fase 2 — Slice per Role (minggu ke-2 s/d ke-5)

Pola tiap role identik. Wajib diselesaikan berurutan; satu role tidak mulai sebelum role sebelumnya lolos review.

### Slice R.1 — Konsolidasi komponen dasar
- Ganti `<button>` mentah → `Button` pada modul role.
- Ganti badge/chip ad-hoc → komponen Badge bervarian.
- Ganti modal/dialog → primitive tunggal.
- Hapus komponen duplikat milik role setelah migrasi.

### Slice R.2 — Migrasi warna ke token
- Ganti palette mentah & hex inline → token.
- Ganti override per-halaman (mis. `.owner-filter-card`) → token/utility bersama.

### Slice R.3 — Kerapian layout
- Seragamkan spacing, alignment, dan visual hierarchy antar halaman role.
- Terapkan touch target 44 px (Customer/Outlet/Courier).

### Slice R.4 — Hapus kode mati
- Hapus komponen role yang sudah tidak dipakai.
- **Verifikasi per role:** `npm run lint:check`, `npm run types:check`, `npm run format:check`, `npm run test`, `npm run build`.

Urutan role:

| # | Role | Minggu | Catatan risiko |
|---|---|---|---|
| 1 | Customer | 2 | Alur checkout & pembayaran — **jangan** ubah kontrak/status |
| 2 | Outlet | 3 | Banyak dialog exch/ret/restock |
| 3 | Courier | 4 | Kecil (4 halaman) — slice cepat, sekaligus validasi pola |
| 4 | Owner | 5 | Terbesar (57 halaman), sidebar + tabel, exempt 44 px |

---

## Fase 3 — Penutupan

### Slice 3.1 — Hapus komponen mati global
- Hapus `ui/badge.tsx` (0 importer, `@base-ui/react`), `ui/expandable-section.tsx`, `ui/separator.tsx`, `ui/sheet.tsx`, `ui/tabs.tsx` — hanya setelah konfirmasi 0 importer.

### Slice 3.2 — Verifikasi integrasi penuh
- Suite PHP penuh (jalankan terpisah dari Vitest).
- Vitest penuh.
- `npm run build`.
- Smoke di staging: 4 role, alur checkout + pembayaran.

### Slice 3.3 — Dokumentasi
- Perbarui `docs/PROGRESS.md`.
- Catat hasil smoke di dokumen smoke yang berlaku.

---

## Gate Verifikasi (jujur — boleh merah)

| Gate | Perintah | Target |
|---|---|---|
| Types | `npm run types:check` | 0 error |
| Lint | `npm run lint:check` | 0 error |
| Format | `npm run format:check` | lolos |
| Unit/JS | `npm run test` | semua lolos |
| Build | `npm run build` | sukses |
| PHP | `php artisan test` | semua lolos (dijalankan terpisah) |

Catatan: jalankan PHP dan Vitest **terpisah** — suite penuh bersamaan time-out.

## Di luar lingkup

- Fitur baru, perubahan IA, perubahan alur order.
- Perubahan kontrak API, skema data, logika pembayaran/settlement.
- Promosi `develop` → `main` (proses terpisah, butuh konfirmasi eksplisit).

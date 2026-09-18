# Design Tokens & Components Library — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-09-17-ui-design-tokens-library-design.md`
**Spec induk:** `docs/superpowers/specs/2026-09-17-ui-ux-design-alignment-design.md`
**Plan induk:** `docs/superpowers/plans/2026-09-17-ui-ux-design-alignment-plan.md`
**PRD delta:** `docs/PRD.md` §9 — NFR-UI-1, NFR-UI-2, NFR-UI-3, NFR-UI-4
**Gate 1:** ✅ Lulus 2026-09-17 · **Change Request:** CR-1 (per-role), CR-2 (token & library)
**Baseline:** `develop` @ `1d77a8d0`
**Kanvas SSOT:** `pencil-new.pen` — 18 frame Order disetujui klien (D9)
**Status:** 🟡 Fase A: A.1, A.2, A.4 selesai, A.3 ditunda. Fase B: selesai (6/6). Fase C: selesai lewat putaran koreksi C.5–C.7 (gate visual terbuka). Berikutnya Fase D — menunggu review staging pengguna.

## Keputusan yang mengikat

| # | Keputusan |
|---|---|
| D1/D4 | Satu keluarga tema brand + aksen per role lewat token CSS global |
| D2/D5 | Konsolidasi 5 komponen inti + varian badge/chip/modal/input duplikat + hapus komponen mati |
| D3 | Mobile-first, touch target ≥ 44×44 px |
| D5/CR-1 | Customer = *consistency only*; Outlet/Courier/Owner = refresh |
| D6 | Owner exempt 44 px pada pointer presisi |
| D7 | Bertahap per role: Customer → Outlet → Courier → Owner |
| D8 | Customer — kriteria terima *zero visual regression* |
| **D9** | **Kanvas pen.dev = SSOT desain yang mengikat** |
| **D10** | **Components Library memperluas `resources/js/components/ui/`** |
| **D11** | **Token dideklarasikan sekali di `@theme`; tidak ada nilai visual literal di `.tsx`** |
| **D12** | **Satu primitive dialog/sheet (Radix); `@base-ui/react` dibuang** |

## Prinsip eksekusi

- **Slice vertikal.** Tiap slice = satu perubahan end-to-end yang bisa dilihat di staging.
- **Commit per slice.** Stage file spesifik — **jangan** `git add -A` / `git add .`.
- **Verifikasi dua tingkat.** Per slice: lint/typecheck/test hanya modul tersentuh. Suite penuh sekali di akhir.
- **Tidak menyentuh** kontrak API, skema data, logika pembayaran/settlement.
- **Kanvas mengikat.** Bila kode dan kanvas berbeda, yang salah adalah kode.
- **Rujuk spec sebelum eksekusi.** Bila kanvas berubah setelah plan ini, plan ini yang basi — perbarui dulu.

---

## Fase A — Fondasi Token

Memblokir semua fase lain. Semua slice di fase ini menyentuh file yang sama (`app.css`) sehingga **wajib berurutan**, bukan paralel.

### Slice A.1 — Deklarasikan token yang hilang — ✅ `0bd39384`

**Cluster file:** `resources/css/app.css`

- Tambah `--color-card` `#FFFFFF`, `--color-card-foreground` `#1E1E1E`.
- Tambah `--font-heading` `'Plus Jakarta Sans'`.
- Tambah `--color-overlay` `rgba(0,0,0,0.40)`.
- Tambah pasangan tint semantik: `--color-success-bg/text`, `--color-warning-bg/text`, `--color-danger-bg/text`, `--color-info-bg/text` sesuai spec §3.2.
- **Tidak menghapus** token lama. Slice ini hanya menambah.

**Verifikasi:** `npm run build`. Lalu inspeksi computed style `bg-card` dan `font-heading` di satu halaman — harus ter-resolve, bukan jatuh ke nilai bawaan.

**Bukti:** screenshot sebelum/sesudah satu Card (perubahan seharusnya tidak ada atau minimal).

**Commit:** `feat(tokens): declare card, heading, overlay and semantic tint tokens`

### Slice A.2 — Token aksen Outlet — ✅ `c6892bb2`

**Cluster file:** `resources/css/app.css`

- Tambah blok `html[data-role='outlet']` dengan primary `#047857` dan accent `#FF8A3D` (Q-CR2-1).
- Pastikan blok ini **tidak** mengubah Customer (Customer tidak memakai `data-role`).

**Verifikasi:** `npm run build`. Muat halaman Outlet — primary dan accent harus ikut berubah; halaman Customer tidak.

**Commit:** `feat(tokens): add outlet role accent scope`

### Slice A.4 — Pindahkan `data-role` ke root view — ✅ `ee882261`

**Cluster file:** `resources/views/customer-app.blade.php`, `resources/views/internal-app.blade.php`, `resources/views/app.blade.php`, `resources/js/hooks/use-role-theme.ts` (baru), `resources/js/layouts/{owner,courier,outlet,customer-mobile}-layout.tsx`

- Set `data-role` pada `<html>` dari blade root view, **dan** sematkan lewat hook `useRoleTheme` di keempat layout panel.
- Hapus `useLayoutEffect` penulis `dataset.role` di `owner-layout.tsx` dan `courier-layout.tsx`.
- Tujuan: `data-role` tersedia sebelum hydrate dan tidak bergantung layout yang ter-mount.

**Deviasi dari draf awal (terverifikasi):** blade saja **tidak cukup**. Inertia berpindah halaman tanpa memuat ulang dokumen, jadi login, logout, dan redirect antar-panel menukar layout tanpa mengganti elemen `<html>` — atribut hasil render server menjadi basi. Karena itu hook tetap dipertahankan sebagai mekanisme otoritatif, ditambah blade untuk menghindari kedip di muat pertama. Slice ini sekaligus menambal bug: sebelumnya hanya Owner dan Courier yang menulis `data-role`, sehingga Outlet tidak pernah mendapat cakupan tokennya.

**Verifikasi:** `npm run build`, `npm run types:check`, `npm run lint:check` — hijau. Keempat blok role ter-emit dengan nilai yang diharapkan.

**Commit:** `refactor(theme): set data-role from root view and shared hook`


### Slice A.3 — Buang tambalan `!important` input — ⏸️ DITUNDA

**Alasan penundaan (audit 2026-09-17):** aturan `input[type='text']…{font-size:16px !important}` adalah **jaring anti-zoom iOS** untuk **89 `<input>` mentah** di 43 file (Outlet 35, Owner 33, Customer 12, Courier 4). Hanya **4** input yang mendeklarasikan utility sizing sendiri; sisanya mengandalkan aturan global. Karena aturan itu **unlayered** (di luar `@layer`), ia juga saat ini mengalahkan semua utility `text-*` pada input mentah — jadi `text-xs`/`text-sm` di sana hari ini tidak berefek.

Memindahkannya ke kelas komponen akan menghapus jaring itu dan membuat `text-xs` (12 px) mulai berlaku → **zoom otomatis iOS** di Customer, Outlet, Courier, dan Owner.

**Keputusan:** tunda, gabung ke Slice B.4 saat input mentah dimigrasikan ke `<Input>`. Baru setelah itu kelas komponen aman menjadi satu-satunya sumber normalisasi input.

**Cluster file (nanti):** `resources/css/app.css`, `resources/js/components/ui/input.tsx`, ditambah seluruh file ber-`<input>` mentah.

**Verifikasi (nanti):** `npm run types:check`, `npm run lint:check`, `npm run build`.
**Bukti (nanti):** input di iOS/emulator tidak memicu zoom (font-size tetap ≥16 px efektif).

**Commit (nanti):** `refactor(css): scope input normalisation to component class`

---

## Fase B — Components Library

Urutan dipilih dari yang paling banyak dipakai ke paling sedikit, sehingga manfaatnya terasa paling awal.

### Slice B.1 — Button — ✅ `7b1e81ba`

**Cluster file:** `resources/js/components/ui/button.tsx`

- Tambah size `md` (40), `lg` (44), `cta` (48); naikkan `sm` (36), `default` → 44.
- Radius → `rounded-control`.
- Varian `danger` **buang** `border-red-200 text-red-700 hover:bg-red-50` → `bg-danger text-white`.
- Varian `outline`/`secondary`/`ghost` → token, bukan `accent`/`secondary` bawaan shadcn.
- Pertahankan `asChild`, `loading`, `icon` (sudah ada).

**Verifikasi:** `npm run types:check`, `npm run lint:check`, `npm run test`, `npm run build`.
**Bukti:** galeri komponen (boleh halaman sementara) — bandingkan dengan `Button/*` di kanvas (frame komponen y=-560).

**Risiko:** Button sudah diimpor **70 file**. Menambah size tidak merusak; mengubah `default` dari 36 → 44 **mengubah tampilan**. Mitigasi: jangan ubah `default` di slice ini — tambah `lg` sebagai default mobile, lalu migrasikan per role di Fase C/D. **Keputusan: `default` tidak diubah di slice ini.**

**Commit:** `feat(ui): add mobile-first button sizes and token danger variant`

### Slice B.2 — Notice — ✅ `9525428d`

**Cluster file:** `resources/js/components/ui/notice.tsx` (baru), `resources/js/components/ui/index.ts`

- Buat komponen baru sesuai spec §4.3.
- Tone `info | warning | danger | success | neutral`, warna dari token tint.
- Ekspor dari `ui/index.ts`.
- **Belum** memigrasikan pemakai — itu Slice C.2.

**Verifikasi:** `npm run types:check`, `npm run lint:check`, `npm run build`.
**Bukti:** bandingkan dengan `Order Detail 4` di kanvas.

**Commit:** `feat(ui): add Notice component with semantic tones`

### Slice B.3 — StatusBadge — ✅ `a1a08869`

**Cluster file:** `resources/js/components/ui/status-badge.tsx`, `resources/js/lib/order-status-config.ts`

- Ganti `variantStyles` dari kelas palette ke token tint (`bg-success-bg text-success-text`, dst).
- Pertahankan **kedua mode** (status resolve + variant manual) agar 44 importer tidak putus.
- **Jangan** hapus komponen badge lain di slice ini — hanya ubah basis.
- Hapus `BADGE_BASE` dari `order-status-config.ts` **hanya bila** grep menunjukkan 0 konsumen tersisa; jika masih ada, tinggalkan dan catat sebagai utang slice berikutnya.

**Verifikasi:** `npm run types:check`, `npm run lint:check`, `npm run test`, `npm run build`.
**Bukti:** seluruh badge status di layar Orders (kanvas `Orders 1` dan `Order Detail 1..14`) tampil dengan warna yang sama.

**Peringatan CR-1:** ini slice paling berisiko untuk Customer. Bila token tint dievaluasi ke nilai yang sama persis (`#ECFDF5`/`#047857` dst), tampilan **tidak berubah**. Verifikasi dengan screenshot sebelum/sesudah.

**Commit:** `refactor(ui): move status badge variants onto semantic tokens`

### Slice B.4 — Card & Input — ✅ `d8f4db9f`

**Cluster file:** `resources/js/components/ui/card.tsx`, `resources/js/components/ui/input.tsx`

- Card: `rounded-xl` → `rounded-card`; `ring-foreground/10` → token border. Token `--color-card` sudah ada dari A.1.
- Input: `h-9` → `min-h-11`; `rounded-md` → `rounded-control`; `shadow-sm` dihapus; error pakai `--color-danger`.

**Verifikasi:** `npm run types:check`, `npm run lint:check`, `npm run test`, `npm run build`.
**Bukti:** Card dan Input bandingkan dengan kanvas (`Card/Base`, `Input/Text`).

**Risiko:** Card dipakai lintas role. Perubahan radius 12 → 16 **terlihat**. Untuk Customer ini termasuk perubahan yang **diizinkan** oleh CR-2.7 poin 3. Untuk role lain termasuk refresh yang memang direncanakan.

**Commit:** `refactor(ui): align Card and Input to radius and touch tokens`

### Slice B.5 — Dialog & Sheet — ✅ `534ba049`

**Cluster file:** `resources/js/components/ui/bottom-sheet.tsx`, `resources/js/components/ui/dialog.tsx`, `resources/js/components/ui/side-sheet.tsx`, `resources/js/components/owner/owner-modal-shell.tsx`

- Backdrop → `--color-overlay`.
- Jadikan `bottom-sheet.tsx` satu-satunya sheet.
- `owner-modal-shell` → delegasikan ke `ui/dialog.tsx`.
- `side-sheet` (1 importer) → lebur bila memungkinkan; bila tidak, catat.

**Verifikasi:** `npm run types:check`, `npm run lint:check`, `npm run test`, `npm run build`.
**Bukti:** bandingkan dengan `Order Detail 13` dan `14` di kanvas (handle pill 40×4, radius atas 20, padding 20/16/24).

**Commit:** `refactor(ui): unify dialog and sheet on single Radix primitive`

### Slice B.6 — Hapus komponen mati + `@base-ui/react` — ✅ `69e5b5a8`

**Cluster file:** `resources/js/components/ui/{badge,expandable-section,separator,sheet,tabs}.tsx`, `resources/js/components/ui/index.ts`, `package.json`

- Konfirmasi ulang 0 importer untuk kelima file.
- Hapus kelima file dan ekspornya dari `ui/index.ts` (baris 7 `export * from './expandable-section'`).
- `npm uninstall @base-ui/react`.
- Konfirmasi `/plan` tidak lagi memakai `@base-ui`.

**Verifikasi:** `npm run types:check`, `npm run lint:check`, `npm run build`; grep `@base-ui` = 0.
**Bukti:** `npm ls @base-ui/react` → kosong.

**Commit:** `chore(ui): remove dead components and unused base-ui dependency`

---

## Fase C — Slice Role 1: Customer (Consistency Only)

Pola mengikuti plan induk `Slice R.1–R.4`, tetapi **dikunci ke kanvas** dan **dibatasi ke layar Order** pada iterasi pertama.

**Status Fase C (2026-09-18): SELESAI lewat dua putaran.**

Putaran pertama: C.1 `2023fc71`, C.2 `723dcde8`, C.3 `204d5cc2`, C.4
`c87f1307`.

**Gate visual C.1/C.4 dinyatakan GAGAL (2026-09-18).** Implementasi tidak
menyamai frame Orders yang dipilih klien. Audit delta penuh menghasilkan
delapan temuan yang dijadwalkan sebagai C.5–C.7 (lihat bawah). Ini contoh
gate yang benar-benar bisa merah — bukan formalitas.

Putaran kedua (perbaikan): C.5 `824a8925`, C.6 `56159a4f`, C.7 `efe97a84`.

### Slice C.1 — Layar Orders: shell, badge, chips — ✅ `2023fc71`

**Cluster file:** `resources/js/components/customer/order-card-shell.tsx`, `resources/js/components/customer/active-order-card.tsx`, `resources/js/components/customer/order-history-card.tsx`, `resources/js/components/customer/order-filter-chips.tsx`

- `order-card-shell` → delegasikan ke `Card`.
- `active-order-card`: buang badge/button inline → `StatusBadge` + `Button`.
- `order-history-card`: samakan struktur dengan `active-order-card` lewat shell yang sama.
- `order-filter-chips` → `FilterChips`, active state diseragamkan.

**Bukti:** bandingkan dengan kanvas `Orders 1 — Aktif` dan `Orders 2 — Riwayat`.
**Wajib:** screenshot sebelum/sesudah per layar.

**Commit:** `refactor(customer): align order list cards to shared components`

**Catatan pelaksanaan (2026-09-17):**

- Token radius **tidak diubah**. Kanvas punya variable `radius-card = 16`, sama
  dengan `@theme`. Angka `18` pada `Order Card` adalah override mentah di dalam
  frame, dan satu frame lain (`Order Detail`) memakai `16`. Variable dan
  `Card/Base` menang; `18` dianggap drift.
- Kanvas `Badge/*` + variables (`success-bg #ECFDF5`, dst.) **identik** dengan
  token semantic kita. Pill literal `#FEF3C7`/`#DCFCE7` di frame Orders adalah
  drift dari frame lama, bukan nilai yang diotorisasi.
- `FilterChips` mendapat varian `neutral` + size `caption` (aditif). Varian
  `solid` tidak diubah karena dipakai 19 konsumer Outlet/Courier/Owner.
- `order-filter-chips.tsx` dihapus (satu konsumer, sudah dialihkan).
- `order-status-config` menyimpan tone, bukan kelas; `StatusBadge` memetakannya
  ke token. `StatusBadge` menerima `className` opsional.
- **Deviasi sengaja dari kanvas:**
  1. Kode order tetap dipertahankan di kartu aktif. Kanvas menggantinya dengan
     label fulfillment; label fulfillment sudah dinaikkan ke judul sesuai
     kanvas, tetapi kode tetap karena pembeli dengan pembayaran belum selesai
     butuh nomor rujukan.
  2. Tombol memakai `size="sm"` (36 px) mengikuti gambar kanvas. NFR-UI-2
     menetapkan 44 px untuk kontrol utama mobile; kanvas adalah SSOT desain dan
     menggambar tombol ini kompak, jadi ukuran tidak dinaikkan sendiri. Aksi
     destruktif full-width di sheet pembatalan memakai default 44 px.
- **Gate visual BELUM dijalankan.** Desktop browser tidak terhubung ke sesi ini
  (`browser.disconnected`), jadi screenshot sebelum/sesudah tidak bisa diambil.
  Gate ini terbuka, bukan lolos.

### Slice C.2 — Layar Order Detail: banner, notice, tombol

**Cluster file:** `resources/js/components/customer/order/order-header.tsx`, `resources/js/components/customer/order/status-guidance-card.tsx`, `resources/js/pages/customer/orders/show.tsx`

- **Ganti `#006241` dan `#EAF5ED` di `order-header.tsx` → token brand.** Ini perbaikan paling terlihat (13 + 4 kemunculan).
- Banner status header → `Notice` (tone sesuai).
- Tombol `Bayar Ulang` → `Button variant="danger"`.
- `NonCancellableNotice` → `Notice tone="neutral"`.

**Bukti:** bandingkan dengan kanvas `Order Detail 1 — Diproses` dan `4 — Pembayaran Bermasalah`.

**Peringatan:** `show.tsx` menyentuh alur pembayaran. **Jangan** ubah props, handler, route, atau polling. Perubahan hanya presentasional.

**Commit:** `refactor(customer): unify order detail banner and actions`

### Slice C.3 — Layar Order Detail: refund, terminal, sheet

**Cluster file:** `resources/js/components/customer/order/terminal-status-cards.tsx`, `resources/js/components/customer/order/refund-status-card.tsx`, `resources/js/components/customer/order-timeline.tsx`, `resources/js/components/customer/order-qr-card.tsx`, `resources/js/components/customer/order-qr-card.tsx`, `resources/js/components/customer/order/order-info-card.tsx`

- Terminal cards → `Notice` per tone + `Button variant="primary"`.
- Refund card: `REFUND_BADGE_STYLES` → `StatusBadge`; tombol → `Button`.
- Timeline: radius → `--radius-card`.
- QR card: `#1e40af` → token `info`.
- `order-info-card`: hapus hex sisa, seragamkan section header.

**Bukti:** bandingkan dengan kanvas `Order Detail 5..14`.

**Commit:** `refactor(customer): align refund, terminal and detail cards`

**Catatan pelaksanaan (2026-09-17):**

- `guest-refund-status-card.tsx` **ditambahkan** ke cluster (tidak tertulis di
  plan awal). Ia memakai palet mentah yang sama persis dengan
  `refund-status-card` (29 kemunculan) dan satu-satunya konsumennya ada di
  scope Customer; membiarkannya berarti dua kartu refund dengan warna berbeda.
- Terminal cards sekarang memakai `Notice variant="block"` + `Button asChild`
  (`variant="primary" size="lg"`). `Notice` level-2 sudah `text-caption`, jadi
  paragraf di dalamnya memakai ukuran relatif (`text-sm`/`text-xs`) dan bukan
  token ukuran lagi. Slot `action` menerima fragment agar kartu `failed_delivery`
  bisa menampung dua tombol.
- `qrcode.react` dan canvas 2D tidak bisa me-resolve `var(--token)`. QR di layar
  memakai `fgColor="currentColor"` + wrapper `text-info`; PNG hasil unduh membaca
  `--color-info` lewat `getComputedStyle` saat tombol simpan ditekan. `#ffffff`
  pada QR adalah quiet zone yang memang harus putih murni, bukan token.
- `text-[13px]` → `text-control` dan `text-[11px]` → `text-caption` di seluruh
  file cluster. `text-[10px]` **dibiarkan**: belum ada token ukuran 10 px, dan
  menambah token baru di luar plan bukan bagian slice ini (masuk Fase D).
- **Kode mati dihapus:** cabang `if (order.status === 'completed')` di
  `terminal-status-cards.tsx` tidak pernah tercapai karena early-return di atas
  fungsi sudah mengembalikan `null`. Import `CheckCircle2` ikut dibuang.
- C.3 **tidak dipecah** menjadi C.3a/C.3b. Perubahan bersifat mekanis dan
  terverifikasi seluruhnya dalam satu siklus gate; memecah hanya menambah
  commit tanpa menambah sinyal review.
- **Gate screenshot tetap terbuka.** Sama seperti C.1, desktop browser tidak
  terhubung ke sesi ini. Belum dijalankan, bukan lolos.

**Verifikasi:** `types:check` bersih, `eslint` bersih pada 6 file, `prettier`
bersih, Vitest 130/130, `build` hijau.

### Slice C.4 — Row primitif + kode mati Customer

**Cluster file:** `resources/js/components/ui/order-item-row.tsx` (baru), `resources/js/components/ui/order-meta-row.tsx` (baru), `resources/js/components/ui/order-total-row.tsx` (baru), `resources/js/components/ui/index.ts`

- Buat tiga row primitif sesuai kanvas.
- Pakai di `active-order-card`, `order-history-card`, `order-info-card`.
- Hapus helper badge/kelas lokal yang tersisa di scope Customer.

**Verifikasi:** `npm run types:check`, `npm run lint:check`, `npm run test`, `npm run build`.

**Commit:** `refactor(customer): extract shared order row primitives`

**Catatan pelaksanaan (2026-09-17):**

- Kanvas dikonfirmasi ulang lewat pen.dev: `Item Row` → thumbnail 54×54
  `cornerRadius: 12`, `Meta Row` → outlet 12/600 + `via` 11/normal, `Total Row`
  → teks 13/normal + slot aksi. Tiga primitif dibuat persis mengikuti itu.
- Tile 54px di kanvas ber-radius **12**, bukan 16 (`--radius-card`) atau 10
  (`--radius-control`). Tidak ada token yang cocok, jadi ditambahkan
  `--radius-thumb: 0.75rem` di `@theme` — nilai kanvas, bukan nilai baru.
- `OrderItemRow`/`OrderMetaRow`/`OrderTotalRow` diekspor dari `ui/index.ts` dan
  dipakai di `active-order-card`, `order-history-card`, dan (nanti) item row
  `order-info-card`. `order-info-card` belum disentuh: ia merender **daftar**
  item yang dapat dilipat, bukan satu baris ringkas, jadi pemetaannya tidak
  satu-ke-satu dan lebih baik masuk slice sendiri.
- Props/handler di kedua kartu tidak berubah; hanya markup baris yang
  diekstrak. Rantai `Link`/`Button` tetap sama persis.

**Verifikasi:** `types:check` bersih, `prettier` bersih, Vitest 130/130,
`build` hijau, `.rounded-thumb` ter-emit di CSS.

### Putaran koreksi C.5–C.7 (2026-09-18)

Gate visual C.1/C.4 gagal. Audit delta membandingkan render dengan frame
Orders 1–4 dan menemukan delapan penyimpangan; delapan itu dikerjakan
sebagai tiga slice tambahan. Semua kluster file berbeda, jadi tiap slice
punya commit sendiri.

| # | Temuan (kanvas vs kode) | Slice |
|---|---|---|
| 1 | Judul 20/800 tengah; kanvas 24/800 kiri + subjudul 12 | C.5 |
| 2 | Tidak ada pita `Section Label` (12/700 `$text-muted`) | C.5 |
| 3 | Empty state beda anatomi (tanpa ikon, judul, CTA) | C.5 |
| 4 | Page plane putih; kanvas `#F7F7F5` | C.5 |
| 5 | Pill badge `sm` [6,10]; library `md` [4,10] | C.6 |
| 6 | Kartu terminal diredupkan `opacity-70`; kanvas tidak | C.6 |
| 7 | Dua aksi per kartu + tombol `Batalkan` di list | C.6 |
| 8 | Bottom nav: SVG isian, 20px, label 12, `shadow` + blur | C.7 |

**Keputusan yang menyertai audit:**

- Element `#F7F7F5` dideklarasikan sekali sebagai `--color-canvas`, terpisah
  dari `--color-surface-muted` `#F4F4F2` (tile thumbnail, pill netral).
- `Button` mendapat varian `secondary-brand` (surface + outline 2px brand +
  label brand) karena kanvas menggambar `Beli Lagi` dengan aksen brand,
  bukan netral seperti `outline`.
- Kanvas mengalahkan literal frame. Literal `#FEF3C7`/`#DCFCE7`/`#DBEAFE`,
  `r=18` pada kartu, `r=999` pada tombol, dan padding pill `[6,10]` adalah
  drift dari frame lama; yang menang adalah Components Library + variables.
- Aksi yang tidak ada di kanvas **tetap ada, tidak dihapus**, hanya
  dirapikan: kartu pemulihan "Pernah pesan sebelumnya?", strip nomor
  terpulihkan, badge refund, baris alamat kirim, dan baris `reason` status.
- `Batalkan` keluar dari kartu daftar. Pembatalan tetap terjangkau di layar
  detail pesanan (`show.tsx`) dan route track untuk pengguna login — di sana
  ada ruang untuk menjelaskan konsekuensinya.
- Bottom nav memakai ikon lucide 20px (House/Heart/ReceiptText/User) sesuai
  nama di kanvas dan `text-caption` untuk label; tidak ada shadow.

### Slice C.5 — Page chrome daftar pesanan — ✅ `824a8925`

**Cluster file:** `resources/css/app.css` (token `--color-canvas`),
`resources/js/pages/customer/orders/index.tsx`,
`resources/js/layouts/customer-mobile-layout.tsx` (prop `pageClassName`),
`resources/js/components/customer/empty-order-state.tsx`

- Judul 24/800 rata kiri + subjudul 12; filter selalu tampil (termasuk
  state kosong, sesuai Orders 3/4).
- `SectionLabel` lokal: 12/700 `text-text-muted` di pita `bg-canvas`.
- Empty state mengikuti anatomi kanvas; konten dibungkus `max-w-lg`.
- Layout dapat prop opt-in `pageClassName` (default `bg-background`) supaya
  hanya Orders yang memakai `bg-canvas`.

**Verifikasi:** `tsc` bersih, `format:check` bersih, eslint bersih (1
peringatan pra-ada di `checkout/customer.tsx`), Vitest 136/136, `build` hijau.

### Slice C.6 — Kartu pesanan — ✅ `56159a4f`

**Cluster file:** `resources/js/components/ui/button.tsx` (varian
`secondary-brand`), `resources/js/components/customer/order-history-card.tsx`,
`resources/js/components/customer/active-order-card.tsx`,
`resources/js/components/customer/order-card-shell.tsx`

- `StatusBadge size="md"`; tanggal, alasan dan pesan memakai `text-caption`.
- Shell tidak lagi meredupkan kartu terminal; mark dan judul penuh di semua
  status. `isDead` tetap dipakai untuk default `isClickable`.
- Satu aksi solid primary per kartu. `Beli Lagi` memakai `secondary-brand`,
  `Pesan Ulang` tetap primary; keduanya tanpa ikon.
- Dialog batal dan dialog prompt login dihapus dari kartu beserta hook
  `useCancelOrder`; pembatalan tetap ada di detail/track.

**Deviasi yang disengaja:** `size="sm"` (36px) dipertahankan mengikuti gambar
kanvas meski NFR-UI-2 menetapkan 44px. Kanvas adalah SSOT desain.

**Verifikasi:** `tsc` bersih, `format:check` bersih, eslint bersih (1
peringatan pra-ada), Vitest 136/136, `build` hijau.

### Slice C.7 — Bottom nav — ✅ `efe97a84`

**Cluster file:** `resources/js/components/customer/bottom-nav.tsx`

- Ikon lucide 20px (House/Heart/ReceiptText/User) menggantikan SVG buatan
  tangan yang mengisi warna saat aktif; kanvas mempertahankan satu glyph
  outline dan hanya menukar warna.
- Label 10/500 (aktif 700), `text-text-subtle` saat nonaktif; bar setinggi
  64px (`h-16`) dengan `border-t` sebagai ganti `shadow` + `backdrop-blur`.
- Offset bar mengambang tetap `4.5rem`: 64px + minimum safe-area.

**Verifikasi:** `tsc` bersih, `prettier` bersih, eslint bersih, Vitest
136/136, `build` hijau.

**Gate visual masih terbuka.** Desktop browser tidak terhubung ke sesi ini,
jadi screenshot sebelum/sesudah tidak bisa diambil; verifikasi visual
dilakukan pengguna di staging. Gate ini terbuka, bukan lolos.

---

## Fase D — Slice Role 2–4

Mengikuti plan induk `Slice R.1–R.4` per role, dengan Components Library dari Fase B sebagai target.

| # | Role | Cakupan | Aksen final | Blocker |
|---|---|---|---|---|
| 2 | Outlet | Refresh | emerald `#047857` + accent-orange `#FF8A3D` | — |
| 3 | Courier | Refresh | biru dipertahankan | — |
| 4 | Owner | Refresh, exempt 44 px | `#065F46` (dari `#005D42`) | — |

Satu role tidak mulai sebelum role sebelumnya lolos review. Semua pertanyaan aksen sudah terjawab (Q-CR2-1..3); tidak ada blocker terbuka.

---

## Fase E — Penutupan

### Slice E.1 — Verifikasi integrasi penuh

- Suite PHP penuh (jalankan **terpisah** dari Vitest).
- Vitest penuh.
- `npm run build`.
- Smoke staging: 4 role + alur checkout dan pembayaran.

### Slice E.2 — Audit kebersihan

- grep palette mentah pada kode yang disentuh = 0.
- grep hex literal pada `.tsx` yang disentuh = 0.
- `npm ls @base-ui/react` kosong.
- Hitung ulang jumlah `!important` di `app.css` (baseline 61).

### Slice E.3 — Dokumentasi

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
| PHP | `php artisan test` | semua lolos (terpisah) |
| Palette mentah | grep pada diff | 0 pada file yang disentuh |
| Hex literal | grep `#[0-9a-f]{6}` pada `.tsx` diff | 0 pada file yang disentuh |
| Touch target | audit kelas tinggi | ≥44 px (Customer/Outlet/Courier) |
| Customer visual | screenshot sebelum/sesudah | mengikuti CR-2.7 |
| Kanvas | bandingkan render dengan frame | setara |

Catatan: jalankan PHP dan Vitest **terpisah** — suite penuh bersamaan time-out.

## Estimasi

| Fase | Slice | Perkiraan | Status |
|---|---|---|---|
| A — Token | 4 | 3–4 jam | 3 selesai, 1 ditunda |
| B — Library | 6 | 6–9 jam | selesai |
| C — Customer Orders | 4 + 3 koreksi | 4–6 jam | selesai (gate visual terbuka) |
| D — Outlet/Courier/Owner | 12 | mengikuti plan induk | terkunci |
| E — Penutupan | 3 | 2–3 jam | terkunci |

Fase A + B + C menghasilkan satu paket yang bisa di-review end-to-end dan sesuai dengan kanvas yang sudah disetujui.

## Di luar lingkup

- Fitur baru, perubahan IA, perubahan alur order.
- Perubahan kontrak API, skema data, logika pembayaran/settlement.
- Beranda, Favorit, Akun, product detail (tidak ada di kanvas).
- **Catatan revisi:** bottom nav awalnya tercantum di sini sebagai di luar
  lingkup. Frame Orders 1–4 ternyata menggambarnya, jadi C.7 mengubah
  komponennya. Karena `bottom-nav.tsx` dipakai global di scope Customer,
  perubahan itu ikut terlihat di Beranda/Favorit/Akun — konsisten, tetapi
  layar-layar itu belum punya frame pembanding.
- Promosi `develop` → `main` (proses terpisah, butuh konfirmasi eksplisit).

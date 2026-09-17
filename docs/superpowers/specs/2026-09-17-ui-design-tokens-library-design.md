# Design Tokens & Components Library — Design Delta (CR-2)

**Tanggal:** 2026-09-17
**Peserta:** Arya Ajisadda (Pengembang) & Klien (Owner Dombi)
**Jenis:** Change Request / delta — **bukan** inisialisasi ulang sistem
**Status Gate 1:** ✅ Lulus 2026-09-17 (tidak dibuka ulang oleh CR-2)
**Baseline yang tidak ditulis ulang:** `docs/PRD.md` v0.4 §9, `docs/PRODUCT_SCOPE.md`
**Spec induk:** `docs/superpowers/specs/2026-09-17-ui-ux-design-alignment-design.md`
**Plan induk:** `docs/superpowers/plans/2026-09-17-ui-ux-design-alignment-plan.md`

**Peran dokumen ini:** ini adalah **artefak konkret Fase 0 / Slice 0.1 dan 0.2** pada plan induk — daftar token final dan spek Components Library yang sebelumnya berstatus ⬜ Open. Dokumen ini tidak menggantikan keputusan D1–D8; ia mengisinya.

**Sumber kebenaran desain:** kanvas pen.dev `pencil-new.pen`.
Frame di kanvas mengikat. Implementasi kode harus menghasilkan tampilan yang setara dengan frame, bukan sebaliknya.

---

## 1. Keputusan Baru (D9–D12)

D1–D8 tetap berlaku persis seperti tertulis di spec induk. CR-2 menambah empat keputusan:

| # | Keputusan | Catatan |
|---|---|---|
| **D9** | **Kanvas pen.dev adalah SSOT desain.** Frame Order (list + detail) menjadi acuan tampilan yang mengikat | Menjawab pertanyaan yang menggantung: bukan sekadar referensi. Kode mengikuti kanvas |
| **D10** | **Components Library memperluas `resources/js/components/ui/`** yang sudah ada, bukan folder baru | `ui/` sudah diimpor 70+ file; folder baru akan memaksa reimport masif tanpa manfaat |
| **D11** | **Token dideklarasikan sekali** di blok `@theme` `resources/css/app.css`. Tidak ada nilai visual literal di `.tsx` | Menegakkan NFR-UI-1 pada tingkat yang bisa diverifikasi |
| **D12** | **Satu primitive dialog/sheet** berbasis Radix; `@base-ui/react` dihapus dari dependensi setelah 5 file mati dihapus | Menyelesaikan percabangan dua library primitive |

---

## 2. Koreksi Terhadap Baseline (CR-2 Findings)

Temuan berikut **memperbaiki klaim** di spec induk §4. Diukur pada `develop` @ `1d77a8d0`, 2026-09-17.

### CR-2.1 — Klaim "Customer dan Outlet tidak pernah dapat tema" adalah **setengah benar**

Spec induk §4.3 menyebut `data-role` hanya di-set `owner-layout.tsx` dan `courier-layout.tsx`, lalu menyimpulkan "tema role tidak pernah aktif untuk 2 dari 4 role".

**Verifikasi kode:** klaim setter-nya benar — hanya `courier-layout.tsx:41` dan `owner-layout.tsx:146` yang menulis `root.dataset.role`.

**Koreksi:** Customer dan Outlet tetap mendapat `--color-primary` emerald dari blok `@theme` default. Jadi **tidak ada bug warna hari ini.** Yang benar-benar tidak ada adalah **slot aksen berbeda** untuk Outlet.

**Konsekuensi:** NFR-UI-4 (perbedaan role lewat token global) tetap valid dan tetap dikerjakan, tetapi bukan perbaikan bug — melainkan penambahan slot. Prioritasnya turun dari "bug" ke "kosmetik terencana".

### CR-2.2 — Lima komponen mati terkonfirmasi, semuanya `@base-ui/react`

Dihitung ulang dengan pencarian importer (mengecualikan file itu sendiri dan `ui/index.ts`):

| File | Importer | Library |
|---|---|---|
| `ui/badge.tsx` | **0** | `@base-ui/react/merge-props`, `use-render` |
| `ui/expandable-section.tsx` | **0** | — |
| `ui/separator.tsx` | **0** | `@base-ui/react/separator` |
| `ui/sheet.tsx` | **0** | `@base-ui/react/dialog` |
| `ui/tabs.tsx` | **0** | `@base-ui/react/tabs` |

Kelima file diekspor dari `ui/index.ts` (baris 7) sehingga tampak hidup. Setelah dihapus, `@base-ui/react ^1.6.0` **tidak lagi punya konsumen** dan dependensinya bisa dibuang.

### CR-2.3 — Token yang **dikonsumsi tapi belum dideklarasikan**

`ui/card.tsx` memakai `bg-card` dan `text-card-foreground`; tidak ada `--color-card` maupun `--color-card-foreground` di `app.css`. `font-heading` dipakai **129 kali**; `--font-heading` tidak pernah dideklarasikan. Artinya Card dan seluruh judul render dengan nilai yang tidak ter-resolve hari ini.

| Token dikonsumsi | Dipakai | Dideklarasikan |
|---|---|---|
| `--color-card` | `ui/card.tsx` + 5 file | ❌ |
| `--color-card-foreground` | `ui/card.tsx` | ❌ |
| `--font-heading` | 129 pemakaian | ❌ |
| `--color-overlay` (backdrop sheet) | inline hex / hitam transparan | ❌ |

### CR-2.4 — Angka audit diperbarui

| Metrik | Spec induk §4 | Aktual |
|---|---|---|
| Pemakaian palette mentah di `.tsx` | 2.422 | **2.320** |
| Hex inline di `.tsx` | 146 | 146 (tetap) |
| Elemen `<button>` mentah | 378 | **378** (di **144 file**) |
| `!important` di `app.css` | 3 (khusus owner-filter) | **61** total di file |
| Panjang `app.css` | — | 711 baris |

Distribusi radius global: `rounded-lg` 455 · `rounded-xl` 420 · `rounded-full` 285 · `rounded-2xl` 187 · `rounded-md` 58.

Distribusi tinggi kontrol global: `min-h-11` (44) 215 · `h-8` (32) 125 · `h-10` (40) 103 · `h-11` (44) 69 · `h-12` (48) 41 · `h-9` (36) 28.

**Bacaan:** `min-h-11` sudah dominan (215). Jaminan 44 px tidak butuh normalisasi besar — hanya pembuangan varian kecil (`h-8` 125 pemakaian).

### CR-2.5 — Bukti langsung untuk scope Customer Orders

Spesifik untuk layar yang sudah didesain di kanvas.

**Dua brand green dalam satu layar:**

| Hex | Jumlah | Lokasi | Status |
|---|---|---|---|
| `#006241` | 13 | `components/customer/order/order-header.tsx` | ❌ bukan brand |
| `#EAF5ED` | 4 | `components/customer/order/order-header.tsx` | ❌ bukan brand |
| `#047857` | mayoritas | komponen lain | ✅ brand |

`#006241` / `#EAF5ED` adalah hijau tema lain yang tertinggal. Ini inkonsistensi paling kasat mata di scope ini.

**Inkonsistensi struktural di scope `customer/orders` + `customer/order*`:**

| Aspek | Distribusi | Masalah |
|---|---|---|
| Radius | `rounded-xl` 50 · `rounded-full` 31 · `rounded-lg` 30 · `rounded-2xl` 4 | 4 nilai radius bercampur |
| Tinggi tombol | `min-h-11` 16 · `h-11` 9 · `min-h-12` 7 · `h-10` 7 · `min-h-10` 5 · `h-9` 3 · `h-12` 3 · `h-8` 2 | 8 nilai tinggi bercampur |
| Badge status | 4 sistem paralel | lihat §5.4 |

### CR-2.6 — Ruang lingkup kanvas yang sudah disetujui

Kanvas `pencil-new.pen` sekarang memuat **18 frame**:

- `Orders 1 — Aktif` · `Orders 2 — Riwayat` · `Orders 3 — Kosong` · `Orders 4 — Tanpa Hasil` (layar daftar)
- `Order Detail 1..14` (layar detail: diproses, siap diambil + QR, dalam pengiriman, pembayaran bermasalah, selesai, dibatalkan/ditolak, kadaluarsa, pengiriman gagal, refund ×4, sheet batalkan, sheet laporkan)

Semua frame disetujui klien. Kanvas **tidak menyentuh** Beranda, Favorit, Akun, product detail, atau bottom nav global.

### CR-2.7 — Klarifikasi gerbang "zero visual regression" Customer

Spec induk menyebut kriteria terima Customer = **zero visual regression**, sementara D8/CR-1 juga mengizinkan perubahan *touch target 44 px* dan *layout/spacing*. Dua hal ini saling bertentangan bila dibaca harfiah.

**Klarifikasi (mengikat):** "zero visual regression" membandingkan **bahasa visual** — warna, tipografi, radius, elevasi. Yang **diizinkan berubah** untuk Customer:

1. Tinggi kontrol naik ke minimum 44 px (NFR-UI-2).
2. Spacing/padding dinormalisasi ke skala token.
3. Radius diseragamkan ke token (`--radius-card` 16, `--radius-control` 10, `--radius-chip` 8).
4. Hex non-brand (`#006241`, `#EAF5ED`) diganti ke brand (`#047857`, `#ECF5F0`→`$primary-light`).

Yang **tidak boleh berubah**: keluarga warna brand, jenis huruf, dan kesan elevasi.

---

## 3. Design Tokens (Final)

Dideklarasikan sekali di `resources/css/app.css` blok `@theme`. Nama mengikuti konvensi Tailwind v4 (`--color-*`, `--radius-*`, `--shadow-*`, `--font-*`).

### 3.1 Warna — Brand & Netral

| Token | Nilai | Sumber | Status |
|---|---|---|---|
| `--color-primary` | `#047857` | kanvas `primary` | sudah ada |
| `--color-primary-hover` | `#065F46` | kanvas `primary-hover` | sudah ada |
| `--color-primary-light` | `#ECFDF5` | kanvas `primary-light` | sudah ada |
| `--color-accent-orange` | `#FF8A3D` | kanvas `accent` | sudah ada |
| `--color-accent-orange-hover` | `#E07730` | kanvas `accent-hover` | sudah ada |
| `--color-surface` | `#FFFFFF` | kanvas `surface` | sudah ada |
| `--color-surface-muted` | `#F4F4F2` | kanvas `surface-muted` | sudah ada |
| `--color-border` | `#E4E4E7` | kanvas `border` | sudah ada |
| `--color-border-strong` | `#D4D4D4` | kanvas `border-strong` | sudah ada |
| `--color-text` | `#1E1E1E` | kanvas `text` | sudah ada |
| `--color-text-muted` | `#71717A` | kanvas `text-muted` | sudah ada |
| `--color-text-subtle` | `#A1A1AA` | kanvas `text-subtle` | sudah ada |

### 3.2 Warna — Semantik (pasangan tint)

Setiap status punya **pasangan**: latar tint + teks di atasnya. Ini yang menggantikan `bg-red-50 text-red-700` dan sejenisnya.

| Status | `--color-*-bg` | `--color-*-text` | Padanan lama |
|---|---|---|---|
| success | `#ECFDF5` | `#047857` | `bg-emerald-50 text-emerald-700` |
| warning | `#FFFBEB` | `#B45309` | `bg-amber-50 text-amber-700` |
| danger | `#FEF2F2` | `#B91C1C` | `bg-red-50 text-red-700` |
| info | `#EFF6FF` | `#1D4ED8` | `bg-blue-50 text-blue-700` |
| neutral | `#F4F4F2` | `#71717A` | `bg-surface-muted text-text-muted` |

Warna solid untuk border/ikon: `--color-success` `#16A34A`, `--color-warning` `#D97706`, `--color-danger` `#DC2626`, `--color-info` `#2563EB` (sudah ada).

### 3.3 Warna — Token yang Harus Ditambahkan

| Token | Nilai | Alasan |
|---|---|---|
| `--color-card` | `#FFFFFF` | `ui/card.tsx` memakai `bg-card` — belum terdeklarasi |
| `--color-card-foreground` | `#1E1E1E` | `ui/card.tsx` memakai `text-card-foreground` |
| `--color-overlay` | `rgba(0,0,0,0.40)` | backdrop sheet/dialog, sekarang hex inline |
| `--color-input` | `#E4E4E7` | sudah ada, tapi `ui/input.tsx` masih `border-input` + `shadow-sm` bawaan |

### 3.4 Tipografi

| Token | Nilai | Status |
|---|---|---|
| `--font-body` | `Inter` | sudah ada (`--font-sans`) |
| `--font-heading` | `Plus Jakarta Sans` | **harus ditambahkan** — dipakai 129×, belum terdeklarasi |

Skala tipe yang dipakai di kanvas (mengikat):

| Peran | Ukuran | Berat | Font |
|---|---|---|---|
| Judul hero | 18 | 700 | heading |
| Judul layar / App Header | 14 | 600 | body |
| Judul kartu | 13 | 700 | body |
| Isi | 13 | 400–600 | body |
| Meta / sekunder | 12 | 400–600 | body |
| Keterangan / badge | 11 | 400–700 | body |
| Eyebrow (label bagian) | 11 | 700 | body, uppercase |

### 3.5 Radius

| Token | Nilai | Kanvas | Dipakai untuk |
|---|---|---|---|
| `--radius-card` | `1rem` (16) | 16 ✅ | Card, notice, sheet, banner |
| `--radius-control` | `0.625rem` (10) | 10 ✅ | Tombol, input, opsi |
| `--radius-chip` | `0.5rem` (8) | 8 ✅ | Chip, thumbnail |
| pill | `9999px` | 999 ✅ | Badge status, avatar, handle |

Token radius sudah **cocok persis** dengan kanvas. Tidak ada perubahan nilai — yang berubah adalah disiplin pemakaian (menggantikan `rounded-lg`/`rounded-xl`/`rounded-2xl` ad-hoc).

### 3.6 Spacing

Skala 4-point: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40`.
Padding tepi layar kanvas = **16 px**. Gap antar-kartu = **14 px**. Gap dalam kartu = **12 px**. Gutter kanvas antar-frame = 120 px (tidak relevan untuk kode).

### 3.7 Elevasi

`--shadow-card` dan `--shadow-elevated` sudah ada dan dipakai. Kanvas tidak mendefinisikan bayangan baru. **Tidak diubah**, kecuali override per-role (Courier) yang perlu dibawa ke bentuk token.

### 3.8 Touch Target

| Peran | Jaminan |
|---|---|
| Customer, Outlet, Courier | semua elemen interaktif ≥ **44×44 px** pada viewport mobile |
| Owner | dikecualikan pada pointer presisi (D6); tetap terikat token & komponen |

### 3.9 Aksen Per-Role

| Role | Primary | Aksen | Status |
|---|---|---|---|
| Customer | `#047857` emerald | — | tetap, konsistensi (D8) |
| Courier | blue (sudah ada) | — | tetap |
| Owner | `#005D42` (sudah ada) | — | tetap |
| Outlet | `#047857` emerald | **⬜ belum ditetapkan** | lihat §8 Q-CR2-1 |

---

## 4. Components Library (Final)

Ditempatkan di `resources/js/components/ui/` (D10). Setiap komponen kanonik dipakai lintas role.

### 4.1 Inventaris Kanonik

| Komponen kanonik | File target | Menggantikan |
|---|---|---|
| `Button` | `ui/button.tsx` (perluas) | 378 `<button>` mentah di 144 file |
| `Card` + sub-parts | `ui/card.tsx` (perbaiki token) | `rounded-*` ad-hoc, `order-card-shell` |
| `StatusBadge` | `ui/status-badge.tsx` (jadikan tunggal) | 10 badge/chip |
| `Input` / `Textarea` / `Select` | `ui/input.tsx`, `ui/textarea.tsx`, `ui/select.tsx` | 61 `!important` + input kustom |
| `Notice` | `ui/notice.tsx` **(baru)** | banner ad-hoc, `PaymentIssueBanner`, `NonCancellableNotice` |
| `BottomSheet` | `ui/bottom-sheet.tsx` (jadikan tunggal) | `ui/sheet` (0 importer), `ui/side-sheet` (1) |
| `Dialog` | `ui/dialog.tsx` (Radix) | `owner-modal-shell` (4) |
| `FilterChips` | `ui/filter-chips.tsx` | `ui/filter-chips` + `customer/order-filter-chips` |
| `OrderItemRow` | `ui/order-item-row.tsx` **(baru)** | item row ad-hoc di 3 file |
| `OrderMetaRow` | `ui/order-meta-row.tsx` **(baru)** | meta row ad-hoc |
| `OrderTotalRow` | `ui/order-total-row.tsx` **(baru)** | total row ad-hoc |

### 4.2 Button

Satu komponen. Varian × ukuran.

**Varian:** `primary` · `secondary` · `outline` · `ghost` · `danger` · `link`

**Ukuran:**

| Size | Tinggi | Padding X | Teks | Kapan |
|---|---|---|---|---|
| `sm` | 36 | 12 | 12 | ikon-adjacent, bukan aksi utama |
| `md` | 40 | 16 | 13 | desktop / Owner |
| `lg` | **44** | 20 | 13 | **default mobile** (NFR-UI-2) |
| `cta` | 48 | 24 | 13 | aksi utama satu layar (`width: fill_container`) |
| `icon` | **44×44** | — | — | tombol ikon |

Aturan yang mengikat:

- `md` hanya boleh dipakai bila perangkat pointer presisi (Owner) — bukan di Customer/Outlet/Courier.
- Warna varian diambil **hanya** dari token: `primary` = `bg-primary text-white`, `danger` = `bg-danger text-white`, `outline` = `border-border bg-surface text-text`, `secondary` = `bg-surface-muted text-text`, `ghost` = `text-text-muted`.
- Radius = `--radius-control` (10).
- **Tidak ada** `red-200`/`red-700`/`red-50` (varian `danger` lama di `ui/button.tsx:18` melanggar NFR-UI-1).

### 4.3 Notice

Komponen baru. Menggantikan semua banner peringatan/informasi ad-hoc.

**Tone:** `info` · `warning` · `danger` · `success` · `neutral`

**Anatomi:** ikon (18) + judul (13/700) → isi (11/400) → aksi opsional (Button `danger`/`primary`).

Semua warna dari pasangan tint §3.2. Radius `--radius-card`. Padding 16.

Kanvas: dipakai di frame `Order Detail 4` (Pembayaran Bermasalah), `6` (Dibatalkan), `7` (Kadaluarsa), `8` (Pengiriman Gagal), dan `9–12` (refund).

### 4.4 StatusBadge

Satu komponen, **dua mode**: `<StatusBadge status="..." />` (resolve otomatis) atau `<StatusBadge variant="...">` (manual).

Wajib menyerap:

| Sumber | Perlakuan |
|---|---|
| `ui/status-badge.tsx` (44 importer) | **jadikan basis** |
| `ui/order-status-badge.tsx` (1) | lebur |
| `ui/delivery-status-badge.tsx` (4) | lebur |
| `ui/stock-level-badge.tsx` (2) | lebur |
| `ui/restock-status-badge.tsx` (2) | lebur |
| `owner/order-status-chip.tsx` | lebur |
| `lib/order-status-config.ts` `BADGE_BASE` | **hapus** — sistem kelas paralel |
| `DELIVERY_STATUS_COLORS`, `REFUND_BADGE_STYLES` | hapus, arahkan ke varian |

Varian → token (bukan kelas palette):

| Varian | Kelas kanonik |
|---|---|
| success | `bg-success-bg text-success-text` |
| warning | `bg-warning-bg text-warning-text` |
| danger | `bg-danger-bg text-danger-text` |
| info | `bg-info-bg text-info-text` |
| neutral | `bg-surface-muted text-text-muted` |

Ukuran: `sm` (11 px) · `md` (12 px). Radius pill.

### 4.5 Card

`ui/card.tsx` sudah benar secara struktur. Yang diperbaiki hanya:

1. Tambahkan `--color-card` dan `--color-card-foreground` (§3.3).
2. Ganti `rounded-xl` → `rounded-card` agar ikut token.
3. Ganti `ring-1 ring-foreground/10` → token border.

### 4.6 Input

1. `h-9` (36) → `min-h-11` (44) untuk Customer/Outlet/Courier.
2. `rounded-md` → `rounded-control`.
3. `border-input` → token; `shadow-sm` dihapus (bukan bagian bahasa visual kanvas).
4. `--color-danger` untuk state error.

Catatan: `app.css` memaksa `font-size: 16px !important` pada semua input untuk mencegah zoom iOS. **Ini dipertahankan** — tapi harus diubah dari selector tag global menjadi kelas komponen agar tidak ada `!important` liar.

### 4.7 BottomSheet & Dialog

- Primitive: **Radix** (`@radix-ui/react-dialog`). `@base-ui/react` dibuang (D12).
- `ui/bottom-sheet.tsx` (7 importer) menjadi satu-satunya sheet.
- `ui/side-sheet.tsx` (1 importer) dilebur bila memungkinkan.
- `owner/owner-modal-shell.tsx` (4 importer) → `ui/dialog.tsx`.
- Backdrop memakai `--color-overlay`.
- Sheet kanvas: handle 40×4 pill, radius atas 20, padding 20/16/24.

---

## 5. Pemetaan Komponen Lama → Baru

| Lama | Baru | Catatan |
|---|---|---|
| `<button className="...rounded-lg bg-primary...">` (378×) | `Button` | bentuk & warna sama bila varian cocok |
| `ui/badge.tsx` | **hapus** | 0 importer, `@base-ui` |
| `ui/expandable-section.tsx` | **hapus** | 0 importer |
| `ui/separator.tsx` | **hapus** | 0 importer, `@base-ui` |
| `ui/sheet.tsx` | **hapus** | 0 importer, `@base-ui` |
| `ui/tabs.tsx` | **hapus** | 0 importer, `@base-ui` |
| `ui/order-status-badge.tsx` | `StatusBadge` | lebur |
| `ui/delivery-status-badge.tsx` | `StatusBadge` | lebur |
| `ui/stock-level-badge.tsx` | `StatusBadge` | lebur |
| `ui/restock-status-badge.tsx` | `StatusBadge` | lebur |
| `owner/order-status-chip.tsx` | `StatusBadge` | lebur |
| `lib/order-status-config.ts` | hapus `BADGE_BASE` | kelas paralel |
| `customer/order-card-shell.tsx` | `Card` | jadikan pembungkus tipis |
| `customer/order-filter-chips.tsx` | `FilterChips` | aktif state diseragamkan |
| `customer/order-qr-card.tsx` | `Card` + isi | `#1e40af` → token `info` |
| `customer/order-timeline.tsx` | `Card` + isi | radius → `--radius-card` |
| `customer/order/order-header.tsx` | `Card`/header | **`#006241` + `#EAF5ED` → token brand** |
| `owner/owner-modal-shell.tsx` | `Dialog` | |
| 5 banner ad-hoc | `Notice` | |
| 3 item row ad-hoc | `OrderItemRow` | |
| `@base-ui/react` (dependency) | **hapus** | setelah 5 file mati hilang |

---

## 6. Batasan Delta

- Presentasional saja. **Tidak** mengubah kontrak API, skema data, atau logika pembayaran/settlement.
- Tidak menambah fitur, tidak mengubah arsitektur informasi, tidak mengubah alur order.
- Kanvas **tidak** mencakup Beranda, Favorit, Akun, product detail, atau bottom nav global. Frame tersebut tidak dibuat dan tidak boleh dijadikan alasan memperluas scope.
- Promosi `develop` → `main` proses terpisah, butuh konfirmasi eksplisit.

---

## 7. Kriteria Terima

| # | Kriteria | Cara uji |
|---|---|---|
| A1 | Tidak ada palette mentah di komponen yang disentuh | grep `-{red,emerald,amber,slate,blue}-{n}` pada diff |
| A2 | Tidak ada hex literal di `.tsx` yang disentuh | grep `#[0-9a-f]{6}` pada diff |
| A3 | Elemen interaktif Customer/Outlet/Courier ≥44 px | audit kelas tinggi pada diff |
| A4 | Setiap karakter status di layar Order memakai `StatusBadge` | grep `BADGE_BASE`/`STATUS_COLORS` = 0 |
| A5 | Komponen mati hilang dan `@base-ui/react` tidak lagi di `package.json` | grep importer = 0, `npm ls @base-ui/react` |
| A6 | `--font-heading` dan `--color-card` ter-resolve | inspeksi computed style di staging |
| A7 | Customer: bahasa visual tidak berubah kecuali §2 CR-2.7 | perbandingan screenshot |
| A8 | Gate teknis hijau | §8 plan |

---

## 8. Pertanyaan Terbuka

| # | Pertanyaan | Blocking? |
|---|---|---|
| **Q-CR2-1** | Aksen Outlet: emerald + accent-orange, atau warna lain dalam keluarga brand? | ⬜ Blocking untuk slice Outlet saja. Customer tidak terpengaruh |
| **Q-CR2-2** | Courier: biru tidak berada dalam keluarga brand emerald. Dipertahankan sebagai aksen role, atau ditarik ke keluarga brand? | ⬜ Tidak blocking — Courier slice terakhir sebelum Owner |
| **Q-CR2-3** | Owner `#005D42` dipertahankan atau diselaraskan ke `primary-hover` `#065F46`? | ⬜ Tidak blocking untuk Customer |

Ketiganya **tidak memblokir slice Customer**, yang berjalan lebih dulu dan hanya butuh token emerald yang sudah ada.

## 9. Status Blocker

| Blocker | Status |
|---|---|
| Gate 1 | ✅ Lulus 2026-09-17 — tidak dibuka ulang |
| Fase 0 (token + spek komponen) | ✅ **Selesai** — dokumen ini + 18 frame kanvas |
| Gerbang review draf (Slice 0.3) | ⬜ Menunggu persetujuan klien atas dokumen ini |
| Eksekusi kode | ⬜ Belum boleh mulai — menunggu gerbang review |

## 10. Langkah Berikutnya

1. ⬜ Klien menyetujui dokumen ini (gerbang review draf).
2. ⬜ Jawab Q-CR2-1..3 bila ingin slice Outlet/Courier/Owner ikut jalan.
3. ⬜ Eksekusi menurut `docs/superpowers/plans/2026-09-17-ui-design-tokens-library-plan.md`.

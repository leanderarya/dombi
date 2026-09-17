# Review UI/UX & Design Alignment — MoM & Design Delta

**Tanggal MoM:** 2026-09-17
**Peserta:** Arya Ajisadda (Pengembang) & Klien (Owner Dombi)
**Agenda:** Evaluasi desain, komponen, dan pengalaman pengguna antar-role (Customer, Outlet, Owner, Courier)
**Jenis:** Change Request / delta sprint — **bukan** inisialisasi ulang sistem
**Baseline yang tidak ditulis ulang:** `docs/PRD.md` v0.2 (2026-08-06), `docs/PRODUCT_SCOPE.md`

**Status Gate 1:** ⏳ **BELUM DIVALIDASI** — 5 pertanyaan blocking di §7 harus dijawab sebelum scope dibekukan.
**Aturan:** Tidak ada kode sebelum Gate 1.

---

## 1. Keputusan (Decisions)

| # | Keputusan | Catatan |
|---|---|---|
| D1 | Standardisasi design tokens Tailwind v4 sebagai satu-satunya sumber warna/spacing/radius | Menghapus pemakaian palette hardcoded yang mem-bypass token |
| D2 | Konsolidasi komponen dasar bersama untuk **semua** panel role (Button, Modal/Dialog, Card, Badge status, Input) | Panel role tidak lagi punya varian komponen sendiri untuk peran yang sama |
| D3 | Layout mengikuti breakpoint mobile-first dengan **touch target minimum 44×44 px** dan padding/margin seragam | Termasuk panel Owner yang saat ini desktop-berat |
| D4 | Identitas warna antar-role tetap berada dalam **satu keluarga tema brand** | Detail "satu brand vs aksen per-role" belum diputuskan → Q2 |

## 2. Action Items

| ID | Action Item | Status | Bukti awal |
|---|---|---|---|
| **DS-1** | Tetapkan palet primer/sekunder global + aksen role (jika ada) dalam design tokens Tailwind v4 | ⬜ Open | §4.1, §4.3 |
| **DS-2** | Reuse komponen dasar bersama (Button, Modal/Dialog, Card, Badge status, Input) di seluruh panel role | ⬜ Open | §4.2 |
| **DS-3** | Rapikan layout: breakpoint mobile-first, touch target min. 44×44 px, konsistensi padding/margin | ⬜ Open | §4.4 |
| **DS-4** | Timeline pengerjaan draf revisi desain / implementasi staging | ⬜ Open | **Target tanggal KOSONG → Q1** |

## 3. Timeline & Status

| Item | Target | Status |
|---|---|---|
| Draf revisi desain | **TBD → Q1** | Belum ditetapkan |
| Implementasi staging | **TBD → Q1** | Belum ditetapkan |
| Gate 1 (scope beku) | Menunggu jawaban Q1–Q5 | ⏳ |

---

## 4. Baseline Auditing (kondisi kode saat MoM)

Diukur pada `develop` @ `13cd7e3e`, 2026-09-17. Angka ini yang membuat feedback klien bisa diverifikasi, bukan sekadar opini.

### 4.1 Tokens vs warna hardcoded

- `resources/css/app.css` sudah punya blok `@theme` Tailwind v4: `--color-primary`, `--color-surface`, `--color-text`, `--color-success/warning/danger/info`, `--radius-card/control/chip`, `--shadow-card/elevated`.
- Tetapi **2.422 pemakaian utilitas palette mentah** di `resources/js` (mis. `text-red-600` ×208, `text-emerald-600` ×120, `bg-red-50` ×116, `bg-emerald-50` ×100, `text-amber-600` ×81, `text-slate-500` ×80, `border-slate-200` ×74).
- **146 warna hex inline** langsung di `.tsx` (contoh: `app.css` `.dombi-swal-confirm` `#047857`, `.fore-badge-success` `#ecfdf5`).
- Efeknya: token ada, tapi mayoritas UI tidak melewatinya → inilah akar "palet warna terkesan terpisah".

### 4.2 Duplikasi komponen

- **`Button` `resources/js/components/ui/button.tsx` dipakai 70 file — tetapi ada 378 elemen `<button>` mentah** yang tidak memakai komponen itu. Perilaku & bentuk tombol jadi bervariasi.
- Ukuran Button yang tersedia: `sm`=`h-8`, `default`/`md`=`h-9`, `lg`=`h-10`, `icon`=`h-9`. **Semuanya di bawah 44 px.** Ada 153 kemunculan kelas `h-8`/`h-9`/`size-8`/`size-9`/`w-8`/`w-9`.
- **10 komponen badge/chip berbeda** untuk peran yang sama: `ui/badge`, `ui/status-badge`, `ui/order-status-badge`, `ui/delivery-status-badge`, `ui/stock-level-badge`, `ui/restock-status-badge`, `ui/delivery-sla-badge`, `owner/order-status-chip`, `ui/filter-chips`, `customer/order-filter-chips`.
- **36 file** modal/dialog/sheet, dengan primitive berbeda: `ui/dialog` (51 importer), `ui/bottom-sheet` (7), `ui/side-sheet` (1), `owner/owner-modal-shell` (4). `ui/sheet` **0 importer**.
- Filename yang terduplikasi antar folder role: `assign-courier-sheet`, `bottom-nav`, `delivery-sla-badge`, `delivery-timeline`, `filter-sheet`, `product-image`.
- **Komponen mati** (0 importer): `ui/badge.tsx`, `ui/expandable-section.tsx`, `ui/separator.tsx`, `ui/sheet.tsx`, `ui/tabs.tsx`.
- `ui/badge.tsx` memakai `@base-ui/react` (v1.6.0) — **library primitive berbeda** dari sisa aplikasi yang memakai Radix (`@radix-ui/react-dialog`, `@radix-ui/react-slot`). Dead code + campur dua library.

### 4.3 Tema per-role

- `app.css` mendefinisikan override per-role lewat `html[data-role='owner']` dan `html[data-role='courier']`.
- **`data-role` hanya di-set oleh `owner-layout.tsx` dan `courier-layout.tsx`. Customer dan Outlet tidak pernah di-set** → tema role tidak pernah aktif untuk 2 dari 4 role.
- Tambalan CSS `.bg-emerald-50`→biru dan `.text-emerald-700`→biru khusus courier menandakan warna di-hardcode lebih dulu, lalu ditimpa — bukan token.
- Distribusi warna hardcoded per panel memperkuat temuan klien:

| Role | Dominasi warna hardcoded | Tema resmi saat ini |
|---|---|---|
| Customer | emerald 200, red 147, amber 96 | emerald (tidak pakai `data-role`) |
| Outlet | red 122, emerald 66 | emerald (tidak pakai `data-role`) |
| Owner | emerald 273, slate 245, red 239 | emerald gelap `#005d42` via `data-role` |
| Courier | red 33, amber 6 | biru via `data-role` |

### 4.4 Layout & touch target

- Aturan `min-height: 44px` di `app.css` hanya ada pada `.dombi-swal-confirm*` / `.dombi-swal-cancel` (SweetAlert). Komponen aplikasi sendiri tidak punya jaminan 44 px.
- `app.css` berisi 3 override `!important` khusus `.owner-filter-card` (`font-size/padding`) untuk memaksa input kecil — bukti perbaikan layout bersifat tambalan per-halaman.

---

## 5. Delta terhadap PRD

PRD v0.2 §9 (Non-Functional Requirements) hanya menyebut "Mobile-first design dengan breakpoint Tailwind standar". **Belum ada** persyaratan eksplisit tentang design token, touch target 44 px, atau reuse komponen dasar antar-role.

**Usulan delta (menunggu Gate 1):**
- **NFR-UI-1** — Seluruh warna/radius/spacing UI berasal dari design token; pemakaian palette mentah Tailwind pada komponen UI tidak diizinkan.
- **NFR-UI-2** — Semua elemen interaktif punya area sentuh ≥ 44×44 px pada viewport mobile.
- **NFR-UI-3** — Komponen dasar (Button, Modal/Dialog, Card, Badge, Input) merupakan komponen bersama tunggal yang dipakai semua panel role.
- **NFR-UI-4** — Tema per-role (jika disetujui) diterapkan lewat token CSS global, bukan override per-kelas atau per-halaman.

## 6. Batasan Delta

- Baseline PRD, Product Scope, dan alur fungsional tidak ditulis ulang.
- Perubahan bersifat presentasional; **tidak** mengubah kontrak API, skema data, atau logika pembayaran/settlement yang sudah tervalidasi.
- Item di luar lingkup: fitur baru, redesign informasi (IA), atau perubahan alur order.

---

## 7. Pertanyaan Blocking (wajib dijawab sebelum Gate 1)

### Q1 — Timeline (Action Item DS-4)
Target tanggal untuk (a) draf revisi desain dan (b) implementasi staging belum diisi di MoM. Mohon tanggal konkret, atau periode relatif (mis. "draf 2 minggu, staging 4 minggu setelah Gate 1").

### Q2 — Identitas warna per-role
MoM menulis "aksen khusus (**jika ada** identitas warna per-role)". Pilih salah satu:
- **(A)** Satu palet brand untuk semua role; perbedaan role hanya lewat label/ikon, bukan warna.
- **(B)** Satu keluarga tema + satu warna aksen berbeda per role (Customer / Outlet / Owner / Courier).
- **(C)** Pertahankan 4 warna berbeda seperti sekarang, tapi dirapikan agar tetap harmonis.

### Q3 — Cakupan konsolidasi komponen
MoM menyebut "reuse komponen dasar bersama". Seberapa luas?
- **(A)** Terbatas pada 5 komponen yang disebut (Button, Modal/Dialog, Card, Badge, Input).
- **(B)** Lima komponen + varian badge/chip/mod/input yang duplikat.
- **(C)** Menyapu seluruh komponen UI (termasuk menghapus komponen mati dan menyatukan primitive dialog/sheet).

### Q4 — Cakupan perangkat
"Mobile-first, touch target 44 px". Apakah standardisasi ini juga mengikat **panel Owner yang desktop-berat** (57 halaman, sidebar + tabel), atau panel Owner dikecualikan dan hanya dirapikan alignment/spacing-nya?

### Q5 — Jenis pekerjaan
Apakah klien menginginkan:
- **(A)** **Consistency only** — tampilan tetap seperti sekarang, hanya diseragamkan token/komponen/layout.
- **(B)** **Visual refresh** — bahasa desain baru (warna, tipografi, radius, elevasi) sekaligus konsistensi.

---

## 8. Status Blocker Eksplisit

| Blocker | Alasan |
|---|---|
| Gate 1 belum tercapai | Q1–Q5 belum dijawab; timeline kosong |
| Implementasi belum boleh mulai | Aturan Phase 0: tidak ada kode sebelum Gate 1 |

## 9. Langkah Berikutnya

1. Klien & developer menjawab Q1–Q5.
2. Delta PRD §5 difinalkan sesuai jawaban.
3. Scope dibekukan → **Gate 1**.
4. Baru setelah itu: rencana implementasi (`docs/superpowers/plans/`) dan eksekusi per slice vertikal.

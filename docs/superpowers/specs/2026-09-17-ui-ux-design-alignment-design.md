# Review UI/UX & Design Alignment — MoM & Design Delta

**Tanggal MoM:** 2026-09-17
**Peserta:** Arya Ajisadda (Pengembang) & Klien (Owner Dombi)
**Agenda:** Evaluasi desain, komponen, dan pengalaman pengguna antar-role (Customer, Outlet, Owner, Courier)
**Jenis:** Change Request / delta sprint — **bukan** inisialisasi ulang sistem
**Baseline yang tidak ditulis ulang:** `docs/PRD.md` v0.2 (2026-08-06), `docs/PRODUCT_SCOPE.md`

**Status Gate 1:** ✅ **LULUS 2026-09-17** — Q1–Q5 terjawab, timeline terkunci, scope beku.
**Delta PRD:** `docs/PRD.md` §9 — NFR-UI-1, NFR-UI-2, NFR-UI-3.

---

## 1. Keputusan (Decisions)

| # | Keputusan | Catatan |
|---|---|---|
| D1 | Standardisasi design tokens Tailwind v4 sebagai satu-satunya sumber warna/spacing/radius | Menghapus pemakaian palette hardcoded yang mem-bypass token |
| D2 | Konsolidasi komponen dasar bersama untuk **semua** panel role (Button, Modal/Dialog, Card, Badge status, Input) | Panel role tidak lagi punya varian komponen sendiri untuk peran yang sama |
| D3 | Layout mengikuti breakpoint mobile-first dengan **touch target minimum 44×44 px** dan padding/margin seragam | Termasuk panel Owner yang saat ini desktop-berat |
| D4 | Identitas warna antar-role tetap berada dalam **satu keluarga tema brand**, dengan aksen berbeda per role | Jawaban Q2=B → aksen per-role diturunkan dari palet brand |
| D5 | Cakupan pekerjaan: **visual refresh + konsistensi** (bukan consistency-only) | Jawaban Q5=B |
| D6 | Panel Owner dikecualikan dari jaminan touch target 44 px pada perangkat pointer presisi | Jawaban Q4; Owner tetap terikat token & komponen |
| D7 | Implementasi bertahap per role (Customer → Outlet → Courier → Owner) | Jawaban Q1; tiap role satu slice review |

## 2. Action Items

| ID | Action Item | Status | Bukti awal |
|---|---|---|---|
| **DS-1** | Tetapkan palet primer/sekunder global + aksen role (jika ada) dalam design tokens Tailwind v4 | ⬜ Open | §4.1, §4.3 |
| **DS-2** | Reuse komponen dasar bersama (Button, Modal/Dialog, Card, Badge status, Input) di seluruh panel role | ⬜ Open | §4.2 |
| **DS-3** | Rapikan layout: breakpoint mobile-first, touch target min. 44×44 px, konsistensi padding/margin | ⬜ Open | §4.4 |
| **DS-4** | Timeline: draf revisi desain **1 minggu**, implementasi staging **4 minggu** (bertahap per role) | ✅ Terjawab (Q1) | §3 |

## 3. Timeline & Status

| Item | Target | Status |
|---|---|---|
| Draf revisi desain (token, spek komponen, mapping warna) | **1 minggu** sejak Gate 1 | Terkunci |
| Implementasi staging — Customer | minggu ke-2 | Terkunci |
| Implementasi staging — Outlet | minggu ke-3 | Terkunci |
| Implementasi staging — Courier | minggu ke-4 | Terkunci |
| Implementasi staging — Owner | minggu ke-5 | Terkunci |
| **Gate 1 (scope beku)** | **2026-09-17** | ✅ **LULUS** — Q1–Q5 terjawab |

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
- **Q5=B (visual refresh)** menambah satu risko eksplisit: bahasa desain berubah, sehingga tampilan yang sudah disetujui klien sebelumnya akan ikut berubah. Draf 1 minggu (Q1) adalah gerbang review untuk menyetujui arah visual **sebelum** eksekusi dimulai.

---

## 7. Pertanyaan Blocking — TERJAWAB (2026-09-17)

| # | Pertanyaan | Jawaban |
|---|---|---|
| **Q1** | Timeline draf & staging | **Draf 1 minggu; staging 4 minggu**, bertahap per role (D7) |
| **Q2** | Identitas warna per-role | **B — satu keluarga tema brand + aksen berbeda per role** |
| **Q3** | Luas konsolidasi komponen | **B — 5 komponen inti + varian badge/chip/modal/input duplikat + hapus komponen mati** |
| **Q4** | Cakupan panel Owner | **Owner exempt dari 44 px pada pointer presisi**; tetap ikut token & komponen |
| **Q5** | Jenis pekerjaan | **B — visual refresh + konsistensi** |

---

## 8. Status Blocker

| Blocker | Status |
|---|---|
| Gate 1 | ✅ **LULUS 2026-09-17** — Q1–Q5 terjawab, timeline terkunci |
| Implementasi | ✅ Boleh mulai — menunggu rencana implementasi tertulis |

## 9. Langkah Berikutnya

1. ✅ Klien & developer menjawab Q1–Q5.
2. ✅ Delta PRD §9 (NFR-UI-1..3) ditetapkan.
3. ✅ Scope dibekukan → **Gate 1 lulus**.
4. ⬜ Susun `docs/superpowers/plans/` — satu rencana, slice vertikal per role.
5. ⬜ Eksekusi slice Customer (minggu ke-2), review, lalu lanjut role berikutnya.

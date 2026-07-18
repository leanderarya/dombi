# Stitch Prompts — Dombi App Owner Panel

Gunakan `DESIGN.md` sebagai reference design system. Setiap prompt menghasilkan **satu screen prototype**. Semua screen adalah **desktop-first web app** dengan fixed sidebar.

**PENTING — Style Rules untuk semua prompt:**
- Font: Poppins. Primary accent: emerald-700 (#047857). Background: #F6FBF5 (Mint Canvas, bukan putih).
- All status badges: rounded-full, background + text color only. NO border. NO outline. NO ring. Contoh: badge hijau = bg-green-100 text-green-700.
- Primary buttons: OUTLINED only (`border border-primary text-primary`). Jangan filled/solid.
- Tabel pakai `<table>` HTML asli, bukan div flex. Cell padding minimum px-6 py-4.
- No emojis. No dark mode. No gradient text. No neon glow. All copy in Bahasa Indonesia.
- Material Symbols untuk icons (bukan Lucide).

---

---

## Grup 1: Dasbor

### Prompt 1A — Dasbor Owner
```
Generate a DESKTOP web dashboard screen for "Dombi", a goat-milk supply chain management app. The user is the business owner overseeing 12 outlets.

LAYOUT: Fixed left sidebar (w-56, ~224px wide, full height). Sidebar contents:
- Top: brand "Dombi" in emerald-700 (#047857) bold text on white background
- Below brand: user name "Arya Ajisadda" and role "Owner" label
- Navigation groups with icons and labels:
  - Dasbor (grid icon, ACTIVE — highlighted emerald)
  - Operasional (folder icon): Outlet, Pesanan, Pengiriman, Kurir, Return & Tukar, Tier Ongkir
  - Keuangan (dollar icon)
  - Master Data (database icon): Produk, Harga
  - Persediaan (package icon): Inventaris, Restock, Distribusi
  - Analitik (chart icon)
- Bottom section: notification bell icon with red badge "3", "Logout" button, "v1.0.0"

MAIN CONTENT (to the right of sidebar, max-w-7xl, px-6 py-6):

Top section: horizontal KPI strip with 4 stat cards in a row. Each card: a Lucide icon on the left in muted gray circle, a large bold number, and a small muted label below. Cards: "34 Pesanan Hari Ini", "Rp 4.250.000 Pendapatan Hari Ini", "12 Outlet Aktif", "5 Restock Pending".

Middle section: "Stok Kritis" warning card spanning full width. Red-amber left border accent. Lists 3 products critically low across outlets. Each row: product name (bold, "Family — Variant" format), outlet name, "2 pcs" in crisis red (#DC2626), and an "Ingatkan" button with Bell icon.

Bottom half: split into two cards side by side:
- Left card "Pesanan Terbaru" (60% width): table with 5 rows. Columns: Kode (#ORD-001), Pelanggan, Outlet, Total (bold Rp format), Status badge. Rows hover light gray.
- Right card "Aktivitas Outlet" (40% width): 4 outlet cards showing outlet name, order count today, and a green/amber/red health dot indicator.

Font: Poppins. Primary accent: emerald-700 (#047857). Surfaces: white. Muted backgrounds: #F2F2F2. No dark mode. All copy in Bahasa Indonesia.
```

---

## Grup 2: Master Data — Produk

### Prompt 2A — Daftar Produk (Product Families)
```
A DESKTOP product family list screen for Dombi owner panel. Fixed sidebar on left as described in DESIGN.md (Dasbor sidebar with "Master Data > Produk" active).

MAIN CONTENT:
- Page header: "Produk" in large bold Poppins. Subtitle "Kelola kategori dan varian produk susu kambing".
- Top-right: emerald "+ Tambah Keluarga Produk" button.

Below header: filter bar with:
- Search input with Search icon, placeholder "Cari produk...", rounded-[10px]
- Filter pills: "Semua" (active=emerald), "Aktif", "Nonaktif"

Main table (full-width HTML table):
- Columns: "Nama Keluarga", "Brand", "Jumlah Varian", "Status", "Aksi"
- Sortable headers with ▲▼ on active column
- Each row: family name bold, brand muted, variant count, Active/Inactive badge, action buttons (Edit ghost + Hapus ghost)
- Row hover: bg-surface-muted (#F2F2F2)
- Example rows: "Susu Kambing | Dombi | 5 varian | Aktif | [Edit] [Hapus]", "Yogurt | Dombi | 3 varian | Aktif"

Empty state (when no products): centered column with Package icon, "Belum ada produk", "Klik tombol tambah untuk mulai".

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia only.
```

### Prompt 2B — Detail Produk + Varian
```
A DESKTOP product family detail screen for Dombi owner panel. Fixed sidebar on left.

MAIN CONTENT:
- Breadcrumb: "Produk > Susu Kambing" in muted text with chevron separator
- Page header: "Susu Kambing" (large bold) with "Edit" ghost button next to it
- Subtitle line: "Brand: Dombi" and description text "Susu kambing etawa segar"

Below: tab bar with 2 segments — "Varian" (active, white bg), "Riwayat Harga" (muted bg)

Two action buttons above table: "Tambah Varian" (emerald fill) and "Edit Massal" (outline)

Main table for "Varian" tab:
- Columns: "Nama Varian", "SKU", "Size", "Flavor", "HPP", "Harga Jual", "Status", "Aksi"
- Sortable headers
- Each row: variant name bold, SKU in gray, size, flavor, HPP Rp format muted, selling price Rp bold, Active/Inactive toggle switch, Edit button
- Example: "Original | SKU-001 | 250ml | Original | Rp 12.500 | Rp 18.000 | 🟢 | Edit"

When Edit is clicked: MODAL popup (not inline):
- Modal title "Edit Varian — Original"
- Form: Nama, SKU, Size, Flavor, HPP, Harga Jual, Active toggle
- Footer: Cancel (outline) + Simpan (emerald) buttons

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

---

## Grup 3: Master Data — Harga

### Prompt 3A — Harga Pusat
```
A DESKTOP pricing management screen for Dombi owner panel. Fixed sidebar with "Master Data > Harga" active.

MAIN CONTENT:
- Tab bar: "Harga Pusat" (active, emerald-700 text), "Harga Outlet", "Riwayat" — segmented control in bg-surface-muted

KPI strip (4 cards in a row):
- "Total Produk" — Package icon, "28"
- "Rata-rata HPP" — DollarSign icon, "Rp 14.200"
- "Rata-rata Margin" — TrendingUp icon, "Rp 5.800"
- "Margin Negatif" — TrendingDown icon, "0" (red if >0)

Filter bar: search input + margin filter dropdown ("Margin Tinggi", "Margin Rendah", "Margin Negatif")

Full-width table:
- Columns: "Produk", "HPP" (right-aligned, muted), "Harga Jual" (right-aligned, larger bold), "Margin" (with horizontal color bar), "Aksi"
- Sortable headers
- Each row:
  - Product name in bold (Family — Variant format). Below: blue "X override" badge if any outlet has custom price
  - HPP: Rp format, muted text
  - Selling price: Rp format, larger, bold, Deep Ink (#1A1A1A)
  - Margin: horizontal bar showing ratio — green fill for healthy, amber for thin, red for negative. Bar is ~100px wide, 6px tall. Next to bar: "Rp 5.800 (47%)"
  - Action: "Ubah" ghost button
- Row hover: bg-surface-muted

Table has pagination at bottom: "← Sebelumnya | Halaman 1 dari 3 | Selanjutnya →"

Edit modal: opens on "Ubah" click. Title "Edit Harga Pusat — Susu Kambing Original 250ml". Shows current HPP (readonly), Harga Jual input, margin auto-calculated preview. Cancel/Simpan buttons.

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

### Prompt 3B — Harga Outlet (Split Panel)
```
A DESKTOP split-panel pricing screen for individual outlet pricing. Fixed sidebar on left.

LAYOUT: Two panels side by side.

LEFT PANEL (280px wide, border-right):
- Search input at top "Cari outlet...", Search icon
- Scrollable outlet list below. Each outlet card: name in bold, address in small muted text, Active badge. Selected outlet card: emerald-50 background. Unselected: white, hover light gray.
- Example outlets: "Senayan", "Kemang", "BSD", "Depok"

RIGHT PANEL (fills remaining space):
- Header: "Outlet Senayan" in bold
- Two action buttons: "Salin dari Outlet..." (outline, Copy icon) and "Atur Massal" (outline, Plus icon)
- Mini KPI strip (3 items): "Total Produk: 28", "Override: 5", "Rata-rata Margin: Rp 4.800"

Full-width table:
- Columns: "Produk", "HPP", "Harga Jual", "Margin", "Aksi"
- Sortable headers
- Each row:
  - Product name bold + "Custom" info badge (blue) or "Standar" neutral badge (gray)
  - HPP muted
  - Selling price bold (this is the outlet's price — may differ from pusat)
  - Margin bar (same as Pusat tab)
  - Action buttons:
    - "Ubah" ghost button always visible
    - If "Custom" badge: also "Reset" button (RotateCcw icon, red-50 hover) to revert to pusat price
- Row hover: bg-surface-muted

Edit modal: title "Edit Harga Outlet — Susu Kambing Original", shows pusat price as reference in small text, outlet price input field, Cancel/Simpan.

When "Salin dari Outlet..." clicked: modal with outlet dropdown selector, "Salin" button.

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

### Prompt 3C — Perbandingan Harga (Compare View)
```
A DESKTOP price comparison matrix for 2-3 outlets. Fixed sidebar on left.

MAIN CONTENT:
- Page header: "Perbandingan Harga Outlet"
- Subtitle: "Bandingkan harga antar outlet"

Multi-select outlet picker at top: "Pilih outlet untuk dibandingkan" with chips. Shows 3 selected outlets as removable chips: "Senayan ✕", "Kemang ✕", "BSD ✕". Clicking opens dropdown to add more.

Below: matrix table.
- First column (sticky left, white bg): "Produk" — listing variant names in Family — Variant format, bold
- Each subsequent column = one outlet: outlet name as header, selling prices below
- Intersection cells: price in bold Rp. Below price (small text): difference from pusat price — "+Rp 2.000" in blue if higher, "-Rp 1.000" in red if lower, "—" if same
- Rows where ANY outlet differs from pusat: amber-50 (#fef3c7) subtle background highlight

Bottom: "Tutup" button.

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

---

## Grup 4: Persediaan — Inventaris

### Prompt 4A — Inventaris (Tab Outlet — Grouped by Product)
```
A DESKTOP inventory monitoring screen for Dombi owner panel. Fixed sidebar with "Persediaan > Inventaris" active. This is an operational cockpit for tracking product stock across multiple outlets.

MAIN CONTENT:
- Page header: "Inventaris" in bold. Subtitle: "Pantau stok semua outlet dan pusat".
- Tab bar: "Stok Pusat", "Outlet" (active, emerald) — segmented control

KPI strip (4 cards): "Total SKU: 156", "Stok Kritis" (red, "≤ 2 pcs, 8 items"), "Stok Rendah" (amber, "≤ minimum, 23 items"), "Stok Sehat: 125" (emerald)

Filter bar: search input "Cari produk atau outlet..." + outlet dropdown "Semua Outlet"

CORE INNOVATION — EXPANDABLE GROUPED TABLE:
Products are grouped, NOT listed per-outlet (avoids 10× duplication). Each top-level row is ONE PRODUCT with outlets nested inside.

TABLE (full-width):
- Columns: "Produk" (sortable ▲▼), "Status Outlet", "Total Stok" (sortable), "Min", "Status" (sortable), "Aksi"

Each collapsed row shows:
- Col 1: Product name bold + SKU gray. "Susu Kambing — Original 250ml SKU-001"
- Col 2: Aggregate status dots. Small colored circles representing each outlet's stock: green dots for healthy, amber for low, red for critical. E.g. "🟢🟢🟢🟢🟢🟠🟠⚪" — 5 healthy, 2 low, 1 critical. Below dots: "8 outlet · 2 rendah · 1 kritis"
- Col 3: Total available stock across all outlets: "127 pcs" (green if healthy overall)
- Col 4: "10 pcs" (minimum stock threshold)
- Col 5: Overall status badge — "Kritis" (red) if any outlet critical, "Rendah" (amber) if any low, "Sehat" (green)
- Col 6: Expand chevron button ▼

Clicking a row EXPANDS it to reveal a nested sub-table:
- Sub-table columns: "Outlet", "Stok", "Min", "Status", "Aksi"
- Sub-rows (one per outlet):
  - "Senayan" | "23 pcs" (green) | "10" | "Sehat" badge | Edit ghost
  - "Kemang" | "5 pcs" (amber) | "10" | "Rendah" badge | [Ingatkan button] [Edit]
  - "BSD" | "0 pcs" (red) | "10" | "Kritis" badge | [Ingatkan button] [Edit]

"Ingatkan" button: visible only on critical/low sub-rows. Bell icon + text. After clicking, transforms to "✓ Terkirim" green badge.

Edit modal: product name + outlet name. Form: Stok Saat Ini, Stok Minimum, Catatan. Cancel/Update.

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

### Prompt 4B — Stok Pusat
```
A DESKTOP central stock screen for Dombi owner panel. Fixed sidebar on left. "Stok Pusat" tab active.

MAIN CONTENT:
- KPI strip (4 cards): "Total Varian: 28", "Total Stok: 1,240 pcs", "Stok Habis: 3" (red), "Stok Rendah: 5" (amber)

Filter bar: search input "Cari produk atau SKU..." + filter pills: "Semua" (active/emerald), "Habis", "Rendah", "Aman"

Full-width table:
- Columns: "Produk / SKU" (sortable), "Stok" (sortable, right-aligned), "HPP" (sortable, right-aligned), "Status" (sortable), "Aksi"
- Sortable headers with ▲▼

Each row:
- Col 1: family name in Subtle Gray (#A3A3A3), variant name in bold Deep Ink (#1A1A1A), SKU in gray. "Susu Kambing Original 250ml SKU-001"
- Col 2: "45 pcs" in emerald (safe), amber (≤10), or red (≤0). Right-aligned, bold, tabular-nums
- Col 3: "Rp 12.500" muted, right-aligned, tabular-nums
- Col 4: Status badge — "Aman" (mint green bg, dark green text), "Rendah" (amber bg, amber text), "Habis" (red bg, red text)
- Col 5: "Edit" ghost button

Edit modal: title "Edit Stok Pusat — Susu Kambing Original". Shows current stock (readonly in muted box), new stock number input, reason dropdown (Stok Opname, Produk Rusak, Expired, Penerimaan Supplier, Koreksi Manual). Cancel/Simpan buttons.

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

---

## Grup 5: Persediaan — Restock

### Prompt 5A — Daftar Restock
```
A DESKTOP restock request management screen for Dombi owner panel. Fixed sidebar with "Persediaan > Restock" active.

MAIN CONTENT:
- Page header: "Restock" in bold. Subtitle: "Kelola permintaan restock dari outlet".
- Top-right: "+ Buat Restock" emerald button.

KPI strip (4 cards): "Total Request: 28", "Pending: 12" (amber), "Disetujui: 14" (green), "Ditolak: 2" (red)

Filter pills: "Semua" (active), "Pending", "Disetujui", "Ditolak"

Full-width table with sortable headers:
- Columns: "Outlet", "Produk", "Jumlah", "Status", "Tanggal", "Aksi"

Each row:
- Col 1: Outlet name
- Col 2: Product name (Family — Variant bold)
- Col 3: "25 pcs" right-aligned tabular-nums
- Col 4: Status badge — "Pending" (amber bg + amber text), "Disetujui" (green bg + green text), "Ditolak" (red bg + red text)
- Col 5: "2 jam lalu" muted text
- Col 6: Action buttons vary by status:
  - Pending: "Setujui" (emerald ghost) + "Tolak" (red ghost)
  - Disetujui/Ditolak: "Detail" (ghost)

APPROVAL MODAL (on "Setujui" click):
- Header: "Setujui Restock"
- Info: Outlet: Senayan, Produk: Susu Kambing — Original 250ml, Diminta: 50 pcs
- Editable: "Jumlah Disetujui" number input, "Catatan" textarea
- Footer: Batal + Setujui (emerald fill) buttons

REJECTION MODAL (on "Tolak" click):
- Header: "Tolak Restock"
- Required: "Alasan Penolakan" textarea
- Footer: Batal + Tolak (red fill) buttons

CREATE MODAL (on "+ Buat Restock" click):
- Outlet selector dropdown
- Product selector dropdown (grouped by family in optgroups)
- Quantity number input
- Notes textarea
- Footer: Batal + Simpan (emerald)

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

---

## Grup 6: Persediaan — Distribusi

### Prompt 6A — Daftar Distribusi
```
A DESKTOP stock distribution list screen for Dombi owner panel. Fixed sidebar with "Persediaan > Distribusi" active.

MAIN CONTENT:
- Page header: "Distribusi" in bold. Subtitle: "Pantau distribusi stok antar outlet".

KPI strip (3 cards): "Total Distribusi: 42", "Dalam Perjalanan: 8" (blue), "Diterima: 34" (green)

Full-width table with sortable headers:
- Columns: "Dari", "Ke", "Produk", "Jumlah", "Status", "Tanggal", "Aksi"

Each row:
- Col 1: Source outlet name
- Col 2: "→" arrow + destination outlet name
- Col 3: Product name (Family — Variant bold)
- Col 4: "30 pcs" right-aligned
- Col 5: Status badge — "Dikirim" (blue bg, blue text), "Diterima" (green bg, green text), "Dibatalkan" (gray bg, gray text)
- Col 6: "5 jam lalu" muted
- Col 7: "Detail" ghost button

DETAIL MODAL (on "Detail" click):
- Distribution info: Dari Pusat → Outlet Senayan
- Product table: variant name, quantity per product
- Timeline: Dibuat (timestamp), Dikirim (timestamp), Diterima (timestamp)
- Notes section
- Close button

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

---

## Grup 7: Operasional — Pesanan

### Prompt 7A — Daftar Pesanan
```
A DESKTOP orders management screen for Dombi owner panel. Fixed sidebar with "Operasional > Pesanan" active.

MAIN CONTENT:
- Page header: "Pesanan" in bold. Subtitle: "Pantau seluruh pesanan pelanggan".

KPI strip (4 cards): "Pesanan Hari Ini: 34", "Pendapatan: Rp 4.250.000", "Rata-rata: Rp 125.000", "Pending: 8"

Filter pills: "Semua" (active), "Menunggu", "Diproses", "Dikirim", "Selesai", "Dibatalkan"

Filter bar: search "Cari pesanan atau pelanggan..." + outlet dropdown "Semua Outlet"

Full-width table with sortable headers:
- Columns: "Kode", "Pelanggan", "Outlet", "Total", "Status", "Waktu", "Aksi"

Each row:
- Col 1: "#ORD-001" bold
- Col 2: Customer name
- Col 3: Outlet name
- Col 4: "Rp 150.000" bold tabular-nums
- Col 5: Status badge color-coded: "Menunggu" (amber), "Diproses" (blue), "Dikirim" (purple), "Selesai" (green), "Batal" (red), "Expired" (gray) — rounded-full, bg + text, no border
- Col 6: "10 menit lalu" muted
- Col 7: "Detail" ghost button (navigates to detail page, NOT modal)

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

### Prompt 7B — Detail Pesanan
```
A DESKTOP order detail page for Dombi owner panel. Fixed sidebar on left.

MAIN CONTENT:
- Breadcrumb: "Pesanan > #ORD-001" with chevron
- Page header: "Pesanan #ORD-001" bold. Order status badge next to it.

Two-column layout (desktop):

LEFT COLUMN (wider, ~65% width):
- "Item Pesanan" card:
  - Table: "Produk", "Jumlah", "Harga", "Subtotal"
  - Rows: "Susu Kambing — Original 250ml | 2× | Rp 18.000 | Rp 36.000"
  - At bottom: Subtotal, Ongkir, Total (large bold)
- "Catatan Pelanggan" card if any: italic text in muted box

RIGHT COLUMN (~35% width):
- "Info Pesanan" card:
  - Customer name + phone
  - Delivery address with MapPin icon
  - Outlet name
  - Order time: "12:30, 10 Jul 2026"
  - Status badge large (rounded-full, bg + text, no border)
- "Riwayat Status" timeline card (vertical line with dots):
  - 🟢 Pesanan Dibuat — 12:30
  - 🟢 Dikonfirmasi — 12:35
  - 🟢 Kurir Ditugaskan — 12:40
  - 🟢 Pesanan Diambil — 12:55
  - 🔵 Dalam Pengiriman — 13:10 (active, pulsing dot)
  - ⚪ Selesai (pending)

STICKY BOTTOM BAR (if order is pending): "Konfirmasi Pesanan" emerald button + "Tolak Pesanan" red ghost button.

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

---

## Grup 8: Operasional — Outlet

### Prompt 8A — Daftar Outlet
```
A DESKTOP outlet list screen for Dombi owner panel. Fixed sidebar with "Operasional > Outlet" active.

MAIN CONTENT:
- Page header: "Outlet" in bold. Subtitle: "Kelola seluruh outlet Dombi".
- Top-right: "+ Tambah Outlet" emerald button.

Filter bar: search "Cari outlet..." + status pills: "Semua" (active), "Aktif", "Nonaktif"

Outlet CARDS in a grid (3 columns on desktop, gap-4):
Each card (white, rounded-2xl, subtle shadow):
- Top: outlet name bold "Senayan", status badge "Aktif" (green)
- Address in muted text: "Jl. Senayan No. 12, Jakarta Selatan"
- Divider line
- 4 mini stat items in a 2×2 grid:
  - "Pesanan: 156" | "Stok: 45 SKU"
  - "Kurir: 3" | "Rating: 4.8 ⭐"
- Bottom: action buttons row — "Lihat Detail" (emerald ghost), "Edit" (ghost), "Nonaktifkan" (red ghost)

Empty state: Building icon, "Belum ada outlet", "Klik tambah untuk mendaftarkan outlet pertama".

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

### Prompt 8B — Detail Outlet
```
A DESKTOP outlet detail page for Dombi owner panel. Fixed sidebar on left.

MAIN CONTENT:
- Breadcrumb: "Outlet > Senayan"
- Page header: "Outlet Senayan" bold with "Edit" ghost button

Tab bar: "Informasi" (active), "Jam Operasional", "Produk", "Kurir"

INFORMASI TAB:
Two-column layout:
- Left: "Detail Outlet" card: Alamat lengkap, Telepon, Email, Koordinat GPS, Tanggal Bergabung
- Right: "Statistik" card: Total Pesanan: 1,234, Total Pendapatan: Rp 185.000.000, Rating Rata-rata: 4.8/5, Jumlah Kurir: 3
- Below both: mini map placeholder (gray box with MapPin icon centered, "Peta Lokasi Outlet")

JAM OPERASIONAL TAB:
- Table: "Hari", "Buka", "Tutup", "Status"
- Rows: "Senin | 08:00 | 21:00 | Buka", "Minggu | — | — | Libur" (red badge)
- Edit button per row

PRODUK TAB:
- Table: "Produk", "Stok", "Harga", "Status"
- Products assigned to this outlet

KURIR TAB:
- Courier cards with name, phone, status (Online/Offline), delivery count today

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

---

## Grup 9: Operasional — Pengiriman

### Prompt 9A — Daftar Pengiriman
```
A DESKTOP delivery tracking screen for Dombi owner panel. Fixed sidebar with "Operasional > Pengiriman" active.

MAIN CONTENT:
- Page header: "Pengiriman" in bold. Subtitle: "Lacak status pengiriman pesanan".

KPI strip (4 cards): "Pengiriman Aktif: 12", "Selesai Hari Ini: 28", "Gagal: 2" (red), "Return: 1" (amber)

Filter pills: "Semua" (active), "Dijadwalkan", "Diambil", "Dalam Perjalanan", "Selesai", "Gagal"

Filter bar: search + outlet dropdown

Full-width table with sortable headers:
- Columns: "Kode", "Pelanggan", "Outlet", "Kurir", "Status", "Estimasi", "Aksi"

Each row:
- Col 1: "#ORD-001" bold
- Col 2: Customer name
- Col 3: Outlet name
- Col 4: Courier name with Motorcycle icon
- Col 5: Delivery status badge — "Dijadwalkan" (blue bg/text), "Diambil" (indigo bg/text), "Dalam Perjalanan" (orange bg/text, right arrow), "Selesai" (green bg/text, checkmark), "Gagal" (red bg/text)
- Col 6: "13:30 WIB" muted (estimated delivery time)
- Col 7: "Detail" ghost button

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

---

## Grup 10: Keuangan

### Prompt 10A — Dasbor Keuangan
```
A DESKTOP financial overview screen for Dombi owner panel. Fixed sidebar with "Keuangan" active.

MAIN CONTENT:
- Page header: "Keuangan" in bold. Subtitle: "Ringkasan pendapatan dan pembayaran".

Tab bar: "Ringkasan" (active), "Tagihan Outlet", "Pembayaran", "Refund", "Rekening"

RINGKASAN TAB:
4 large KPI cards in a row:
- "Total Pendapatan" — DollarSign icon, "Rp 485.000.000", subtitle "Sepanjang waktu"
- "Pendapatan Bulan Ini" — TrendingUp icon, "Rp 52.300.000", "+12% dari bulan lalu" green
- "Outstanding" — Clock icon, "Rp 8.500.000", "3 outlet belum lunas" amber
- "Refund" — Undo2 icon, "Rp 1.200.000", "2 refund diproses"

Below: two cards side by side (50/50 split):
- Left "Pendapatan per Outlet": simple horizontal bar chart. Outlet names on left, amounts on right. Bars in emerald gradient (darker = higher). Example: Senayan Rp 125jt ████████, Kemang Rp 98jt ██████, BSD Rp 72jt █████
- Right "Transaksi Terbaru": table with Date, Outlet, Type (Pesanan/Settlement/Refund), Amount, Status

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia. Numeric values in tabular-nums.
```

---

## Grup 11: Kurir

### Prompt 11A — Daftar Kurir
```
A DESKTOP courier management screen for Dombi owner panel. Fixed sidebar with "Operasional > Kurir" active.

MAIN CONTENT:
- Page header: "Kurir" in bold. Subtitle: "Kelola kurir pengiriman".
- Top-right: "+ Tambah Kurir" emerald button.

Filter bar: search "Cari kurir..." + status pills: "Semua" (active), "Online", "Offline", "Nonaktif"

Courier CARDS grid (3 columns on desktop):
Each card (white, rounded-2xl, shadow):
- Top row: avatar circle (gray with User icon, 48px) + name bold + status dot (green pulse=Online, gray=Offline, blue=Mengirim)
- Below: phone number in muted text
- "Outlet: Senayan" with building icon
- Divider
- Stats row: "Pengiriman Hari Ini: 5" + "Rating: 4.9 ⭐"
- Action buttons: "Edit" ghost, "Detail" ghost

Cards in various states:
- Card 1: "Budi Santoso" — Online (green pulse), Outlet Senayan, 5 deliveries, 4.9★
- Card 2: "Dewi Lestari" — Mengirim (blue badge), Outlet Kemang, 3 deliveries, 4.8★
- Card 3: "Eko Prasetyo" — Offline (gray), Outlet BSD, 0 deliveries, 4.5★

Empty state: Bike icon, "Belum ada kurir", "Klik tambah untuk mendaftarkan kurir".

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

---

## Grup 12: Return & Tukar

### Prompt 12A — Return & Penukaran
```
A DESKTOP returns & exchanges management screen for Dombi owner panel. Fixed sidebar with "Operasional > Return & Tukar" active.

MAIN CONTENT:
- Page header: "Return & Tukar" in bold. Subtitle: "Kelola pengembalian dan penukaran produk".

Tab bar: "Pengembalian" (active), "Penukaran"

PENGEMBALIAN TAB:
- KPI strip (4 cards): "Total: 18", "Pending: 5" (amber), "Disetujui: 10" (green), "Selesai: 3" (emerald)
- Filter pills: "Semua" (active), "Pending", "Disetujui", "Ditolak", "Diterima", "Selesai"

Full-width table with sortable headers:
- Columns: "Kode", "Pesanan", "Pelanggan", "Produk", "Jumlah", "Alasan", "Status", "Tanggal", "Aksi"

Each row:
- Col 1: "#RET-001" bold
- Col 2: "#ORD-045" linked
- Col 3: Customer name
- Col 4: "Susu Kambing — Original 250ml" bold
- Col 5: "2 pcs" tabular-nums
- Col 6: "Produk rusak saat diterima" muted, truncated
- Col 7: Status badge — "Pending" (amber bg/text), "Disetujui" (green bg/text), "Ditolak" (red bg/text), "Diterima" (blue bg/text), "Selesai" (emerald bg/text)
- Col 8: "1 jam lalu" muted
- Col 9: "Detail" ghost button

DETAIL MODAL: full return info + timeline + product images placeholder + approve/reject buttons if pending.

PENUKARAN TAB: same layout but for exchanges. Kode prefix "#TUK-001".

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

---

## Grup 13: Analitik

### Prompt 13A — Dasbor Analitik
```
A DESKTOP analytics dashboard for Dombi owner panel. Fixed sidebar with "Analitik" active.

MAIN CONTENT:
- Page header: "Analitik" in bold. Subtitle: "Wawasan performa bisnis".
- Top-right: date range picker "10 Jun — 10 Jul 2026"

Tab bar: "Dasbor" (active), "Laporan", "Audit", "Masalah"

DASBOR TAB:
4 KPI cards: "Total Pesanan: 1,234", "Pendapatan: Rp 185.000.000", "Rata-rata: Rp 150.000", "Pelanggan Aktif: 856"

2×2 card grid layout:
- Top-left "Tren Pendapatan" (spans 2 columns): line/area chart showing daily revenue over 30 days. Emerald gradient fill below line, subtle grid. X-axis: dates. Y-axis: Rp values.
- Bottom-left "Pesanan per Outlet" (1 column): horizontal bar chart. Outlet names, bar lengths proportional to order count. "Senayan: 312", "Kemang: 245", etc.
- Bottom-right "Produk Terlaris" (1 column): ranked list of top 5 products. Product name, order count, revenue. #1 highlighted.
- Top-right "Jam Sibuk" (1 column): simple bar chart showing orders by hour. 24 small bars. Peak at 11-13 and 17-19.

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

### Prompt 13B — Laporan
```
A DESKTOP reports screen for Dombi owner panel. Fixed sidebar with "Analitik > Laporan" tab active.

MAIN CONTENT:
- Date range picker "10 Jun — 10 Jul 2026" + outlet filter "Semua Outlet" + "Export" outline button

Report type selector: pills "Ringkasan Harian" (active), "Per Outlet", "Per Produk", "Keuangan"

Below: full-width data table depending on selected type.

"Ringkasan Harian" table:
- Columns: "Tanggal", "Total Pesanan", "Pendapatan", "Rata-rata", "Selesai", "Dibatalkan"
- Rows: one per day, sorted descending
- Footer row: totals in bold

Bottom: two buttons "Export CSV" (outline, Download icon) and "Export PDF" (outline, FileText icon).

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia. Tabular-nums for all numeric columns.
```

---

## Grup 14: Tier Ongkir

### Prompt 14A — Tier Ongkir
```
A DESKTOP delivery tier management screen for Dombi owner panel. Fixed sidebar with "Operasional > Tier Ongkir" active.

MAIN CONTENT:
- Page header: "Tier Ongkir" in bold. Subtitle: "Atur biaya pengiriman berdasarkan jarak".
- Top-right: "+ Tambah Tier" emerald button.

Full-width table:
- Columns: "Nama Tier", "Jarak Min", "Jarak Maks", "Biaya", "Outlet", "Status", "Aksi"

Each row:
- Col 1: Tier name bold — "Zona 1 — Dekat"
- Col 2: "0 km" muted
- Col 3: "3 km" muted
- Col 4: "Rp 5.000" bold tabular-nums
- Col 5: "Senayan, Kemang" (outlet names, truncated if many)
- Col 6: Active/Inactive toggle
- Col 7: "Edit" ghost + "Hapus" red ghost

Empty state: MapPin icon, "Belum ada tier ongkir".

ADD TIER MODAL:
- Form: Nama Tier, Jarak Minimum (km), Jarak Maksimum (km), Biaya (Rp), Outlet (multi-select chips)
- Footer: Batal + Simpan

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

---

## Cara Pakai

1. Upload `DESIGN.md` ke Google Stitch sebagai reference utama
2. Paste prompt satu per satu dari atas ke bawah — **20 prompt**
3. Setiap screen akan konsisten karena mengacu design system yang sama

## Prioritas

Jika waktu terbatas:
1. **Prompt 1A** — Dasbor (wajib)
2. **Prompt 4A** — Inventaris grouped-by-product (solusi 10 outlet)
3. **Prompt 2B** — Detail Produk + Varian
4. **Prompt 3A** — Harga Pusat
5. **Prompt 5A** — Restock

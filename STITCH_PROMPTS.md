# Stitch Prompts — Dombi App Owner Panel

Gunakan `DESIGN.md` sebagai reference design system. Setiap prompt menghasilkan **satu screen prototype**. Semua screen adalah **desktop-first web app** dengan fixed sidebar.

**PENTING — Style Rules untuk semua prompt (berdasarkan DESIGN.md):**

**Font & Layout:**
- Font: Poppins (400 body, 500 labels, 600 headings, 700 KPI numbers). Monospace untuk tabular numbers.
- Desktop-first sidebar layout. Fixed left sidebar (w-56, 224px). Main scrolls independently.
- Sidebar: White surface. Brand "Dombi" at top. Nav groups with icons. Active nav: emerald left border + mint-wash bg. User section at bottom.
- Main content: Mint Canvas (#F6FBF5) with subtle diagonal/radial gradient to #EDF5F0. `max-w-7xl mx-auto` with generous padding (`px-6 py-6`).

**Color Palette:**
- Mint Canvas (#F6FBF5) — page background
- Pure Surface (#FFFFFF) — sidebar, cards, modals
- Soft Cement (#F2F2F2) — table headers, inactive tabs, muted surfaces
- Quiet Border (#E5E5E5) — card borders, table dividers, 1px lines
- Strong Border (#D4D4D4) — active input borders
- Deep Ink (#1A1A1A) — primary text, headings
- Steel Gray (#717171) — secondary text, labels
- Whisper Gray (#A3A3A3) — subtle text, placeholders, SKU codes
- Botanical Emerald (#005D42) — single accent, saturation < 80%
- Deep Emerald (#065F46) — FAB buttons, hover depth
- Mint Wash (#ECFDF5) — active row, selected states, accent backgrounds
- Success Green (#16A34A) — healthy stock, completed
- Amber Alert (#D97706) — warning, low stock, pending
- Crisis Red (#DC2626) — critical stock, rejected, danger
- Signal Blue (#2563EB) — info badges, in-progress, delivery states
- Teal Accent (#0D9488) — chart fills, icon badges, secondary accent
- Lavender Accent (#7C3AED) — tertiary metric icons
- Rose Accent (#E11D48) — alert/warning icons, quaternary accent

**KPI Cards — ENHANCED (LIVE FEEL):**
- Colored icon badge (40×40px rounded-xl) in Teal/Blue/Lavender/Rose per metric
- Big number: `text-2xl font-bold tabular-nums` Deep Ink
- Label: `text-xs` Steel Gray below number
- Trend indicator: Small colored text below label showing change from previous period
  - "+12.5% dari Kemarin" in Success Green
  - "-3.2% dari Kemarin" in Crisis Red
  - "— sama" in Steel Gray
- Sparkline/mini-bar: Optional tiny bar chart (3-4 bars, 60px wide, 20px tall) inside KPI card showing 4-day mini trend. Emerald/Teal fill for positive.
- Horizontal flex row, 3-4 cards. Cards have subtle hover elevation lift.

**Data Visualization:**
- Area Chart: Smooth area curve with gradient fill (Teal Accent #0D9488 at 20% opacity fading to 0%). Grid lines in Whisper Gray 10% opacity. Interactive hover dot + tooltip showing exact value.
- Bar Chart: Horizontal bars in Emerald/Teal, labels left, values right. Animate bars on load (width from 0, spring transition).
- Sparklines: Tiny inline charts (60×20px) inside KPI cards. 4 bars showing recent trend. No labels, pure visual indicator.

**Buttons:**
- Primary: OUTLINED only (`border border-primary text-primary` with `hover:bg-mint-wash`). Tactile: `active:scale-[0.98]`. Spring: `transition-all duration-200 ease-out`.
- Ghost: Text only, no border. `hover:bg-surface-muted transition-colors`.
- FAB: Fixed bottom-right. Circular (w-14 h-14). Deep Emerald fill. White `+` icon. Tooltip on hover. `shadow-2xl`.

**Status Badges:**
- Shape: `rounded-full`, `px-2.5 py-1`, `text-[12px] font-medium`
- NO border. bg + text color only.
- Success: `bg-green-100 text-success`
- Warning: `bg-amber-100 text-warning`
- Danger: `bg-red-100 text-danger`
- Info: `bg-blue-100 text-info`
- Neutral: `bg-gray-100 text-secondary`

**Cards & Surfaces:**
- White surface. `rounded-2xl`. Shadow tinted to green: `shadow-[0_1px_3px_rgba(0,109,50,0.04),0_4px_12px_rgba(0,109,50,0.03)]`.
- Modals: `Dialog` with header + footer.
- Tables: HTML `<table>` elements. Striped headers. Row dividers. Generous cell padding (`px-6 py-4`). Row hover.
- Tabs: Segmented control — `inline-flex rounded-lg bg-surface-muted p-1`.
- Filter Chips: Rounded-full pills. Active: mint-wash bg + emerald text.

**Motion & Interaction:**
- Spring Physics: `transition-all duration-200 ease-out`. No linear easing.
- Button Press: `active:scale-[0.98]`.
- Row Hover: `bg-surface-muted transition-colors`.
- Chart animations: Bars animate width from 0 on load. Area charts fade in.
- Staggered List Reveal: `animation-delay: calc(var(--index) * 50ms)`.
- No perpetual animations. Animate via `transform` and `opacity` only.

**Data Display Patterns:**
- Product Name: Two-line `Family — Variant` bold + `SKU-XXX` muted.
- Stock Display: Color-coded. Right-aligned.
- Currency: `Rp 12.500` format, tabular-nums.
- Trend indicators: "+12.5%" green, "-3.2%" red with small arrow icon.

**General Rules:**
- All status badges: rounded-full, background + text color only. NO border. NO outline. NO ring.
- Tabel pakai `<table>` HTML asli, bukan div flex. Cell padding minimum px-6 py-4.
- No emojis. No dark mode. No gradient text. No neon glow. No serif fonts. No overlapping elements.
- No 3-column equal card layouts. No AI copywriting clichés. No filler UI.
- No generic names — use realistic Indonesian names. No fake round numbers — use organic messy data.
- No inline editing — modal popups only. No dark mode toggle — light only. No flexbox fake tables.
- No badge borders. No cramped table cells. No Indonesian-English mixing — Bahasa Indonesia only.
- No flat white backgrounds — add subtle gradient depth.
- Lucide React untuk icons.

---

---

## Grup 1: Dasbor

### Prompt 1A — Dasbor Owner
```
Generate a DESKTOP web dashboard screen for "Dombi", a goat-milk supply chain management app. The user is the business owner overseeing 12 outlets.

LAYOUT: Fixed left sidebar (w-56, ~224px wide, full height). Sidebar contents:
- Top: brand "Dombi" in Botanical Emerald (#005D42) bold text on white background
- Below brand: user name "Arya Ajisadda" and role "Owner" label
- Navigation groups with icons and labels:
  - Dasbor (LayoutDashboard icon, ACTIVE — emerald left border + Mint Wash #ECFDF5 bg)
  - Operasional (Truck icon): Outlet, Pesanan, Pengiriman, Kurir, Return & Tukar, Tier Ongkir
  - Keuangan (Wallet icon)
  - Master Data (Database icon): Produk, Harga
  - Persediaan (Package icon): Inventaris, Restock, Distribusi
  - Analitik (BarChart3 icon)
- Bottom section: notification bell icon with red badge "3", "Logout" button, "v1.0.0"

MAIN CONTENT (to the right of sidebar, max-w-7xl, px-6 py-6, Mint Canvas #F6FBF5 bg with subtle gradient to #EDF5F0):

GREETING SECTION: Large bold heading "Selamat Pagi, Arya" in Botanical Emerald. Subtitle "Berikut ringkasan kinerja bisnis Dombi Anda hari ini." in Steel Gray.

KPI STRIP — ENHANCED (4 cards in horizontal row):
Each card: White surface, rounded-2xl, green-tinted shadow. Colored icon badge (40×40px rounded-xl) on left, big number in center, label below.
- Card 1: Teal Accent (#0D9488) icon badge (Receipt icon). "Rp 4.250.000" big bold number. "Pendapatan Hari Ini" label. Trend: "+12.5% dari Kemarin" in Success Green. Sparkline: 4 mini bars showing 4-day trend (60px wide, 20px tall, Teal fill).
- Card 2: Signal Blue (#2563EB) icon badge (ShoppingCart icon). "34" big bold number. "Pesanan Hari Ini" label. Trend: "+8 dari Kemarin" in Success Green. Sparkline: 4 mini bars.
- Card 3: Lavender Accent (#7C3AED) icon badge (Store icon). "12" big bold number. "Outlet Aktif" label. Sublabel "Semua beroperasi" in Steel Gray.
- Card 4: Rose Accent (#E11D48) icon badge (AlertTriangle icon). "5" big bold number. "Restock Pending" label. Trend: "+3 menunggu" in Crisis Red. Sparkline: 4 mini bars.

70/30 SPLIT LAYOUT:

LEFT (70%): "Tren Pendapatan" area chart card.
- Header: "Tren Pendapatan" title + subtitle "Total 7 hari: Rp 28.500.000" + segmented tabs [7 Hari | 30 Hari]
- Chart: Smooth area curve with gradient fill (Teal Accent #0D9488 at 20% opacity fading to 0%). Grid lines in Whisper Gray 10% opacity. Interactive hover dot + tooltip showing exact value in dark pill. X-axis: dates. Y-axis: Rp values. Last point pulsing.

RIGHT (30%): Two stacked cards.
- "Stok Kritis" card: Header with red badge count "3". List of 3 products with progress bars showing stock level. Bar color: red (critical), amber (low). Product name bold, stock count right-aligned. "Lihat semua" link at bottom.
- "Tindakan Cepat" card: Header "Tindakan Cepat". List of action items with colored dots (red=restock, amber=return, blue=exchange, violet=settlement). Each row: dot + label + ChevronRight icon. Clickable rows with hover state.

BOTTOM: "Outlet Tertunggak" table card (if any).
- Table: HTML <table>. Columns: Outlet (with avatar circle), Keterlambatan (Clock icon + days), Tagihan (right-aligned, amber), Aksi (Tutup button).
- Row hover: bg-mint-wash.

ALERT BANNER (if critical stock): Red-50 background, AlertTriangle icon, message, link to inventaris.

ALL CLEAR STATE (if no issues): Sparkles icon, "Hari ini tenang", "Semua operasional berjalan lancar".

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia. Tabular-nums for numbers. Spring transitions on interactive elements.
```

---

## Grup 2: Master Data — Produk

### Prompt 2A — Daftar Produk (Product Families)
```
A DESKTOP product family list screen for Dombi owner panel. Fixed sidebar on left as described in DESIGN.md (Dasbor sidebar with "Master Data > Produk" active — Database icon with emerald left border + Mint Wash bg).

MAIN CONTENT (Mint Canvas #F6FBF5 bg):
- Page header: "Produk" in large bold Poppins (Deep Ink). Subtitle "Kelola kategori dan varian produk susu kambing" in Steel Gray.
- Top-right: outlined button "+ Tambah Keluarga Produk" (`border border-primary text-primary` with `hover:bg-mint-wash`, `active:scale-[0.98]`).

Below header: filter bar with:
- Search input with Search icon (Lucide), placeholder "Cari produk...", rounded-[10px], Quiet Border
- Filter chips: Rounded-full pills. "Semua" (active: Mint Wash bg + Botanical Emerald text), "Aktif", "Nonaktif"

Main table (full-width HTML `<table>`):
- Columns: "Nama Keluarga", "Brand", "Jumlah Varian", "Status", "Aksi"
- Table headers: `text-xs font-semibold uppercase tracking-wide`, Soft Cement (#F2F2F2) bg
- Sortable headers with ▲▼ on active column
- Each row: family name bold (Deep Ink), brand muted (Steel Gray), variant count (tabular-nums), Status badge (rounded-full, bg + text, NO border), action buttons (Edit ghost + Hapus ghost)
- Row hover: `bg-surface-muted transition-colors`
- Cell padding: `px-6 py-4`
- Example rows: "Susu Kambing | Dombi | 5 varian | [Aktif badge] | [Edit] [Hapus]", "Yogurt | Dombi | 3 varian | [Aktif badge]"

Empty state (when no products): centered column with Package icon (Lucide), "Belum ada produk", "Klik tombol tambah untuk mulai".

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia only. Green-tinted shadow on cards.
```

### Prompt 2B — Detail Produk + Varian
```
A DESKTOP product family detail screen for Dombi owner panel. Fixed sidebar on left.

MAIN CONTENT (Mint Canvas #F6FBF5 bg):
- Breadcrumb: "Produk > Susu Kambing" in Steel Gray with ChevronRight separator
- Page header: "Susu Kambing" (large bold, Deep Ink) with "Edit" ghost button next to it
- Subtitle line: "Brand: Dombi" and description text "Susu kambing etawa segar" in Steel Gray

Below: segmented tabs `inline-flex rounded-lg bg-surface-muted p-1` — "Varian" (active, white bg), "Riwayat Harga" (muted bg)

Two action buttons above table: "Tambah Varian" (outlined: `border border-primary text-primary`) and "Edit Massal" (ghost)

Main table for "Varian" tab (full-width HTML `<table>`):
- Table headers: `text-xs font-semibold uppercase tracking-wide`, Soft Cement bg
- Columns: "Nama Varian", "SKU", "Size", "Flavor", "HPP", "Harga Jual", "Status", "Aksi"
- Sortable headers with ▲▼
- Each row: variant name bold (Deep Ink), SKU in Whisper Gray, size, flavor, HPP Rp format muted (Steel Gray), selling price Rp bold (Deep Ink), Status badge (rounded-full, bg + text, NO border), Edit ghost button
- Cell padding: `px-6 py-4`
- Row hover: `bg-surface-muted transition-colors`
- Example: "Original | SKU-001 | 250ml | Original | Rp 12.500 | Rp 18.000 | [Aktif badge] | Edit"

When Edit is clicked: MODAL popup (not inline):
- Modal title "Edit Varian — Original"
- White surface, rounded-2xl, green-tinted shadow
- Form: Nama, SKU, Size, Flavor, HPP, Harga Jual, Active toggle
- Footer: Cancel (outline) + Simpan (outlined primary) buttons

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia. Tabular-nums for numbers.
```

---

## Grup 3: Master Data — Harga

### Prompt 3A — Harga Pusat
```
A DESKTOP pricing management screen for Dombi owner panel. Fixed sidebar with "Master Data > Harga" active.

MAIN CONTENT:
- Tab bar: "Harga Pusat" (active, Botanical Emerald text), "Harga Outlet", "Riwayat" — segmented control `inline-flex rounded-lg bg-surface-muted p-1`

KPI STRIP — ENHANCED (4 cards in horizontal row):
Each card: White surface, rounded-2xl, green-tinted shadow. Colored icon badge (40×40px rounded-xl) on left, big number in center, label below.
- "Total Produk" — Teal Accent badge (Package icon), "28" big bold number, label "Total Produk"
- "Rata-rata HPP" — Signal Blue badge (DollarSign icon), "Rp 14.200" big bold number, label "Rata-rata HPP"
- "Rata-rata Margin" — Lavender Accent badge (TrendingUp icon), "Rp 5.800" big bold number, label "Rata-rata Margin"
- "Margin Negatif" — Rose Accent badge (TrendingDown icon), "0" big bold number (Crisis Red if >0), label "Margin Negatif"

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

LEFT PANEL (280px wide, Quiet Border border-right):
- Search input at top "Cari outlet...", Search icon (Lucide)
- Scrollable outlet list below. Each outlet card: name in bold (Deep Ink), address in small muted text (Steel Gray), Status badge (rounded-full, bg + text, NO border). Selected outlet card: Mint Wash (#ECFDF5) background. Unselected: white, hover bg-surface-muted.
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

Multi-select outlet picker at top: "Pilih outlet untuk dibandingkan" with filter chips. Shows 3 selected outlets as removable chips: "Senayan ✕", "Kemang ✕", "BSD ✕". Clicking opens dropdown to add more.

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
- Tab bar: "Stok Pusat", "Outlet" (active, Botanical Emerald text) — segmented control `inline-flex rounded-lg bg-surface-muted p-1`

KPI STRIP — ENHANCED (4 cards):
Each card: White surface, rounded-2xl, green-tinted shadow. Colored icon badge (40×40px rounded-xl) on left, big number in center, label below.
- "Total SKU: 156" — Teal Accent badge (Package icon), big bold number, label "Total SKU"
- "Stok Kritis: 8" — Rose Accent badge (AlertTriangle icon), Crisis Red number, label "Stok Kritis", sublabel "≤ 2 pcs"
- "Stok Rendah: 23" — Amber Alert badge (AlertCircle icon), Amber number, label "Stok Rendah", sublabel "≤ minimum"
- "Stok Sehat: 125" — Success Green badge (CheckCircle icon), green number, label "Stok Sehat"

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
KPI STRIP — ENHANCED (4 cards):
Each card: White surface, rounded-2xl, green-tinted shadow. Colored icon badge (40×40px rounded-xl) on left, big number in center, label below.
- "Total Varian: 28" — Teal Accent badge (Package icon), big bold number, label "Total Varian"
- "Total Stok: 1,240 pcs" — Signal Blue badge (Layers icon), big bold number, label "Total Stok"
- "Stok Habis: 3" — Rose Accent badge (XCircle icon), Crisis Red number, label "Stok Habis"
- "Stok Rendah: 5" — Amber Alert badge (AlertCircle icon), Amber number, label "Stok Rendah"

Filter bar: search input "Cari produk atau SKU..." + filter chips: Rounded-full pills. "Semua" (active: Mint Wash bg + Botanical Emerald text), "Habis", "Rendah", "Aman"

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
- Top-right: outlined button "+ Buat Restock" (`border border-primary text-primary` with `hover:bg-mint-wash`, `active:scale-[0.98]`).

KPI STRIP — ENHANCED (4 cards):
Each card: White surface, rounded-2xl, green-tinted shadow. Colored icon badge (40×40px rounded-xl) on left, big number in center, label below.
- "Total Request: 28" — Teal Accent badge (Package icon), big bold number, label "Total Request"
- "Pending: 12" — Amber Alert badge (Clock icon), Amber number, label "Pending"
- "Disetujui: 14" — Success Green badge (CheckCircle icon), green number, label "Disetujui"
- "Ditolak: 2" — Crisis Red badge (XCircle icon), red number, label "Ditolak"

Filter chips: Rounded-full pills. "Semua" (active: Mint Wash bg + Botanical Emerald text), "Pending", "Disetujui", "Ditolak"

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

## Grup 7: Operasional — Pesanan

### Prompt 7A — Daftar Pesanan
```
A DESKTOP orders management screen for Dombi owner panel. Fixed sidebar with "Operasional > Pesanan" active.

MAIN CONTENT:
- Page header: "Pesanan" in bold. Subtitle: "Pantau seluruh pesanan pelanggan".

KPI STRIP — ENHANCED (4 cards):
Each card: White surface, rounded-2xl, green-tinted shadow. Colored icon badge (40×40px rounded-xl) on left, big number in center, label below.
- "Pesanan Hari Ini: 34" — Teal Accent badge (ShoppingCart icon), big bold number, label "Pesanan Hari Ini"
- "Pendapatan: Rp 4.250.000" — Success Green badge (DollarSign icon), big bold number, label "Pendapatan Hari Ini"
- "Rata-rata: Rp 125.000" — Signal Blue badge (TrendingUp icon), big bold number, label "Rata-rata per Pesanan"
- "Pending: 8" — Amber Alert badge (Clock icon), Amber number, label "Menunggu Proses"

Filter chips: Rounded-full pills. "Semua" (active: Mint Wash bg + Botanical Emerald text), "Menunggu", "Diproses", "Dikirim", "Selesai", "Dibatalkan"

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

STICKY BOTTOM BAR (if order is pending): outlined button "Konfirmasi Pesanan" (`border border-primary text-primary` with `hover:bg-mint-wash`, `active:scale-[0.98]`) + ghost button "Tolak Pesanan" (Crisis Red text, `hover:bg-red-50`).

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia.
```

---

## Grup 8: Operasional — Outlet

### Prompt 8A — Daftar Outlet
```
A DESKTOP outlet list screen for Dombi owner panel. Fixed sidebar with "Operasional > Outlet" active.

MAIN CONTENT:
- Page header: "Outlet" in bold. Subtitle: "Kelola seluruh outlet Dombi".
- Top-right: outlined button "+ Tambah Outlet" (`border border-primary text-primary` with `hover:bg-mint-wash`, `active:scale-[0.98]`).

Filter bar: search "Cari outlet..." + filter chips: Rounded-full pills. "Semua" (active: Mint Wash bg + Botanical Emerald text), "Aktif", "Nonaktif"

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

Tab bar: "Informasi" (active, Botanical Emerald text), "Jam Operasional", "Produk", "Kurir" — segmented control `inline-flex rounded-lg bg-surface-muted p-1`

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

KPI STRIP — ENHANCED (4 cards):
Each card: White surface, rounded-2xl, green-tinted shadow. Colored icon badge (40×40px rounded-xl) on left, big number in center, label below.
- "Pengiriman Aktif: 12" — Signal Blue badge (Truck icon), blue number, label "Pengiriman Aktif"
- "Selesai Hari Ini: 28" — Success Green badge (CheckCircle icon), green number, label "Selesai Hari Ini"
- "Gagal: 2" — Crisis Red badge (XCircle icon), red number, label "Gagal"
- "Return: 1" — Amber Alert badge (RotateCcw icon), amber number, label "Return"

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

Tab bar: "Ringkasan" (active, Botanical Emerald text), "Tagihan Outlet", "Pembayaran", "Refund", "Rekening" — segmented control `inline-flex rounded-lg bg-surface-muted p-1`

RINGKASAN TAB:
KPI STRIP — ENHANCED (4 large cards):
Each card: White surface, rounded-2xl, green-tinted shadow. Colored icon badge (40×40px rounded-xl) on left, big number in center, label below.
- "Total Pendapatan" — Teal Accent badge (DollarSign icon), "Rp 485.000.000" big bold number, label "Total Pendapatan", sublabel "Sepanjang waktu" in Steel Gray
- "Pendapatan Bulan Ini" — Success Green badge (TrendingUp icon), "Rp 52.300.000" big bold number, label "Pendapatan Bulan Ini", trend "+12% dari bulan lalu" in Success Green
- "Outstanding" — Amber Alert badge (Clock icon), "Rp 8.500.000" big bold number, label "Outstanding", sublabel "3 outlet belum lunas" in Amber Alert
- "Refund" — Rose Accent badge (Undo2 icon), "Rp 1.200.000" big bold number, label "Refund", sublabel "2 refund diproses" in Steel Gray

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
- Top-right: outlined button "+ Tambah Kurir" (`border border-primary text-primary` with `hover:bg-mint-wash`, `active:scale-[0.98]`).

Filter bar: search "Cari kurir..." + filter chips: Rounded-full pills. "Semua" (active: Mint Wash bg + Botanical Emerald text), "Online", "Offline", "Nonaktif"

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

Tab bar: "Pengembalian" (active, Botanical Emerald text), "Penukaran" — segmented control `inline-flex rounded-lg bg-surface-muted p-1`

PENGEMBALIAN TAB:
KPI STRIP — ENHANCED (4 cards):
Each card: White surface, rounded-2xl, green-tinted shadow. Colored icon badge (40×40px rounded-xl) on left, big number in center, label below.
- "Total: 18" — Teal Accent badge (Package icon), big bold number, label "Total Pengembalian"
- "Pending: 5" — Amber Alert badge (Clock icon), Amber number, label "Menunggu"
- "Disetujui: 10" — Success Green badge (CheckCircle icon), green number, label "Disetujui"
- "Selesai: 3" — Success Green badge (CheckCircle2 icon), green number, label "Selesai"

Filter chips: Rounded-full pills. "Semua" (active: Mint Wash bg + Botanical Emerald text), "Pending", "Disetujui", "Ditolak", "Diterima", "Selesai"

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

## Grup 13: Keuangan — Refund

### Prompt 13A — Daftar Refund
```
A DESKTOP refund management screen for Dombi owner panel. Fixed sidebar with "Keuangan > Refund" active.

MAIN CONTENT:
- Page header: "Refund" in bold. Subtitle: "Kelola pengembalian dana pelanggan".

Tab bar: "Antrian" (active, Botanical Emerald text), "Riwayat" — segmented control `inline-flex rounded-lg bg-surface-muted p-1`

ANTRIAN TAB:
KPI STRIP — ENHANCED (4 cards):
Each card: White surface, rounded-2xl, green-tinted shadow. Colored icon badge (40×40px rounded-xl) on left, big number in center, label below.
- "Menunggu Data: 3" — Amber Alert badge (Clock icon), Amber number, label "Menunggu Data"
- "Siap Diproses: 5" — Signal Blue badge (CheckCircle icon), blue number, label "Siap Diproses"
- "Sedang Diproses: 2" — Teal Accent badge (Loader icon), Teal number, label "Sedang Diproses"
- "Perlu Tindakan: 1" — Rose Accent badge (AlertTriangle icon), red number, label "Perlu Tindakan"

Queue cards (NOT table): Each card represents one refund request.
- Card: White surface, rounded-2xl, border, p-4
- Top row: Order number bold "#ORD-045" + queue status badge (rounded-full, bg + text, NO border)
- Customer name + phone
- Product: "Susu Kambing — Original 250ml" bold
- Amount: "Rp 75.000" large bold tabular-nums
- Reason: "Produk rusak saat diterima" muted
- Bottom: action buttons vary by queue:
  - "Siap Diproses": "Proses Refund" outlined primary + "Tolak" ghost red
  - "Menunggu Data": "Ingatkan Customer" ghost
  - "Perlu Tindakan": "Lihat Detail" ghost

RIWAYAT TAB:
Filter bar: search "Cari order atau pelanggan..." + date range picker

Full-width table with sortable headers:
- Columns: "Order", "Pelanggan", "Produk", "Jumlah", "Status", "Tanggal", "Aksi"
- Each row:
  - Col 1: "#ORD-045" bold
  - Col 2: Customer name
  - Col 3: Product name bold
  - Col 4: "Rp 75.000" tabular-nums
  - Col 5: Status badge — "Selesai" (green), "Ditolak" (red), "Dibatalkan" (gray)
  - Col 6: "2 hari lalu" muted
  - Col 7: "Detail" ghost button

DETAIL MODAL: Full refund info + timeline + destination (rekening/e-wallet) + approve/reject buttons if pending.

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia. Tabular-nums for amounts.
```

---

## Grup 14: Analitik

### Prompt 13A — Dasbor Analitik
```
A DESKTOP analytics dashboard for Dombi owner panel. Fixed sidebar with "Analitik" active.

MAIN CONTENT:
- Page header: "Analitik" in bold. Subtitle: "Wawasan performa bisnis".
- Top-right: date range picker "10 Jun — 10 Jul 2026"

Tab bar: "Dasbor" (active, Botanical Emerald text), "Laporan", "Audit", "Masalah" — segmented control `inline-flex rounded-lg bg-surface-muted p-1`

DASBOR TAB:
KPI STRIP — ENHANCED (4 cards):
Each card: White surface, rounded-2xl, green-tinted shadow. Colored icon badge (40×40px rounded-xl) on left, big number in center, label below.
- "Total Pesanan: 1,234" — Teal Accent badge (ShoppingCart icon), big bold number, label "Total Pesanan"
- "Pendapatan: Rp 185.000.000" — Success Green badge (DollarSign icon), big bold number, label "Pendapatan"
- "Rata-rata: Rp 150.000" — Signal Blue badge (TrendingUp icon), big bold number, label "Rata-rata per Pesanan"
- "Pelanggan Aktif: 856" — Lavender Accent badge (Users icon), big bold number, label "Pelanggan Aktif"

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

Report type selector: filter chips: Rounded-full pills. "Ringkasan Harian" (active: Mint Wash bg + Botanical Emerald text), "Per Outlet", "Per Produk", "Keuangan"

Below: full-width data table depending on selected type.

"Ringkasan Harian" table:
- Columns: "Tanggal", "Total Pesanan", "Pendapatan", "Rata-rata", "Selesai", "Dibatalkan"
- Rows: one per day, sorted descending
- Footer row: totals in bold

Bottom: two buttons "Export CSV" (outline, Download icon) and "Export PDF" (outline, FileText icon).

Font: Poppins. Colors per DESIGN.md. Bahasa Indonesia. Tabular-nums for all numeric columns.
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

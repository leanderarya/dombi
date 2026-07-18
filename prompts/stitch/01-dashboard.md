# Dashboard Owner — Dombi App (Redesign "Lebih Hidup")

Attach `DESIGN.md` as style reference AND the current dashboard screenshot. Read DESIGN.md first.

---

## Screen: Dasbor Owner — "Lebih Hidup"

```
Redesign the Dombi Owner Dashboard to feel ALIVE and modern, inspired by
premium SaaS analytics dashboards. The attached image shows the current design.
Transform it with live data visualization, trend indicators, and visual depth.

Desktop web app. Fixed left sidebar. All copy in Bahasa Indonesia.
Font: Poppins. Background: Mint Canvas #F6FBF5 with subtle gradient depth.
Primary accent: Botanical Emerald #005D42.
```

---

## LAYOUT

Fixed left sidebar (w-56, 224px, white bg):
- Brand "Dombi" in Botanical Emerald bold
- "Arya Aji Sadda" + "Owner" label
- Navigation groups with Material Symbols icons (24px, 400 weight, 0 fill):
  - Dasbor (active — mint-wash bg, emerald left border accent)
  - Operasional: Outlet, Pesanan, Pengiriman, Kurir, Return & Tukar, Tier Ongkir
  - Keuangan, Master Data, Persediaan, Analitik
- Bottom: notification bell "3" badge, "Keluar", "v1.0.0"

Main content (right of sidebar, Mint Canvas bg with VERY subtle radial gradient deeper at center, max-w-7xl, px-6 py-6):

---

## SECTION 1 — KPI Strip (3 CARDS)

Horizontal row of 3 KPI cards with EQUAL width. Each card:

STRUCTURE PER CARD:
- Top row: Colored icon badge (40×40px, rounded-xl) + metric label in Steel Gray text-xs
- Middle: Big number `text-2xl font-bold tabular-nums` Deep Ink
- Below number: TREND INDICATOR with small arrow + percentage + "dari Kemarin"
- Bottom: MINI SPARKLINE — 4 tiny bars (60px wide, 20px tall) showing recent 4-day trend

CARD 1 — "Total Pendapatan"
- Icon: payments icon in TEAL (#0D9488) bg circle (teal-100 bg, teal-700 icon)
- Value: "Rp 52.300.000"
- Trend: "↑ +12.5% dari Kemarin" in Success Green (#16A34A), text-xs font-medium
- Sparkline: 4 bars, last bar tallest, all teal fill

CARD 2 — "Pesanan Aktif"
- Icon: shopping_cart icon in BLUE (#2563EB) bg circle (blue-100 bg, blue-700 icon)
- Value: "34"
- Trend: "↑ +8.3% dari Kemarin" in Success Green
- Sparkline: 4 bars, upward trend, blue fill

CARD 3 — "Stok Kritis"
- Icon: warning icon in ROSE (#E11D48) bg circle (rose-100 bg, rose-700 icon)
- Value: "8"
- Trend: "↓ +2 dari Kemarin" in Crisis Red (#DC2626) — note: increase in critical is BAD
- Sparkline: 4 bars, last 2 taller (bad trend), rose fill

All cards: white bg, rounded-2xl, green-tinted shadow. Hover: slight elevation lift + brighter shadow. NO border on cards.

---

## SECTION 2 — Main Content (70/30 SPLIT)

Below KPI strip: TWO-COLUMN asymmetric layout.

### LEFT COLUMN (70% width) — Revenue Area Chart

Card header: "Tren Pendapatan" (text-base font-semibold) + date range selector on right: "7 Hari" pill active, "30 Hari" pill

AREA CHART (fill the card, ~250px tall):
- X-axis: 7 days (Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu) in Whisper Gray text-xs
- Y-axis: Rp values on left (Rp 0 to Rp 15jt) in subtle gray, 4 grid lines
- Area fill: Teal Accent #0D9488 at 15% opacity gradient (darker at top, fading to 0% at bottom)
- Line: Teal #0D9488, 2px stroke, smooth curve
- Data points: Small white dots (6px) with Teal border on each day
- HOVER TOOLTIP: On hover, vertical dashed line at cursor + tooltip card showing:
  - Day name
  - Exact value "Rp 8.450.000"
  - Mini label "12 pesanan"

Chart data (organic, not round):
- Senin: Rp 6.200.000
- Selasa: Rp 8.450.000
- Rabu: Rp 5.900.000
- Kamis: Rp 7.800.000
- Jumat: Rp 11.200.000
- Sabtu: Rp 9.600.000
- Minggu: Rp 3.400.000

### RIGHT COLUMN (30% width) — Top Outlets + Quick Actions

Two stacked cards:

TOP CARD — "Outlet Teratas" (50% height of right column):
- Header: "Outlet Teratas" text-sm font-semibold
- Horizontal bar chart, 5 outlets:
  - Outlet name left, revenue right, bar between
  - "Senayan" — Rp 12.5jt — ████████████ (emerald, 90% width)
  - "Kemang" — Rp 8.2jt — ████████ (emerald, 60% width)
  - "BSD" — Rp 6.7jt — ██████ (emerald, 48% width)
  - "Depok" — Rp 4.1jt — ████ (emerald, 30% width)
  - "Bekasi" — Rp 2.8jt — ███ (emerald, 20% width)
- Bars animate on load from 0 to their width (spring transition)

BOTTOM CARD — "Tindakan Cepat" (50% height):
- Header: "Tindakan Cepat" text-sm font-semibold
- 3 quick-action buttons stacked vertically:
  - "5 Restock Menunggu" with Package icon, amber indicator dot
  - "4 Return Menunggu" with RotateCcw icon, rose indicator dot
  - "3 Pembayaran Perlu Verifikasi" with CreditCard icon, blue indicator dot
- Each button: white bg, rounded-lg, hover: bg-surface-muted, full width
- Small colored dot (8px) left of each item as urgency indicator

---

## SECTION 3 — Pesanan Terbaru (Full Width Below)

Section header: "Pesanan Terbaru" + "Lihat Semua →" link in emerald on right.

TABLE (full-width, HTML table):
- Columns: "Kode", "Pelanggan", "Outlet", "Total", "Status", "Waktu"
- 5 rows of recent orders with organic data:

Row 1: #ORD-128 | Budi Santoso | Senayan | Rp 185.500 | Selesai (green badge) | 12 menit lalu
Row 2: #ORD-127 | Siti Nurhaliza | Kemang | Rp 92.000 | Diproses (blue badge) | 25 menit lalu
Row 3: #ORD-126 | Ahmad Dhani | BSD | Rp 245.000 | Dikirim (purple badge) | 1 jam lalu
Row 4: #ORD-125 | Dewi Lestari | Senayan | Rp 78.000 | Menunggu (amber badge) | 2 jam lalu
Row 5: #ORD-124 | Rudi Hartono | Depok | Rp 156.000 | Dibatalkan (red badge) | 3 jam lalu

- Row hover: bg-surface-muted
- Status badges: rounded-full, bg + text, NO BORDER
- "Total" column: bold tabular-nums, right-aligned
- "Waktu" column: muted text

---

## SECTION 4 — Stok Perlu Perhatian (Alert Banner)

Below recent orders: a horizontal alert strip (not a card — a banner with subtle red tint).

- Background: red-50 (#fef2f2), rounded-xl, px-4 py-3
- Left: warning icon (amber) + "8 produk stok kritis — perlu restock segera"
- Right: "Lihat Inventaris →" emerald text link
- Dismissible with X button (top right)

---

## GLOBAL RULES (From DESIGN.md)

- Background: #F6FBF5 (Mint Canvas) with VERY subtle gradient depth. NOT flat.
- Cards: #FFFFFF with green-tinted shadow, rounded-2xl. Hover: elevation lift.
- Font: Poppins (400/500/600/700)
- Primary accent: #005D42 (Botanical Emerald)
- Secondary accents: Teal #0D9488, Blue #2563EB, Rose #E11D48, Lavender #7C3AED
- Text: #1A1A1A (Deep Ink), #717171 (Steel Gray), #A3A3A3 (Whisper Gray)
- Status badges: rounded-full, bg + text only. NO BORDER. NO RING.
- Primary buttons: OUTLINED (border border-primary text-primary)
- Icons: Material Symbols (24px, 400 weight, 0 fill)
- No emojis. No neon glows. No gradient text. No dark mode.
- No border on cards or badges. Use shadow for elevation, tinted to green.
- ALL copy in Bahasa Indonesia.
- No filler text. No AI clichés.
- Data must feel organic, not fake round numbers.
- Spring transitions: transition-all duration-200 ease-out.
- BAR CHARTS: animate from 0 width on load.
- AREA CHART: gradient fill, hover tooltip with dashed vertical line.
- SPARKLINES: tiny 4-bar charts in KPI cards, no labels.
```

---

## WHAT "LEBIH HIDUP" MEANS (From Reference Image)

1. **Colored icon badges** in KPI cards (teal, blue, rose — not just gray)
2. **Trend indicators** on every KPI ("+12.5% dari Kemarin" with arrow)
3. **Mini sparklines** in KPI cards for visual trend at a glance
4. **Interactive area chart** with gradient fill and hover tooltip (not static)
5. **70/30 split layout** — data viz takes center stage, actions on side
6. **Horizontal bar chart** for outlet comparison with animated bars
7. **Subtle background gradient** — not flat white/mint
8. **Hover states that feel premium** — elevation lift, shadow transitions
9. **Organic messy data** — not 50%, 99%, round millions
10. **Color-coded urgency** across the board (red=critical, amber=warning, green=good)

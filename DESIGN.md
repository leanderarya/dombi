# Design System: Dombi App — Owner Panel

## 1. Visual Theme & Atmosphere
A **lively operational dashboard** for goat-milk supply chain management.
- **VARIANCE:** 5 (Offset) — structured asymmetry via split panels, left-aligned data over asymmetric whitespace
- **MOTION:** 4 (Fluid CSS) — spring transitions on interactive elements, subtle staggered list reveals, no perpetual loops
- **DENSITY:** 5 (Daily App Balanced) — data-heavy tables with generous breathing room
- **Mood:** Modern botanical. Soft mint-tinted surfaces with subtle gradient depth. Live data visualizations. Clinical precision softened by emerald warmth. Light mode only.
- **Audience:** Business owner monitoring 10+ outlets. Needs scanability AND visual insight, not just raw tables.

## 2. Color Palette & Roles
- **Mint Canvas** (#F6FBF5) — Primary page background. VERY subtle green tint. Signature color.
- **Mint Gradient** — Background can have a very subtle diagonal or radial gradient: from #F6FBF5 to #EDF5F0. Almost imperceptible but adds depth. 5-10% opacity transition.
- **Pure Surface** (#FFFFFF) — Sidebar, cards, modal backgrounds
- **Soft Cement** (#F2F2F2) — Table headers, inactive tabs, muted surfaces
- **Quiet Border** (#E5E5E5) — Card borders, table row dividers, 1px structural lines
- **Strong Border** (#D4D4D4) — Active input borders
- **Deep Ink** (#1A1A1A) — Primary text, headings, product names
- **Steel Gray** (#717171) — Secondary text, labels, descriptions
- **Whisper Gray** (#A3A3A3) — Subtle text, placeholders, SKU codes
- **Botanical Emerald** (#005D42) — Single accent. Max 1 accent color. Saturation < 80%.
- **Deep Emerald** (#065F46) — FAB buttons, hover depth
- **Mint Wash** (#ECFDF5) — Active row background, selected states, accent backgrounds
- **Success Green** (#16A34A) — Healthy stock, completed status
- **Amber Alert** (#D97706) — Warning status, low stock, pending
- **Crisis Red** (#DC2626) — Critical stock, rejected, danger
- **Signal Blue** (#2563EB) — Info badges, in-progress, delivery states
- **Teal Accent** (#0D9488) — Secondary accent for data viz, chart fills, icon badges
- **Lavender Accent** (#7C3AED) — Tertiary accent for tertiary metric icons
- **Rose Accent** (#E11D48) — Quaternary accent for alert/warning icons

## 3. Typography Rules
- **Primary Font:** `Poppins` — Sans-serif. Weights: 400 (body), 500 (labels), 600 (headings), 700 (KPI numbers).
- **Monospace:** System monospace for tabular numbers in data tables.
- **Scale:**
  - Page title: `text-lg font-bold`
  - Section headers: `text-base font-semibold`
  - Table headers: `text-xs font-semibold uppercase tracking-wide`
  - Body/table data: `text-sm`
  - KPI numbers: `text-2xl font-bold tabular-nums`
  - Trend indicators: `text-xs font-medium` (+X% green, -X% red, = gray)
  - Badges: `text-[12px] font-medium`
  - SKU/metadata: `text-[12px]` muted
- **Anti-Patterns:** No serif fonts. No gradient text. No overlapping text/images.

## 4. Layout Architecture
- **Desktop-first sidebar layout.** Fixed left sidebar (w-56, 224px). Main scrolls independently.
- **Sidebar:** White surface. Brand "Dombi" at top. Navigation groups with icons. Active nav: emerald left border accent + mint-wash background. User section at bottom.
- **Main content:** Mint Canvas (#F6FBF5) with subtle gradient depth. `max-w-7xl mx-auto` with generous padding (`px-6 py-6`).
- **Grid-first layout.** Use CSS Grid (`grid grid-cols-1 lg:grid-cols-2 gap-6`) for split panels.
- **Split panels (70/30 or 60/40):** Left: primary data/chart. Right: secondary info panel.
- **Tables:** HTML `<table>` elements. Striped headers. Row dividers. Generous cell padding (`px-6 py-4`). Row hover.
- **Tabs:** Segmented control — `inline-flex rounded-lg bg-surface-muted p-1`.
- **Filter Chips:** Rounded-full pills. Active: mint-wash bg + emerald text.
- **Cards:** White surface. `rounded-2xl`. Shadow tinted to green: `shadow-[0_1px_3px_rgba(0,109,50,0.04),0_4px_12px_rgba(0,109,50,0.03)]`.
- **Modals:** `Dialog` with header + footer.

## 5. Component Stylings

- **KPI Cards — ENHANCED (LIVE FEEL):**
  - Colored icon badge (40×40px rounded-xl) in Teal/Blue/Lavender/Rose per metric
  - Big number: `text-2xl font-bold tabular-nums` Deep Ink
  - Label: `text-xs` Steel Gray below number
  - **Trend indicator:** Small colored text below label showing change from previous period
    - "+12.5% dari Kemarin" in Success Green
    - "-3.2% dari Kemarin" in Crisis Red
    - "— sama" in Steel Gray
  - **Sparkline/mini-bar:** Optional tiny bar chart (3-4 bars, 60px wide, 20px tall) inside KPI card showing 4-day mini trend. Emerald/Teal fill for positive, muted for flat.
  - Horizontal flex row, 3-4 cards. Cards have subtle hover elevation lift.

- **Data Visualization:**
  - **Area Chart:** Smooth area curve with gradient fill (Teal Accent #0D9488 at 20% opacity fading to 0%). Grid lines in Whisper Gray 10% opacity. Interactive hover dot + tooltip showing exact value.
  - **Bar Chart:** Horizontal bars in Emerald/Teal, labels left, values right. Animate bars on load (width from 0 to value, spring transition).
  - **Sparklines:** Tiny inline charts (60×20px) inside KPI cards. 4 bars showing recent trend. No labels, pure visual indicator.

- **Buttons — PRIMARY (Restrained):**
  - OUTLINED, not filled. `border border-primary text-primary` with `hover:bg-mint-wash`.
  - Tactile feedback: `active:scale-[0.98]`.
  - Spring transition: `transition-all duration-200 ease-out`.

- **Buttons — GHOST:**
  - Text only, no border. `hover:bg-surface-muted transition-colors`.

- **Buttons — FAB:**
  - Fixed bottom-right. Circular (w-14 h-14). Deep Emerald fill. White `+` icon.
  - Tooltip on hover. `shadow-2xl`.

- **Status Badges:**
  - Shape: `rounded-full`, `px-2.5 py-1`
  - Size: `text-[12px] font-medium`
  - **NO border.** bg + text color only.
  - Success: `bg-green-100 text-success`
  - Warning: `bg-amber-100 text-warning`
  - Danger: `bg-red-100 text-danger`
  - Info: `bg-blue-100 text-info`
  - Neutral: `bg-gray-100 text-secondary`

- **Loading States — Skeleton Shimmer:**
  - Skeletal loaders matching exact layout dimensions.
  - Shimmer effect: shifting light reflection.

- **Empty/Error States:** Composed with icon + title + description + CTA.

## 6. Data Display Patterns
- **Product Name:** Two-line: `Family — Variant` bold + `SKU-XXX` muted.
- **Stock Display:** Color-coded. Right-aligned.
- **Currency:** `Rp 12.500` format, tabular-nums.
- **Trend indicators:** "+12.5%" green, "-3.2%" red with small arrow icon.

## 7. Motion & Interaction
- **Spring Physics:** `transition-all duration-200 ease-out`. No linear easing.
- **Button Press:** `active:scale-[0.98]`.
- **Row Hover:** `bg-surface-muted transition-colors`.
- **Chart animations:** Bars animate width from 0 on load. Area charts fade in.
- **Staggered List Reveal:** `animation-delay: calc(var(--index) * 50ms)`.
- **No perpetual animations.** Operational dashboard.
- **Animate exclusively via `transform` and `opacity`.**

## 8. Anti-Patterns (Banned)
1. No emojis anywhere
2. No serif fonts
3. No pure white `#FFFFFF` as page background — use `#F6FBF5` Mint Canvas
4. No pure black `#000000` — use `#1A1A1A` Deep Ink
5. No neon/outer glow shadows — use tinted shadows
6. No oversaturated accents — saturation < 80%
7. No filled primary buttons — use OUTLINED style
8. No gradient text on headings
9. No custom mouse cursors
10. No overlapping elements
11. No 3-column equal card layouts
12. No AI copywriting clichés
13. No filler UI: "Scroll to explore", scroll arrows
14. No generic names — use realistic Indonesian names
15. No fake round numbers — use organic messy data
16. No inline editing — modal popups only
17. No dark mode toggle — light only
18. No flexbox fake tables — use `<table>`
19. **No badge borders**
20. No cramped table cells — minimum `px-6 py-4`
21. No Indonesian-English mixing — Bahasa Indonesia only
22. No flat white backgrounds — add subtle gradient depth

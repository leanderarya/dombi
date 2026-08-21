# Stitch Prompts — Dombi Courier App (Mobile-First)

Gunakan `DESIGN.md` sebagai reference design system. Output = **satu screen prototype per prompt**. Semua screen mengadopsi **mobile-frame discovery UI** (referensi `index.html` Homa), tapi dengan **palette Dombi emerald** dan **konten operasional kurir**. Desain adopsi dari contoh `index.html` (frame, gradient header, chips, carousel card, floating pill bottom nav), BUKAN desktop sidebar.

**MEDIUM — WAJIB untuk SEMUA prompt:**
- Mockup **mobile frame**: `w-full max-w-[390px] h-[844px]`, `rounded-[48px]`, `border-[10px] border-slate-800`, `shadow-2xl`, `overflow-hidden`, `select-none`.
- Background halaman luar: `bg-slate-900`, flex center, padding.
- **iOS status bar** di atas: `9:41` kiri, kanan ikon signal/wifi/battery (SVG).
- **Home indicator notch**: `absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-300 rounded-full`.
- Font **Inter** (400 body, 500 labels, 600 semibold, 700 bold + tabular-nums untuk angka).
- **TIDAK ADA sidebar.** Dengan `flex flex-col justify-between`, header atas fixed, konten scroll (`.no-scrollbar`), bottom nav floating di bawah.

**PALETTE — Dombi Emerald (override warna Homa):**
- Canvas: Mint `#F6FBF5` (menggantikan `bg-canvas #F6F8FD`) dengan subtle gradient
- Primary: Botanical Emerald `#005D42` (menggantikan biru `#2563EB`), hover `#004833`
- Surface: White `#FFFFFF`; Muted `#F2F2F2`; Border `#E5E5E5`
- Ink `#1A1A1A`(text-main); Steel `#717171`(text-muted); Whisper `#A3A3A3`
- Mint Wash `#ECFDF5` (state aktif); Success `#16A34A`; Warning/Amber `#D97706`; Danger `#DC2626`; Info `#2563EB`
- Shadow: berwarna hijau — `0 8px 24px rgba(0, 93, 66, 0.08)` (menggantikan shadow biru Homa)
- Font Inter, angka pakai `tabular-nums`

**WAJIB ikut contoh `index.html`:**
- Header: `bg-gradient-to-b from-primary/20 via-primary/5 to-transparent` (pakai white emerald wash), lokasi + bell dengan red dot notif.
- Search pill `rounded-full` putih.
- **Category chips**: icon bulat `w-[52px] h-[52px] rounded-full bg-white border` + label `text-[11px]`. Hover → `bg-primary text-white`.
- Card: white `rounded-2xl border border-border-subtle shadow-card`
- **Floating pill bottom nav**: `absolute bottom-5 left-4 right-4 bg-white/95 backdrop-blur-md rounded-full py-2.5 px-5 shadow-nav border`, 3 item, icon `w-5 h-5` + label `text-[9px]`, aktif = emerald + `font-bold`.
- `no-scrollbar`, hover `scale-105`, stagger reveal.

**STYLE BUTTON — JANGAN DIRUBAH (ikuti implementasi TSX sekarang):**
- Primary action: **filled emerald** `bg-primary text-white rounded-lg px-4 min-h-11` (touch target ≥44px), `active:opacity-80`.
- Sekunder: **outlined putih** `border border-border bg-white text-text rounded-lg min-h-11`.
- Danger: `bg-red-600 text-white` atau text-red pada action sheet list.
- BUKAN outlined text-only seperti Owner dashboard. BUKAN button model Homa `bg-white text-primary`.
- Semua tombol interaktif touch target minimal **44×44px**.

---

---

## Prompt 1 — Courier Tugas (Dashboard / Home)

```
Generate a MOBILE app screen (iPhone mockup frame) for "Dombi", a goat-milk delivery courier app. The user is a courier, currently ONLINE, receiving delivery tasks.

MEDIUM: Wrap everything in an iPhone mockup — outer bg-slate-900, phone frame w-full max-w-[390px] h-[844px] rounded-[48px] border-[10px] border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between select-none. iOS status bar at top (9:41 + signal/wifi/battery SVGs). Home indicator notch at bottom-center. Font: Inter, tabular-nums for numbers. No app sidebar.

COLORS (Dombi): canvas Mint #F6FBF5 with subtle gradient, primary Botanical Emerald #005D42, white cards, border #E5E5E5, ink text #1A1A1A, steel muted #717171, mint-wash #ECFDF5. Green-tinted shadows (rgba 0,93,66,0.08). No pure black/white backgrounds for canvas.

HEADER (gradient top): bg-gradient-to-b from-emerald-500/20 via-emerald-500/5 to-transparent px-5. Row: welcome greeting "Halo, Ari" (bold, text-main) + subtitle "3 pengiriman menunggu aksi Anda" (text-muted). Right: bell icon button (white circle, w-10 h-10, shadow, border) with small rose notif dot.

AVAILABILITY CARD (big touch target, full width, white rounded-2xl border p-4, green shadow):
- Left: colored status dot (h-3.5 w-3.5 rounded-full) — emerald-500 when online, gray when offline.
- Label bold: "Online" or "Offline".
- Right: toggle button. STYLE = existing TSX: when ONLINE → OUTLINED white (border border-border bg-white text-text rounded-lg min-h-11 px-5 py-3) labeled "Offline". When OFFLINE → FILLED emerald (bg-primary text-white rounded-lg) labeled "Online". Button min-h-11 (touch ≥44px).

STATS STRIP: horizontal flex, 4 equal green/washed tiles (rounded-xl bg-white border, centered): big number tabular-nums bold, tiny uppercase label below. Rows: Pickup (waiting), Antar (in-transit), Selesai (completed today), Gagal (failed — dimmed to 50% opacity when 0). Real organic numbers e.g. 2 / 1 / 5 / 0.

IN TRANSIT LIST — highest priority carousel or stacked (several active cards):
Each task card: white rounded-2xl border p-4, green shadow, tap target. Content:
- Order code bold (e.g. DOM-240715-003)
- Customer name (medium)
- Address line with MapPin icon, line-clamp-1
- Status badge right: rounded-full NO border, bg+text only. "Diantar" = bg-blue-100 text-blue-600.
Tap opens detail screen.

WAITING PICKUP LIST: stacked cards. Each: order code bold, "Outlet: <name>" muted line, StatusBadge right. When age >15 min, small age chip: >30min = bg-red-100 text-red-700 "38m", 16-30min = bg-amber-100 text-amber-700 "22m".

NEEDS ACTION LIST (if any): card with customer name, a red alert reason box (bg-red-50 text-red-700 rounded-lg, AlertTriangle) "Gagal" badge.

COMPLETED TODAY (if any, max 5): header with "Selesai Hari Ini (5)" + "Semua" text link right. Compact rows: order code + customer + "→ <delivered_to>" pill (text-primary bg-primary-light).

EMPTY STATE (no active tasks): centered Package icon muted, "Tidak ada tugas aktif" bold, "Tugas baru akan muncul saat Anda di-assign." muted.

FLOATING BOTTOM NAV (pill): absolute bottom-5 left-4 right-4 bg-white/95 backdrop-blur-md rounded-full py-2.5 px-5 shadow-nav border border-border-subtle flex justify-between. 3 items, icon w-5 h-5 + label text-[9px]:
- "Tugas" (ClipboardList icon) — ACTIVE: emerald text + font-bold
- "Riwayat" (History icon) — muted
- "Profil" (User icon) — muted

Real Indonesian names, organic data, no emojis, no dark mode, Bahasa Indonesia only. Tabs on KPI strip. No pure black.
```

---

---

## Prompt 2 — Courier Riwayat (Deliveries List + Optimasi Rute)

```
Generate a MOBILE app screen (iPhone mockup frame) for "Dombi", goat-milk courier app. Screen = delivery history list with an optional route-optimization feature.

MEDIUM: iPhone mockup — outer bg-slate-900, frame w-full max-w-[390px] h-[844px] rounded-[48px] border-[10px] border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between select-none. iOS status bar top (9:41 + signal/wifi/battery SVGs). Home indicator notch bottom-center. Font Inter, tabular-nums. No sidebar.

COLORS (Dombi): Mint canvas #F6FBF5, primary Botanical Emerald #005D42, white cards, border #E5E5E5, ink #1A1A1A, steel #717171, mint-wash #ECFDF5, green-tinted shadows.

HEADER (gradient): bg-gradient-to-b from-primary/20 via-primary/5 to-transparent px-5 pb-3. Title bold "Riwayat Pengiriman" + subtitle muted "Semua tugas Anda". Right: bell icon white circle w-10 h-10 with rose notif dot.

FILTER CHIPS (horizontal scroll, below header, px-5, white pill chips):
- Row of segmented pills: [Semua (ACTIVE: bg-emerald-600 text-white)] [Menunggu] [Diantar] [Selesai] [Gagal]. Inactive = bg-white border border-border text-steel. Gagal chip shows count badge. Active filter = FILLED emerald pill (this is a filter chip, not a button — no 44px constraint needed, standard chip height).

ROUTE OPTIMIZATION (visible only when there are active/in-progress deliveries — show it):
- Full-width FILLED emerald button (bg-primary text-white rounded-xl px-4 py-3 min-h-11, Route icon): labeled "Optimasi Rute". active:opacity-80.
- When tapped it reveals (show this state in a card below):
  "Ringkasan Rute" card (white rounded-2xl border p-4 green shadow): 3 equal green-tint tiles (bg-mint-wash rounded-lg centered): MapPin "4" / "Stops", Route "18.5" / "KM", Clock "42" / "Menit".
  "Urutan Pengiriman" card: numbered ordered list. Each stop: circle number (w-6 h-6 rounded-full bg-primary text-white text-xs, index 1..n), customer name (medium), address line-clamp-2 muted, order code text-primary, StatusBadge right.

DELIVERY LIST (stacked cards in main scroll area):
Each card: white rounded-2xl border p-4 green shadow, tap → detail.
- Order code bold (e.g. DOM-240715-021)
- Outlet name muted (text-xs)
- Customer name medium
- Address muted text-xs line-clamp-1
- StatusBadge right: rounded-full NO border, bg+text color only.
  - Menunggu = bg-amber-100 text-amber-700
  - Diantar = bg-blue-100 text-blue-600
  - Selesai = bg-green-100 text-green-700
  - Gagal = bg-red-100 text-red-600

EMPTY STATE (no deliveries): centered Truck icon muted, "Belum ada pengiriman" bold, "Pengiriman akan muncul setelah kamu di-assign." muted.

PAGINATION: bottom of list, standard small pagination controls (chevrons + page numbers, muted).

FLOATING BOTTOM NAV (pill): absolute bottom-5 left-4 right-4 bg-white/95 backdrop-blur-md rounded-full py-2.5 px-5 shadow-nav border flex justify-between. 3 items icon w-5 h-5 + label text-[9px]:
- "Tugas" (ClipboardList) — muted
- "Riwayat" (History) — ACTIVE: emerald + font-bold
- "Profil" (User) — muted

Real Indonesian names, organic data, no emojis, no dark mode, Bahasa Indonesia only. Status badge borders NOT allowed.
```

---

---

## Prompt 3 — Courier Detail Pengiriman (Action Flow)

```
Generate a MOBILE app screen (iPhone mockup frame) for "Dombi", goat-milk courier app. Screen = single delivery detail with status timeline and primary action buttons. This state = delivery currently "delivering" (sedang diantar), so the courier can Selesaikan or Gagal.

MEDIUM: iPhone mockup — outer bg-slate-900, frame w-full max-w-[390px] h-[844px] rounded-[48px] border-[10px] border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between select-none. iOS status bar top. Home indicator notch bottom-center. Font Inter, tabular-nums. NO floating bottom nav on this screen (task detail is full-screen workflow).

COLORS (Dombi): Mint canvas #F6FBF5, primary Botaniana Emerald #005D42, white cards, border #E5E5E5, ink #1A1A1A, steel #717171, danger #DC2626, info #2563EB. Green-tinted shadows.

HEADER: compact. Left: back chevron button (white circle w-10 h-10 border shadow). Title bold = order code "DOM-240715-003", subtitle muted = customer name. Right: empty spacing for symmetry.

STATUS BADGE centered under header: "Diantar" = bg-blue-100 text-blue-600 rounded-full px-2.5 py-1 text-xs, NO border.

PENERIMA (Recipient) CARD — white rounded-2xl border p-4 green shadow, label "Penerima":
- Recipient name bold (use customer name if same). "Penerima · Pemesan: <name>" muted if differs.
- Full address text-steel.
- Address detail muted (optional).
- Landmark row: MapPin icon + landmark text muted.
- Notes (optional): bg-muted rounded-md text-xs box.
- QUICK CONTACT — 2 equal buttons side by side, min-h-11 (≥44px touch):
  - WhatsApp: FILLED emerald bg-primary text-white rounded-lg (MessageCircle icon)
  - Telepon: OUTLINED white border border-border bg-white text-text rounded-lg (Phone icon)

MAPS BUTTON (full width): FILLED emerald bg-primary text-white rounded-xl min-h-11 px-4 py-2.5 font-bold, MapPin icon, "Buka di Google Maps". active:opacity-80.

PESANAN CARD — white rounded-2xl border p-4 green shadow, label "Pesanan":
- Outlet row: Store icon + outlet name semibold.
- Items list (space-y-2, text-sm): product_name medium + "x{qty}" muted, right subtotal tabular-nums semibold.
- Divider border-t then "Total" muted left / total bold tabular-nums right.
- Use Rupiah format "Rp 145.000" tabular-nums, organic item quantities.

STATUS TIMELINE — collapsed disclosure card (HTML <details> group rounded-xl border bg-white):
- Summary head: "STATUS PENGIRIMAN" tiny uppercase muted, current step label bold below (here: "Diantar"), ChevronDown right rotates on open.
- Open body — vertical timeline, 4 steps left rail: Ditugaskan, Diambil, Diantar, Selesai.
  - Completed step: filled emerald circle (w-6 h-6 rounded-full bg-primary) + white CheckCircle2 icon, label semibold ink. Connecting rail = bg-primary/20.
  - Current step (Diantar): emerald circle + amber pulse.
  - Future step (Selesai): hollow circle border-gray, label steel.
  - Each step shows a small timestamp+actor muted line when done.

FIXED BOTTOM ACTION BAR (outside scroll, above home indicator): white panel border-t, 2 buttons min-h-11 flex gap-2:
- "Gagal Antar" — OUTLINED DANGER: border border-red-200 bg-white text-red-600 rounded-lg (XCircle icon), flex-1.
- "Selesaikan Pengiriman" — FILLED emerald bg-primary text-white rounded-lg (CheckCircle2 icon), flex-2/flex-1.

Note: also describe the alternate action bar variants as one-liner comments (pickup state shows "Ambil Pesanan" filled + "Tolak" danger; picked_up shows "Mulai Antar"; failed/rejected shows "Kembali ke Outlet" danger filled).

Real Indonesian names, organic data, no emojis, no dark mode, Bahasa Indonesia only. Status badge NO border.
```

---

---

## Prompt 4 — Courier Profil

```
Generate a MOBILE app screen (iPhone mockup frame) for "Dombi", goat-milk courier app. Screen = courier account profile.

MEDIUM: iPhone mockup — outer bg-slate-900, frame w-full max-w-[390px] h-[844px] rounded-[48px] border-[10px] border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between select-none. iOS status bar top. Home indicator notch bottom-center. Font Inter. NO app sidebar.

COLORS (Dombi): Mint canvas #F6FBF5, primary Botanical Emerald #005D42, white cards, border #E5E5E5, ink #1A1A1A, steel #717171. Green-tinted shadows.

HEADER (gradient): bg-gradient-to-b from-primary/20 via-primary/5 to-transparent px-5 pb-4. Title bold "Profil" centered or left.

PROFILE CARD — white rounded-2xl border p-4 green shadow:
- Avatar: circular w-12 h-12 rounded-full bg-emerald-500/10 text-primary, initial letter bold (e.g. "A").
- Name bold text-base (e.g. "Ari Nugroho").
- Role muted text-sm: "Kurir".
- Below: small status row — online/offline dot + label.

(Optional secondary card): courier stats mini-strip — 3 green-tint tiles (bg-mint-wash rounded-lg centered): "Tugas Hari Ini" 12, "Selesai" 9, "Rating" 4.8. Organic numbers.

ACTIONS LIST — white rounded-2xl border, stacked rows, tap target py-3.5:
- Row "Keluar" — LogOut icon + text-red-600 "Keluar" medium. Active:opacity-80.

VERSION: centered tiny text muted bottom: "Dombi v1.2.0".

FLOATING BOTTOM NAV (pill): absolute bottom-5 left-4 right-4 bg-white/95 backdrop-blur-md rounded-full py-2.5 px-5 shadow-nav border flex justify-between. 3 items icon w-5 h-5 + label text-[9px]:
- "Tugas" (ClipboardList) — muted
- "Riwayat" (History) — muted
- "Profil" (User) — ACTIVE: emerald + font-bold

Real, organic data, no emojis, no dark mode, Bahasa Indonesia only.
```

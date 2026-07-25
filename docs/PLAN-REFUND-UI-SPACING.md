# Plan: Refund Customer UI Spacing Fix

**Problem:** `RefundDestinationForm` renders as raw inputs without visual container inside `refund-status-card.tsx` CardContent. Semua sibling blocks (AmountBlock, banner, DestinationSummary) pakai `rounded-xl bg-xxx` — form tampil "telanjang", rhythm pecah.

---

## File 1: `refund-destination-form.tsx`

**1a.** `<form className="space-y-4">` → `<form className="space-y-4.5">`  
Reason: 18px gap antar seksi form vs 16px sebelumnya. Slight breathing room tanpa loncat ke 20px.

**1b.** `<div className="mt-1.5 flex gap-2">` → `<div className="mt-2 flex gap-2">`  
Reason: 8px label-to-toggle standard. Current 6px (mt-1.5) terlalu rapat.

**1c.** `<div className="space-y-3">` → `<div className="space-y-3.5">`  
Reason: 14px antar input group vs 12px sebelumnya. Lebih lega, match `py-3.5` rhythm.

**1d.** Label error positioning: `mt-0.5` → `mt-1`  
Reason: 4px error-below-input jadi 8px — error wrap lebih terbaca.

---

## File 2: `refund-status-card.tsx`

**2a.** Line 64 — wrap form di variant "pending no destination":
```
- <RefundDestinationForm orderId={order_id} />
+ <div className="rounded-xl bg-surface-muted px-4 py-3.5">
+   <RefundDestinationForm orderId={order_id} />
+ </div>
```

**2b.** Lines 92-99 — wrap form di variant "pending + destination, editing":
```
- <RefundDestinationForm ... />
+ <div className="rounded-xl bg-surface-muted px-4 py-3.5">
+   <RefundDestinationForm ... />
+ </div>
```

**2c.** Lines 191-197 — wrap form di variant "rejected can resubmit, resubmitting":
```
- <RefundDestinationForm ... />
+ <div className="rounded-xl bg-surface-muted px-4 py-3.5">
+   <RefundDestinationForm ... />
+ </div>
```

**Result visual per variant:**
```
┌─────────────────────────────────────┐
│ CardHeader: "Informasi Refund"       │  ← section name
├─────────────────────────────────────┤
│ AmountBlock (rounded-xl bg-surface)  │  ← highlight
│   Total Refund: Rpxxx               │
├─ 20px ──────────────────────────────┤
│ banner (rounded-xl bg-amber-50)      │  ← context
│   Masukkan data tujuan...           │
├─ 20px ──────────────────────────────┤
│ ┌─────────────────────────────────┐ │  ← CONTAINER (NEW)
│ │ Form input block                │ │     rounded-xl bg-surface-muted
│ │   Metode Penerimaan Dana        │ │     px-4 py-3.5
│ │   [Bank] [E-Wallet]             │ │
│ │   Nama Bank ...                 │ │
│ │   [Simpan Tujuan Refund]        │ │
│ └─────────────────────────────────┘ │
├─ 20px ──────────────────────────────┤
│ TimelineToggle                      │
└─────────────────────────────────────┘
```

## Execution

1. Edit `refund-destination-form.tsx` — 4 changes (1a, 1b, 1c, 1d)
2. Edit `refund-status-card.tsx` — 3 wrapper insertions (2a, 2b, 2c)
3. Build check: `npm run build`
4. Commit + push

**Impact:** 2 files, ~10 lines changed. No logic/behavior changes.

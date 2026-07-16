# Dombi — Progress Roadmap

**Updated:** 2026-07-16
**Current Branch:** `payment-hardening-track-a` (17 commits ahead of `main`)
**Status:** `main` is production-stable; `payment-hardening-track-a` has unmerged payment + refund + UI work

---

## Quick Status

| Category | Status |
|----------|--------|
| Backend core (orders, products, outlets) | ✅ Done |
| Payment integration (DOKU) | ✅ Done |
| Refund system | ✅ Done |
| Phase 1–4 (ROADMAP.md) | ✅ Done |
| Phase 5 Outlet Features | ⏳ 50% — analytics & reports pages exist, missing CSV export & charts |
| Phase 6 Owner Analytics | ⏳ 70% — KPI cards + charts done, missing ReportController & CSV export |
| Phase 7 Courier Routing | ❌ Not started |
| Phase 8 UI/UX Polish | 🔄 In progress — customer side ~70%, owner desktop ~60%, courier ~0% |
| Phase 9 Production Deploy | ❌ Not started |
| DOKU Payment | ✅ Full — 4 methods, fee absorb <500k, webhook hardening |
| Refund System | ✅ Full — manual owner refund, customer cancel, 2-stage notification |
| Distribusi Stok | ❌ Removed — dihapus dari model, controller, halaman |
| TypeScript | ⚠️ 5 errors in 3 files (track.tsx, outlet/show, product-families/show) — pre-existing, not from current work |
| Build | ✅ Clean — `npm run build` passes |

---

## What's Done

### Phase 1–4: Production Readiness + Settlement + Returns + Inventory (ROADMAP.md)
Status: **✅ Complete** di `main`

All critical/high/medium/low issues from PRD Section 4 fixed:
- Authorization (C1, H1, H2, H18)
- Race conditions (C2, C3, H4)
- Delivery ENUM (C4)
- Scheduler reliability (C8, H20-H23)
- Rate limiting (C7, H3)
- Notification failures (C5, H14-H16)
- Recovery token + indexes (H17, H24-H26)
- Settlement dual-track unification
- Returns/exchange notifications + cancel flow
- Inventory received_notes/damage_notes + low-stock alerts + stock opname

### Payment Hardening (`payment-hardening-track-a` branch)
Status: **✅ Complete — not yet merged to main**

17 commits of payment infrastructure:

```
3e15cde — PaymentStatus enum with terminal guard
60a9c4c — Atomic compare-and-swap payment status transition
1105ce0 — Sync payment_status enum + schema; Order accessor & refundable scope
63e2390 — DokuService uses atomic PaymentStatus transitions
152b95b — Hardened webhook signature with client-id + timestamp freshness
8c5f502 — Retry wrapper for DOKU status checks
8c42e50 — Webhook audit log table + writer
e490d60 — Manual refund columns (proof, refunded_by, reject_reason)
899f3cb — Remove Doku refund API; tighten cancel to pending_confirmation; flag refund_pending
2ffc089 — Transition allowlist + same-status guard to PaymentStatusService
25af699 — Manual owner refund with proof upload + reject
59dcb96 — Customer 2-stage refund notifications (requested + processed)
537d1cd — Customer can cancel paid order in pending_confirmation
96a98de — 4 payment methods + full absorb <500k subtotal + fee breakdown
```

### Owner UI Overhaul (dirty working tree)
- `owner-dashboard.tsx` — new KPI strip, billing hero, action-needed cards
- `owner-sidebar-nav.tsx` — collapsible menu with sub-items, active state
- `owner-page-shell.tsx` — standardized page wrapper
- `owner-layout.tsx` — responsive sidebar + mobile nav
- `owner-kpi-strip.tsx` — key metrics row
- Removed: `owner-segmented-tabs.tsx`, distribution components
- Deleted: `StockDistribution` model, controller, pages, components
- Deleted: `docs/frontend-cleanup-plan.md` (executed)

### Customer UI Polish (today)
- `home.tsx` — Phosphor fill icons (StorefrontFill, TruckFill, etc.), premium icon wrappers
- `home.tsx` icon component: `phosphor-fill.tsx` — zero-hook SVG fill icons
- Dialog/sheet/bottom-sheet overlays: blur reduced to 2px, bg opacity 10-15%

---

## What's In Progress (Working Tree — Dirty)

105 files changed, not committed. Key areas:

### Backend Changes
| File | Change |
|------|--------|
| `CheckoutController.php` | Fee absorb logic: free for <500k subtotal |
| `CustomerProductApiController.php` | New product API endpoint |
| `Owner/DashboardController.php` | Enhanced KPIs for new owner dashboard |
| `Owner/RestockController.php` | After stock distribution removal |
| `RestockService.php` | After stock distribution removal |
| `StockDistributionController.php` | **Deleted** |
| `StockDistribution.php` (model) | **Deleted** |
| `StockDistributionItem.php` (model) | **Deleted** |

### Frontend Changes (Selected)
| File | Change |
|------|--------|
| `customer/home.tsx` | Fill icons, premium wrappers |
| `customer/orders/show.tsx` | Refund UI + payment info |
| `customer/product-detail.tsx` | Aesthetic tweaks |
| `customer/checkout/payment.tsx` | Fee breakdown display |
| `customer/active-order-bar.tsx` | Refund pending states |
| `owner/dashboard.tsx` | Full rebuild |
| `owner-layout.tsx` | Responsive overhaul |
| `owner-sidebar-nav.tsx` | Collapsible nav system |
| `owner/inventories/index.tsx` | After stock distribution removal |
| `owner/restocks/*` | After stock distribution removal |
| `owner/distributions/*` | **Deleted** |
| `ui/dialog.tsx` | Overlay blur fix |
| `ui/sheet.tsx` | Overlay blur fix |
| `ui/bottom-sheet.tsx` | Overlay blur fix |
| `ui/distribution-status-badge.tsx` | **Deleted** |
| `restock-create-modal.tsx` | **Deleted** |
| `vite.config.ts` | chunkSizeWarningLimit bump |

---

## What's NOT Done

### Phase 5: Outlet Features
| Task | Status |
|------|--------|
| Sales Report CSV export | ❌ `ReportController` not created |
| Performance Analytics (charts, KPI) | ⚠️ Pages exist at `outlet/analytics/index.tsx`, missing chart library integration |

### Phase 6: Owner Analytics
| Task | Status |
|------|--------|
| Dashboard charts (line, bar, pie) | ⚠️ KPI cards rebuilt, chart integration not done |
| Report Export (CSV) | ❌ `Owner/ReportController` not created |

### Phase 7: Courier Routing
| Task | Status |
|------|--------|
| Route optimization | ❌ Not started |
| Multi-stop delivery | ❌ Not started |
| Maps integration | ❌ Not started |

### Phase 8: UI/UX Polish
| Task | Status |
|------|--------|
| Outlet bottom navigation | ❌ |
| Outlet card-based layout | ❌ |
| Outlet loading skeletons | ❌ |
| Courier delivery timeline | ❌ |
| Courier UI polish | ❌ |
| Owner desktop tables | 🔄 Some done in dirty tree |
| Shared empty states | ❌ |
| Shared skeleton loaders | ❌ |
| Customer home icons | ✅ Done today |
| Customer modal overlays | ✅ Done today |

### Phase 9: Production Deployment
| Task | Status |
|------|--------|
| Server provisioning | ❌ |
| SSL/domain | ❌ |
| DB migration | ❌ |
| Backup/monitoring | ❌ |
| Load testing | ❌ |
| Go-live | ❌ |

### TypeScript Errors (Pre-existing)
| File | Error |
|------|-------|
| `owner/outlets/show.tsx:72` | `FormDataConvertible` type mismatch |
| `owner/product-families/show.tsx:149` | `setErrors` → `setError` |
| `track.tsx:103` | Possibly null `order` |
| `track.tsx:248-249` | Missing `latitude`/`longitude` on `TrackOrder` |

---

## Recommended Next Actions

### Immediate (this branch)
1. **Commit dirty tree** — split into: payment fee UI, owner dashboard rebuild, stock-distribution removal, customer UI polish
2. **Fix TSC errors** — 5 errors in 3 files, semua pre-existing, low effort
3. **Merge `payment-hardening-track-a` → `main`** — 17 commits behind, payment system complete

### Short-term (next 1-2 weeks)
4. **Phase 5: Outlet analytics charts** — integrate lightweight chart library (recharts)
5. **Phase 6: Owner report export** — `Owner/ReportController` + CSV download
6. **Phase 8: Outlet UI** — bottom nav, card layout, loading skeletons

### Medium-term (2-4 weeks)
7. **Phase 7: Courier routing** — Leaflet maps multi-stop
8. **Phase 8: Courier UI** — delivery timeline, sticky actions
9. **Phase 9: Production deploy** — server, SSL, backup, monitoring

---

## Branch Strategy

```
main ◄─── payment-hardening-track-a (17 commits ahead, payment/refund + dirty UI)
           │
           └── 105 dirty files (owner UI overhaul + customer polish + distribution removal)
```

**Rule:** `main` stays production-stable. All new work merges to `main` only after clean build + test pass.

---

*Generated from `git log`, `git diff --stat`, ROADMAP.md, PRD.md, and DOMBI-FEATURES.md actual state.*

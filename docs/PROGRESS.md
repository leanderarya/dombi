# Dombi — Progress Roadmap

**Updated:** 2026-07-22
**Current Branch:** `main`
**Status:** Production-ready. 791 tests passing. All hardening done. Courier management v2 live.

---

## Quick Status

| Category | Status |
|----------|--------|
| Backend core (orders, products, outlets) | ✅ Done |
| Payment integration (DOKU) | ✅ Done |
| Refund system | ✅ Done |
| Push notification (VAPID + FCM) | ✅ Done — all events, SW handlers, iOS PWA fix |
| Operating hours (WIB) + holidays | ✅ Done — isOpen, nextOpenTime, auto-select OPEN outlet |
| Owner toast UX | ✅ Done — toastMutation helper, 23+ pages |
| Collapsible outlet header | ✅ Done — CollapsedOutletBar + IntersectionObserver |
| Guest cancel hardening | ✅ Done — guest_token (Str::random(32)), hash_equals, confirmation wall |
| Settlement FK + verification | ✅ Done — settlement_payment_allocations junction table |
| Settlement manual allocation UI | ✅ Done — PaymentVerifySheet with per-settlement amount input |
| Delivery ENUM fix | ✅ Done — ENUM → VARCHAR |
| Reconciliation fix | ✅ Done — sign fix + exclude paid settlements |
| Courier Management v2 | ✅ Done — Dombi (Pusat + Outlet) + Eksternal (Gojek/Grab), cost tracking |
| Phase 5 Outlet Features | ✅ Done — recharts, CSV export |
| Phase 6 Owner Analytics | ⏳ 70% — KPI cards done, charts/report partial |
| Phase 7 Courier Routing | ✅ v2 done — Kurir Dombi + Eksternal (not multi-stop routing, per client decision) |
| Phase 8 UI/UX Polish | 🔄 In progress |
| Phase 9 Production Deploy | ❌ Not started |
| TypeScript | ⚠️ 5 errors in 3 files — pre-existing |
| Build | ✅ Clean — `npm run build` passes |
| Test Suite | ✅ 791 tests, 791 passed, 0 failures |

---

## What's Done

### Phase 1: Production Readiness Hardening
✅ Guest cancel: `guest_token` (Str::random(32), ~190 bit), `GuestCancelOrderRequest` with `hash_equals`, React confirmation wall, routes extracted from `auth`
✅ C3 TOCTOU: `lockForUpdate(true)` in `outletHasEnoughStock()`
✅ C9 Settlement FK: `settlement_payment_allocations` junction table with FK constraints
✅ C4 MySQL ENUM: `deliveries.status` ENUM → VARCHAR(50)
✅ C10 Reconciliation: sign fix (+ → -) + exclude paid settlements
✅ Rate limiting: `guest-cancel` 3/min IP + `guest-cancel-token` 10/10min per token

### Phase 2-4: Settlement, Returns, Inventory
✅ Settlement dual-track unification
✅ Returns/exchange notifications + cancel flow
✅ Inventory received_notes/damage_notes + low-stock alerts + stock opname
✅ Settlement manual allocation UI — PaymentVerifySheet with per-settlement amount input

### Phase 5: Push Notification + Operating Hours + Owner UX
✅ Push notification (VAPID + FCM): SW handlers, FcmSender, usePushSubscription hook, all roles
✅ Operating hours (WIB): Outlet::isOpen(), nextOpenTime(), holiday schedule, auto-select OPEN outlet
✅ Owner toast UX: toastMutation helper applied to 23+ pages
✅ Outlet features: recharts analytics, CSV export

### Phase 7: Courier Management v2
✅ Dual courier types: Dombi (Pusat + Outlet, approval workflow) + Eksternal (Gojek/Grab, inline form)
✅ 3 migrations: courier_profiles source, pivot assignments, deliveries eksternal fields
✅ CourierProfile scopes: `pusat()`, `outlet()`, `pending()`, `availableForOutlet()`
✅ DeliveryService: `assignEksternal()` path with order status sync (delivering)
✅ Financial guardrail: real-time margin calculation in assign-courier-sheet
✅ Settlement integration: `total_delivery_fee`, `eksternal_courier_cost`, `eksternal_delivery_count`, `net_delivery_income`
✅ 3 TDD test files: CourierProfileTest, DeliveryExternalCourierTest, SettlementCourierCostTest

### Test Suite Discipline
✅ 122 pre-existing failures eliminated across 30+ test files
✅ StockDistribution dead tests removed, payment_method key fixes, period_start defaults, families assertions, Settlement STATUS_PENDING constant
✅ 791 tests, 0 failures, 0 errors — 100% green

---

## What's NOT Done

### Phase 6: Owner Analytics
| Task | Status |
|------|--------|
| Dashboard charts (line, bar, pie) | ⚠️ KPI cards rebuilt, charts not integrated |
| Report Export (CSV) | ❌ `Owner/ReportController` not created |

### Phase 8: UI/UX Polish
| Task | Status |
|------|--------|
| Outlet bottom navigation | ❌ |
| Outlet card-based layout | ❌ |
| Outlet loading skeletons | ❌ |
| Courier delivery timeline | ❌ |
| Owner desktop tables | 🔄 Partially done |
| Shared empty states | ❌ |
| Shared skeleton loaders | ❌ |

### Phase 9: Production Deployment
| Task | Status |
|------|--------|
| Server provisioning | ❌ |
| SSL/domain | ❌ |
| DB migration | ❌ |
| Backup/monitoring | ❌ |
| Load testing | ❌ |
| Go-live | ❌ |

---

## Recommended Next Actions

1. **Phase 9: Production Deploy** — server, SSL, backup, monitoring, go-live
2. **Phase 6: Owner Analytics** — chart integration, CSV export
3. **Phase 8: UI Polish** — outlet bottom nav, skeleton loaders, empty states

---

## Branch Strategy

```
main (production-stable) — all work merged directly
  ├── Production readiness hardening
  ├── Courier management v2
  └── 791 tests green
```

**Rule:** `main` stays production-stable. All new work must pass `php artisan test` before merge.

---

*Updated: 2026-07-22 | 791 tests passing | 0 failures | Build successful*
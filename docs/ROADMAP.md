# Dombi - Complete Roadmap

**Version:** 3.0
**Date:** 2026-07-22
**Status:** Active — Production Ready

---

## Executive Summary

Roadmap ini mencakup seluruh pengembangan Dombi dari fase awal hingga production deployment.

**Total Timeline:** ~56 hari (8 minggu). Saat ini: Fase 1-5 + Courier Management v2 complete. Fase 6-9 remaining.

---

## Phase Status Overview

| Phase | Focus | Est. | Status |
|-------|-------|------|--------|
| Phase 1 | Production Readiness | 6d | ✅ Done |
| Phase 2 | Settlement & Finance | 7d | ✅ Done |
| Phase 3 | Returns/Exchange | 4d | ✅ Done |
| Phase 4 | Inventory Hardening | 5d | ✅ Done |
| Phase 5 | Outlet Features + Push Notification | 5d | ✅ Done |
| Phase 5a | Push Notification (VAPID + FCM) | 4d | ✅ Done |
| Phase 5b | Operating Hours & Outlet State | 3d | ✅ Done |
| Phase 5c | Owner UX Improvements | 3d | ✅ Done |
| Phase 5d | UI Components | 2d | ✅ Done |
| Phase 6 | Owner Analytics | 5d | ⏳ Partial |
| Phase 7 | Courier Management v2 | 5d | ✅ Done |
| Phase 8 | UI/UX Polish | 16d | ⏳ |
| Phase 9 | Production Deployment | 5d | ❌ Not started |

---

## Phase 1-4: Completed (Critical Fixes & Hardening)

### Phase 1: Production Readiness ✅
Guest cancel: guest_token (Str::random(32)), GuestCancelOrderRequest with hash_equals, React confirmation wall, routes extracted from auth. C3 TOCTOU: lockForUpdate(true) in outletHasEnoughStock. C9 Settlement FK: settlement_payment_allocations junction table. C4 MySQL ENUM: deliveries.status ENUM → VARCHAR. C10 Reconciliation: sign fix + exclude paid settlements.

### Phase 2: Settlement & Finance ✅
Settlement dual-track unification, date filter, dead code cleanup, export/reporting.

### Phase 3: Returns/Exchange ✅
Notifications for all status changes, cancel/withdraw, photo evidence, exchange validation.

### Phase 4: Inventory Hardening ✅
Received_notes/damage_notes, low-stock alerts, stock opname, polymorphic StockMovement.

---

## Phase 5: Outlet Features + Push Notification ✅

### Outlet Features
Sales Report CSV export, Performance Analytics (recharts LineChart + BarChart, KPI cards).

### Push Notification System (VAPID + FCM)
Service Worker push handlers, notificationclick → router.visit(), FcmSender service, PushController for all roles, usePushSubscription hook, iOS PWA user-gesture fix, PushBanner on home/confirm pages.

### Operating Hours (WIB)
Outlet::isOpen() using now('Asia/Jakarta'), nextOpenTime(), holiday schedule, auto-select nearest OPEN outlet, CartController validation, products page disabled items + clock icon when closed.

### Owner UX
toastMutation helper, applied to 23+ owner pages (product-families, finance, returns, exchanges, delivery-tiers, couriers, restocks, outlets, orders, inventories, operating-hours, holiday).

---

## Phase 7: Courier Management v2 ✅

**Dual courier types:**
- Dombi Pusat: Owner rekrut, plot ke multiple outlets via pivot table
- Dombi Outlet: Outlet calonkan → Owner approve → user created
- Eksternal (Gojek/Grab): Inline form pas assign delivery, cost tracking

**Schema:** 3 migrations (courier_profiles source, pivot assignments, deliveries eksternal fields). CourierProfile scopes: pusat, outlet, pending, availableForOutlet. DeliveryService assignEksternal path with order status sync.

**UI:** AssignCourierSheet with Dombi/Eksternal tab switch + financial guardrail (margin warning). Owner courier management page (approve/reject/plot). Outlet my-couriers page (list + nominate).

**Settlement:** total_delivery_fee, eksternal_courier_cost, eksternal_delivery_count, net_delivery_income.

---

## Phase 6: Owner Analytics (5 days) ⏳

**Goal:** Owner memiliki dashboard analitik dan export laporan

### Task 6.1: Dashboard Analytics (3 days)
- Line chart: revenue trend (7 hari, 30 hari)
- Bar chart: perbandingan revenue antar outlet
- KPI cards: total revenue, total orders, active outlets, growth %

### Task 6.2: Report Export (2 days)
- Export settlements (CSV), orders (CSV), inventory (CSV), payments (CSV)
- Filter: periode, outlet, status

---

## Phase 8: UI/UX Polish (16 days) ⏳

### Task 8.1: Outlet UI (5 days)
- Bottom navigation, card-based layout, loading skeletons, sticky actions, empty states

### Task 8.2: Courier UI (3 days)
- Delivery timeline, sticky action buttons, icon alignment, loading skeletons

### Task 8.3: Owner Desktop UI (5 days)
- Desktop tables with sorting/filtering, filter toolbar, responsive breakpoints

### Task 8.4: Shared Components (3 days)
- Standardize empty states, skeleton loaders, status badges, typography

---

## Phase 9: Production Deployment (5 days)

**Goal:** Live di production

| Task | Est. |
|------|------|
| Production environment setup | 1d |
| Database migration & seeding | 0.5d |
| Backup & monitoring setup | 1d |
| Load testing | 1d |
| Documentation & runbook | 1d |
| Go-live & monitoring | 1d |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Test coverage | 791 tests, 0 failures |
| Critical bugs | 0 |
| Order success rate | > 99% |
| Payment verification accuracy | 100% |
| System uptime | > 99.5% |
| Average response time | < 500ms |

---

*Generated: 2026-07-22 | 791 tests passing | 0 failures | Build successful*
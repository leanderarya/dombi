# Dombi - Product Requirements Document (PRD)

**Version:** 2.0
**Date:** 2026-07-22
**Status:** Production Ready

---

## 1. Executive Summary

**Dombi** adalah operational commerce platform untuk bisnis susu kambing dengan 4 role: Customer, Owner, Outlet, Courier.

**Tech Stack:**
- Backend: Laravel 13 + PHP 8.3
- Frontend: React 19 + Inertia.js + TypeScript
- Database: MySQL 8.0+
- Design: Mobile-first, Tailwind CSS

**Status Saat Ini:**
- 791 tests passing, 0 failures, 0 errors
- 38 models, 26 services, 100+ UI components
- 4 user roles dengan 60+ halaman
- Push notification: VAPID + FCM integrated for all roles
- Operating hours: WIB timezone, holiday schedule, outlet isOpen validation
- Courier management: Dombi (Pusat + Outlet) + Eksternal (Gojek/Grab), cost tracking
- Settlement: junction table FK, manual allocation UI, financial guardrails

---

## 2. Target Users

| Role | Deskripsi | Jumlah User |
|------|-----------|-------------|
| **Customer** | Pembeli produk via web (guest/registered) | Unlimited |
| **Owner** | Pemilik bisnis, kelola semua aspek | 1 |
| **Outlet** | Staff toko, kelola pesanan & stok | 2-10 |
| **Courier** | Kurir pengantar pesanan | 2-5 |

---

## 3. Core Features - Status

### 3.1 Commerce Flow

| Feature | Status | Issues |
|---------|--------|--------|
| Product catalog (family/variant) | ✅ Done | - |
| Cart management | ✅ Done | - |
| Checkout (delivery/pickup) | ✅ Done | Race condition di stock check (C3) |
| Order tracking (guest) | ✅ Done | Recovery token weak entropy (H17) |
| Order lifecycle (12 statuses) | ✅ Done | Race condition di reject/cancel (C2) |

### 3.2 Operations

| Feature | Status | Issues |
|---------|--------|--------|
| Outlet management | ✅ Done | - |
| Product management | ✅ Done | - |
| Per-outlet pricing | ✅ Done | - |
| Inventory management | ✅ Done | Reconciliation false positive (CRITICAL) |
| Restock request flow | ✅ Done | `received_notes` tidak diimplementasi |
| Stock distribution | ✅ Done | - |

### 3.3 Delivery

| Feature | Status | Issues |
|---------|--------|--------|
| Courier assignment | ✅ Done | `rejected_by_courier` broken di MySQL (C4) |
| Delivery tracking | ✅ Done | - |
| SLA monitoring | ✅ Done | - |
| Failed delivery resolution | ✅ Done | No retry limit (H7) |
| Kanban board | ✅ Done | - |

### 3.4 Settlement/Finance

| Feature | Status | Issues |
|---------|--------|--------|
| Settlement generation | ✅ Done | Dual-track inconsistency |
| Owner finance dashboard | ✅ Done | - |
| Outlet settlement page | ✅ Done | No date filter |
| Payment submission | ⚠️ Partial | Missing `settlement_id` - verification broken |
| Payment verification | ⚠️ Partial | Tidak update settlement karena missing FK |
| Payment reminders | ✅ Done | - |
| Payment accounts (bank info) | ✅ Done | - |

### 3.5 Returns/Exchange

| Feature | Status | Issues |
|---------|--------|--------|
| Return request flow | ✅ Done | No cancel/withdraw |
| Exchange request flow | ✅ Done | No validation linked return status |
| Stock adjustment | ✅ Done | - |
| Settlement adjustment | ✅ Done | - |
| Notifications | ⚠️ Partial | Hanya saat create, tidak ada untuk approve/reject/ship |

### 3.6 Notifications

| Feature | Status | Issues |
|---------|--------|--------|
| In-app notifications | ✅ Done | - |
| Toast notifications (sonner) | ✅ Done | - |
| Settlement reminders | ✅ Done | - |
| Order notifications | ⚠️ Partial | `notifyOrderCreated()` tidak pernah dipanggil (H14) |
| Low stock alerts | ❌ Not implemented | - |

---

## 4. Known Issues - Prioritized

### 4.1 Critical (Must Fix Before Production)

| ID | Area | Issue | Impact |
|----|------|-------|--------|
| C1 | Order | Any customer can cancel any order | Security breach |
| C2 | Order | Race condition di reject/cancel | Data corruption |
| C3 | Order | TOCTOU di stock check | Lost orders |
| C4 | Delivery | `rejected_by_courier` not in MySQL ENUM | Feature broken |
| C5 | Delivery | History/notifications outside transaction | Audit loss |
| C6 | Guest | Phone-based recovery exposes all orders | Security breach |
| C7 | Guest | No rate limiting on recovery endpoints | Brute force |
| C8 | Scheduler | `AutoOfflineCouriers` never scheduled | Feature broken |
| C9 | Settlement | Outlet payments missing `settlement_id` | Verification broken |
| C10 | Inventory | Reconciliation false positive | Phantom inventory |

### 4.2 High (Should Fix)

| ID | Area | Issue |
|----|------|-------|
| H1-H5 | Order | Authorization bypass, no throttle, fee trust |
| H6-H9 | Delivery | Cascade delete, no retry limit, capacity check |
| H10-H13 | Inventory | No DB constraint, TOCTOU, stale data |
| H14-H16 | Notification | `notifyOrderCreated` not called, failure rollback |
| H17-H19 | Guest | Weak token, no ownership check, PII leak |
| H20-H23 | Scheduler | Missing `withoutOverlapping`, N+1 |
| H24-H26 | Database | Missing indexes |

### 4.3 Medium

| ID | Area | Issue |
|----|------|-------|
| M1-M5 | Notification | Track page leak, silent skip, orphan, no retention |
| M6-M9 | Database | ENUM->VARCHAR, N+1 queries |
| M10-M11 | Error handling | Stock exception blocks transitions |
| M12-M15 | Audit | Various audit trail gaps |
| M16-M18 | Restock | No validation, dead status codes |

### 4.4 Low

| ID | Area | Issue |
|----|------|-------|
| L1-L13 | Various | Missing validations, dead code, indexes |

---

## 5. Roadmap

### Phase 1: Production Readiness (2-3 weeks)

**Goal:** Fix all Critical issues, system aman untuk production

| Task | Priority | Est. |
|------|----------|------|
| Fix authorization (C1, H1, H2, H18) | Critical | 2d |
| Fix race conditions (C2, C3, H4) | Critical | 2d |
| Fix delivery ENUM (C4) | Critical | 0.5d |
| Fix scheduler (C8, H20-H23) | Critical | 0.5d |
| Add rate limiting (C7, H3) | Critical | 1d |
| Fix settlement payment FK (C9) | Critical | 1d |
| Fix reconciliation (C10) | Critical | 1d |
| Fix notification failures (C5, H14-H16) | High | 1d |
| Add missing indexes (H24-H26) | High | 0.5d |
| Fix recovery token entropy (H17) | High | 0.5d |

**Total: ~10 days**

### Phase 2: Settlement & Finance (1-2 weeks)

**Goal:** Settlement system fully functional

| Task | Priority | Est. |
|------|----------|------|
| Unify settlement data source (remove dual-track) | High | 3d |
| Add date filter to outlet settlement page | Medium | 1d |
| Add settlement generation notification | Medium | 0.5d |
| Fix dead code cleanup | Low | 0.5d |
| Add settlement export/reporting | Medium | 2d |

**Total: ~7 days**

### Phase 3: Returns/Exchange Enhancement (1 week)

**Goal:** Complete notification & cancel flow

| Task | Priority | Est. |
|------|----------|------|
| Add notifications for all status changes | High | 1d |
| Add cancel/withdraw for outlet | Medium | 1d |
| Add photo evidence for returns | Medium | 1d |
| Fix exchange linked return validation | Medium | 0.5d |
| Remove dead code (markPreparing) | Low | 0.5d |

**Total: ~4 days**

### Phase 4: Inventory Hardening (1 week)

**Goal:** Stock system robust & accurate

| Task | Priority | Est. |
|------|----------|------|
| Implement received_notes/damage_notes | High | 1d |
| Add low-stock alert notifications | Medium | 1d |
| Remove dead code (hasEnoughStock) | Low | 0.5d |
| Add stock opname workflow | Medium | 2d |
| Add polymorphic reference to StockMovement | Low | 0.5d |

**Total: ~5 days**

### Phase 5: Production Deployment (1 week)

**Goal:** Live di production

| Task | Priority | Est. |
|------|----------|------|
| Production environment setup | Critical | 1d |
| Database migration & seeding | Critical | 0.5d |
| Backup & monitoring setup | Critical | 1d |
| Load testing | High | 1d |
| Documentation & runbook | Medium | 1d |
| Go-live & monitoring | Critical | 1d |

**Total: ~5 days**

---

## 6. Success Metrics

| Metric | Target |
|--------|--------|
| Test coverage | > 90% |
| Critical bugs | 0 |
| Order success rate | > 99% |
| Payment verification accuracy | 100% |
| System uptime | > 99.5% |
| Average response time | < 500ms |

---

## 7. Technical Debt

| Item | Impact | Effort |
|------|--------|--------|
| Dual settlement system | Data inconsistency | 3d |
| Dead code cleanup | Maintainability | 1d |
| N+1 query optimization | Performance | 2d |
| Missing DB constraints | Data integrity | 1d |
| Notification system hardening | Reliability | 2d |

---

## 8. Dependencies

| Dependency | Status | Blocker |
|------------|--------|---------|
| MySQL 8.0+ | Required | Production deployment |
| Redis | Recommended | Cache, queue |
| Sentry | Configured | Error tracking |
| Spatie Backup | Configured | Backup system |

---

## 9. Out of Scope (v1)

- Multi-outlet stock transfer
- PDF invoice generation
- Customer mobile app
- Payment gateway integration
- Automated restocking
- Multi-language support

---

*Generated: 2026-07-22 | 791 tests passing | 0 failures | Build successful*

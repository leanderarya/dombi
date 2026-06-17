# Dombi - Complete Roadmap

**Version:** 2.0
**Date:** 2026-06-17
**Status:** Active

---

## Executive Summary

Roadmap ini mencakup seluruh pengembangan Dombi dari fase awal hingga production deployment.

**Total Timeline:** ~56 hari (8 minggu)

---

## Phase Status Overview

| Phase | Focus | Est. | Status |
|-------|-------|------|--------|
| Phase 1 | Production Readiness | 6d | ✅ Done |
| Phase 2 | Settlement & Finance | 7d | ✅ Done |
| Phase 3 | Returns/Exchange | 4d | ✅ Done |
| Phase 4 | Inventory Hardening | 5d | ✅ Done |
| Phase 5 | Outlet Features | 5d | ⏳ Next |
| Phase 6 | Owner Analytics | 5d | ⏳ |
| Phase 7 | Courier Routing | 3d | ⏳ |
| Phase 8 | UI/UX Polish | 16d | ⏳ |
| Phase 9 | Production Deployment | 5d | ⏳ |

---

## Phase 1-4: Completed (Critical Fixes & Hardening)

### Phase 1: Production Readiness ✅

**Goal:** Fix all Critical and High severity issues

| Task | Issues Fixed | Status |
|------|--------------|--------|
| Fix CancelOrderRequest authorization | C1 | ✅ |
| Fix OrderController & AddressController ownership | H1, H2, H18 | ✅ |
| Fix race conditions in OrderStatusService | C2 | ✅ |
| Fix delivery ENUM (rejected_by_courier) | C4 | ✅ |
| Fix scheduler reliability | C8, H20-23 | ✅ |
| Add rate limiting | C7, H3 | ✅ |
| Fix notification failures | C5, H14, H16 | ✅ |
| Fix settlement payment FK | C9 | ✅ |
| Fix reconciliation false positive | C10 | ✅ |
| Fix recovery token & indexes | H17, H24-26 | ✅ |

### Phase 2: Settlement & Finance ✅

**Goal:** Settlement system fully functional

| Task | Status |
|------|--------|
| Unify settlement data source (remove dual-track) | ✅ |
| Add date filter to outlet settlement page | ✅ |
| Add settlement generation notification | ✅ |
| Fix dead code cleanup | ✅ |
| Add settlement export/reporting | ✅ |

### Phase 3: Returns/Exchange ✅

**Goal:** Complete notification & cancel flow

| Task | Status |
|------|--------|
| Add notifications for all status changes | ✅ |
| Add cancel/withdraw for outlet | ✅ |
| Add photo evidence for returns | ✅ |
| Fix exchange linked return validation | ✅ |
| Remove dead code (markPreparing) | ✅ |

### Phase 4: Inventory Hardening ✅

**Goal:** Stock system robust & accurate

| Task | Status |
|------|--------|
| Implement received_notes/damage_notes | ✅ |
| Add low-stock alert notifications | ✅ |
| Remove dead code (hasEnoughStock) | ✅ |
| Add stock opname workflow | ✅ |
| Add polymorphic reference to StockMovement | ✅ |

---

## Phase 5: Outlet Features (5 days)

**Goal:** Outlet memiliki laporan dan analitik untuk monitoring bisnis

### Task 5.1: Sales Report Export (2 days)

**Priority:** High
**Files:**
- Create: `app/Http/Controllers/Outlet/ReportController.php`
- Create: `resources/js/pages/outlet/reports/index.tsx`
- Modify: `routes/web.php`

**Description:**
Export laporan penjualan outlet dalam format CSV dengan filter periode.

**Features:**
- Filter: hari ini, minggu ini, bulan ini, custom range
- Kolom: tanggal, produk, variant, qty, revenue, margin
- Format: CSV download
- Endpoint: `GET /outlet/reports/sales/export`

**Acceptance Criteria:**
- [ ] Outlet bisa filter berdasarkan periode
- [ ] CSV berisi semua kolom yang diperlukan
- [ ] Data sesuai dengan order yang completed
- [ ] Hanya menampilkan data outlet sendiri

### Task 5.2: Performance Analytics (3 days)

**Priority:** High
**Files:**
- Create: `app/Http/Controllers/Outlet/AnalyticsController.php`
- Create: `resources/js/pages/outlet/analytics/index.tsx`
- Modify: `routes/web.php`

**Description:**
Dashboard analitik untuk outlet dengan grafik dan statistik performa.

**Features:**
- Line chart: trend penjualan (7 hari, 30 hari)
- Bar chart: produk terlaris (top 5)
- KPI cards: total revenue, total orders, avg order value, top product
- Filter: hari ini, minggu ini, bulan ini

**Acceptance Criteria:**
- [ ] Grafik menampilkan data dengan benar
- [ ] KPI cards menampilkan statistik aktual
- [ ] Filter berfungsi untuk semua opsi
- [ ] Responsive untuk mobile

---

## Phase 6: Owner Analytics (5 days)

**Goal:** Owner memiliki dashboard analitik dan export laporan

### Task 6.1: Dashboard Analytics (3 days)

**Priority:** High
**Files:**
- Modify: `app/Http/Controllers/Owner/DashboardController.php`
- Modify: `resources/js/pages/owner/dashboard/index.tsx`

**Description:**
Enhanced dashboard dengan grafik revenue, perbandingan outlet, dan trend.

**Features:**
- Line chart: revenue trend (7 hari, 30 hari)
- Bar chart: perbandingan revenue antar outlet
- Pie chart: distribusi penjualan per kategori
- KPI cards: total revenue, total orders, active outlets, growth %

**Acceptance Criteria:**
- [ ] Grafik menampilkan data aktual
- [ ] Perbandingan outlet akurat
- [ ] Filter periode berfungsi
- [ ] Responsive untuk desktop dan mobile

### Task 6.2: Report Export (2 days)

**Priority:** Medium
**Files:**
- Create: `app/Http/Controllers/Owner/ReportController.php`
- Create: `resources/js/pages/owner/reports/index.tsx`
- Modify: `routes/web.php`

**Description:**
Export laporan lengkap untuk semua data bisnis.

**Features:**
- Export settlements (CSV)
- Export orders (CSV)
- Export inventory (CSV)
- Export payments (CSV)
- Filter: periode, outlet, status

**Acceptance Criteria:**
- [ ] Semua data bisa di-export
- [ ] Filter berfungsi dengan benar
- [ ] Format CSV konsisten
- [ ] Download berfungsi

---

## Phase 7: Courier Routing (3 days)

**Goal:** Kurir memiliki rute pengiriman yang optimal

### Task 7.1: Route Optimization (3 days)

**Priority:** Medium
**Files:**
- Create: `app/Services/RoutingService.php`
- Modify: `app/Http/Controllers/Courier/DeliveryController.php`
- Modify: `resources/js/pages/courier/deliveries/index.tsx`

**Description:**
Sistem routing untuk mengoptimalkan urutan pengiriman multi-stop.

**Features:**
- Hitung rute optimal berdasarkan lokasi
- Multi-stop delivery sequence
- Maps integration dengan Leaflet
- Reorder stops berdasarkan jarak

**Acceptance Criteria:**
- [ ] Rute dihitung berdasarkan jarak terdekat
- [ ] Multi-stop berfungsi dengan benar
- [ ] Maps menampilkan rute
- [ ] Kurir bisa reorder manual

---

## Phase 8: UI/UX Polish (16 days)

**Goal:** Konsistensi UI/UX di semua role

### Task 8.1: Outlet UI (5 days)

**Priority:** Medium
**Files:**
- Modify: `resources/js/layouts/outlet-layout.tsx`
- Modify: `resources/js/pages/outlet/inventory.tsx`
- Modify: `resources/js/pages/outlet/orders/index.tsx`

**Description:**
Perbaikan UI outlet untuk mobile-first experience.

**Changes:**
- Tambah bottom navigation (seperti customer)
- Replace tables dengan card-based layout
- Tambah sticky action buttons
- Tambah loading skeletons
- Standardize empty states

**Acceptance Criteria:**
- [ ] Bottom navigation berfungsi
- [ ] Semua table diganti cards
- [ ] Action buttons sticky di bawah
- [ ] Loading states konsisten

### Task 8.2: Courier UI (3 days)

**Priority:** Medium
**Files:**
- Modify: `resources/js/layouts/courier-layout.tsx`
- Modify: `resources/js/pages/courier/deliveries/show.tsx`

**Description:**
Perbaikan UI courier untuk pengalaman mobile yang lebih baik.

**Changes:**
- Tambah delivery timeline (seperti customer order)
- Tambah sticky action buttons
- Align icons dan sheets dengan customer style
- Tambah loading skeletons

**Acceptance Criteria:**
- [ ] Delivery timeline menampilkan status history
- [ ] Action buttons sticky
- [ ] Icons konsisten
- [ ] Loading states ada

### Task 8.3: Owner Desktop UI (5 days)

**Priority:** Medium
**Files:**
- Modify: `resources/js/layouts/owner-layout.tsx`
- Modify: `resources/js/pages/owner/orders/index.tsx`
- Modify: `resources/js/pages/owner/deliveries/index.tsx`

**Description:**
Optimasi UI owner untuk desktop experience.

**Changes:**
- Desktop table views dengan sorting/filtering
- Filter toolbar di atas tabel
- Desktop header dengan page actions
- Responsive breakpoints

**Acceptance Criteria:**
- [ ] Tables berfungsi di desktop
- [ ] Filters mudah diakses
- [ ] Header menampilkan actions
- [ ] Responsive untuk mobile

### Task 8.4: Shared Components (3 days)

**Priority:** Low
**Files:**
- Modify: `resources/js/components/ui/empty-state.tsx`
- Create: `resources/js/components/ui/skeleton.tsx`

**Description:**
Standardisasi komponen shared di semua role.

**Changes:**
- Standardize empty states dengan icon dan message
- Tambah skeleton loading components
- Standardize status badges
- Consistent spacing dan typography

**Acceptance Criteria:**
- [ ] Empty states konsisten
- [ ] Skeleton loaders ada di semua page
- [ ] Status badges konsisten
- [ ] Typography konsisten

---

## Phase 9: Production Deployment (5 days)

**Goal:** Live di production

### Task 9.1: Production Environment Setup (1 day)

**Priority:** Critical
**Description:**
Setup environment production.

**Checklist:**
- [ ] Server provisioning (VPS/cloud)
- [ ] Domain & SSL setup
- [ ] PHP 8.3+ installation
- [ ] MySQL 8.0+ setup
- [ ] Redis setup
- [ ] Nginx/Apache configuration

### Task 9.2: Database & Seeding (0.5 day)

**Priority:** Critical
**Description:**
Deploy database dan seed data awal.

**Checklist:**
- [ ] Run migrations di production DB
- [ ] Seed data produk
- [ ] Seed data outlet
- [ ] Seed data user (owner, outlet, courier)
- [ ] Verify data integrity

### Task 9.3: Backup & Monitoring (1 day)

**Priority:** Critical
**Description:**
Setup backup dan monitoring.

**Checklist:**
- [ ] Configure Spatie backup
- [ ] Setup daily backup schedule
- [ ] Configure Sentry error tracking
- [ ] Setup uptime monitoring
- [ ] Test restore procedure

### Task 9.4: Load Testing (1 day)

**Priority:** High
**Description:**
Test performa under load.

**Checklist:**
- [ ] Test concurrent users (50-100)
- [ ] Test order flow under load
- [ ] Test payment flow under load
- [ ] Identify bottlenecks
- [ ] Optimize queries jika perlu

### Task 9.5: Documentation (1 day)

**Priority:** Medium
**Description:**
Dokumentasi untuk operasional.

**Checklist:**
- [ ] Update README dengan setup instructions
- [ ] Document deployment process
- [ ] Document backup/restore procedure
- [ ] Document monitoring alerts
- [ ] Create user guide

### Task 9.6: Go-Live (0.5 day)

**Priority:** Critical
**Description:**
Deploy ke production dan monitoring.

**Checklist:**
- [ ] Deploy code ke production
- [ ] Verify all features working
- [ ] Monitor error rates
- [ ] Monitor performance
- [ ] Announce to users

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Test coverage | > 90% |
| Critical bugs | 0 |
| Order success rate | > 99% |
| Payment verification accuracy | 100% |
| System uptime | > 99.5% |
| Average response time | < 500ms |
| User satisfaction | > 4/5 |

---

## Dependencies

| Dependency | Status | Blocker |
|------------|--------|---------|
| MySQL 8.0+ | Required | Production deployment |
| Redis | Recommended | Cache, queue |
| Sentry | Configured | Error tracking |
| Spatie Backup | Configured | Backup system |
| Leaflet | Installed | Maps integration |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Scope creep | Stick to roadmap, defer new features |
| Technical debt | Regular refactoring sprints |
| Performance issues | Load testing before launch |
| Security vulnerabilities | Regular security audits |
| Data loss | Automated backups, tested restore |

---

*Generated: 2026-06-17 | 545 tests passing | TypeScript clean | Build successful*

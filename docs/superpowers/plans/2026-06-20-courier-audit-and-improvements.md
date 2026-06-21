# Courier System Audit & Implementation Plan

## Audit Summary

| Category | Status |
|----------|--------|
| **Tests** | 68 courier/delivery tests passing |
| **Features** | Core lifecycle works, several gaps found |
| **Code Quality** | Clean, no TODO/FIXME |

---

## Issues Found

### 🔴 Critical (Must Fix)

1. **No proof-of-delivery image upload**
   - `proof_image` field exists in DB but no UI to upload
   - Customer has no visual proof of delivery
   
2. **Missing notification on `startDelivery`**
   - Customer not notified when courier starts delivering
   - Only `confirmPickup` and `complete` send notifications

3. **Dashboard uses raw `fetch()` instead of Inertia**
   - Bypasses Inertia error handling
   - Silent failures on availability/shift actions

### 🟡 High Priority (Should Fix)

4. **No courier-specific HTTP tests**
   - Service tests exist but no direct controller tests
   - Courier routes untested at HTTP level

5. **Route optimization excludes `delivering` status**
   - Couriers can't re-optimize route mid-delivery

6. **Duplicate distance calculation**
   - `OutletAssignmentService` and `RoutingService` both implement Haversine
   - Potential inconsistency

### 🟢 Medium Priority (Nice to Have)

7. **No batch operations**
   - Can't batch-confirm pickups at same outlet

8. **No real-time location tracking**
   - No GPS tracking, no ETA calculation

9. **Dashboard N+1 queries**
   - 6 separate queries, could be consolidated

10. **No composite index on `deliveries.courier_id + status`**
    - Most common query pattern unoptimized

---

## Implementation Plan

### Task 1: Add Proof-of-Delivery Image Upload

**Files:**
- Modify: `resources/js/pages/courier/deliveries/show.tsx`
- Modify: `app/Http/Controllers/Courier/DeliveryController.php`
- Modify: `app/Services/DeliveryService.php`

**Steps:**
1. Add image upload field to complete bottom sheet
2. Add `proof_image` to controller validation
3. Store image in `public/delivery-proofs/`
4. Display proof image in delivery detail (completed status)
5. Run tests, commit

---

### Task 2: Add Notification for startDelivery

**Files:**
- Modify: `app/Services/DeliveryService.php`

**Steps:**
1. Create `DeliveryStarted` notification class
2. Send notification in `startDelivery()` method
3. Include courier name and ETA
4. Run tests, commit

---

### Task 3: Convert Dashboard to Inertia

**Files:**
- Modify: `resources/js/pages/courier/dashboard.tsx`
- Modify: `app/Http/Controllers/Courier/CourierAvailabilityController.php`

**Steps:**
1. Add `toggleOnline`, `startShift`, `endShift` as Inertia responses
2. Replace `fetch()` calls with `router.post()`
3. Add proper error handling with toast notifications
4. Run tests, commit

---

### Task 4: Add Courier HTTP Tests

**Files:**
- Create: `tests/Feature/CourierDashboardTest.php`
- Create: `tests/Feature/CourierDeliveryTest.php`

**Steps:**
1. Test dashboard loads with correct data
2. Test availability toggle
3. Test shift start/end
4. Test delivery lifecycle (pickup, start, complete, fail)
5. Test rejection flow
6. Run tests, commit

---

### Task 5: Fix Route Optimization

**Files:**
- Modify: `app/Http/Controllers/Courier/DeliveryController.php`

**Steps:**
1. Include `delivering` status in route optimization query
2. Add status filter parameter (optional)
3. Run tests, commit

---

### Task 6: Add Database Index

**Files:**
- Create: `database/migrations/xxxx_add_composite_index_to_deliveries.php`

**Steps:**
1. Add composite index on `(courier_id, status)`
2. Run migration, commit

---

### Task 7: Consolidate Distance Calculation

**Files:**
- Modify: `app/Services/OutletAssignmentService.php`
- Modify: `app/Services/RoutingService.php`

**Steps:**
1. Extract shared `calculateDistance()` to a trait or utility
2. Update both services to use shared implementation
3. Run tests, commit

---

## Priority Order

| # | Task | Priority | Est. |
|---|------|----------|------|
| 1 | Proof-of-delivery image | Critical | 2h |
| 2 | startDelivery notification | Critical | 1h |
| 3 | Dashboard to Inertia | Critical | 2h |
| 4 | Courier HTTP tests | High | 3h |
| 5 | Fix route optimization | High | 1h |
| 6 | Database index | Medium | 0.5h |
| 7 | Consolidate distance calc | Medium | 1h |
| **Total** | | | **~10.5h** |

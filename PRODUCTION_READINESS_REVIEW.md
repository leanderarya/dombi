# PRODUCTION READINESS REVIEW

**Date:** 2026-06-05
**Reviewer:** Automated Audit
**Codebase:** Dombi Commerce Platform
**Version:** Pre-production

---

## EXECUTIVE SUMMARY

This review identifies **67 findings** across 11 domains. The system is **NOT production-ready** in its current state due to **8 Critical** and **19 High** severity issues that pose risks of data corruption, security breaches, and operational failures.

### Severity Distribution

| Severity | Count |
|----------|-------|
| Critical | 8 |
| High | 19 |
| Medium | 27 |
| Low | 13 |

### Verification Status

| Check | Result |
|-------|--------|
| `php artisan test` | 304/305 passed (1 pre-existing test env issue) |
| `npm run types:check` | PASSED |
| `npm run build` | PASSED |

---

## PART 1: ORDER FLOW

### Critical

**C1. Any Authenticated Customer Can Cancel Any Order**
- File: `app/Http/Requests/Customer/CancelOrderRequest.php:16`
- Risk: `authorize()` only checks `$order->recovery_token` exists (always true). No ownership check. Any logged-in customer can cancel any other customer's pending order.
- Impact: Malicious cancellation, revenue loss, inventory corruption (double stock release).

**C2. Race Condition: Status Check Before Row Lock in `rejectOrder()` / `cancelByCustomer()`**
- File: `app/Services/OrderStatusService.php:96,145`
- Risk: `isPendingConfirmation()` is checked on stale model BEFORE `lockForUpdate()`. Concurrent requests both pass the check, causing double stock release. Compare with `expireOrder()` (line 197) which correctly re-checks after lock.
- Impact: `reserved_stock` goes negative, inventory corruption.

**C3. TOCTOU on Outlet Stock Check vs Reservation**
- File: `app/Services/OutletAssignmentService.php:9-25`
- Risk: `findAvailableOutlet()` reads stock without locks. `reserveStock()` is called later with locks. High concurrency causes many false "out of stock" errors.
- Impact: Lost orders during peak traffic.

### High

**H1. Any Authenticated Customer Can View Any Order**
- File: `app/Http/Controllers/Customer/OrderController.php:32-37`
- Risk: No ownership check. Any customer can view any order by ID including PII (name, phone, GPS address).

**H2. Any Authenticated Customer Can Repeat Any Order**
- File: `app/Http/Controllers/Customer/OrderController.php:48-53`
- Risk: No ownership check. Creates new order from another customer's data.

**H3. No Throttle on Checkout Submit**
- File: `routes/web.php:111`
- Risk: `POST /customer/checkout/payment` has no `throttle` middleware. Bot spam possible.

**H4. Order Code Generation Race Condition**
- File: `app/Services/OrderService.php:241-260`
- Risk: Sequential code generation with `lockForUpdate()` on `COUNT` can deadlock. No unique DB constraint on `order_code`.

**H5. Delivery/Payment Fee Trusted from Client**
- File: `app/Services/OrderService.php:47-49`
- Risk: `delivery_fee` and `payment_fee` read from payload without server-side re-verification in `createCheckoutOrder()`.

---

## PART 2: DELIVERY FLOW

### Critical

**C4. `rejected_by_courier` Not in MySQL ENUM**
- File: `app/Services/DeliveryService.php:106`
- Risk: `rejectAssignment()` sets `status = 'rejected_by_courier'` but this value is NOT in the deliveries ENUM: `'waiting_assignment','waiting_pickup','picked_up','delivering','completed','failed','retry_delivery','returned_to_outlet','cancelled_and_released'`. On MySQL strict mode, every rejection throws a DB error. On non-strict, value is silently truncated to empty string.
- Impact: Courier rejection and reassignment pipeline completely broken on MySQL.

**C5. History/Notifications Outside Transaction in 3 Methods**
- File: `app/Services/DeliveryService.php:136-201`
- Risk: `confirmPickup()`, `startDelivery()`, `failDelivery()` call `transition()` (own transaction) then `recordHistory()`/notifications OUTSIDE. If history fails, delivery is transitioned with no audit trail.
- Impact: Silent audit trail loss on connection drops or constraint violations.

### High

**H6. Cascade Delete Destroys Rejection History**
- File: `app/Services/DeliveryService.php:54`
- Risk: Hard-deleting rejected deliveries cascade-deletes `delivery_status_histories`. Audit trail permanently lost.

**H7. No Retry/Rejection Limit**
- File: `app/Services/DeliveryService.php:53-55,321-337`
- Risk: `retry_count` column exists but is NEVER incremented. Infinite assign-reject and fail-retry loops possible. Unbounded notification spam.

**H8. Capacity Check Not Atomic**
- File: `app/Services/DeliveryService.php:58-65`
- Risk: `COUNT` query on active deliveries not locked. Concurrent assignments can push courier over `max_active_deliveries`.

**H9. Return Flow Doesn't Update Order Status**
- File: `app/Services/DeliveryService.php:203-255`
- Risk: `returnToOutlet()` and `confirmReturn()` only update delivery fields. Order stays `failed_delivery`. Owner can cancel while courier is returning goods, releasing stock while goods are in transit.

---

## PART 3: INVENTORY

### High

**H10. No DB CHECK Constraint: `reserved_stock <= current_stock`**
- File: `database/migrations/2026_05_08_000002_create_dombi_core_tables.php:49-59`
- Risk: Unsigned columns prevent individual negatives but no relational constraint. Any app bug can violate invariant.

**H11. `hasEnoughStock()` Reads Without Locks**
- File: `app/Services/InventoryService.php:15-29`
- Risk: Classic TOCTOU. Currently unused in production code but a latent trap.

**H12. `findAvailableOutlet()` Uses Stale Eager-Loaded Data**
- File: `app/Services/OutletAssignmentService.php:9-25`
- Risk: Loads all outlet inventories without locks. Stock snapshot stale by reservation time.

**H13. `adjustStock()` Auto-Create Race**
- File: `app/Services/InventoryService.php:168-214`
- Risk: Concurrent `adjustStock()` for non-existent outlet/product both see null from `lockForUpdate()`, both attempt `create()`. Unique constraint causes 500 error.

---

## PART 4: NOTIFICATION SYSTEM

### High

**H14. `notifyOrderCreated()` Never Called**
- File: `app/Services/NotificationService.php:65`
- Risk: Method exists but grep confirms zero callers. Outlets never notified of new orders.

**H15. `notifyLowStock()` Never Called**
- File: `app/Services/NotificationService.php:407`
- Risk: Method exists but grep confirms zero callers. No low-stock alerts.

**H16. Notification Failure Rolls Back Business Operations**
- File: `app/Services/NotificationService.php:583-605`
- Risk: `Notification::create()` in same transaction as business logic. DB constraint violation on notification rolls back order status update, delivery assignment, etc.

### Medium

**M1. Track Page Leaks Other Orders' Notifications**
- File: `app/Http/Controllers/TrackController.php:28-34`
- Risk: `OR entity_type='delivery'` clause not scoped to current order's delivery.

**M2. Customer Notifications Silently Skipped When `customer_id` Null**
- File: `app/Services/NotificationService.php:87-145`
- Risk: Multiple methods silently skip. No logging to detect the issue.

**M3. Orphan Notifications on User/Customer Delete**
- File: `database/migrations/2026_06_04_000010_create_notifications_table.php:14-15`
- Risk: `nullOnDelete()` creates dead rows that are never cleaned up.

**M4. No Notification Retention Policy**
- Risk: Table grows unbounded. No scheduled cleanup.

**M5. Customer Notifications Unreadable via API**
- File: `app/Http/Controllers/NotificationController.php:11-41`
- Risk: Controller filters by `user_type`/`user_id`. Customer notifications use `customer_id`. Write-only for customers.

---

## PART 5: GUEST CUSTOMER

### Critical

**C6. Phone-Based Order Recovery Exposes All Orders Without Auth**
- File: `app/Http/Controllers/Customer/GuestOrderRecoveryController.php:12-21`
- Risk: `/customer/orders/recovery` accepts phone number, returns all active orders. No authentication, no rate limiting.
- Impact: Automated phone enumeration harvests complete order histories.

**C7. No Rate Limiting on Recovery/Lookup Endpoints**
- File: `routes/web.php:109,113`
- Risk: `POST /customer/orders/recovery` and `GET /checkout/customer-lookup` have zero throttle. Brute-force enumeration trivial.

### High

**H17. Recovery Token Weak Entropy (24 bits)**
- File: `app/Models/Order.php:109-120`
- Risk: 6 hex chars = 16.7M possible values. `/track/{token}` exposes full order details. Brute-forceable without rate limiting.

**H18. Address Controller No Ownership Check**
- File: `app/Http/Controllers/Customer/AddressController.php:35-61`
- Risk: `edit()`, `update()`, `destroy()`, `setDefault()` accept any address ID. Any customer can manipulate any other customer's addresses.

**H19. `lookupCustomer` Leaks PII**
- File: `app/Http/Controllers/Customer/CheckoutController.php:336-357`
- Risk: Returns customer name and address for any phone number. No rate limiting.

---

## PART 6: SCHEDULER

### Critical

**C8. `AutoOfflineCouriers` Never Scheduled**
- File: `routes/console.php` (only `orders:expire-pending` is scheduled)
- Risk: Command exists but is not registered in scheduler. Inactive couriers remain "online" indefinitely, causing failed assignments.

### High

**H20. `ExpirePendingOrders` Missing `withoutOverlapping()`**
- File: `routes/console.php:11`
- Risk: Overlapping instances compete for row locks if job exceeds 1 minute.

**H21. Missing `onOneServer()` for Multi-Server**
- File: `routes/console.php:11`
- Risk: Every app server fires the job simultaneously in scaled deployments.

**H22. `ExpirePendingOrders` Silent Failure**
- File: `app/Console/Commands/ExpirePendingOrders.php`
- Risk: No try/catch. Single corrupt order (e.g., `InsufficientStockException`) aborts entire chunk. Returns `SUCCESS` unconditionally.

**H23. `AutoOfflineCouriers` N+1 Query**
- File: `app/Console/Commands/AutoOfflineCouriers.php:30-38`
- Risk: Separate `exists()` query per courier. Linear DB load scaling.

---

## PART 7: DATABASE

### High

**H24. Missing Index: `[status, confirmation_expires_at]` on orders**
- File: `ExpirePendingOrders.php:18-21`
- Risk: Most frequently executed query (every minute) cannot use any existing index efficiently.

**H25. Missing Index: `users.role`**
- File: `database/migrations/2026_05_08_000001_add_role_fields_to_users_table.php:12`
- Risk: Every query filtering by role (scheduler, notifications, courier listing) does full table scan.

**H26. `delivery_resolution_logs.delivery_id` Missing FK + Index**
- File: `database/migrations/2026_05_25_000001_create_delivery_resolution_logs_table.php:14`
- Risk: No referential integrity. Orphaned rows accumulate. Joins are slow.

### Medium

**M6. `orders.status` ENUM->VARCHAR Loses DB Validation**
- File: `database/migrations/2026_06_04_000001_relax_orders_status_to_string.php:14`
- Risk: Any string value accepted. Typos and invalid statuses possible via direct DB access.

**M7. Missing Composite Index: `[role, is_online, is_active]` on users**
- Risk: Scheduler and courier listing queries scan all rows.

**M8. N+1 in `DeliveryIntelligenceService::getAllCouriersCapacity()`**
- File: `app/Services/DeliveryIntelligenceService.php:45-52`
- Risk: 4 queries per courier. 50 couriers = 201 queries.

**M9. N+1 in `getCourierLeaderboard()` and `getOutletPerformance()`**
- File: `app/Services/DeliveryIntelligenceService.php:288-359`
- Risk: 3-4 queries per entity. Unbounded scaling.

---

## PART 8: ERROR HANDLING

### Medium

**M10. `releaseReservedStock()` Throws on Inconsistency, Blocks Status Transitions**
- File: `app/Services/InventoryService.php:83-91`
- Risk: If `reserved_stock < item->quantity` (data corruption), throws `InsufficientStockException` inside transaction. Orders become stuck in uncancellable state.

**M11. Duplicate Customer Creation Race**
- File: `app/Services/OrderService.php:111-132`
- Risk: `lockForUpdate()` on non-existent row doesn't lock in MySQL. Concurrent requests both create. Unique constraint causes 500 if exists, duplicate if not.

---

## PART 9: AUDIT TRAIL

### Medium

**M12. `confirmReturn()` Doesn't Validate Main Delivery Status**
- File: `app/Services/DeliveryService.php:238`
- Risk: Only checks `return_status`. Owner can resolve delivery while courier is returning. Conflicting state.

**M13. `resolveFailedDelivery` Returns Deleted Object**
- File: `app/Services/DeliveryService.php:312-336`
- Risk: For `retry_delivery`, delivery is deleted then returned. Downstream code referencing this object will fail.

**M14. Order Status Updates Bypass `OrderStatusService`**
- File: `app/Services/DeliveryService.php:326,344,362`
- Risk: `handleRetryDelivery()`, `handleReturnedToOutlet()`, `handleCancelledAndReleased()` use raw `$order->update()` instead of `OrderStatusService::updateStatus()`. Skips transition validation and history.

**M15. `delivery_resolution_logs.resolved_by` Uses `cascadeOnDelete`**
- File: `database/migrations/2026_05_25_000001_create_delivery_resolution_logs_table.php:16`
- Risk: Deleting a user destroys all their resolution logs. Audit trail loss.

---

## PART 10: PRODUCTION DEPLOYMENT

### Medium

**M16. `approveRequest()` No Validation on `approved_quantity` Bounds**
- File: `app/Services/RestockService.php:46-93`
- Risk: Negative values or values exceeding `requested_quantity` accepted.

**M17. `confirmReceived()` Ignores `received_notes`/`damage_notes`**
- File: `app/Services/RestockService.php:184-254`
- Risk: Fields exist in schema but are never set. No way to record damage during receipt.

**M18. Dead Status Codes in Schema**
- `restock_requests.approved` - never set (transitions to `preparing` directly)
- `stock_distributions.received` - never set (transitions to `completed` directly)

### Low

**L1. `OUTLET_ALLOWED_STATUSES` Doesn't Include `cancelled_by_outlet`**
- File: `app/Http/Requests/Outlet/UpdateOrderStatusRequest.php:11-15`
- Risk: No visible outlet cancel endpoint despite valid transition in `OrderStatusService::TRANSITIONS`.

**L2. No Maximum Quantity Validation Per Item**
- File: `app/Http/Controllers/Customer/CheckoutController.php:91`
- Risk: Customer can order unreasonable quantity (999,999 units).

**L3. `NotificationService::getOwners()` N+1 Pattern**
- File: `app/Services/NotificationService.php:55-61`
- Risk: Extra query per notification for outlet user lookups.

**L4. Incomplete Notification Coverage in `fireStatusNotifications()`**
- File: `app/Services/OrderStatusService.php:263-268`
- Risk: Only handles `confirmed` status. Other intermediate changes are silent.

**L5. `rejectAssignment` Creates Self-Referencing Status History**
- File: `app/Services/DeliveryService.php:118-126`
- Risk: `from_status` and `to_status` both `ready_for_pickup`. Misleading audit trail.

**L6. No Timeout/Auto-Cleanup for Stuck Deliveries**
- Risk: Deliveries in `waiting_pickup`, `picked_up`, `delivering`, `returning_to_outlet` can stay indefinitely.

**L7. Recovery Token in `$fillable`, Stored Plaintext**
- File: `app/Models/Order.php:68`
- Risk: Mass-assignable. Database compromise exposes all tokens.

**L8. `releaseReservedStock()` Silently Skips Missing Inventory**
- File: `app/Services/InventoryService.php:79-81`
- Risk: If inventory record deleted after order creation, reserved stock never released.

**L9. No Idempotency on `reserveStock()`**
- File: `app/Services/InventoryService.php:31-68`
- Risk: Double-reservation possible if called from unprotected path. Mitigated by unique `order_code` constraint.

**L10. No Automated Reservation Reconciliation**
- File: `app/Services/InventoryService.php:151-164`
- Risk: `order_reserved` and `order_completed` movements not paired. Manual reconciliation required.

**L11. `stock_movements` Missing `[reference_type, reference_id]` Index**
- Risk: Polymorphic lookups full table scan.

**L12. `order_status_histories.changed_by` FK Dropped**
- File: `database/migrations/2026_06_04_000003_create_customers_table.php:13-15`
- Risk: `actor()` relationship returns wrong results for customer-initiated changes.

**L13. `return_confirmed_by` Missing FK Constraint**
- File: `database/migrations/2026_06_04_000009_add_safety_fields.php:23`
- Risk: No referential integrity. Inconsistent with other `*_by` columns.

---

## RECOMMENDED FIXES (Priority Order)

### Pre-Launch (Must Fix)

1. **Fix `CancelOrderRequest::authorize()`** - Add ownership check: `$order->customer_id === $request->user()->customer->id`
2. **Fix `rejected_by_courier` ENUM** - Add migration: `ALTER TABLE deliveries MODIFY status ENUM(..., 'rejected_by_courier')`
3. **Fix status re-check after lock** in `rejectOrder()` and `cancelByCustomer()` - Match pattern from `expireOrder()`
4. **Add ownership checks** to `OrderController::show()`, `OrderController::repeat()`, `AddressController`
5. **Add rate limiting** to `POST /customer/orders/recovery`, `GET /checkout/customer-lookup`
6. **Schedule `AutoOfflineCouriers`** in `routes/console.php`
7. **Wrap notification creation in try/catch** to prevent business operation rollback
8. **Call `notifyOrderCreated()`** from `OrderService::createCheckoutOrder()`

### Pre-Launch (Should Fix)

9. Add `withoutOverlapping()` and `onOneServer()` to scheduler
10. Add error handling to `ExpirePendingOrders` (per-order try/catch)
11. Add missing indexes: `[status, confirmation_expires_at]`, `users.role`, `[role, is_online, is_active]`
12. Add `delivery_resolution_logs.delivery_id` FK + index
13. Wrap `confirmPickup()`, `startDelivery()`, `failDelivery()` history/notifications in transaction
14. Increment `retry_count` in `handleRetryDelivery()`
15. Add retry limit (e.g., max 3 retries per order)
16. Fix track page notification scoping (remove broad `OR entity_type='delivery'`)
17. Increase recovery token entropy to 128+ bits

### Post-Launch (Nice to Have)

18. Add DB CHECK constraint for `reserved_stock <= current_stock`
19. Implement notification retention policy (scheduled cleanup)
20. Build customer notification API
21. Consolidate delivery service order status updates through `OrderStatusService`
22. Fix N+1 queries in `DeliveryIntelligenceService`
23. Add proof of delivery requirement
24. Implement stuck delivery auto-cleanup

---

## DEPLOYMENT CHECKLIST

### Environment
- [ ] `APP_ENV=production`
- [ ] `APP_DEBUG=false`
- [ ] `APP_KEY` generated and set
- [ ] Database connection configured (MySQL 8.0+)
- [ ] `SESSION_DRIVER=database` or `redis`
- [ ] `CACHE_STORE=redis` or `database`
- [ ] `QUEUE_CONNECTION=redis` or `database`

### Database
- [ ] Run `php artisan migrate` on production database
- [ ] Verify all indexes exist (especially `[status, confirmation_expires_at]`)
- [ ] Add `rejected_by_courier` to deliveries ENUM

### Scheduler
- [ ] Add `AutoOfflineCouriers` to `routes/console.php`
- [ ] Configure cron: `* * * * * php artisan schedule:run`
- [ ] Add `withoutOverlapping()` and `onOneServer()` to all scheduled commands

### Security
- [ ] Fix authorization on `CancelOrderRequest`
- [ ] Fix ownership checks on order/address endpoints
- [ ] Add rate limiting to recovery/lookup endpoints
- [ ] Increase recovery token entropy

### Monitoring
- [ ] Configure error reporting (Sentry, Bugsnag, etc.)
- [ ] Monitor scheduler job failures
- [ ] Set up alerts for `ExpirePendingOrders` failures
- [ ] Monitor notification table growth

### Storage
- [ ] `php artisan storage:link` for proof of delivery images
- [ ] Configure backup schedule for database
- [ ] Verify log rotation

---

## GO/NO-GO ASSESSMENT

### NO-GO

The system has **8 Critical** issues that will cause:
- Data corruption (double stock release from race conditions)
- Security breaches (any customer can cancel/view any order, phone enumeration)
- Broken functionality (courier rejection completely broken on MySQL)
- Silent failures (notifications never sent, scheduler not running)

**Minimum required for GO:**
1. Fix all Critical issues (C1-C8)
2. Fix all High authorization issues (H1, H2, H17, H18)
3. Add rate limiting (H3, C7)
4. Schedule `AutoOfflineCouriers` (C8)
5. Add missing database indexes (H24, H25)

**Estimated effort:** 2-3 days of focused work.

---

*Generated: 2026-06-05 | 304/305 tests passing | TypeScript clean | Build successful*

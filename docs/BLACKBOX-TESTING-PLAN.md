# Dombi Blackbox Testing Plan

> **For agentic workers:** This is a manual blackbox testing plan for real device testing. Execute each test case on a physical device or emulator. Document all bugs found with screenshots and steps to reproduce.

**Goal:** Identify all bugs, UX issues, and edge cases in the Dombi application through systematic blackbox testing on real devices

**Architecture:** Test all 4 roles (Customer, Owner, Outlet, Courier) with focus on critical user flows, edge cases, and multi-role interactions

**Tech Stack:** Laravel 13, React 19, Inertia.js, MySQL 8.0+, Tailwind CSS

---

## Test Environment Setup

### Prerequisites
1. Fresh database: `php artisan migrate:fresh --seed`
2. Start server: `php artisan serve`
3. Start queue: `php artisan queue:work`
4. Clear caches: `php artisan cache:clear && php artisan view:clear`

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@example.com` | `password` |
| Outlet Tembalang | `outlet.tembalang@example.com` | `password` |
| Outlet Banyumanik | `outlet.banyumanik@example.com` | `password` |
| Courier | `courier@example.com` | `password` |
| Customer | Via Google OAuth or Guest mode | N/A |

### Test Devices

- [ ] Mobile (Android) - Chrome
- [ ] Mobile (iOS) - Safari
- [ ] Tablet - Chrome
- [ ] Desktop - Chrome

---

## Priority Levels

- **P0 (Critical):** Blocks core functionality, must fix before launch
- **P1 (High):** Significant impact, fix before launch
- **P2 (Medium):** Noticeable impact, fix soon
- **P3 (Low):** Minor issue, fix when possible

---

## 1. CUSTOMER TESTS

### 1.1 Guest Mode Entry (P0)

**Pre-condition:** Not logged in, fresh session

**Steps:**
1. Visit `/` (welcome page)
2. Verify "Masuk dengan Google" button visible
3. Verify "Lewati Tahap Ini" button visible
4. Tap "Lewati Tahap Ini"

**Expected:**
- Redirects to `/customer/home`
- Shows guest state (no profile name)
- Bottom nav shows: Home, Produk, Pesanan, Profil
- No "Pesanan Aktif" bar at top

**Test:**
- [ ] Welcome page loads correctly
- [ ] Guest mode entry works
- [ ] Bottom navigation works
- [ ] No errors in console

**Bugs Found:**
```
Bug ID: C-G001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
Screenshot: [If applicable]
```

---

### 1.2 Product Browsing (P0)

**Pre-condition:** Guest mode or logged in

**Steps:**
1. Navigate to `/customer/products`
2. Verify product list loads
3. Tap on a product family
4. Verify product detail page loads
5. Test search functionality
6. Test filter chips (if any)

**Expected:**
- Product cards show: image, name, price range, variant count
- Product detail shows: description, flavor/size selectors
- Search filters products in real-time
- No loading errors

**Test:**
- [ ] Product list loads
- [ ] Product cards display correctly
- [ ] Product detail loads
- [ ] Search works
- [ ] Filters work
- [ ] Images load (or fallback shows)
- [ ] Price displays correctly
- [ ] Variant count shows

**Bugs Found:**
```
Bug ID: C-P001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 1.3 Add to Cart (P0)

**Pre-condition:** On product detail page

**Steps:**
1. Select flavor (if available)
2. Select size
3. Set quantity to 1
4. Tap "Tambah ke Keranjang"
5. Verify cart badge updates
6. Try adding same item again
7. Verify quantity merges

**Expected:**
- Flavor/size selectors work
- Quantity stepper works (min 1, max 999)
- "Tambah ke Keranjang" button enabled when selections made
- Cart badge shows correct count
- Same item added twice merges quantities
- Toast notification shows "Ditambahkan ke keranjang"

**Test:**
- [ ] Flavor selector works
- [ ] Size selector works
- [ ] Quantity stepper works
- [ ] Add to cart works
- [ ] Cart badge updates
- [ ] Duplicate merge works
- [ ] Toast shows

**Bugs Found:**
```
Bug ID: C-C001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 1.4 Checkout Flow - Pickup (P0)

**Pre-condition:** Items in cart

**Steps:**
1. Tap cart icon or "Lihat Keranjang"
2. Verify cart items display correctly
3. Select "Ambil di Outlet" fulfillment
4. Tap "Lanjutkan"
5. Enter customer name (min 3 chars)
6. Enter phone number (format: 62xxx)
7. Select pickup outlet
8. Tap "Lanjutkan ke Pembayaran"
9. Select payment method (COD)
10. Tap "Buat Pesanan"

**Expected:**
- Cart shows all items with correct quantities
- Fulfillment selection works
- Form validation works (name, phone)
- Outlet selection shows available outlets
- Payment methods display
- Order creates successfully
- Redirects to order confirmation
- Cart clears after order

**Test:**
- [ ] Cart displays correctly
- [ ] Fulfillment selection works
- [ ] Form validation works
- [ ] Outlet selection works
- [ ] Payment selection works
- [ ] Order creates
- [ ] Redirect works
- [ ] Cart clears

**Bugs Found:**
```
Bug ID: C-CK001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 1.5 Checkout Flow - Delivery (P0)

**Pre-condition:** Items in cart, logged in as customer

**Steps:**
1. Tap cart icon
2. Select "Kurir Dombi" fulfillment
3. Tap "Lanjutkan"
4. Enter customer name
5. Enter phone number
6. Enter delivery address (use map picker)
7. Verify delivery quote displays
8. Tap "Lanjutkan ke Pembayaran"
9. Verify OTP screen appears
10. Enter OTP code (check console for OTP)
11. Select payment method
12. Tap "Buat Pesanan"

**Expected:**
- Delivery option available for logged-in users
- Address form with map picker works
- Delivery quote calculates correctly
- OTP sends to phone
- OTP verification works
- Order creates successfully

**Test:**
- [ ] Delivery option works
- [ ] Address form works
- [ ] Map picker works
- [ ] Delivery quote shows
- [ ] OTP sends
- [ ] OTP verifies
- [ ] Order creates

**Bugs Found:**
```
Bug ID: C-CK002
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 1.6 Order Tracking (P1)

**Pre-condition:** Order placed

**Steps:**
1. Go to `/customer/orders`
2. Verify order appears in "Aktif" tab
3. Tap on order
4. Verify order detail shows
5. Copy tracking link
6. Open tracking link in new tab (incognito)
7. Verify tracking page shows status

**Expected:**
- Order list shows active orders
- Order detail shows timeline
- Tracking link copies correctly
- Public tracking page works (no auth)
- Status timeline displays correctly

**Test:**
- [ ] Order list loads
- [ ] Order detail loads
- [ ] Tracking link works
- [ ] Public tracking works
- [ ] Timeline displays

**Bugs Found:**
```
Bug ID: C-OT001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 1.7 Order Cancellation (P1)

**Pre-condition:** Order with status `pending_confirmation`

**Steps:**
1. View order detail
2. Tap "Batalkan Pesanan"
3. Verify dialog opens
4. Select cancellation reason
5. Add note (if "Lainnya" selected)
6. Submit cancellation

**Expected:**
- "Batalkan Pesanan" button visible for pending orders
- Dialog shows cancellation reasons
- Form validation works
- Order status changes to `cancelled_by_customer`
- Button disappears after cancellation

**Test:**
- [ ] Cancel button visible
- [ ] Dialog opens
- [ ] Reason selection works
- [ ] Note field works
- [ ] Cancellation succeeds
- [ ] Status updates

**Bugs Found:**
```
Bug ID: C-OC001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 1.8 Address Management (P2)

**Pre-condition:** Logged in as customer

**Steps:**
1. Go to `/customer/addresses`
2. Verify address list loads
3. Tap "Tambah Alamat"
4. Fill form: label, recipient, phone, address
5. Use map picker for coordinates
6. Save address
7. Edit address
8. Set as default
9. Delete address

**Expected:**
- Address list loads
- Create form works
- Map picker works
- Edit works
- Default setting works
- Delete works (with confirmation)

**Test:**
- [ ] Address list loads
- [ ] Create works
- [ ] Map picker works
- [ ] Edit works
- [ ] Default setting works
- [ ] Delete works

**Bugs Found:**
```
Bug ID: C-AM001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 1.9 Guest Order Recovery (P1)

**Pre-condition:** Guest with existing orders

**Steps:**
1. Clear session (new incognito window)
2. Go to `/customer/orders`
3. Tap "Cari Pesanan Saya"
4. Enter phone number from previous order
5. Verify OTP sent
6. Enter OTP
7. Verify orders recovered

**Expected:**
- Recovery flow accessible
- OTP sends
- Orders display after verification
- Can view order details

**Test:**
- [ ] Recovery flow works
- [ ] OTP sends
- [ ] Orders recover
- [ ] Details accessible

**Bugs Found:**
```
Bug ID: C-GR001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 1.10 Customer Profile (P2)

**Pre-condition:** Logged in as customer

**Steps:**
1. Go to `/customer/profile`
2. Verify profile displays
3. Test all menu links
4. Test logout

**Expected:**
- Profile shows customer name
- Menu links work
- Logout works

**Test:**
- [ ] Profile displays
- [ ] Menu links work
- [ ] Logout works

**Bugs Found:**
```
Bug ID: C-CP001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

## 2. OUTLET TESTS

### 2.1 Outlet Login (P0)

**Pre-condition:** Fresh session

**Steps:**
1. Go to `/login`
2. Enter `outlet.tembalang@example.com` / `password`
3. Tap "Masuk"

**Expected:**
- Login succeeds
- Redirects to `/outlet/dashboard`
- Shows outlet name

**Test:**
- [ ] Login works
- [ ] Redirect works
- [ ] Dashboard loads

**Bugs Found:**
```
Bug ID: O-L001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 2.2 Outlet Dashboard (P0)

**Pre-condition:** Logged in as outlet

**Steps:**
1. View dashboard
2. Verify work queue shows
3. Check quick actions
4. Check order counts

**Expected:**
- Dashboard loads
- Work queue shows pending orders
- Quick actions work
- Counts are accurate

**Test:**
- [ ] Dashboard loads
- [ ] Work queue shows
- [ ] Quick actions work
- [ ] Counts accurate

**Bugs Found:**
```
Bug ID: O-D001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 2.3 Order Processing - Accept (P0)

**Pre-condition:** Order with status `pending_confirmation`

**Steps:**
1. Go to `/outlet/orders`
2. Find pending order
3. Tap on order
4. Verify order details show
5. Tap "Terima Pesanan"
6. Verify status changes to `confirmed`

**Expected:**
- Order list shows pending orders
- Order detail loads
- Accept button works
- Status updates
- Timestamp recorded

**Test:**
- [ ] Order list loads
- [ ] Order detail loads
- [ ] Accept works
- [ ] Status updates

**Bugs Found:**
```
Bug ID: O-OA001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 2.4 Order Processing - Reject (P0)

**Pre-condition:** Order with status `pending_confirmation`

**Steps:**
1. View pending order
2. Tap "Tolak Pesanan"
3. Verify dialog opens
4. Select rejection reason
5. Add note (optional)
6. Submit rejection

**Expected:**
- Reject button works
- Dialog shows reasons
- Form works
- Status changes to `rejected_by_outlet`
- Reason recorded

**Test:**
- [ ] Reject button works
- [ ] Dialog opens
- [ ] Reason selection works
- [ ] Rejection succeeds
- [ ] Status updates

**Bugs Found:**
```
Bug ID: O-OR001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 2.5 Order Processing - Prepare (P0)

**Pre-condition:** Order with status `confirmed`

**Steps:**
1. View confirmed order
2. Tap "Mulai Persiapan"
3. Verify status changes to `preparing`
4. Tap "Siap Diambil"
5. Verify status changes to `ready_for_pickup`

**Expected:**
- Status transitions work
- Buttons update correctly
- Timestamps recorded

**Test:**
- [ ] Prepare works
- [ ] Ready works
- [ ] Status updates
- [ ] Buttons correct

**Bugs Found:**
```
Bug ID: O-OP001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 2.6 Order Processing - Pickup Handoff (P1)

**Pre-condition:** Pickup order with status `ready_for_pickup`

**Steps:**
1. View ready order
2. Tap "Serahkan ke Customer"
3. Verify status changes to `completed`

**Expected:**
- Handoff button works
- Status changes to `completed`
- Timestamp recorded

**Test:**
- [ ] Handoff button works
- [ ] Status updates
- [ ] Order completes

**Bugs Found:**
```
Bug ID: O-OH001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 2.7 Courier Assignment (P1)

**Pre-condition:** Delivery order with status `ready_for_pickup`

**Steps:**
1. View ready delivery order
2. Tap "Assign Kurir"
3. Select courier from dropdown
4. Confirm assignment

**Expected:**
- Assignment dialog works
- Courier list shows available couriers
- Assignment succeeds
- Delivery created

**Test:**
- [ ] Assignment works
- [ ] Courier list shows
- [ ] Assignment succeeds
- [ ] Delivery creates

**Bugs Found:**
```
Bug ID: O-CA001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 2.8 Inventory Management (P1)

**Pre-condition:** Logged in as outlet

**Steps:**
1. Go to `/outlet/inventory`
2. Verify inventory list loads
3. Check stock levels
4. Perform stock opname
5. Enter actual count
6. Save opname

**Expected:**
- Inventory list loads
- Stock levels display
- Opname form works
- Save works
- Stock updates

**Test:**
- [ ] Inventory loads
- [ ] Stock displays
- [ ] Opname works
- [ ] Save works

**Bugs Found:**
```
Bug ID: O-IM001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 2.9 Restock Request (P2)

**Pre-condition:** Logged in as outlet

**Steps:**
1. Go to `/outlet/restocks/create`
2. Select product variants
3. Enter quantities
4. Add notes
5. Submit request
6. Verify request appears in list

**Expected:**
- Create form works
- Variant selection works
- Quantity entry works
- Submit works
- Request appears in list

**Test:**
- [ ] Form works
- [ ] Selection works
- [ ] Submit works
- [ ] List updates

**Bugs Found:**
```
Bug ID: O-RR001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 2.10 Settlement & Payments (P2)

**Pre-condition:** Outlet with completed orders

**Steps:**
1. Go to `/outlet/settlement`
2. Verify settlement data shows
3. Check outstanding amount
4. Tap "Ajukan Pembayaran"
5. Enter payment details
6. Submit payment

**Expected:**
- Settlement data loads
- Outstanding amount shows
- Payment form works
- Submit works
- Payment recorded

**Test:**
- [ ] Settlement loads
- [ ] Amount shows
- [ ] Payment form works
- [ ] Submit works

**Bugs Found:**
```
Bug ID: O-SP001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

## 3. OWNER TESTS

### 3.1 Owner Login (P0)

**Pre-condition:** Fresh session

**Steps:**
1. Go to `/login`
2. Enter `owner@example.com` / `password`
3. Tap "Masuk"

**Expected:**
- Login succeeds
- Redirects to `/owner/dashboard`
- Shows owner dashboard

**Test:**
- [ ] Login works
- [ ] Redirect works
- [ ] Dashboard loads

**Bugs Found:**
```
Bug ID: OW-L001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 3.2 Owner Dashboard (P0)

**Pre-condition:** Logged in as owner

**Steps:**
1. View dashboard
2. Check KPIs
3. Check action cards
4. Check outlet attention list
5. Check settlement alerts

**Expected:**
- Dashboard loads
- KPIs display
- Action cards show pending items
- Outlet list shows
- Alerts show

**Test:**
- [ ] Dashboard loads
- [ ] KPIs display
- [ ] Action cards show
- [ ] Outlet list shows
- [ ] Alerts show

**Bugs Found:**
```
Bug ID: OW-D001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 3.3 Outlet Management (P1)

**Pre-condition:** Logged in as owner

**Steps:**
1. Go to `/owner/outlets`
2. Verify outlet list loads
3. Tap "Tambah Outlet"
4. Fill form: name, address, coordinates, phone
5. Save outlet
6. View outlet detail
7. Edit outlet
8. Archive outlet

**Expected:**
- Outlet list loads
- Create form works
- Save works
- Detail loads
- Edit works
- Archive works

**Test:**
- [ ] List loads
- [ ] Create works
- [ ] Save works
- [ ] Detail loads
- [ ] Edit works
- [ ] Archive works

**Bugs Found:**
```
Bug ID: OW-OM001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 3.4 Delivery Board (P1)

**Pre-condition:** Orders with deliveries

**Steps:**
1. Go to `/owner/deliveries/board`
2. Verify kanban loads
3. Check columns: Waiting, Assigned, In Transit, Needs Action, Completed
4. Test courier assignment
5. Test filters

**Expected:**
- Kanban loads
- Columns show correctly
- Assignment works
- Filters work

**Test:**
- [ ] Kanban loads
- [ ] Columns show
- [ ] Assignment works
- [ ] Filters work

**Bugs Found:**
```
Bug ID: OW-DB001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 3.5 Restock Approval (P1)

**Pre-condition:** Pending restock requests

**Steps:**
1. Go to `/owner/restocks`
2. Find pending restock
3. View detail
4. Approve restock
5. Create distribution
6. Mark as shipped

**Expected:**
- Restock list loads
- Detail loads
- Approve works
- Distribution creation works
- Status updates

**Test:**
- [ ] List loads
- [ ] Detail loads
- [ ] Approve works
- [ ] Distribution works
- [ ] Status updates

**Bugs Found:**
```
Bug ID: OW-RA001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 3.6 Return/Exchange Management (P1)

**Pre-condition:** Pending return/exchange requests

**Steps:**
1. Go to `/owner/returns`
2. Find pending return
3. Approve return
4. Mark as received
5. Complete return
6. Go to `/owner/exchanges`
7. Repeat for exchange

**Expected:**
- Return list loads
- Approve works
- Status transitions work
- Exchange list loads
- Exchange flow works

**Test:**
- [ ] Return list loads
- [ ] Approve works
- [ ] Status transitions work
- [ ] Exchange list loads
- [ ] Exchange flow works

**Bugs Found:**
```
Bug ID: OW-RE001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 3.7 Settlement Verification (P1)

**Pre-condition:** Pending settlement payments

**Steps:**
1. Go to `/owner/settlement-payments`
2. Find pending payment
3. Verify payment
4. Check settlement updated

**Expected:**
- Payment list loads
- Verify works
- Settlement updates

**Test:**
- [ ] List loads
- [ ] Verify works
- [ ] Settlement updates

**Bugs Found:**
```
Bug ID: OW-SV001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 3.8 Pricing Management (P2)

**Pre-condition:** Logged in as owner

**Steps:**
1. Go to `/owner/pricing`
2. View master pricing
3. Edit a price
4. View pricing history
5. View per-outlet pricing

**Expected:**
- Pricing page loads
- Edit works
- History shows
- Per-outlet works

**Test:**
- [ ] Page loads
- [ ] Edit works
- [ ] History shows
- [ ] Per-outlet works

**Bugs Found:**
```
Bug ID: OW-PM001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 3.9 Reports & Analytics (P2)

**Pre-condition:** Data in system

**Steps:**
1. Go to `/owner/reports`
2. Test export functions
3. Go to `/owner/analytics`
4. View analytics data

**Expected:**
- Reports page loads
- Exports work
- Analytics loads
- Data displays

**Test:**
- [ ] Reports load
- [ ] Exports work
- [ ] Analytics loads
- [ ] Data displays

**Bugs Found:**
```
Bug ID: OW-RP001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

## 4. COURIER TESTS

### 4.1 Courier Login (P0)

**Pre-condition:** Fresh session

**Steps:**
1. Go to `/login`
2. Enter `courier@example.com` / `password`
3. Tap "Masuk"

**Expected:**
- Login succeeds
- Redirects to `/courier/dashboard`
- Shows courier dashboard

**Test:**
- [ ] Login works
- [ ] Redirect works
- [ ] Dashboard loads

**Bugs Found:**
```
Bug ID: CR-L001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 4.2 Courier Dashboard (P0)

**Pre-condition:** Logged in as courier

**Steps:**
1. View dashboard
2. Check availability status
3. Check task counts
4. Test "Go Online" / "Go Offline"
5. Test "Mulai Shift" / "Akhiri Shift"

**Expected:**
- Dashboard loads
- Status shows
- Counts display
- Online/offline works
- Shift works

**Test:**
- [ ] Dashboard loads
- [ ] Status shows
- [ ] Counts display
- [ ] Online/offline works
- [ ] Shift works

**Bugs Found:**
```
Bug ID: CR-D001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 4.3 Delivery Task Flow (P0)

**Pre-condition:** Assigned delivery

**Steps:**
1. View delivery in dashboard
2. Tap on delivery
3. Verify detail shows
4. Tap "Ambil Pesanan"
5. Verify status changes to `picked_up`
6. Tap "Mulai Antar"
7. Verify status changes to `delivering`
8. Tap "Selesaikan Pengiriman"
9. Enter "Diterima oleh"
10. Submit

**Expected:**
- Delivery shows in dashboard
- Detail loads
- Pickup works
- Delivery start works
- Completion works
- Status updates correctly

**Test:**
- [ ] Delivery shows
- [ ] Detail loads
- [ ] Pickup works
- [ ] Delivery start works
- [ ] Completion works
- [ ] Status updates

**Bugs Found:**
```
Bug ID: CR-DT001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 4.4 Failed Delivery (P1)

**Pre-condition:** Active delivery

**Steps:**
1. View delivery
2. Tap "Gagal Antar"
3. Select failure reason
4. Add note (if "Lainnya")
5. Submit

**Expected:**
- Fail button works
- Reason selection works
- Note field works
- Status changes to `failed_delivery`

**Test:**
- [ ] Fail button works
- [ ] Reason selection works
- [ ] Note field works
- [ ] Status updates

**Bugs Found:**
```
Bug ID: CR-FD001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 4.5 Route Optimization (P2)

**Pre-condition:** Multiple deliveries assigned

**Steps:**
1. Go to `/courier/deliveries`
2. Tap "Optimasi Rute"
3. Verify route displays
4. Check stops, distance, time

**Expected:**
- Route optimization works
- Stops display
- Distance shows
- Time shows

**Test:**
- [ ] Optimization works
- [ ] Stops display
- [ ] Distance shows
- [ ] Time shows

**Bugs Found:**
```
Bug ID: CR-RO001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 4.6 Customer Contact (P2)

**Pre-condition:** Active delivery

**Steps:**
1. View delivery detail
2. Tap "WhatsApp"
3. Verify WhatsApp opens
4. Tap "Telepon"
5. Verify phone dialer opens
6. Tap "Buka di Google Maps"
7. Verify Maps opens

**Expected:**
- WhatsApp link works
- Phone link works
- Maps link works

**Test:**
- [ ] WhatsApp works
- [ ] Phone works
- [ ] Maps works

**Bugs Found:**
```
Bug ID: CR-CC001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

## 5. CROSS-ROLE TESTS

### 5.1 Complete Order Lifecycle - Delivery (P0)

**Pre-condition:** Fresh database

**Steps:**
1. **Customer:** Place delivery order
2. **Outlet:** Accept order
3. **Outlet:** Start preparing
4. **Outlet:** Mark ready
5. **Owner:** Assign courier
6. **Courier:** Pick up order
7. **Courier:** Start delivery
8. **Courier:** Complete delivery
9. **Customer:** Verify order completed

**Expected:**
- All status transitions work
- Notifications sent at each step
- Order completes successfully
- Settlement generated

**Test:**
- [ ] Customer order works
- [ ] Outlet accept works
- [ ] Prepare works
- [ ] Ready works
- [ ] Assignment works
- [ ] Pickup works
- [ ] Delivery works
- [ ] Completion works
- [ ] Notifications work
- [ ] Settlement generates

**Bugs Found:**
```
Bug ID: X-OL001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 5.2 Complete Order Lifecycle - Pickup (P0)

**Pre-condition:** Fresh database

**Steps:**
1. **Customer:** Place pickup order
2. **Outlet:** Accept order
3. **Outlet:** Start preparing
4. **Outlet:** Mark ready
5. **Outlet:** Hand to customer
6. **Customer:** Verify order completed

**Expected:**
- All transitions work
- Order completes
- Settlement generated

**Test:**
- [ ] Customer order works
- [ ] Outlet accept works
- [ ] Prepare works
- [ ] Ready works
- [ ] Handoff works
- [ ] Completion works
- [ ] Settlement generates

**Bugs Found:**
```
Bug ID: X-OP001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 5.3 Return Flow (P1)

**Pre-condition:** Completed order

**Steps:**
1. **Outlet:** Create return request
2. **Owner:** Approve return
3. **Outlet:** Ship to center
4. **Owner:** Mark received
5. **Owner:** Complete return

**Expected:**
- Return creates
- Approval works
- Status transitions work
- Settlement adjusted

**Test:**
- [ ] Return creates
- [ ] Approval works
- [ ] Status transitions work
- [ ] Settlement adjusts

**Bugs Found:**
```
Bug ID: X-RF001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 5.4 Exchange Flow (P1)

**Pre-condition:** Completed order

**Steps:**
1. **Outlet:** Create exchange request
2. **Owner:** Approve exchange
3. **Owner:** Prepare replacement
4. **Owner:** Ship replacement
5. **Outlet:** Confirm received
6. **Owner:** Complete exchange

**Expected:**
- Exchange creates
- Approval works
- Status transitions work
- Settlement adjusted

**Test:**
- [ ] Exchange creates
- [ ] Approval works
- [ ] Status transitions work
- [ ] Settlement adjusts

**Bugs Found:**
```
Bug ID: X-EF001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 5.5 Restock Flow (P1)

**Pre-condition:** Low stock at outlet

**Steps:**
1. **Outlet:** Create restock request
2. **Owner:** Approve restock
3. **Owner:** Create distribution
4. **Owner:** Mark shipped
5. **Outlet:** Confirm received

**Expected:**
- Restock creates
- Approval works
- Distribution works
- Stock updates

**Test:**
- [ ] Restock creates
- [ ] Approval works
- [ ] Distribution works
- [ ] Stock updates

**Bugs Found:**
```
Bug ID: X-RSF001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

## 6. EDGE CASE TESTS

### 6.1 Zero Stock Checkout (P0)

**Steps:**
1. Add item to cart
2. Deplete stock (via another order)
3. Try to checkout

**Expected:**
- Error message shown
- Cannot proceed with out-of-stock item

**Test:**
- [ ] Error shows
- [ ] Checkout blocked

**Bugs Found:**
```
Bug ID: E-ZS001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 6.2 Concurrent Orders (P0)

**Steps:**
1. Two browsers add last item to cart
2. Both try to checkout simultaneously

**Expected:**
- One succeeds, one fails
- No overselling

**Test:**
- [ ] One succeeds
- [ ] One fails
- [ ] No overselling

**Bugs Found:**
```
Bug ID: E-CO001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 6.3 Guest to Registered (P1)

**Steps:**
1. Place order as guest
2. Register with same phone
3. Check if order appears

**Expected:**
- Order links to new account
- Order visible after login

**Test:**
- [ ] Order links
- [ ] Order visible

**Bugs Found:**
```
Bug ID: E-GR001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 6.4 Price Change During Checkout (P1)

**Steps:**
1. Customer adds item to cart
2. Owner changes price
3. Customer completes checkout

**Expected:**
- Price locked at time of add
- Or clear warning shown

**Test:**
- [ ] Price locked
- [ ] Or warning shown

**Bugs Found:**
```
Bug ID: E-PC001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 6.5 Operating Hours (P2)

**Steps:**
1. Set outlet operating hours
2. Try to order outside hours

**Expected:**
- Warning shown
- Or order queued for next open time

**Test:**
- [ ] Warning shows
- [ ] Or queuing works

**Bugs Found:**
```
Bug ID: E-OH001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 6.6 Holiday Blocking (P2)

**Steps:**
1. Set outlet holiday
2. Try to order for that date

**Expected:**
- Warning shown
- Cannot select holiday date

**Test:**
- [ ] Warning shows
- [ ] Date blocked

**Bugs Found:**
```
Bug ID: E-HB001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 6.7 Delivery Outside Range (P1)

**Steps:**
1. Set delivery address far from outlet
2. Try to checkout

**Expected:**
- Error: outside delivery range
- Cannot proceed

**Test:**
- [ ] Error shows
- [ ] Checkout blocked

**Bugs Found:**
```
Bug ID: E-DR001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 6.8 OTP Expiration (P1)

**Steps:**
1. Start delivery checkout
2. Wait for OTP to expire
3. Try to verify

**Expected:**
- Error: OTP expired
- Resend option available

**Test:**
- [ ] Error shows
- [ ] Resend works

**Bugs Found:**
```
Bug ID: E-OE001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 6.9 Multiple Failed Deliveries (P1)

**Steps:**
1. Courier fails delivery
2. Reassign to another courier
3. Fail again
4. Check if there's a limit

**Expected:**
- Limit on retry attempts
- Or escalation after N failures

**Test:**
- [ ] Limit exists
- [ ] Or escalation works

**Bugs Found:**
```
Bug ID: E-MF001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

## 7. SECURITY TESTS

### 7.1 Authorization Bypass (P0)

**Steps:**
1. Login as Customer A
2. Note order ID
3. Login as Customer B
4. Try to cancel Customer A's order

**Expected:**
- Access denied
- Cannot cancel other's order

**Test:**
- [ ] Access denied
- [ ] Cannot cancel

**Bugs Found:**
```
Bug ID: S-AB001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 7.2 Guest Recovery Leak (P0)

**Steps:**
1. Place orders with same phone (different sessions)
2. Use recovery flow
3. Check if all orders exposed

**Expected:**
- Only own orders shown
- No cross-session leak

**Test:**
- [ ] Only own orders
- [ ] No leak

**Bugs Found:**
```
Bug ID: S-GR001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 7.3 Rate Limiting (P1)

**Steps:**
1. Try login with wrong password 10+ times
2. Try OTP send 10+ times
3. Try recovery 10+ times

**Expected:**
- Rate limit kicks in
- Error: too many attempts

**Test:**
- [ ] Login rate limited
- [ ] OTP rate limited
- [ ] Recovery rate limited

**Bugs Found:**
```
Bug ID: S-RL001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

## 8. UX TESTS

### 8.1 Loading States (P2)

**Steps:**
1. Navigate between pages
2. Check for loading indicators
3. Check for skeleton screens

**Expected:**
- Loading indicators show
- Skeleton screens on data load
- No blank screens

**Test:**
- [ ] Loading indicators
- [ ] Skeleton screens
- [ ] No blank screens

**Bugs Found:**
```
Bug ID: U-LS001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 8.2 Empty States (P2)

**Steps:**
1. Check pages with no data
2. Verify empty state messages
3. Check for action CTAs

**Expected:**
- Empty states show
- Messages helpful
- CTAs present

**Test:**
- [ ] Empty states show
- [ ] Messages helpful
- [ ] CTAs present

**Bugs Found:**
```
Bug ID: U-ES001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 8.3 Error Messages (P2)

**Steps:**
1. Trigger validation errors
2. Check error messages
3. Check error styling

**Expected:**
- Errors show clearly
- Messages helpful
- Styling correct

**Test:**
- [ ] Errors show
- [ ] Messages helpful
- [ ] Styling correct

**Bugs Found:**
```
Bug ID: U-EM001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

### 8.4 Responsive Design (P2)

**Steps:**
1. Test on mobile (375px)
2. Test on tablet (768px)
3. Test on desktop (1024px+)
4. Check for layout issues

**Expected:**
- Mobile layout works
- Tablet layout works
- Desktop layout works
- No overflow issues

**Test:**
- [ ] Mobile works
- [ ] Tablet works
- [ ] Desktop works
- [ ] No overflow

**Bugs Found:**
```
Bug ID: U-RD001
Severity: P0/P1/P2/P3
Description: [Description]
Steps to Reproduce: [Steps]
Expected: [Expected behavior]
Actual: [Actual behavior]
```

---

## 9. TEST SUMMARY

### Bugs Found

| ID | Severity | Component | Description | Status |
|----|----------|-----------|-------------|--------|
| | | | | |

### Test Coverage

| Component | Tests | Passed | Failed | Notes |
|-----------|-------|--------|--------|-------|
| Customer | | | | |
| Outlet | | | | |
| Owner | | | | |
| Courier | | | | |
| Cross-Role | | | | |
| Edge Cases | | | | |
| Security | | | | |
| UX | | | | |

### Recommendations

1. **P0 Bugs:** Fix immediately
2. **P1 Bugs:** Fix before launch
3. **P2 Bugs:** Fix soon
4. **P3 Bugs:** Fix when possible

---

## 10. AUTOMATED TEST SUGGESTIONS

Based on blackbox testing findings, consider adding these automated tests:

1. **E2E Tests:** Full order lifecycle (customer → outlet → courier → complete)
2. **Security Tests:** Authorization bypass, rate limiting
3. **Edge Case Tests:** Zero stock, concurrent orders, price changes
4. **Integration Tests:** Settlement calculation, inventory conservation
5. **Performance Tests:** Load testing on checkout, order creation

---

*Last Updated: 2026-06-20*
*Version: 1.0*

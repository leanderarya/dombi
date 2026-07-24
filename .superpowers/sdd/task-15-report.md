## Task 15 Report

**Status:** complete
**Commit:** `1d855b0` — `feat: assign-courier-sheet Dombi/Eksternal switch + financial guardrail`

### Changes

- Added `deliveryFee` to `Props` interface
- Added `courierType` state (`'dombi' | 'eksternal'`) with tab switcher UI ("Kurir Dombi" | "Gojek/Grab")
- Added eksternal inline form: name, phone, plate, courier cost
- Real-time financial guardrail: `margin = deliveryFee - courierCost`, red/green card with ⚠️/✅ indicator
- Dual-mode `handleSubmit` sends `courier_type` + appropriate fields
- Submit button disabled logic adapts per mode
- Existing Dombi courier list preserved unchanged
- 0 TypeScript errors in modified file

## Fix: Owner Refund Hardening

**Commit:** `fix: harden owner refund mutations`

### Changes

1. **`app/Http/Controllers/Owner/RefundController.php`** — gate proof before transition:
   - Return error if `$path` is falsy (disk write failed)
   - Only notify on successful `transition()` return value
   - Delete orphaned proof file when transition loses race

2. **`tests/Feature/OwnerManualRefundTest.php`** — three new assertions:
   - `test_duplicate_complete_fires_notification_once` — asserts 1 `order.refund_processed` notification
   - `test_race_lost_request_cleans_uploaded_proof` — mocks `transition()` returning false, verifies no files remain in `refunds/`
   - Existing `test_cannot_refund_non_refund_pending_order` now tests cleanup path (guard passes → store runs → controller bails)
   - Added `Notification` model import
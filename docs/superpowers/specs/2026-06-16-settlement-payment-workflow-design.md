# Settlement Payment Workflow Design

## Overview

Enhance the settlement payment system to enable:
1. Owner to monitor unpaid outlets and send reminders
2. Outlets to see bank account info for deposits
3. Outlets to submit payments with optional proof upload
4. Owner to verify/reject payments with notifications to outlets

## Current State

**Already exists:**
- Owner dashboard at `/owner/finance` with unpaid outlet monitoring
- Outlet settlement page showing total due
- Payment submission (amount, reference, notes) without proof
- Manual WhatsApp copy-paste for reminders
- In-app notification system (database-only, 24 order/delivery/inventory types)

**Missing:**
- Automated payment reminders
- Bank account info display for outlets
- Proof upload from outlet side
- Settlement notification types
- Payment verification notifications

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Notification channel | In-app + WhatsApp manual | Keep existing manual WhatsApp, add automated in-app |
| Reminder timing | H-1 at 08:00 | Simple, predictable, owner has time to follow up |
| Proof upload | Optional, image only (JPG/PNG, max 2MB) | Flexible for outlets, simple to implement |
| Verification flow | Owner verifies/rejects with reason | Accountability, outlet knows why rejected |
| Bank info | Owner manages, outlet views | Clear deposit instructions |

## Data Model Changes

### New Table: `payment_accounts`

Store owner's bank accounts for outlet deposits.

```sql
payment_accounts
  id (bigint, PK)
  bank_name (string) -- e.g., BCA, Mandiri, BRI
  account_number (string) -- bank account number
  account_holder (string) -- account holder name
  is_active (boolean, default true)
  created_at (timestamp)
  updated_at (timestamp)
```

### Modify Table: `settlement_payments`

Add proof image field for outlet uploads.

```sql
settlement_payments
  + proof_image (string, nullable) -- file path for uploaded proof
```

### Modify Table: `notifications`

No schema changes needed - uses existing structure with new type constants.

## Settlement Notification Types

Add 5 new constants to `NotificationService`:

| Constant | Value | Recipient | Trigger |
|----------|-------|-----------|---------|
| `SETTLEMENT_REMINDER` | `settlement.reminder` | Outlet | H-1 before due_date |
| `SETTLEMENT_GENERATED` | `settlement.generated` | Outlet | New settlement created |
| `PAYMENT_SUBMITTED` | `payment.submitted` | Owner | Outlet submits payment |
| `PAYMENT_VERIFIED` | `payment.verified` | Outlet | Owner verifies payment |
| `PAYMENT_REJECTED` | `payment.rejected` | Outlet | Owner rejects payment |

## Scheduled Reminder Command

**Command:** `settlement:send-reminders`

**Schedule:** Daily at 08:00

**Logic:**
1. Query settlements where `due_date = tomorrow` and `status != 'paid'`
2. For each settlement, create in-app notification to outlet
3. Log count of reminders sent

**Deduplication:** Check if reminder already sent today for this settlement (via `last_invoice_sent_at` or notification check).

## UI Changes

### Owner Side

1. **Finance Settings Page** (`/owner/finance/settings`)
   - CRUD for payment accounts (bank_name, account_number, account_holder)
   - List of active bank accounts

2. **Payment Verification** (existing `/owner/settlement-payments`)
   - Add proof_image display in payment detail
   - Verify/reject actions already exist, add notification dispatch

### Outlet Side

1. **Settlement Page** (`/outlet/settlement`)
   - Add "Info Rekening" section showing active payment accounts
   - Display bank_name, account_number, account_holder

2. **Payment Submission** (`/outlet/settlement-payments/create`)
   - Add optional file upload for proof_image (JPG/PNG, max 2MB)
   - Existing fields: amount, reference_number, payment_date, notes

3. **Payment History** (`/outlet/settlement-payments`)
   - Show proof_image thumbnail if uploaded
   - Status badges already exist

4. **Notification Bell**
   - Settlement reminders appear as new notification type
   - Payment status updates (verified/rejected) appear with appropriate icons

## WhatsApp Reminder Flow (Manual, Existing)

Owner flow (unchanged):
1. Owner views overdue settlement in finance dashboard
2. Clicks "Send Invoice" button
3. System generates WhatsApp message with payment details
4. Owner copies message and opens WhatsApp manually

## Error Handling

| Scenario | Handling |
|----------|----------|
| Proof upload > 2MB | Client-side validation + server error message |
| Wrong file type | Client-side filter (accept image/*) + server validation |
| Duplicate reminder | Check `last_invoice_sent_at` before sending |
| No payment accounts configured | Show "Belum ada info rekening" to outlet |
| Settlement already paid | Skip reminder for paid settlements |

## Testing Strategy

1. **Unit Tests:**
   - `SettlementReminderCommand` - correct settlements selected, notifications created
   - `PaymentAccount` model - CRUD operations
   - Proof upload validation

2. **Feature Tests:**
   - Owner can manage payment accounts
   - Outlet can see payment accounts
   - Outlet can upload proof (optional)
   - Owner can see proof in verification queue
   - Notifications sent on verify/reject

3. **Integration Tests:**
   - Full flow: reminder -> outlet submits -> owner verifies -> outlet notified

## Implementation Order

1. Payment accounts table + model + CRUD
2. Settlement notification types in NotificationService
3. Scheduled reminder command
4. Proof image upload in payment submission
5. Owner verification with proof display
6. Outlet notification handling

## Open Questions

None - all decisions confirmed with user.

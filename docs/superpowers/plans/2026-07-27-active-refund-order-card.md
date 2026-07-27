# Active Refund Order Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make refund-active cards clearly show “Proses Refund” plus backend refund detail, and make the entire card open refund detail for authenticated and recovered guest customers.

**Architecture:** Preserve the existing backend-owned `refund_badge` contract. Add payload parity to Guest Recovery, then introduce a small pure presentation helper consumed by `ActiveOrderCard`; this makes badge text, detail color, click override, and action suppression unit-testable without adding a UI test dependency.

**Tech Stack:** Laravel 13, PHP 8.3, React 19, TypeScript, Inertia, PHPUnit, Vitest

## Global Constraints

- Primary active-refund badge text is exactly `Proses Refund`
- Secondary text comes from backend `refund_badge.status_label`; do not duplicate refund status labels in React
- Full card is clickable for refund-active orders even when `order.status` is terminal
- Logged-in target remains `/customer/orders/{id}`; guest target remains `/track/{recovery_token}`
- Refund-active cards suppress payment, cancellation, retry, and nested tracking actions
- Ordinary active-order behavior remains unchanged
- Guest Recovery payload must match authenticated `refund_badge` shape exactly: `payment_status`, `queue_state`, `status_label`
- Do not change refund lifecycle, visibility scopes, history cards, order detail page, or add a separate refund button/modal

---

### Task 1: Add refund-badge parity to Guest Recovery

**Files:**
- Modify: `app/Services/GuestOrderRecoveryService.php:9-13,100-120`
- Modify: `tests/Feature/ActiveRefundOrderVisibilityTest.php:44-92`

**Interfaces:**
- Consumes: `RefundPayloadService::queueState(Order): ?string`
- Consumes: `RefundPayloadService::statusLabel(Order): string`
- Produces: formatted-order field `refund_badge: array|null`

- [ ] **Step 1: Strengthen authenticated and guest payload tests before implementation**

In `test_customer_orders_places_active_refunds_only_in_active_orders()`, after collecting IDs, index active orders by ID:

```php
        $activeOrders = collect($props['activeOrders'])->keyBy('id');
```

Add:

```php
        $expectedLabels = [
            'refund_pending' => 'Menunggu Diproses',
            'refund_in_progress' => 'Sedang Diproses',
            'refund_rejected' => 'Refund Ditolak',
            'refund_failed' => 'Refund Gagal',
        ];

        $activeRefunds->each(function (Order $order) use ($activeOrders, $expectedLabels) {
            $badge = $activeOrders->get($order->id)['refund_badge'] ?? null;

            $this->assertNotNull($badge);
            $this->assertSame($order->payment_status, $badge['payment_status']);
            $this->assertSame($expectedLabels[$order->payment_status], $badge['status_label']);
            $this->assertNotEmpty($badge['queue_state']);
        });
```

In `test_guest_recovery_places_active_refunds_only_in_active_orders()`, index response orders:

```php
        $activeOrders = collect($response->json('active_orders'))->keyBy('id');
```

Add the same `$expectedLabels` and assertions against `$activeOrders`.

- [ ] **Step 2: Run the guest test and confirm RED**

```bash
php artisan test tests/Feature/ActiveRefundOrderVisibilityTest.php --filter=guest_recovery
```

Expected: FAIL because guest formatted orders do not contain `refund_badge`.

- [ ] **Step 3: Inject RefundPayloadService into GuestOrderRecoveryService**

Add inside the class before `recover()`:

```php
    public function __construct(
        private readonly RefundPayloadService $refundPayloads,
    ) {}
```

No import is needed because both services are in `App\Services`.

- [ ] **Step 4: Add refund_badge in formatOrder()**

At the start of `formatOrder()`:

```php
        $queueState = $this->refundPayloads->queueState($order);
        $refundBadge = $queueState === null ? null : [
            'payment_status' => $order->payment_status,
            'queue_state' => $queueState,
            'status_label' => $this->refundPayloads->statusLabel($order),
        ];
```

Add to the returned array after `payment_status`:

```php
            'refund_badge' => $refundBadge,
```

- [ ] **Step 5: Run focused backend tests**

```bash
php artisan test tests/Feature/ActiveRefundOrderVisibilityTest.php
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/Services/GuestOrderRecoveryService.php tests/Feature/ActiveRefundOrderVisibilityTest.php
git commit -m "fix: include refund badge in guest recovery"
```

---

### Task 2: Add a pure active-refund card presentation helper

**Files:**
- Create: `resources/js/lib/active-order-card-state.ts`
- Create: `resources/js/lib/active-order-card-state.test.ts`

**Interfaces:**
- Produces: `RefundBadge` type
- Produces: `getActiveRefundPresentation(refundBadge)`
- Consumed by `ActiveOrderCard` in Task 3

- [ ] **Step 1: Write failing Vitest tests**

Create `resources/js/lib/active-order-card-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getActiveRefundPresentation } from './active-order-card-state';

describe('getActiveRefundPresentation', () => {
    it('returns inactive presentation without a refund badge', () => {
        expect(getActiveRefundPresentation(null)).toEqual({
            active: false,
            primaryLabel: null,
            detailLabel: null,
            detailClassName: null,
            forceClickable: false,
            suppressActions: false,
        });
    });

    it.each([
        ['awaiting_customer', 'text-amber-700'],
        ['awaiting_guest', 'text-amber-700'],
        ['ready', 'text-blue-700'],
        ['in_progress', 'text-blue-700'],
        ['action_required', 'text-red-700'],
        ['rejected', 'text-red-700'],
    ])('presents %s refund state with backend label', (queueState, detailClassName) => {
        expect(getActiveRefundPresentation({
            payment_status: 'refund_pending',
            queue_state: queueState,
            status_label: 'Backend Refund Label',
        })).toEqual({
            active: true,
            primaryLabel: 'Proses Refund',
            detailLabel: 'Backend Refund Label',
            detailClassName,
            forceClickable: true,
            suppressActions: true,
        });
    });
});
```

- [ ] **Step 2: Run test and confirm RED**

```bash
npm test -- resources/js/lib/active-order-card-state.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Create the helper**

Create `resources/js/lib/active-order-card-state.ts`:

```ts
export interface RefundBadge {
    payment_status: string;
    queue_state: string;
    status_label: string;
}

interface ActiveRefundPresentation {
    active: boolean;
    primaryLabel: string | null;
    detailLabel: string | null;
    detailClassName: string | null;
    forceClickable: boolean;
    suppressActions: boolean;
}

const DETAIL_STYLES: Record<string, string> = {
    awaiting_customer: 'text-amber-700',
    awaiting_guest: 'text-amber-700',
    ready: 'text-blue-700',
    in_progress: 'text-blue-700',
    action_required: 'text-red-700',
    rejected: 'text-red-700',
};

export function getActiveRefundPresentation(
    refundBadge: RefundBadge | null | undefined,
): ActiveRefundPresentation {
    if (!refundBadge) {
        return {
            active: false,
            primaryLabel: null,
            detailLabel: null,
            detailClassName: null,
            forceClickable: false,
            suppressActions: false,
        };
    }

    return {
        active: true,
        primaryLabel: 'Proses Refund',
        detailLabel: refundBadge.status_label,
        detailClassName:
            DETAIL_STYLES[refundBadge.queue_state] ?? 'text-blue-700',
        forceClickable: true,
        suppressActions: true,
    };
}
```

- [ ] **Step 4: Run test and confirm GREEN**

```bash
npm test -- resources/js/lib/active-order-card-state.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add resources/js/lib/active-order-card-state.ts resources/js/lib/active-order-card-state.test.ts
git commit -m "test: define active refund card presentation"
```

---

### Task 3: Render refund state and force full-card navigation

**Files:**
- Modify: `resources/js/components/customer/active-order-card.tsx:2-15,181-194,201-220,261-315,339-352,404-503`
- Modify: `resources/js/pages/customer/orders/index.tsx:30-44`

**Interfaces:**
- Consumes: `RefundBadge` and `getActiveRefundPresentation()` from Task 2
- Consumes: existing `OrderCardShell clickable?: boolean`

- [ ] **Step 1: Extend page and card order types**

In `resources/js/pages/customer/orders/index.tsx`, import:

```ts
import type { RefundBadge } from '@/lib/active-order-card-state';
```

Add to `Order`:

```ts
    refund_badge?: RefundBadge | null;
```

In `active-order-card.tsx`, import:

```ts
import { RefreshCw } from 'lucide-react';
import {
    getActiveRefundPresentation,
    type RefundBadge,
} from '@/lib/active-order-card-state';
```

Add to its order type:

```ts
        refund_badge?: RefundBadge | null;
```

- [ ] **Step 2: Derive presentation state**

After payment state derivation:

```ts
    const refundPresentation = getActiveRefundPresentation(
        order.refund_badge ?? null,
    );
```

- [ ] **Step 3: Override display status**

Make refund presentation the first branch:

```ts
    const displayStatus = refundPresentation.active
        ? {
              label: refundPresentation.primaryLabel,
              className: `${BADGE_BASE} bg-blue-50 text-blue-700`,
          }
        : canRetryPayment
          ? {
```

Keep all existing remaining branches unchanged.

- [ ] **Step 4: Force card click only for active refund**

Add to `OrderCardShell`:

```tsx
                clickable={
                    refundPresentation.forceClickable ? true : undefined
                }
```

Existing `OrderCardShell` link logic then routes logged-in customers to order detail and recovered guests to tracking.

- [ ] **Step 5: Render backend detail below date**

After date text and before countdown:

```tsx
                        {refundPresentation.active && (
                            <div
                                className={`mt-1 flex items-center gap-1.5 text-[11px] font-semibold ${refundPresentation.detailClassName}`}
                            >
                                <RefreshCw className="h-3 w-3 shrink-0" />
                                <span>{refundPresentation.detailLabel}</span>
                            </div>
                        )}
```

- [ ] **Step 6: Suppress ordinary messages and actions**

Add `!refundPresentation.suppressActions` to payment issue and waiting messages:

```tsx
                        {canRetryPayment &&
                            !refundPresentation.suppressActions && (
```

```tsx
                        {isWaitingForPayment &&
                            !hasPaymentIssue &&
                            !refundPresentation.suppressActions && (
```

Wrap the right-side actions in:

```tsx
                    {!refundPresentation.suppressActions && (
                        <div className="flex items-center gap-2">
                            {/* all existing action branches unchanged */}
                        </div>
                    )}
```

This prevents a nested tracking Link inside the full-card Link and removes invalid cancellation/payment actions.

- [ ] **Step 7: Run frontend tests, typecheck, and build**

```bash
npm test -- resources/js/lib/active-order-card-state.test.ts
npm run types:check
npm run build
```

Expected: helper tests and build pass. Record pre-existing typecheck failures separately if present.

- [ ] **Step 8: Commit**

```bash
git add resources/js/components/customer/active-order-card.tsx resources/js/pages/customer/orders/index.tsx
git commit -m "fix: show clickable active refund order cards"
```

---

### Task 4: Final regression verification and docs

**Files:**
- Modify: `docs/PROGRESS.md`
- Confirm: Task 1-3 files

- [ ] **Step 1: Update Phase 8 progress row**

Update the existing customer refund visibility row to:

```markdown
| Customer refund order visibility | ✅ Done — active refund states stay in Pesanan Aktif with status badges and full-card navigation across Orders, Home, guest recovery |
```

- [ ] **Step 2: Run focused backend tests**

```bash
php artisan test \
  tests/Feature/ActiveRefundOrderVisibilityTest.php \
  tests/Feature/CustomerOrderSeparationTest.php \
  tests/Feature/GuestRefundExperienceTest.php
```

Expected: PASS.

- [ ] **Step 3: Run frontend test and static checks**

```bash
npm test -- resources/js/lib/active-order-card-state.test.ts
npm run lint:check
npm run format:check
npm run types:check
npm run build
```

Do not run mutating lint/format commands. Record any pre-existing failures accurately.

- [ ] **Step 4: Commit docs**

```bash
git add docs/PROGRESS.md docs/superpowers/specs/2026-07-27-active-refund-order-card-design.md docs/superpowers/plans/2026-07-27-active-refund-order-card.md
git commit -m "docs: record active refund card UX"
```

- [ ] **Step 5: Final diff inspection**

```bash
git status --short
git log --oneline -5
git diff --stat origin/develop...HEAD
```

Expected: clean working tree; only approved payload, card presentation, tests, and docs.

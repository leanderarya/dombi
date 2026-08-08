import { describe, expect, it } from 'vitest';
import {
    isTerminal,
    isCancellable,
    getPaymentIssue,
    getBadgeProps,
    normalizeOrder,
} from './order-status';

describe('isTerminal', () => {
    it('marks the 6 terminal statuses terminal', () => {
        for (const s of [
            'completed',
            'cancelled_by_customer',
            'cancelled_by_outlet',
            'rejected_by_outlet',
            'failed_delivery',
            'expired',
        ]) {
            expect(isTerminal(s)).toBe(true);
        }
    });

    it('marks active statuses non-terminal', () => {
        expect(isTerminal('pending_confirmation')).toBe(false);
        expect(isTerminal('delivering')).toBe(false);
    });
});

describe('isCancellable', () => {
    it('only allows pending_confirmation', () => {
        expect(isCancellable('pending_confirmation')).toBe(true);
        expect(isCancellable('confirmed')).toBe(false);
        expect(isCancellable('preparing')).toBe(false);
    });
});

describe('getPaymentIssue', () => {
    it('flags failed and expired', () => {
        expect(getPaymentIssue('failed')).toEqual({ isFailed: true });
        expect(getPaymentIssue('expired')).toEqual({ isFailed: false });
    });

    it('returns null for paid/unpaid/null', () => {
        expect(getPaymentIssue('paid')).toBeNull();
        expect(getPaymentIssue('unpaid')).toBeNull();
        expect(getPaymentIssue(null)).toBeNull();
    });
});

describe('getBadgeProps', () => {
    it('shows Menunggu Kurir for delivery ready_for_pickup', () => {
        expect(
            getBadgeProps({
                status: 'ready_for_pickup',
                isPickup: false,
            }),
        ).toEqual({ badgeVariant: 'info', badgeLabel: 'Menunggu Kurir' });
    });

    it('maps payment failure to payment_failed fallback', () => {
        expect(
            getBadgeProps({
                status: 'pending_confirmation',
                paymentStatus: 'failed',
                isPickup: true,
            }),
        ).toEqual({ badgeFallbackStatus: 'payment_failed' });
    });

    it('maps unpaid pending to pending_payment fallback', () => {
        expect(
            getBadgeProps({
                status: 'pending_confirmation',
                paymentStatus: 'unpaid',
                isPickup: true,
            }),
        ).toEqual({ badgeFallbackStatus: 'pending_payment' });
    });

    it('falls back to raw status otherwise', () => {
        expect(
            getBadgeProps({
                status: 'delivering',
                paymentStatus: 'paid',
                isPickup: false,
            }),
        ).toEqual({ badgeFallbackStatus: 'delivering' });
    });
});

describe('normalizeOrder', () => {
    it('is idempotent on an already-normalized order', () => {
        const order: any = {
            status: 'completed',
            payment_status: 'paid',
            fulfillment_type: 'delivery',
            order_code: 'DOM-1',
            total: 100,
        };
        expect(normalizeOrder(order)).toEqual(order);
    });
});

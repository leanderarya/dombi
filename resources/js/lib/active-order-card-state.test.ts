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

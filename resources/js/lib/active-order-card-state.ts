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

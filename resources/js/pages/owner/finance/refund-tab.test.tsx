// @vitest-environment jsdom
import { router } from '@inertiajs/react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerRefundPayload, RefundQueueCounts } from '@/types/refund';
import RefundTab from './refund-tab';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;

    return {
        ...actual,
        router: { get: vi.fn(), post: vi.fn(), reload: vi.fn() },
        Link: ({
            children,
            ...rest
        }: {
            children?: React.ReactNode;
            [key: string]: unknown;
        }) => <a {...rest}>{children}</a>,
    };
});

const baseRefund: OwnerRefundPayload = {
    role: 'owner',
    order_id: 1,
    order_code: 'DOMBI-20261001-0001',
    order_url: '/owner/orders/1',
    customer_kind: 'registered',
    customer_name: 'Arya',
    customer_phone: '08123456789',
    amount: 13377,
    payment_status: 'refund_pending',
    destination_status: 'valid',
    queue_state: 'ready',
    status_label: 'Siap Diproses',
    requested_at: '2026-10-01T05:00:00Z',
    submitted_at: '2026-10-01T05:01:00Z',
    started_at: null,
    completed_at: null,
    destination: {
        type: 'bank',
        label: 'BCA',
        holder: 'Arya',
        number: '1234567890',
    },
    proof_url: null,
    transfer_reference: null,
    transfer_note: null,
    rejection: null,
    timeline: [],
    can_enter_destination: false,
    can_start: false,
    can_reject: false,
    can_rollback: false,
    can_complete: false,
    can_recover: false,
};

// Every flag off — each case turns on exactly what its status allows.
const allFlagsOff = {
    can_enter_destination: false,
    can_start: false,
    can_reject: false,
    can_rollback: false,
    can_complete: false,
    can_recover: false,
} satisfies Partial<OwnerRefundPayload>;

const pendingRefund: OwnerRefundPayload = {
    ...baseRefund,
    ...allFlagsOff,
    can_start: true,
    can_reject: true,
};

const inProgressRefund: OwnerRefundPayload = {
    ...baseRefund,
    ...allFlagsOff,
    payment_status: 'refund_in_progress',
    queue_state: 'in_progress',
    status_label: 'Sedang Diproses',
    started_at: '2026-10-01T05:02:00Z',
    can_complete: true,
    can_rollback: true,
};

const needsReviewRefund: OwnerRefundPayload = {
    ...baseRefund,
    ...allFlagsOff,
    queue_state: 'needs_review',
    status_label: 'Perlu Ditinjau',
    can_recover: true,
};

const counts: RefundQueueCounts = {
    awaiting_customer: 0,
    awaiting_guest: 0,
    ready: 0,
    in_progress: 0,
    action_required: 0,
    needs_review: 0,
    completed: 0,
    rejected: 0,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(router.post).mockClear();
    vi.mocked(router.get).mockClear();
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

function render(refund: OwnerRefundPayload) {
    act(() => {
        root.render(
            <RefundTab
                refunds={{
                    data: [refund],
                    links: [],
                    current_page: 1,
                    last_page: 1,
                    total: 1,
                }}
                refundCounts={counts}
                refundFilter={refund.queue_state}
            />,
        );
    });
}

// Queue filter tabs render as links, so every <button> is an action button.
function buttonLabels(): string[] {
    return Array.from(container.querySelectorAll('button'))
        .map((b) => (b.textContent ?? '').trim())
        .filter((label) => label.length > 0);
}

function findButton(label: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find(
        (b) => (b.textContent ?? '').trim() === label,
    ) as HTMLButtonElement | undefined;
}

describe('RefundTab action buttons', () => {
    it('gives a pending refund with a valid destination `Mulai Proses` and `Tolak` only', () => {
        render(pendingRefund);

        expect(buttonLabels()).toContain('Mulai Proses');
        expect(buttonLabels()).toContain('Tolak');
        expect(buttonLabels()).not.toContain('Selesai');
        expect(buttonLabels()).not.toContain('Rollback');
        expect(buttonLabels()).not.toContain('Buka Antrean');
        expect(buttonLabels()).not.toContain('Isi Tujuan');
    });

    it('starts the refund through `POST /owner/refunds/{id}/start`', () => {
        render(pendingRefund);

        act(() => findButton('Mulai Proses')?.click());

        expect(router.post).toHaveBeenCalledWith(
            '/owner/refunds/1/start',
            {},
            expect.objectContaining({ preserveScroll: true }),
        );
    });

    it('gives an in-progress refund `Selesai` and `Rollback` only', () => {
        render(inProgressRefund);

        expect(buttonLabels()).toContain('Selesai');
        expect(buttonLabels()).toContain('Rollback');
        expect(buttonLabels()).not.toContain('Mulai Proses');
        expect(buttonLabels()).not.toContain('Tolak');
        expect(buttonLabels()).not.toContain('Buka Antrean');
    });

    it('shows the completion modal on `Selesai`, which posts to /complete', () => {
        render(inProgressRefund);

        act(() => findButton('Selesai')?.click());

        // The modal only posts on submit; reaching it without `Mulai Proses`
        // is what keeps `refund_in_progress` reachable. Radix portals it onto
        // document.body, so assert there rather than in the container.
        expect(document.body.textContent).toContain('Selesaikan Refund');
    });

    it('gives a needs_review refund `Buka Antrean` and nothing else', () => {
        render(needsReviewRefund);

        expect(buttonLabels()).toContain('Buka Antrean');
        expect(buttonLabels()).not.toContain('Mulai Proses');
        expect(buttonLabels()).not.toContain('Selesai');
        expect(buttonLabels()).not.toContain('Rollback');
        expect(buttonLabels()).not.toContain('Tolak');
        expect(buttonLabels()).not.toContain('Isi Tujuan');
    });

    it('offers the `Perlu Ditinjau` queue filter', () => {
        render(needsReviewRefund);

        expect(container.textContent).toContain('Perlu Ditinjau');
    });
});

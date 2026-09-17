// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrdersIndex from './index';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;

    return {
        ...actual,
        Head: () => null,
        router: { get: vi.fn(), reload: vi.fn() },
        Link: ({
            children,
            ...rest
        }: {
            children?: React.ReactNode;
            [key: string]: unknown;
        }) => <a {...rest}>{children}</a>,
        usePage: () => ({
            component: 'customer/orders/index',
            props: { auth: { user: { id: 1 } } },
            url: '/customer/orders',
            version: 'test',
            scrollRegions: [],
            rememberedState: {},
            resolvedErrors: {},
        }),
    };
});

const baseOrder = {
    id: 1,
    order_code: 'DOMBI-20260917-0001',
    status: 'pending_confirmation',
    payment_status: 'pending',
    fulfillment_type: 'pickup' as const,
    total: 32000,
    ordered_at: '2026-09-17T10:00:00Z',
    created_at: '2026-09-17T10:00:00Z',
    outlet_id: 1,
    recovery_token: 'tok',
    customer_address: null,
    outlet: { id: 1, name: 'Gayamsari, Semarang' },
    items: [{ product_name: 'Es Kopi Susu', quantity: 2 }],
    refund_badge: null,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

function render(props: Record<string, unknown>) {
    act(() => {
        root.render(
            <OrdersIndex
                {...(props as unknown as Parameters<typeof OrdersIndex>[0])}
            />,
        );
    });
}

describe('OrdersIndex', () => {
    it('renders active orders without crashing', () => {
        render({
            activeOrders: [baseOrder],
            historyOrders: {
                data: [],
                links: [],
                current_page: 1,
                last_page: 1,
                per_page: 10,
                total: 0,
            },
        });

        expect(container.textContent).toContain('Pesanan Aktif');
    });

    it('renders history orders without crashing', () => {
        render({
            activeOrders: [],
            historyOrders: {
                data: [{ ...baseOrder, id: 2, status: 'completed' }],
                links: [],
                current_page: 1,
                last_page: 1,
                per_page: 10,
                total: 1,
            },
        });

        expect(container.textContent).toContain('Riwayat Pesanan');
    });

    it('renders the empty state without crashing', () => {
        render({
            activeOrders: [],
            historyOrders: {
                data: [],
                links: [],
                current_page: 1,
                last_page: 1,
                per_page: 10,
                total: 0,
            },
        });

        expect(container.textContent).toContain('Pernah pesan sebelumnya?');
    });
});

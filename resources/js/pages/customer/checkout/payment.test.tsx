// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentPage from './payment';

const SCRIPT_URL =
    'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js';
const PAYMENT_URL = 'https://sandbox.doku.com/checkout/link/PAY1';

const baseDraft = {
    fulfillment: { fulfillment_type: 'pickup' },
    customer: { customer_name: 'Arya', phone_number: '6281234567890' },
    items: [{ product_id: 1, quantity: 1, name: 'Mie', subtotal: 10000 }],
};
const baseSummary = {
    subtotal: 10000,
    delivery_fee: 0,
    payment_options: [{ value: 'qris', label: 'QRIS' }],
};

const { openDokuCheckoutMock, routerMock } = vi.hoisted(() => ({
    openDokuCheckoutMock: vi.fn(),
    routerMock: {
        visit: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        reload: vi.fn(),
        replace: vi.fn(),
        on: vi.fn(),
    },
}));

vi.mock('@/lib/doku-checkout', () => ({
    openDokuCheckout: openDokuCheckoutMock,
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;

    return {
        ...actual,
        Head: () => null,
        router: routerMock,
        usePage: () => ({
            component: 'customer/checkout/payment',
            props: { auth: {} },
            url: '/customer/checkout/payment',
            version: 'test',
            scrollRegions: [],
            rememberedState: {},
            resolvedErrors: {},
        }),
    };
});

type JsonShape = Record<string, unknown>;

function jsonResponse(body: JsonShape, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        redirected: false,
        url: 'http://localhost:3000/',
        headers: { get: () => 'application/json' },
        json: async () => body,
    } as unknown as Response;
}

let paymentStatusBody: JsonShape = { payment_status: 'pending' };

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderPage() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
        root!.render(
            <PaymentPage
                draft={baseDraft}
                summary={baseSummary}
                dokuCheckoutJs={SCRIPT_URL}
            />,
        );
    });
}

function unmount() {
    if (root) {
        act(() => root!.unmount());
        root = null;
    }

    if (container) {
        container.remove();
        container = null;
    }
}

function clickButton(matching: string): HTMLButtonElement {
    const button = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(matching),
    );
    expect(button, `expected a button containing "${matching}"`).toBeTruthy();

    act(() => (button as HTMLButtonElement).click());

    return button as HTMLButtonElement;
}

function stubFetch() {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/customer/checkout/validate-stock')) {
            return Promise.resolve(jsonResponse({ valid: true }));
        }

        if (url.includes('/customer/orders/')) {
            return Promise.resolve(jsonResponse(paymentStatusBody));
        }

        if (url.includes('/customer/checkout/payment')) {
            return Promise.resolve(
                jsonResponse({
                    payment_url: PAYMENT_URL,
                    order: { id: 99, order_code: 'ORD-99' },
                }),
            );
        }

        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    openDokuCheckoutMock.mockReset().mockResolvedValue(true);
    routerMock.visit.mockReset();
    vi.spyOn(window, 'open').mockImplementation(() => null);
    paymentStatusBody = { payment_status: 'pending' };
    stubFetch();
    renderPage();
});

afterEach(() => {
    unmount();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

async function flushAsync() {
    // Flush the promise chain + React state updates started by the click.
    await act(async () => {
        for (let i = 0; i < 10; i++) {
            await Promise.resolve();
        }
    });
}

describe('PaymentPage submit', () => {
    it('opens the DOKU modal instead of a full-page redirect and enters waiting mode', async () => {
        clickButton('Bayar');
        await flushAsync();

        expect(openDokuCheckoutMock).toHaveBeenCalledWith(
            PAYMENT_URL,
            SCRIPT_URL,
        );

        // Waiting mode UI: button label flips, retry affordance present.
        expect(document.body.textContent).toContain(
            'Pembayaran sedang diproses di DOKU',
        );
        expect(document.body.textContent).toContain('Selesaikan Pembayaran');
        expect(document.body.textContent).toContain('Menunggu pembayaran');
        expect(document.body.textContent).toContain('ORD-99');
    });

    it('falls back to a new tab when the DOKU modal cannot be opened', async () => {
        openDokuCheckoutMock.mockResolvedValue(false);

        clickButton('Bayar');
        await flushAsync();

        expect(window.open).toHaveBeenCalledWith(
            PAYMENT_URL,
            '_blank',
            'noopener,noreferrer',
        );
        expect(document.body.textContent).toContain(
            'Kami belum dapat menampilkan pembayaran di dalam aplikasi. Pembayaran dibuka di tab baru.',
        );
    });

    it('re-opens the same DOKU session from the "Selesaikan Pembayaran" retry button', async () => {
        clickButton('Bayar');
        await flushAsync();
        openDokuCheckoutMock.mockClear();

        clickButton('Selesaikan Pembayaran');
        await flushAsync();

        expect(openDokuCheckoutMock).toHaveBeenCalledWith(
            PAYMENT_URL,
            SCRIPT_URL,
        );
    });

    it('stops polling and navigates in-app to the confirmation page once paid', async () => {
        vi.useFakeTimers();
        paymentStatusBody = { payment_status: 'paid' };

        clickButton('Bayar');
        await act(async () => {
            for (let i = 0; i < 10; i++) {
                await Promise.resolve();
            }
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        expect(routerMock.visit).toHaveBeenCalledWith(
            '/customer/orders/confirm/ORD-99',
        );
    });

    it('surfaces a failed payment status and stops polling', async () => {
        vi.useFakeTimers();
        paymentStatusBody = { payment_status: 'failed' };

        clickButton('Bayar');
        await act(async () => {
            for (let i = 0; i < 10; i++) {
                await Promise.resolve();
            }
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        expect(document.body.textContent).toMatch(
            /Pembayaran tidak berhasil diproses/i,
        );

        const statusFetches = (
            global.fetch as ReturnType<typeof vi.fn>
        ).mock.calls.filter(([input]) =>
            String(input).includes('/customer/orders/'),
        ).length;
        expect(statusFetches).toBe(1);

        // Advance well past one interval: no further polling after terminal status.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(15000);
        });

        const statusFetchesAfter = (
            global.fetch as ReturnType<typeof vi.fn>
        ).mock.calls.filter(([input]) =>
            String(input).includes('/customer/orders/'),
        ).length;
        expect(statusFetchesAfter).toBe(1);
    });
});

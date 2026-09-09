// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConfirmPage from './confirm';

const SCRIPT_URL =
    'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js';
const PAYMENT_URL = 'https://sandbox.doku.com/checkout/link/PAY1';

const baseOrder = {
    id: 42,
    order_code: 'ORD-42',
    payment_method: 'qris',
    payment_status: 'pending',
    confirmation_expires_at: new Date(Date.now() + 60_000).toISOString(),
    items: [{ product_name: 'Mie', quantity: 1, subtotal: 10000 }],
    total: 10000,
    outlet: { name: 'Outlet Gacoan' },
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
            component: 'customer/orders/confirm',
            props: { auth: {} },
            url: '/customer/orders/confirm/ORD-42',
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
let payResponseBody: JsonShape = { payment_url: PAYMENT_URL };
let payResponseStatus = 200;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderPage(order: JsonShape = baseOrder) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
        root!.render(
            <ConfirmPage
                order={order}
                isLoggedIn
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

        if (url.includes('/payment-status')) {
            return Promise.resolve(jsonResponse(paymentStatusBody));
        }

        if (url.includes('/pay')) {
            return Promise.resolve(
                jsonResponse(payResponseBody, payResponseStatus),
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
    payResponseBody = { payment_url: PAYMENT_URL };
    payResponseStatus = 200;
    stubFetch();
    renderPage();
});

afterEach(() => {
    unmount();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

async function flushAsync() {
    await act(async () => {
        for (let i = 0; i < 10; i++) {
            await Promise.resolve();
        }
    });
}

describe('ConfirmPage handlePay', () => {
    it('submits a JSON POST to /pay and opens the DOKU modal in-app', async () => {
        clickButton('Lanjutkan Pembayaran');
        await flushAsync();

        const fetchCalls = (global.fetch as unknown as ReturnType<typeof vi.fn>)
            .mock.calls;
        const payCall = fetchCalls.find(
            ([input, init]) =>
                String(input).includes('/pay') &&
                (init as RequestInit)?.method === 'POST',
        );
        expect(payCall).toBeTruthy();

        const [input, init] = payCall as [unknown, RequestInit];
        expect(String(input)).toBe('/customer/orders/42/pay');
        expect(init.headers).toMatchObject({
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': '',
        });
        expect(init.body).toBe(JSON.stringify({ payment_method: 'qris' }));

        expect(openDokuCheckoutMock).toHaveBeenCalledWith(
            PAYMENT_URL,
            SCRIPT_URL,
        );
    });

    it('falls back to a new tab + message when the DOKU modal cannot open', async () => {
        openDokuCheckoutMock.mockResolvedValue(false);

        clickButton('Lanjutkan Pembayaran');
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

    it('surfaces an error message on a non-OK pay response', async () => {
        payResponseStatus = 422;

        clickButton('Lanjutkan Pembayaran');
        await flushAsync();

        expect(document.body.textContent).toContain(
            'Terjadi kesalahan saat memproses pembayaran. Silakan coba lagi.',
        );
        expect(openDokuCheckoutMock).not.toHaveBeenCalled();
    });
});

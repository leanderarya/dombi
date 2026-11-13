// @vitest-environment jsdom
import { router } from '@inertiajs/react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FinanceIndex from './index';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;

    return {
        ...actual,
        router: { get: vi.fn() },
    };
});

vi.mock('@/components/owner/owner-page-shell', () => ({
    default: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

vi.mock('@/components/owner/owner-segmented-tabs', () => ({
    default: ({
        tabs,
        activeTab,
        onChange,
    }: {
        tabs: { key: string; label: string }[];
        activeTab: string;
        onChange: (key: string) => void;
    }) => (
        <div>
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    aria-selected={activeTab === tab.key}
                    onClick={() => onChange(tab.key)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    ),
}));

vi.mock('@/components/ui/skeleton', () => ({
    SkeletonPage: () => <div data-testid="finance-loading" />,
}));

vi.mock('./tagihan-tab', () => ({
    default: () => <div data-view="tagihan" />,
}));

vi.mock('./pembayaran-tab', () => ({
    default: () => <div data-view="pembayaran" />,
}));

vi.mock('./rekening-tab', () => ({
    default: () => <div data-view="rekening" />,
}));

vi.mock('./refund-tab', () => ({
    default: () => <div data-view="refund" />,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    window.history.replaceState({}, '', '/owner/finance');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(router.get).mockClear();
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('FinanceIndex tab loading', () => {
    it('requests a tab once and hides the previous tab until its props arrive', () => {
        act(() => {
            root.render(<FinanceIndex tab="tagihan" kpis={{}} outlets={[]} />);
        });

        expect(container.querySelector('[data-view="tagihan"]')).not.toBeNull();

        act(() => {
            container
                .querySelector<HTMLButtonElement>('button:nth-child(4)')
                ?.click();
        });
        act(() => {
            container
                .querySelector<HTMLButtonElement>('button:nth-child(4)')
                ?.click();
        });

        expect(router.get).toHaveBeenCalledTimes(1);
        expect(router.get).toHaveBeenCalledWith(
            '/owner/finance',
            { tab: 'refund' },
            expect.objectContaining({ preserveState: true, replace: true }),
        );
        expect(
            container.querySelector('[data-testid="finance-loading"]'),
        ).not.toBeNull();
        expect(container.querySelector('[data-view="tagihan"]')).toBeNull();
        expect(container.querySelector('[data-view="refund"]')).toBeNull();

        const onFinish = vi.mocked(router.get).mock.calls[0]?.[2]?.onFinish as
            (() => void) | undefined;
        act(() => {
            window.history.replaceState({}, '', '/owner/finance?tab=refund');
            root.render(
                <FinanceIndex
                    tab="refund"
                    refunds={{ data: [] }}
                    refundCounts={{}}
                    refundFilter="ready"
                />,
            );
            onFinish?.();
        });

        expect(
            container.querySelector('[data-testid="finance-loading"]'),
        ).toBeNull();
        expect(container.querySelector('[data-view="refund"]')).not.toBeNull();
    });
});

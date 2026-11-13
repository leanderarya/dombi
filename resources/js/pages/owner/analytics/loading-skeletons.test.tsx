// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditTrailTab } from './audit-tab';
import { DashboardTab } from './dashboard-tab';
import {
    AnalyticsAuditSkeleton,
    AnalyticsDashboardSkeleton,
    AnalyticsIssuesSkeleton,
} from './loading-skeletons';
import { MasalahTab } from './masalah-tab';
import AnalyticsIndex from './index';

vi.mock('@inertiajs/react', () => ({
    Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
        <a {...props}>{children}</a>
    ),
    router: { get: vi.fn() },
}));

vi.mock('@/components/owner/owner-page-shell', () => ({
    default: ({
        children,
        title,
    }: React.PropsWithChildren<{ title: string }>) => (
        <>
            <header>
                <h1>{title}</h1>
            </header>
            <main>{children}</main>
        </>
    ),
}));

vi.mock('@/components/owner/filter-sheet', () => ({
    default: () => null,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState({}, '', '/');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.history.replaceState({}, '', '/');
});

function render(ui: React.ReactElement): HTMLElement {
    act(() => root.render(ui));

    return container;
}

describe('Analytics loading skeletons', () => {
    it('matches Dashboard KPI and panel breakpoints without a page heading', () => {
        const el = render(<AnalyticsDashboardSkeleton />);

        expect(
            el
                .querySelector('[role="status"][aria-busy="true"]')
                ?.getAttribute('aria-label'),
        ).toBe('Memuat dashboard analitik');
        expect(el.querySelector('[class*="lg:grid-cols-4"]')).not.toBeNull();
        expect(el.querySelector('[class*="lg:grid-cols-2"]')).not.toBeNull();
        expect(el.querySelector('h1')).toBeNull();
    });

    it('matches Audit Trail rows and desktop sidebar breakpoint', () => {
        const el = render(<AnalyticsAuditSkeleton />);

        expect(
            el.querySelector('[role="status"]')?.getAttribute('aria-label'),
        ).toBe('Memuat audit stok');
        expect(
            el.querySelector('[class*="lg:grid-cols-[1fr_320px]"]'),
        ).not.toBeNull();
        expect(el.querySelector('[class*="hidden lg:block"]')).not.toBeNull();
        expect(el.querySelectorAll('[class*="shadow-card"]')).toHaveLength(10);
        expect(el.querySelector('h1')).toBeNull();
    });

    it('matches Issues filters and stacked report cards', () => {
        const el = render(<AnalyticsIssuesSkeleton />);

        expect(
            el.querySelector('[role="status"]')?.getAttribute('aria-label'),
        ).toBe('Memuat laporan masalah');
        expect(el.querySelector('[class*="flex-wrap"]')).not.toBeNull();
        expect(el.querySelectorAll('[class*="shadow-card"]')).toHaveLength(5);
        expect(el.querySelector('h1')).toBeNull();
    });

    it('replaces Dashboard skeleton with content when props arrive', () => {
        const el = render(<DashboardTab />);

        expect(el.querySelector('[role="status"]')).not.toBeNull();

        render(
            <DashboardTab
                kpis={{
                    total_revenue: 120000,
                    total_orders: 2,
                    active_outlets: 1,
                }}
            />,
        );

        expect(el.querySelector('[role="status"]')).toBeNull();
        expect(el.textContent).toContain('Pendapatan per Outlet');
    });

    it('replaces Audit Trail skeleton with movement content when props arrive', () => {
        const el = render(<AuditTrailTab />);

        expect(el.querySelector('[role="status"]')).not.toBeNull();

        render(
            <AuditTrailTab
                movements={{
                    data: [
                        {
                            id: 1,
                            quantity: 1,
                            product: { name: 'Produk contoh' },
                            outlet: { name: 'Outlet contoh' },
                            type: 'restock_in',
                            before_stock: 2,
                            after_stock: 3,
                            created_at: '2026-11-09T00:00:00Z',
                        },
                    ],
                }}
            />,
        );

        expect(el.querySelector('[role="status"]')).toBeNull();
        expect(el.textContent).toContain('Produk contoh');
    });

    it('replaces Issues skeleton with report content when props arrive', () => {
        const el = render(<MasalahTab />);

        expect(el.querySelector('[role="status"]')).not.toBeNull();

        render(
            <MasalahTab
                reports={{
                    data: [
                        {
                            id: 1,
                            order_id: 2,
                            order: { order_code: 'ORDER-EXAMPLE' },
                            customer: { name: 'Customer contoh' },
                            status: 'pending',
                            type: 'damaged',
                            created_at: '2026-11-09T00:00:00Z',
                        },
                    ],
                }}
            />,
        );

        expect(el.querySelector('[role="status"]')).toBeNull();
        expect(el.textContent).toContain('ORDER-EXAMPLE');
    });

    it.each([
        ['dashboard', 'Memuat dashboard analitik'],
        ['audit', 'Memuat audit stok'],
        ['masalah', 'Memuat laporan masalah'],
    ])(
        'uses the %s skeleton and keeps shell as sole header on initial load',
        (tab, label) => {
            window.history.replaceState({}, '', `/owner/analytics?tab=${tab}`);
            const el = render(<AnalyticsIndex />);

            expect(el.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
            expect(el.querySelectorAll('h1')).toHaveLength(1);
        },
    );
});

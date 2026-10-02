// @vitest-environment jsdom
import { act, cloneElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type * as Recharts from 'recharts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * jsdom has no layout, so recharts' `ResponsiveContainer` measures nothing and
 * never paints the SVG. Swapping it for a pass-through that supplies concrete
 * dimensions is what lets the chart render far enough to be asserted on — the
 * rest of recharts stays real, so this exercises the library's own
 * accessibilityLayer wiring rather than a stand-in for it.
 */
vi.mock('recharts', async () => {
    const actual: typeof Recharts = await vi.importActual('recharts');

    return {
        ...actual,
        ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
            cloneElement(children as React.ReactElement<Record<string, unknown>>, {
                width: 400,
                height: 220,
            }),
    };
});

import RevenueTrendChart from './revenue-trend-chart';
import TopProductsChart from './top-products-chart';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

function render(ui: React.ReactElement): SVGSVGElement {
    act(() => root.render(ui));

    const svg = container.querySelector('svg.recharts-surface');

    expect(svg).not.toBeNull();

    return svg as SVGSVGElement;
}

const revenue = [
    { date: '2026-09-30', revenue: 120_000 },
    { date: '2026-10-01', revenue: 135_000 },
];

const products = [
    { product_name: 'Domilk Premium Taste', total_qty: 9, total_revenue: 135_000 },
];

describe('outlet chart accessible names', () => {
    // Recharts 3.9.2 defaults `accessibilityLayer` to true, which puts
    // tabIndex=0 and role=application on the root <svg>. It does not give the
    // element a name, so a keyboard user landed on a tab stop and a screen
    // reader announced an unnamed application. Measured on /outlet/analytics:
    // `{"role":"application","name":"","focusable":true,"ignored":false}`.
    it('names the revenue chart after the heading the page shows', () => {
        const svg = render(<RevenueTrendChart data={revenue} />);

        expect(svg.querySelector('title')?.textContent).toBe('Trend Revenue');
    });

    it('names the top-products chart after the heading the page shows', () => {
        const svg = render(<TopProductsChart data={products} />);

        expect(svg.querySelector('title')?.textContent).toBe('Produk Terlaris');
    });

    // The tab stop itself is the library's; keeping it is deliberate. If a
    // future recharts flips the default, this fails loudly rather than the
    // accessible name quietly becoming dead weight.
    it('keeps the charts reachable by keyboard', () => {
        const svg = render(<RevenueTrendChart data={revenue} />);

        expect(svg.getAttribute('tabindex')).toBe('0');
    });

    it('does not label the empty state, which is not a chart', () => {
        act(() => root.render(<RevenueTrendChart data={[]} />));

        expect(container.querySelector('svg.recharts-surface')).toBeNull();
        expect(container.textContent).toContain('Belum ada data penjualan');
    });
});

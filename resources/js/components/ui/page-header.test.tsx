// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PageHeader from './page-header';

vi.mock('@inertiajs/react', () => ({
    Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
        <a {...props}>{children}</a>
    ),
}));

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

function render(ui: React.ReactElement): HTMLElement {
    act(() => root.render(ui));

    return container;
}

describe('PageHeader reflow', () => {
    // Measured at 200% text on a 320px viewport: the header overflowed by
    // 86px because the title block's automatic minimum was its own content
    // width, so it pushed the 88px icon buttons off the right edge and the
    // notification bell became unreachable. A flex item only reflows once
    // that minimum is released.
    it('releases the title block minimum so the row can shrink', () => {
        const el = render(<PageHeader title="Dashboard" onMenuClick={() => {}} />);
        const titleBlock = el.querySelector('h1')?.parentElement;

        expect(titleBlock?.className).toContain('min-w-0');
    });

    // The inverse: the icon slots must NOT shrink, or releasing the title's
    // minimum would simply squash the 44px targets instead of wrapping text.
    it('holds the icon slots at their size', () => {
        const el = render(<PageHeader title="Dashboard" onMenuClick={() => {}} />);
        const leftSlot = el.querySelector('button[aria-label="Menu"]')
            ?.parentElement;
        const rightSlot = el.querySelector('h1')?.parentElement
            ?.nextElementSibling;

        expect(leftSlot?.className).toContain('shrink-0');
        expect(rightSlot?.className).toContain('shrink-0');
    });

    it('lets a long single-word title break rather than overflow', () => {
        const el = render(<PageHeader title="Pengiriman" />);

        expect(el.querySelector('h1')?.className).toContain('break-words');
    });
});

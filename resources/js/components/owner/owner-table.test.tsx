// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import OwnerTable from './owner-table';

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

function render(node: React.ReactNode) {
    act(() => root.render(node));

    return container.firstElementChild as HTMLElement;
}

describe('OwnerTable', () => {
    it('always renders a horizontal scroll container', () => {
        expect(render(<OwnerTable>x</OwnerTable>).className).toContain(
            'overflow-x-auto',
        );

        // noWrapper drops the chrome, not the scroller. Without one, the
        // minWidth content spills out of its card instead of scrolling.
        const bare = render(<OwnerTable noWrapper>x</OwnerTable>);
        expect(bare.className).toContain('overflow-x-auto');
        expect(bare.className).not.toContain('shadow-card');
        expect(bare.className).not.toContain('ring-1');
    });

    it('applies minWidth to the content so wide tables scroll', () => {
        const el = render(<OwnerTable minWidth="700px">x</OwnerTable>);
        expect((el.firstElementChild as HTMLElement).style.minWidth).toBe(
            '700px',
        );
    });

    it('exposes aria-label as a named, focusable scroll region', () => {
        const el = render(
            <OwnerTable aria-label="Tabel Pengembalian">x</OwnerTable>,
        );

        // A bare aria-label on a plain div is not exposed to assistive tech,
        // and a scroll region needs a tab stop to be reachable without a mouse.
        expect(el.getAttribute('aria-label')).toBe('Tabel Pengembalian');
        expect(el.getAttribute('role')).toBe('region');
        expect(el.getAttribute('tabindex')).toBe('0');
    });

    it('adds no tab stop when no label is given', () => {
        const el = render(<OwnerTable>x</OwnerTable>);

        expect(el.hasAttribute('role')).toBe(false);
        expect(el.hasAttribute('tabindex')).toBe(false);
    });
});

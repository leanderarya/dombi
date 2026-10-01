// @vitest-environment jsdom
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerPageShell from './owner-page-shell';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
        <a {...props}>{children}</a>
    ),
}));

vi.mock('@/layouts/owner-layout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/sidebar-context', () => ({
    useSidebar: () => ({ collapsed: false, toggle: () => {} }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (
        globalThis as typeof globalThis & {
            IS_REACT_ACT_ENVIRONMENT: boolean;
        }
    ).IS_REACT_ACT_ENVIRONMENT = true;
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

    return container.firstElementChild as HTMLElement;
}

describe('OwnerPageShell header controls', () => {
    it('sizes the back link to a 44px touch target and gives it a name', () => {
        const shell = render(
            <OwnerPageShell title="Pesanan" backHref="/owner/orders">
                <div />
            </OwnerPageShell>,
        );
        const back = shell.querySelector('a[href="/owner/orders"]');

        expect(back).not.toBeNull();
        // DESIGN.md line 83 requires 44x44. The link was h-7 w-7 (28px) with
        // no aria-label, so an icon-only control announced nothing.
        expect(back?.className).toContain('h-11');
        expect(back?.className).toContain('w-11');
        expect(back?.getAttribute('aria-label')).toBeTruthy();
    });

    it('sizes the sidebar toggle to 44px', () => {
        const shell = render(
            <OwnerPageShell title="Pesanan">
                <div />
            </OwnerPageShell>,
        );
        const toggle = shell.querySelector('button');

        expect(toggle?.className).toContain('h-11');
        expect(toggle?.className).toContain('w-11');
        expect(toggle?.getAttribute('aria-label')).toBeTruthy();
    });
});

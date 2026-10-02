// @vitest-environment jsdom
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CourierLayout from './courier-layout';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
        <a {...props}>{children}</a>
    ),
    router: { post: vi.fn(), visit: vi.fn() },
    usePage: () => ({ props: { auth: { user: { name: 'Budi Santoso' } } } }),
}));

// The header is built inside CourierLayout and handed to this wrapper as a
// slot, so keeping the wrapper real would drag in the flash-toast and offline
// hooks for nothing. Render the slot and the children directly.
vi.mock('@/components/ui/mobile-role-layout', () => ({
    default: ({
        headerSlot,
        children,
    }: {
        headerSlot?: React.ReactNode;
        children?: React.ReactNode;
    }) => (
        <>
            {headerSlot}
            {children}
        </>
    ),
}));

vi.mock('@/components/shared/notification-bell', () => ({
    default: () => <button aria-label="Aktifkan Notifikasi" />,
}));

vi.mock('@/components/shared/notification-sheet', () => ({
    default: () => null,
}));

vi.mock('@/components/courier/bottom-nav', () => ({
    default: () => <nav />,
}));

vi.mock('@/hooks/use-role-theme', () => ({ useRoleTheme: () => {} }));
vi.mock('@/hooks/use-courier-location', () => ({
    useCourierLocation: () => {},
}));
vi.mock('@/hooks/use-hide-on-scroll', () => ({
    useHideOnScroll: () => ({ visible: true }),
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

describe('CourierLayout header', () => {
    it('keeps the back link at 44px when the row runs out of room', () => {
        const layout = render(
            <CourierLayout title="Pengiriman" backHref="/courier/deliveries">
                <div />
            </CourierLayout>,
        );
        const back = layout.querySelector('a[href="/courier/deliveries"]');

        expect(back).not.toBeNull();
        expect(back?.className).toContain('h-11');
        expect(back?.className).toContain('w-11');
        // Without `shrink-0` flexbox tightened this link to 34x44 at 320px and
        // 42x44 at 360px, while both icon siblings beside it held 44px.
        expect(back?.className).toContain('shrink-0');
        expect(back?.getAttribute('aria-label')).toBe('Kembali');
    });
});

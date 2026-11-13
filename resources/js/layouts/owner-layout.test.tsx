// @vitest-environment jsdom
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerLayout from './owner-layout';

const inertia = vi.hoisted(() => ({
    pageProps: {
        appVersion: '1.0.0',
        auth: { user: { role: 'owner' as string } as { role: string } | null },
    },
    listeners: new Map<
        string,
        Set<(event: { detail: { visit: { url: string | URL } } }) => void>
    >(),
    emit(name: string, event: { detail: { visit: { url: string | URL } } }) {
        this.listeners.get(name)?.forEach((listener) => listener(event));
    },
}));

vi.mock('@inertiajs/react', () => ({
    router: {
        post: vi.fn((url: string) => {
            if (url === '/logout') {
                inertia.emit('before', {
                    detail: {
                        visit: {
                            url: new URL(url, 'http://localhost'),
                        },
                    },
                });
            }
        }),
        visit: vi.fn(),
        on: (
            name: string,
            listener: (event: {
                detail: { visit: { url: string | URL } };
            }) => void,
        ) => {
            const listeners = inertia.listeners.get(name) ?? new Set();
            listeners.add(listener);
            inertia.listeners.set(name, listeners);

            return () => listeners.delete(listener);
        },
    },
    usePage: () => ({ props: inertia.pageProps }),
}));

vi.mock('@/components/owner/owner-command-sheet', () => ({
    default: () => null,
}));
vi.mock('@/components/owner/owner-page-skeleton', () => ({
    default: () => <div data-testid="global-skeleton" />,
}));
vi.mock('@/components/owner/owner-sidebar-nav', () => ({
    default: () => null,
}));
vi.mock('@/components/shared/notification-sheet', () => ({
    default: () => null,
}));
vi.mock('@/hooks/use-push-subscription', () => ({
    usePushSubscription: () => ({
        pushState: 'active',
        requestEnable: vi.fn(),
    }),
}));
vi.mock('@/components/shared/offline-banner', () => ({ default: () => null }));
vi.mock('@/components/shared/update-banner', () => ({ default: () => null }));
vi.mock('@/components/ui/brand-mark', () => ({ default: () => null }));
vi.mock('@/contexts/sidebar-context', () => ({
    SidebarProvider: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
    useSidebar: () => ({ collapsed: false, toggle: vi.fn() }),
}));
vi.mock('@/hooks/use-flash-toast', () => ({ useFlashToast: vi.fn() }));
vi.mock('@/hooks/use-inertia-loading', () => ({
    useInertiaLoading: () => ({ loading: true }),
}));
vi.mock('@/hooks/use-role-theme', () => ({ useRoleTheme: vi.fn() }));

let container: HTMLDivElement;
let root: Root | null;

beforeEach(() => {
    (
        globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    inertia.pageProps.auth.user = { role: 'owner' };
    inertia.listeners.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    if (root) {
        act(() => root?.unmount());
        root = null;
    }

    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    inertia.listeners.clear();
});

describe('OwnerLayout navigation loading', () => {
    it('preserves one shared poller across Owner navigation and auth transitions', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            redirected: false,
            url: 'http://localhost/notifications/unread-count',
            json: vi.fn().mockResolvedValue({ unread_count: 3, latest: [] }),
        });
        vi.stubGlobal('fetch', fetchMock);

        act(() =>
            root?.render(
                <OwnerLayout>
                    <div data-testid="page-content">Dashboard</div>
                </OwnerLayout>,
            ),
        );
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(
            container.querySelector('[data-testid="page-content"]')
                ?.textContent,
        ).toBe('Dashboard');
        expect(
            container.querySelector('[data-testid="global-skeleton"]'),
        ).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(1);
        expect(
            [
                ...container.querySelectorAll(
                    'button[aria-label="Notifikasi"] span',
                ),
            ].map((badge) => badge.textContent),
        ).toEqual(['3', '3']);

        act(() =>
            root?.render(
                <OwnerLayout>
                    <div data-testid="page-content">Orders</div>
                </OwnerLayout>,
            ),
        );

        expect(
            container.querySelector('[data-testid="page-content"]')
                ?.textContent,
        ).toBe('Orders');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(1);

        act(() => {
            const logout = [...container.querySelectorAll('button')].find(
                (button) => button.textContent?.trim() === 'Logout',
            );
            logout?.click();
        });

        expect(vi.getTimerCount()).toBe(0);
        inertia.pageProps.auth.user = null;
        act(() =>
            root?.render(
                <OwnerLayout>
                    <div data-testid="page-content">Login transition</div>
                </OwnerLayout>,
            ),
        );
        act(() => vi.advanceTimersByTime(65_000));
        expect(fetchMock).toHaveBeenCalledTimes(1);

        act(() => root?.unmount());
        root = null;
        inertia.pageProps.auth.user = { role: 'owner' };
        root = createRoot(container);
        act(() =>
            root?.render(
                <OwnerLayout>
                    <div data-testid="page-content">Re-login Dashboard</div>
                </OwnerLayout>,
            ),
        );
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(vi.getTimerCount()).toBe(1);
        act(() => root?.unmount());
        root = null;
        act(() => vi.advanceTimersByTime(65_000));
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});

// @vitest-environment jsdom
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushState = vi.hoisted(() => ({ current: 'loading' }));
const inertiaEvents = vi.hoisted(() => ({
    listeners: new Map<
        string,
        Set<(event: { detail: { visit: { url: string | URL } } }) => void>
    >(),
    emit(name: string, event: { detail: { visit: { url: string | URL } } }) {
        this.listeners.get(name)?.forEach((listener) => listener(event));
    },
}));

vi.mock('@/hooks/use-push-subscription', () => ({
    usePushSubscription: () => ({
        pushState: pushState.current,
        requestEnable: () => Promise.resolve(true),
    }),
}));

vi.mock('@inertiajs/react', () => ({
    router: {
        get: vi.fn(),
        post: vi.fn(),
        reload: vi.fn(),
        on: (
            name: string,
            listener: (event: {
                detail: { visit: { url: string | URL } };
            }) => void,
        ) => {
            const listeners = inertiaEvents.listeners.get(name) ?? new Set();
            listeners.add(listener);
            inertiaEvents.listeners.set(name, listeners);

            return () => listeners.delete(listener);
        },
    },
}));

import NotificationBell from './notification-bell';

let container: HTMLDivElement;
let root: Root | null;

beforeEach(() => {
    pushState.current = 'loading';
    inertiaEvents.listeners.clear();
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
    if (root) {
        act(() => root?.unmount());
        root = null;
    }

    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

function render(
    props: React.ComponentProps<typeof NotificationBell> = { unreadCount: 0 },
): HTMLElement {
    act(() => root?.render(<NotificationBell {...props} />));

    return container.firstElementChild as HTMLElement;
}

describe('NotificationBell', () => {
    it('keeps the bell as the only control, at 44px', () => {
        const wrapper = render();
        const buttons = wrapper.querySelectorAll('button');

        // The hint used to be a second, absolutely-positioned button at
        // min-h-6 / 10px, clipped to two thirds of its label inside the
        // collapsed rail. The bell already performs its action.
        expect(buttons).toHaveLength(1);
        expect(buttons[0].className).toContain('h-11');
        expect(buttons[0].className).toContain('w-11');
    });

    it('names the permission prompt while the push state is undetermined', () => {
        const wrapper = render();
        const button = wrapper.querySelector('button');

        // handleClick routes the tap to requestEnable() in this state, so the
        // accessible name has to say so instead of promising the sheet.
        expect(button?.getAttribute('aria-label')).toBe('Aktifkan Notifikasi');
        expect(button?.getAttribute('title')).toBe('Aktifkan Notifikasi');
    });

    it('falls back to naming the sheet once the push state resolves', () => {
        pushState.current = 'active';
        const wrapper = render();
        const button = wrapper.querySelector('button');

        expect(button?.getAttribute('aria-label')).toBe('Notifikasi');
        expect(button?.getAttribute('title')).toBeNull();
    });

    it('reports unread counts from its single polling lifecycle', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ unread_count: 3, latest: [] }),
        });
        const onUnreadCountChange = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        act(() =>
            root?.render(
                <>
                    <NotificationBell
                        onUnreadCountChange={onUnreadCountChange}
                        pollingKey="owner"
                    />
                    <NotificationBell pollingKey="owner" />
                </>,
            ),
        );
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(onUnreadCountChange).toHaveBeenCalledWith(3);

        act(() => root?.unmount());
        root = null;
        act(() => vi.advanceTimersByTime(30_000));
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('stops polling before logout and starts one lifecycle after re-login', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            redirected: false,
            url: 'http://localhost/notifications/unread-count',
            json: vi.fn().mockResolvedValue({ unread_count: 2, latest: [] }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const renderOwnerPollers = () => (
            <>
                <NotificationBell pollingKey="owner" />
                <NotificationBell pollingKey="owner" />
            </>
        );

        act(() => root?.render(renderOwnerPollers()));
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(1);

        act(() =>
            inertiaEvents.emit('before', {
                detail: {
                    visit: { url: new URL('/logout', window.location.origin) },
                },
            }),
        );

        expect(vi.getTimerCount()).toBe(0);
        expect(inertiaEvents.listeners.get('before')?.size ?? 0).toBe(0);
        act(() => vi.advanceTimersByTime(65_000));
        expect(fetchMock).toHaveBeenCalledTimes(1);

        act(() => root?.unmount());
        root = createRoot(container);
        act(() => root?.render(renderOwnerPollers()));
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(vi.getTimerCount()).toBe(1);
    });

    it('aborts an in-flight poll and ignores its late response after logout', async () => {
        vi.useFakeTimers();
        type FetchResponse = {
            ok: boolean;
            json: () => Promise<{ unread_count: number; latest: [] }>;
        };
        const request: {
            resolve?: (response: FetchResponse) => void;
            signal?: AbortSignal;
        } = {};
        const fetchMock = vi.fn(
            (_url: string, options: { signal: AbortSignal }) => {
                request.signal = options.signal;

                return new Promise((resolve) => {
                    request.resolve = (response) => resolve(response);
                });
            },
        );
        const onUnreadCountChange = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        act(() =>
            root?.render(
                <NotificationBell
                    onUnreadCountChange={onUnreadCountChange}
                    pollingKey="owner"
                />,
            ),
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(request.signal?.aborted).toBe(false);

        act(() =>
            inertiaEvents.emit('before', {
                detail: {
                    visit: { url: new URL('/logout', window.location.origin) },
                },
            }),
        );

        expect(request.signal?.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);

        await act(async () => {
            request.resolve?.({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    unread_count: 8,
                    latest: [],
                }),
            });
            await Promise.resolve();
            await Promise.resolve();
        });

        act(() => vi.advanceTimersByTime(65_000));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(onUnreadCountChange).not.toHaveBeenCalled();
    });

    it('stops polling when an unread-count request redirects to login', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            redirected: true,
            url: 'http://localhost/login',
            json: vi.fn(),
        });
        vi.stubGlobal('fetch', fetchMock);

        act(() => root?.render(<NotificationBell pollingKey="owner" />));
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);

        act(() => vi.advanceTimersByTime(65_000));
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not poll when its unread count is controlled', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const wrapper = render({ unreadCount: 4 });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(wrapper.querySelector('span')?.textContent).toBe('4');
    });

    it('does not start polling when the Owner session is inactive', () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        render({ pollingEnabled: false, pollingKey: 'owner' });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
});

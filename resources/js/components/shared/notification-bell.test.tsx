// @vitest-environment jsdom
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushState = vi.hoisted(() => ({ current: 'loading' }));

vi.mock('@/hooks/use-push-subscription', () => ({
    usePushSubscription: () => ({
        pushState: pushState.current,
        requestEnable: () => Promise.resolve(true),
    }),
}));

vi.mock('@inertiajs/react', () => ({
    router: { get: vi.fn(), post: vi.fn(), reload: vi.fn() },
}));

import NotificationBell from './notification-bell';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    pushState.current = 'loading';
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

function render(): HTMLElement {
    act(() => root.render(<NotificationBell unreadCount={0} />));

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
});

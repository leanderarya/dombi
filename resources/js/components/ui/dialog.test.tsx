// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dialog from './dialog';

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

describe('Dialog close control', () => {
    // Three defects shared one control. It was 28x28 against a 44px contract
    // (DESIGN.md line 83); it carried `focus:outline-none` with no ring, the
    // only such control in the repo, so a keyboard user tabbing onto it saw
    // nothing; and `opacity-60` held the icon at 2.38:1 on a light surface,
    // under the 3:1 a UI component needs.
    it('sizes the close control to a 44px touch target', () => {
        act(() =>
            root.render(
                <Dialog open onClose={() => {}} title="Selesaikan Pengiriman">
                    <div />
                </Dialog>,
            ),
        );

        const close = document.body.querySelector(
            '[role="dialog"] button',
        ) as HTMLElement;

        expect(close).not.toBeNull();
        expect(close.className).toContain('h-11');
        expect(close.className).toContain('w-11');
    });

    it('gives the close control a visible focus ring', () => {
        act(() =>
            root.render(
                <Dialog open onClose={() => {}} title="Selesaikan Pengiriman">
                    <div />
                </Dialog>,
            ),
        );

        const close = document.body.querySelector(
            '[role="dialog"] button',
        ) as HTMLElement;

        expect(close.className).toContain('focus-visible:ring-2');
        expect(close.className).toContain('focus-visible:ring-ring');
        // The bare `focus:outline-none` had no companion; the ring now replaces
        // it, and it must be scoped to focus-visible so a mouse click on the
        // close control does not flash the ring.
        expect(close.className).not.toMatch(/[^:]focus:outline-none/);
    });

    it('does not dim the close control out of contrast', () => {
        act(() =>
            root.render(
                <Dialog open onClose={() => {}} title="Selesaikan Pengiriman">
                    <div />
                </Dialog>,
            ),
        );

        const close = document.body.querySelector(
            '[role="dialog"] button',
        ) as HTMLElement;

        expect(close.className).not.toContain('opacity-60');
    });
});

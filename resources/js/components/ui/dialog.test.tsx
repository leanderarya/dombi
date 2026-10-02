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

    // The close control is absolutely positioned, so it removes itself from
    // flow and the header has no idea it is there. At 320px it owns the right
    // 60px of the dialog, 36px of which reach inside the p-6 content box: a
    // centred title with nothing reserved flows straight under it, and at 28px
    // the button was too small to reach most of them, which is what hid this
    // until the button grew. Widening it to 44px without reserving the band
    // put 6 of the 58 real dialog titles under the close icon, worst case by
    // 20px.
    //
    // jsdom does not lay out, so this asserts the invariant the layout would
    // enforce rather than a magic px value: whatever the button's size and
    // offset, the header's text area must end before the button begins. It
    // reads the four numbers off the rendered className strings, so changing
    // the button without changing the reservation fails here instead of on a
    // 320px screen.
    it('reserves the close control band so no title can run under it', () => {
        act(() =>
            root.render(
                <Dialog open onClose={() => {}} title="Selesaikan Pengiriman">
                    <div />
                </Dialog>,
            ),
        );

        const scale = (className: string, prefix: string): number => {
            // Matches the bare utility and rejects the variant-prefixed ones
            // (`focus-visible:ring-2` and friends) the same element carries.
            const match = className.match(
                new RegExp(`(?:^|\\s)${prefix}-(\\d+)(?:\\s|$)`),
            );

            expect(match, `${prefix}-* not found in "${className}"`).not.toBeNull();

            return Number(match![1]) * 4;
        };

        const close = document.body.querySelector(
            '[role="dialog"] button',
        ) as HTMLElement;
        const content = document.body.querySelector(
            '[role="dialog"]',
        ) as HTMLElement;
        const header = content.querySelector('h2')?.parentElement as HTMLElement;

        // Text ends at `width - p - pr`; the button starts at
        // `width - right - w`. The dialog's own width cancels out, so this
        // holds at every viewport: 24 + 56 - 16 - 44 = 20px of clearance.
        const gap =
            scale(content.className, 'p') +
            scale(header.className, 'pr') -
            scale(close.className, 'right') -
            scale(close.className, 'w');

        expect(gap).toBeGreaterThan(0);
    });
});

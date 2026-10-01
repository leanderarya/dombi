// @vitest-environment jsdom
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import OwnerSegmentedTabs from './owner-segmented-tabs';

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

const TABS = [
    { key: 'a', label: 'Satu' },
    { key: 'b', label: 'Dua' },
    { key: 'c', label: 'Tiga' },
    { key: 'd', label: 'Empat' },
];

describe('OwnerSegmentedTabs', () => {
    it('can shrink and scroll instead of overflowing the page at 320px', () => {
        const tablist = render(
            <OwnerSegmentedTabs
                tabs={TABS}
                activeTab="a"
                onChange={() => {}}
            />,
        );

        // `inline-flex` alone refuses to shrink below its content width, which
        // pushed /owner/finance 14px wide at a 320px viewport. max-w-full caps
        // it at the column, overflow-x-auto gives it somewhere to put the rest.
        expect(tablist.className).toContain('max-w-full');
        expect(tablist.className).toContain('overflow-x-auto');
    });

    it('keeps each tab at its natural size so the labels never wrap', () => {
        const tablist = render(
            <OwnerSegmentedTabs
                tabs={TABS}
                activeTab="a"
                onChange={() => {}}
            />,
        );
        const tabs = tablist.querySelectorAll('[role="tab"]');

        expect(tabs).toHaveLength(TABS.length);

        for (const tab of tabs) {
            expect(tab.className).toContain('shrink-0');
            expect(tab.className).toContain('whitespace-nowrap');
        }
    });

    it('marks the active tab for assistive tech', () => {
        const tablist = render(
            <OwnerSegmentedTabs
                tabs={TABS}
                activeTab="b"
                onChange={() => {}}
            />,
        );
        const selected = tablist.querySelectorAll('[aria-selected="true"]');

        expect(selected).toHaveLength(1);
        expect(selected[0].textContent).toBe('Dua');
    });
});

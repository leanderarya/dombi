// @vitest-environment jsdom
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerFilterCard from './owner-filter-card';

vi.mock('@inertiajs/react', () => ({
    Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
        <a {...props}>{children}</a>
    ),
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

describe('OwnerFilterCard', () => {
    it('gives the search input an accessible name instead of relying on the placeholder', () => {
        const card = render(
            <OwnerFilterCard
                searchPlaceholder="Cari outlet..."
                searchValue=""
                onSearch={() => {}}
            />,
        );
        const input = card.querySelector('input[type="text"]');

        expect(input).not.toBeNull();
        // The checkup measured `name="(none)"` on four such inputs: a screen
        // reader announced "edit text, blank".
        expect(input?.getAttribute('aria-label')).toBe('Cari outlet...');
        expect(input?.getAttribute('placeholder')).toBe('Cari outlet...');
    });

    it('names the outlet filter the same way as its siblings', () => {
        const card = render(
            <OwnerFilterCard
                outletOptions={[{ value: '1', label: 'Banyumanik' }]}
                outletValue=""
                onOutletChange={() => {}}
            />,
        );

        expect(card.querySelector('select')?.getAttribute('aria-label')).toBe(
            'Filter outlet',
        );
    });

    it('sizes the collapsed Filter disclosure for touch, not for the desktop rail', () => {
        const card = render(
            <OwnerFilterCard collapsible defaultExpanded={false} />,
        );
        const toggle = card.querySelector('button');

        // The disclosure measured 24px on padding alone. Guarded by
        // `pointer-coarse:` so the compact desktop filter row is unchanged —
        // spec D6 exempts the owner panel on precise pointers only.
        expect(toggle?.className).toContain('pointer-coarse:min-h-11');
    });
});

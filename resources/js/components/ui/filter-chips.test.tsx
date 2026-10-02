// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import FilterChips from './filter-chips';

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

function render(ui: React.ReactElement) {
    act(() => root.render(ui));

    return container.firstElementChild as HTMLElement;
}

const options = [
    { key: 'all', label: 'Semua' },
    { key: 'delivering', label: 'Diantar' },
];

describe('FilterChips size variants', () => {
    // `md` + `solid` is the default pairing and reaches the outlet and courier
    // status rows. On a touch device the chips measured 34px tall, under the
    // 44px DESIGN.md line 83 requires. `sm` already carried the guard; `md`
    // was the one the sweep missed.
    it('guards the default md size for coarse pointers', () => {
        const chips = render(
            <FilterChips options={options} active="all" onChange={() => {}} />,
        );
        const chip = chips.querySelector('button');

        expect(chip?.className).toContain('pointer-coarse:min-h-11');
        expect(chip?.className).toContain('pointer-coarse:inline-flex');
    });

    it('guards the sm size too', () => {
        const chips = render(
            <FilterChips
                options={options}
                active="all"
                onChange={() => {}}
                size="sm"
            />,
        );
        const chip = chips.querySelector('button');

        expect(chip?.className).toContain('pointer-coarse:min-h-11');
    });

    it('leaves the caption size pinned to the kanvas frame', () => {
        // D8 keeps the customer order-history chips consistency-only: they are
        // matched to a design frame and must not drift.
        const chips = render(
            <FilterChips
                options={options}
                active="all"
                onChange={() => {}}
                size="caption"
            />,
        );
        const chip = chips.querySelector('button');

        expect(chip?.className).not.toContain('pointer-coarse:min-h-11');
        expect(chip?.className).toContain('text-caption');
    });
});

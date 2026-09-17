// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { Button } from './button';

/**
 * Regression guard for the `asChild` + react-slot 1.3.0 crash.
 *
 * `Button` renders an optional icon *and* its children. Radix `Slot` accepts
 * exactly one child; the `{Icon && …}` expression evaluates to `undefined`
 * when no icon is passed, which still counts as a second child and made
 * 1.3.0 throw `Slot failed to slot onto its children`. That took down every
 * order screen, since `Card`/`Notice` actions all use `Button asChild`.
 *
 * The fix wraps the real child in `Slottable`. These tests fail loudly if
 * anyone unwraps it or reorders the children.
 */
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

function render(node: React.ReactNode) {
    act(() => {
        root.render(node);
    });
}

describe('Button', () => {
    it('renders a plain button', () => {
        render(<Button>Kirim</Button>);

        expect(container.querySelector('button')?.textContent).toContain(
            'Kirim',
        );
    });

    it('merges onto a single child anchor when asChild is set', () => {
        render(
            <Button asChild variant="primary">
                <a href="/detail">Detail Pesanan</a>
            </Button>,
        );

        const anchor = container.querySelector('a');

        expect(anchor).not.toBeNull();
        expect(anchor?.getAttribute('href')).toBe('/detail');
        expect(anchor?.textContent).toContain('Detail Pesanan');
        expect(container.querySelector('button')).toBeNull();
    });

    it('keeps the child content when an icon is also passed', () => {
        render(
            <Button asChild icon={undefined}>
                <a href="/x">Halo</a>
            </Button>,
        );

        expect(container.querySelector('a')?.textContent).toContain('Halo');
    });
});

// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

async function readSource(relative: string): Promise<string> {
    return readFile(resolve(here, relative), 'utf8');
}

/**
 * The outlet orders and deliveries screens each hand-roll the same
 * Aktif/Riwayat segmented control instead of sharing a component, so there is
 * no single element to render and measure. jsdom has no layout engine either,
 * so `getBoundingClientRect` would report zeroes regardless. The measured
 * geometry (155x32 at 390px with touch emulation on) lives in the checkup
 * report; what is asserted here is that both call sites carry the guard that
 * fixes it, and that neither grows a third tab without one.
 */
describe('outlet segmented control touch target', () => {
    const screens = ['./deliveries/index.tsx', './orders/index.tsx'] as const;

    it.each(screens)('%s guards both tabs', async (screen) => {
        const source = await readSource(screen);
        const tabs = source.match(
            /className=\{`flex-1 rounded-lg py-2 text-xs[^`]*`/g,
        );

        // Two tabs, so two class strings — and every one of them carries the
        // guard, so a third tab added later cannot arrive without it.
        expect(tabs).toHaveLength(2);

        for (const className of tabs ?? []) {
            expect(className).toContain('pointer-coarse:min-h-11');
            expect(className).toContain('pointer-coarse:inline-flex');
            expect(className).toContain('pointer-coarse:items-center');
        }
    });
});

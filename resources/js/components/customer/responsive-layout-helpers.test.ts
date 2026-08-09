import { describe, expect, it } from 'vitest';
import { gridCols, railAndMain } from './responsive-layout-helpers';

describe('responsive-layout-helpers', () => {
    it('gridCols returns additive responsive classes for a 3-col desktop grid', () => {
        expect(gridCols(3)).toBe('grid-cols-2 lg:grid-cols-3');
    });

    it('gridCols falls back to 2 columns when count is below 3', () => {
        expect(gridCols(2)).toBe('grid-cols-2');
    });

    it('railAndMain lays out a left rail + main area at desktop width', () => {
        expect(railAndMain()).toBe(
            'grid-cols-1 lg:grid-cols-[260px_1fr] lg:gap-6',
        );
    });
});

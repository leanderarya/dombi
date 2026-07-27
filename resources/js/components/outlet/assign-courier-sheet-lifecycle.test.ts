import { describe, expect, it } from 'vitest';
import { createCourierRequestLifecycle } from './assign-courier-sheet-lifecycle';

describe('assign courier sheet request lifecycle', () => {
    it('ignores a response from a request that was replaced or invalidated', () => {
        const lifecycle = createCourierRequestLifecycle();
        const firstRequest = lifecycle.begin();
        const retryRequest = lifecycle.begin();

        expect(lifecycle.isCurrent(firstRequest)).toBe(false);
        expect(lifecycle.isCurrent(retryRequest)).toBe(true);

        lifecycle.invalidate();

        expect(lifecycle.isCurrent(retryRequest)).toBe(false);
    });
});

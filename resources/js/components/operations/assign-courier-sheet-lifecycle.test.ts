import { describe, expect, it } from 'vitest';
import {
    createAssignCourierSheetLifecycle,
    createInitialAssignCourierSheetState,
} from './assign-courier-sheet-lifecycle';

describe('assign courier sheet lifecycle', () => {
    it('aborts the retry request when the sheet closes', () => {
        const lifecycle = createAssignCourierSheetLifecycle();
        const firstRequest = lifecycle.beginRequest();
        const retryRequest = lifecycle.beginRequest();

        expect(firstRequest.signal.aborted).toBe(true);
        expect(retryRequest.signal.aborted).toBe(false);

        lifecycle.close();

        expect(retryRequest.signal.aborted).toBe(true);
        expect(lifecycle.activeRequestId()).toBeNull();
    });

    it('prevents an older request from publishing after a retry or close', () => {
        const lifecycle = createAssignCourierSheetLifecycle();
        const firstRequest = lifecycle.beginRequest();
        const retryRequest = lifecycle.beginRequest();

        expect(lifecycle.canPublish(firstRequest.id)).toBe(false);
        expect(lifecycle.canPublish(retryRequest.id)).toBe(true);

        lifecycle.close();

        expect(lifecycle.canPublish(retryRequest.id)).toBe(false);
    });

    it('provides empty selection state for every new sheet mount', () => {
        const firstMount = createInitialAssignCourierSheetState();
        firstMount.selectedCourier = 42;

        expect(createInitialAssignCourierSheetState()).toEqual({
            selectedCourier: null,
        });
    });
});

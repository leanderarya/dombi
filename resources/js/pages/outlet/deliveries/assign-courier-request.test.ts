import { describe, expect, it, vi } from 'vitest';
import { createAssignCourierSheetLifecycle } from '@/components/operations/assign-courier-sheet-lifecycle';
import { runAssignCourierLookup } from './assign-courier-request';

describe('assign courier lookup handler', () => {
    it('swallows AbortError from a retry followed by unmount', async () => {
        const lifecycle = createAssignCourierSheetLifecycle();
        const onData = vi.fn();
        const onError = vi.fn();
        const signals: AbortSignal[] = [];
        const request = (signal: AbortSignal) =>
            new Promise<never>((_, reject) => {
                signals.push(signal);
                signal.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });

        const firstLookup = runAssignCourierLookup({
            lifecycle,
            request,
            onData,
            onError,
        });
        const retryLookup = runAssignCourierLookup({
            lifecycle,
            request,
            onData,
            onError,
        });

        lifecycle.close();

        await expect(Promise.all([firstLookup, retryLookup])).resolves.toEqual([
            undefined,
            undefined,
        ]);

        expect(signals).toHaveLength(2);
        expect(signals.every((signal) => signal.aborted)).toBe(true);
        expect(onData).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    it('reports a non-abort lookup failure without publishing stale data', async () => {
        const lifecycle = createAssignCourierSheetLifecycle();
        const onData = vi.fn();
        const onError = vi.fn();

        await runAssignCourierLookup({
            lifecycle,
            request: async () => {
                throw new Error('Network unavailable');
            },
            onData,
            onError,
        });

        expect(onData).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledOnce();
    });
});

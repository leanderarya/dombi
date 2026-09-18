import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeOrderDate } from './format';

describe('formatRelativeOrderDate', () => {
    beforeEach(() => {
        // Fixed local time so "today" and "yesterday" are deterministic.
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 8, 18, 21, 52));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders today as `Hari ini, HH.mm`', () => {
        expect(
            formatRelativeOrderDate(
                new Date(2026, 8, 18, 14, 20).toISOString(),
            ),
        ).toBe('Hari ini, 14.20');
    });

    it('renders yesterday as `Kemarin, HH.mm`', () => {
        expect(
            formatRelativeOrderDate(
                new Date(2026, 8, 17, 13, 10).toISOString(),
            ),
        ).toBe('Kemarin, 13.10');
    });

    it('falls back to the absolute date beyond yesterday', () => {
        const result = formatRelativeOrderDate(
            new Date(2025, 4, 27, 14, 49).toISOString(),
        );

        expect(result).toContain('2025');
        expect(result).not.toContain('Hari ini');
        expect(result).not.toContain('Kemarin');
    });

    it('handles missing and invalid values', () => {
        expect(formatRelativeOrderDate(null)).toBe('-');
        expect(formatRelativeOrderDate(undefined)).toBe('-');
        expect(formatRelativeOrderDate('not-a-date')).toBe('-');
    });
});

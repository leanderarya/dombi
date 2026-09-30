import { describe, expect, it } from 'vitest';
import { DEFAULT_CENTER_THRESHOLD, pcsStatus } from './central-stock-status';

describe('pcsStatus', () => {
    it('calls a zero-stock row empty', () => {
        expect(pcsStatus({ center_stock: 0, center_threshold: 20 })).toBe(
            'empty',
        );
    });

    it('calls a negative-stock row empty too', () => {
        expect(pcsStatus({ center_stock: -3, center_threshold: 20 })).toBe(
            'empty',
        );
    });

    it('calls a row under its own threshold low', () => {
        expect(pcsStatus({ center_stock: 19, center_threshold: 20 })).toBe(
            'low',
        );
    });

    it('calls a row at its threshold healthy', () => {
        expect(pcsStatus({ center_stock: 20, center_threshold: 20 })).toBe(
            'healthy',
        );
    });

    it('falls back to the default threshold when the row omits one', () => {
        expect(pcsStatus({ center_stock: DEFAULT_CENTER_THRESHOLD - 1 })).toBe(
            'low',
        );
        expect(pcsStatus({ center_stock: DEFAULT_CENTER_THRESHOLD })).toBe(
            'healthy',
        );
    });

    it('treats a missing row as empty', () => {
        expect(pcsStatus({})).toBe('empty');
    });

    it('regression: a 500ml product at 12 is low, not healthy', () => {
        // The tab hardcoded `<= 10` for every size, so this row showed "Aman"
        // while the dashboard counted it under "Stok Kritis Pusat".
        expect(pcsStatus({ center_stock: 12, center_threshold: 15 })).toBe(
            'low',
        );
    });
});

import { describe, expect, it } from 'vitest';
import { OUTLET_STATUS_ORDER, outletStockStatus } from './inventory-status';

describe('outletStockStatus', () => {
    it('is critical when nothing is left after reservations', () => {
        expect(outletStockStatus({ current_stock: 5, reserved_stock: 5 })).toBe(
            'critical',
        );
        expect(outletStockStatus({ current_stock: 3, reserved_stock: 5 })).toBe(
            'critical',
        );
        expect(outletStockStatus({ current_stock: 0, reserved_stock: 0 })).toBe(
            'critical',
        );
    });

    it('is low between reserved and reserved + minimum', () => {
        expect(
            outletStockStatus({
                current_stock: 6,
                reserved_stock: 5,
                minimum_stock: 3,
            }),
        ).toBe('low');
        expect(
            outletStockStatus({
                current_stock: 8,
                reserved_stock: 5,
                minimum_stock: 3,
            }),
        ).toBe('low');
    });

    it('is healthy above reserved + minimum', () => {
        expect(
            outletStockStatus({
                current_stock: 9,
                reserved_stock: 5,
                minimum_stock: 3,
            }),
        ).toBe('healthy');
        expect(
            outletStockStatus({
                current_stock: 40,
                reserved_stock: 0,
                minimum_stock: 10,
            }),
        ).toBe('healthy');
    });

    it('treats missing columns as zero rather than throwing', () => {
        expect(outletStockStatus({})).toBe('critical');
    });

    it('does not flag a row as critical just because stock is small', () => {
        // The old rule was `current_stock <= 2`, which called this row critical
        // despite it having 5 on hand and no reservations.
        expect(
            outletStockStatus({
                current_stock: 2,
                reserved_stock: 0,
                minimum_stock: 10,
            }),
        ).toBe('low');
    });

    it('ranks worst first', () => {
        expect(OUTLET_STATUS_ORDER.critical).toBeLessThan(
            OUTLET_STATUS_ORDER.low,
        );
        expect(OUTLET_STATUS_ORDER.low).toBeLessThan(
            OUTLET_STATUS_ORDER.healthy,
        );
    });
});

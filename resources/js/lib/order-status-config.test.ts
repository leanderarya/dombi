import { describe, expect, it } from 'vitest';
import { getOrderStatusConfig } from './order-status-config';

describe('expired order copy', () => {
    it('keeps the Kadaluarsa label', () => {
        expect(getOrderStatusConfig('expired').label).toBe('Kadaluarsa');
    });

    it('describes the outcome without blaming the outlet', () => {
        const { reason } = getOrderStatusConfig('expired');

        expect(reason).toBe('Pesanan tidak diselesaikan dalam batas waktu');
        expect(reason).not.toContain('Outlet');
    });
});

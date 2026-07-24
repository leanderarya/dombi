import { describe, it, expect } from 'vitest';
import { normalizeOrderReason } from '@/lib/order-reasons';

describe('normalizeOrderReason', () => {
    it('normalizes Stok Habis to Stok Tidak Tersedia', () => {
        expect(normalizeOrderReason('Stok Habis')).toBe('Stok Tidak Tersedia');
    });

    it('keeps canonical Stok Tidak Tersedia unchanged', () => {
        expect(normalizeOrderReason('Stok Tidak Tersedia')).toBe('Stok Tidak Tersedia');
    });

    it('keeps other reasons unchanged', () => {
        expect(normalizeOrderReason('Produk Rusak')).toBe('Produk Rusak');
    });

    it('handles null', () => {
        expect(normalizeOrderReason(null)).toBeNull();
    });

    it('handles undefined', () => {
        expect(normalizeOrderReason(undefined)).toBeNull();
    });
});

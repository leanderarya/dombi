import { describe, it, expect } from 'vitest';
import { getStockLabel, getStockStatusLabel } from '@/lib/stock';

describe('getStockLabel', () => {
    it('returns empty string for available status', () => {
        expect(getStockLabel('available')).toBe('');
    });

    it('returns "Habis" for out_of_stock', () => {
        expect(getStockLabel('out_of_stock')).toBe('Habis');
    });

    it('returns "Stok Terbatas" for low stock', () => {
        expect(getStockLabel('low')).toBe('Stok Terbatas');
    });

    it('returns "Stok Terbatas (X)" when showQuantity is true', () => {
        expect(getStockLabel('low', 3, true)).toBe('Stok Terbatas (3)');
    });
});

describe('getStockStatusLabel', () => {
    it('returns "Sehat" for available status', () => {
        expect(getStockStatusLabel('available')).toBe('Sehat');
    });

    it('returns "Stok Rendah" for low stock', () => {
        expect(getStockStatusLabel('low')).toBe('Stok Rendah');
    });

    it('returns "Stok Habis" for out_of_stock', () => {
        expect(getStockStatusLabel('out_of_stock')).toBe('Stok Habis');
    });

    it('includes quantity when provided', () => {
        expect(getStockStatusLabel('low', 3)).toBe('Stok Rendah (3)');
    });
});

import { describe, it, expect } from 'vitest';
import { getCustomerStockStatus, getOwnerStockStatus } from '@/lib/status-labels';

describe('getCustomerStockStatus', () => {
    it('returns "Tersedia" for available status', () => {
        const result = getCustomerStockStatus('available');
        expect(result.label).toBe('Tersedia');
        expect(result.variant).toBe('success');
        expect(result.displayLabel).toBe('Tersedia');
    });

    it('returns "Habis" for out_of_stock', () => {
        const result = getCustomerStockStatus('out_of_stock');
        expect(result.label).toBe('Habis');
        expect(result.variant).toBe('danger');
        expect(result.displayLabel).toBe('Habis');
    });

    it('returns "Stok Terbatas" for low stock', () => {
        const result = getCustomerStockStatus('low');
        expect(result.label).toBe('Stok Terbatas');
        expect(result.variant).toBe('warning');
        expect(result.displayLabel).toBe('Stok Terbatas');
    });

    it('returns "Stok Terbatas (X)" when availableStock is provided', () => {
        const result = getCustomerStockStatus('low', 3);
        expect(result.displayLabel).toBe('Stok Terbatas (3)');
    });
});

describe('getOwnerStockStatus', () => {
    it('returns "Sehat" for available status', () => {
        const result = getOwnerStockStatus('available');
        expect(result.label).toBe('Sehat');
        expect(result.variant).toBe('success');
        expect(result.displayLabel).toBe('Sehat');
    });

    it('returns "Stok Rendah" for low stock', () => {
        const result = getOwnerStockStatus('low');
        expect(result.label).toBe('Stok Rendah');
        expect(result.variant).toBe('warning');
        expect(result.displayLabel).toBe('Stok Rendah');
    });

    it('returns "Stok Habis" for out_of_stock', () => {
        const result = getOwnerStockStatus('out_of_stock');
        expect(result.label).toBe('Stok Habis');
        expect(result.variant).toBe('danger');
        expect(result.displayLabel).toBe('Stok Habis');
    });

    it('includes quantity when provided', () => {
        const result = getOwnerStockStatus('low', 3);
        expect(result.displayLabel).toBe('Stok Rendah (3)');
    });
});

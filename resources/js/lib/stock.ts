export type StockStatus = 'available' | 'low' | 'out_of_stock';

export function getStockLabel(
    status: StockStatus,
    availableStock?: number,
    showQuantity = false,
): string {
    switch (status) {
        case 'out_of_stock':
            return 'Habis';
        case 'low':
            return showQuantity && availableStock !== undefined
                ? `Stok Terbatas (${availableStock})`
                : 'Stok Terbatas';
        default:
            return '';
    }
}

export function getStockStatusLabel(status: StockStatus, availableStock?: number): string {
    switch (status) {
        case 'out_of_stock':
            return 'Stok Habis';
        case 'low':
            return availableStock !== undefined ? `Stok Rendah (${availableStock})` : 'Stok Rendah';
        case 'available':
            return 'Sehat';
        default:
            return '';
    }
}

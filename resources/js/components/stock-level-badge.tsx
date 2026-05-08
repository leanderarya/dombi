export function stockLevel(currentStock: number, reservedStock: number, minimumStock: number) {
    const available = currentStock - reservedStock;

    if (available <= 0) {
        return 'critical';
    }

    if (available <= minimumStock) {
        return 'low';
    }

    return 'healthy';
}

const styles: Record<string, string> = {
    healthy: 'bg-green-100 text-green-800',
    low: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
};

export default function StockLevelBadge({ currentStock, reservedStock, minimumStock }: { currentStock: number; reservedStock: number; minimumStock: number }) {
    const level = stockLevel(currentStock, reservedStock, minimumStock);

    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[level]}`}>{level.replace('_', ' ')}</span>;
}

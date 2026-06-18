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
    healthy: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10',
    low: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10',
    critical: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
};

export default function StockLevelBadge({ currentStock, reservedStock, minimumStock }: { currentStock: number; reservedStock: number; minimumStock: number }) {
    const level = stockLevel(currentStock, reservedStock, minimumStock);

    return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${styles[level]}`}>{level.replace('_', ' ')}</span>;
}

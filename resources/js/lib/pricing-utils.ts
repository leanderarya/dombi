export function marginColor(margin: number, sellingPrice: number): string {
    const pct = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;

    if (pct > 20) return 'text-emerald-600';
    if (pct >= 10) return 'text-blue-600';
    if (pct >= 0) return 'text-amber-600';
    return 'text-red-600';
}

export function marginBgColor(margin: number, sellingPrice: number): string {
    const pct = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;

    if (pct > 20) return 'bg-emerald-50';
    if (pct >= 10) return 'bg-blue-50';
    if (pct >= 0) return 'bg-amber-50';
    return 'bg-red-50';
}

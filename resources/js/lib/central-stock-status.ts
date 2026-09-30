export type PcsStatus = 'empty' | 'low' | 'healthy';

interface CenterStockRow {
    center_stock?: number | null;
    /**
     * Per-size floor from Product::centerStockThreshold(). Older payloads omit
     * it, so callers fall back to the 250ml floor rather than to the `<= 10`
     * that every size used to share.
     */
    center_threshold?: number | null;
}

/** Fallback floor for a row with no threshold — matches the Product default. */
export const DEFAULT_CENTER_THRESHOLD = 15;

/**
 * Status of one central-stock row, shared by the pills, the badges and the sort.
 *
 * Three copies of this rule existed: the tab compared `<= 10` for every size,
 * the dashboard compared against the per-size threshold, and Product::
 * getStockStatusAttribute() compared against a flat 5. A 500ml product at 12
 * therefore read "Aman" on this tab while the dashboard counted the same product
 * under "Stok Kritis Pusat".
 *
 * Empty is separated from low because they carry different badges and different
 * urgency — `critical` is the two of them together, which is what the dashboard
 * KPI and the ?filter=critical link mean.
 */
export function pcsStatus(row: CenterStockRow): PcsStatus {
    const stock = row?.center_stock ?? 0;
    const threshold = row?.center_threshold ?? DEFAULT_CENTER_THRESHOLD;

    if (stock <= 0) {
        return 'empty';
    }

    return stock < threshold ? 'low' : 'healthy';
}

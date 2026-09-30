export type OutletStockStatus = 'critical' | 'low' | 'healthy';

interface OutletStockRow {
    current_stock?: number | null;
    reserved_stock?: number | null;
    minimum_stock?: number | null;
}

/**
 * Status of one outlet_inventories row, in one place.
 *
 * Mirrors OutletInventory::scopeWhereCriticalStock() and scopeWhereLowStock()
 * exactly, including their habit of comparing raw columns instead of
 * subtracting: a row is critical when current <= reserved, low when
 * current <= reserved + minimum.
 *
 * The inventories page used to carry a second, home-grown rule in three spots
 * (`current_stock <= 2`): the KPI caption advertised it, the outlet dots used
 * it, and a sub-column sort ranked by it. A row with 5 on hand and 5 reserved
 * therefore showed a green dot while the KPI above it counted the same row as
 * critical.
 */
export function outletStockStatus(row: OutletStockRow): OutletStockStatus {
    const current = row?.current_stock ?? 0;
    const reserved = row?.reserved_stock ?? 0;

    if (current <= reserved) {
        return 'critical';
    }

    return current <= reserved + (row?.minimum_stock ?? 0) ? 'low' : 'healthy';
}

/** Sort rank — worst first, so an ascending sort leads with what needs work. */
export const OUTLET_STATUS_ORDER: Record<OutletStockStatus, number> = {
    critical: 0,
    low: 1,
    healthy: 2,
};

/**
 * Extract a sortable numeric value from a size string.
 * "250ml" → 250, "1L" → 1000, "500ml" → 500
 */
export function sizeToMl(size: string | null): number {
    if (!size) {
        return 0;
    }

    const s = size.trim().toLowerCase();

    if (s.endsWith('ml')) {
        const num = parseFloat(s.replace(',', '.'));

        return isNaN(num) ? 0 : num;
    }

    if (s.endsWith('l')) {
        const num = parseFloat(s.replace(',', '.'));

        return isNaN(num) ? 0 : num * 1000;
    }

    return 0;
}

/**
 * Sort an array of items with a `size` field by volume ascending.
 * Smallest size first (250ml → 500ml → 1L → 2L).
 */
export function sortBySize<T extends { size: string | null }>(items: T[]): T[] {
    return [...items].sort((a, b) => sizeToMl(a.size) - sizeToMl(b.size));
}

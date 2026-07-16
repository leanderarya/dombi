/**
 * Canonical product name format used across ALL owner pages.
 *
 * Display format: "Family — Variant"
 * With SKU: line 1 "Family — Variant" bold, line 2 "SKU-XXX" muted
 */

export type ProductLike = {
    full_name?: string | null;
    name?: string | null;
    family_name?: string | null;
    family?: { name?: string | null } | null;
    product?: { name?: string | null } | null;
    sku?: string | null;
};

/** Display product name: "Family — Variant" or full_name if available. */
export function displayProductName(item: ProductLike | null | undefined): string {
    if (!item) return '—';

    if (item.full_name) return item.full_name;

    const variantName = item.name;
    const familyName = item.family?.name ?? item.family_name;

    if (familyName && variantName) return `${familyName} — ${variantName}`;
    if (variantName) return variantName;
    if (item.product?.name) return item.product.name;

    return '—';
}

/** Split product name + optional SKU for two-line table cell rendering. */
export function formatProductCell(item: ProductLike | null | undefined): { primary: string; secondary?: string } {
    return {
        primary: displayProductName(item),
        secondary: item?.sku ?? undefined,
    };
}

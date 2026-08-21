/**
 * Canonical product name format used across ALL owner pages.
 *
 * Display format: "Category - Product"
 * With SKU: line 1 "Category - Product" bold, line 2 "SKU-XXX" muted
 */

export type ProductLike = {
    full_name?: string | null;
    name?: string | null;
    category_name?: string | null;
    family_name?: string | null;
    category?: { name?: string | null } | null;
    family?: { name?: string | null } | null;
    product?: { name?: string | null } | null;
    sku?: string | null;
};

/** Display product name: "Category - Product" or full_name if available. */
export function displayProductName(
    item: ProductLike | null | undefined,
): string {
    if (!item) {
        return '—';
    }

    if (item.full_name) {
        return item.full_name;
    }

    const productName = item.name;
    const categoryName =
        item.category?.name ??
        item.category_name ??
        item.family?.name ??
        item.family_name;

    if (categoryName && productName && categoryName !== productName) {
        return `${categoryName} - ${productName}`;
    }

    if (productName) {
        return productName;
    }

    if (item.product?.name) {
        return item.product.name;
    }

    return '—';
}

/** Split product name + optional SKU for two-line table cell rendering. */
export function formatProductCell(item: ProductLike | null | undefined): {
    primary: string;
    secondary?: string;
} {
    return {
        primary: displayProductName(item),
        secondary: item?.sku ?? undefined,
    };
}

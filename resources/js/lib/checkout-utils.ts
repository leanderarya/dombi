/**
 * Apply location fields to a form, merging with existing data.
 * Deduplicates the 11-field spread pattern used across checkout.
 */
export function applyLocationToForm(
    current: Record<string, any>,
    loc: Record<string, any>,
): Record<string, any> {
    return {
        ...current,
        address_line: loc.address_line ?? current.address_line ?? '',
        address_detail: loc.address_detail ?? current.address_detail ?? '',
        province: loc.province ?? current.province ?? '',
        city: loc.city ?? current.city ?? '',
        district: loc.district ?? current.district ?? '',
        village: loc.village ?? current.village ?? '',
        postal_code: loc.postal_code ?? current.postal_code ?? '',
        latitude: loc.latitude ?? current.latitude,
        longitude: loc.longitude ?? current.longitude,
        landmark: loc.landmark ?? current.landmark ?? '',
        delivery_notes: loc.delivery_notes ?? current.delivery_notes ?? '',
    };
}

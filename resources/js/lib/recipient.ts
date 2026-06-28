/**
 * Recipient comparison helpers for checkout/order views.
 * Single source of truth for "is recipient different from orderer?" logic.
 */

/**
 * Normalize phone for comparison:
 * - Strip all non-digit characters (+, spaces, dashes, parentheses)
 * - Convert leading 0 to 62 (Indonesia)
 * - Canonical form: always starts with 62, no +
 */
export function normalizePhone(phone: string | null | undefined): string {
    if (!phone) return '';

    // Strip everything except digits
    const digits = phone.replace(/\D/g, '');

    if (digits.startsWith('0')) {
        return '62' + digits.slice(1);
    }

    return digits;
}

/**
 * Determine if recipient differs from orderer.
 * Empty recipient fields → treated as same (Fase 1 fallback).
 * Compares both name AND phone; differs if either is different.
 */
export function isDifferentRecipient(order: {
    customer_name?: string | null;
    customer_phone?: string | null;
    recipient_name?: string | null;
    recipient_phone?: string | null;
}): boolean {
    const rn = order.recipient_name?.trim();
    const rp = order.recipient_phone?.trim();

    // No recipient data → same as orderer
    if (!rn && !rp) return false;

    const nameDiffers = !!rn && rn !== order.customer_name?.trim();
    const phoneDiffers = !!rp && normalizePhone(rp) !== normalizePhone(order.customer_phone);

    return nameDiffers || phoneDiffers;
}

/**
 * Get the primary contact phone for courier (recipient if different, otherwise customer).
 */
export function getContactPhone(order: {
    customer_phone?: string | null;
    recipient_phone?: string | null;
    recipient_name?: string | null;
    customer_name?: string | null;
}): string | null {
    if (isDifferentRecipient(order)) {
        return order.recipient_phone || order.customer_phone || null;
    }
    return order.customer_phone || null;
}

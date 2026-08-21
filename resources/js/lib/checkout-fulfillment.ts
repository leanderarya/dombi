export type CheckoutFulfillmentType = '' | 'pickup' | 'delivery_dombi';

export function checkoutFulfillmentType(
    value: string | null | undefined,
): CheckoutFulfillmentType {
    if (value === 'delivery' || value === 'delivery_dombi') {
        return 'delivery_dombi';
    }

    return value === 'pickup' ? 'pickup' : '';
}

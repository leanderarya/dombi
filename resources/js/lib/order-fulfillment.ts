/**
 * Single source of truth for how an order's fulfillment reads in the UI.
 *
 * The server decides what an order *is* (`Order::isPickup()` /
 * `Order::isDelivery()` in `app/Models/Order.php`); these helpers are the
 * one-way JS counterpart so the active card and the history card can never
 * disagree about the same order.
 */
export function isPickupOrder(fulfillmentType?: string | null): boolean {
    return fulfillmentType === 'pickup';
}

export function fulfillmentLabel(fulfillmentType?: string | null): string {
    return isPickupOrder(fulfillmentType) ? 'Pick Up' : 'Delivery';
}

export function fulfillmentVia(fulfillmentType?: string | null): string {
    return isPickupOrder(fulfillmentType) ? 'via Store' : 'via Aplikasi';
}

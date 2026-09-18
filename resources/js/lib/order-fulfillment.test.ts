import { describe, expect, it } from 'vitest';
import {
    fulfillmentLabel,
    fulfillmentVia,
    isPickupOrder,
} from './order-fulfillment';

describe('isPickupOrder', () => {
    it('treats only `pickup` as pickup', () => {
        expect(isPickupOrder('pickup')).toBe(true);
    });

    it('treats every delivery fulfillment as delivery', () => {
        // `delivery_ojol` is the case the old history card got wrong.
        expect(isPickupOrder('delivery_dombi')).toBe(false);
        expect(isPickupOrder('delivery_ojol')).toBe(false);
    });

    it('treats missing values as delivery', () => {
        expect(isPickupOrder(null)).toBe(false);
        expect(isPickupOrder(undefined)).toBe(false);
        expect(isPickupOrder('')).toBe(false);
    });
});

describe('fulfillmentLabel', () => {
    it('labels pickup and delivery', () => {
        expect(fulfillmentLabel('pickup')).toBe('Pick Up');
        expect(fulfillmentLabel('delivery_dombi')).toBe('Delivery');
        expect(fulfillmentLabel('delivery_ojol')).toBe('Delivery');
    });
});

describe('fulfillmentVia', () => {
    it('labels the ordering channel', () => {
        expect(fulfillmentVia('pickup')).toBe('via Store');
        expect(fulfillmentVia('delivery_dombi')).toBe('via Aplikasi');
        expect(fulfillmentVia('delivery_ojol')).toBe('via Aplikasi');
    });
});

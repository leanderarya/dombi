import { describe, expect, it } from 'vitest';
import { checkoutFulfillmentType } from './checkout-fulfillment';

describe('checkoutFulfillmentType', () => {
    it('maps persisted delivery values to backend delivery_dombi value', () => {
        expect(checkoutFulfillmentType('delivery')).toBe('delivery_dombi');
        expect(checkoutFulfillmentType('delivery_dombi')).toBe(
            'delivery_dombi',
        );
    });

    it('keeps pickup and rejects unknown persisted values', () => {
        expect(checkoutFulfillmentType('pickup')).toBe('pickup');
        expect(checkoutFulfillmentType(null)).toBe('');
        expect(checkoutFulfillmentType('invalid')).toBe('');
    });
});

import { describe, expect, it } from 'vitest';
import {
    customerContentBottomPadding,
    customerFloatingBarBottom,
    customerHasFloatingBar,
} from './customer-mobile-layout-state';

const withNav = 'pb-[calc(10rem+env(safe-area-inset-bottom,0px))]';
const withoutNav = 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]';

describe('customer mobile layout state', () => {
    it.each([
        ['cart', { showCartBar: true }],
        ['order', { showActiveOrderBar: true }],
        ['footer', { hasFooterSlot: true }],
    ])('reserves exact clearance for %s with navigation shown', (_, bars) => {
        expect(
            customerContentBottomPadding({
                hasFloatingBar: customerHasFloatingBar(bars),
                hideBottomNav: false,
            }),
        ).toBe(withNav);
    });

    it.each([
        ['cart', { showCartBar: true }],
        ['order', { showActiveOrderBar: true }],
        ['footer', { hasFooterSlot: true }],
    ])('reserves exact clearance for %s with navigation hidden', (_, bars) => {
        expect(
            customerContentBottomPadding({
                hasFloatingBar: customerHasFloatingBar(bars),
                hideBottomNav: true,
            }),
        ).toBe(withoutNav);
    });

    it('removes active-order clearance after dismissal', () => {
        expect(
            customerHasFloatingBar({
                showActiveOrderBar: false,
            }),
        ).toBe(false);
    });

    it('keeps safe-area clearance without floating controls', () => {
        expect(
            customerContentBottomPadding({
                hasFloatingBar: false,
                hideBottomNav: true,
            }),
        ).toBe('pb-[env(safe-area-inset-bottom,0px)]');
    });

    it('positions shared bars against navigation visibility', () => {
        expect(customerFloatingBarBottom(false)).toBe(
            'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        );
        expect(customerFloatingBarBottom(true)).toBe(
            'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        );
    });
});

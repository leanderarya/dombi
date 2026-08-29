import { describe, expect, it } from 'vitest';
import { customerContentBottomPadding } from './customer-mobile-layout-state';

describe('customerContentBottomPadding', () => {
    it('reserves cart and bottom navigation clearance', () => {
        expect(
            customerContentBottomPadding({
                hasFloatingBar: true,
                hideBottomNav: false,
            }),
        ).toContain('10rem');
    });

    it('does not reserve hidden bottom navigation height', () => {
        expect(
            customerContentBottomPadding({
                hasFloatingBar: true,
                hideBottomNav: true,
            }),
        ).not.toContain('10rem');
    });

    it('keeps safe-area clearance without floating controls', () => {
        expect(
            customerContentBottomPadding({
                hasFloatingBar: false,
                hideBottomNav: true,
            }),
        ).toContain('safe-area-inset-bottom');
    });
});

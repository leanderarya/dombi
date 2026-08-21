import { describe, expect, it } from 'vitest';
import {
    guestRefundDialogReducer,
    initialGuestRefundDialogState,
    initialRefundRollbackDialogState,
    refundRollbackDialogReducer,
} from './refund-dialog-state';

describe('refund dialog reset reducers', () => {
    it('restores every guest destination field after close', () => {
        const edited = guestRefundDialogReducer(initialGuestRefundDialogState, {
            type: 'update',
            patch: {
                type: 'ewallet',
                bankName: 'BCA',
                accountNumber: '123',
                accountHolder: 'Owner',
                ewalletProvider: 'DANA',
                ewalletNumber: '0812',
                ewalletHolder: 'Guest',
                phoneVerified: true,
                copied: true,
            },
        });

        expect(guestRefundDialogReducer(edited, { type: 'reset' })).toEqual({
            type: 'bank',
            bankName: '',
            accountNumber: '',
            accountHolder: '',
            ewalletProvider: '',
            ewalletNumber: '',
            ewalletHolder: '',
            phoneVerified: false,
            copied: false,
        });
    });

    it('restores rollback mode and reason after close', () => {
        const edited = refundRollbackDialogReducer(
            initialRefundRollbackDialogState,
            {
                type: 'update',
                patch: {
                    mode: 'fix_destination',
                    reason: 'Destination changed',
                },
            },
        );

        expect(refundRollbackDialogReducer(edited, { type: 'reset' })).toEqual({
            mode: 'retry',
            reason: '',
        });
    });
});

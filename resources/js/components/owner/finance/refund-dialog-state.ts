import type { RefundDestinationType } from '@/types/refund';

export interface GuestRefundDialogState {
    type: RefundDestinationType;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    ewalletProvider: string;
    ewalletNumber: string;
    ewalletHolder: string;
    phoneVerified: boolean;
    copied: boolean;
}

export interface RefundRollbackDialogState {
    mode: 'retry' | 'fix_destination';
    reason: string;
}

type ResettableAction<T> =
    { type: 'update'; patch: Partial<T> } | { type: 'reset' };

export const initialGuestRefundDialogState: GuestRefundDialogState = {
    type: 'bank',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    ewalletProvider: '',
    ewalletNumber: '',
    ewalletHolder: '',
    phoneVerified: false,
    copied: false,
};

export const initialRefundRollbackDialogState: RefundRollbackDialogState = {
    mode: 'retry',
    reason: '',
};

export function guestRefundDialogReducer(
    state: GuestRefundDialogState,
    action: ResettableAction<GuestRefundDialogState>,
): GuestRefundDialogState {
    return action.type === 'reset'
        ? initialGuestRefundDialogState
        : { ...state, ...action.patch };
}

export function refundRollbackDialogReducer(
    state: RefundRollbackDialogState,
    action: ResettableAction<RefundRollbackDialogState>,
): RefundRollbackDialogState {
    return action.type === 'reset'
        ? initialRefundRollbackDialogState
        : { ...state, ...action.patch };
}

export interface ResolveDeliveryDialogState {
    confirmDestructive: boolean;
}

type ResolveDeliveryDialogAction =
    { type: 'confirm-destructive' } | { type: 'reset' };

interface CloseResolveDeliverySheetOptions {
    resetForm: () => void;
    resetDialog: () => void;
    onClose: () => void;
}

export const initialResolveDeliveryDialogState: ResolveDeliveryDialogState = {
    confirmDestructive: false,
};

export function resolveDeliveryDialogReducer(
    state: ResolveDeliveryDialogState,
    action: ResolveDeliveryDialogAction,
): ResolveDeliveryDialogState {
    if (action.type === 'reset') {
        return initialResolveDeliveryDialogState;
    }

    return state.confirmDestructive ? state : { confirmDestructive: true };
}

export function closeResolveDeliverySheet({
    resetForm,
    resetDialog,
    onClose,
}: CloseResolveDeliverySheetOptions): void {
    resetForm();
    resetDialog();
    onClose();
}

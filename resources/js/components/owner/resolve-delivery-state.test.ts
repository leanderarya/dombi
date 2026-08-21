import { describe, expect, it } from 'vitest';
import {
    closeResolveDeliverySheet,
    initialResolveDeliveryDialogState,
    resolveDeliveryDialogReducer,
} from './resolve-delivery-state';

describe('resolve delivery close contract', () => {
    it('clears the selected resolution, notes, and destructive confirmation', () => {
        let form = {
            resolution: 'refund',
            resolution_notes: 'Customer approved',
        };
        let dialogState = resolveDeliveryDialogReducer(
            initialResolveDeliveryDialogState,
            { type: 'confirm-destructive' },
        );
        const events: string[] = [];

        closeResolveDeliverySheet({
            resetForm: () => {
                form = { resolution: '', resolution_notes: '' };
                events.push('form-reset');
            },
            resetDialog: () => {
                dialogState = resolveDeliveryDialogReducer(dialogState, {
                    type: 'reset',
                });
                events.push('dialog-reset');
            },
            onClose: () => events.push('close'),
        });

        expect(form).toEqual({ resolution: '', resolution_notes: '' });
        expect(dialogState).toEqual({ confirmDestructive: false });
        expect(events).toEqual(['form-reset', 'dialog-reset', 'close']);
    });
});

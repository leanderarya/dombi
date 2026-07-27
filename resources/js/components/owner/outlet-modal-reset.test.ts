import { describe, expect, it, vi } from 'vitest';
import {
    closeOutletInfoModal,
    closeOutletLocationModal,
    createOutletInfoFormDefaults,
    createOutletLocationFormDefaults,
} from './outlet-modal-reset';

describe('owner outlet modal reset contracts', () => {
    it('restores outlet info defaults before announcing close', () => {
        const defaults = createOutletInfoFormDefaults({
            name: 'Central',
            phone: null,
            pic_name: 'Ayu',
            pic_phone: '0812',
            pic_position: null,
            operational_notes: 'Morning only',
        });
        let current = { ...defaults, name: 'Edited', pic_name: 'Changed' };
        const events: string[] = [];

        closeOutletInfoModal({
            resetForm: () => {
                current = defaults;
                events.push('reset');
            },
            onClose: () => events.push('close'),
        });

        expect(current).toEqual({
            name: 'Central',
            phone: '',
            pic_name: 'Ayu',
            pic_phone: '0812',
            pic_position: '',
            operational_notes: 'Morning only',
        });
        expect(events).toEqual(['reset', 'close']);
    });

    it('restores all outlet location fields before announcing close', () => {
        const defaults = createOutletLocationFormDefaults({
            latitude: -7.1,
            longitude: 110.4,
            kelurahan: null,
            kecamatan: 'Banyumanik',
            city: 'Semarang',
            province: 'Jawa Tengah',
            postal_code: null,
            address: 'Jalan Lama',
        });
        let current: ReturnType<typeof createOutletLocationFormDefaults> = {
            ...defaults,
            latitude: '-6.9',
            address: 'Edited address',
        };
        const onClose = vi.fn();

        closeOutletLocationModal({
            resetForm: () => {
                current = defaults;
            },
            onClose,
        });

        expect(current).toEqual({
            latitude: -7.1,
            longitude: 110.4,
            kelurahan: '',
            kecamatan: 'Banyumanik',
            city: 'Semarang',
            province: 'Jawa Tengah',
            postal_code: '',
            address: 'Jalan Lama',
        });
        expect(onClose).toHaveBeenCalledOnce();
    });
});

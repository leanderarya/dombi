import { describe, expect, it } from 'vitest';
import { getDeliveryAddressPresentation } from './checkout-address-presentation';

describe('getDeliveryAddressPresentation', () => {
    it('makes missing delivery address an explicit location CTA', () => {
        expect(
            getDeliveryAddressPresentation({
                hasKnownLocation: false,
                displayAddress: '',
            }),
        ).toEqual({
            state: 'empty',
            actionLabel: 'Tentukan Lokasi',
            helperText: 'Wajib diisi untuk menghitung ongkir',
            prompt: 'Pilih dari alamat tersimpan, gunakan GPS, atau cari manual',
        });
    });

    it('keeps selected address summary and exposes change action', () => {
        expect(
            getDeliveryAddressPresentation({
                hasKnownLocation: true,
                selectedAddressLabel: 'Rumah',
                displayAddress: 'Jl. Mawar No. 1',
                addressDetail: 'Pagar hitam',
            }),
        ).toEqual({
            state: 'selected',
            actionLabel: 'Ubah',
            selectedAddressLabel: 'Rumah',
            displayAddress: 'Jl. Mawar No. 1',
            addressDetail: 'Pagar hitam',
        });
    });
});

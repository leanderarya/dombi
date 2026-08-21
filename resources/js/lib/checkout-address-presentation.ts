type DeliveryAddressPresentationInput = {
    hasKnownLocation: boolean;
    selectedAddressLabel?: string | null;
    displayAddress: string;
    addressDetail?: string | null;
};

export function getDeliveryAddressPresentation(
    input: DeliveryAddressPresentationInput,
) {
    if (!input.hasKnownLocation) {
        return {
            state: 'empty' as const,
            actionLabel: 'Tentukan Lokasi',
            helperText: 'Wajib diisi untuk menghitung ongkir',
            prompt: 'Pilih dari alamat tersimpan, gunakan GPS, atau cari manual',
        };
    }

    return {
        state: 'selected' as const,
        actionLabel: 'Ubah',
        selectedAddressLabel: input.selectedAddressLabel ?? undefined,
        displayAddress: input.displayAddress,
        addressDetail: input.addressDetail ?? undefined,
    };
}

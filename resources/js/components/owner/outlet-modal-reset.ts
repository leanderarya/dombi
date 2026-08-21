interface OutletInfoSource {
    name?: string | null;
    phone?: string | null;
    pic_name?: string | null;
    pic_phone?: string | null;
    pic_position?: string | null;
    operational_notes?: string | null;
}

interface OutletLocationSource {
    latitude?: string | number | null;
    longitude?: string | number | null;
    kelurahan?: string | null;
    kecamatan?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
    address?: string | null;
}

interface CloseOutletModalOptions {
    resetForm: () => void;
    onClose: () => void;
}

export function createOutletInfoFormDefaults(outlet: OutletInfoSource) {
    return {
        name: outlet.name ?? '',
        phone: outlet.phone ?? '',
        pic_name: outlet.pic_name ?? '',
        pic_phone: outlet.pic_phone ?? '',
        pic_position: outlet.pic_position ?? '',
        operational_notes: outlet.operational_notes ?? '',
    };
}

export function createOutletLocationFormDefaults(outlet: OutletLocationSource) {
    return {
        latitude: outlet.latitude ?? '',
        longitude: outlet.longitude ?? '',
        kelurahan: outlet.kelurahan ?? '',
        kecamatan: outlet.kecamatan ?? '',
        city: outlet.city ?? '',
        province: outlet.province ?? '',
        postal_code: outlet.postal_code ?? '',
        address: outlet.address ?? '',
    };
}

export function closeOutletInfoModal({
    resetForm,
    onClose,
}: CloseOutletModalOptions): void {
    resetForm();
    onClose();
}

export function closeOutletLocationModal({
    resetForm,
    onClose,
}: CloseOutletModalOptions): void {
    resetForm();
    onClose();
}

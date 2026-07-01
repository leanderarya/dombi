import { Head, useForm } from '@inertiajs/react';
import AddressForm from '@/components/customer/address-form';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';

export default function EditAddress({ address }: any) {
    const form = useForm({
        label: address.label ?? '',
        recipient_name: address.recipient_name,
        phone: address.phone,
        address: address.address,
        address_detail: address.address_detail ?? '',
        kelurahan: address.kelurahan ?? '',
        kecamatan: address.kecamatan ?? '',
        city: address.city ?? '',
        province: address.province ?? '',
        postal_code: address.postal_code ?? '',
        latitude: address.latitude ? String(address.latitude) : '',
        longitude: address.longitude ? String(address.longitude) : '',
        landmark: address.landmark ?? '',
        delivery_notes: address.delivery_notes ?? '',
        is_default: address.is_default,
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        form.put(`/customer/addresses/${address.id}`);
    }

    return (
        <CustomerMobileLayout hideTopBar>
            <Head title="Edit Alamat" />
            <header className="sticky top-0 z-30 -mx-4 -mt-5 mb-5 border-b border-border bg-white px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
                <h1 className="text-base font-semibold text-text">Edit Alamat</h1>
            </header>
            <AddressForm
                data={form.data}
                errors={form.errors}
                processing={form.processing}
                setData={(key, value) => form.setData(key as any, value)}
                onSubmit={handleSubmit}
                submitLabel="Perbarui Alamat"
            />
        </CustomerMobileLayout>
    );
}

import { Head, useForm } from '@inertiajs/react';
import AddressForm from '@/components/customer/address-form';
import PageHeader from '@/components/ui/page-header';

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
        <div className="min-h-dvh bg-background text-text">
            <Head title="Edit Alamat" />

            <PageHeader
                variant="customer"
                title="Edit Alamat"
                backHref="/customer/addresses"
            />

            <main className="mx-auto max-w-lg px-4 pt-4 pb-24">
                <AddressForm
                    data={form.data}
                    errors={form.errors}
                    processing={form.processing}
                    setData={(key, value) => form.setData(key as any, value)}
                    onSubmit={handleSubmit}
                    submitLabel="Perbarui Alamat"
                />
            </main>
        </div>
    );
}

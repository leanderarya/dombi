import { Head, useForm } from '@inertiajs/react';
import AddressForm from '@/components/customer/address-form';
import PageHeader from '@/components/ui/page-header';

export default function CreateAddress() {
    const form = useForm({
        label: '',
        recipient_name: '',
        phone: '',
        address: '',
        address_detail: '',
        kelurahan: '',
        kecamatan: '',
        city: '',
        province: '',
        postal_code: '',
        latitude: '',
        longitude: '',
        landmark: '',
        delivery_notes: '',
        is_default: false,
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        form.post('/customer/addresses');
    }

    return (
        <div className="min-h-dvh bg-background text-text">
            <Head title="Tambah Alamat" />

            <PageHeader
                variant="customer"
                title="Tambah Alamat Baru"
                backHref="/customer/addresses"
            />

            <main className="mx-auto max-w-lg px-4 pt-4 pb-24">
                <AddressForm
                    data={form.data}
                    errors={form.errors}
                    processing={form.processing}
                    setData={(key, value) => form.setData(key as any, value)}
                    onSubmit={handleSubmit}
                    submitLabel="Simpan Alamat"
                />
            </main>
        </div>
    );
}

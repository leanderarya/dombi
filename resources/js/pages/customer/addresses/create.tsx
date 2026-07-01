import { Head, useForm } from '@inertiajs/react';
import AddressForm from '@/components/customer/address-form';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';

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
        <CustomerMobileLayout hideTopBar>
            <Head title="Tambah Alamat" />
            <header className="sticky top-0 z-30 -mx-4 -mt-5 mb-5 border-b border-zinc-100 bg-white px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
                <h1 className="text-base font-semibold text-slate-900">Tambah Alamat Baru</h1>
            </header>
            <AddressForm
                data={form.data}
                errors={form.errors}
                processing={form.processing}
                setData={(key, value) => form.setData(key as any, value)}
                onSubmit={handleSubmit}
                submitLabel="Simpan Alamat"
            />
        </CustomerMobileLayout>
    );
}

import { Head, Link, useForm } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import AddressForm from '@/components/customer/address-form';

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

            <header className="sticky top-0 z-30 border-b border-border bg-white/95 pt-safe backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <Link
                        href="/customer/addresses"
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-sm font-semibold text-text">
                        Tambah Alamat Baru
                    </h1>
                    <div className="h-11 w-11" />
                </div>
            </header>

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

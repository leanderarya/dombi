import { Head, Link, useForm } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import AddressForm from '@/components/customer/address-form';

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

            <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur pt-safe">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <Link href="/customer/addresses" className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80">
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-sm font-semibold text-text">Edit Alamat</h1>
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
                    submitLabel="Perbarui Alamat"
                />
            </main>
        </div>
    );
}

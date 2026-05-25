import { Link } from '@inertiajs/react';

interface Address {
    id: number;
    label?: string | null;
    recipient_name: string;
    phone: string;
    address: string;
    kelurahan?: string | null;
    kecamatan?: string | null;
}

interface Props {
    address: Address | null;
    hasAddresses: boolean;
}

export default function DeliveryAddressCard({ address, hasAddresses }: Props) {
    if (!hasAddresses) {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">Alamat belum tersedia</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-700">Tambah alamat pengiriman untuk melanjutkan.</p>
                <Link href="/customer/addresses/create" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-amber-600 px-4 text-xs font-bold text-white active:bg-amber-700">
                    Tambah Alamat
                </Link>
            </div>
        );
    }

    if (!address) return null;

    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start gap-3">
                {/* Location icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                    <svg className="h-4.5 w-4.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                {/* Content */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">{address.label || 'Alamat Utama'}</span>
                        <Link href="/customer/addresses" className="shrink-0 text-xs font-bold uppercase tracking-wide text-emerald-700 active:text-emerald-800">
                            Ubah
                        </Link>
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-700">{address.recipient_name}</div>
                    <div className="mt-1 text-xs leading-relaxed text-slate-500">{address.address}</div>
                </div>
            </div>
        </div>
    );
}

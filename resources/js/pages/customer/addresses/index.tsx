import { Head, Link, router } from '@inertiajs/react';
import { MapPin, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import CustomerBottomNav from '@/components/customer/bottom-nav';
import OfflineBanner from '@/components/offline-banner';

export default function AddressesIndex({ addresses }: any) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) {
return addresses;
}

        const q = search.toLowerCase();

        return addresses.filter((a: any) =>
            (a.label ?? '').toLowerCase().includes(q) ||
            a.recipient_name.toLowerCase().includes(q) ||
            a.address.toLowerCase().includes(q)
        );
    }, [addresses, search]);

    function handleSetDefault(id: number) {
        router.post(`/customer/addresses/${id}/set-default`);
    }

    return (
        <div className="min-h-dvh bg-[#fbf9f7] text-slate-950">
            <OfflineBanner />

            {/* Sticky Header */}
            <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <Link href="/customer/profile" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <h1 className="text-sm font-semibold text-slate-900">Alamat Saya</h1>
                    <Link href="/customer/addresses/create" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100">
                        <Plus className="h-5 w-5" />
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="mx-auto max-w-lg px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
                <Head title="Alamat Saya" />

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari alamat..."
                        className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                    />
                </div>

                {/* Address List */}
                {filtered.length === 0 ? (
                    <div className="mt-8 flex flex-col items-center py-10 text-center">
                        <MapPin className="h-12 w-12 text-slate-200" />
                        <p className="mt-3 text-sm font-semibold text-slate-600">
                            {search ? 'Tidak ditemukan' : 'Belum ada alamat'}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                            {search ? 'Coba kata kunci lain.' : 'Tambah alamat untuk mulai memesan.'}
                        </p>
                    </div>
                ) : (
                    <div className="mt-4 space-y-3">
                        {filtered.map((address: any) => (
                            <AddressCard
                                key={address.id}
                                address={address}
                                onSetDefault={() => handleSetDefault(address.id)}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Sticky Add Button */}
            <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 px-4">
                <Link
                    href="/customer/addresses/create"
                    className="mx-auto flex max-w-lg min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg active:bg-slate-800"
                >
                    <MapPin className="h-4 w-4" />
                    + Tambah Alamat Baru
                </Link>
            </div>

            <CustomerBottomNav />
        </div>
    );
}

function AddressCard({ address, onSetDefault }: { address: any; onSetDefault: () => void }) {
    const isDefault = address.is_default;
    const locationSummary = [address.village || address.kelurahan, address.district || address.kecamatan].filter(Boolean).join(', ');

    return (
        <div className={`rounded-xl border bg-white p-4 ${isDefault ? 'border-emerald-300' : 'border-zinc-200'}`}>
            {/* Header */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{address.label || 'Alamat'}</span>
                {isDefault && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Utama</span>
                )}
            </div>

            {/* Details */}
            <div className="mt-2 text-sm font-medium text-slate-700">{address.recipient_name}</div>
            <div className="mt-0.5 text-xs text-slate-500">{address.phone}</div>
            <div className="mt-1.5 text-xs leading-relaxed text-slate-600">{address.address_line || address.address}</div>
            {address.address_detail && (
                <div className="mt-1 text-xs text-slate-500">Detail: {address.address_detail}</div>
            )}
            {locationSummary && (
                <div className="mt-1 text-xs text-slate-500">{locationSummary}</div>
            )}
            {address.landmark && (
                <div className="mt-1 text-xs text-slate-500">Patokan: {address.landmark}</div>
            )}

            {/* Actions */}
            <div className="mt-3 flex items-center gap-3 border-t border-zinc-50 pt-3">
                {!isDefault && (
                    <button onClick={onSetDefault} className="text-xs font-bold uppercase tracking-wide text-emerald-700 active:text-emerald-800">
                        Pilih Utama
                    </button>
                )}
                <Link href={`/customer/addresses/${address.id}/edit`} className="flex items-center gap-1 text-xs font-medium text-slate-500 active:text-slate-700">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    Edit
                </Link>
            </div>
        </div>
    );
}

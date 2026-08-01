import { router } from '@inertiajs/react';
import { useState } from 'react';
import OutletLayout from '@/layouts/outlet-layout';

interface ActiveCourier {
    id: number;
    name: string;
    source: string;
    total_deliveries: number;
}

interface Nominee {
    id: number;
    nominee_name: string;
    nominee_phone: string;
    created_at: string;
}

type Tab = 'aktif' | 'menunggu' | 'ditolak';

export default function MyCouriers({ active, pending, rejected }: any) {
    const [tab, setTab] = useState<Tab>('aktif');
    const [showNominate, setShowNominate] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    const tabs: { key: Tab; label: string; count: number }[] = [
        { key: 'aktif', label: 'Aktif', count: active.length },
        { key: 'menunggu', label: 'Menunggu', count: pending.length },
        { key: 'ditolak', label: 'Ditolak', count: rejected.length },
    ];

    const handleNominate = () => {
        router.post('/outlet/my-couriers/nominate', { name, phone });
    };

    return (
        <OutletLayout title="Kurir Saya">
            <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                                    tab === t.key
                                        ? 'bg-white shadow-sm'
                                        : 'text-slate-500'
                                }`}
                            >
                                {t.label} ({t.count})
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowNominate(true)}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
                    >
                        + Calonkan Kurir
                    </button>
                </div>

                {tab === 'aktif' && (
                    <div className="space-y-3">
                        {(active as ActiveCourier[]).map((c) => (
                            <div key={c.id} className="rounded-lg border p-3">
                                <div className="font-semibold">{c.name}</div>
                                <div className="text-sm text-slate-500">
                                    {c.source === 'pusat'
                                        ? 'Kurir Pusat'
                                        : 'Kurir Outlet'}{' '}
                                    · {c.total_deliveries} delivery
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'menunggu' && (
                    <div className="space-y-3">
                        {(pending as Nominee[]).map((c) => (
                            <div key={c.id} className="rounded-lg border p-3">
                                <div className="font-semibold">
                                    {c.nominee_name}
                                </div>
                                <div className="text-sm text-slate-500">
                                    {c.nominee_phone} · Menunggu persetujuan
                                    Owner
                                </div>
                            </div>
                        ))}
                        {pending.length === 0 && (
                            <div className="rounded-lg border p-3 text-sm text-slate-400">
                                Tidak ada kandidat menunggu.
                            </div>
                        )}
                    </div>
                )}

                {tab === 'ditolak' && (
                    <div className="space-y-3">
                        {(rejected as Nominee[]).map((c) => (
                            <div key={c.id} className="rounded-lg border p-3">
                                <div className="font-semibold">
                                    {c.nominee_name}
                                </div>
                                <div className="text-sm text-slate-500">
                                    {c.nominee_phone} · Ditolak
                                </div>
                            </div>
                        ))}
                        {rejected.length === 0 && (
                            <div className="rounded-lg border p-3 text-sm text-slate-400">
                                Tidak ada kandidat ditolak.
                            </div>
                        )}
                    </div>
                )}

                {showNominate && (
                    <div
                        className="fixed inset-0 z-50 flex items-end bg-black/40"
                        onClick={() => setShowNominate(false)}
                    >
                        <div
                            className="w-full max-w-lg rounded-t-2xl bg-white p-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="font-bold">Calonkan Kurir Baru</h3>
                            <p className="mt-1 text-xs text-slate-500">
                                Owner akan menyetujui sebelum kurir aktif.
                            </p>
                            <div className="mt-3 space-y-3">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Nama"
                                    className="w-full rounded-lg border p-3 text-sm"
                                />
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="No. HP"
                                    className="w-full rounded-lg border p-3 text-sm"
                                />
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button
                                    onClick={() => setShowNominate(false)}
                                    className="flex-1 rounded-lg border py-3 text-sm font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleNominate}
                                    disabled={!name}
                                    className="flex-1 rounded-lg bg-emerald-600 py-3 text-sm font-medium text-white disabled:bg-slate-300"
                                >
                                    Ajukan
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </OutletLayout>
    );
}

import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import OwnerLayout from '@/layouts/owner-layout';

interface CourierPusat {
    id: number;
    name: string;
    phone: string | null;
    assigned_outlets: number[];
    assigned_outlet_names: string[];
    total_deliveries: number;
}

interface Candidate {
    id: number;
    outlet_name: string;
    nominated_by_name: string;
    created_at: string;
}

interface Outlet {
    id: number;
    name: string;
}

export default function CourierManagement() {
    const { pusat, candidates, rejected, outlets } = usePage<any>().props;
    const [activeTab, setActiveTab] = useState<'pusat' | 'kandidat' | 'riwayat'>('pusat');
    const [plottingId, setPlottingId] = useState<number | null>(null);
    const [selectedOutlets, setSelectedOutlets] = useState<number[]>([]);

    const tabs = [
        { key: 'pusat', label: 'Kurir Pusat' },
        { key: 'kandidat', label: 'Kandidat Outlet' },
        { key: 'riwayat', label: 'Riwayat' },
    ];

    return (
        <OwnerLayout title="Kelola Kurir">
            <div className="p-4">
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key as any)}
                            className={`flex-1 rounded-md py-2 text-sm font-medium ${
                                activeTab === t.key ? 'bg-white shadow-sm' : 'text-slate-500'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'pusat' && (
                    <div className="mt-4 space-y-3">
                        {pusat.map((c: CourierPusat) => (
                            <div key={c.id} className="rounded-lg border p-3">
                                <div className="flex justify-between">
                                    <div>
                                        <div className="font-semibold">{c.name}</div>
                                        <div className="text-sm text-slate-500">{c.total_deliveries} delivery</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setPlottingId(c.id);
                                            setSelectedOutlets(c.assigned_outlets);
                                        }}
                                        className="text-sm text-emerald-600 font-medium"
                                    >
                                        Plot Outlet
                                    </button>
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                    Outlet: {c.assigned_outlet_names.join(', ') || 'Belum diplot'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'kandidat' && (
                    <div className="mt-4 space-y-3">
                        {candidates.map((c: Candidate) => (
                            <div key={c.id} className="rounded-lg border p-3">
                                <div className="font-semibold">{c.outlet_name}</div>
                                <div className="text-sm text-slate-500">Dicalonkan oleh: {c.nominated_by_name}</div>
                                <div className="mt-2 flex gap-2">
                                    <button
                                        onClick={() => router.post(`/owner/couriers/${c.id}/approve`)}
                                        className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white"
                                    >
                                        Setujui
                                    </button>
                                    <button
                                        onClick={() => router.post(`/owner/couriers/${c.id}/reject`)}
                                        className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white"
                                    >
                                        Tolak
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'riwayat' && (
                    <div className="mt-4 space-y-3">
                        {rejected.map((r: any) => (
                            <div key={r.id} className="rounded-lg border p-3 text-sm text-slate-500">
                                {r.outlet_name} — Ditolak
                            </div>
                        ))}
                    </div>
                )}

                {/* Plot Modal */}
                {plottingId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPlottingId(null)}>
                        <div className="w-full max-w-md rounded-xl bg-white p-4" onClick={e => e.stopPropagation()}>
                            <h3 className="font-bold">Plot Kurir ke Outlet</h3>
                            <div className="mt-3 space-y-2">
                                {outlets.map((o: Outlet) => (
                                    <label key={o.id} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={selectedOutlets.includes(o.id)}
                                            onChange={() => {
                                                setSelectedOutlets(prev =>
                                                    prev.includes(o.id)
                                                        ? prev.filter(id => id !== o.id)
                                                        : [...prev, o.id]
                                                );
                                            }}
                                        />
                                        {o.name}
                                    </label>
                                ))}
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button onClick={() => setPlottingId(null)} className="flex-1 rounded-lg border py-2 text-sm font-medium">Batal</button>
                                <button
                                    onClick={() => {
                                        router.put(`/owner/couriers/${plottingId}/outlets`, { outlet_ids: selectedOutlets });
                                        setPlottingId(null);
                                    }}
                                    className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white"
                                >
                                    Simpan
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
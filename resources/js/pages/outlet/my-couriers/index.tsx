import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import OutletLayout from '@/layouts/outlet-layout';

export default function MyCouriers() {
    const { couriers, pending_count } = usePage<any>().props;
    const [showNominate, setShowNominate] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    const handleNominate = () => {
        router.post('/outlet/my-couriers/nominate', { name, phone });
    };

    return (
        <OutletLayout title="Kurir Saya">
            <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                        {pending_count > 0 && `${pending_count} menunggu persetujuan`}
                    </div>
                    <button
                        onClick={() => setShowNominate(true)}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
                    >
                        + Calonkan Kurir
                    </button>
                </div>

                <div className="space-y-3">
                    {couriers.map((c: any) => (
                        <div key={c.id} className="rounded-lg border p-3">
                            <div className="font-semibold">{c.name}</div>
                            <div className="text-sm text-slate-500">
                                {c.source === 'pusat' ? 'Kurir Pusat' : 'Kurir Outlet'} · {c.total_deliveries} delivery
                            </div>
                        </div>
                    ))}
                </div>

                {showNominate && (
                    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setShowNominate(false)}>
                        <div className="w-full max-w-lg rounded-t-2xl bg-white p-4" onClick={e => e.stopPropagation()}>
                            <h3 className="font-bold">Calonkan Kurir Baru</h3>
                            <p className="mt-1 text-xs text-slate-500">Owner akan menyetujui sebelum kurir aktif.</p>
                            <div className="mt-3 space-y-3">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Nama"
                                    className="w-full rounded-lg border p-3 text-sm"
                                />
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="No. HP"
                                    className="w-full rounded-lg border p-3 text-sm"
                                />
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button onClick={() => setShowNominate(false)} className="flex-1 rounded-lg border py-3 text-sm font-medium">Batal</button>
                                <button onClick={handleNominate} disabled={!name} className="flex-1 rounded-lg bg-emerald-600 py-3 text-sm font-medium text-white disabled:bg-slate-300">
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
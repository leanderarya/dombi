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

interface RevenueRow {
    outlet: { id: number; name: string };
    deliveries: number;
    delivery_fee: number;
    external_cost: number;
    net: number;
}

interface RejectedCourier {
    id: number;
    outlet_name: string;
}

const formatRupiah = (value: number): string =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(value);

type Tab = 'pusat' | 'kandidat' | 'riwayat' | 'pendapatan';

type Period = 'harian' | 'mingguan' | 'bulanan';

const tabs: { key: Tab; label: string }[] = [
    { key: 'pusat', label: 'Kurir Pusat' },
    { key: 'kandidat', label: 'Kandidat Outlet' },
    { key: 'riwayat', label: 'Riwayat' },
    { key: 'pendapatan', label: 'Pendapatan Ongkir' },
];

const PERIODS: { key: Period; label: string }[] = [
    { key: 'harian', label: 'Harian' },
    { key: 'mingguan', label: 'Mingguan' },
    { key: 'bulanan', label: 'Bulanan' },
];

interface PageProps {
    pusat: CourierPusat[];
    candidates: Candidate[];
    rejected: RejectedCourier[];
    outlets: Outlet[];
    revenueSummary: {
        deliveries: number;
        delivery_fee: number;
        external_cost: number;
        net: number;
    };
    revenueOutlets: RevenueRow[];
    [key: string]: unknown;
}

export default function CourierManagement() {
    const {
        pusat,
        candidates,
        rejected,
        outlets,
        revenueSummary,
        revenueOutlets,
    } = usePage<PageProps>().props;
    const { url } = usePage();
    const urlPeriod = new URLSearchParams(url.split('?')[1] ?? '').get(
        'period',
    );
    const [activeTab, setActiveTab] = useState<Tab>('pusat');
    const [period, setPeriod] = useState<Period>(
        PERIODS.some((p) => p.key === urlPeriod)
            ? (urlPeriod as Period)
            : 'harian',
    );
    const [plottingId, setPlottingId] = useState<number | null>(null);
    const [selectedOutlets, setSelectedOutlets] = useState<number[]>([]);
    const [detailOutlet, setDetailOutlet] = useState<RevenueRow | null>(null);

    const changePeriod = (next: Period) => {
        setPeriod(next);
        setDetailOutlet(null);
        router.get(
            '/owner/couriers/management',
            { period: next },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const kpis: { label: string; value: string }[] = [
        {
            label: 'Ongkir Masuk',
            value: formatRupiah(revenueSummary?.delivery_fee ?? 0),
        },
        {
            label: 'Cost Eksternal',
            value: formatRupiah(revenueSummary?.external_cost ?? 0),
        },
        {
            label: 'Net',
            value: formatRupiah(revenueSummary?.net ?? 0),
        },
        {
            label: 'Jumlah Delivery',
            value: String(revenueSummary?.deliveries ?? 0),
        },
    ];

    return (
        <OwnerLayout>
            <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    {PERIODS.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => changePeriod(p.key)}
                            className={`rounded-full px-3 py-1 text-sm font-medium ${
                                period === p.key
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {kpis.map((kpi) => (
                        <div
                            key={kpi.label}
                            className="rounded-lg border bg-white p-3"
                        >
                            <div className="text-xs text-slate-500">
                                {kpi.label}
                            </div>
                            <div className="mt-1 text-lg font-bold tabular-nums">
                                {kpi.value}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`flex-1 rounded-md py-2 text-sm font-medium ${
                                activeTab === t.key
                                    ? 'bg-white shadow-sm'
                                    : 'text-slate-500'
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
                                        <div className="font-semibold">
                                            {c.name}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            {c.total_deliveries} delivery
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setPlottingId(c.id);
                                            setSelectedOutlets(
                                                c.assigned_outlets,
                                            );
                                        }}
                                        className="text-sm font-medium text-emerald-600"
                                    >
                                        Plot Outlet
                                    </button>
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                    Outlet:{' '}
                                    {c.assigned_outlet_names.join(', ') ||
                                        'Belum diplot'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'kandidat' && (
                    <div className="mt-4 space-y-3">
                        {candidates.map((c: Candidate) => (
                            <div key={c.id} className="rounded-lg border p-3">
                                <div className="font-semibold">
                                    {c.outlet_name}
                                </div>
                                <div className="text-sm text-slate-500">
                                    Dicalonkan oleh: {c.nominated_by_name}
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <button
                                        onClick={() =>
                                            router.post(
                                                `/owner/couriers/${c.id}/approve`,
                                            )
                                        }
                                        className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white"
                                    >
                                        Setujui
                                    </button>
                                    <button
                                        onClick={() =>
                                            router.post(
                                                `/owner/couriers/${c.id}/reject`,
                                            )
                                        }
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
                        {rejected.map((r: RejectedCourier) => (
                            <div
                                key={r.id}
                                className="rounded-lg border p-3 text-sm text-slate-500"
                            >
                                {r.outlet_name} — Ditolak
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'pendapatan' && (
                    <div className="mt-4 space-y-3">
                        {revenueOutlets?.map((row: RevenueRow) => (
                            <button
                                key={row.outlet.id}
                                onClick={() => setDetailOutlet(row)}
                                className="w-full rounded-lg border bg-white p-3 text-left"
                            >
                                <div className="flex justify-between">
                                    <div className="font-semibold">
                                        {row.outlet.name}
                                    </div>
                                    <div className="text-sm font-bold text-primary tabular-nums">
                                        {formatRupiah(row.net)}
                                    </div>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                    {row.deliveries} delivery · Ongkir{' '}
                                    {formatRupiah(row.delivery_fee)} · Cost{' '}
                                    {formatRupiah(row.external_cost)}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Plot Modal */}
                {plottingId && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                        onClick={() => setPlottingId(null)}
                    >
                        <div
                            className="w-full max-w-md rounded-xl bg-white p-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="font-bold">Plot Kurir ke Outlet</h3>
                            <div className="mt-3 space-y-2">
                                {outlets.map((o: Outlet) => (
                                    <label
                                        key={o.id}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedOutlets.includes(
                                                o.id,
                                            )}
                                            onChange={() => {
                                                setSelectedOutlets((prev) =>
                                                    prev.includes(o.id)
                                                        ? prev.filter(
                                                              (id) =>
                                                                  id !== o.id,
                                                          )
                                                        : [...prev, o.id],
                                                );
                                            }}
                                        />
                                        {o.name}
                                    </label>
                                ))}
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button
                                    onClick={() => setPlottingId(null)}
                                    className="flex-1 rounded-lg border py-2 text-sm font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={() => {
                                        router.put(
                                            `/owner/couriers/${plottingId}/outlets`,
                                            { outlet_ids: selectedOutlets },
                                        );
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

                {/* Outlet Revenue Detail Modal */}
                {detailOutlet && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                        onClick={() => setDetailOutlet(null)}
                    >
                        <div
                            className="w-full max-w-md rounded-xl bg-white p-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="font-bold">
                                {detailOutlet.outlet.name}
                            </h3>
                            <div className="mt-3 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">
                                        Jumlah Delivery
                                    </span>
                                    <span className="font-semibold tabular-nums">
                                        {detailOutlet.deliveries}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">
                                        Ongkir
                                    </span>
                                    <span className="font-semibold tabular-nums">
                                        {formatRupiah(
                                            detailOutlet.delivery_fee,
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">
                                        Cost Eksternal
                                    </span>
                                    <span className="font-semibold tabular-nums">
                                        {formatRupiah(
                                            detailOutlet.external_cost,
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                    <span className="font-medium">Net</span>
                                    <span className="font-bold text-primary tabular-nums">
                                        {formatRupiah(detailOutlet.net)}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-4">
                                <button
                                    onClick={() => setDetailOutlet(null)}
                                    className="w-full rounded-lg border py-2 text-sm font-medium"
                                >
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}

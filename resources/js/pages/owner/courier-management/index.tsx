import { router, usePage } from '@inertiajs/react';
import { MapPin, Truck, Users, Wallet } from 'lucide-react';
import { useState } from 'react';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerSegmentedTabs from '@/components/owner/owner-segmented-tabs';
import OwnerTable from '@/components/owner/owner-table';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';

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

    const kpiItems = [
        {
            label: 'Ongkir Masuk',
            value: formatCurrency(revenueSummary?.delivery_fee ?? 0),
            icon: <Wallet className="h-5 w-5" />,
            accentColor: '#2563EB',
        },
        {
            label: 'Cost Eksternal',
            value: formatCurrency(revenueSummary?.external_cost ?? 0),
            icon: <Truck className="h-5 w-5" />,
            accentColor: '#D97706',
        },
        {
            label: 'Net',
            value: formatCurrency(revenueSummary?.net ?? 0),
            icon: <Wallet className="h-5 w-5" />,
            accentColor: '#16A34A',
            valueClassName:
                (revenueSummary?.net ?? 0) < 0 ? 'text-red-600' : 'text-text',
        },
        {
            label: 'Jumlah Delivery',
            value: String(revenueSummary?.deliveries ?? 0),
            icon: <Users className="h-5 w-5" />,
            accentColor: '#4F46E5',
        },
    ];

    return (
        <OwnerPageShell
            title="Kurir"
            subtitle="Kelola kurir, kandidat outlet, dan pendapatan ongkir"
        >
            <div className="space-y-6">
                <OwnerKpiStrip cols={4} items={kpiItems} />

                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold tracking-wider text-text-subtle uppercase">
                        Periode
                    </span>
                    {PERIODS.map((p) => (
                        <Button
                            key={p.key}
                            size="sm"
                            variant={period === p.key ? 'primary' : 'outline'}
                            onClick={() => changePeriod(p.key)}
                        >
                            {p.label}
                        </Button>
                    ))}
                </div>

                <OwnerSegmentedTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={(key) => setActiveTab(key as Tab)}
                />

                {activeTab === 'pusat' && (
                    <OwnerTable>
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border text-left text-xs font-semibold tracking-wider text-text-subtle uppercase">
                                    <th className="px-4 py-3">Nama</th>
                                    <th className="px-4 py-3">Delivery</th>
                                    <th className="px-4 py-3">Outlet</th>
                                    <th className="px-4 py-3 text-right">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {pusat.map((c: CourierPusat) => (
                                    <tr
                                        key={c.id}
                                        className="hover:bg-surface-muted/60"
                                    >
                                        <td className="px-4 py-3 font-medium text-text">
                                            {c.name}
                                        </td>
                                        <td className="px-4 py-3 text-text-muted tabular-nums">
                                            {c.total_deliveries} delivery
                                        </td>
                                        <td className="px-4 py-3 text-xs text-text-muted">
                                            {c.assigned_outlet_names.join(
                                                ', ',
                                            ) || 'Belum diplot'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setPlottingId(c.id);
                                                    setSelectedOutlets(
                                                        c.assigned_outlets,
                                                    );
                                                }}
                                            >
                                                Plot Outlet
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </OwnerTable>
                )}

                {activeTab === 'kandidat' && (
                    <OwnerTable>
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border text-left text-xs font-semibold tracking-wider text-text-subtle uppercase">
                                    <th className="px-4 py-3">Outlet</th>
                                    <th className="px-4 py-3">
                                        Dicalonkan oleh
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {candidates.map((c: Candidate) => (
                                    <tr
                                        key={c.id}
                                        className="hover:bg-surface-muted/60"
                                    >
                                        <td className="px-4 py-3 font-medium text-text">
                                            {c.outlet_name}
                                        </td>
                                        <td className="px-4 py-3 text-text-muted">
                                            {c.nominated_by_name}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={() =>
                                                        router.post(
                                                            `/owner/couriers/${c.id}/approve`,
                                                        )
                                                    }
                                                >
                                                    Setujui
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() =>
                                                        router.post(
                                                            `/owner/couriers/${c.id}/reject`,
                                                        )
                                                    }
                                                >
                                                    Tolak
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </OwnerTable>
                )}

                {activeTab === 'riwayat' && (
                    <OwnerTable>
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border text-left text-xs font-semibold tracking-wider text-text-subtle uppercase">
                                    <th className="px-4 py-3">Outlet</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rejected.map((r: RejectedCourier) => (
                                    <tr
                                        key={r.id}
                                        className="hover:bg-surface-muted/60"
                                    >
                                        <td className="px-4 py-3 font-medium text-text">
                                            {r.outlet_name}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge variant="danger">
                                                Ditolak
                                            </StatusBadge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </OwnerTable>
                )}

                {activeTab === 'pendapatan' && (
                    <OwnerTable>
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border text-left text-xs font-semibold tracking-wider text-text-subtle uppercase">
                                    <th className="px-4 py-3">Outlet</th>
                                    <th className="px-4 py-3 text-right">
                                        Delivery
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        Ongkir
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        Cost Eksternal
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        Net
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {revenueOutlets?.map((row: RevenueRow) => (
                                    <tr
                                        key={row.outlet.id}
                                        onClick={() => setDetailOutlet(row)}
                                        className="cursor-pointer hover:bg-surface-muted/60"
                                    >
                                        <td className="px-4 py-3 font-medium text-text">
                                            {row.outlet.name}
                                        </td>
                                        <td className="px-4 py-3 text-right text-text-muted tabular-nums">
                                            {row.deliveries}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {formatCurrency(row.delivery_fee)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {formatCurrency(row.external_cost)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-primary tabular-nums">
                                            {formatCurrency(row.net)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </OwnerTable>
                )}

                {activeTab === 'pendapatan' && revenueOutlets?.length === 0 && (
                    <EmptyState
                        icon={<MapPin className="h-8 w-8" />}
                        title="Belum ada data pendapatan"
                        description="Tidak ada delivery selesai pada periode ini"
                    />
                )}

                {/* Plot Modal */}
                <Dialog
                    open={plottingId !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setPlottingId(null);
                        }
                    }}
                >
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Plot Kurir ke Outlet</DialogTitle>
                            <DialogDescription>
                                Pilih outlet yang boleh memakai kurir pusat ini.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            {outlets.map((o: Outlet) => (
                                <label
                                    key={o.id}
                                    className="flex cursor-pointer items-center gap-2 text-sm"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedOutlets.includes(o.id)}
                                        onChange={() => {
                                            setSelectedOutlets((prev) =>
                                                prev.includes(o.id)
                                                    ? prev.filter(
                                                          (id) => id !== o.id,
                                                      )
                                                    : [...prev, o.id],
                                            );
                                        }}
                                    />
                                    {o.name}
                                </label>
                            ))}
                        </div>
                        <DialogFooter className="mt-4">
                            <Button
                                variant="outline"
                                onClick={() => setPlottingId(null)}
                            >
                                Batal
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => {
                                    if (plottingId !== null) {
                                        router.put(
                                            `/owner/couriers/${plottingId}/outlets`,
                                            { outlet_ids: selectedOutlets },
                                        );
                                    }

                                    setPlottingId(null);
                                }}
                            >
                                Simpan
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Outlet Revenue Detail Modal */}
                <Dialog
                    open={detailOutlet !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setDetailOutlet(null);
                        }
                    }}
                >
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>
                                {detailOutlet?.outlet.name}
                            </DialogTitle>
                            <DialogDescription>
                                Ringkasan pendapatan ongkir periode{' '}
                                {PERIODS.find(
                                    (p) => p.key === period,
                                )?.label.toLowerCase()}
                            </DialogDescription>
                        </DialogHeader>
                        {detailOutlet && (
                            <div>
                                <OwnerDetailRow
                                    label="Jumlah Delivery"
                                    value={detailOutlet.deliveries}
                                    bold
                                />
                                <OwnerDetailRow
                                    label="Ongkir"
                                    value={formatCurrency(
                                        detailOutlet.delivery_fee,
                                    )}
                                    bold
                                />
                                <OwnerDetailRow
                                    label="Cost Eksternal"
                                    value={formatCurrency(
                                        detailOutlet.external_cost,
                                    )}
                                    bold
                                />
                                <OwnerDetailRow
                                    label="Net"
                                    value={formatCurrency(detailOutlet.net)}
                                    bold
                                    danger={detailOutlet.net < 0}
                                />
                            </div>
                        )}
                        <DialogFooter className="mt-4">
                            <Button
                                variant="outline"
                                onClick={() => setDetailOutlet(null)}
                            >
                                Tutup
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </OwnerPageShell>
    );
}

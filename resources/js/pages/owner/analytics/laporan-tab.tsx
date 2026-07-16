import { router } from '@inertiajs/react';
import {
    CheckCircle,
    ChevronDown,
    ClipboardList,
    DollarSign,
    Download,
    Truck,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import FilterSheet from '@/components/owner/filter-sheet';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/format';
import BreakdownCard from './breakdown-card';
import ExportPanel from './export-panel';

interface ReportSummary {
    totalOrders: number;
    totalRevenue: number;
    completedOrders: number;
    cancelledOrders: number;
    completedDeliveries: number;
    failedDeliveries: number;
}

interface Props {
    summary?: ReportSummary;
    ordersByStatus?: Record<string, number>;
    deliveriesByStatus?: Record<string, number>;
    outlets?: any[];
    filters?: Record<string, any>;
}

const statusLabels: Record<string, string> = {
    pending: 'Tertunda',
    confirmed: 'Dikonfirmasi',
    preparing: 'Disiapkan',
    ready_for_pickup: 'Siap',
    delivering: 'Dikirim',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    failed: 'Gagal',
    waiting_pickup: 'Menunggu',
    retry_delivery: 'Coba Ulang',
    returned_to_outlet: 'Dikembalikan',
    cancelled_and_released: 'Dilepas',
};

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export function LaporanTab({
    summary,
    ordersByStatus = {},
    deliveriesByStatus = {},
    outlets = [],
    filters = {},
}: Props) {
    const [filterOpen, setFilterOpen] = useState(false);
    const [period, setPeriod] = useState('month');
    const [exporting, setExporting] = useState<string | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [secondaryOpen, setSecondaryOpen] = useState(false);

    function handleFilter(key: string, value: string) {
        router.get(
            '/owner/analytics',
            { tab: 'laporan', ...filters, [key]: value || undefined },
            { preserveState: true, replace: true },
        );
    }

    function handleExport() {
        const params = new URLSearchParams();

        if (filters.date_from) {
            params.set('date_from', filters.date_from);
        }

        if (filters.date_to) {
            params.set('date_to', filters.date_to);
        }

        if (filters.outlet_id) {
            params.set('outlet_id', String(filters.outlet_id));
        }

        window.location.href = `/owner/reports/export-csv?${params.toString()}`;
    }

    const handleExportReport = (type: string) => {
        setExporting(type);
        router.get(
            `/owner/reports/${type}/export?period=${period}`,
            {},
            { onFinish: () => setExporting(null) },
        );
    };

    if (!summary) {
        return (
            <EmptyState
                icon={
                    <ClipboardList
                        className="h-8 w-8 text-text-subtle"
                        aria-hidden="true"
                    />
                }
                title="Belum ada data"
                description="Laporan akan muncul di sini."
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    type="date"
                    className="flex-1"
                    value={filters.date_from ?? ''}
                    onChange={(e) => handleFilter('date_from', e.target.value)}
                />
                <Input
                    type="date"
                    className="flex-1"
                    value={filters.date_to ?? ''}
                    onChange={(e) => handleFilter('date_to', e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4" aria-hidden="true" /> CSV
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setFilterOpen(true)}
                    aria-label="Filter"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                </Button>
            </div>

            <div
                className="scrollbar-none flex flex-wrap gap-2 overflow-x-auto"
                role="group"
                aria-label="Filter periode"
            >
                {periods.map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        onClick={() => setPeriod(p.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                            period === p.key
                                ? 'bg-primary/10 text-primary ring-primary/20'
                                : 'hover:bg-mint-wash bg-surface text-text-muted ring-border'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                <div className="space-y-3" aria-label="Breakdown laporan">
                    <BreakdownCard
                        title="Pesanan per Status"
                        data={ordersByStatus}
                        statusLabels={statusLabels}
                    />
                    <BreakdownCard
                        title="Pengiriman per Status"
                        data={deliveriesByStatus}
                        statusLabels={statusLabels}
                    />
                </div>

                <div className="space-y-4">
                    <div className="lg:sticky lg:top-4 lg:space-y-4">
                        <ExportPanel
                            open={exportOpen}
                            onToggle={() => setExportOpen(!exportOpen)}
                            exporting={exporting}
                            onExport={handleExportReport}
                        />

                        <div
                            className="space-y-2"
                            aria-label="Ringkasan laporan"
                        >
                            <div className="rounded-xl bg-surface p-5 shadow-card">
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                    <ClipboardList
                                        className="h-4 w-4 text-text-subtle"
                                        aria-hidden="true"
                                    />
                                    Total Pesanan
                                </div>
                                <div className="mt-2 text-3xl font-bold text-text">
                                    {summary.totalOrders}
                                </div>
                                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-text-subtle">
                                    Pesanan
                                </div>
                            </div>
                            <div className="rounded-xl bg-surface p-5 shadow-card">
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                    <DollarSign
                                        className="h-4 w-4 text-emerald-500"
                                        aria-hidden="true"
                                    />
                                    Pendapatan
                                </div>
                                <div className="mt-2 text-3xl font-bold text-text">
                                    {formatCurrency(summary.totalRevenue)}
                                </div>
                                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-500">
                                    Total pendapatan
                                </div>
                            </div>
                            <div className="rounded-xl bg-surface p-5 shadow-card">
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                    <CheckCircle
                                        className="h-4 w-4 text-emerald-500"
                                        aria-hidden="true"
                                    />
                                    Selesai
                                </div>
                                <div className="mt-2 text-3xl font-bold text-text">
                                    {summary.completedOrders}
                                </div>
                                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-500">
                                    Pesanan selesai
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-surface shadow-card">
                            <button
                                type="button"
                                onClick={() => setSecondaryOpen(!secondaryOpen)}
                                className="flex w-full items-center justify-between p-3"
                            >
                                <div className="text-xs font-medium text-text-muted">
                                    Detail Lainnya
                                </div>
                                <ChevronDown
                                    className={`h-3.5 w-3.5 text-text-muted transition-transform ${secondaryOpen ? 'rotate-180' : ''}`}
                                    aria-hidden="true"
                                />
                            </button>
                            {secondaryOpen && (
                                <div
                                    className="space-y-2 border-t border-border px-3 pt-2 pb-3"
                                    aria-label="Detail tambahan laporan"
                                >
                                    <div className="rounded-xl bg-surface p-5 shadow-card">
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <XCircle
                                                className="h-4 w-4 text-red-500"
                                                aria-hidden="true"
                                            />
                                            Dibatalkan
                                        </div>
                                        <div className="mt-2 text-3xl font-bold text-text">
                                            {summary.cancelledOrders}
                                        </div>
                                        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-red-500">
                                            Dibatalkan
                                        </div>
                                    </div>
                                    <div className="rounded-xl bg-surface p-5 shadow-card">
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <Truck
                                                className="h-4 w-4 text-emerald-500"
                                                aria-hidden="true"
                                            />
                                            Pengiriman Berhasil
                                        </div>
                                        <div className="mt-2 text-3xl font-bold text-text">
                                            {summary.completedDeliveries}
                                        </div>
                                        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-500">
                                            Pengiriman selesai
                                        </div>
                                    </div>
                                    <div className="rounded-xl bg-surface p-5 shadow-card">
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <XCircle
                                                className="h-4 w-4 text-red-500"
                                                aria-hidden="true"
                                            />
                                            Pengiriman Gagal
                                        </div>
                                        <div className="mt-2 text-3xl font-bold text-text">
                                            {summary.failedDeliveries}
                                        </div>
                                        {summary.failedDeliveries > 0 && (
                                            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-red-500">
                                                Perlu ditinjau
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                sections={[
                    {
                        key: 'outlet_id',
                        label: 'Outlet',
                        options: outlets.map((o: any) => ({
                            value: String(o.id),
                            label: o.name,
                        })),
                        value: filters.outlet_id
                            ? String(filters.outlet_id)
                            : '',
                    },
                ]}
                onApply={(f) =>
                    router.get(
                        '/owner/analytics',
                        {
                            tab: 'laporan',
                            ...filters,
                            outlet_id: f.outlet_id || undefined,
                        },
                        { preserveState: true, replace: true },
                    )
                }
            />
        </div>
    );
}

import { router } from '@inertiajs/react';
import { Download } from 'lucide-react';
import { useState } from 'react';
import FilterSheet from '@/components/owner/filter-sheet';
import { HeaderIconButton, FilterIcon } from '@/components/owner/header-icon-utils';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { formatCurrency } from '@/lib/format';

const statusLabels: Record<string, string> = { pending: 'Tertunda', confirmed: 'Dikonfirmasi', preparing: 'Disiapkan', ready_for_pickup: 'Siap', delivering: 'Dikirim', completed: 'Selesai', cancelled: 'Dibatalkan', failed: 'Gagal', waiting_pickup: 'Menunggu', retry_delivery: 'Coba Ulang', returned_to_outlet: 'Dikembalikan', cancelled_and_released: 'Dilepas' };

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function ReportsIndex({ summary, ordersByStatus, deliveriesByStatus, outlets, filters }: any) {
    const [filterOpen, setFilterOpen] = useState(false);
    const [period, setPeriod] = useState('month');
    const [exporting, setExporting] = useState<string | null>(null);

    function handleFilter(key: string, value: string) {
        router.get('/owner/reports', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
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
        router.get(`/owner/reports/${type}/export?period=${period}`, {}, {
            onFinish: () => setExporting(null),
        });
    };

    return (
        <OwnerPageShell
            title="Laporan"
            headerRight={
                <>
                    <button onClick={handleExport} className="flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-all duration-150 active:scale-[0.98] active:bg-slate-50">
                        <Download className="h-4 w-4" /> CSV
                    </button>
                    <HeaderIconButton label="Filter" onClick={() => setFilterOpen(true)}><FilterIcon /></HeaderIconButton>
                </>
            }
        >
            {/* Date filters inline */}
            <div className="flex gap-2">
                <input type="date" className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px]" value={filters.date_from} onChange={(e) => handleFilter('date_from', e.target.value)} />
                <input type="date" className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px]" value={filters.date_to} onChange={(e) => handleFilter('date_to', e.target.value)} />
            </div>

            {/* Period Selector */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {periods.map((p) => (
                    <button
                        key={p.key}
                        onClick={() => setPeriod(p.key)}
                        className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                            period === p.key
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Export Cards */}
            <div className="space-y-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900 mb-1">Laporan Orders</div>
                    <p className="text-xs text-zinc-500 mb-3">Download data order completed</p>
                    <button
                        onClick={() => handleExportReport('orders')}
                        disabled={exporting === 'orders'}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white active:bg-emerald-700 disabled:opacity-50"
                    >
                        {exporting === 'orders' ? 'Mengexport...' : 'Download CSV'}
                    </button>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900 mb-1">Laporan Settlements</div>
                    <p className="text-xs text-zinc-500 mb-3">Download data settlement outlet</p>
                    <button
                        onClick={() => handleExportReport('settlements')}
                        disabled={exporting === 'settlements'}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white active:bg-emerald-700 disabled:opacity-50"
                    >
                        {exporting === 'settlements' ? 'Mengexport...' : 'Download CSV'}
                    </button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="mt-3 grid grid-cols-2 gap-2">
                <Kpi label="Total Pesanan" value={String(summary.totalOrders)} />
                <Kpi label="Pendapatan" value={formatCurrency(summary.totalRevenue)} highlight />
                <Kpi label="Selesai" value={String(summary.completedOrders)} />
                <Kpi label="Dibatalkan" value={String(summary.cancelledOrders)} />
                <Kpi label="Pengiriman Berhasil" value={String(summary.completedDeliveries)} />
                <Kpi label="Pengiriman Gagal" value={String(summary.failedDeliveries)} alert={summary.failedDeliveries > 0} />
            </div>

            {/* Breakdown */}
            <div className="mt-4 space-y-3">
                <BreakdownCard title="Pesanan per Status" data={ordersByStatus} />
                <BreakdownCard title="Pengiriman per Status" data={deliveriesByStatus} />
            </div>

            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                sections={[
                    { key: 'outlet_id', label: 'Outlet', options: outlets.map((o: any) => ({ value: String(o.id), label: o.name })), value: filters.outlet_id ? String(filters.outlet_id) : '' },
                ]}
                onApply={(f) => router.get('/owner/reports', { ...filters, outlet_id: f.outlet_id || undefined }, { preserveState: true, replace: true })}
            />
        </OwnerPageShell>
    );
}

function Kpi({ label, value, highlight, alert }: { label: string; value: string; highlight?: boolean; alert?: boolean }) {
    return (
        <div className={`rounded-lg border p-3 ${alert ? 'border-red-200 bg-red-50' : highlight ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className={`mt-0.5 text-lg font-bold tabular-nums ${highlight ? 'text-emerald-800' : alert ? 'text-red-800' : 'text-slate-900'}`}>{value}</div>
        </div>
    );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
    const entries = Object.entries(data);

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</div>
            {entries.length === 0 ? <p className="mt-2 text-xs text-slate-400">Tidak ada data</p> : (
                <div className="mt-2 space-y-1.5">
                    {entries.map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{statusLabels[status] ?? status}</span>
                            <span className="font-bold tabular-nums text-slate-900">{count}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

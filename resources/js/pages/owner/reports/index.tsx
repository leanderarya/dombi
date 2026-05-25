import { Head, router } from '@inertiajs/react';
import OwnerLayout from '@/layouts/owner-layout';
import { formatCurrency } from '@/lib/format';

interface Props {
    summary: {
        totalOrders: number;
        totalRevenue: number;
        completedOrders: number;
        cancelledOrders: number;
        failedDeliveries: number;
        completedDeliveries: number;
        stockMovements: number;
        restockRequests: number;
    };
    ordersByStatus: Record<string, number>;
    deliveriesByStatus: Record<string, number>;
    outlets: { id: number; name: string }[];
    filters: { date_from: string; date_to: string; outlet_id: number | null };
}

const statusLabels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready_for_pickup: 'Ready Pickup',
    picked_up: 'Picked Up',
    delivering: 'Delivering',
    completed: 'Completed',
    cancelled: 'Cancelled',
    failed: 'Failed',
    waiting_pickup: 'Waiting Pickup',
    retry_delivery: 'Retry',
    returned_to_outlet: 'Returned',
    cancelled_and_released: 'Cancelled',
};

export default function ReportsIndex({ summary, ordersByStatus, deliveriesByStatus, outlets, filters }: Props) {
    function handleFilter(key: string, value: string) {
        router.get('/owner/reports', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    }

    function handleExport() {
        const params = new URLSearchParams();
        if (filters.date_from) params.set('date_from', filters.date_from);
        if (filters.date_to) params.set('date_to', filters.date_to);
        if (filters.outlet_id) params.set('outlet_id', String(filters.outlet_id));
        window.location.href = `/owner/reports/export-csv?${params.toString()}`;
    }

    return (
        <OwnerLayout>
            <Head title="Reports" />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold sm:text-2xl">Laporan Operasional</h1>
                <button onClick={handleExport} className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium active:bg-zinc-50">
                    📥 Export CSV
                </button>
            </div>

            {/* Filters */}
            <div className="mt-4 flex flex-wrap gap-3">
                <input
                    type="date"
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={filters.date_from}
                    onChange={(e) => handleFilter('date_from', e.target.value)}
                />
                <input
                    type="date"
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={filters.date_to}
                    onChange={(e) => handleFilter('date_to', e.target.value)}
                />
                <select
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={filters.outlet_id ?? ''}
                    onChange={(e) => handleFilter('outlet_id', e.target.value)}
                >
                    <option value="">Semua Outlet</option>
                    {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
            </div>

            {/* Summary Cards */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryCard label="Total Orders" value={String(summary.totalOrders)} />
                <SummaryCard label="Revenue" value={formatCurrency(summary.totalRevenue)} highlight />
                <SummaryCard label="Completed" value={String(summary.completedOrders)} />
                <SummaryCard label="Cancelled" value={String(summary.cancelledOrders)} />
                <SummaryCard label="Delivery Selesai" value={String(summary.completedDeliveries)} />
                <SummaryCard label="Delivery Gagal" value={String(summary.failedDeliveries)} alert={summary.failedDeliveries > 0} />
                <SummaryCard label="Stock Movements" value={String(summary.stockMovements)} />
                <SummaryCard label="Restock Requests" value={String(summary.restockRequests)} />
            </div>

            {/* Breakdown */}
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <section className="rounded-xl border border-zinc-200 bg-white p-4">
                    <h2 className="text-sm font-semibold text-slate-700">Orders by Status</h2>
                    <div className="mt-3 space-y-2">
                        {Object.entries(ordersByStatus).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">{statusLabels[status] ?? status}</span>
                                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium">{count}</span>
                            </div>
                        ))}
                        {Object.keys(ordersByStatus).length === 0 && <p className="text-sm text-zinc-400">Tidak ada data.</p>}
                    </div>
                </section>

                <section className="rounded-xl border border-zinc-200 bg-white p-4">
                    <h2 className="text-sm font-semibold text-slate-700">Deliveries by Status</h2>
                    <div className="mt-3 space-y-2">
                        {Object.entries(deliveriesByStatus).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">{statusLabels[status] ?? status}</span>
                                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium">{count}</span>
                            </div>
                        ))}
                        {Object.keys(deliveriesByStatus).length === 0 && <p className="text-sm text-zinc-400">Tidak ada data.</p>}
                    </div>
                </section>
            </div>
        </OwnerLayout>
    );
}

function SummaryCard({ label, value, highlight, alert }: { label: string; value: string; highlight?: boolean; alert?: boolean }) {
    return (
        <div className={`rounded-xl border p-3 ${alert ? 'border-red-200 bg-red-50' : highlight ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-100 bg-white'}`}>
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className={`mt-1 text-lg font-bold ${highlight ? 'text-emerald-800' : alert ? 'text-red-800' : 'text-slate-900'}`}>{value}</div>
        </div>
    );
}

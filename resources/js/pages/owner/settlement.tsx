import { router, Link } from '@inertiajs/react';
import { formatCurrency, formatDate } from '@/lib/format';
import OwnerPageShell from '@/components/owner/owner-page-shell';

interface OutletReconciliation {
    outlet: { id: number; name: string };
    center_share: number;
    verified_payments: number;
    pending_payments: number;
    outstanding: number;
}

interface PendingVerification {
    id: number;
    outlet: { id: number; name: string };
    amount: number;
    reference_number: string;
    payment_date: string;
    notes: string | null;
    created_at: string;
}

interface RecentPayment {
    id: number;
    outlet: { id: number; name: string };
    amount: number;
    reference_number: string;
    payment_date: string;
    verifier: string | null;
    verified_at: string | null;
}

interface OverdueOutlet {
    outlet: { id: number; name: string };
    outstanding: number;
    oldest_due_date: string;
    days_overdue: number;
}

interface DashboardData {
    outlets: OutletReconciliation[];
    totals: {
        gross_revenue: number;
        center_share: number;
        outlet_margin: number;
        outstanding_amount: number;
    };
    period: { from: string; to: string };
}

interface ReconciliationData {
    totals: {
        center_share: number;
        collected: number;
        outstanding: number;
        pending_verification: number;
    };
    pending_verifications: PendingVerification[];
    recent_payments: RecentPayment[];
}

interface Props {
    dashboard: DashboardData;
    reconciliation: ReconciliationData;
    overdue: OverdueOutlet[];
    period: string;
    periodRange: { from: string; to: string };
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function OwnerSettlement({ dashboard, reconciliation, overdue, period }: Props) {
    const handlePeriodChange = (newPeriod: string) => {
        router.get('/owner/settlement', { period: newPeriod }, { preserveState: true });
    };

    return (
        <OwnerPageShell title="Penagihan" subtitle="Kelola verifikasi pembayaran dan monitoring kewajiban outlet">
            {/* Period Selector */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
                {periods.map((p) => (
                    <button
                        key={p.key}
                        onClick={() => handlePeriodChange(p.key)}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                            period === p.key
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Reconciliation Summary */}
            <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-xs text-zinc-500">Total Bagian Pusat</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(reconciliation.totals.center_share)}</div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-xs text-zinc-500">Sudah Dikumpulkan</div>
                    <div className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(reconciliation.totals.collected)}</div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-xs text-zinc-500">Belum Dibayar</div>
                    <div className="mt-1 text-xl font-bold text-red-600">{formatCurrency(reconciliation.totals.outstanding)}</div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-xs text-zinc-500">Menunggu Verifikasi</div>
                    <div className="mt-1 text-xl font-bold text-amber-600">{formatCurrency(reconciliation.totals.pending_verification)}</div>
                </div>
            </div>

            {/* Pending Verifications */}
            {reconciliation.pending_verifications.length > 0 && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="mb-3 text-sm font-semibold text-amber-900">
                        Menunggu Verifikasi ({reconciliation.pending_verifications.length})
                    </div>
                    <div className="space-y-2">
                        {reconciliation.pending_verifications.map((p) => (
                            <div key={p.id} className="flex items-center justify-between rounded-lg bg-white p-3">
                                <div>
                                    <div className="text-sm font-medium text-slate-900">{p.outlet.name}</div>
                                    <div className="text-xs text-zinc-500">{p.reference_number}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-emerald-700">{formatCurrency(p.amount)}</div>
                                    <Link
                                        href="/owner/settlement-payments"
                                        className="text-xs text-emerald-600 hover:text-emerald-700"
                                    >
                                        Verifikasi
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Overdue Outlets */}
            {overdue.length > 0 && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="mb-3 text-sm font-semibold text-red-900">Outlet Terlambat</div>
                    <div className="space-y-2">
                        {overdue.map((o) => (
                            <div key={o.outlet.id} className="flex items-center justify-between rounded-lg bg-white p-3">
                                <div>
                                    <div className="text-sm font-medium text-slate-900">{o.outlet.name}</div>
                                    <div className="text-xs text-red-600">{o.days_overdue} hari terlambat</div>
                                </div>
                                <div className="text-sm font-bold text-red-700">{formatCurrency(o.outstanding)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Per Outlet Table */}
            <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-slate-900">Per Outlet</div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-200">
                                <th className="pb-2 text-left font-medium text-zinc-500">Outlet</th>
                                <th className="pb-2 text-right font-medium text-zinc-500">Bagian Pusat</th>
                                <th className="pb-2 text-right font-medium text-zinc-500">Dibayar</th>
                                <th className="pb-2 text-right font-medium text-zinc-500">Belum Dibayar</th>
                                <th className="pb-2 text-right font-medium text-zinc-500">Detail</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dashboard.outlets.map((item) => (
                                <tr key={item.outlet.id} className="border-b border-zinc-100">
                                    <td className="py-3 font-medium text-slate-900">{item.outlet.name}</td>
                                    <td className="py-3 text-right tabular-nums">{formatCurrency(item.center_share)}</td>
                                    <td className="py-3 text-right tabular-nums text-emerald-600">{formatCurrency(item.verified_payments)}</td>
                                    <td className="py-3 text-right tabular-nums text-red-600">{formatCurrency(item.outstanding)}</td>
                                    <td className="py-3 text-right">
                                        <Link
                                            href={`/owner/settlement/outlet/${item.outlet.id}?period=${period}`}
                                            className="text-emerald-600 hover:text-emerald-700"
                                        >
                                            Lihat
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent Payments */}
            {reconciliation.recent_payments.length > 0 && (
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="mb-3 text-sm font-semibold text-slate-900">Pembayaran Terbaru</div>
                    <div className="space-y-2">
                        {reconciliation.recent_payments.map((p) => (
                            <div key={p.id} className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                                <div>
                                    <div className="text-sm font-medium text-slate-900">{p.outlet.name}</div>
                                    <div className="text-xs text-zinc-500">{p.reference_number} &bull; {formatDate(p.payment_date)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-emerald-700">{formatCurrency(p.amount)}</div>
                                    {p.verifier && <div className="text-xs text-zinc-400">oleh {p.verifier}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payment History Link */}
            <div className="mt-4 text-center">
                <Link
                    href="/owner/settlement-payments"
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                    Lihat Semua Pembayaran →
                </Link>
            </div>
        </OwnerPageShell>
    );
}

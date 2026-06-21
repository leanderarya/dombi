import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import FinanceStatusBadge, { getOverdueDays } from './finance-status-badge';

interface Props {
    outletId: number;
    outletName: string;
    totalSales: number;
    totalOutstanding: number;
    totalPaid: number;
    displayStatus: string;
    nearestDueDate: string | null;
}

export default function FinanceOutletCard({
    outletId,
    outletName,
    totalSales,
    totalOutstanding,
    totalPaid,
    displayStatus,
    nearestDueDate,
}: Props) {
    const overdueDays = getOverdueDays(nearestDueDate);
    const isOverdue = displayStatus === 'overdue';

    return (
        <Link
            href={`/owner/finance/settlements/${outletId}`}
            className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-emerald-200 hover:shadow-sm"
        >
            {/* Status dot */}
            <FinanceStatusBadge status={displayStatus} className="hidden sm:inline-flex" />
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full sm:hidden ${
                displayStatus === 'overdue' ? 'bg-red-500' :
                displayStatus === 'unpaid' ? 'bg-amber-500' :
                displayStatus === 'partial' ? 'bg-blue-500' :
                displayStatus === 'paid' ? 'bg-emerald-500' :
                'bg-slate-300'
            }`} />

            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{outletName}</span>
                    {isOverdue && overdueDays > 0 && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                            {overdueDays} Hari
                        </span>
                    )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                    {totalSales > 0 && <span>Penjualan: {formatCurrency(totalSales)}</span>}
                    {totalOutstanding > 0 && <span className="font-semibold text-red-600">Sisa: {formatCurrency(totalOutstanding)}</span>}
                    {totalPaid > 0 && <span className="text-emerald-600">Dibayar: {formatCurrency(totalPaid)}</span>}
                </div>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                {displayStatus !== 'paid' && displayStatus !== 'no_activity' && totalOutstanding > 0 ? 'Tagih' : 'Detail'}
                <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500" />
            </div>
        </Link>
    );
}

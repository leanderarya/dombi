import { Link } from '@inertiajs/react';
import { ChevronRight, ArrowUpRight } from 'lucide-react';
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
    const needsAction = displayStatus === 'overdue' || displayStatus === 'unpaid';

    return (
        <Link
            href={`/owner/finance/settlements/${outletId}`}
            className="group flex items-center gap-4 rounded-lg border border-border bg-white p-4 transition-all duration-200"
        >
            {/* Status badge */}
            <FinanceStatusBadge status={displayStatus} />

            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">{outletName}</span>
                    {isOverdue && overdueDays > 0 && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                            {overdueDays} Hari
                        </span>
                    )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                    {totalSales > 0 && <span>Penjualan: {formatCurrency(totalSales)}</span>}
                    {totalOutstanding > 0 && <span className="font-semibold text-red-600">Sisa: {formatCurrency(totalOutstanding)}</span>}
                    {totalPaid > 0 && <span className="text-emerald-600">Dibayar: {formatCurrency(totalPaid)}</span>}
                </div>
                {nearestDueDate && needsAction && (
                    <p className="mt-1 text-xs text-text-subtle">
                        Jatuh tempo: {new Date(nearestDueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                )}
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2">
                {needsAction && totalOutstanding > 0 && (
                    <span className="hidden rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-hover sm:inline-flex items-center gap-1">
                        Lihat Detail
                        <ArrowUpRight className="h-3 w-3" />
                    </span>
                )}
                <ChevronRight className="h-4 w-4 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
        </Link>
    );
}

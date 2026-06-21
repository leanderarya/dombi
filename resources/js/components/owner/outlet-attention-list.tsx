import { Link } from '@inertiajs/react';
import { CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { Severity } from '@/lib/severity';
import { settlementSeverity } from '@/lib/severity';

interface OutletAttention {
    outletId: number;
    outletName: string;
    outstanding: number;
    pendingRestocks: number;
    pendingReturns: number;
    pendingExchanges: number;
    criticalStocks: number;
    daysOverdue: number;
    href: string;
}

interface Props {
    outlets: OutletAttention[];
    emptyTitle?: string;
    emptyDescription?: string;
}

function severityBorder(severity: Severity): string {
    if (severity === 'critical') {
return 'border-l-red-400';
}

    if (severity === 'warning') {
return 'border-l-amber-400';
}

    return 'border-l-blue-400';
}

export default function OutletAttentionList({ outlets, emptyTitle = 'Tidak ada outlet yang memerlukan perhatian saat ini.', emptyDescription = 'Semua outlet dalam kondisi aman.' }: Props) {
    if (outlets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-400" />
                <div className="text-sm font-semibold text-slate-700">{emptyTitle}</div>
                <div className="mt-1 text-xs text-text-muted">{emptyDescription}</div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {outlets.map((row) => {
                const severity = settlementSeverity(row.daysOverdue);
                const totalIssues = row.pendingRestocks + row.pendingReturns + row.pendingExchanges + row.criticalStocks;

                return (
                    <Link
                        key={row.outletId}
                        href={row.href}
                        className={`block rounded-xl border border-l-4 border-border bg-surface-muted/70 p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40 ${severityBorder(severity)}`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-sm font-semibold text-text">{row.outletName}</div>
                                <div className="mt-1 text-xs text-text-muted">
                                    {totalIssues} issue belum diproses{row.criticalStocks > 0 ? ` · ${row.criticalStocks} SKU kritis` : ''}
                                </div>
                            </div>
                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                                {formatCurrency(row.outstanding)}
                            </span>
                        </div>

                        <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                            <div className="rounded-lg border border-border bg-surface px-3 py-2">
                                <div className="text-sm font-semibold tabular-nums text-red-600">{formatCurrency(row.outstanding)}</div>
                                <div className="mt-1 text-[11px] text-text-muted">Belum Masuk</div>
                            </div>
                            <div className="rounded-lg border border-border bg-surface px-3 py-2">
                                <div className="text-sm font-semibold tabular-nums text-text">{row.pendingRestocks}</div>
                                <div className="mt-1 text-[11px] text-text-muted">Restock</div>
                            </div>
                            <div className="rounded-lg border border-border bg-surface px-3 py-2">
                                <div className="text-sm font-semibold tabular-nums text-text">{row.pendingReturns + row.pendingExchanges}</div>
                                <div className="mt-1 text-[11px] text-text-muted">Return/Tukar</div>
                            </div>
                            <div className="rounded-lg border border-border bg-surface px-3 py-2">
                                <div className="text-sm font-semibold tabular-nums text-text">{row.criticalStocks}</div>
                                <div className="mt-1 text-[11px] text-text-muted">Stok Kritis</div>
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}

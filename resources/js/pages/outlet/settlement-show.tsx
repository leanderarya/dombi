import { Link } from '@inertiajs/react';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import SectionCard from '@/components/ui/section-card';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

const METHOD_LABELS: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    qris: 'QRIS',
    other: 'Lainnya',
};

function BigRow({
    label,
    value,
    tone = 'default',
}: {
    label: string;
    value: string;
    tone?: 'default' | 'emerald' | 'red' | 'muted';
}) {
    const toneCls =
        tone === 'emerald'
            ? 'text-emerald-700'
            : tone === 'red'
              ? 'text-red-600'
              : tone === 'muted'
                ? 'text-text-muted'
                : 'text-text';

    return (
        <div className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
            <div className="text-sm font-medium text-text">{label}</div>
            <div className={`text-sm font-bold tabular-nums ${toneCls}`}>
                {value}
            </div>
        </div>
    );
}

export default function SettlementShow({
    settlement,
    offlineSales,
    payments,
    outlet,
}: any) {
    const isOwnerPay = settlement.direction === 'owner_pays_outlet';
    const offlineTotal = offlineSales.reduce(
        (s: number, o: any) => s + o.total_amount,
        0,
    );

    return (
        <OutletLayout
            title="Detail Settlement"
            subtitle={outlet?.name}
            backHref="/outlet/settlement"
        >
            <OutletPageShell>
                {/* Hero */}
                <div className="rounded-xl border border-border bg-surface p-5">
                    <div className="text-[11px] font-medium text-text-muted uppercase">
                        {settlement.period_label}
                    </div>
                    <div className="mt-1 text-2xl font-bold text-text tabular-nums">
                        {formatCurrency(Math.abs(settlement.net_amount))}
                    </div>
                    <div
                        className={`mt-1 text-[11px] font-semibold ${
                            isOwnerPay ? 'text-emerald-600' : 'text-red-600'
                        }`}
                    >
                        {isOwnerPay
                            ? 'Owner bayar ke outlet'
                            : 'Outlet bayar ke owner'}
                    </div>
                    <div className="mt-2 text-[11px] text-text-subtle">
                        Status:{' '}
                        <span className="font-semibold text-text">
                            {settlement.status}
                        </span>{' '}
                        · Jatuh tempo {formatDate(settlement.due_date)}
                    </div>
                </div>

                {/* Kenapa net-nya segini */}
                <div className="mt-4">
                    <SectionCard label="Komposisi Pekan Ini">
                        <BigRow
                            label="Penjualan Online"
                            value={formatCurrency(settlement.online_share)}
                            tone="emerald"
                        />
                        <BigRow
                            label="Biaya Kurir"
                            value={`- ${formatCurrency(settlement.delivery_cost)}`}
                            tone="red"
                        />
                        <BigRow
                            label="Refund"
                            value={`- ${formatCurrency(settlement.refund)}`}
                            tone="red"
                        />
                        <BigRow
                            label="Penjualan Offline"
                            value={`- ${formatCurrency(settlement.offline_sales)}`}
                            tone="red"
                        />
                        {settlement.adjustments !== 0 && (
                            <BigRow
                                label="Penyesuaian"
                                value={formatCurrency(settlement.adjustments)}
                                tone={
                                    settlement.adjustments < 0
                                        ? 'red'
                                        : 'default'
                                }
                            />
                        )}
                        <BigRow
                            label="Net Settlement"
                            value={formatCurrency(
                                Math.abs(settlement.net_amount),
                            )}
                            tone={isOwnerPay ? 'emerald' : 'red'}
                        />
                    </SectionCard>
                </div>

                {/* Offline sales detail */}
                {offlineSales.length > 0 && (
                    <div className="mt-4">
                        <SectionCard
                            label={`Penjualan Offline (${offlineSales.length} jualan · ${formatCurrency(offlineTotal)})`}
                        >
                            {offlineSales.map((s: any) => (
                                <Link
                                    key={s.id}
                                    href={`/outlet/offline-sales/${s.id}`}
                                    className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0 active:opacity-80"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium text-text">
                                            {s.product_name}
                                        </div>
                                        <div className="text-[11px] text-text-subtle">
                                            {s.quantity} ×{' '}
                                            {formatDate(s.created_at)} ·{' '}
                                            {METHOD_LABELS[s.payment_method] ??
                                                s.payment_method}
                                        </div>
                                    </div>
                                    <div className="ml-3 shrink-0 text-sm font-semibold text-text tabular-nums">
                                        {formatCurrency(s.total_amount)}
                                    </div>
                                </Link>
                            ))}
                        </SectionCard>
                    </div>
                )}

                {/* Pembayaran */}
                {payments.length > 0 && (
                    <div className="mt-4">
                        <SectionCard label="Transaksi Pembayaran">
                            {payments.map((p: any) => {
                                const isPayout =
                                    p.direction === 'owner_pays_outlet';

                                return (
                                    <div
                                        key={p.id}
                                        className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0"
                                    >
                                        <div>
                                            <div
                                                className={`text-sm font-medium ${
                                                    isPayout
                                                        ? 'text-emerald-600'
                                                        : 'text-text'
                                                }`}
                                            >
                                                {isPayout
                                                    ? 'Diterima dari Owner'
                                                    : 'Disetor ke Owner'}
                                            </div>
                                            <div className="text-[11px] text-text-subtle">
                                                {p.reference} ·{' '}
                                                {formatDate(p.date)}
                                            </div>
                                        </div>
                                        <div className="text-sm font-semibold text-text tabular-nums">
                                            {formatCurrency(p.amount)}
                                        </div>
                                    </div>
                                );
                            })}
                        </SectionCard>
                    </div>
                )}

                {/* Sisa */}
                {settlement.outstanding > 0 && (
                    <div
                        className={`mt-4 rounded-xl border p-4 ${
                            isOwnerPay
                                ? 'border-emerald-200 bg-emerald-50'
                                : 'border-red-200 bg-red-50'
                        }`}
                    >
                        <div
                            className={`text-[11px] font-semibold uppercase ${
                                isOwnerPay ? 'text-emerald-700' : 'text-red-700'
                            }`}
                        >
                            {isOwnerPay
                                ? 'Owner perlu bayar ke kamu'
                                : 'Belum Disetor'}
                        </div>
                        <div
                            className={`mt-1 text-xl font-bold tabular-nums ${
                                isOwnerPay ? 'text-emerald-700' : 'text-red-700'
                            }`}
                        >
                            {formatCurrency(settlement.outstanding)}
                        </div>
                    </div>
                )}
            </OutletPageShell>
        </OutletLayout>
    );
}

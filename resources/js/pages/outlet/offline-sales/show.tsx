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

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-2 py-2">
            <span className="text-xs text-text-muted">{label}</span>
            <span className="text-sm font-medium text-text">{value}</span>
        </div>
    );
}

export default function OfflineSaleShow({ sale, outlet, week }: any) {
    return (
        <OutletLayout
            title="Detail Penjualan Offline"
            subtitle={outlet?.name}
            backHref="/outlet/offline-sales"
        >
            <OutletPageShell>
                {/* Hero: total sale */}
                <div className="rounded-xl border border-border bg-surface p-5">
                    <div className="text-[11px] font-medium text-text-muted uppercase">
                        Total Penjualan Offline
                    </div>
                    <div className="mt-1 text-2xl font-bold text-text tabular-nums">
                        {formatCurrency(sale.total_amount)}
                    </div>
                    <div className="mt-1 text-xs text-text-subtle">
                        Produk dijual tunai — jumlah yang disetor ke pusat
                    </div>
                </div>

                {/* Konteks pekan: Online vs Offline + profit */}
                <div className="mt-4">
                    <SectionCard label="Ringkasan Pekan">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2">
                                <span className="text-xs text-text-muted">
                                    Penjualan Online (profit outlet)
                                </span>
                                <span className="text-sm font-semibold text-emerald-600 tabular-nums">
                                    {formatCurrency(week.online_share)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2">
                                <span className="text-xs text-text-muted">
                                    Penjualan Offline (setor ke pusat)
                                </span>
                                <span className="text-sm font-semibold text-text tabular-nums">
                                    {formatCurrency(week.offline_total)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2">
                                <span className="text-xs text-text-muted">
                                    Selisih ke pusat
                                </span>
                                <span
                                    className={`text-sm font-bold tabular-nums ${
                                        week.direction === 'owner_pays_outlet'
                                            ? 'text-emerald-600'
                                            : 'text-red-600'
                                    }`}
                                >
                                    {formatCurrency(Math.abs(week.net_amount))}
                                    <span className="ml-1 text-[10px] font-medium text-text-subtle">
                                        {week.direction === 'owner_pays_outlet'
                                            ? 'Owner bayar'
                                            : 'Outlet bayar'}
                                    </span>
                                </span>
                            </div>
                        </div>
                        {week.start && (
                            <div className="mt-2 text-[11px] text-text-subtle">
                                Pekan {formatDate(week.start)} –{' '}
                                {formatDate(week.end)}
                            </div>
                        )}
                    </SectionCard>
                </div>

                {/* Detail sale */}
                <div className="mt-4">
                    <SectionCard label="Detail Penjualan">
                        <Row label="Produk" value={sale.product_name} />
                        <Row
                            label="Jumlah"
                            value={`${sale.quantity} x ${formatCurrency(sale.center_price)}`}
                        />
                        <Row
                            label="Metode Bayar"
                            value={
                                METHOD_LABELS[sale.payment_method] ??
                                sale.payment_method
                            }
                        />
                        <Row
                            label="Tanggal"
                            value={formatDate(sale.created_at)}
                        />
                        {sale.created_by && (
                            <Row label="Dicatat oleh" value={sale.created_by} />
                        )}
                    </SectionCard>
                </div>

                {sale.notes && (
                    <div className="mt-4">
                        <SectionCard label="Catatan">
                            <p className="text-sm text-text-muted">
                                {sale.notes}
                            </p>
                        </SectionCard>
                    </div>
                )}
            </OutletPageShell>
        </OutletLayout>
    );
}

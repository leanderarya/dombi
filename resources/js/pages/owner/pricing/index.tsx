import { Head, Link } from '@inertiajs/react';
import { DollarSign, Package, Store, TrendingUp } from 'lucide-react';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { formatCurrency } from '@/lib/format';

interface OutletData {
    id: number;
    name: string;
    variant_prices_count: number;
}

interface Kpis {
    total_variants: number;
    total_outlets: number;
    total_overrides: number;
    lowest_margin: number;
}

interface Props {
    outlets: OutletData[];
    kpis: Kpis;
}

export default function PricingIndex({ outlets, kpis }: Props) {
    return (
        <OwnerPageShell title="Harga Produk" subtitle="Kelola harga jual per outlet">
            {/* KPI Strip */}
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <OwnerKpiCard
                    label="Total Produk"
                    value={kpis.total_variants}
                    icon={<Package className="h-5 w-5" />}
                />
                <OwnerKpiCard
                    label="Total Outlet"
                    value={kpis.total_outlets}
                    icon={<Store className="h-5 w-5" />}
                />
                <OwnerKpiCard
                    label="Harga Bervariasi"
                    value={kpis.total_overrides}
                    icon={<DollarSign className="h-5 w-5" />}
                />
                <OwnerKpiCard
                    label="Margin Terendah"
                    value={formatCurrency(kpis.lowest_margin)}
                    icon={<TrendingUp className="h-5 w-5" />}
                />
            </section>

            {/* Outlet Card Grid */}
            <section className="mt-6">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Pilih Outlet</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {outlets.map((outlet) => (
                        <Link
                            key={outlet.id}
                            href={`/owner/pricing/outlets/${outlet.id}`}
                            className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 transition-colors hover:border-primary/20 hover:bg-primary-light/30 active:opacity-80"
                        >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light">
                                <Store className="h-6 w-6 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-text">{outlet.name}</div>
                                <div className="mt-0.5 text-xs text-text-muted">{outlet.variant_prices_count} Produk</div>
                            </div>
                            <svg className="h-4 w-4 shrink-0 text-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    ))}
                </div>
                {outlets.length === 0 && (
                    <div className="mt-4 rounded-xl border border-border bg-white p-8 text-center">
                        <Store className="mx-auto h-10 w-10 text-text-subtle" />
                        <p className="mt-2 text-sm font-semibold text-text">Belum ada outlet aktif</p>
                        <p className="mt-1 text-xs text-text-muted">Tambahkan outlet terlebih dahulu untuk mengelola harga.</p>
                    </div>
                )}
            </section>
        </OwnerPageShell>
    );
}

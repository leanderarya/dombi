import { Link } from '@inertiajs/react';
import { DollarSign, Store } from 'lucide-react';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import StatusBadge from '@/components/ui/status-badge';
import { EmptyState } from './pricing-shared';
import OutletDetail from './outlet-detail';
import type { OtherOutlet, OutletData, OutletPriceRow } from './types';

/* ------------------------------------------------------------------ */
/*  OutletTab — router between grid and detail                         */
/* ------------------------------------------------------------------ */

export function OutletTab({ outlets, selectedOutlet, outletPrices, otherOutlets }: {
    outlets?: OutletData[];
    selectedOutlet?: { id: number; name: string };
    outletPrices?: OutletPriceRow[];
    otherOutlets?: OtherOutlet[];
}) {
    if (!selectedOutlet) {
        return <OutletGrid outlets={outlets} />;
    }

    return (
        <OutletDetail
            outlet={selectedOutlet}
            prices={outletPrices}
            otherOutlets={otherOutlets}
            allOutlets={outlets}
        />
    );
}

/* ------------------------------------------------------------------ */
/*  OutletGrid                                                         */
/* ------------------------------------------------------------------ */

function OutletGrid({ outlets }: { outlets?: OutletData[] }) {
    if (!outlets || outlets.length === 0) {
        return (
            <EmptyState icon={<Store className="h-10 w-10" />} message="Belum ada outlet aktif." />
        );
    }

    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {outlets.map((o) => (
                    <Link
                        key={o.id}
                        href={`/owner/pricing?tab=outlet&outlet_id=${o.id}`}
                        className="flex items-center gap-4 rounded-lg border border-border bg-white p-4 transition-all duration-200 hover:border-primary/20 active:opacity-80"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                            <Store className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-text">{o.name}</div>
                            <div className="mt-0.5 text-xs text-text-muted">
                                {o.override_count > 0
                                    ? `${o.override_count} dari ${o.total_variants} produk custom`
                                    : 'Semua standar'}
                            </div>
                        </div>
                        {o.all_standard ? (
                            <StatusBadge variant="success" size="sm">Standar</StatusBadge>
                        ) : (
                            <StatusBadge variant="info" size="sm">Custom</StatusBadge>
                        )}
                    </Link>
                ))}
            </div>

            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    <OwnerKpiCard label="Total Outlet" value={outlets.length} icon={<Store className="h-5 w-5" />} />
                    <OwnerKpiCard
                        label="Outlet dengan Override"
                        value={outlets.filter((o) => !o.all_standard).length}
                        icon={<DollarSign className="h-5 w-5" />}
                    />
                </div>
            </aside>
        </div>
    );
}

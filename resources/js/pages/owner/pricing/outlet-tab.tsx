import { Link } from '@inertiajs/react';
import { DollarSign, Store } from 'lucide-react';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import OutletDetail from './outlet-detail';
import type { OtherOutlet, OutletData, OutletPriceRow } from './types';

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

function OutletGrid({ outlets }: { outlets?: OutletData[] }) {
    if (!outlets || outlets.length === 0) {
        return (
            <EmptyState icon={<Store className="h-10 w-10" aria-hidden="true" />} title="Belum ada outlet aktif." />
        );
    }

    const kpiItems = [
        { label: 'Total Outlet', value: outlets.length, icon: <Store className="h-5 w-5" aria-hidden="true" /> },
        {
            label: 'Outlet dengan Override',
            value: outlets.filter((o) => !o.all_standard).length,
            icon: <DollarSign className="h-5 w-5" aria-hidden="true" />,
        },
    ];

    return (
            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6" aria-label="Daftar outlet">
            <div>
                <OwnerKpiStrip items={kpiItems} cols={2} />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {outlets.map((o) => (
                        <Link
                            key={o.id}
                            href={`/owner/pricing?tab=outlet&outlet_id=${o.id}`}
                            className="flex items-center gap-4 rounded-lg border border-border bg-white p-4 transition-all duration-200 hover:border-primary/20 active:opacity-80"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                                <Store className="h-5 w-5 text-primary" aria-hidden="true" />
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
            </div>

            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    {kpiItems.map((item, i) => (
                        <div key={i} className="rounded-lg p-2.5">
                            <div className="flex items-center gap-2">
                                {item.icon && (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-muted">
                                        {item.icon}
                                    </div>
                                )}
                                <div className="text-xs font-medium text-text-muted">{item.label}</div>
                            </div>
                            <div className="mt-1 text-base font-bold tabular-nums text-text">{item.value}</div>
                        </div>
                    ))}
                </div>
            </aside>
        </div>
    );
}

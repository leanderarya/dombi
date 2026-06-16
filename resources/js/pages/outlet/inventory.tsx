import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, CheckCircle, Package } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';

export default function OutletInventory({ outlet, inventories }: any) {
    // Group by family
    const familyGroups = new Map<number, { family: any; items: any[] }>();
    const noFamilyItems: any[] = [];

    for (const item of inventories) {
        const familyId = item.variant?.family_id ?? item.variant?.family?.id;

        if (familyId) {
            if (!familyGroups.has(familyId)) {
                familyGroups.set(familyId, {
                    family: item.variant?.family,
                    items: [],
                });
            }

            familyGroups.get(familyId)!.items.push(item);
        } else {
            noFamilyItems.push(item);
        }
    }

    // Categorize families by worst health status
    const familyHealth = new Map<number, 'danger' | 'warning' | 'success'>();

    for (const [familyId, group] of familyGroups) {
        let worst: 'danger' | 'warning' | 'success' = 'success';

        for (const item of group.items) {
            const available = item.current_stock - item.reserved_stock;

            if (available <= 0) {
 worst = 'danger'; break; 
}

            if (available <= item.minimum_stock) {
 worst = 'warning'; 
}
        }

        familyHealth.set(familyId, worst);
    }

    const criticalFamilies = [...familyGroups.entries()].filter(([id]) => familyHealth.get(id) === 'danger');
    const lowStockFamilies = [...familyGroups.entries()].filter(([id]) => familyHealth.get(id) === 'warning');
    const healthyFamilies = [...familyGroups.entries()].filter(([id]) => familyHealth.get(id) === 'success');

    return (
        <OutletLayout title="Inventaris" subtitle={outlet.name}>
            <Head title="Inventaris" />

            {/* Summary */}
            <div className="mb-4 grid grid-cols-3 gap-2">
                <SummaryCard label="Kritis" value={criticalFamilies.length} variant="danger" />
                <SummaryCard label="Rendah" value={lowStockFamilies.length} variant="warning" />
                <SummaryCard label="Sehat" value={healthyFamilies.length} variant="success" />
            </div>

            {/* Restock CTA */}
            <Link href="/outlet/restocks/create" className="mb-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-semibold text-white active:bg-emerald-800">
                <Package className="h-4 w-4" />
                Request Restock
            </Link>

            {/* Critical */}
            {criticalFamilies.length > 0 && (
                <SectionCard label="Stok Kritis" className="mb-4">
                    <div className="mt-2 space-y-4">
                        {criticalFamilies.map(([familyId, group]) => (
                            <FamilyGroup key={familyId} group={group} variant="danger" />
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Low Stock */}
            {lowStockFamilies.length > 0 && (
                <SectionCard label="Stok Rendah" className="mb-4">
                    <div className="mt-2 space-y-4">
                        {lowStockFamilies.map(([familyId, group]) => (
                            <FamilyGroup key={familyId} group={group} variant="warning" />
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Healthy */}
            {healthyFamilies.length > 0 && (
                <SectionCard label="Stok Sehat" className="mb-4">
                    <div className="mt-2 space-y-4">
                        {healthyFamilies.map(([familyId, group]) => (
                            <FamilyGroup key={familyId} group={group} variant="success" />
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* No-family items */}
            {noFamilyItems.length > 0 && (
                <SectionCard label="Lainnya" className="mb-4">
                    <div className="mt-2 space-y-2">
                        {noFamilyItems.map((item: any) => (
                            <InventoryRow key={item.id} item={item} variant={getVariant(item)} />
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Empty State */}
            {inventories.length === 0 && (
                <EmptyState
                    icon="&#128230;"
                    title="Belum ada inventaris"
                    description="Inventaris akan muncul setelah produk ditambahkan ke outlet."
                    action={{ label: 'Request Restock', href: '/outlet/restocks/create' }}
                />
            )}
        </OutletLayout>
    );
}

function FamilyGroup({ group, variant }: { group: { family: any; items: any[] }; variant: 'danger' | 'warning' | 'success' }) {
    return (
        <div className="rounded-lg border border-zinc-100 bg-white">
            <div className="border-b border-zinc-50 bg-zinc-50/50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-600">{group.family?.name ?? 'Produk'}</span>
            </div>
            <div className="divide-y divide-zinc-50">
                {group.items.map((item: any) => (
                    <InventoryRow key={item.id} item={item} variant={variant} />
                ))}
            </div>
        </div>
    );
}

function getVariant(item: any): 'danger' | 'warning' | 'success' {
    const available = item.current_stock - item.reserved_stock;

    if (available <= 0) {
return 'danger';
}

    if (available <= item.minimum_stock) {
return 'warning';
}

    return 'success';
}

function SummaryCard({ label, value, variant }: { label: string; value: number; variant: 'danger' | 'warning' | 'success' }) {
    const iconMap = {
        danger: <AlertTriangle className="h-4 w-4 text-red-500" />,
        warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        success: <CheckCircle className="h-4 w-4 text-emerald-500" />,
    };

    return (
        <div className="rounded-lg border border-zinc-200 bg-white p-2.5 text-center">
            <div className="flex items-center justify-center gap-1">
                {iconMap[variant]}
                <span className="text-lg font-bold text-slate-900">{value}</span>
            </div>
            <div className="text-[10px] font-semibold uppercase text-slate-500">{label}</div>
        </div>
    );
}

function InventoryRow({ item, variant }: { item: any; variant: 'danger' | 'warning' | 'success' }) {
    const available = item.current_stock - item.reserved_stock;
    const displayName = item.variant?.name ?? item.product?.name ?? '-';

    return (
        <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white p-3">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{displayName}</span>
                    <StatusBadge variant={variant} size="sm">
                        {variant === 'danger' ? 'Kritis' : variant === 'warning' ? 'Rendah' : 'Sehat'}
                    </StatusBadge>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                    Tersedia: {available} · Min: {item.minimum_stock}
                </div>
            </div>
        </div>
    );
}

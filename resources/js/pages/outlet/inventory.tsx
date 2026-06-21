import { Head, Link, useForm } from '@inertiajs/react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, ClipboardCheck, Package, Plus } from 'lucide-react';
import { useState } from 'react';
import BottomSheet from '@/components/ui/bottom-sheet';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';

export default function OutletInventory({ outlet, inventories }: any) {
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

    const familyHealth = new Map<number, 'danger' | 'warning' | 'success'>();

    for (const [familyId, group] of familyGroups) {
        let worst: 'danger' | 'warning' | 'success' = 'success';

        for (const item of group.items) {
            const available = item.current_stock - item.reserved_stock;

            if (available <= 0) {
                worst = 'danger';
                break;
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

    const [showHealthy, setShowHealthy] = useState(false);

    return (
        <OutletLayout title="Inventaris" subtitle={outlet.name}>
            <Head title="Inventaris" />

            {/* Summary Bar + Restock CTA */}
            <div className="mb-6 flex items-center gap-3">
                <div className="flex flex-1 items-center divide-x divide-border rounded-xl border border-border bg-white">
                    <SummaryCell label="Kritis" value={criticalFamilies.length} variant="danger" />
                    <SummaryCell label="Rendah" value={lowStockFamilies.length} variant="warning" />
                    <SummaryCell label="Sehat" value={healthyFamilies.length} variant="success" />
                </div>
                <Link
                    href="/outlet/restocks/create"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-all active:bg-primary-hover active:scale-[0.95]"
                    title="Request Restock"
                >
                    <Plus className="h-5 w-5" />
                </Link>
            </div>

            {/* Critical — visually dominant */}
            {criticalFamilies.length > 0 && (
                <div className="mb-6">
                    <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-red-100">
                            <AlertTriangle className="h-3 w-3 text-red-600" />
                        </div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-red-700">Stok Kritis</h2>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">{criticalFamilies.length}</span>
                    </div>
                    <div className="space-y-2">
                        {criticalFamilies.map(([familyId, group]) => (
                            <FamilyGroup key={familyId} group={group} variant="danger" />
                        ))}
                    </div>
                </div>
            )}

            {/* Low Stock — secondary priority */}
            {lowStockFamilies.length > 0 && (
                <div className="mb-6">
                    <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-amber-100">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                        </div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700">Stok Rendah</h2>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">{lowStockFamilies.length}</span>
                    </div>
                    <div className="space-y-2">
                        {lowStockFamilies.map(([familyId, group]) => (
                            <FamilyGroup key={familyId} group={group} variant="warning" />
                        ))}
                    </div>
                </div>
            )}

            {/* Healthy — collapsed by default, de-emphasized */}
            {healthyFamilies.length > 0 && (
                <div className="mb-6">
                    <button
                        type="button"
                        onClick={() => setShowHealthy(!showHealthy)}
                        className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-border bg-white px-4 text-left transition-colors active:bg-surface-muted"
                    >
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm font-medium text-text">Stok Sehat</span>
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">{healthyFamilies.length}</span>
                        </div>
                        {showHealthy ? <ChevronUp className="h-4 w-4 text-text-subtle" /> : <ChevronDown className="h-4 w-4 text-text-subtle" />}
                    </button>
                    {showHealthy && (
                        <div className="mt-2 space-y-2">
                            {healthyFamilies.map(([familyId, group]) => (
                                <FamilyGroup key={familyId} group={group} variant="success" />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* No-family items */}
            {noFamilyItems.length > 0 && (
                <div className="mb-6">
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-subtle">Lainnya</h2>
                    <div className="space-y-2">
                        {noFamilyItems.map((item: any) => (
                            <InventoryRow key={item.id} item={item} variant={getVariant(item)} />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {inventories.length === 0 && (
                <div className="mt-8">
                    <EmptyState
                        icon={<Package className="h-8 w-8 text-text-subtle" />}
                        title="Belum ada inventaris"
                        description="Inventaris akan muncul setelah produk ditambahkan ke outlet."
                        action={{ label: 'Request Restock', href: '/outlet/restocks/create' }}
                    />
                </div>
            )}
        </OutletLayout>
    );
}

function FamilyGroup({ group, variant }: { group: { family: any; items: any[] }; variant: 'danger' | 'warning' | 'success' }) {
    const borderAccent = variant === 'danger' ? 'border-l-red-400' : variant === 'warning' ? 'border-l-amber-400' : 'border-l-emerald-400';

    return (
        <div className={`overflow-hidden rounded-xl border border-border border-l-4 ${borderAccent} bg-white`}>
            <div className="border-b border-border bg-surface-muted px-4 py-2">
                <span className="text-xs font-semibold text-text-muted">{group.family?.name ?? 'Produk'}</span>
            </div>
            <div className="divide-y divide-border">
                {group.items.map((item: any) => (
                    <InventoryRow key={item.id} item={item} variant={variant} compact />
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

function SummaryCell({ label, value, variant }: { label: string; value: number; variant: 'danger' | 'warning' | 'success' }) {
    const colorMap = {
        danger: 'text-red-600',
        warning: 'text-amber-600',
        success: 'text-emerald-600',
    };

    return (
        <div className="flex-1 px-4 py-3 text-center">
            <div className={`text-lg font-bold tabular-nums ${colorMap[variant]}`}>{value}</div>
            <div className="text-[10px] font-medium text-text-subtle">{label}</div>
        </div>
    );
}

function InventoryRow({ item, variant, compact }: { item: any; variant: 'danger' | 'warning' | 'success'; compact?: boolean }) {
    const [showOpname, setShowOpname] = useState(false);
    const available = item.current_stock - item.reserved_stock;
    const displayName = item.variant?.name ?? item.product?.name ?? '-';

    return (
        <>
            <div className={`group flex items-center justify-between ${compact ? 'px-4 py-2.5' : 'rounded-xl border border-border bg-white p-3'} transition-all duration-200 hover:bg-surface-muted`}>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text truncate">{displayName}</span>
                        <StatusBadge variant={variant} size="sm">
                            {variant === 'danger' ? 'Kritis' : variant === 'warning' ? 'Rendah' : 'Sehat'}
                        </StatusBadge>
                    </div>
                    <div className="mt-0.5 text-[11px] text-text-subtle">
                        Tersedia: {available} · Min: {item.minimum_stock}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setShowOpname(true)}
                    className="ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors active:bg-surface-muted active:text-primary"
                    title="Stock Opname"
                >
                    <ClipboardCheck className="h-4 w-4" />
                </button>
            </div>

            <OpnameSheet
                open={showOpname}
                onClose={() => setShowOpname(false)}
                item={item}
                displayName={displayName}
            />
        </>
    );
}

function OpnameSheet({ open, onClose, item, displayName }: { open: boolean; onClose: () => void; item: any; displayName: string }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        product_variant_id: item.product_variant_id ?? item.variant_id ?? '',
        actual_count: '',
        notes: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/outlet/inventory/opname', {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    return (
        <BottomSheet open={open} onClose={onClose} title="Stock Opname">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <span className="text-[11px] font-medium text-text-subtle">Produk</span>
                    <p className="text-sm font-semibold text-text">{displayName}</p>
                    <p className="text-[11px] text-text-subtle">Stok sistem: {item.current_stock}</p>
                </div>

                <div>
                    <label className="mb-1 block text-[11px] font-medium text-text-subtle">Jumlah Aktual</label>
                    <input
                        type="number"
                        min="0"
                        value={data.actual_count}
                        onChange={(e) => setData('actual_count', e.target.value)}
                        className="w-full rounded-xl border border-border px-4 py-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                        placeholder="Masukkan jumlah hasil hitung"
                        autoFocus
                    />
                    {errors.actual_count && <p className="mt-1 text-xs text-red-500">{errors.actual_count}</p>}
                </div>

                <div>
                    <label className="mb-1 block text-[11px] font-medium text-text-subtle">Catatan (opsional)</label>
                    <textarea
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-border px-4 py-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                        placeholder="Alasan penyesuaian stok"
                    />
                    {errors.notes && <p className="mt-1 text-xs text-red-500">{errors.notes}</p>}
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white active:bg-primary-hover disabled:opacity-50"
                >
                    {processing ? 'Menyimpan...' : 'Simpan Opname'}
                </button>
            </form>
        </BottomSheet>
    );
}

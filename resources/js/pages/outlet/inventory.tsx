import { Head, useForm } from '@inertiajs/react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, ClipboardCheck, Package, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import RestockCreateDialog from '@/components/outlet/restock-create-dialog';
import BottomSheet from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import Dialog from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';

export default function OutletInventory({ outlet, inventories, families }: any) {
    const [showRestock, setShowRestock] = useState(false);
    const [search, setSearch] = useState('');
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

    // Filter by search
    const matchesSearch = (item: any): boolean => {
        if (!search) {
return true;
}

        const q = search.toLowerCase();
        const name = (item.variant?.name ?? item.product?.name ?? '').toLowerCase();
        const family = (item.variant?.family?.name ?? '').toLowerCase();

        return name.includes(q) || family.includes(q);
    };

    const filterGroup = (group: { family: any; items: any[] }): { family: any; items: any[] } => ({
        ...group,
        items: group.items.filter(matchesSearch),
    });

    const filteredCriticalFamilies = [...familyGroups.entries()]
        .filter(([id]) => familyHealth.get(id) === 'danger')
        .map(([id, group]) => [id, filterGroup(group)] as const)
        .filter(([, group]) => group.items.length > 0);

    const filteredLowStockFamilies = [...familyGroups.entries()]
        .filter(([id]) => familyHealth.get(id) === 'warning')
        .map(([id, group]) => [id, filterGroup(group)] as const)
        .filter(([, group]) => group.items.length > 0);

    const filteredHealthyFamilies = [...familyGroups.entries()]
        .filter(([id]) => familyHealth.get(id) === 'success')
        .map(([id, group]) => [id, filterGroup(group)] as const)
        .filter(([, group]) => group.items.length > 0);

    const filteredNoFamilyItems = noFamilyItems.filter(matchesSearch);
    const hasSearchResults = filteredCriticalFamilies.length + filteredLowStockFamilies.length + filteredHealthyFamilies.length + filteredNoFamilyItems.length > 0;

    const criticalFamilies = [...familyGroups.entries()].filter(([id]) => familyHealth.get(id) === 'danger');
    const lowStockFamilies = [...familyGroups.entries()].filter(([id]) => familyHealth.get(id) === 'warning');
    const healthyFamilies = [...familyGroups.entries()].filter(([id]) => familyHealth.get(id) === 'success');

    const [showHealthy, setShowHealthy] = useState(false);

    return (
        <OutletLayout title="Inventaris" subtitle={outlet.name}>
            <Head title="Inventaris" />
            <OutletPageShell>
            {/* Summary Bar + Restock CTA */}
            <div className="flex items-center gap-3">
                <div className="flex flex-1 items-center divide-x divide-border rounded-xl border border-border bg-white">
                    <SummaryCell label="Kritis" value={criticalFamilies.length} dot="bg-red-400" />
                    <SummaryCell label="Rendah" value={lowStockFamilies.length} dot="bg-amber-400" />
                    <SummaryCell label="Sehat" value={healthyFamilies.length} dot="bg-emerald-400" />
                </div>
                <Button
                    size="lg"
                    onClick={() => setShowRestock(true)}
                    icon={Plus}
                    title="Request Restock"
                    className="h-12 w-12 shrink-0 !px-0"
                />
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari produk..."
                    className="w-full rounded-xl border border-border py-2.5 pl-9 pr-4 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
            </div>

            {/* Critical */}
            {filteredCriticalFamilies.length > 0 && (
                <div>
                    <div className="mb-3 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-subtle">Stok Kritis</h2>
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-text-muted">{filteredCriticalFamilies.length}</span>
                    </div>
                    <div className="space-y-2">
                        {filteredCriticalFamilies.map(([familyId, group]) => (
                            <FamilyGroup key={familyId} group={group} />
                        ))}
                    </div>
                </div>
            )}

            {/* Low Stock */}
            {filteredLowStockFamilies.length > 0 && (
                <div>
                    <div className="mb-3 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-subtle">Stok Rendah</h2>
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-text-muted">{filteredLowStockFamilies.length}</span>
                    </div>
                    <div className="space-y-2">
                        {filteredLowStockFamilies.map(([familyId, group]) => (
                            <FamilyGroup key={familyId} group={group} />
                        ))}
                    </div>
                </div>
            )}

            {/* Healthy — collapsed */}
            {filteredHealthyFamilies.length > 0 && (
                <div>
                    <button
                        type="button"
                        onClick={() => setShowHealthy(!showHealthy)}
                        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-white px-4 text-left transition-colors active:bg-surface-muted"
                    >
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-text-muted" />
                            <span className="text-sm font-medium text-text">Stok Sehat</span>
                            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-text-muted">{filteredHealthyFamilies.length}</span>
                        </div>
                        {showHealthy ? <ChevronUp className="h-4 w-4 text-text-subtle" /> : <ChevronDown className="h-4 w-4 text-text-subtle" />}
                    </button>
                    {showHealthy && (
                        <div className="mt-2 space-y-2">
                            {filteredHealthyFamilies.map(([familyId, group]) => (
                                <FamilyGroup key={familyId} group={group} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* No-family items */}
            {filteredNoFamilyItems.length > 0 && (
                <div>
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-subtle">Lainnya</h2>
                    <div className="space-y-2">
                        {filteredNoFamilyItems.map((item: any) => (
                            <InventoryRow key={item.id} item={item} />
                        ))}
                    </div>
                </div>
            )}

            {/* No results */}
            {search && !hasSearchResults && (
                <EmptyState
                    icon={<Search className="h-8 w-8 text-text-subtle" />}
                    title="Tidak ditemukan"
                    description={`Tidak ada produk yang cocok dengan "${search}".`}
                />
            )}

            {/* Empty State */}
            {!search && inventories.length === 0 && (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-text-subtle" />}
                    title="Belum ada inventaris"
                    description="Inventaris akan muncul setelah produk ditambahkan ke outlet."
                    action={{ label: 'Request Restock', onClick: () => setShowRestock(true) }}
                />
            )}
            </OutletPageShell>

            {/* Restock Dialog */}
            <RestockCreateDialog
                open={showRestock}
                onClose={() => setShowRestock(false)}
                families={families}
                inventories={inventories}
            />
        </OutletLayout>
    );
}

function FamilyGroup({ group }: { group: { family: any; items: any[] } }) {
    return (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="border-b border-border bg-surface-muted px-4 py-2">
                <span className="text-xs font-semibold text-text-muted">{group.family?.name ?? 'Produk'}</span>
            </div>
            <div className="divide-y divide-border">
                {group.items.map((item: any) => (
                    <InventoryRow key={item.id} item={item} compact />
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

function SummaryCell({ label, value, dot }: { label: string; value: number; dot: string }) {
    return (
        <div className="flex-1 px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                <div className="text-lg font-bold tabular-nums text-text">{value}</div>
            </div>
            <div className="text-[11px] font-medium text-text-subtle">{label}</div>
        </div>
    );
}

function InventoryRow({ item, compact }: { item: any; compact?: boolean }) {
    const [showOpname, setShowOpname] = useState(false);
    const available = item.current_stock - item.reserved_stock;
    const displayName = item.variant?.name ?? item.product?.name ?? '-';
    const variant = getVariant(item);

    return (
        <>
            <div className={`group flex items-center justify-between ${compact ? 'px-4 py-2.5' : 'rounded-xl border border-border bg-white p-3'} transition-all hover:bg-surface-muted`}>
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
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!data.actual_count) {
return;
}

        setShowConfirm(true);
    };

    const confirmSubmit = () => {
        post('/outlet/inventory/opname', {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setShowConfirm(false);
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
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white active:bg-primary-hover disabled:opacity-50"
                >
                    {processing ? 'Menyimpan...' : 'Simpan Opname'}
                </button>
            </form>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirm} onClose={() => setShowConfirm(false)} title="Konfirmasi Opname">
                <p className="text-sm text-text-muted">
                    Simpan stok aktual <span className="font-semibold text-text">{data.actual_count}</span> untuk <span className="font-semibold text-text">{displayName}</span>?
                </p>
                {data.notes && <p className="mt-1 text-xs text-text-subtle">Catatan: {data.notes}</p>}
                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setShowConfirm(false)}
                        className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-text active:opacity-80"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={confirmSubmit}
                        disabled={processing}
                        className="flex h-12 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                    >
                        {processing ? 'Menyimpan...' : 'Ya, Simpan'}
                    </button>
                </div>
            </Dialog>
        </BottomSheet>
    );
}

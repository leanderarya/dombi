import { router, useForm } from '@inertiajs/react';
import RestockCreateModal from '@/components/owner/restock-create-modal';
import { CheckCircle2, Plus, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import SortableTh from '@/components/owner/sortable-th';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import Pagination from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import StockLevelBadge from '@/components/ui/stock-level-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '@/lib/format';
import { calculateStockStatus } from '@/lib/stock';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'requested', label: 'Butuh Tindakan' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'completed', label: 'Selesai' },
];

const colorMap: Record<string, string> = {
    '': 'text-text bg-surface-muted ring-border',
    requested: 'text-amber-600 bg-amber-50 ring-amber-200',
    preparing: 'text-purple-600 bg-purple-50 ring-purple-200',
    shipped: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
    completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
};

type SortKey = 'id' | 'outlet' | 'items' | 'date';

export default function OwnerRestocksIndex({ restocks, filters, outlets }: any) {
    const [sortKey, setSortKey] = useState<SortKey>('id');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [approveModal, setApproveModal] = useState<any>(null);
    const [rejectModal, setRejectModal] = useState<any>(null);
    const [createModal, setCreateModal] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); } else { setSortKey(key); setSortDir('asc'); }
    };

    if (!restocks || !filters) {
        return <OwnerPageShell title="Restocks" subtitle="Kelola permintaan restock dari outlet"><SkeletonPage /></OwnerPageShell>;
    }

    const currentStatus = filters.status ?? '';

    const setFilter = (key: string, value: string) => {
        router.get('/owner/restocks', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    const sorted = useMemo(() => [...restocks.data].sort((a: any, b: any) => {
        let av: any, bv: any;

        switch (sortKey) {
            case 'id': av = a.id; bv = b.id; break;
            case 'outlet': av = a.outlet?.name ?? ''; bv = b.outlet?.name ?? ''; break;
            case 'items': av = a.items?.length ?? 0; bv = b.items?.length ?? 0; break;
            case 'date': av = a.created_at ?? ''; bv = b.created_at ?? ''; break;
            default: av = a.id; bv = b.id;
        }

        const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
        return sortDir === 'asc' ? cmp : -cmp;
    }), [restocks.data, sortKey, sortDir]);

    const handleOpenApprove = (restock: any) => {
        setApproveModal(restock);
    };

    const requestedCount = restocks.data.filter((r: any) => r.status === 'requested').length;
    const preparingCount = restocks.data.filter((r: any) => r.status === 'preparing').length;
    const shippedCount = restocks.data.filter((r: any) => r.status === 'shipped').length;
    const completedCount = restocks.data.filter((r: any) => r.status === 'completed').length;

    return (
        <OwnerPageShell
            title="Restocks"
            subtitle="Kelola permintaan restock dari outlet"
            headerRight={
                <Button onClick={() => setCreateModal(true)}><Plus className="mr-1.5 h-4 w-4" />Buat Restock</Button>
            }
        >
            <OwnerKpiStrip items={[
                { label: 'Menunggu', value: requestedCount, sublabel: requestedCount > 0 ? 'Perlu ditinjau' : undefined, sublabelColor: 'text-amber-600' },
                { label: 'Disiapkan', value: preparingCount },
                { label: 'Dikirim', value: shippedCount },
                { label: 'Selesai', value: completedCount },
            ]} />

            <section className="mb-4 flex flex-wrap items-center gap-2" aria-label="Filter Status">
                {statusFilters.map((sf) => {
                    const isActive = currentStatus === sf.key;

                    return (
                        <button key={sf.key} type="button" onClick={() => setFilter('status', sf.key)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${isActive ? colorMap[sf.key] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'}`}>
                            {sf.label}
                        </button>
                    );
                })}
            </section>

            <OwnerFilterCard
                collapsible defaultExpanded={false}
                searchPlaceholder="Cari kode..."
                searchValue={filters.search ?? ''}
                onSearch={(val) => setFilter('search', val)}
                outletOptions={outlets?.map((o: any) => ({ value: String(o.id), label: o.name }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) => setFilter('outlet_id', val)}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => setFilter('date', val)}
            />

            {restocks.data.length === 0 ? (
                <EmptyState title="Tidak ada restock" description="Permintaan restock akan muncul di sini setelah diajukan outlet" />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                    <table className="w-full min-w-[600px]" aria-label="Daftar Restock">
                        <thead>
                            <tr className="bg-surface-muted">
                                <SortableTh label="Kode" active={sortKey === 'id'} dir={sortDir} onClick={() => toggleSort('id')} />
                                <SortableTh label="Outlet" active={sortKey === 'outlet'} dir={sortDir} onClick={() => toggleSort('outlet')} />
                                <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Status</th>
                                <SortableTh label="Items" active={sortKey === 'items'} dir={sortDir} onClick={() => toggleSort('items')} />
                                <SortableTh label="Tanggal" active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
                                <th className="w-28 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((r: any) => (
                                <tr key={r.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                                    <td className="px-3 py-3 font-bold tabular-nums text-text">#{r.id}</td>
                                    <td className="px-3 py-3 text-text-muted">{r.outlet?.name ?? '—'}</td>
                                    <td className="px-3 py-3"><StatusBadge status={r.status} size="sm" /></td>
                                    <td className="px-3 py-3 text-text-muted">{r.items?.length ?? 0} item</td>
                                    <td className="px-3 py-3 text-text-muted">{formatDate(r.created_at)}</td>
                                    <td className="px-3 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {r.status === 'requested' ? (
                                                <Button size="sm" onClick={() => handleOpenApprove(r)}>Approve</Button>
                                            ) : (
                                                <Button variant="ghost" size="sm" onClick={() => handleOpenApprove(r)}>Detail</Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Pagination links={restocks.links} />

            {/* Approve/Detail Modal */}
            <RestockActionModal
                restock={approveModal}
                onClose={() => setApproveModal(null)}
                onSuccess={() => setApproveModal(null)}
            />

            {/* Create Modal */}
            <RestockCreateModal open={createModal} outlets={outlets} onClose={() => setCreateModal(false)} onSuccess={() => setCreateModal(false)} />
        </OwnerPageShell>
    );
}

// ── Approve/Detail Modal ──
function RestockActionModal({ restock, onClose, onSuccess }: { restock: any; onClose: () => void; onSuccess: () => void }) {
    const [detail, setDetail] = useState<any>(null);
    const [inventories, setInventories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showReject, setShowReject] = useState(false);

    const approveForm = useForm({
        owner_notes: '',
        items: [] as any[],
    });
    const rejectForm = useForm({ rejected_reason: '' });

    useEffect(() => {
        if (!restock) return;
        setLoading(true);
        fetch(`/owner/restocks/${restock.id}`, { headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
            .then(r => r.json())
            .then(data => {
                setDetail(data.restock);
                setInventories(data.inventories ?? []);
                approveForm.setData({
                    owner_notes: data.restock.owner_notes ?? '',
                    items: (data.restock.items ?? []).map((item: any) => ({
                        restock_request_item_id: item.id,
                        approved_quantity: item.approved_quantity ?? item.requested_quantity,
                    })),
                });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [restock?.id]);

    if (!restock) return null;

    const isRequested = restock.status === 'requested';

    const handleApprove = () => {
        approveForm.post(`/owner/restocks/${restock.id}/approve`, { onSuccess: () => { onSuccess(); onClose(); } });
    };

    const handleReject = () => {
        rejectForm.post(`/owner/restocks/${restock.id}/reject`, { onSuccess: () => { onSuccess(); onClose(); } });
    };

    return (
        <>
            <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{isRequested ? 'Approve Restock' : 'Detail Restock'} #{restock.id}</DialogTitle>
                        <DialogDescription>{restock.outlet?.name} &middot; {formatDate(restock.created_at)}</DialogDescription>
                    </DialogHeader>

                    {loading ? (
                        <div className="py-8 text-center text-sm text-text-muted">Memuat...</div>
                    ) : (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                            {/* Items */}
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-xs text-text-muted">
                                        <th className="py-1.5 text-left font-medium">Produk</th>
                                        <th className="py-1.5 text-right font-medium">Diminta</th>
                                        <th className="py-1.5 text-right font-medium">Disetujui</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isRequested
                                        ? approveForm.data.items.map((item: any, i: number) => {
                                            const detailItem = detail?.items?.[i];
                                            const inv = inventories.find((inv: any) => inv.product_variant_id === detailItem?.product_variant_id);

                                            return (
                                                <tr key={i} className="border-t border-border/30">
                                                    <td className="py-2 font-medium text-text">{detailItem?.variant?.name ?? detailItem?.product?.name ?? '-'}</td>
                                                    <td className="py-2 text-right tabular-nums text-text-muted">{detailItem?.requested_quantity}</td>
                                                    <td className="py-2 text-right">
                                                        <input type="number" min={0}
                                                            value={item.approved_quantity}
                                                            onChange={(e) => {
                                                                const items = [...approveForm.data.items];
                                                                items[i] = { ...items[i], approved_quantity: Number(e.target.value) };
                                                                approveForm.setData('items', items as any);
                                                            }}
                                                            className="h-7 w-16 rounded border border-border px-1.5 text-right text-xs font-semibold outline-none focus:border-primary"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })
                                        : (detail?.items ?? []).map((item: any) => (
                                            <tr key={item.id} className="border-t border-border/30">
                                                <td className="py-2 font-medium text-text">{item.variant?.name ?? item.product?.name ?? '-'}</td>
                                                <td className="py-2 text-right tabular-nums text-text-muted">{item.requested_quantity}</td>
                                                <td className="py-2 text-right tabular-nums font-semibold">{item.approved_quantity ?? '—'}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>

                            {detail?.distribution && (
                                <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                                    <span className="font-semibold">Distribusi #{detail.distribution.id}</span>
                                    {' '}&middot;{' '}
                                    <StatusBadge status={detail.distribution.status} size="sm" />
                                    {detail.distribution.sent_at && <span className="ml-2 text-text-muted">Dikirim {formatDate(detail.distribution.sent_at)}</span>}
                                </div>
                            )}

                            {isRequested && (
                                <Textarea
                                    value={approveForm.data.owner_notes}
                                    onChange={(e) => approveForm.setData('owner_notes', e.target.value)}
                                    placeholder="Catatan (opsional)"
                                    rows={2}
                                />
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        {isRequested && (
                            <>
                                <Button variant="destructive" onClick={() => setShowReject(true)} disabled={loading}>
                                    <XCircle className="mr-1.5 h-4 w-4" />Tolak
                                </Button>
                                <div className="flex-1" />
                                <Button variant="outline" onClick={onClose}>Batal</Button>
                                <Button onClick={handleApprove} disabled={loading || approveForm.processing}>
                                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                    {approveForm.processing ? 'Menyetujui...' : 'Setujui & Buat Distribusi'}
                                </Button>
                            </>
                        )}
                        {!isRequested && (
                            <Button variant="outline" onClick={onClose}>Tutup</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject sub-modal */}
            <Dialog open={showReject} onOpenChange={setShowReject}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Tolak Restock</DialogTitle></DialogHeader>
                    <Textarea value={rejectForm.data.rejected_reason} onChange={(e) => rejectForm.setData('rejected_reason', e.target.value)} placeholder="Alasan penolakan" rows={3} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowReject(false)}>Batal</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={rejectForm.processing}>Tolak</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}


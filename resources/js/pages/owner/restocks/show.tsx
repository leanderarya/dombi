import { router, useForm } from '@inertiajs/react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import DistributionStatusBadge from '@/components/ui/distribution-status-badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RestockStatusBadge from '@/components/ui/restock-status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import StockLevelBadge from '@/components/ui/stock-level-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/format';
import { calculateStockStatus } from '@/lib/stock';
import RestockTimeline, { buildTimeline } from './restock-timeline';

export default function OwnerRestockShow({ restock, inventories }: any) {
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);

    const inventoryByProduct = new Map(inventories.map((item: any) => [item.product_id, item]));
    const distribution = restock.distribution;
    const totalRequested = restock.items.reduce((sum: number, item: any) => sum + Number(item.requested_quantity), 0);
    const totalApproved = restock.items.reduce((sum: number, item: any) => sum + Number(item.approved_quantity ?? 0), 0);
    const totalDistributed = distribution?.items?.reduce((sum: number, item: any) => sum + Number(item.quantity), 0) ?? 0;

    const approveForm = useForm({
        owner_notes: restock.owner_notes ?? '',
        items: restock.items.map((item: any) => ({
            restock_request_item_id: item.id,
            approved_quantity: item.approved_quantity ?? item.requested_quantity,
        })),
    });
    const rejectForm = useForm({ rejected_reason: '' });

    const setApproved = (index: number, value: number) => {
        const items = [...approveForm.data.items] as any[];
        items[index] = { ...items[index], approved_quantity: value };
        approveForm.setData('items', items as any);
    };

    const timeline = buildTimeline(restock);

    if (!restock) {
        return (
            <OwnerPageShell title="Memuat..." subtitle="Detail restock" backHref="/owner/restocks">
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="space-y-3 rounded-lg border border-border p-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-3 rounded-lg border border-border p-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    </div>
                </div>
            </OwnerPageShell>
        );
    }

    const handleApprove = () => {
        approveForm.post(`/owner/restocks/${restock.id}/approve`, {
            onSuccess: () => {
                setShowApprove(false);
            },
        });
    };

    const handleReject = () => {
        rejectForm.post(`/owner/restocks/${restock.id}/reject`, {
            onSuccess: () => {
                setShowReject(false);
                rejectForm.reset();
            },
        });
    };

    return (
        <OwnerPageShell title={`Restock #${restock.id}`} subtitle={restock.outlet.name} backHref="/owner/restocks">
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Informasi Restock</div>
                        <OwnerDetailRow label="Outlet" value={restock.outlet.name} />
                        <OwnerDetailRow label="Diminta oleh" value={restock.requester?.name ?? '-'} />
                        <OwnerDetailRow label="Tanggal permintaan" value={formatDate(restock.created_at)} />
                        <OwnerDetailRow label="Total diminta" value={`${totalRequested} unit`} bold />
                        <OwnerDetailRow label="Total disetujui" value={totalApproved ? `${totalApproved} unit` : '-'} bold />
                    </div>

                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Item Permintaan</div>
                        {restock.items.map((item: any) => (
                            <OwnerDetailRow
                                key={item.id}
                                label={item.product?.name ?? item.variant?.name ?? '-'}
                                value={`Diminta ${item.requested_quantity} · Disetujui ${item.approved_quantity ?? 0}`}
                                bold
                            />
                        ))}
                    </div>

                    {distribution && (
                        <div className="rounded-lg border border-border p-4">
                            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Status Distribusi</div>
                            <div className="flex items-center gap-2 mb-3">
                                <DistributionStatusBadge status={distribution.status} />
                            </div>
                            <OwnerDetailRow label="Pengiriman" value={`#${distribution.id}`} />
                            <OwnerDetailRow label="Jumlah kirim" value={`${totalDistributed} unit`} />
                            <OwnerDetailRow label="Penanggung jawab" value={distribution.sender?.name ?? restock.approver?.name ?? '-'} />
                            <OwnerDetailRow label="Tanggal kirim" value={formatDate(distribution.sent_at)} />
                            <OwnerDetailRow label="Tanggal terima" value={formatDate(distribution.received_at)} />

                            <div className="mt-3 rounded-lg border border-border bg-slate-50 p-3">
                                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-subtle">Ringkasan pengiriman</div>
                                {distribution.items.map((item: any) => (
                                    <OwnerDetailRow key={item.id} label={item.product?.name ?? item.variant?.name ?? '-'} value={`${item.quantity}`} bold />
                                ))}
                            </div>

                            {distribution.status === 'preparing' && (
                                <Button className="mt-3 w-full" onClick={() => router.post(`/owner/distributions/${distribution.id}/mark-shipped`)}>
                                    Tandai Dikirim
                                </Button>
                            )}

                            {distribution.status === 'shipped' && (
                                <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-center text-xs font-semibold text-indigo-700">
                                    Menunggu Konfirmasi Outlet
                                </div>
                            )}

                            {distribution.status === 'completed' && (
                                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center text-xs font-semibold text-emerald-700">
                                    Distribusi Selesai
                                </div>
                            )}
                        </div>
                    )}

                    {!distribution && (
                        <div className="rounded-lg border border-dashed border-border p-4">
                            <div className="text-sm font-bold text-text">Status Distribusi</div>
                            <p className="mt-1 text-xs text-text-muted">Belum ada distribution. Approve request untuk membuat shipment.</p>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Status</div>
                        <div className="mb-3 flex items-center gap-2">
                            <RestockStatusBadge status={restock.status} />
                        </div>
                        <OwnerDetailRow label="Diminta" value={`${totalRequested} unit`} />
                        <OwnerDetailRow label="Disetujui" value={totalApproved ? `${totalApproved} unit` : '-'} />
                        <OwnerDetailRow label="Dikirim" value={totalDistributed ? `${totalDistributed} unit` : '-'} />

                        {restock.status === 'requested' && (
                            <div className="mt-4 flex gap-2">
                                <Button size="sm" className="flex-1" onClick={() => setShowApprove(true)}>
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                    Setujui
                                </Button>
                                <Button size="sm" variant="destructive" className="flex-1" onClick={() => setShowReject(true)}>
                                    <XCircle className="mr-1 h-3.5 w-3.5" />
                                    Tolak
                                </Button>
                            </div>
                        )}

                        {restock.status === 'rejected' && (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                                <XCircle className="mx-auto h-5 w-5 text-red-500" />
                                <div className="mt-1 text-xs font-semibold text-red-800">Permintaan Ditolak</div>
                            </div>
                        )}

                        {restock.status === 'completed' && (
                            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                                <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" />
                                <div className="mt-1 text-xs font-semibold text-emerald-800">Restock Selesai</div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Linimasa</div>
                        <RestockTimeline events={timeline} />
                    </div>

                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Catatan</div>
                        <OwnerDetailRow label="Catatan outlet" value={restock.notes} />
                        <OwnerDetailRow label="Catatan owner" value={restock.owner_notes} />
                        {restock.rejected_reason && <OwnerDetailRow label="Alasan penolakan" value={restock.rejected_reason} danger />}
                        <OwnerDetailRow label="Catatan penerimaan" value={distribution?.received_notes} />
                        <OwnerDetailRow label="Catatan kerusakan" value={distribution?.damage_notes} />
                    </div>
                </div>
            </div>

            <Dialog open={showApprove} onOpenChange={setShowApprove}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Setujui Restock</DialogTitle>
                        <DialogDescription>Atur jumlah disetujui per item dan berikan catatan.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {restock.items.map((item: any, index: number) => {
                            const inventory: any = inventoryByProduct.get(item.product_id);

                            return (
                                <div key={item.id} className="rounded-lg border border-border p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-bold text-text">{item.product?.name ?? item.variant?.name ?? '-'}</div>
                                            <div className="text-xs text-text-muted">Diminta {item.requested_quantity}</div>
                                        </div>
                                        {inventory ? (
                                            <StockLevelBadge {...calculateStockStatus(inventory.current_stock, inventory.reserved_stock, inventory.minimum_stock)} showQuantity />
                                        ) : (
                                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-text-muted">Stok Kosong</span>
                                        )}
                                    </div>
                                    <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-text-subtle">Jumlah disetujui</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={(approveForm.data.items[index] as any).approved_quantity}
                                        onChange={(event) => setApproved(index, Number(event.target.value))}
                                        className="mt-1 h-8 w-full rounded-lg border border-border px-2 text-xs font-semibold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                                    />
                                </div>
                            );
                        })}
                        <Textarea
                            value={approveForm.data.owner_notes}
                            onChange={(e) => approveForm.setData('owner_notes', e.target.value)}
                            placeholder="Catatan owner (opsional)"
                            rows={3}
                        />
                        {approveForm.errors.items && <div className="text-xs text-red-600">{approveForm.errors.items}</div>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowApprove(false)}>Batal</Button>
                        <Button onClick={handleApprove} disabled={approveForm.processing}>
                            {approveForm.processing ? 'Memproses...' : 'Setujui & Buat Distribusi'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showReject} onOpenChange={setShowReject}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tolak Restock</DialogTitle>
                        <DialogDescription>Berikan alasan penolakan restock ini.</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={rejectForm.data.rejected_reason}
                        onChange={(e) => rejectForm.setData('rejected_reason', e.target.value)}
                        placeholder="Alasan penolakan"
                        rows={3}
                    />
                    {rejectForm.errors.rejected_reason && <div className="text-xs text-red-600">{rejectForm.errors.rejected_reason}</div>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowReject(false)}>Batal</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={rejectForm.processing}>
                            {rejectForm.processing ? 'Memproses...' : 'Tolak'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}

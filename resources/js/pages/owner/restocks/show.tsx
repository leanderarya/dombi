import { router, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    XCircle,
    Package,
    Clock,
    Building2,
    User,
    Truck,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import RestockStatusBadge from '@/components/ui/restock-status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import StockLevelBadge from '@/components/ui/stock-level-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/format';
import { calculateStockStatus } from '@/lib/stock';
import RestockTimeline, { buildTimeline } from './restock-timeline';

const STATUS_CONFIG: Record<
    string,
    { bg: string; text: string; border: string }
> = {
    requested: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
    },
    approved: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
    },
    rejected: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
    },
    preparing: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
    },
    shipped: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
    },
    completed: {
        bg: 'bg-mint-wash',
        text: 'text-primary',
        border: 'border-primary/20',
    },
};

// Map a product's size_unit to a display unit label ('l'|'ml'|'g'|'kg' → Liter/Pcs).
function unitLabel(item: any): string {
    const unit = item?.product?.size_unit ?? item?.variant?.size_unit;

    return unit === 'ml' || unit === 'l' || unit === 'g' || unit === 'kg'
        ? 'Liter'
        : 'Pcs';
}

function stockedQuantity(item: any, value: number | null | undefined): string {
    return value == null || Number.isNaN(Number(value))
        ? '—'
        : `${value} ${unitLabel(item)}`;
}

export default function OwnerRestockShow({ restock, inventories }: any) {
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const totalRequested =
        restock?.items?.reduce(
            (s: number, i: any) => s + Number(i.requested_quantity),
            0,
        ) ?? 0;
    const totalApproved =
        restock?.items?.reduce(
            (s: number, i: any) => s + Number(i.approved_quantity ?? 0),
            0,
        ) ?? 0;

    const approveForm = useForm({
        owner_notes: restock?.owner_notes ?? '',
        items: (restock?.items ?? []).map((item: any) => ({
            restock_request_item_id: item.id,
            approved_quantity:
                item.approved_quantity ?? item.requested_quantity,
        })),
    });
    const rejectForm = useForm({ rejected_reason: '' });
    const inventoryByProduct = new Map(
        (inventories ?? []).map((item: any) => [
            item.product_variant_id ?? item.product_id,
            item,
        ]),
    );
    const timeline = restock ? buildTimeline(restock) : [];
    const statusCfg = STATUS_CONFIG[restock?.status] ?? STATUS_CONFIG.requested;

    if (!restock) {
        return (
            <OwnerPageShell title="Memuat..." backHref="/owner/restocks">
                <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </OwnerPageShell>
        );
    }

    return (
        <OwnerPageShell
            title={`Restock #${restock.id}`}
            subtitle={restock.outlet?.name}
            backHref="/owner/restocks"
        >
            {/* Summary Strip */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
                <div
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                >
                    <Package className="h-3.5 w-3.5" />
                    <RestockStatusBadge status={restock.status} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Building2 className="h-3.5 w-3.5" />
                    {restock.outlet?.name}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <User className="h-3.5 w-3.5" />
                    {restock.requester?.name ?? '—'}
                </div>
                <div className="flex items-center gap-1.5 text-xs tabular-nums text-text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(restock.created_at)}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Items Table */}
                    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" aria-hidden="true" />
                                <h3 className="font-heading text-base font-bold text-text">
                                    Item Permintaan
                                </h3>
                            </div>
                            <span className="text-xs tabular-nums text-text-muted">
                                {restock.items?.length ?? 0} item
                            </span>
                        </div>
                        <p className="px-5 pb-3 text-xs text-text-muted">
                            Daftar item yang diminta outlet
                        </p>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-surface-muted/50 text-left text-xs text-text-muted">
                                    <th className="px-5 py-2.5 font-medium">
                                        Produk
                                    </th>
                                    <th className="px-5 py-2.5 text-right font-medium">
                                        Diminta
                                    </th>
                                    <th className="px-5 py-2.5 text-right font-medium">
                                        Disetujui
                                    </th>
                                    <th className="px-5 py-2.5 text-center font-medium">
                                        Stok Saat Ini
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {(restock.items ?? []).map((item: any) => {
                                    const inv: any = inventoryByProduct.get(
                                        item.product_id,
                                    );

                                    return (
                                        <tr
                                            key={item.id}
                                            className="border-t border-border/20 transition-colors hover:bg-mint-wash/50"
                                        >
                                            <td className="px-5 py-3 font-medium text-text">
                                                {item.product?.name ??
                                                    item.variant?.name ??
                                                    '-'}
                                            </td>
                                            <td className="px-5 py-3 text-right tabular-nums">
                                                {stockedQuantity(item, item.requested_quantity)}
                                            </td>
                                            <td className="px-5 py-3 text-right font-semibold tabular-nums">
                                                {stockedQuantity(item, item.approved_quantity)}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                {inv ? (
                                                    <StockLevelBadge
                                                        {...calculateStockStatus(
                                                            inv.current_stock,
                                                            inv.reserved_stock,
                                                            inv.minimum_stock,
                                                        )}
                                                        showQuantity
                                                    />
                                                ) : (
                                                    <span className="text-xs text-text-muted">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-border bg-surface-muted/30 text-xs font-semibold">
                                    <td className="px-5 py-2.5">Total</td>
                                    <td className="px-5 py-2.5 text-right tabular-nums">
                                        {stockedQuantity({}, totalRequested)}
                                    </td>
                                    <td className="px-5 py-2.5 text-right tabular-nums">
                                        {stockedQuantity({}, totalApproved)}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </section>

                    {/* Info Grid */}
                    <section className="rounded-2xl border border-border bg-surface p-5">
                        <div className="mb-3 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                            <h3 className="font-heading text-base font-bold text-text">
                                Informasi
                            </h3>
                        </div>
                        <p className="mb-3 text-xs text-text-muted">Detail restock</p>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                            <div className="text-text-muted">Outlet</div>
                            <div className="font-medium text-text">
                                {restock.outlet?.name}
                            </div>
                            <div className="text-text-muted">Diminta oleh</div>
                            <div className="font-medium text-text">
                                {restock.requester?.name ?? '—'}
                            </div>
                            <div className="text-text-muted">Tanggal</div>
                            <div className="font-medium tabular-nums text-text">
                                {formatDate(restock.created_at)}
                            </div>
                            {restock.notes && (
                                <>
                                    <div className="text-text-muted">
                                        Catatan
                                    </div>
                                    <div className="text-text">
                                        {restock.notes}
                                    </div>
                                </>
                            )}
                            {restock.rejected_reason && (
                                <>
                                    <div className="text-text-muted">
                                        Alasan tolak
                                    </div>
                                    <div className="font-medium text-red-600">
                                        {restock.rejected_reason}
                                    </div>
                                </>
                            )}
                            {restock.owner_notes && (
                                <>
                                    <div className="text-text-muted">
                                        Catatan owner
                                    </div>
                                    <div className="text-text">
                                        {restock.owner_notes}
                                    </div>
                                </>
                            )}
                            {restock.sent_by && (
                                <>
                                    <div className="text-text-muted">
                                        Dikirim oleh
                                    </div>
                                    <div className="font-medium text-text">
                                        {restock.sender?.name ?? '—'}
                                    </div>
                                </>
                            )}
                            {restock.sent_at && (
                                <>
                                    <div className="text-text-muted">
                                        Dikirim pada
                                    </div>
                                    <div className="font-medium tabular-nums text-text">
                                        {formatDate(restock.sent_at)}
                                    </div>
                                </>
                            )}
                            {restock.received_by && (
                                <>
                                    <div className="text-text-muted">
                                        Diterima oleh
                                    </div>
                                    <div className="font-medium text-text">
                                        {restock.receiver?.name ?? '—'}
                                    </div>
                                </>
                            )}
                            {restock.received_at && (
                                <>
                                    <div className="text-text-muted">
                                        Diterima pada
                                    </div>
                                    <div className="font-medium tabular-nums text-text">
                                        {formatDate(restock.received_at)}
                                    </div>
                                </>
                            )}
                            {restock.received_notes && (
                                <>
                                    <div className="text-text-muted">
                                        Catatan penerimaan
                                    </div>
                                    <div className="text-text">
                                        {restock.received_notes}
                                    </div>
                                </>
                            )}
                            {restock.damage_notes && (
                                <>
                                    <div className="text-text-muted">
                                        Catatan kerusakan
                                    </div>
                                    <div className="font-medium text-red-600">
                                        {restock.damage_notes}
                                    </div>
                                </>
                            )}
                        </div>
                    </section>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Actions */}
                    {restock.status === 'requested' && (
                        <section className="rounded-2xl border border-border bg-surface p-5">
                            <div className="mb-3 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                                <h3 className="font-heading text-base font-bold text-text">
                                    Aksi
                                </h3>
                            </div>
                            <p className="mb-3 text-xs text-text-muted">
                                Tinjau permintaan restock
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    className="min-h-11 flex-1"
                                    onClick={() => setShowApprove(true)}
                                >
                                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                    Setujui
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="min-h-11 flex-1"
                                    onClick={() => setShowReject(true)}
                                >
                                    <XCircle className="mr-1.5 h-4 w-4" />
                                    Tolak
                                </Button>
                            </div>
                        </section>
                    )}

                    {restock.status === 'preparing' && (
                        <section className="rounded-2xl border border-border bg-surface p-5">
                            <div className="mb-3 flex items-center gap-2">
                                <Truck className="h-4 w-4 text-primary" aria-hidden="true" />
                                <h3 className="font-heading text-base font-bold text-text">
                                    Aksi
                                </h3>
                            </div>
                            <p className="mb-3 text-xs text-text-muted">
                                Lanjutkan pengiriman stok
                            </p>
                            <Button
                                className="min-h-11 w-full"
                                onClick={() =>
                                    router.post(
                                        `/owner/restocks/${restock.id}/mark-shipped`,
                                        {},
                                        {
                                            preserveScroll: true,
                                            onSuccess: () =>
                                                toast.success('Dikirim'),
                                            onError: (errors) =>
                                                toast.error(
                                                    Object.values(errors)
                                                        .flat()
                                                        .join(', '),
                                                ),
                                        },
                                    )
                                }
                            >
                                <Truck className="mr-1.5 h-4 w-4" />
                                Kirim Stok
                            </Button>
                        </section>
                    )}

                    {/* Timeline */}
                    {timeline.length > 0 && (
                        <section className="rounded-2xl border border-border bg-surface p-5">
                            <div className="mb-3 flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                                <h3 className="font-heading text-base font-bold text-text">
                                    Riwayat
                                </h3>
                            </div>
                            <p className="mb-3 text-xs text-text-muted">
                                Perjalanan restock
                            </p>
                            <RestockTimeline events={timeline} />
                        </section>
                    )}
                </div>
            </div>

            {/* Approve Modal */}
            <Dialog open={showApprove} onOpenChange={setShowApprove}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Setujui Restock</DialogTitle>
                        <DialogDescription>
                            Atur jumlah disetujui per item.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-80 space-y-2 overflow-y-auto">
                        {(restock.items ?? []).map(
                            (item: any, index: number) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-3 rounded-xl bg-surface-muted/50 px-3 py-2.5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">
                                            {item.product?.name ??
                                                item.variant?.name ??
                                                '-'}
                                        </div>
                                        <div className="text-xs text-text-muted">
                                            Diminta{' '}
                                            {stockedQuantity(item, item.requested_quantity)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            min={0}
                                            value={
                                                (
                                                    approveForm.data.items[
                                                        index
                                                    ] as any
                                                ).approved_quantity
                                            }
                                            onChange={(e) => {
                                                const items = [
                                                    ...approveForm.data.items,
                                                ] as any[];
                                                items[index] = {
                                                    ...items[index],
                                                    approved_quantity: Number(
                                                        e.target.value,
                                                    ),
                                                };
                                                approveForm.setData(
                                                    'items',
                                                    items as any,
                                                );
                                            }}
                                            className="h-11 w-20 rounded-xl border border-border bg-surface px-2 text-right text-sm font-semibold tabular-nums outline-none focus:border-primary"
                                        />
                                        <span className="text-xs text-text-muted">
                                            {unitLabel(item)}
                                        </span>
                                    </div>
                                </div>
                            ),
                        )}
                        <Textarea
                            value={approveForm.data.owner_notes}
                            onChange={(e) =>
                                approveForm.setData(
                                    'owner_notes',
                                    e.target.value,
                                )
                            }
                            placeholder="Catatan (opsional)"
                            rows={2}
                        />
                        {approveForm.errors.items && (
                            <div className="text-xs text-red-600">
                                {approveForm.errors.items}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            className="min-h-11"
                            onClick={() => setShowApprove(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            className="min-h-11"
                            onClick={() =>
                                approveForm.post(
                                    `/owner/restocks/${restock.id}/approve`,
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => {
                                            setShowApprove(false);
                                            toast.success('Restock disetujui');
                                        },
                                        onError: (errors) =>
                                            toast.error(
                                                Object.values(errors)
                                                    .flat()
                                                    .join(', '),
                                            ),
                                    },
                                )
                            }
                            disabled={approveForm.processing}
                        >
                            {approveForm.processing
                                ? 'Memproses...'
                                : 'Setujui'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Modal */}
            <Dialog open={showReject} onOpenChange={setShowReject}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tolak Restock</DialogTitle>
                        <DialogDescription>
                            Berikan alasan penolakan.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={rejectForm.data.rejected_reason}
                        onChange={(e) =>
                            rejectForm.setData(
                                'rejected_reason',
                                e.target.value,
                            )
                        }
                        placeholder="Alasan penolakan"
                        rows={3}
                    />
                    {rejectForm.errors.rejected_reason && (
                        <div className="text-xs text-red-600">
                            {rejectForm.errors.rejected_reason}
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            className="min-h-11"
                            onClick={() => setShowReject(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            className="min-h-11"
                            onClick={() =>
                                rejectForm.post(
                                    `/owner/restocks/${restock.id}/reject`,
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => {
                                            setShowReject(false);
                                            rejectForm.reset();
                                            toast.success('Restock ditolak');
                                        },
                                        onError: (errors) =>
                                            toast.error(
                                                Object.values(errors)
                                                    .flat()
                                                    .join(', '),
                                            ),
                                    },
                                )
                            }
                            disabled={rejectForm.processing}
                        >
                            Tolak
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}

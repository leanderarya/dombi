import { useForm } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Clock, MapPin, ShoppingBag, Truck, User } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import OrderStatusChip from '@/components/owner/order-status-chip';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import ResolveDeliverySheet from '@/components/owner/resolve-delivery-sheet';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/format';
import { isDifferentRecipient } from '@/lib/recipient';
import { getOrderStatus } from '@/lib/status-labels';

export default function OwnerOrderShow({ order, couriers }: any) {
    const form = useForm({
        courier_id: couriers[0]?.id ?? '',
        courier_type: 'dombi',
    });
    const [resolveOpen, setResolveOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const cancelForm = useForm({ reason: '', notes: '' });
    const [showFullTimeline, setShowFullTimeline] = useState(false);

    if (!order) {
        return (
            <OwnerPageShell
                title="Memuat..."
                subtitle="Detail pesanan"
                backHref="/owner/orders"
            >
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                        <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-6 w-3/4" />
                        </div>
                    </div>
                </div>
            </OwnerPageShell>
        );
    }

    const lastHistory =
        order.status_histories?.[order.status_histories.length - 1];
    const olderHistories = order.status_histories?.slice(0, -1) ?? [];

    return (
        <OwnerPageShell
            title={order.order_code}
            subtitle="Detail pesanan"
            backHref="/owner/orders"
            headerRight={<OrderStatusChip status={order.status} />}
        >
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Main Content - 2 columns */}
                <div className="space-y-4 lg:col-span-2">
                    {/* Items */}
                    <div
                        aria-label="Item pesanan"
                        className="rounded-2xl border border-border bg-surface p-5"
                    >
                        <div className="mb-3 flex items-center gap-2">
                            <ShoppingBag
                                aria-hidden="true"
                                className="h-4 w-4 text-primary"
                            />
                            <h3 className="font-heading text-base font-bold text-text">
                                Item
                            </h3>
                        </div>
                        {order.items.map((item: any) => (
                            <OwnerDetailRow
                                key={item.id}
                                label={`${item.product_name} x${item.quantity}`}
                                value={formatCurrency(item.subtotal)}
                                bold
                            />
                        ))}
                        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                            <OwnerDetailRow
                                label="Subtotal"
                                value={formatCurrency(order.subtotal)}
                            />
                            {Number(order.delivery_fee) > 0 && (
                                <OwnerDetailRow
                                    label="Ongkir"
                                    value={formatCurrency(order.delivery_fee)}
                                />
                            )}
                            <OwnerDetailRow
                                label="Biaya Admin (Customer)"
                                value={
                                    Number(order.payment_fee) > 0
                                        ? formatCurrency(order.payment_fee)
                                        : 'Rp 0'
                                }
                            />
                            {Number(order.gateway_fee) > 0 && (
                                <>
                                    <OwnerDetailRow
                                        label="Biaya Gateway"
                                        value={formatCurrency(
                                            order.gateway_fee,
                                        )}
                                    />
                                    <OwnerDetailRow
                                        label="Ditanggung Dombi"
                                        value={formatCurrency(
                                            order.absorbed_fee ?? 0,
                                        )}
                                    />
                                </>
                            )}
                            <div className="mt-1 text-[11px] text-text-muted">
                                Metode: {order.payment_method} · Threshold
                                subtotal &lt; Rp 500rb ditanggung Dombi (full
                                absorb), CC selalu customer.
                            </div>
                        </div>
                        <div className="mt-2 rounded-xl border border-border bg-surface-muted/50 p-3 text-right text-lg font-bold tabular-nums">
                            {formatCurrency(order.total)}
                        </div>
                    </div>

                    {/* Customer */}
                    <div
                        aria-label="Informasi pelanggan"
                        className="rounded-2xl border border-border bg-surface p-5"
                    >
                        <div className="mb-3 flex items-center gap-2">
                            <User
                                aria-hidden="true"
                                className="h-4 w-4 text-primary"
                            />
                            <h3 className="font-heading text-base font-bold text-text">
                                {isDifferentRecipient(order)
                                    ? 'Pemesan'
                                    : 'Customer'}
                            </h3>
                        </div>
                        <OwnerDetailRow
                            label="ID Pesanan"
                            value={order.order_code}
                        />
                        <OwnerDetailRow
                            label="Telepon"
                            value={order.customer_phone}
                        />
                        <OwnerDetailRow
                            label="Alamat"
                            value={order.customer_address}
                            align="right"
                        />
                        {order.customer_address_detail && (
                            <OwnerDetailRow
                                label="Detail"
                                value={order.customer_address_detail}
                            />
                        )}
                        {order.customer_landmark && (
                            <OwnerDetailRow
                                label="Patokan"
                                value={order.customer_landmark}
                            />
                        )}

                        {isDifferentRecipient(order) && (
                            <>
                                <div className="mb-3 flex items-center gap-2">
                                    <User
                                        aria-hidden="true"
                                        className="h-4 w-4 text-primary"
                                    />
                                    <h3 className="font-heading text-base font-bold text-text">
                                        Penerima
                                    </h3>
                                </div>
                                <OwnerDetailRow
                                    label="Nama"
                                    value={order.recipient_name}
                                />
                                <OwnerDetailRow
                                    label="Telepon"
                                    value={order.recipient_phone ?? '-'}
                                />
                            </>
                        )}

                        {order.latitude && order.longitude && (
                            <a
                                href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 bg-primary-light px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                            >
                                <MapPin
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5"
                                />
                                Buka di Maps
                            </a>
                        )}
                    </div>
                </div>

                {/* Sidebar - 1 column */}
                <div className="space-y-4">
                    {/* Timeline */}
                    <div
                        aria-label="Linimasa pesanan"
                        className="rounded-2xl border border-border bg-surface p-5"
                    >
                        <div className="mb-3 flex items-center gap-2">
                            <Clock
                                aria-hidden="true"
                                className="h-4 w-4 text-primary"
                            />
                            <h3 className="font-heading text-base font-bold text-text">
                                Linimasa
                            </h3>
                        </div>
                        {lastHistory && (
                            <div className="flex items-center gap-2">
                                <StatusBadge
                                    variant={
                                        getOrderStatus(lastHistory.to_status)
                                            .variant
                                    }
                                    size="md"
                                >
                                    {
                                        getOrderStatus(lastHistory.to_status)
                                            .label
                                    }
                                </StatusBadge>
                                <span className="text-xs text-text-subtle">
                                    {new Date(
                                        lastHistory.created_at,
                                    ).toLocaleString('id-ID')}
                                </span>
                            </div>
                        )}
                        {olderHistories.length > 0 && (
                            <>
                                <button
                                    onClick={() =>
                                        setShowFullTimeline(!showFullTimeline)
                                    }
                                    className="mt-2 flex min-h-11 items-center gap-1 px-2 text-xs font-medium text-primary"
                                >
                                    {showFullTimeline ? (
                                        <>
                                            Sembunyikan{' '}
                                            <ChevronUp
                                                aria-hidden="true"
                                                className="h-3 w-3"
                                            />
                                        </>
                                    ) : (
                                        <>
                                            Lihat Semua ({olderHistories.length}
                                            ){' '}
                                            <ChevronDown
                                                aria-hidden="true"
                                                className="h-3 w-3"
                                            />
                                        </>
                                    )}
                                </button>
                                {showFullTimeline && (
                                    <div className="mt-2 space-y-2">
                                        {olderHistories.map((h: any) => (
                                            <div
                                                key={h.id}
                                                className="border-l-2 border-primary/20 pl-3 text-sm"
                                            >
                                                <div className="font-medium">
                                                    <StatusBadge
                                                        variant={
                                                            getOrderStatus(
                                                                h.to_status,
                                                            ).variant
                                                        }
                                                        size="sm"
                                                    >
                                                        {
                                                            getOrderStatus(
                                                                h.to_status,
                                                            ).label
                                                        }
                                                    </StatusBadge>
                                                </div>
                                                <div className="text-xs text-text-subtle">
                                                    {new Date(
                                                        h.created_at,
                                                    ).toLocaleString('id-ID')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Assign Kurir */}
                    {order.status === 'ready_for_pickup' && !order.delivery && (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.post(
                                    `/owner/orders/${order.id}/assign-courier`,
                                    {
                                        preserveScroll: true,
                                        onSuccess: () =>
                                            toast.success('Kurir ditugaskan'),
                                        onError: (errors) =>
                                            toast.error(
                                                Object.values(errors)
                                                    .flat()
                                                    .join(', '),
                                            ),
                                    },
                                );
                            }}
                            aria-label="Form assign kurir"
                            className="rounded-2xl border border-border bg-surface p-5"
                        >
                            <div className="mb-3 flex items-center gap-2">
                                <Truck
                                    aria-hidden="true"
                                    className="h-4 w-4 text-primary"
                                />
                                <h3 className="font-heading text-base font-bold text-text">
                                    Assign Kurir
                                </h3>
                            </div>
                            <Select
                                value={String(form.data.courier_id)}
                                onChange={(e) =>
                                    form.setData('courier_id', e.target.value)
                                }
                                options={couriers.map((c: any) => ({
                                    value: String(c.id),
                                    label: c.name,
                                }))}
                            />
                            <Button
                                className="mt-3 min-h-11 w-full"
                                loading={form.processing}
                            >
                                <Truck aria-hidden="true" className="h-4 w-4" />
                                Tugaskan Kurir
                            </Button>
                        </form>
                    )}

                    {/* Courier */}
                    {order.delivery && (
                        <div
                            aria-label="Informasi kurir"
                            className="rounded-2xl border border-border bg-surface p-5"
                        >
                            <div className="mb-3 flex items-center gap-2">
                                <Truck
                                    aria-hidden="true"
                                    className="h-4 w-4 text-primary"
                                />
                                <h3 className="font-heading text-base font-bold text-text">
                                    Kurir
                                </h3>
                            </div>
                            <OwnerDetailRow
                                label="Nama"
                                value={order.delivery.courier?.name ?? '-'}
                            />
                        </div>
                    )}

                    {/* Resolve */}
                    {(order.delivery?.status === 'failed' ||
                        [
                            'failed',
                            'retry_delivery',
                            'returned_to_outlet',
                        ].includes(order.delivery?.status ?? '')) && (
                            <Button
                                variant="destructive"
                                className="min-h-11 w-full"
                                onClick={() => setResolveOpen(true)}
                            >
                                Selesaikan Masalah
                            </Button>
                        )}

                    {/* Cancel */}
                    {[
                        'confirmed',
                        'preparing',
                        'ready_for_pickup',
                        'failed_delivery',
                    ].includes(order.status) && (
                        <Button
                            variant="destructive"
                            className="min-h-11 w-full"
                            onClick={() => setCancelOpen(true)}
                        >
                            Batalkan Pesanan
                        </Button>
                    )}
                </div>
            </div>
            {order.delivery && (
                <ResolveDeliverySheet
                    delivery={order.delivery}
                    open={resolveOpen}
                    onClose={() => setResolveOpen(false)}
                />
            )}
            <Dialog
                open={cancelOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setCancelOpen(false);
                        cancelForm.reset();
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Batalkan Pesanan</DialogTitle>
                        <DialogDescription>
                            Pilih alasan pembatalan pesanan ini.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Select
                            placeholder="Pilih alasan..."
                            value={cancelForm.data.reason}
                            onChange={(e) =>
                                cancelForm.setData('reason', e.target.value)
                            }
                            options={[
                                {
                                    value: 'Stok Tidak Tersedia',
                                    label: 'Stok Tidak Tersedia',
                                },
                                {
                                    value: 'Produk Rusak',
                                    label: 'Produk Rusak',
                                },
                                {
                                    value: 'Outlet Tutup',
                                    label: 'Outlet Tutup',
                                },
                                {
                                    value: 'Gangguan Operasional',
                                    label: 'Gangguan Operasional',
                                },
                                {
                                    value: 'Permintaan Customer',
                                    label: 'Permintaan Customer',
                                },
                                { value: 'Lainnya', label: 'Lainnya' },
                            ]}
                        />
                        <Textarea
                            placeholder="Catatan (opsional)"
                            value={cancelForm.data.notes}
                            onChange={(e) =>
                                cancelForm.setData('notes', e.target.value)
                            }
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            className="min-h-11"
                            onClick={() => {
                                setCancelOpen(false);
                                cancelForm.reset();
                            }}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            className="min-h-11"
                            disabled={!cancelForm.data.reason}
                            loading={cancelForm.processing}
                            onClick={() => {
                                cancelForm.post(
                                    `/owner/orders/${order.id}/cancel`,
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => {
                                            setCancelOpen(false);
                                            cancelForm.reset();
                                            toast.success('Pesanan dibatalkan');
                                        },
                                        onError: (errors) =>
                                            toast.error(
                                                Object.values(errors)
                                                    .flat()
                                                    .join(', '),
                                            ),
                                    },
                                );
                            }}
                        >
                            Ya, Batalkan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}

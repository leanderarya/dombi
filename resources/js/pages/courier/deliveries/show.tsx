import { Head, Link, router, useForm } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, MapPin, MessageCircle, Package, Phone, Store, Truck, XCircle } from 'lucide-react';
import { useState } from 'react';
import Dialog from '@/components/ui/dialog';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import StickyActionBar from '@/components/ui/sticky-action-bar';
import CourierLayout from '@/layouts/courier-layout';
import { formatCurrency, formatDate } from '@/lib/format';
import { isDifferentRecipient, getContactPhone } from '@/lib/recipient';

interface DeliveryData {
    id: number;
    status: string;
    pickup_time: string | null;
    delivered_time: string | null;
    assigned_at: string | null;
    failed_reason: string | null;
    notes: string | null;
    proof_image: string | null;
    delivered_to: string | null;
    delivery_note: string | null;
    courier: { id: number; name: string } | null;
    order: {
        id: number;
        order_code: string;
        customer_name: string;
        customer_phone: string | null;
        recipient_name: string | null;
        recipient_phone: string | null;
        customer_address: string;
        customer_address_detail: string | null;
        customer_landmark: string | null;
        latitude: number | null;
        longitude: number | null;
        notes: string | null;
        total: number;
        outlet: {
            id: number;
            name: string;
            address: string;
            latitude: number | null;
            longitude: number | null;
            phone: string | null;
        } | null;
        items: Array<{
            id: number;
            product_name: string;
            quantity: number;
            price: number;
            subtotal: number;
        }>;
    };
    status_histories: Array<{
        id: number;
        from_status: string | null;
        to_status: string;
        reason: string | null;
        notes: string | null;
        created_at: string | null;
        actor: { name: string } | null;
    }>;
}

const FAILURE_REASONS = [
    'Customer Tidak Ditemukan',
    'Penerima Tidak Ada',
    'Alamat Tidak Jelas',
    'Menolak Pesanan',
    'Kendala Operasional',
    'Lainnya',
];

const REJECTION_REASONS = [
    'Sedang Mengantar Pesanan Lain',
    'Kendaraan Bermasalah',
    'Di Luar Area Operasional',
    'Kendala Pribadi',
    'Lainnya',
];

const timelineSteps = [
    { key: 'waiting_pickup', label: 'Ditugaskan', icon: Clock },
    { key: 'picked_up', label: 'Diambil', icon: Package },
    { key: 'delivering', label: 'Diantar', icon: Truck },
    { key: 'completed', label: 'Selesai', icon: CheckCircle2 },
];

interface Props {
    delivery: DeliveryData;
}

export default function CourierDeliveryShow({ delivery }: Props) {
    const order = delivery.order;
    const [showFailSheet, setShowFailSheet] = useState(false);
    const [showCompleteSheet, setShowCompleteSheet] = useState(false);
    const [showRejectSheet, setShowRejectSheet] = useState(false);
    const [showReturnSheet, setShowReturnSheet] = useState(false);

    const canConfirmPickup = delivery.status === 'waiting_pickup';
    const canStartDelivery = delivery.status === 'picked_up';
    const canComplete = delivery.status === 'delivering';
    const canFail = delivery.status === 'delivering';
    const canReject = delivery.status === 'waiting_pickup';
    const canReturn = delivery.status === 'failed';
    const hasActions = canConfirmPickup || canStartDelivery || canComplete || canFail || canReject || canReturn;

    const openMaps = () => {
        if (order.latitude && order.longitude) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`, '_blank');
        } else if (order.customer_address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address)}`, '_blank');
        }
    };

    const recipientDiffers = isDifferentRecipient(order);
    const recipientPhone = getContactPhone(order);

    const callCustomer = () => {
        if (recipientPhone) {
            window.open(`tel:${recipientPhone}`, '_self');
        }
    };

    const whatsappCustomer = () => {
        if (recipientPhone) {
            const phone = recipientPhone.replace(/^0/, '62');
            window.open(`https://wa.me/${phone}`, '_blank');
        }
    };

    const confirmPickup = () => {
        router.post(`/courier/deliveries/${delivery.id}/confirm-pickup`, {}, { preserveScroll: true });
    };

    const startDelivery = () => {
        router.post(`/courier/deliveries/${delivery.id}/start-delivery`, {}, { preserveScroll: true });
    };

    const returnToOutlet = () => {
        router.post(`/courier/deliveries/${delivery.id}/return-to-outlet`, {}, { preserveScroll: true });
    };

    const buildActions = () => {
        const actions = [];

        if (canConfirmPickup) {
            actions.push({
                label: 'Ambil Pesanan',
                icon: <Package className="h-4 w-4" />,
                onClick: confirmPickup,
            });
        }

        if (canReject) {
            actions.push({
                label: 'Tolak',
                icon: <XCircle className="h-4 w-4" />,
                onClick: () => setShowRejectSheet(true),
                variant: 'danger' as const,
            });
        }

        if (canStartDelivery) {
            actions.push({
                label: 'Mulai Antar',
                icon: <Truck className="h-4 w-4" />,
                onClick: startDelivery,
            });
        }

        if (canReturn) {
            actions.push({
                label: 'Kembali ke Outlet',
                icon: <AlertTriangle className="h-4 w-4" />,
                onClick: () => setShowReturnSheet(true),
                variant: 'danger' as const,
            });
        }

        if (canComplete) {
            actions.push({
                label: 'Selesaikan Pengiriman',
                icon: <CheckCircle2 className="h-4 w-4" />,
                onClick: () => setShowCompleteSheet(true),
            });
        }

        if (canFail) {
            actions.push({
                label: 'Gagal Antar',
                onClick: () => setShowFailSheet(true),
                variant: 'danger' as const,
            });
        }

        return actions;
    };

    return (
        <CourierLayout
            title={order.order_code}
            subtitle={order.customer_name}
            backHref="/courier/dashboard"
            hideNav
            actionBarSlot={hasActions ? <StickyActionBar actions={buildActions()} /> : undefined}
        >
            <Head title={`Delivery ${order.order_code}`} />

            {/* Status Badge */}
            <div className="mt-4 mb-3 flex justify-center">
                <StatusBadge status={delivery.status} />
            </div>

            {/* Customer / Recipient Info Card */}
            <SectionCard label="Penerima">
                <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                        {/* Show recipient name when different, otherwise customer name */}
                        {recipientDiffers ? (
                            <>
                                <div className="text-sm font-semibold text-text">{order.recipient_name}</div>
                                <div className="mt-0.5 text-xs text-text-muted">Penerima · Pemesan: {order.customer_name}</div>
                            </>
                        ) : (
                            <div className="text-sm font-semibold text-text">{order.customer_name}</div>
                        )}
                        <div className="mt-1 text-sm text-text-muted">{order.customer_address}</div>
                        {order.customer_address_detail && (
                            <div className="mt-0.5 text-xs text-text-muted">{order.customer_address_detail}</div>
                        )}
                        {order.customer_landmark && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                                <MapPin className="h-3.5 w-3.5 text-text-subtle" />
                                {order.customer_landmark}
                            </div>
                        )}
                        {order.notes && (
                            <div className="mt-2 rounded-md bg-surface-muted px-2 py-1.5 text-xs text-text-muted">
                                {order.notes}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Contact */}
                {order.customer_phone && (
                    <div className="mt-3 flex gap-2">
                        <button
                            onClick={whatsappCustomer}
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors active:opacity-80"
                        >
                            <MessageCircle className="h-4 w-4" />
                            WhatsApp
                        </button>
                        <button
                            onClick={callCustomer}
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text transition-colors active:bg-surface-muted"
                        >
                            <Phone className="h-4 w-4" />
                            Telepon
                        </button>
                    </div>
                )}
            </SectionCard>

            {/* Navigation */}
            {(order.latitude && order.longitude) && (
                <button
                    onClick={openMaps}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors active:opacity-80"
                >
                    <MapPin className="h-4 w-4" />
                    Buka di Google Maps
                </button>
            )}

            {/* Outlet + Pesanan */}
            <SectionCard label="Pesanan">
                {order.outlet && (
                    <div className="mb-3 flex items-center gap-2">
                        <Store className="h-4 w-4 text-text-subtle" />
                        <span className="text-sm font-semibold text-text">{order.outlet.name}</span>
                    </div>
                )}
                <div className="space-y-2">
                    {order.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                            <div>
                                <span className="font-medium text-text">{item.product_name}</span>
                                <span className="ml-2 text-text-muted">x{item.quantity}</span>
                            </div>
                            <span className="font-medium tabular-nums text-text">
                                {formatCurrency(item.subtotal)}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="mt-3 border-t border-border pt-3 flex justify-between">
                    <span className="text-sm font-medium text-text-muted">Total</span>
                    <span className="text-sm font-bold tabular-nums text-text">{formatCurrency(order.total)}</span>
                </div>
            </SectionCard>

            {/* Delivery Timeline — collapsed */}
            {delivery.status_histories && delivery.status_histories.length > 0 && (() => {
                const currentStep = timelineSteps.find(s => s.key === delivery.status);
                const currentLabel = delivery.status === 'failed' ? 'Pengiriman Gagal' : (currentStep?.label ?? delivery.status);

                return (
                    <details className="group rounded-xl border border-border bg-white">
                        <summary className="flex cursor-pointer items-center justify-between p-4 active:opacity-80">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Status Pengiriman</div>
                                <div className="mt-1 text-sm font-medium text-text">{currentLabel}</div>
                            </div>
                            <ChevronDown className="h-5 w-5 shrink-0 text-text-subtle transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="border-t border-border px-4 pb-4 pt-4">
                            <div className="space-y-0">
                                {timelineSteps.map((step, index) => {
                                    const history = delivery.status_histories.find((h) => h.to_status === step.key);
                                    const isCompleted = !!history;
                                    const isCurrent = delivery.status === step.key;
                                    const isLast = index === timelineSteps.length - 1;
                                    const Icon = step.icon;

                                    if (delivery.status === 'failed' && step.key === 'delivering') {
                                        return (
                                            <div key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                                                {!isLast && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-red-200" />}
                                                <div className="relative shrink-0 pt-0.5">
                                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 ring-2 ring-red-500">
                                                        <XCircle className="h-3 w-3 text-red-600" />
                                                    </div>
                                                </div>
                                                <div className="min-w-0 flex-1 pt-0.5">
                                                    <div className="text-sm font-semibold text-red-700">Pengiriman Gagal</div>
                                                    {delivery.failed_reason && <div className="mt-0.5 text-xs text-red-600">{delivery.failed_reason}</div>}
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                                            {!isLast && <div className={`absolute left-[11px] top-6 bottom-0 w-px ${isCompleted ? 'bg-primary/20' : 'bg-border'}`} />}
                                            <div className="relative shrink-0 pt-0.5">
                                                {isCompleted ? (
                                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                                                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                                    </div>
                                                ) : isCurrent ? (
                                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light ring-2 ring-primary">
                                                        <Icon className="h-3 w-3 text-primary" />
                                                    </div>
                                                ) : (
                                                    <div className="flex h-6 w-6 items-center justify-center">
                                                        <div className="h-3 w-3 rounded-full bg-border" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1 pt-0.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className={`text-sm font-semibold ${isCurrent ? 'text-primary' : isCompleted ? 'text-text' : 'text-text-subtle'}`}>{step.label}</div>
                                                    {history?.created_at && (
                                                        <span className={`shrink-0 text-xs tabular-nums ${isCurrent ? 'font-semibold text-primary' : 'text-text-subtle'}`}>{formatTime(history.created_at)}</span>
                                                    )}
                                                </div>
                                                {history?.notes && <div className="mt-0.5 text-xs leading-relaxed text-text-muted">{history.notes}</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </details>
                );
            })()}

            {/* Proof of Delivery */}
            {delivery.status === 'completed' && (
                <SectionCard className="border-primary/20 bg-primary-light" label="Bukti Pengiriman">
                    {delivery.proof_image && (
                        <div className="mb-3">
                            <img
                                src={`/storage/${delivery.proof_image}`}
                                alt="Bukti pengiriman"
                                className="w-full rounded-xl object-cover"
                            />
                        </div>
                    )}
                    {delivery.delivered_to && (
                        <div className="mt-2 text-sm text-text">
                            <span className="font-medium text-primary">Diterima oleh:</span> {delivery.delivered_to}
                        </div>
                    )}
                    {delivery.delivery_note && (
                        <div className="mt-1 text-sm text-text">
                            <span className="font-medium text-primary">Catatan:</span> {delivery.delivery_note}
                        </div>
                    )}
                    {delivery.delivered_time && (
                        <div className="mt-1 text-xs text-text-muted">
                            {formatDate(delivery.delivered_time)}
                        </div>
                    )}
                </SectionCard>
            )}

            {/* Failure Info */}
            {delivery.status === 'failed' && delivery.failed_reason && (
                <SectionCard className="border-red-200 bg-red-50" label="Alasan Gagal">
                    <div className="mt-1 text-sm text-red-800">{delivery.failed_reason}</div>
                </SectionCard>
            )}


            {/* Complete Dialog */}
            <Dialog open={showCompleteSheet} onClose={() => setShowCompleteSheet(false)} title="Selesaikan Pengiriman">
                <CompleteSheetContent deliveryId={delivery.id} onClose={() => setShowCompleteSheet(false)} />
            </Dialog>

            {/* Fail Dialog */}
            <Dialog open={showFailSheet} onClose={() => setShowFailSheet(false)} title="Gagal Antar">
                <FailSheetContent deliveryId={delivery.id} onClose={() => setShowFailSheet(false)} />
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={showRejectSheet} onClose={() => setShowRejectSheet(false)} title="Tolak Pesanan">
                <RejectSheetContent deliveryId={delivery.id} onClose={() => setShowRejectSheet(false)} />
            </Dialog>

            {/* Return to Outlet Dialog */}
            <Dialog open={showReturnSheet} onClose={() => setShowReturnSheet(false)} title="Kembali ke Outlet">
                <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-4">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-800">
                        Anda yakin ingin mengembalikan pesanan <strong>{order.order_code}</strong> ke outlet? Pesanan perlu diambil ulang.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowReturnSheet(false)}
                        className="flex-1 rounded-lg border border-border bg-white px-4 py-3 text-sm font-semibold text-text transition-colors active:bg-surface-muted"
                    >
                        Batal
                    </button>
                    <button
                        onClick={returnToOutlet}
                        className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors active:bg-red-700"
                    >
                        Ya, Kembalikan
                    </button>
                </div>
            </Dialog>
        </CourierLayout>
    );
}

function formatTime(value: string): string {
    try {
        return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '-';
    }
}

function CompleteSheetContent({ deliveryId, onClose }: { deliveryId: number; onClose: () => void }) {
    const form = useForm({
        delivered_to: '',
        delivery_note: '',
        proof_image: null as File | null,
    });
    const [proofPreview, setProofPreview] = useState<string | null>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (file) {
            form.setData('proof_image', file);
            setProofPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/courier/deliveries/${deliveryId}/complete`, {
            onSuccess: () => onClose(),
        });
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text">Diterima oleh</label>
                    <input
                        type="text"
                        value={form.data.delivered_to}
                        onChange={(e) => form.setData('delivered_to', e.target.value)}
                        placeholder="Nama penerima"
                        className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-text">Catatan (opsional)</label>
                    <textarea
                        value={form.data.delivery_note}
                        onChange={(e) => form.setData('delivery_note', e.target.value)}
                        placeholder="Catatan pengiriman"
                        rows={2}
                        className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-text">Foto Bukti Pengiriman</label>
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageChange}
                        className="mt-1 w-full text-sm text-text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary-hover"
                    />
                    {proofPreview && (
                        <img src={proofPreview} alt="Preview" className="mt-2 h-32 w-32 rounded-lg object-cover" />
                    )}
                </div>
            </div>

            {form.errors.proof_image && (
                <p className="mt-1 text-xs text-red-600">{form.errors.proof_image}</p>
            )}

            <button
                type="submit"
                disabled={form.processing}
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-white transition-colors active:bg-primary-hover disabled:opacity-50"
            >
                {form.processing ? 'Memproses...' : 'Konfirmasi Selesai'}
            </button>
        </form>
    );
}

function FailSheetContent({ deliveryId, onClose }: { deliveryId: number; onClose: () => void }) {
    const form = useForm({
        failed_reason: '',
        failure_note: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/courier/deliveries/${deliveryId}/fail`, {
            onSuccess: () => onClose(),
        });
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-2">
                {FAILURE_REASONS.map((reason) => (
                    <label
                        key={reason}
                        className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                            form.data.failed_reason === reason
                                ? 'border-red-300 bg-red-50'
                                : 'border-border bg-white active:bg-surface-muted'
                        }`}
                    >
                        <input
                            type="radio"
                            name="failed_reason"
                            value={reason}
                            checked={form.data.failed_reason === reason}
                            onChange={() => form.setData('failed_reason', reason)}
                            className="mr-3"
                        />
                        <span className="text-sm font-medium text-text">{reason}</span>
                    </label>
                ))}
            </div>

            {form.data.failed_reason === 'Lainnya' && (
                <div className="mt-3">
                    <textarea
                        value={form.data.failure_note}
                        onChange={(e) => form.setData('failure_note', e.target.value)}
                        placeholder="Jelaskan alasan kegagalan"
                        rows={3}
                        className="block w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                </div>
            )}

            {form.errors.failed_reason && (
                <p className="mt-1 text-xs text-red-600">{form.errors.failed_reason}</p>
            )}
            {form.errors.failure_note && (
                <p className="mt-1 text-xs text-red-600">{form.errors.failure_note}</p>
            )}

            <button
                type="submit"
                disabled={!form.data.failed_reason || form.processing}
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition-colors active:bg-red-700 disabled:opacity-50"
            >
                {form.processing ? 'Memproses...' : 'Konfirmasi Gagal'}
            </button>
        </form>
    );
}

function RejectSheetContent({ deliveryId, onClose }: { deliveryId: number; onClose: () => void }) {
    const form = useForm({
        rejection_reason: '',
        rejection_note: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/courier/deliveries/${deliveryId}/reject`, {
            onSuccess: () => onClose(),
        });
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-2">
                {REJECTION_REASONS.map((reason) => (
                    <label
                        key={reason}
                        className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                            form.data.rejection_reason === reason
                                ? 'border-red-300 bg-red-50'
                                : 'border-border bg-white active:bg-surface-muted'
                        }`}
                    >
                        <input
                            type="radio"
                            name="rejection_reason"
                            value={reason}
                            checked={form.data.rejection_reason === reason}
                            onChange={() => form.setData('rejection_reason', reason)}
                            className="mr-3"
                        />
                        <span className="text-sm font-medium text-text">{reason}</span>
                    </label>
                ))}
            </div>

            {form.data.rejection_reason === 'Lainnya' && (
                <div className="mt-3">
                    <textarea
                        value={form.data.rejection_note}
                        onChange={(e) => form.setData('rejection_note', e.target.value)}
                        placeholder="Jelaskan alasan penolakan"
                        rows={3}
                        className="block w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                </div>
            )}

            {form.errors.rejection_reason && (
                <p className="mt-1 text-xs text-red-600">{form.errors.rejection_reason}</p>
            )}
            {form.errors.rejection_note && (
                <p className="mt-1 text-xs text-red-600">{form.errors.rejection_note}</p>
            )}

            <button
                type="submit"
                disabled={!form.data.rejection_reason || form.processing}
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition-colors active:bg-red-700 disabled:opacity-50"
            >
                {form.processing ? 'Memproses...' : 'Konfirmasi Tolak'}
            </button>
        </form>
    );
}

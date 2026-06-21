import { Head, Link, router, useForm } from '@inertiajs/react';
import { CheckCircle2, Clock, Copy, MapPin, Navigation, Package, Phone, Share2, Store, Truck, XCircle, AlertTriangle, UserCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import OrderTimeline from '@/components/customer/order-timeline';
import OfflineBanner from '@/components/offline-banner';
import Dialog from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/format';

type TrackOrder = {
    id: number;
    order_code: string;
    recovery_token: string;
    tracking_url: string;
    status: string;
    fulfillment_type: string;
    total: number;
    subtotal: number;
    delivery_fee: number;
    payment_method: string;
    ordered_at?: string;
    outlet?: { name: string; address?: string; phone?: string; operating_hours?: string; latitude?: number; longitude?: number };
    items: { product_name: string; quantity: number; price: number; subtotal: number }[];
    status_histories: { to_status: string; notes?: string | null; created_at?: string | null }[];
    delivery?: { courier?: { name: string; phone?: string } };
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
    customer_address_detail?: string;
    customer_landmark?: string;
    rejection_reason?: string;
    rejection_note?: string;
    cancellation_reason?: string;
    cancellation_note?: string;
};

type Props = {
    order: TrackOrder | null;
    found: boolean;
    cancellationReasons?: string[];
    notifications?: { id: number; title: string; message: string; time_ago: string }[];
    canCreateAccount?: boolean;
    accountPhone?: string;
    accountName?: string;
};

const STATUS_LABELS: Record<string, { label: string; description: string }> = {
    pending_confirmation: { label: 'Menunggu Diproses', description: 'Outlet belum memproses pesanan Anda' },
    confirmed: { label: 'Pesanan Diterima', description: 'Outlet sedang menyiapkan pesanan Anda' },
    preparing: { label: 'Sedang Disiapkan', description: 'Pesanan Anda sedang disiapkan' },
    ready_for_pickup: { label: 'Siap Diambil', description: 'Pesanan sudah siap, silakan ambil di outlet' },
    picked_up: { label: 'Kurir Mengambil', description: 'Kurir sudah mengambil pesanan' },
    delivering: { label: 'Sedang Diantar', description: 'Pesanan sedang dalam perjalanan' },
    completed: { label: 'Selesai', description: 'Pesanan sudah selesai' },
    cancelled_by_customer: { label: 'Dibatalkan', description: 'Anda membatalkan pesanan ini' },
    cancelled_by_outlet: { label: 'Dibatalkan Outlet', description: 'Outlet membatalkan pesanan ini' },
    rejected_by_outlet: { label: 'Ditolak Outlet', description: 'Outlet menolak pesanan ini' },
    failed_delivery: { label: 'Gagal Dikirim', description: 'Pengiriman gagal' },
    expired: { label: 'Kadaluarsa', description: 'Pesanan tidak dikonfirmasi dalam batas waktu' },
};

const CANCELLABLE_STATUSES = ['pending_confirmation', 'confirmed', 'preparing'];

export default function TrackPage({ order, found, cancellationReasons = [], canCreateAccount = false, accountPhone, accountName }: Props) {
    const [copied, setCopied] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const cancelForm = useForm({ reason: '', note: '' });
    const [cancelError, setCancelError] = useState<string | null>(null);

    if (!found || !order) {
        return <NotFoundState />;
    }

    const isPickup = order.fulfillment_type === 'pickup';
    const isTerminal = ['completed', 'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'failed_delivery', 'expired'].includes(order.status);
    const isPending = order.status === 'pending_confirmation';
    const isCancellable = CANCELLABLE_STATUSES.includes(order.status);
    const statusConfig = STATUS_LABELS[order.status] ?? { label: order.status, description: '' };
    const trackingUrl = order.tracking_url;

    function handleCopy() {
        navigator.clipboard.writeText(order.recovery_token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function handleShare() {
        const text = `Lacak pesanan Dombi saya:\n${trackingUrl}`;
        if (navigator.share) {
            navigator.share({ text }).catch(() => {});
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }
    }

    const [cancelLoading, setCancelLoading] = useState(false);

    async function handleCancel() {
        if (!cancelForm.data.reason) return;

        setCancelLoading(true);
        cancelForm.clearErrors();
        setCancelError(null);

        try {
            const response = await fetch(`/track/${order.recovery_token}/cancel`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({
                    reason: cancelForm.data.reason,
                    note: cancelForm.data.note || null,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setCancelDialogOpen(false);
                // Reload page to show cancelled status
                window.location.reload();
            } else if (data.errors) {
                cancelForm.setErrors(data.errors);
            } else {
                setCancelError(data.error || 'Gagal membatalkan pesanan.');
            }
        } catch {
            setCancelError('Gagal membatalkan pesanan. Periksa koneksi Anda.');
        } finally {
            setCancelLoading(false);
        }
    }

    return (
        <div className="min-h-dvh bg-surface">
            <Head title={`Pesanan ${order.order_code}`} />
            <OfflineBanner />

            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <a href="/customer/home" className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80" aria-label="Kembali">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </a>
                    <div className="text-center">
                        <div className="text-sm font-semibold text-text">{order.order_code}</div>
                        {order.ordered_at && (
                            <div className="text-[11px] text-text-muted">{formatDate(order.ordered_at)}</div>
                        )}
                    </div>
                    <div className="h-11 w-11" />
                </div>
            </header>

            {/* Content */}
            <main className="mx-auto max-w-lg px-4 pt-4 pb-24">

                {/* Status Badge */}
                <div className="flex items-center justify-center">
                    <span className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1",
                        isTerminal ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    )}>
                        {statusConfig.label}
                    </span>
                </div>

                {/* Confirmation Banner — only for pending orders */}
                {isPending && order.recovery_token && (
                    <div className="mt-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <div className="text-lg font-bold text-emerald-900">Pesanan Berhasil!</div>
                                <div className="text-sm text-emerald-700">Simpan kode di bawah untuk melacak pesanan</div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white border border-emerald-200 p-4">
                            <div className="text-[13px] text-emerald-700 mb-1">Kode Pelacakan Anda</div>
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <div className="text-2xl font-bold tabular-nums tracking-wider text-emerald-900">{order.recovery_token}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="flex h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white active:opacity-80"
                                >
                                    {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    {copied ? 'Tersalin' : 'Salin'}
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 text-xs text-emerald-600 leading-relaxed">
                            <span className="font-semibold">Penting:</span> Kode ini dibutuhkan untuk melacak pesanan tanpa login. Kirim ke diri sendiri atau simpan di tempat aman.
                        </div>

                        <div className="mt-3">
                            <button
                                type="button"
                                onClick={handleShare}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80"
                            >
                                <Share2 className="h-4 w-4" />
                                Kirim Kode ke WhatsApp
                            </button>
                        </div>
                    </div>
                )}

                {/* Tracking Code — for non-pending orders */}
                {!isPending && order.recovery_token && (
                    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100">
                                <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                            </div>
                            <span className="text-[13px] font-semibold text-blue-900">Kode Pelacakan</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 rounded-lg bg-white px-3 py-2.5 border border-blue-200">
                                <div className="text-xl font-bold tabular-nums tracking-wider text-blue-900">{order.recovery_token}</div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="flex h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white active:opacity-80"
                            >
                                {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? 'Tersalin' : 'Salin'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Timeline */}
                <div className="mt-4">
                    <OrderTimeline
                        currentStatus={order.status}
                        histories={order.status_histories}
                        fulfillmentType={order.fulfillment_type}
                    />
                </div>

                {/* Order Items */}
                <div className="mt-4 rounded-2xl border border-border bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-muted">
                            <Package className="h-3.5 w-3.5 text-text-muted" />
                        </div>
                        <span className="text-[13px] text-text-subtle">Item Pesanan</span>
                    </div>
                    <div className="space-y-2">
                        {order.items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                                <div className="min-w-0">
                                    <span className="text-text">{item.product_name}</span>
                                    <span className="ml-1 text-xs text-text-subtle">x{item.quantity}</span>
                                </div>
                                <span className="shrink-0 font-semibold tabular-nums text-text">{formatCurrency(item.subtotal)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 border-t border-border pt-3 space-y-1">
                        <div className="flex items-center justify-between text-xs text-text-muted">
                            <span>Subtotal</span>
                            <span>{formatCurrency(order.subtotal)}</span>
                        </div>
                        {order.delivery_fee > 0 && (
                            <div className="flex items-center justify-between text-xs text-text-muted">
                                <span>Ongkir</span>
                                <span>{formatCurrency(order.delivery_fee)}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between text-sm font-semibold text-text pt-1">
                            <span>Total</span>
                            <span className="tabular-nums">{formatCurrency(order.total)}</span>
                        </div>
                    </div>
                </div>

                {/* Order Info */}
                <div className="mt-4 rounded-2xl border border-border bg-white p-4">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-text-muted">Metode</span>
                            <span className="font-medium text-text">{isPickup ? 'Ambil di Outlet' : 'Kirim ke Alamat'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Pembayaran</span>
                            <span className="font-medium text-text">{order.payment_method === 'cod' ? 'Bayar di Tempat' : order.payment_method}</span>
                        </div>
                        {order.ordered_at && (
                            <div className="flex justify-between">
                                <span className="text-text-muted">Tanggal</span>
                                <span className="font-medium text-text">{formatDate(order.ordered_at)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Outlet Info */}
                {order.outlet && (
                    <div className="mt-4 rounded-2xl border border-border bg-white p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50">
                                <Store className="h-3.5 w-3.5 text-blue-600" />
                            </div>
                            <span className="text-[13px] text-text-subtle">Outlet</span>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                                <Store className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-semibold text-text">{order.outlet.name}</div>
                                {order.outlet.address && (
                                    <div className="mt-0.5 text-xs text-text-muted">{order.outlet.address}</div>
                                )}
                                {order.outlet.operating_hours && (
                                    <div className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                                        <Clock className="h-3 w-3" />
                                        <span>{order.outlet.operating_hours}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* QR Code for pickup */}
                        {isPickup && order.status === 'ready_for_pickup' && (
                            <div className="mt-4 rounded-xl bg-surface-muted p-4 flex flex-col items-center">
                                <QRCodeSVG
                                    value={order.order_code}
                                    size={180}
                                    bgColor="#f4f4f5"
                                    fgColor="#1e40af"
                                    level="M"
                                    marginSize={0}
                                />
                                <div className="mt-2 text-center">
                                    <div className="text-sm font-bold tracking-wider text-blue-700">{order.order_code}</div>
                                    <div className="mt-1 text-[11px] text-text-subtle">Tunjukkan QR ini ke kasir</div>
                                </div>
                            </div>
                        )}

                        {/* Navigation */}
                        {order.outlet.latitude && order.outlet.longitude && (
                            <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${order.outlet.latitude},${order.outlet.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 min-h-[44px] text-sm font-bold text-white active:opacity-80"
                            >
                                <Navigation className="h-4 w-4" />
                                Navigasi ke Outlet
                            </a>
                        )}

                        {/* Contact */}
                        {order.outlet.phone && (
                            <a
                                href={`tel:${order.outlet.phone}`}
                                className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 min-h-[44px] text-sm font-semibold text-blue-700 active:opacity-80"
                            >
                                <Phone className="h-4 w-4" />
                                Hubungi Outlet
                            </a>
                        )}
                    </div>
                )}

                {/* Delivery Address */}
                {!isPickup && order.customer_address && (
                    <div className="mt-4 rounded-2xl border border-border bg-white p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50">
                                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                            </div>
                            <span className="text-[13px] text-text-subtle">Alamat Pengiriman</span>
                        </div>
                        <div className="text-sm font-medium text-text">{order.customer_name}</div>
                        <div className="mt-0.5 text-xs text-text-muted">{order.customer_phone}</div>
                        <div className="mt-1.5 text-xs leading-relaxed text-text">{order.customer_address}</div>
                    </div>
                )}

                {/* Courier */}
                {order.delivery?.courier && (
                    <div className="mt-4 rounded-2xl border border-border bg-white p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50">
                                <Truck className="h-3.5 w-3.5 text-emerald-600" />
                            </div>
                            <span className="text-[13px] text-text-subtle">Kurir</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                                <UserCheck className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div className="text-sm font-semibold text-text">{order.delivery.courier.name}</div>
                        </div>
                    </div>
                )}

                {/* Rejection / Cancellation */}
                {order.status === 'rejected_by_outlet' && order.rejection_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <div className="text-[13px] text-red-600">Pesanan Ditolak Outlet</div>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.rejection_reason}</div>
                        {order.rejection_note && <div className="mt-1 text-xs text-red-700">{order.rejection_note}</div>}
                    </div>
                )}

                {order.status === 'cancelled_by_customer' && order.cancellation_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <div className="text-[13px] text-red-600">Pesanan Dibatalkan</div>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.cancellation_reason}</div>
                        {order.cancellation_note && <div className="mt-1 text-xs text-red-700">{order.cancellation_note}</div>}
                    </div>
                )}

                {order.status === 'cancelled_by_outlet' && order.cancellation_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <div className="text-[13px] text-red-600">Dibatalkan Outlet</div>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.cancellation_reason}</div>
                    </div>
                )}

                {order.status === 'failed_delivery' && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <div className="text-[13px] text-amber-700">Pengiriman Gagal</div>
                        </div>
                        <div className="mt-2 text-sm text-amber-800">Silakan hubungi outlet untuk bantuan.</div>
                    </div>
                )}

                {order.status === 'expired' && (
                    <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-text-muted" />
                            <div className="text-[13px] text-text">Pesanan Kadaluarsa</div>
                        </div>
                        <div className="mt-2 text-sm text-text-muted">Outlet tidak memberikan konfirmasi dalam batas waktu.</div>
                    </div>
                )}

                {/* Cancel Button */}
                {isCancellable && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => setCancelDialogOpen(true)}
                            className="flex h-11 w-full items-center justify-center rounded-xl border border-red-200 text-sm font-semibold text-red-600 active:opacity-80"
                        >
                            Batalkan Pesanan
                        </button>
                        <p className="mt-2 text-center text-[11px] text-text-subtle">
                            Batalkan hanya jika pesanan belum diproses
                        </p>
                    </div>
                )}

                {/* Non-cancellable message */}
                {!isCancellable && !isTerminal && (
                    <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4 text-center">
                        <div className="text-sm text-text-muted">
                            Pesanan sedang diproses dan tidak dapat dibatalkan.
                        </div>
                        {order.outlet?.phone && (
                            <a
                                href={`tel:${order.outlet.phone}`}
                                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600"
                            >
                                <Phone className="h-3.5 w-3.5" />
                                Hubungi Outlet
                            </a>
                        )}
                    </div>
                )}

                {/* Account Promotion */}
                {canCreateAccount && accountPhone && (
                    <AccountPromotionBanner phone={accountPhone} name={accountName} />
                )}

                {/* Branding */}
                <div className="mt-8 text-center">
                    <p className="text-[11px] text-text-subtle">Powered by</p>
                    <p className="text-sm font-bold text-text-muted">Dombi</p>
                </div>
            </main>

            {/* Cancel Dialog */}
            <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} title="Batalkan Pesanan">
                <p className="text-sm text-text-muted">Pesanan yang dibatalkan tidak dapat dipulihkan.</p>

                <div className="mt-4 space-y-2">
                    {cancellationReasons.map((reason: string) => (
                        <button
                            key={reason}
                            type="button"
                            onClick={() => cancelForm.setData('reason', reason)}
                            className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${
                                cancelForm.data.reason === reason
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                    : 'border-border text-text active:opacity-80'
                            }`}
                        >
                            {reason}
                        </button>
                    ))}
                </div>

                {cancelForm.data.reason === 'Lainnya' && (
                    <div className="mt-3">
                        <textarea
                            value={cancelForm.data.note}
                            onChange={(e) => cancelForm.setData('note', e.target.value)}
                            placeholder="Jelaskan alasan pembatalan..."
                            className="min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                        />
                    </div>
                )}

                {cancelForm.errors.reason && <p className="mt-2 text-xs text-red-600">{cancelForm.errors.reason}</p>}
                {cancelForm.errors.note && <p className="mt-1 text-xs text-red-600">{cancelForm.errors.note}</p>}
                {cancelError && <p className="mt-2 text-sm font-medium text-red-600">{cancelError}</p>}

                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setCancelDialogOpen(false)}
                        className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-text active:opacity-80"
                    >
                        Kembali
                    </button>
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={!cancelForm.data.reason || cancelLoading}
                        className="flex h-12 flex-1 items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white active:opacity-80 disabled:bg-surface-muted disabled:text-text-subtle"
                    >
                        {cancelLoading ? 'Membatalkan...' : 'Ya, Batalkan'}
                    </button>
                </div>
            </Dialog>
        </div>
    );
}

function NotFoundState() {
    return (
        <div className="min-h-dvh bg-surface">
            <Head title="Pesanan Tidak Ditemukan" />
            <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-muted">
                    <XCircle className="h-8 w-8 text-text-subtle" />
                </div>
                <h1 className="mt-4 text-lg font-semibold text-text">Pesanan Tidak Ditemukan</h1>
                <p className="mt-2 text-sm text-text-muted">Kode pelacakan tidak valid atau pesanan sudah tidak tersedia.</p>
                <a href="/customer/home" className="mt-6 flex min-h-11 items-center rounded-xl bg-primary px-6 text-sm font-bold text-white active:opacity-80">
                    Kembali ke Beranda
                </a>
            </div>
        </div>
    );
}

function AccountPromotionBanner({ phone, name }: { phone: string; name?: string }) {
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState(name ?? '');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const maskedPhone = phone.replace(/(\d{2})\d+(\d{4})/, '$1••••$2');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await fetch('/customer/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({ phone, name: formName, password, password_confirmation: passwordConfirmation }),
            });

            const data = await response.json();
            if (data.success) {
                window.location.href = data.redirect;
            } else {
                setError(data.error ?? 'Gagal membuat akun.');
            }
        } catch {
            setError('Gagal membuat akun. Periksa koneksi Anda.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[13px] text-emerald-600">Buat Akun</div>
            <div className="mt-2 text-sm text-emerald-800">
                Buat akun untuk melacak pesanan, menyimpan alamat, dan memesan lebih mudah.
            </div>

            {!showForm ? (
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80"
                >
                    Buat Akun Sekarang
                </button>
            ) : (
                <form onSubmit={handleSubmit} className="mt-3 space-y-3">
                    <div>
                        <label className="text-xs font-medium text-emerald-700">Nomor HP (terverifikasi)</label>
                        <div className="mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-text">{maskedPhone}</div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-emerald-700">Nama</label>
                        <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            required
                            minLength={3}
                            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-text focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-emerald-700">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-text focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-emerald-700">Konfirmasi Password</label>
                        <input
                            type="password"
                            value={passwordConfirmation}
                            onChange={(e) => setPasswordConfirmation(e.target.value)}
                            required
                            minLength={8}
                            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-text focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                        />
                    </div>

                    {error && <p className="text-sm font-medium text-red-600">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                    >
                        {loading ? 'Membuat Akun...' : 'Daftar'}
                    </button>
                </form>
            )}
        </div>
    );
}

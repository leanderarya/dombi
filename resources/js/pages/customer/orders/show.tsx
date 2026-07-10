import { Head, Link, router, useForm } from '@inertiajs/react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, Clock, MapPin, Navigation, Package, Phone, RotateCcw, Share2, Store, UserCheck, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import OrderQRCard from '@/components/customer/order-qr-card';
import OrderTimeline from '@/components/customer/order-timeline';
import OfflineBanner from '@/components/shared/offline-banner';
import BottomSheet from '@/components/ui/bottom-sheet';
import Dialog from '@/components/ui/dialog';
import StatusBadge from '@/components/ui/status-badge';
import { useCountdown } from '@/hooks/use-countdown';
import { useOrderCancel, useOrderPay, useOrderReport, useShareTracking } from '@/hooks/use-order-actions';
import { formatCurrency, formatDate } from '@/lib/format';
import { useOrderRecovery } from '@/lib/order-recovery';
import { usePolling } from '@/lib/use-polling';

/* ─── Constants ────────────────────────────────────────────── */

const REPORT_TYPES = [
    { value: 'not_received', label: 'Barang tidak diterima' },
    { value: 'wrong_items', label: 'Barang salah' },
    { value: 'damaged', label: 'Barang rusak/cacat' },
    { value: 'other', label: 'Lainnya' },
];

const REPORT_STATUS_LABELS: Record<string, { label: string; variant: string }> = {
    pending: { label: 'Menunggu Tinjauan', variant: 'warning' },
    investigating: { label: 'Sedang Ditinjau', variant: 'info' },
    resolved: { label: 'Telah Diselesaikan', variant: 'success' },
    rejected: { label: 'Tidak Dapat Diproses', variant: 'danger' },
};

const CANCELLABLE_STATUSES = ['pending_confirmation', 'confirmed', 'preparing'];

const STATUS_GUIDANCE: Record<string, { description: string; nextStep?: string; cta?: { label: string; href?: string; action?: string } }> = {
    pending_confirmation: { description: 'Menunggu outlet mengkonfirmasi pesanan Anda', nextStep: 'Biasanya dikonfirmasi dalam beberapa menit' },
    pending_confirmation_unpaid: { description: 'Menunggu Pembayaran', nextStep: 'Selesaikan pembayaran untuk melanjutkan pesanan' },
    confirmed: { description: 'Pesanan sudah dikonfirmasi oleh outlet', nextStep: 'Outlet sedang menyiapkan pesanan Anda' },
    preparing: { description: 'Pesanan sedang disiapkan', nextStep: 'Pesanan akan segera siap' },
    ready_for_pickup: { description: 'Pesanan sudah siap diambil!', nextStep: 'Silakan ambil di outlet sebelum jam tutup', cta: { label: 'Navigasi ke Outlet', action: 'navigate' } },
    ready_for_pickup_delivery: { description: 'Pesanan sudah siap, menunggu kurir', nextStep: 'Kurir akan segera menjemput dan mengantar ke alamat Anda' },
    completed: { description: 'Pesanan telah selesai', nextStep: 'Terima kasih sudah pesan di Dombi!' },
    rejected_by_outlet: { description: 'Outlet tidak dapat memproses pesanan', nextStep: 'Silakan coba pesan dari outlet lain' },
    cancelled_by_customer: { description: 'Pesanan telah Anda batalkan' },
    cancelled_by_outlet: { description: 'Pesanan dibatalkan oleh outlet', nextStep: 'Silakan coba pesan lagi' },
    failed_delivery: { description: 'Pengiriman gagal', nextStep: 'Silakan hubungi kami untuk bantuan', cta: { label: 'Hubungi WhatsApp', action: 'wa_outlet' } },
    expired: { description: 'Pesanan kadaluarsa', nextStep: 'Outlet tidak konfirmasi dalam batas waktu' },
};

const MAPS_LINK = 'https://www.google.com/maps/dir/?api=1&destination=';
const WA_LINK = 'https://wa.me/';

/* ─── Main ─────────────────────────────────────────────────── */

export default function OrderShow({ order, cancellationReasons = [], isConfirmation = false, activeReport = null, hasRecentReport = false, canReport = false }: any) {
    usePolling(15000);
    const { addOrder } = useOrderRecovery();

    const isTerminal = ['completed', 'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'failed_delivery', 'expired'].includes(order.status);
    const isPickup = order.fulfillment_type === 'pickup';
    const isCancellable = CANCELLABLE_STATUSES.includes(order.status);
    const hasPaymentIssue = order.payment_status === 'failed' || order.payment_status === 'expired';
    const trackingUrl = order.tracking_url ?? (order.recovery_token ? `${window.location.origin}/track/${order.recovery_token}` : null);
    const countdown = useCountdown(order.confirmation_expires_at);

    const { pay, loading: payLoading } = useOrderPay(order.id);
    const { cancel, error: cancelError, setError: setCancelError } = useOrderCancel(order.id, isConfirmation, order.recovery_token, isPickup);
    const { report, error: reportError, setError: setReportError } = useOrderReport(order.id);
    const handleShare = useShareTracking(trackingUrl);

    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelLast4Hp, setCancelLast4Hp] = useState('');
    const [reportSheetOpen, setReportSheetOpen] = useState(false);
    const cancelForm = useForm({ reason: '', note: '' });
    const reportForm = useForm({ type: '', notes: '' });

    useEffect(() => {
        if (isConfirmation) {
window.history.replaceState(null, '', '/customer/orders');
}
    }, [isConfirmation]);

    useEffect(() => {
        if (order.customer_phone && order.order_code) {
addOrder(order.customer_phone, order.order_code);
}
    }, [order.customer_phone, order.order_code, addOrder]);

    const handleCancelSubmit = () => cancel(cancelForm.data.reason, cancelForm.data.note, cancelLast4Hp);
    const handleReportSubmit = () => report(reportForm.data.type, reportForm.data.notes);

    return (
        <div className="min-h-dvh bg-background">
            <Head title={`Pesanan ${order.order_code}`} />
            <OfflineBanner />

            <OrderHeader order={order} isConfirmation={isConfirmation} onShare={trackingUrl ? handleShare : undefined} />

            <main className="mx-auto max-w-lg px-4 pt-4 pb-24">
                {hasPaymentIssue && <PaymentIssueBanner isFailed={order.payment_status === 'failed'} onPay={pay} loading={payLoading} />}

                <StatusBadgeSection order={order} hasPaymentIssue={hasPaymentIssue} isPickup={isPickup} />
                <StatusGuidanceCard order={order} isPickup={isPickup} countdown={countdown} />

                {isPickup && order.status === 'ready_for_pickup' && <OrderQRCard orderCode={order.order_code} />}
                {order.status === 'completed' && <CompletedHero orderId={order.id} />}

                <div className="mt-4">
                    <OrderTimeline currentStatus={order.status} histories={order.status_histories} fulfillmentType={order.fulfillment_type} defaultCollapsed />
                </div>

                <OrderInfoCard order={order} isPickup={isPickup} />

                <StatusBanner order={order} />

                <div className="mt-4">
                    {isCancellable ? (
                        <CancelButton onClick={() => setCancelDialogOpen(true)} />
                    ) : !isTerminal ? (
                        <NonCancellableNotice phone={order.outlet?.phone} />
                    ) : order.status !== 'completed' ? (
                        <ReorderLink orderId={order.id} />
                    ) : null}
                </div>

                {hasRecentReport && activeReport && <ReportStatusCard report={activeReport} />}
                {canReport && <ReportButton onClick={() => setReportSheetOpen(true)} />}

                <BrandingFooter />
            </main>

            <CancelDialog
                open={cancelDialogOpen}
                onClose={() => {
 setCancelDialogOpen(false); setCancelLast4Hp(''); setCancelError(null); 
}}
                reasons={cancellationReasons}
                form={cancelForm}
                last4Hp={cancelLast4Hp}
                onLast4HpChange={setCancelLast4Hp}
                error={cancelError}
                onSubmit={handleCancelSubmit}
                isPickup={isPickup}
                isConfirmation={isConfirmation}
            />

            <ReportSheet
                open={reportSheetOpen}
                onClose={() => {
 setReportSheetOpen(false); setReportError(null); reportForm.reset(); 
}}
                form={reportForm}
                error={reportError}
                onSubmit={handleReportSubmit}
            />
        </div>
    );
}

/* ─── Sub-components ───────────────────────────────────────── */

function OrderHeader({ order, isConfirmation, onShare }: { order: any; isConfirmation: boolean; onShare?: () => void }) {
    return (
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur pt-safe">
            <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                <button
                    type="button"
                    onClick={() => {
                        if (isConfirmation) {
window.location.href = '/customer/orders';
} else if (window.history.length > 1) {
window.history.back();
} else {
window.location.href = '/customer/orders';
}
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80"
                    aria-label="Kembali"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="text-center">
                    <div className="text-sm font-semibold text-text">{order.order_code}</div>
                    {order.ordered_at && <div className="text-[11px] text-text-muted">{formatDate(order.ordered_at)}</div>}
                </div>
                {onShare ? (
                    <button
                        type="button"
                        onClick={onShare}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-emerald-600 active:bg-emerald-50"
                        aria-label="Bagikan lacak pesanan"
                    >
                        <Share2 className="h-5 w-5" />
                    </button>
                ) : (
                    <div className="h-11 w-11" />
                )}
            </div>
        </header>
    );
}

function PaymentIssueBanner({ isFailed, onPay, loading }: { isFailed: boolean; onPay: () => void; loading: boolean }) {
    return (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div>
                    <div className="text-sm font-semibold text-red-800">{isFailed ? 'Pembayaran Gagal' : 'Pembayaran Kadaluarsa'}</div>
                    <div className="mt-1 text-xs text-red-600">{isFailed ? 'Pembayaran tidak berhasil diproses. Silakan coba bayar ulang.' : 'Batas waktu pembayaran telah habis. Silakan coba bayar ulang.'}</div>
                    <button type="button" onClick={onPay} disabled={loading} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-bold text-white active:opacity-80 disabled:opacity-50">
                        {loading ? 'Memproses...' : 'Bayar Ulang'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatusBadgeSection({ order, hasPaymentIssue, isPickup }: { order: any; hasPaymentIssue: boolean; isPickup: boolean }) {
    return (
        <div className="flex items-center justify-center">
            {order.status === 'ready_for_pickup' && !isPickup ? (
                <StatusBadge variant="info">Menunggu Kurir</StatusBadge>
            ) : (
                <StatusBadge status={hasPaymentIssue ? 'payment_failed' : (order.status === 'pending_confirmation' && order.payment_status !== 'paid') ? 'pending_payment' : order.status} />
            )}
        </div>
    );
}

function StatusGuidanceCard({ order, isPickup, countdown }: { order: any; isPickup: boolean; countdown: { minutes: number; seconds: number; expired: boolean; totalSeconds: number } }) {
    const isPendingUnpaid = order.status === 'pending_confirmation' && order.payment_status !== 'paid';
    const isPaymentFailed = order.payment_status === 'failed' || order.payment_status === 'expired';
    const guidanceKey = order.status === 'ready_for_pickup' && !isPickup ? 'ready_for_pickup_delivery' : isPendingUnpaid ? (isPaymentFailed ? 'pending_confirmation_payment_failed' : 'pending_confirmation_unpaid') : order.status;
    const guidance = STATUS_GUIDANCE[guidanceKey];

    if (!guidance) {
return null;
}

    const isPickupReady = order.status === 'ready_for_pickup' && order.outlet?.latitude && order.outlet?.longitude;
    const showCountdown = order.status === 'pending_confirmation' && !isPendingUnpaid && !countdown.expired && countdown.totalSeconds > 0;

    return (
        <div className="mt-3 rounded-xl border border-border bg-white p-3">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs font-semibold text-text">{guidance.description}</div>
                    {showCountdown && (
                        <div className="mt-1 flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-amber-600" />
                            <span className="text-xs font-bold tabular-nums text-amber-700">{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}</span>
                        </div>
                    )}
                    {guidance.nextStep && <div className="mt-0.5 text-[11px] text-text-muted">{guidance.nextStep}</div>}
                </div>
                {guidance.cta && (
                    <div className="shrink-0">
                        {isPickupReady && guidance.cta.action === 'navigate' ? (
                            <a href={`${MAPS_LINK}${order.outlet.latitude},${order.outlet.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white active:opacity-80">
                                <MapPin className="h-3.5 w-3.5" />{guidance.cta.label}
                            </a>
                        ) : guidance.cta.action === 'wa_outlet' && order.outlet?.phone ? (
                            <a href={`${WA_LINK}${order.outlet.phone.replace(/^0/, '62')}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white active:opacity-80">
                                <Phone className="h-3.5 w-3.5" />{guidance.cta.label}
                            </a>
                        ) : guidance.cta.href ? (
                            <Link href={guidance.cta.href} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white active:opacity-80">{guidance.cta.label}</Link>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}

function CompletedHero({ orderId }: { orderId: number }) {
    return (
        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 p-6 text-center">
            <div className="flex justify-center"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"><CheckCircle2 className="h-8 w-8 text-emerald-600" /></div></div>
            <h2 className="mt-4 text-lg font-bold text-text">Pesanan Selesai!</h2>
            <p className="mt-1 text-sm text-text-muted">Terima kasih sudah pesan di Dombi 🎉</p>
            <Link href={`/customer/orders/${orderId}/restore-cart`} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-bold text-white active:opacity-80">
                <RotateCcw className="h-4 w-4" />Pesan Lagi
            </Link>
        </div>
    );
}


function OrderInfoCard({ order, isPickup }: { order: any; isPickup: boolean }) {
    return (
        <div className="mt-4 rounded-xl border border-border bg-white divide-y divide-border/50">
            {/* Items */}
            <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                    <Package className="h-3.5 w-3.5 text-text-subtle" />
                    <span className="text-[11px] text-text-subtle">Pesanan</span>
                </div>
                <div className="space-y-1">
                    {order.items.map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                            <div className="min-w-0">
                                <span className="text-text">{item.product_name}</span>
                                <span className="ml-1 text-[10px] text-text-subtle">x{item.quantity}</span>
                            </div>
                            <span className="shrink-0 font-medium tabular-nums text-text">{formatCurrency(item.subtotal)}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-2 border-t border-border/50 pt-2 space-y-1">
                    <SummaryRow label="Metode" value={isPickup ? 'Ambil di Outlet' : 'Kirim ke Alamat'} />
                    <SummaryRow label="Pembayaran" value={order.payment_method} />
                    {Number(order.delivery_fee) > 0 && <SummaryRow label="Ongkir" value={formatCurrency(order.delivery_fee)} />}
                    <div className="flex items-center justify-between text-xs font-semibold text-text pt-1 border-t border-border/50">
                        <span>Total</span>
                        <span className="tabular-nums">{formatCurrency(order.total)}</span>
                    </div>
                </div>
            </div>

            {/* Outlet */}
            {order.outlet && (
                <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <Store className="h-3.5 w-3.5 text-text-subtle" />
                                <span className="text-xs font-semibold text-text truncate">{order.outlet.name}</span>
                            </div>
                            {order.outlet.address && <div className="mt-0.5 text-[11px] text-text-muted line-clamp-1">{order.outlet.address}</div>}
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                            {order.outlet.latitude && order.outlet.longitude && (
                                <a href={`${MAPS_LINK}${order.outlet.latitude},${order.outlet.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-white active:opacity-80">
                                    <Navigation className="h-3 w-3" />Navigasi
                                </a>
                            )}
                            {order.outlet.phone && (
                                <a href={`${WA_LINK}${order.outlet.phone.replace(/^0/, '62')}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[11px] font-semibold text-text active:opacity-80">
                                    <Phone className="h-3 w-3" />WA
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delivery address */}
            {!isPickup && order.customer_address && (
                <div className="p-3">
                    <div className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-subtle" />
                        <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-xs text-text">{order.customer_address}</div>
                            {order.customer_address_detail && <div className="text-[10px] text-text-muted mt-0.5">{order.customer_address_detail}</div>}
                            {order.latitude && order.longitude && (
                                <a href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-primary active:opacity-80">
                                    <MapPin className="h-3 w-3" />Buka di Maps
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Courier */}
            {order.delivery?.courier && (
                <div className="p-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted"><UserCheck className="h-3.5 w-3.5 text-text-muted" /></div>
                        <div>
                            <div className="text-[10px] text-text-subtle">Kurir</div>
                            <div className="text-xs font-semibold text-text">{order.delivery.courier.name}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Failed delivery */}
            {order.delivery?.failed_reason && (
                <div className="p-3 bg-amber-50">
                    <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700">Pengiriman Gagal: {order.delivery.failed_reason}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className="flex items-center justify-between text-[10px] text-text-muted">
            <span>{label}</span>
            <span className={`font-medium ${accent ? 'text-emerald-600' : 'text-text'}`}>{value}</span>
        </div>
    );
}

function StatusBanner({ order }: { order: any }) {
    const status = order.status;
    const reason = order.rejection_reason ?? order.cancellation_reason;
    const note = order.rejection_note ?? order.cancellation_note;

    if (status === 'rejected_by_outlet' && reason) {
        return <ReasonBanner icon={<XCircle className="h-4 w-4 text-red-500" />} title="Pesanan Ditolak Outlet" reason={reason} note={note} />;
    }

    if (status === 'cancelled_by_customer' && reason) {
        return <ReasonBanner icon={<XCircle className="h-4 w-4 text-red-500" />} title="Pesanan Dibatalkan" reason={reason} note={note} />;
    }

    if (status === 'cancelled_by_outlet' && reason) {
        return <ReasonBanner icon={<XCircle className="h-4 w-4 text-red-500" />} title="Dibatalkan Outlet" reason={reason} note={note} />;
    }

    if (status === 'expired') {
        return (
            <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4">
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-text-muted" /><div className="text-[13px] text-text">Pesanan Kadaluarsa</div></div>
                <div className="mt-2 text-sm text-text-muted">Outlet tidak memberikan konfirmasi dalam batas waktu.</div>
                <Link href={`/customer/orders/${order.id}/restore-cart`} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-white active:opacity-80">
                    <RotateCcw className="h-4 w-4" />Pesan Ulang
                </Link>
            </div>
        );
    }

    return null;
}

function ReasonBanner({ icon, title, reason, note }: { icon: React.ReactNode; title: string; reason: string; note?: string }) {
    return (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">{icon}<div className="text-[13px] text-red-600">{title}</div></div>
            <div className="mt-2 text-sm font-semibold text-red-800">{reason}</div>
            {note && <div className="mt-1 text-xs text-red-700">{note}</div>}
        </div>
    );
}

function CancelButton({ onClick }: { onClick: () => void }) {
    return (
        <>
            <button type="button" onClick={onClick} className="flex h-10 w-full items-center justify-center rounded-lg border border-red-200 text-xs font-semibold text-red-600 active:opacity-80">Batalkan Pesanan</button>
            <p className="mt-1.5 text-center text-[10px] text-text-subtle">Hanya jika pesanan belum diproses</p>
        </>
    );
}

function NonCancellableNotice({ phone }: { phone?: string }) {
    return (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2">
            <span className="text-[11px] text-text-muted">Pesanan diproses, tidak dapat dibatalkan</span>
            {phone && (
                <a href={`${WA_LINK}${phone.replace(/^0/, '62')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-primary active:opacity-80">
                    <Phone className="h-3 w-3" />WA Outlet
                </a>
            )}
        </div>
    );
}

function ReorderLink({ orderId }: { orderId: number }) {
    return (
        <Link href={`/customer/orders/${orderId}/restore-cart`} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-bold text-white active:opacity-80">
            <RotateCcw className="h-3.5 w-3.5" />Pesan Lagi
        </Link>
    );
}

function ReportStatusCard({ report }: { report: any }) {
    const status = REPORT_STATUS_LABELS[report.status] ?? { label: report.status, variant: 'neutral' };
    const isResolved = report.status === 'resolved' || report.status === 'rejected';
    const variantClass = status.variant === 'success' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : status.variant === 'danger' ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : status.variant === 'info' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';

    return (
        <div className="mt-4 rounded-xl border border-border bg-white p-4">
            <div className="flex items-center justify-between">
                <span className="text-[13px] text-text-subtle">Laporan Anda</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${variantClass}`}>{status.label}</span>
            </div>
            <div className="mt-1.5 text-sm text-text">{report.type_label}</div>
            {isResolved && report.resolution_notes && (
                <div className="mt-2 rounded-lg bg-surface-muted p-3 text-xs text-text-muted"><span className="font-semibold text-text">Resolusi: </span>{report.resolution_notes}</div>
            )}
            {!isResolved && <div className="mt-2 text-xs text-text-subtle">Kami akan mengabari Anda setelah laporan ditinjau.</div>}
        </div>
    );
}

function ReportButton({ onClick }: { onClick: () => void }) {
    return (
        <div className="mt-4">
            <button type="button" onClick={onClick} className="flex h-11 w-full items-center justify-center rounded-lg border border-border text-sm font-semibold text-text active:opacity-80">
                <AlertTriangle className="mr-2 h-4 w-4 text-text-muted" />Laporkan Masalah
            </button>
        </div>
    );
}

function BrandingFooter() {
    return (
        <div className="mt-8 text-center">
            <p className="text-[11px] text-text-subtle">Powered by</p>
            <p className="text-sm font-bold text-text-muted">Dombi</p>
        </div>
    );
}

function CancelDialog({ open, onClose, reasons, form, last4Hp, onLast4HpChange, error, onSubmit, isPickup, isConfirmation }: any) {
    return (
        <Dialog open={open} onClose={onClose} title="Batalkan Pesanan">
            <p className="text-sm text-text-muted">Pesanan yang dibatalkan tidak dapat dipulihkan.</p>
            {isPickup && isConfirmation && (
                <div className="mt-4">
                    <label className="text-xs font-medium text-text-subtle">4 digit terakhir nomor HP</label>
                    <input type="text" inputMode="numeric" pattern="\d{4}" maxLength={4} value={last4Hp} onChange={(e) => onLast4HpChange(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Contoh: 1234" className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm text-text tabular-nums placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20" />
                    <p className="mt-1 text-[11px] text-text-subtle">Untuk keamanan pembatalan pesanan pickup</p>
                </div>
            )}
            <div className="mt-4 space-y-2">
                {reasons.map((reason: string) => (
                    <button key={reason} type="button" onClick={() => form.setData('reason', reason)} className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${form.data.reason === reason ? 'border-primary bg-primary-light text-primary' : 'border-border text-text active:opacity-80'}`}>{reason}</button>
                ))}
            </div>
            {form.data.reason === 'Lainnya' && (
                <div className="mt-3">
                    <textarea value={form.data.note} onChange={(e) => form.setData('note', e.target.value)} placeholder="Jelaskan alasan pembatalan..." className="min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20" />
                </div>
            )}
            {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
            {form.errors.reason && <p className="mt-2 text-xs text-red-600">{form.errors.reason}</p>}
            {form.errors.note && <p className="mt-1 text-xs text-red-600">{form.errors.note}</p>}
            <div className="mt-4 flex gap-2">
                <button type="button" onClick={onClose} className="flex h-12 flex-1 items-center justify-center rounded-lg border border-border text-sm font-semibold text-text active:opacity-80">Kembali</button>
                <button type="button" onClick={onSubmit} disabled={!form.data.reason || form.processing || (isPickup && isConfirmation && last4Hp.length !== 4)} className="flex h-12 flex-1 items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white active:opacity-80 disabled:bg-surface-muted disabled:text-text-subtle">{form.processing ? 'Membatalkan...' : 'Ya, Batalkan'}</button>
            </div>
        </Dialog>
    );
}

function ReportSheet({ open, onClose, form, error, onSubmit }: any) {
    return (
        <BottomSheet open={open} onClose={onClose} title="Laporkan Masalah">
            <p className="text-sm text-text-muted">Pilih jenis masalah yang Anda alami.</p>
            <div className="mt-4 space-y-2">
                {REPORT_TYPES.map((type) => (
                    <button key={type.value} type="button" onClick={() => form.setData('type', type.value)} className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${form.data.type === type.value ? 'border-primary bg-primary-light text-primary' : 'border-border text-text active:opacity-80'}`}>{type.label}</button>
                ))}
            </div>
            <div className="mt-3">
                <textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} placeholder="Jelaskan masalah Anda (opsional)..." className="min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
            <button type="button" onClick={onSubmit} disabled={!form.data.type || form.processing} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80 disabled:bg-surface-muted disabled:text-text-subtle">{form.processing ? 'Mengirim...' : 'Kirim Laporan'}</button>
        </BottomSheet>
    );
}

import { Head, Link, useForm } from '@inertiajs/react';
import { AlertCircle, AlertTriangle, Phone, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import OrderHeader from '@/components/customer/order/order-header';
import OrderInfoCard from '@/components/customer/order/order-info-card';
import RefundStatusCard from '@/components/customer/order/refund-status-card';
import StatusGuidanceCard from '@/components/customer/order/status-guidance-card';
import TerminalStatusCards from '@/components/customer/order/terminal-status-cards';
import OrderQRCard from '@/components/customer/order-qr-card';
import OrderTimeline from '@/components/customer/order-timeline';
import OfflineBanner from '@/components/shared/offline-banner';
import BottomSheet from '@/components/ui/bottom-sheet';
import Dialog from '@/components/ui/dialog';
import {
    useOrderCancel,
    useOrderPay,
    useOrderReport,
} from '@/hooks/use-order-actions';
import { useOrderRecovery } from '@/lib/order-recovery';
import {
    getBadgeProps,
    getPaymentIssue,
    isCancellable,
    isTerminal,
    normalizeOrder,
} from '@/lib/order-status';
import { usePolling } from '@/lib/use-polling';
import { whatsAppDefaultMessage, waLinkWithText } from '@/lib/whatsapp-message';

/* ─── Constants ────────────────────────────────────────────── */

const REPORT_TYPES = [
    { value: 'not_received', label: 'Barang tidak diterima' },
    { value: 'wrong_items', label: 'Barang salah' },
    { value: 'damaged', label: 'Barang rusak/cacat' },
    { value: 'other', label: 'Lainnya' },
];

const REPORT_STATUS_LABELS: Record<string, { label: string; variant: string }> =
    {
        pending: { label: 'Menunggu Tinjauan', variant: 'warning' },
        investigating: { label: 'Sedang Ditinjau', variant: 'info' },
        resolved: { label: 'Telah Diselesaikan', variant: 'success' },
        rejected: { label: 'Tidak Dapat Diproses', variant: 'danger' },
    };

/* ─── Main ─────────────────────────────────────────────────── */

export default function OrderShow({
    order,
    cancellationReasons = [],
    isConfirmation = false,
    activeReport = null,
    hasRecentReport = false,
    canReport = false,
    refund = null,
}: any) {
    const isTerminalOrder = isTerminal(order.status);
    const isCancellableOrder = isCancellable(order.status);
    const paymentIssue = getPaymentIssue(order.payment_status);
    const norm = normalizeOrder(order);

    // Poll selagi pesanan aktif (belum terminal) supaya status segar.
    // Berhenti saat isTerminalOrder — status akhir tak berubah.
    // enabled=false memicu cleanup efek poll (clearInterval) di dalam hook.
    usePolling(15000, [], !isTerminalOrder);
    const { addOrder } = useOrderRecovery();

    const isPickup = order.fulfillment_type === 'pickup';
    const trackingUrl =
        order.tracking_url ??
        (order.recovery_token
            ? `${window.location.origin}/track/${order.recovery_token}`
            : null);

    const { pay, loading: payLoading } = useOrderPay(order.id);
    const {
        cancel,
        error: cancelError,
        setError: setCancelError,
    } = useOrderCancel(
        order.id,
        isConfirmation,
        order.recovery_token,
        isPickup,
    );
    const {
        report,
        error: reportError,
        setError: setReportError,
    } = useOrderReport(order.id);
    const cancelForm = useForm({ reason: '', note: '' });
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelLast4Hp, setCancelLast4Hp] = useState('');
    const [reportSheetOpen, setReportSheetOpen] = useState(false);
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

    const handleCancelSubmit = () =>
        cancel(cancelForm.data.reason, cancelForm.data.note, cancelLast4Hp);
    const handleReportSubmit = () =>
        report(reportForm.data.type, reportForm.data.notes);

    return (
        <div className="min-h-dvh bg-background">
            <Head title={`Pesanan ${order.order_code}`} />
            <OfflineBanner />

            <OrderHeader
                orderCode={order.order_code}
                orderedAt={order.ordered_at}
                trackingUrl={trackingUrl}
                isConfirmation={isConfirmation}
            />

            <main className="mx-auto max-w-lg space-y-5 px-4 pt-4 pb-24">
                {paymentIssue && (
                    <PaymentIssueBanner
                        isFailed={paymentIssue.isFailed}
                        onPay={pay}
                        loading={payLoading}
                    />
                )}

                <StatusGuidanceCard
                    status={order.status}
                    paymentStatus={order.payment_status}
                    isPickup={isPickup}
                    confirmationExpiresAt={order.confirmation_expires_at}
                    outletPhone={order.outlet?.phone}
                    outletLatitude={order.outlet?.latitude}
                    outletLongitude={order.outlet?.longitude}
                    outletName={order.outlet?.name}
                    customerName={order.customer_name}
                    orderCode={order.order_code}
                    {...getBadgeProps({
                        status: order.status,
                        paymentStatus: order.payment_status,
                        isPickup,
                    })}
                />

                {refund && <RefundStatusCard refund={refund} />}

                <TerminalStatusCards
                    order={norm}
                    onCancelCTA={() => {
                        window.location.href = `/customer/orders/${order.id}/restore-cart`;
                    }}
                />

                {isPickup && order.status === 'ready_for_pickup' && (
                    <OrderQRCard orderCode={order.order_code} />
                )}
                <OrderTimeline
                    currentStatus={order.status}
                    histories={order.status_histories}
                    fulfillmentType={order.fulfillment_type}
                    defaultCollapsed
                />

                {order.status === 'completed' && (
                    <Link
                        href={`/customer/orders/${order.id}/restore-cart`}
                        className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-6 text-xs font-bold text-white active:opacity-80"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Beli Lagi
                    </Link>
                )}

                <OrderInfoCard
                    items={order.items}
                    subtotal={order.subtotal}
                    deliveryFee={order.delivery_fee ?? 0}
                    total={order.total}
                    isPickup={isPickup}
                    paymentMethod={order.payment_method}
                    outlet={order.outlet}
                    delivery={order.delivery}
                    customerAddress={order.customer_address}
                    customerAddressDetail={order.customer_address_detail}
                    latitude={order.latitude}
                    longitude={order.longitude}
                    fulfillmentType={order.fulfillment_type}
                    customerName={order.customer_name}
                    orderCode={order.order_code}
                    status={order.status}
                />

                {isCancellableOrder ? (
                    <CancelButton onClick={() => setCancelDialogOpen(true)} />
                ) : !isTerminalOrder ? (
                    <NonCancellableNotice
                        phone={order.outlet?.phone}
                        outletName={order.outlet?.name}
                        customerName={order.customer_name}
                        orderCode={order.order_code}
                        status={order.status}
                        fulfillmentType={order.fulfillment_type}
                    />
                ) : null}

                {hasRecentReport && activeReport && (
                    <ReportStatusCard report={activeReport} />
                )}
                {canReport && (
                    <ReportButton onClick={() => setReportSheetOpen(true)} />
                )}

                <BrandingFooter />
            </main>

            <CancelDialog
                open={cancelDialogOpen}
                onClose={() => {
                    setCancelDialogOpen(false);
                    setCancelLast4Hp('');
                    setCancelError(null);
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
                    setReportSheetOpen(false);
                    setReportError(null);
                    reportForm.reset();
                }}
                form={reportForm}
                error={reportError}
                onSubmit={handleReportSubmit}
            />
        </div>
    );
}

/* ─── Sub-components ───────────────────────────────────────── */

function PaymentIssueBanner({
    isFailed,
    onPay,
    loading,
}: {
    isFailed: boolean;
    onPay: () => void;
    loading: boolean;
}) {
    return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div>
                    <div className="text-sm font-semibold text-red-800">
                        {isFailed
                            ? 'Pembayaran Gagal'
                            : 'Pembayaran Kadaluarsa'}
                    </div>
                    <div className="mt-1 text-xs text-red-600">
                        {isFailed
                            ? 'Pembayaran tidak berhasil diproses. Silakan coba bayar ulang.'
                            : 'Batas waktu pembayaran telah habis. Silakan coba bayar ulang.'}
                    </div>
                    <button
                        type="button"
                        onClick={onPay}
                        disabled={loading}
                        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                    >
                        {loading ? 'Memproses...' : 'Bayar Ulang'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function CancelButton({ onClick }: { onClick: () => void }) {
    return (
        <>
            <button
                type="button"
                onClick={onClick}
                className="flex h-10 w-full items-center justify-center rounded-lg border border-red-200 text-xs font-semibold text-red-600 active:opacity-80"
            >
                Batalkan Pesanan
            </button>
            <p className="mt-1.5 text-center text-[10px] text-text-subtle">
                Hanya jika pesanan belum diproses
            </p>
        </>
    );
}

function NonCancellableNotice({
    phone,
    outletName,
    customerName,
    orderCode,
    status,
    fulfillmentType,
}: {
    phone?: string;
    outletName?: string;
    customerName?: string;
    orderCode?: string;
    status?: string;
    fulfillmentType?: string;
}) {
    const href = phone
        ? waLinkWithText(
              phone,
              whatsAppDefaultMessage({
                  order_code: orderCode ?? '',
                  status: status ?? '',
                  fulfillment_type: fulfillmentType ?? '',
                  customer_name: customerName,
                  outlet_name: outletName,
              }),
          )
        : null;

    return (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2">
            <span className="text-[11px] text-text-muted">
                Pesanan diproses, tidak dapat dibatalkan
            </span>
            {href && (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                        e.preventDefault();
                        window.open(href, '_blank', 'noopener,noreferrer');
                    }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary active:opacity-80"
                >
                    <Phone className="h-3 w-3" />
                    WA Outlet
                </a>
            )}
        </div>
    );
}

function ReportStatusCard({ report }: { report: any }) {
    const status = REPORT_STATUS_LABELS[report.status] ?? {
        label: report.status,
        variant: 'neutral',
    };
    const isResolved =
        report.status === 'resolved' || report.status === 'rejected';
    const variantClass =
        status.variant === 'success'
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
            : status.variant === 'danger'
              ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
              : status.variant === 'info'
                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';

    return (
        <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center justify-between">
                <span className="text-[13px] text-text-subtle">
                    Laporan Anda
                </span>
                <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${variantClass}`}
                >
                    {status.label}
                </span>
            </div>
            <div className="mt-1.5 text-sm text-text">{report.type_label}</div>
            {isResolved && report.resolution_notes && (
                <div className="mt-2 rounded-lg bg-surface-muted p-3 text-xs text-text-muted">
                    <span className="font-semibold text-text">Resolusi: </span>
                    {report.resolution_notes}
                </div>
            )}
            {!isResolved && (
                <div className="mt-2 text-xs text-text-subtle">
                    Kami akan mengabari Anda setelah laporan ditinjau.
                </div>
            )}
        </div>
    );
}

function ReportButton({ onClick }: { onClick: () => void }) {
    return (
        <div className="mt-4">
            <button
                type="button"
                onClick={onClick}
                className="flex h-11 w-full items-center justify-center rounded-lg border border-border text-sm font-semibold text-text active:opacity-80"
            >
                <AlertTriangle className="mr-2 h-4 w-4 text-text-muted" />
                Laporkan Masalah
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

function CancelDialog({
    open,
    onClose,
    reasons,
    form,
    last4Hp,
    onLast4HpChange,
    error,
    onSubmit,
    isPickup,
    isConfirmation,
}: any) {
    return (
        <Dialog open={open} onClose={onClose} title="Batalkan Pesanan">
            <p className="text-sm text-text-muted">
                Pesanan yang dibatalkan tidak dapat dipulihkan.
            </p>
            {isPickup && isConfirmation && (
                <div>
                    <label className="text-xs font-medium text-text-subtle">
                        4 digit terakhir nomor HP
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d{4}"
                        maxLength={4}
                        value={last4Hp}
                        onChange={(e) =>
                            onLast4HpChange(
                                e.target.value.replace(/\D/g, '').slice(0, 4),
                            )
                        }
                        placeholder="Contoh: 1234"
                        className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm text-text tabular-nums placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                    <p className="mt-1 text-[11px] text-text-subtle">
                        Untuk keamanan pembatalan pesanan pickup
                    </p>
                </div>
            )}
            <div className="mt-4 space-y-2">
                {reasons.map((reason: string) => (
                    <button
                        key={reason}
                        type="button"
                        onClick={() => form.setData('reason', reason)}
                        className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${form.data.reason === reason ? 'border-primary bg-primary-light text-primary' : 'border-border text-text active:opacity-80'}`}
                    >
                        {reason}
                    </button>
                ))}
            </div>
            {form.data.reason === 'Lainnya' && (
                <div className="mt-3">
                    <textarea
                        value={form.data.note}
                        onChange={(e) => form.setData('note', e.target.value)}
                        placeholder="Jelaskan alasan pembatalan..."
                        className="min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                </div>
            )}
            {error && (
                <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
            )}
            {form.errors.reason && (
                <p className="mt-2 text-xs text-red-600">
                    {form.errors.reason}
                </p>
            )}
            {form.errors.note && (
                <p className="mt-1 text-xs text-red-600">{form.errors.note}</p>
            )}
            <div className="mt-4 flex gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-12 flex-1 items-center justify-center rounded-lg border border-border text-sm font-semibold text-text active:opacity-80"
                >
                    Kembali
                </button>
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={
                        !form.data.reason ||
                        form.processing ||
                        (isPickup && isConfirmation && last4Hp.length !== 4)
                    }
                    className="flex h-12 flex-1 items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white active:opacity-80 disabled:bg-surface-muted disabled:text-text-subtle"
                >
                    {form.processing ? 'Membatalkan...' : 'Ya, Batalkan'}
                </button>
            </div>
        </Dialog>
    );
}

function ReportSheet({ open, onClose, form, error, onSubmit }: any) {
    return (
        <BottomSheet open={open} onClose={onClose} title="Laporkan Masalah">
            <p className="text-sm text-text-muted">
                Pilih jenis masalah yang Anda alami.
            </p>
            <div className="mt-4 space-y-2">
                {REPORT_TYPES.map((type) => (
                    <button
                        key={type.value}
                        type="button"
                        onClick={() => form.setData('type', type.value)}
                        className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${form.data.type === type.value ? 'border-primary bg-primary-light text-primary' : 'border-border text-text active:opacity-80'}`}
                    >
                        {type.label}
                    </button>
                ))}
            </div>
            <div className="mt-3">
                <textarea
                    value={form.data.notes}
                    onChange={(e) => form.setData('notes', e.target.value)}
                    placeholder="Jelaskan masalah Anda (opsional)..."
                    className="min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
            </div>
            {error && (
                <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
            )}
            <button
                type="button"
                onClick={onSubmit}
                disabled={!form.data.type || form.processing}
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80 disabled:bg-surface-muted disabled:text-text-subtle"
            >
                {form.processing ? 'Mengirim...' : 'Kirim Laporan'}
            </button>
        </BottomSheet>
    );
}

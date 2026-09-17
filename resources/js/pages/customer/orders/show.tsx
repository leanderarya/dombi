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
import { Button } from '@/components/ui/button';
import Dialog from '@/components/ui/dialog';
import Notice from '@/components/ui/notice';
import StatusBadge from '@/components/ui/status-badge';
import type { BadgeVariant } from '@/components/ui/status-badge';
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
                status={order.status}
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
                    reorderHref={`/customer/orders/${order.id}/restore-cart`}
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
                    <Button asChild variant="primary" className="w-full">
                        <Link
                            href={`/customer/orders/${order.id}/restore-cart`}
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Beli Lagi
                        </Link>
                    </Button>
                )}

                <OrderInfoCard
                    items={order.items}
                    subtotal={order.subtotal}
                    deliveryFee={order.delivery_fee ?? 0}
                    paymentFee={order.payment_fee ?? 0}
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
        <Notice
            variant="block"
            tone="danger"
            icon={AlertCircle}
            title={isFailed ? 'Pembayaran Gagal' : 'Pembayaran Kadaluarsa'}
            action={
                <Button
                    type="button"
                    variant="danger"
                    className="w-full"
                    onClick={onPay}
                    disabled={loading}
                >
                    {loading ? 'Memproses...' : 'Bayar Ulang'}
                </Button>
            }
        >
            {isFailed
                ? 'Pembayaran tidak berhasil diproses. Silakan coba bayar ulang.'
                : 'Batas waktu pembayaran telah habis. Silakan coba bayar ulang.'}
        </Notice>
    );
}

function CancelButton({ onClick }: { onClick: () => void }) {
    return (
        <div>
            <Button
                type="button"
                variant="outline"
                className="w-full border-danger-border text-danger-text"
                onClick={onClick}
            >
                Batalkan Pesanan
            </Button>
            <p className="mt-1.5 text-center text-[10px] text-text-subtle">
                Hanya jika pesanan belum diproses
            </p>
        </div>
    );
}

/**
 * Deliberately not `Notice`. The kanvas strip is the same shape — quiet
 * neutral, no border — but this one carries a working WhatsApp link on the
 * right, and `Notice`'s strip only renders children plus a trailing icon.
 * Forcing it in would drop the link. Geometry and colours match the strip
 * token for token instead.
 */
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
        <div className="flex items-center justify-between gap-2.5 rounded-control bg-surface-muted px-3 py-2.5 text-caption text-text-muted">
            <span className="min-w-0">
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
                    className="flex shrink-0 items-center gap-1 font-semibold text-primary active:opacity-80"
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

    return (
        <div className="rounded-card border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
                <span className="text-caption text-text-subtle">
                    Laporan Anda
                </span>
                <StatusBadge variant={status.variant as BadgeVariant}>
                    {status.label}
                </StatusBadge>
            </div>
            <div className="mt-1.5 text-sm text-text">{report.type_label}</div>
            {isResolved && report.resolution_notes && (
                <div className="mt-2 rounded-control bg-surface-muted p-3 text-xs text-text-muted">
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
            <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={onClick}
            >
                <AlertTriangle className="mr-2 h-4 w-4 text-text-muted" />
                Laporkan Masalah
            </Button>
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
                        className={`flex min-h-11 w-full items-center rounded-control border px-4 text-left text-sm font-medium transition-all ${form.data.reason === reason ? 'border-primary bg-primary-light text-primary' : 'border-border text-text active:opacity-80'}`}
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
                        className="min-h-20 w-full rounded-control border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                </div>
            )}
            {error && (
                <p className="mt-2 text-sm font-medium text-danger-text">
                    {error}
                </p>
            )}
            {form.errors.reason && (
                <p className="mt-2 text-xs text-danger-text">
                    {form.errors.reason}
                </p>
            )}
            {form.errors.note && (
                <p className="mt-1 text-xs text-danger-text">
                    {form.errors.note}
                </p>
            )}
            <div className="mt-4 flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                >
                    Kembali
                </Button>
                <Button
                    type="button"
                    variant="danger"
                    className="flex-1"
                    onClick={onSubmit}
                    disabled={
                        !form.data.reason ||
                        form.processing ||
                        (isPickup && isConfirmation && last4Hp.length !== 4)
                    }
                >
                    {form.processing ? 'Membatalkan...' : 'Ya, Batalkan'}
                </Button>
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
                        className={`flex min-h-11 w-full items-center rounded-control border px-4 text-left text-sm font-medium transition-all ${form.data.type === type.value ? 'border-primary bg-primary-light text-primary' : 'border-border text-text active:opacity-80'}`}
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
                    className="min-h-20 w-full rounded-control border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
            </div>
            {error && (
                <p className="mt-2 text-sm font-medium text-danger-text">
                    {error}
                </p>
            )}
            <Button
                type="button"
                variant="primary"
                className="mt-4 w-full"
                onClick={onSubmit}
                disabled={!form.data.type || form.processing}
            >
                {form.processing ? 'Mengirim...' : 'Kirim Laporan'}
            </Button>
        </BottomSheet>
    );
}

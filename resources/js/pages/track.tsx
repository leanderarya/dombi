import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Clock, Copy, MapPin, MessageCircle, Package, Phone, RotateCcw, Share2, Store, Truck, UserCheck, XCircle, CheckCircle2, Circle, Navigation, ChevronRight, QrCode, ExternalLink, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/format';

type HistoryItem = {
    to_status: string;
    notes?: string | null;
    created_at?: string | null;
};

type TrackOrder = {
    id: number;
    order_code: string;
    tracking_url: string;
    status: string;
    fulfillment_type: string;
    total: number;
    ordered_at?: string;
    outlet?: { name: string; address?: string; phone?: string; operating_hours?: string; latitude?: number; longitude?: number };
    items: { product_name: string; quantity: number; subtotal: number }[];
    status_histories: HistoryItem[];
    delivery?: { courier?: { name: string; phone?: string } };
    customer_address?: string;
    rejection_reason?: string;
    rejection_note?: string;
    cancellation_reason?: string;
    cancellation_note?: string;
};

type Props = {
    order: TrackOrder | null;
    found: boolean;
    notifications?: { id: number; title: string; message: string; time_ago: string }[];
    canCreateAccount?: boolean;
    accountPhone?: string;
    accountName?: string;
};

// Customer-friendly status labels
const PICKUP_STATUSES: Record<string, { label: string; description: string; icon: typeof Clock }> = {
    pending_confirmation: { label: 'Menunggu Diproses', description: 'Outlet belum memproses pesanan Anda', icon: Clock },
    confirmed: { label: 'Pesanan Diterima', description: 'Outlet sedang menyiapkan pesanan Anda', icon: CheckCircle2 },
    preparing: { label: 'Sedang Disiapkan', description: 'Pesanan Anda sedang disiapkan', icon: Package },
    ready_for_pickup: { label: 'Siap Diambil', description: 'Pesanan sudah siap, silakan ambil di outlet', icon: QrCode },
    completed: { label: 'Sudah Diambil', description: 'Pesanan selesai', icon: CheckCircle2 },
};

const DELIVERY_STATUSES: Record<string, { label: string; description: string; icon: typeof Clock }> = {
    pending_confirmation: { label: 'Menunggu Diproses', description: 'Outlet belum memproses pesanan Anda', icon: Clock },
    confirmed: { label: 'Pesanan Diterima', description: 'Outlet sedang menyiapkan pesanan Anda', icon: CheckCircle2 },
    preparing: { label: 'Sedang Disiapkan', description: 'Pesanan Anda sedang disiapkan', icon: Package },
    ready_for_pickup: { label: 'Menunggu Kurir', description: 'Pesanan siap, menunggu kurir mengambil', icon: Clock },
    picked_up: { label: 'Kurir Mengambil', description: 'Kurir sudah mengambil pesanan dari outlet', icon: UserCheck },
    delivering: { label: 'Sedang Diantar', description: 'Pesanan sedang dalam perjalanan ke Anda', icon: Truck },
    completed: { label: 'Sudah Diterima', description: 'Pesanan sudah diterima', icon: CheckCircle2 },
};

const TERMINAL_STATUSES: Record<string, { label: string; description: string; icon: typeof XCircle; color: string }> = {
    cancelled_by_customer: { label: 'Dibatalkan', description: 'Anda membatalkan pesanan ini', icon: XCircle, color: 'red' },
    cancelled_by_outlet: { label: 'Dibatalkan Outlet', description: 'Outlet membatalkan pesanan ini', icon: XCircle, color: 'red' },
    rejected_by_outlet: { label: 'Ditolak Outlet', description: 'Outlet menolak pesanan ini', icon: XCircle, color: 'red' },
    failed_delivery: { label: 'Gagal Dikirim', description: 'Pengiriman gagal, silakan hubungi outlet', icon: AlertTriangle, color: 'amber' },
    expired: { label: 'Kadaluarsa', description: 'Pesanan tidak dikonfirmasi dalam batas waktu', icon: Clock, color: 'amber' },
};

export default function TrackPage({ order, found, notifications = [], canCreateAccount = false, accountPhone, accountName }: Props) {
    const [copied, setCopied] = useState(false);

    if (!found || !order) {
        return <NotFoundState />;
    }

    const isPickup = order.fulfillment_type === 'pickup';
    const isTerminal = Object.keys(TERMINAL_STATUSES).includes(order.status);
    const isReadyForPickup = order.status === 'ready_for_pickup';
    const isDelivering = order.status === 'delivering';
    const isCompleted = order.status === 'completed';

    const statusConfig = isTerminal
        ? TERMINAL_STATUSES[order.status]
        : isPickup
            ? PICKUP_STATUSES[order.status]
            : DELIVERY_STATUSES[order.status];

    const steps = isPickup
        ? Object.entries(PICKUP_STATUSES).filter(([key]) => key !== 'completed' || isCompleted)
        : Object.entries(DELIVERY_STATUSES).filter(([key]) => key !== 'completed' || isCompleted);

    const currentStepIndex = steps.findIndex(([key]) => key === order.status);
    const effectiveIndex = currentStepIndex < 0 ? 0 : currentStepIndex;

    const historyMap = new Map<string, HistoryItem>();
    for (const h of order.status_histories) {
        if (!historyMap.has(h.to_status)) {
            historyMap.set(h.to_status, h);
        }
    }

    const trackingUrl = order.tracking_url;
    const shareText = `Lacak pesanan Dombi saya:\n${trackingUrl}`;

    function copyTrackingLink() {
        navigator.clipboard.writeText(trackingUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function shareTrackingLink() {
        if (navigator.share) {
            navigator.share({ text: shareText }).catch(() => {});
            return;
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    }

    function shareViaWhatsApp() {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    }

    return (
        <div className="min-h-dvh bg-[#fbf9f7]">
            <Head title={`Lacak ${order.order_code}`} />

            {/* Header */}
            <Header orderCode={order.order_code} isPickup={isPickup} orderedAt={order.ordered_at} />

            {/* Content */}
            <main className={cn(
                "mx-auto max-w-lg px-4 py-4",
                isTerminal ? "pb-[calc(8rem+env(safe-area-inset-bottom))]" : "pb-[calc(4rem+env(safe-area-inset-bottom))]"
            )}>
                {/* Hero Banner - Context Dependent */}
                {isPickup ? (
                    <PickupHero
                        status={order.status}
                        orderCode={order.order_code}
                        statusConfig={statusConfig}
                        isTerminal={isTerminal}
                    />
                ) : (
                    <DeliveryHero
                        status={order.status}
                        statusConfig={statusConfig}
                        courier={order.delivery?.courier}
                        isTerminal={isTerminal}
                    />
                )}

                {/* Progress Timeline */}
                <Timeline
                    steps={steps}
                    currentStepIndex={effectiveIndex}
                    historyMap={historyMap}
                    isPickup={isPickup}
                    isTerminal={isTerminal}
                />

                {/* Pickup Info Card */}
                {isPickup && order.outlet && (
                    <PickupInfoCard
                        outlet={order.outlet}
                        orderCode={order.order_code}
                        isReadyForPickup={isReadyForPickup}
                    />
                )}

                {/* Delivery Info Card */}
                {!isPickup && (
                    <DeliveryInfoCard
                        courier={order.delivery?.courier}
                        customerAddress={order.customer_address}
                        isDelivering={isDelivering}
                    />
                )}

                {/* Order Summary */}
                <OrderSummary
                    items={order.items}
                    total={order.total}
                    orderCode={order.order_code}
                    orderedAt={order.ordered_at}
                    fulfillmentType={order.fulfillment_type}
                />

                {/* Tracking Link */}
                <TrackingLinkCard
                    trackingUrl={trackingUrl}
                    copied={copied}
                    onCopy={copyTrackingLink}
                    onShare={shareTrackingLink}
                    onWhatsApp={shareViaWhatsApp}
                />

                {/* Terminal State Info */}
                {isTerminal && (
                    <TerminalStateInfo
                        status={order.status}
                        statusConfig={statusConfig}
                        rejectionReason={order.rejection_reason}
                        rejectionNote={order.rejection_note}
                        cancellationReason={order.cancellation_reason}
                        cancellationNote={order.cancellation_note}
                    />
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

            {/* Sticky Bottom Bar */}
            {!isTerminal && (
                <StickyBottomBar
                    isPickup={isPickup}
                    status={order.status}
                    statusConfig={statusConfig}
                    outletPhone={order.outlet?.phone}
                />
            )}

            {/* Terminal CTA */}
            {isTerminal && (
                <TerminalCTA
                    orderId={order.id}
                    isCancelled={order.status.includes('cancelled')}
                    isRejected={order.status === 'rejected_by_outlet'}
                />
            )}
        </div>
    );
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function NotFoundState() {
    return (
        <div className="min-h-dvh bg-[#fbf9f7]">
            <Head title="Lacak Pesanan" />
            <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-muted">
                    <XCircle className="h-8 w-8 text-text-subtle" />
                </div>
                <h1 className="mt-4 text-lg font-semibold text-text">Pesanan Tidak Ditemukan</h1>
                <p className="mt-2 text-sm text-text-muted">Kode pelacakan tidak valid atau pesanan sudah tidak tersedia.</p>
                <a href="/customer/home" className="mt-6 flex min-h-11 items-center rounded-xl bg-primary px-6 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-primary-hover">
                    Kembali ke Beranda
                </a>
            </div>
        </div>
    );
}

function Header({ orderCode, isPickup, orderedAt }: { orderCode: string; isPickup: boolean; orderedAt?: string }) {
    return (
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                <a href="/customer/home" className="flex h-10 w-10 items-center justify-center rounded-xl text-text-muted transition-colors active:bg-surface-muted">
                    <ArrowLeft className="h-5 w-5" />
                </a>
                <div className="text-center">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text">{orderCode}</span>
                        <span className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            isPickup ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                        )}>
                            {isPickup ? 'Pickup' : 'Delivery'}
                        </span>
                    </div>
                    {orderedAt && (
                        <div className="text-[11px] text-text-subtle">{formatDate(orderedAt)}</div>
                    )}
                </div>
                <div className="h-10 w-10" />
            </div>
        </header>
    );
}

function PickupHero({ status, orderCode, statusConfig, isTerminal }: {
    status: string;
    orderCode: string;
    statusConfig: any;
    isTerminal: boolean;
}) {
    if (isTerminal) return null;

    if (status === 'ready_for_pickup') {
        return (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white p-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                        <QrCode className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <div className="text-xs font-medium text-text-subtle">Siap Diambil</div>
                        <div className="mt-0.5 text-lg font-bold text-text">Pesanan Sudah Siap</div>
                    </div>
                </div>

                {/* QR Code — encodes plain order_code, not URL */}
                <div className="mt-4 rounded-xl bg-surface-muted p-4 flex flex-col items-center">
                    <QRCodeSVG
                        value={orderCode}
                        size={200}
                        bgColor="#f4f4f5"
                        fgColor="#1e40af"
                        level="M"
                        marginSize={0}
                    />
                    <div className="mt-3 text-center">
                        <div className="text-lg font-bold tracking-wider text-blue-700">{orderCode}</div>
                        <div className="mt-1 text-[11px] text-text-subtle">Tunjukkan QR ini ke kasir</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-4 rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <statusConfig.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                    <div className="text-sm font-semibold text-text">{statusConfig.label}</div>
                    <div className="text-xs text-text-muted">{statusConfig.description}</div>
                </div>
            </div>
        </div>
    );
}

function DeliveryHero({ status, statusConfig, courier, isTerminal }: {
    status: string;
    statusConfig: any;
    courier?: { name: string; phone?: string };
    isTerminal: boolean;
}) {
    if (isTerminal) return null;

    if (status === 'delivering' && courier) {
        return (
            <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                        <Truck className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="text-xs font-medium text-emerald-100">Sedang Diantar</div>
                        <div className="mt-0.5 text-lg font-bold">{courier.name}</div>
                    </div>
                </div>
                {courier.phone && (
                    <a
                        href={`tel:${courier.phone}`}
                        className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/20 py-3 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/30"
                    >
                        <Phone className="h-4 w-4" />
                        Hubungi Kurir
                    </a>
                )}
            </div>
        );
    }

    return (
        <div className="mt-4 rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                    <statusConfig.icon className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                    <div className="text-sm font-semibold text-text">{statusConfig.label}</div>
                    <div className="text-xs text-text-muted">{statusConfig.description}</div>
                </div>
            </div>
        </div>
    );
}

function Timeline({ steps, currentStepIndex, historyMap, isPickup, isTerminal }: {
    steps: [string, any][];
    currentStepIndex: number;
    historyMap: Map<string, HistoryItem>;
    isPickup: boolean;
    isTerminal: boolean;
}) {
    const accentColor = isPickup ? 'blue' : 'emerald';

    return (
        <div className="mt-4 rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center gap-2 mb-4">
                <div className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-lg",
                    isPickup ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                )}>
                    {isPickup ? <Store className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">
                    {isPickup ? 'Status Pengambilan' : 'Status Pengiriman'}
                </span>
            </div>

            <div className="space-y-0">
                {steps.map(([key, config], index) => {
                    const isCompleted = index < currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    const isLast = index === steps.length - 1;
                    const history = historyMap.get(key);
                    const Icon = config.icon;

                    return (
                        <div key={key} className="relative flex gap-3 pb-5 last:pb-0">
                            {!isLast && (
                                <div className={cn(
                                    "absolute left-[11px] top-6 bottom-0 w-px",
                                    isCompleted ? `bg-${accentColor}-200` : "bg-border"
                                )} />
                            )}
                            <div className="relative shrink-0 pt-0.5">
                                {isCompleted ? (
                                    <div className={cn(
                                        "flex h-6 w-6 items-center justify-center rounded-full",
                                        `bg-${accentColor}-600`
                                    )}>
                                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                    </div>
                                ) : isCurrent ? (
                                    <div className={cn(
                                        "flex h-6 w-6 items-center justify-center rounded-full ring-2",
                                        `bg-${accentColor}-100 ring-${accentColor}-500`
                                    )}>
                                        <Icon className={cn("h-3 w-3", `text-${accentColor}-600`)} />
                                    </div>
                                ) : (
                                    <div className="flex h-6 w-6 items-center justify-center">
                                        <Circle className="h-3 w-3 text-text-subtle" />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className={cn(
                                            "text-sm font-semibold",
                                            isCurrent ? `text-${accentColor}-700` : isCompleted ? "text-text" : "text-text-subtle"
                                        )}>
                                            {config.label}
                                        </div>
                                        {isCurrent && config.description && (
                                            <div className="mt-0.5 text-xs text-text-muted">{config.description}</div>
                                        )}
                                    </div>
                                    {history?.created_at && (
                                        <span className={cn(
                                            "shrink-0 text-xs tabular-nums",
                                            isCurrent ? `font-semibold text-${accentColor}-700` : "text-text-subtle"
                                        )}>
                                            {formatTime(history.created_at)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PickupInfoCard({ outlet, orderCode, isReadyForPickup }: {
    outlet: { name: string; address?: string; phone?: string; operating_hours?: string; latitude?: number; longitude?: number };
    orderCode: string;
    isReadyForPickup: boolean;
}) {
    const openMaps = () => {
        if (outlet.latitude && outlet.longitude) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${outlet.latitude},${outlet.longitude}`, '_blank');
        } else if (outlet.address) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(outlet.address)}`, '_blank');
        }
    };

    return (
        <div className="mt-4 rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50">
                    <Store className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">Ambil di Outlet</span>
            </div>

            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <Store className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                    <div className="text-sm font-semibold text-text">{outlet.name}</div>
                    {outlet.address && (
                        <div className="mt-0.5 text-xs text-text-muted">{outlet.address}</div>
                    )}
                    {outlet.operating_hours && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                            <Clock className="h-3 w-3" />
                            <span>{outlet.operating_hours}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation Button */}
            <button
                type="button"
                onClick={openMaps}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-blue-700"
            >
                <Navigation className="h-4 w-4" />
                Navigasi ke Outlet
            </button>

            {/* Pickup Instructions */}
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
                <div className="text-xs font-semibold text-blue-800 mb-2">Cara Mengambil:</div>
                <ol className="space-y-1.5 text-xs text-blue-700">
                    <li className="flex items-start gap-2">
                        <span className="font-semibold text-blue-800">1.</span>
                        <span>Datang ke outlet yang tertera di atas</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="font-semibold text-blue-800">2.</span>
                        <span>Tunjukkan <span className="font-bold">QR code</span> di atas ke kasir</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="font-semibold text-blue-800">3.</span>
                        <span>Ambil pesanan Anda</span>
                    </li>
                </ol>
            </div>

            {/* Contact Outlet */}
            {outlet.phone && (
                <a
                    href={`tel:${outlet.phone}`}
                    className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-sm font-semibold text-blue-700 transition-all active:scale-[0.98] active:bg-blue-100"
                >
                    <Phone className="h-4 w-4" />
                    Hubungi Outlet
                </a>
            )}
        </div>
    );
}

function DeliveryInfoCard({ courier, customerAddress, isDelivering }: {
    courier?: { name: string; phone?: string };
    customerAddress?: string;
    isDelivering: boolean;
}) {
    return (
        <div className="mt-4 rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50">
                    <Navigation className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">Kirim ke Alamat</span>
            </div>

            {customerAddress && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 mb-3">
                    <div className="text-xs font-semibold text-emerald-800 mb-1">Alamat Pengiriman:</div>
                    <div className="text-xs text-emerald-700">{customerAddress}</div>
                </div>
            )}

            {courier && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                        <UserCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                        <div className="text-xs font-medium text-text-muted">Kurir</div>
                        <div className="text-sm font-semibold text-text">{courier.name}</div>
                    </div>
                    {courier.phone && (
                        <a
                            href={`tel:${courier.phone}`}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-200 text-emerald-700 transition-colors active:bg-emerald-300"
                        >
                            <Phone className="h-4 w-4" />
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

function OrderSummary({ items, total, orderCode, orderedAt, fulfillmentType }: {
    items: { product_name: string; quantity: number; subtotal: number }[];
    total: number;
    orderCode: string;
    orderedAt?: string;
    fulfillmentType: string;
}) {
    return (
        <div className="mt-4 rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-muted">
                    <Package className="h-3.5 w-3.5 text-text-muted" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">Ringkasan Pesanan</span>
            </div>

            {/* Order Info */}
            <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                <div>
                    <span className="text-text-muted">Kode</span>
                    <div className="font-semibold text-text">{orderCode}</div>
                </div>
                {orderedAt && (
                    <div>
                        <span className="text-text-muted">Tanggal</span>
                        <div className="font-semibold text-text">{formatDate(orderedAt)}</div>
                    </div>
                )}
                <div>
                    <span className="text-text-muted">Metode</span>
                    <div className="font-semibold text-text">{fulfillmentType === 'pickup' ? 'Ambil di Outlet' : 'Kirim ke Alamat'}</div>
                </div>
            </div>

            {/* Items */}
            <div className="space-y-2 border-t border-border pt-3">
                {items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                        <div className="min-w-0">
                            <span className="text-text">{item.product_name}</span>
                            <span className="ml-1 text-xs text-text-subtle">x{item.quantity}</span>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-text">{formatCurrency(item.subtotal)}</span>
                    </div>
                ))}
            </div>

            <div className="mt-3 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-text">Total</span>
                    <span className="text-lg font-bold tabular-nums text-primary">{formatCurrency(total)}</span>
                </div>
            </div>
        </div>
    );
}

function TrackingLinkCard({ trackingUrl, copied, onCopy, onShare, onWhatsApp }: {
    trackingUrl: string;
    copied: boolean;
    onCopy: () => void;
    onShare: () => void;
    onWhatsApp: () => void;
}) {
    return (
        <div className="mt-4 rounded-2xl border border-border bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle mb-2">Bagikan Link Pelacakan</div>
            <div className="rounded-lg bg-surface-muted px-3 py-2 text-xs font-semibold tabular-nums text-text break-all">
                {trackingUrl}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                    type="button"
                    onClick={onCopy}
                    className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-bold text-text transition-all active:scale-[0.98] active:bg-surface-muted"
                >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? 'Tersalin' : 'Salin'}
                </button>
                <button
                    type="button"
                    onClick={onShare}
                    className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-bold text-white transition-all active:scale-[0.98] active:bg-primary-hover"
                >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                </button>
                <button
                    type="button"
                    onClick={onWhatsApp}
                    className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 transition-all active:scale-[0.98] active:bg-emerald-100"
                >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WA
                </button>
            </div>
        </div>
    );
}

function TerminalStateInfo({ status, statusConfig, rejectionReason, rejectionNote, cancellationReason, cancellationNote }: {
    status: string;
    statusConfig: any;
    rejectionReason?: string;
    rejectionNote?: string;
    cancellationReason?: string;
    cancellationNote?: string;
}) {
    const color = statusConfig.color || 'red';
    const borderColor = `border-${color}-200`;
    const bgColor = `bg-${color}-50`;
    const textColor = `text-${color}-800`;
    const labelColor = `text-${color}-600`;

    return (
        <div className={cn("mt-4 rounded-2xl border p-4", borderColor, bgColor)}>
            <div className="flex items-center gap-2 mb-2">
                <statusConfig.icon className={cn("h-4 w-4", labelColor)} />
                <span className={cn("text-[11px] font-bold uppercase tracking-wider", labelColor)}>
                    {statusConfig.label}
                </span>
            </div>
            <div className={cn("text-sm font-semibold", textColor)}>{statusConfig.description}</div>

            {status === 'rejected_by_outlet' && rejectionReason && (
                <div className="mt-2 text-xs text-red-700">
                    <span className="font-medium">Alasan: </span>{rejectionReason}
                    {rejectionNote && <span> - {rejectionNote}</span>}
                </div>
            )}

            {status.includes('cancelled') && cancellationReason && (
                <div className="mt-2 text-xs text-red-700">
                    <span className="font-medium">Alasan: </span>{cancellationReason}
                    {cancellationNote && <span> - {cancellationNote}</span>}
                </div>
            )}
        </div>
    );
}

function StickyBottomBar({ isPickup, status, statusConfig, outletPhone }: {
    isPickup: boolean;
    status: string;
    statusConfig: any;
    outletPhone?: string;
}) {
    const accentColor = isPickup ? 'blue' : 'emerald';

    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur">
            <div className="mx-auto max-w-lg">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <div className="text-[11px] font-medium text-text-subtle uppercase">Status</div>
                        <div className={cn("text-sm font-semibold", `text-${accentColor}-700`)}>
                            {statusConfig.label}
                        </div>
                    </div>
                    {isPickup && status === 'ready_for_pickup' && outletPhone && (
                        <a
                            href={`tel:${outletPhone}`}
                            className={cn(
                                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98]",
                                `bg-${accentColor}-100 text-${accentColor}-700`
                            )}
                        >
                            <Phone className="h-4 w-4" />
                            Hubungi Outlet
                        </a>
                    )}
                    {!isPickup && status === 'delivering' && (
                        <div className={cn(
                            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold",
                            `bg-${accentColor}-100 text-${accentColor}-700`
                        )}>
                            <Truck className="h-4 w-4" />
                            Dalam Perjalanan
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function TerminalCTA({ orderId, isCancelled, isRejected }: {
    orderId: number;
    isCancelled: boolean;
    isRejected: boolean;
}) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur">
            <div className="mx-auto max-w-lg space-y-2">
                {!isCancelled && !isRejected && (
                    <a
                        href={`/customer/orders/${orderId}/restore-cart`}
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-primary-hover"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Pesan Lagi
                    </a>
                )}
                <Link
                    href="/customer/home"
                    className="flex min-h-10 w-full items-center justify-center text-xs font-bold uppercase tracking-wide text-text-muted transition-colors active:text-text"
                >
                    Kembali ke Beranda
                </Link>
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
                body: JSON.stringify({
                    phone,
                    name: formName,
                    password,
                    password_confirmation: passwordConfirmation,
                }),
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
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Buat Akun</div>
            <div className="mt-2 text-sm text-emerald-800">
                Buat akun untuk melacak pesanan, menyimpan alamat, dan memesan lebih mudah.
            </div>

            {!showForm ? (
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-emerald-700"
                >
                    Buat Akun Sekarang
                </button>
            ) : (
                <form onSubmit={handleSubmit} className="mt-3 space-y-3">
                    <div>
                        <label className="text-xs font-medium text-emerald-700">Nomor HP (terverifikasi)</label>
                        <div className="mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700">
                            {maskedPhone}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-emerald-700">Nama</label>
                        <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            required
                            minLength={3}
                            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
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
                            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
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
                            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                        />
                    </div>

                    {error && (
                        <p className="text-sm font-medium text-red-600">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-emerald-700 disabled:opacity-50"
                    >
                        {loading ? 'Membuat Akun...' : 'Daftar'}
                    </button>
                </form>
            )}
        </div>
    );
}

function formatTime(value: string): string {
    try {
        return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '-';
    }
}

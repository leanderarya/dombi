import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowLeft, Clock, Copy, MessageCircle, Package, RotateCcw, Share2, Truck, UserCheck, XCircle, CheckCircle2, Circle } from 'lucide-react';
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
    outlet?: { name: string };
    items: { product_name: string; quantity: number; subtotal: number }[];
    status_histories: HistoryItem[];
    delivery?: { courier?: { name: string } };
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

const TIMELINE_STEPS = [
    { key: 'pending_confirmation', label: 'Pesanan Dibuat', icon: Clock },
    { key: 'confirmed', label: 'Outlet Menerima Pesanan', icon: Package },
    { key: 'preparing', label: 'Pesanan Sedang Disiapkan', icon: Package },
    { key: 'ready_for_pickup', label: 'Pesanan Siap', icon: Package },
    { key: 'picked_up', label: 'Kurir Mengambil Pesanan', icon: UserCheck },
    { key: 'delivering', label: 'Dalam Perjalanan', icon: Truck },
    { key: 'completed', label: 'Pesanan Selesai', icon: CheckCircle2 },
];

export default function TrackPage({ order, found, notifications = [], canCreateAccount = false, accountPhone, accountName }: Props) {
    const [copied, setCopied] = useState(false);

    if (!found || !order) {
        return (
            <div className="min-h-dvh bg-[#fbf9f7] text-slate-950">
                <Head title="Lacak Pesanan" />
                <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
                    <XCircle className="h-12 w-12 text-slate-300" />
                    <h1 className="mt-4 text-lg font-semibold text-slate-900">Pesanan Tidak Ditemukan</h1>
                    <p className="mt-2 text-sm text-slate-500">Kode pelacakan tidak valid atau pesanan sudah tidak tersedia.</p>
                    <a href="/customer/home" className="mt-6 flex min-h-11 items-center rounded-lg bg-emerald-600 px-5 text-sm font-bold text-white active:bg-emerald-700">
                        Kembali ke Beranda
                    </a>
                </div>
            </div>
        );
    }

    const isCancelled = order.status === 'cancelled_by_customer' || order.status === 'cancelled_by_outlet';
    const isRejected = order.status === 'rejected_by_outlet';
    const isFailed = order.status === 'failed_delivery';
    const isExpired = order.status === 'expired';
    const isCompleted = order.status === 'completed';
    const isTerminal = isCompleted || isCancelled || isRejected || isFailed || isExpired;

    const terminalLabel = isRejected
        ? 'Ditolak Outlet'
        : order.status === 'cancelled_by_customer'
            ? 'Dibatalkan Customer'
            : order.status === 'cancelled_by_outlet'
                ? 'Dibatalkan Outlet'
                : isExpired
                    ? 'Konfirmasi Kadaluarsa'
                    : 'Pengiriman Gagal';

    const steps = isTerminal
        ? [TIMELINE_STEPS[0], { key: order.status, label: terminalLabel, icon: XCircle }]
        : getStepsForFulfillment(order.fulfillment_type);

    const currentIndex = isTerminal ? 1 : steps.findIndex((s) => s.key === order.status);
    const effectiveIndex = currentIndex < 0 ? 0 : currentIndex;

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
        <div className="min-h-dvh bg-[#fbf9f7] text-slate-950">
            <Head title={`Lacak ${order.order_code}`} />

            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <a href="/customer/home" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100">
                        <ArrowLeft className="h-5 w-5" />
                    </a>
                    <div className="text-center">
                        <div className="text-sm font-semibold text-slate-900">{order.order_code}</div>
                        {order.ordered_at && (
                            <div className="text-[11px] text-slate-500">{formatDate(order.ordered_at)}</div>
                        )}
                    </div>
                    <div className="h-10 w-10" />
                </div>
            </header>

            {/* Content */}
            <main className={`mx-auto max-w-lg px-4 py-4 ${isTerminal ? 'pb-[calc(8rem+env(safe-area-inset-bottom))]' : 'pb-[calc(2rem+env(safe-area-inset-bottom))]'}`}>
                {/* Status Badge */}
                <div className="flex items-center justify-center">
                    <StatusBadge status={order.status} />
                </div>

                {/* Public Tracking Link */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Link Pelacakan Publik</div>
                    <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold tabular-nums text-slate-700 break-all">
                        {trackingUrl}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={copyTrackingLink}
                            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 active:bg-slate-50"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            {copied ? 'Tersalin' : 'Salin'}
                        </button>
                        <button
                            type="button"
                            onClick={shareTrackingLink}
                            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white active:bg-emerald-700"
                        >
                            <Share2 className="h-3.5 w-3.5" />
                            Share
                        </button>
                        <button
                            type="button"
                            onClick={shareViaWhatsApp}
                            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 active:bg-emerald-100"
                        >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WA
                        </button>
                    </div>
                </div>

                {/* Timeline */}
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status Pesanan</div>
                    <div className="mt-4 space-y-0">
                        {steps.map((step, index) => {
                            const isCompleted = index < effectiveIndex;
                            const isCurrent = index === effectiveIndex;
                            const history = historyMap.get(step.key);
                            const isLast = index === steps.length - 1;
                            const Icon = step.icon;

                            return (
                                <div key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                                    {!isLast && (
                                        <div className={`absolute left-[11px] top-6 bottom-0 w-px ${isCompleted ? 'bg-emerald-200' : 'bg-slate-200'}`} />
                                    )}
                                    <div className="relative shrink-0 pt-0.5">
                                        {isCompleted ? (
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                            </div>
                                        ) : isCurrent ? (
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 ring-2 ring-emerald-500">
                                                <Icon className="h-3 w-3 text-emerald-600" />
                                            </div>
                                        ) : (
                                            <div className="flex h-6 w-6 items-center justify-center">
                                                <Circle className="h-3 w-3 text-slate-300" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1 pt-0.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className={`text-sm font-semibold ${isCurrent ? 'text-emerald-700' : isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                                                {step.label}
                                            </div>
                                            {history?.created_at && (
                                                <span className={`shrink-0 text-xs tabular-nums ${isCurrent ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
                                                    {formatTime(history.created_at)}
                                                </span>
                                            )}
                                        </div>
                                        {history?.notes && (
                                            <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{history.notes}</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Rejection Reason */}
                {isRejected && order.rejection_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-red-600">Alasan Ditolak</div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.rejection_reason}</div>
                        {order.rejection_note && (
                            <div className="mt-1 text-xs text-red-700">{order.rejection_note}</div>
                        )}
                    </div>
                )}

                {/* Cancellation Reason */}
                {isCancelled && order.cancellation_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-red-600">Alasan Dibatalkan</div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.cancellation_reason}</div>
                        {order.cancellation_note && (
                            <div className="mt-1 text-xs text-red-700">{order.cancellation_note}</div>
                        )}
                    </div>
                )}

                {/* Expired Reason */}
                {isExpired && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Pesanan Kadaluarsa</div>
                        <div className="mt-2 text-sm text-slate-700">Outlet tidak memberikan konfirmasi dalam batas waktu yang ditentukan.</div>
                    </div>
                )}

                {/* Delivery Info */}
                {order.outlet && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pengiriman</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{order.outlet.name}</div>
                        {order.delivery?.courier && (
                            <div className="mt-1 text-xs text-slate-500">Kurir: {order.delivery.courier.name}</div>
                        )}
                        {order.customer_address && (
                            <div className="mt-3 border-t border-slate-100 pt-3">
                                <div className="text-xs font-medium text-slate-500">Alamat Pengiriman</div>
                                <div className="mt-1 text-xs text-slate-700">{order.customer_address}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* Order Summary */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ringkasan Pesanan</div>
                    <div className="mt-3 space-y-2">
                        {order.items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                                <div className="min-w-0">
                                    <span className="text-slate-900">{item.product_name}</span>
                                    <span className="ml-1 text-xs text-slate-400">x{item.quantity}</span>
                                </div>
                                <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatCurrency(item.subtotal)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 border-t border-slate-100 pt-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-900">Total</span>
                            <span className="text-base font-bold tabular-nums text-emerald-700">{formatCurrency(order.total)}</span>
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                {notifications.length > 0 && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Riwayat Notifikasi</div>
                        <div className="mt-3 space-y-3">
                            {notifications.map((notification) => (
                                <div key={notification.id} className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
                                        <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-slate-900">{notification.title}</div>
                                        <div className="mt-0.5 text-xs text-slate-500">{notification.message}</div>
                                        <div className="mt-1 text-[10px] text-slate-400">{notification.time_ago}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Account Promotion */}
                {canCreateAccount && accountPhone && (
                    <AccountPromotionBanner phone={accountPhone} name={accountName} />
                )}

                {/* Dombi branding */}
                <div className="mt-8 text-center">
                    <p className="text-[11px] text-slate-400">Powered by</p>
                    <p className="text-sm font-bold text-slate-600">Dombi</p>
                </div>
            </main>

            {/* Sticky Reorder CTA for terminal orders */}
            {isTerminal && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-100 bg-white px-4 pb-[env(safe-area-inset-bottom)] pt-3">
                    <div className="mx-auto max-w-lg space-y-2">
                        <a
                            href={`/customer/orders/${order.id}/restore-cart`}
                            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-bold text-white active:bg-emerald-800"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Pesan Lagi
                        </a>
                        <Link
                            href="/customer/home"
                            className="flex min-h-10 w-full items-center justify-center text-xs font-bold uppercase tracking-wide text-slate-500 active:text-slate-700"
                        >
                            Kembali ke Beranda
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const labels: Record<string, string> = {
        pending: 'Menunggu Konfirmasi',
        pending_confirmation: 'Menunggu Konfirmasi',
        confirmed: 'Diterima Outlet',
        preparing: 'Sedang Disiapkan',
        ready_for_pickup: 'Siap Diambil',
        picked_up: 'Sudah Diambil Kurir',
        delivering: 'Dalam Perjalanan',
        completed: 'Selesai',
        cancelled: 'Dibatalkan',
        cancelled_by_customer: 'Dibatalkan Customer',
        cancelled_by_outlet: 'Dibatalkan Outlet',
        rejected_by_outlet: 'Ditolak Outlet',
        failed: 'Gagal',
        failed_delivery: 'Pengiriman Gagal',
        expired: 'Kadaluarsa',
    };

    const tones: Record<string, string> = {
        pending: 'bg-amber-50 text-amber-800 ring-amber-200',
        pending_confirmation: 'bg-amber-50 text-amber-800 ring-amber-200',
        confirmed: 'bg-blue-50 text-blue-800 ring-blue-200',
        preparing: 'bg-orange-50 text-orange-800 ring-orange-200',
        ready_for_pickup: 'bg-purple-50 text-purple-800 ring-purple-200',
        picked_up: 'bg-blue-50 text-blue-800 ring-blue-200',
        delivering: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
        completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
        cancelled: 'bg-red-50 text-red-800 ring-red-200',
        cancelled_by_customer: 'bg-red-50 text-red-800 ring-red-200',
        cancelled_by_outlet: 'bg-red-50 text-red-800 ring-red-200',
        rejected_by_outlet: 'bg-red-50 text-red-800 ring-red-200',
        failed: 'bg-red-50 text-red-800 ring-red-200',
        failed_delivery: 'bg-red-50 text-red-800 ring-red-200',
        expired: 'bg-slate-50 text-slate-800 ring-slate-200',
    };

    return (
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${tones[status] ?? 'bg-slate-50 text-slate-800 ring-slate-200'}`}>
            {labels[status] ?? status}
        </span>
    );
}

function getStepsForFulfillment(fulfillmentType: string) {
    if (fulfillmentType === 'pickup') {
        return [
            TIMELINE_STEPS[0],
            TIMELINE_STEPS[1],
            TIMELINE_STEPS[2],
            TIMELINE_STEPS[3],
            TIMELINE_STEPS[6],
        ];
    }
    return TIMELINE_STEPS;
}

function formatTime(value: string): string {
    try {
        return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '-';
    }
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
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Buat Akun</div>
            <div className="mt-2 text-sm text-emerald-800">
                Buat akun untuk melacak pesanan, menyimpan alamat, dan memesan lebih mudah.
            </div>

            {!showForm ? (
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white active:bg-emerald-700"
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
                        className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white active:bg-emerald-700 disabled:opacity-50"
                    >
                        {loading ? 'Membuat Akun...' : 'Daftar'}
                    </button>
                </form>
            )}
        </div>
    );
}

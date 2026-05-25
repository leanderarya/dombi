import { Head, Link, useForm } from '@inertiajs/react';
import { useState } from 'react';
import OrderStatusChip from '@/components/owner/order-status-chip';
import OwnerBottomNav from '@/components/owner/owner-bottom-nav';
import OfflineBanner from '@/components/offline-banner';
import OwnerLayout from '@/layouts/owner-layout';
import { formatDate } from '@/lib/format';

const resolutionOptions = [
    {
        value: 'retry_delivery',
        label: 'Retry Delivery',
        description: 'Assign kurir baru dan lanjutkan pengiriman.',
        inventoryEffect: 'Reserved stock tetap aktif',
        inventoryColor: 'text-blue-700 bg-blue-50',
        ctaLabel: 'Assign New Courier',
        destructive: false,
    },
    {
        value: 'returned_to_outlet',
        label: 'Return to Outlet',
        description: 'Barang kembali ke outlet, menunggu proses berikutnya.',
        inventoryEffect: 'Reserved stock tetap aktif',
        inventoryColor: 'text-amber-700 bg-amber-50',
        ctaLabel: 'Return to Outlet',
        destructive: false,
    },
    {
        value: 'cancelled_and_released',
        label: 'Cancel & Release Stock',
        description: 'Batalkan order. Reserved stock akan dilepas ke inventory.',
        inventoryEffect: 'Stock akan dilepas (DESTRUCTIVE)',
        inventoryColor: 'text-red-700 bg-red-50',
        ctaLabel: 'Cancel Order',
        destructive: true,
    },
];

export default function ResolveDelivery({ delivery, retryCount }: any) {
    return (
        <>
            <div className="hidden lg:block">
                <OwnerLayout><DesktopResolve delivery={delivery} retryCount={retryCount} /></OwnerLayout>
            </div>
            <div className="lg:hidden">
                <MobileResolve delivery={delivery} retryCount={retryCount} />
            </div>
        </>
    );
}

function MobileResolve({ delivery, retryCount }: any) {
    const order = delivery.order;
    const form = useForm({ resolution: '', resolution_notes: '' });
    const [confirmDestructive, setConfirmDestructive] = useState(false);

    const selectedOption = resolutionOptions.find((o) => o.value === form.data.resolution);
    const isDestructive = selectedOption?.destructive ?? false;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (isDestructive && !confirmDestructive) {
            setConfirmDestructive(true);
            return;
        }
        form.post(`/owner/deliveries/${delivery.id}/resolve`);
    }

    return (
        <div className="min-h-dvh bg-slate-50 text-slate-900">
            <Head title="Resolve Delivery" />
            <OfflineBanner />

            {/* Header */}
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
                <Link href={`/owner/deliveries/${delivery.id}`} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 active:bg-slate-100">
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </Link>
                <span className="text-sm font-bold text-slate-900">Resolve Incident</span>
                <div className="h-9 w-9" />
            </header>

            <main className="px-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
                {/* Incident Summary */}
                <section className="mt-3 rounded-lg border border-red-200 bg-white p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-red-600">Failed Delivery</div>
                    <div className="mt-2 space-y-1.5 text-xs">
                        <Row label="Reason" value={delivery.failed_reason ?? 'Unknown'} bold />
                        <Row label="Courier" value={delivery.courier?.name ?? '-'} />
                        <Row label="Outlet" value={order.outlet?.name ?? '-'} />
                        <Row label="Attempt" value={`${retryCount > 0 ? ordinal(retryCount) + ' Retry' : '1st Attempt'}`} />
                        <Row label="Failed At" value={delivery.updated_at ? formatDate(delivery.updated_at) : '-'} />
                        <Row label="Customer" value={order.customer_name} />
                    </div>
                </section>

                {/* Resolution Options */}
                <form onSubmit={handleSubmit}>
                    <section className="mt-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resolution Path</div>
                        <div className="mt-2 space-y-2">
                            {resolutionOptions.map((opt) => {
                                const isSelected = form.data.resolution === opt.value;
                                return (
                                    <label
                                        key={opt.value}
                                        className={`block cursor-pointer rounded-lg border p-3 transition-all duration-150 active:scale-[0.98] ${
                                            isSelected
                                                ? opt.destructive ? 'border-red-300 bg-red-50/50' : 'border-emerald-300 bg-emerald-50/30'
                                                : 'border-slate-200 bg-white'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${isSelected ? opt.destructive ? 'border-red-600 bg-red-600' : 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                                                {isSelected && <div className="flex h-full items-center justify-center"><div className="h-1.5 w-1.5 rounded-full bg-white" /></div>}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-semibold text-slate-900">{opt.label}</div>
                                                <div className="mt-0.5 text-xs text-slate-500">{opt.description}</div>
                                                <div className={`mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${opt.inventoryColor}`}>
                                                    {opt.inventoryEffect}
                                                </div>
                                            </div>
                                        </div>
                                        <input type="radio" name="resolution" value={opt.value} checked={isSelected} onChange={() => { form.setData('resolution', opt.value); setConfirmDestructive(false); }} className="sr-only" />
                                    </label>
                                );
                            })}
                        </div>
                        {form.errors.resolution && <p className="mt-1.5 text-xs text-red-600">{form.errors.resolution}</p>}
                    </section>

                    {/* Operational Notes */}
                    <section className="mt-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Operational Notes <span className="text-red-500">*</span></div>
                        <textarea
                            value={form.data.resolution_notes}
                            onChange={(e) => form.setData('resolution_notes', e.target.value)}
                            className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                            placeholder="Tambahkan catatan operasional (wajib)..."
                            required
                        />
                        {form.errors.resolution_notes && <p className="mt-1 text-xs text-red-600">{form.errors.resolution_notes}</p>}
                    </section>

                    {/* Destructive Confirmation */}
                    {isDestructive && confirmDestructive && (
                        <section className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                            <div className="text-xs font-semibold text-red-800">⚠️ Konfirmasi: Tindakan ini akan melepas reserved stock dan membatalkan order secara permanen.</div>
                        </section>
                    )}

                    {/* Submit */}
                    <section className="mt-4">
                        <button
                            type="submit"
                            disabled={!form.data.resolution || !form.data.resolution_notes || form.processing}
                            className={`flex min-h-[48px] w-full items-center justify-center rounded-lg text-sm font-bold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 ${
                                isDestructive
                                    ? 'bg-red-600 text-white active:bg-red-700'
                                    : 'bg-emerald-700 text-white active:bg-emerald-800'
                            }`}
                        >
                            {form.processing ? 'Processing...' : (confirmDestructive && isDestructive) ? 'Confirm Cancel Order' : selectedOption?.ctaLabel ?? 'Select Resolution'}
                        </button>
                    </section>
                </form>
            </main>

            <OwnerBottomNav />
        </div>
    );
}

function DesktopResolve({ delivery, retryCount }: any) {
    return (
        <>
            <Head title="Resolve Delivery" />
            <p className="text-sm text-slate-500">Redirecting to mobile view for resolution...</p>
            <Link href={`/owner/deliveries/${delivery.id}`} className="mt-2 text-emerald-700">← Back to delivery</Link>
        </>
    );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <div className="flex justify-between gap-3">
            <span className="text-slate-500">{label}</span>
            <span className={`text-right ${bold ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{value}</span>
        </div>
    );
}

function ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

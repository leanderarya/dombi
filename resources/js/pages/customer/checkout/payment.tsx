import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { formatCurrency } from '@/lib/format';
import { useCart } from '@/lib/use-cart';

export default function CheckoutPayment({ draft, summary }: any) {
    const cart = useCart();
    const fulfillmentType = draft?.fulfillment?.fulfillment_type ?? 'pickup';
    const [itemsExpanded, setItemsExpanded] = useState(false);
    const form = useForm({
        payment_method: 'cod',
    });

    const paymentOptions = summary.payment_options ?? [];
    const selectedOption = paymentOptions.find((option: any) => option.value === form.data.payment_method) ?? paymentOptions[0];
    const paymentFee = Math.round((summary.subtotal ?? 0) * (selectedOption?.fee_rate ?? 0) * 100) / 100;
    const total = (summary.subtotal ?? 0) + (summary.delivery_fee ?? 0) + paymentFee;
    const deliveryLabel = fulfillmentType === 'delivery_dombi' ? 'Ongkir Kurir Dombi' : 'Delivery Fee';
    const totalLabel = 'Total';
    const deliveryBlocked = fulfillmentType === 'delivery_dombi' && !!summary.delivery_quote && summary.delivery_quote.is_serviceable === false;

    const submit = () => {
        form.post('/customer/checkout/payment', {
            onSuccess: () => cart.clear(),
        });
    };

    return (
        <CustomerMobileLayout
            hideTopBar
            hideCartBar
            hideBottomNav
            footerSlot={
                <StepButton
                    label={form.data.payment_method === 'qris' || form.data.payment_method === 'card' ? 'Bayar' : 'Buat Pesanan'}
                    disabled={form.processing || deliveryBlocked}
                    processing={form.processing}
                    onClick={submit}
                />
            }
        >
            <Head title="Pembayaran" />
            <StepHeader title="Pembayaran" step="3 dari 3" backHref="/customer/checkout/customer" />

            <section className="mt-5">
                <h1 className="text-xl font-semibold text-slate-900">Pembayaran</h1>
                <p className="mt-1 text-sm text-slate-500">Pilih metode pembayaran dan lihat total akhir sebelum order dibuat.</p>
            </section>

            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Customer Summary</div>
                <div className="mt-3 space-y-2 text-sm">
                    <SummaryPair label="Nama" value={draft?.customer?.customer_name ?? '-'} />
                    <SummaryPair label="Nomor HP" value={draft?.customer?.phone_number ?? '-'} />
                </div>
            </section>

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fulfillment Summary</div>
                <div className="mt-3 text-sm font-semibold text-slate-900">{fulfillmentLabel(fulfillmentType)}</div>
                {fulfillmentType === 'pickup' && draft?.pickup_outlet && (
                    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                        <div className="font-semibold">{draft.pickup_outlet.name}</div>
                        <div className="mt-1 text-xs text-emerald-700">{draft.pickup_outlet.address}</div>
                        <div className="mt-1 text-xs text-emerald-700">
                            {[draft.pickup_outlet.kelurahan, draft.pickup_outlet.kecamatan].filter(Boolean).join(' · ')}
                        </div>
                    </div>
                )}
                {fulfillmentType === 'delivery_dombi' && summary.delivery_quote?.outlet && (
                    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                        <div className="font-semibold">{summary.delivery_quote.outlet.name}</div>
                        <div className="mt-1 text-xs text-emerald-700">
                            {Number(summary.delivery_quote.distance_km ?? 0).toFixed(2)} km · {formatCurrency(summary.delivery_fee)}
                        </div>
                    </div>
                )}
            </section>

            {fulfillmentType !== 'pickup' && draft?.location && (
                <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Location Summary</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">{draft.location.address_line}</p>
                        <p>{[draft.location.village, draft.location.district, draft.location.city, draft.location.province].filter(Boolean).join(', ')}</p>
                        {draft.location.postal_code && <p>Kode pos {draft.location.postal_code}</p>}
                        {draft.location.landmark && <p>Patokan: {draft.location.landmark}</p>}
                    </div>
                </section>
            )}

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <button
                    type="button"
                    onClick={() => setItemsExpanded((value) => !value)}
                    className="flex w-full items-center justify-between text-left"
                >
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Items Summary</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                            {draft?.items?.length ?? 0} Produk • {formatCurrency(summary.subtotal)}
                        </div>
                    </div>
                    <span className="text-lg text-slate-500">{itemsExpanded ? '−' : '+'}</span>
                </button>

                {itemsExpanded && (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                        {(draft?.items ?? []).map((item: any) => (
                            <div key={item.product_id} className="flex items-start justify-between gap-3 text-sm">
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-900">{item.name}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {item.quantity} x {formatCurrency(item.price)}
                                    </p>
                                </div>
                                <div className="shrink-0 font-semibold tabular-nums text-slate-900">{formatCurrency(item.subtotal)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Metode pembayaran</div>
                <div className="mt-3 space-y-3">
                    {paymentOptions.map((option: any) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => form.setData('payment_method', option.value)}
                            className={`flex min-h-[68px] w-full items-center justify-between rounded-xl border px-4 text-left transition-all active:scale-[0.98] ${
                                form.data.payment_method === option.value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'
                            }`}
                        >
                            <div>
                                <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                    {option.value === 'qris' && '+0.7%'}
                                    {option.value === 'card' && '+4%'}
                                    {option.value === 'transfer' && '0% fee'}
                                    {option.value === 'cod' && 'Bayar saat produk diterima'}
                                </div>
                            </div>
                            <div className="text-sm font-bold tabular-nums text-slate-900">
                                {option.fee_rate > 0 ? `${(option.fee_rate * 100).toFixed(option.value === 'qris' ? 1 : 0)}%` : '0%'}
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ringkasan pembayaran</div>
                <div className="mt-3 space-y-2">
                    <SummaryRow label="Subtotal" value={formatCurrency(summary.subtotal)} />
                    <SummaryRow label={deliveryLabel} value={formatCurrency(summary.delivery_fee)} />
                    <SummaryRow label="Payment Fee" value={formatCurrency(paymentFee)} />
                    <div className="border-t border-slate-100 pt-2">
                        <SummaryRow label={totalLabel} value={formatCurrency(total)} strong />
                    </div>
                </div>
                {fulfillmentType === 'delivery_dombi' && summary.delivery_quote && !summary.delivery_quote.is_serviceable && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
                        Maaf, lokasi Anda berada di luar area layanan Kurir Dombi.
                    </p>
                )}
            </section>
        </CustomerMobileLayout>
    );
}

function StepHeader({ title, step, backHref }: { title: string; step: string; backHref: string }) {
    return (
        <header className="-mx-4 -mt-5 border-b border-slate-200 bg-white px-4 py-3">
            <div className="mx-auto flex max-w-lg items-center justify-between">
                <button onClick={() => router.visit(backHref)} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 active:bg-slate-100">
                    <span className="text-xl">‹</span>
                </button>
                <div className="text-center">
                    <h1 className="text-base font-semibold text-slate-900">{title}</h1>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{step}</p>
                </div>
                <div className="h-10 w-10" />
            </div>
        </header>
    );
}

function StepButton({ label, disabled, processing, onClick }: { label: string; disabled: boolean; processing: boolean; onClick: () => void }) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
            <div className="mx-auto max-w-lg">
                <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    className="flex min-h-14 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-emerald-700 disabled:bg-slate-300 disabled:active:scale-100"
                >
                    {processing ? 'Memproses...' : label}
                </button>
            </div>
        </div>
    );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className={strong ? 'font-semibold text-slate-900' : 'text-slate-500'}>{label}</span>
            <span className={`tabular-nums ${strong ? 'text-lg font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>{value}</span>
        </div>
    );
}

function SummaryPair({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">{label}</span>
            <span className="text-right font-semibold text-slate-900">{value}</span>
        </div>
    );
}

function fulfillmentLabel(value: string) {
    if (value === 'pickup') {
        return 'Pickup';
    }

    return 'Kurir Dombi';
}

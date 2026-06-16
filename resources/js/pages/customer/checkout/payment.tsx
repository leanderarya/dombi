import { Head, router, useForm } from '@inertiajs/react';
import { AlertCircle, MapPin, Store } from 'lucide-react';
import { useState } from 'react';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { useCustomerLocation } from '@/lib/customer-location';
import { formatCurrency, formatDistance } from '@/lib/format';
import { useCart } from '@/lib/use-cart';

export default function CheckoutPayment({ draft, summary }: any) {
    const cart = useCart();
    const { markUsedForOrder } = useCustomerLocation();
    const fulfillmentType = draft?.fulfillment?.fulfillment_type ?? 'pickup';
    const isDelivery = fulfillmentType === 'delivery_dombi';
    const [itemsExpanded, setItemsExpanded] = useState(false);
    const form = useForm({
        payment_method: 'cod',
    });

    const paymentOptions = summary.payment_options ?? [];
    const selectedOption = paymentOptions.find((option: any) => option.value === form.data.payment_method) ?? paymentOptions[0];
    const paymentFee = Math.round((summary.subtotal ?? 0) * (selectedOption?.fee_rate ?? 0) * 100) / 100;
    const total = (summary.subtotal ?? 0) + (summary.delivery_fee ?? 0) + paymentFee;
    const deliveryBlocked = isDelivery && !!summary.delivery_quote && summary.delivery_quote.is_serviceable === false;
    const ctaLabel = buildCtaLabel(form.data.payment_method, total);

    const submit = () => {
        form.post('/customer/checkout/payment', {
            onSuccess: () => {
                cart.clear();
                markUsedForOrder();
            },
        });
    };

    return (
        <CustomerMobileLayout
            hideTopBar
            hideCartBar
            hideBottomNav
            footerSlot={
                <StepButton
                    label={ctaLabel}
                    disabled={form.processing || deliveryBlocked}
                    processing={form.processing}
                    onClick={submit}
                />
            }
        >
            <Head title="Pembayaran" />
            <StepHeader title="Pembayaran" step="3 dari 3" backHref="/customer/checkout/customer" />

            {/* Pesanan */}
            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                <button
                    type="button"
                    onClick={() => setItemsExpanded((value) => !value)}
                    className="flex w-full items-center justify-between text-left"
                >
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pesanan</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                            {draft?.items?.length ?? 0} Produk · {formatCurrency(summary.subtotal)}
                        </div>
                    </div>
                    <span className="text-lg text-slate-500">{itemsExpanded ? '−' : '+'}</span>
                </button>

                {itemsExpanded && (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                        {(draft?.items ?? []).map((item: any) => (
                            <div key={item.product_variant_id} className="flex items-start justify-between gap-3 text-sm">
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-900">{item.name}</p>
                                    {item.variant_name && (
                                        <p className="text-xs text-slate-400">{item.variant_name}</p>
                                    )}
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

            {/* Pengiriman */}
            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pengiriman</div>

                {isDelivery && summary.delivery_quote?.outlet && (
                    <div className="mt-3 space-y-2">
                        <div className="text-sm font-semibold text-slate-900">{summary.delivery_quote.outlet.name}</div>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                            <span>Jarak: <span className="font-semibold text-slate-900">{formatDistance(Number(summary.delivery_quote.distance_km ?? 0))}</span></span>
                            <span>·</span>
                            <span>Kurir Dombi</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-500">Ongkir: </span>
                            <span className="font-bold text-slate-900">{formatCurrency(summary.delivery_fee)}</span>
                        </div>
                        {draft?.location && (
                            <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                    <span>{[draft.location.village, draft.location.district, draft.location.city].filter(Boolean).join(', ') || draft.location.address_line}</span>
                                </div>
                                {draft.location.address_detail && (
                                    <div className="mt-1"><span className="font-medium text-slate-500">Detail: </span>{draft.location.address_detail}</div>
                                )}
                                {draft.location.landmark && (
                                    <div className="mt-1"><span className="font-medium text-slate-500">Patokan: </span>{draft.location.landmark}</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {fulfillmentType === 'pickup' && draft?.pickup_outlet && (
                    <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Store className="h-4 w-4 shrink-0 text-slate-400" />
                            <span>{draft.pickup_outlet.name}</span>
                        </div>
                        <div className="text-xs text-slate-500">{draft.pickup_outlet.address}</div>
                        <div className="text-xs text-slate-500">
                            {[draft.pickup_outlet.kelurahan, draft.pickup_outlet.kecamatan].filter(Boolean).join(' · ')}
                        </div>
                    </div>
                )}

                {!isDelivery && fulfillmentType !== 'pickup' && (
                    <div className="mt-3 text-sm text-slate-500">-</div>
                )}
            </section>

            {/* Pembayaran */}
            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pembayaran</div>
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
                            <div className="text-right">
                                <div className="text-sm font-bold tabular-nums text-slate-900">
                                    {option.fee_rate > 0 ? `${(option.fee_rate * 100).toFixed(option.value === 'qris' ? 1 : 0)}%` : '0%'}
                                </div>
                                {form.data.payment_method === option.value && paymentFee > 0 && (
                                    <div className="mt-0.5 text-xs font-semibold text-emerald-700">+ {formatCurrency(paymentFee)}</div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            {/* Total Card */}
            <section className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Total Pembayaran</div>
                <div className="mt-3 space-y-2">
                    <SummaryRow label="Subtotal" value={formatCurrency(summary.subtotal)} />
                    <SummaryRow label="Ongkir" value={formatCurrency(summary.delivery_fee)} />
                    {paymentFee > 0 && <SummaryRow label="Biaya Pembayaran" value={formatCurrency(paymentFee)} />}
                    <div className="border-t border-emerald-200 pt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-emerald-900">Total</span>
                            <span className="text-xl font-bold tabular-nums text-emerald-900">{formatCurrency(total)}</span>
                        </div>
                    </div>
                </div>
                {deliveryBlocked && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        <span>Lokasi Anda berada di luar area layanan Kurir Dombi. Silakan kembali dan ubah lokasi.</span>
                    </div>
                )}
            </section>

            {/* Customer Info (compact) */}
            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pemesan</div>
                <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-900">{draft?.customer?.customer_name ?? '-'}</span>
                    <span className="text-slate-500">{draft?.customer?.phone_number ?? '-'}</span>
                </div>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{label}</span>
            <span className="font-semibold tabular-nums text-slate-800">{value}</span>
        </div>
    );
}

function buildCtaLabel(paymentMethod: string, total: number): string {
    const formattedTotal = formatCurrency(total);

    if (paymentMethod === 'qris' || paymentMethod === 'card') {
        return `Bayar ${formattedTotal}`;
    }

    return `Buat Pesanan ${formattedTotal}`;
}

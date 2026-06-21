import { Head, useForm } from '@inertiajs/react';
import { AlertCircle, MapPin, Store, XCircle } from 'lucide-react';
import { useState } from 'react';
import StepButton from '@/components/customer/step-button';
import StepHeader from '@/components/customer/step-header';
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
    const [submitError, setSubmitError] = useState<string | null>(null);
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
        setSubmitError(null);
        form.post('/customer/checkout/payment', {
            onSuccess: () => {
                cart.clear();
                markUsedForOrder();
            },
            onError: (errors) => {
                if (errors.error) {
                    setSubmitError(errors.error);
                } else if (Object.keys(errors).length > 0) {
                    setSubmitError(Object.values(errors)[0] as string);
                } else {
                    setSubmitError('Terjadi kesalahan. Silakan coba lagi.');
                }
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
            <StepHeader
                title="Pembayaran"
                currentStep={2}
                steps={[
                    { label: 'Keranjang' },
                    { label: 'Info' },
                    { label: 'Bayar' },
                ]}
                backHref="/customer/checkout/customer"
            />

            {/* Error Banner */}
            {(submitError || Object.keys(form.errors).length > 0) && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-red-800">Gagal membuat pesanan</p>
                        <p className="mt-1 text-xs text-red-600">
                            {submitError || Object.values(form.errors)[0]}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSubmitError(null)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center text-red-400 hover:text-red-600"
                    >
                        <XCircle className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Pesanan */}
            <section className="mt-5 rounded-xl border border-border bg-white p-4">
                <button
                    type="button"
                    onClick={() => setItemsExpanded((value) => !value)}
                    className="flex w-full items-center justify-between text-left"
                >
                    <div>
                        <div className="text-[13px] text-text-subtle">Pesanan</div>
                        <div className="mt-1 text-sm font-semibold text-text">
                            {draft?.items?.length ?? 0} Produk · {formatCurrency(summary.subtotal)}
                        </div>
                    </div>
                    <span className="text-lg text-text-muted">{itemsExpanded ? '−' : '+'}</span>
                </button>

                {itemsExpanded && (
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                        {(draft?.items ?? []).map((item: any) => (
                            <div key={item.product_variant_id} className="flex items-start justify-between gap-3 text-sm">
                                <div className="min-w-0">
                                    <p className="font-semibold text-text">{item.name}</p>
                                    {item.variant_name && (
                                        <p className="text-xs text-text-subtle">{item.variant_name}</p>
                                    )}
                                    <p className="mt-1 text-xs text-text-muted">
                                        {item.quantity} x {formatCurrency(item.price)}
                                    </p>
                                </div>
                                <div className="shrink-0 font-semibold tabular-nums text-text">{formatCurrency(item.subtotal)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Pengiriman */}
            <section className="mt-4 rounded-xl border border-border bg-white p-4">
                <div className="text-[13px] text-text-subtle">Pengiriman</div>

                {isDelivery && summary.delivery_quote?.outlet && (
                    <div className="mt-3 space-y-2">
                        <div className="text-sm font-semibold text-text">{summary.delivery_quote.outlet.name}</div>
                        <div className="flex items-center gap-3 text-xs text-text-muted">
                            <span>Jarak: <span className="font-semibold text-text">{formatDistance(Number(summary.delivery_quote.distance_km ?? 0))}</span></span>
                            <span>·</span>
                            <span>Kurir Dombi</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-text-muted">Ongkir: </span>
                            <span className="font-bold text-text">{formatCurrency(summary.delivery_fee)}</span>
                        </div>
                        {draft?.location && (
                            <div className="mt-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted">
                                <div className="flex items-center gap-1.5 font-semibold text-text">
                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-text-subtle" />
                                    <span>{[draft.location.village, draft.location.district, draft.location.city].filter(Boolean).join(', ') || draft.location.address_line}</span>
                                </div>
                                {draft.location.address_detail && (
                                    <div className="mt-1"><span className="font-medium text-text-muted">Detail: </span>{draft.location.address_detail}</div>
                                )}
                                {draft.location.landmark && (
                                    <div className="mt-1"><span className="font-medium text-text-muted">Patokan: </span>{draft.location.landmark}</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {fulfillmentType === 'pickup' && draft?.pickup_outlet && (
                    <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-text">
                            <Store className="h-4 w-4 shrink-0 text-text-subtle" />
                            <span>{draft.pickup_outlet.name}</span>
                        </div>
                        <div className="text-xs text-text-muted">{draft.pickup_outlet.address}</div>
                        <div className="text-xs text-text-muted">
                            {[draft.pickup_outlet.kelurahan, draft.pickup_outlet.kecamatan].filter(Boolean).join(' · ')}
                        </div>
                    </div>
                )}

                {!isDelivery && fulfillmentType !== 'pickup' && (
                    <div className="mt-3 text-sm text-text-muted">-</div>
                )}
            </section>

            {/* Pembayaran */}
            <section className="mt-4 rounded-xl border border-border bg-white p-4">
                <div className="text-[13px] text-text-subtle">Pembayaran</div>
                <div className="mt-3 space-y-3">
                    {paymentOptions.map((option: any) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => form.setData('payment_method', option.value)}
                            className={`flex min-h-[68px] w-full items-center justify-between rounded-2xl px-4 text-left transition-all active:opacity-80 ${
                                form.data.payment_method === option.value
                                    ? 'bg-emerald-50 ring-2 ring-emerald-500'
                                    : 'bg-white border border-border'
                            }`}
                        >
                            <div>
                                <div className="text-sm font-semibold text-text">{option.label}</div>
                                <div className="mt-1 text-xs text-text-muted">
                                    {option.value === 'qris' && '+0.7%'}
                                    {option.value === 'card' && '+4%'}
                                    {option.value === 'transfer' && '0% fee'}
                                    {option.value === 'cod' && 'Bayar saat produk diterima'}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold tabular-nums text-text">
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
            <section className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 p-5 text-white">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Total Pembayaran</div>
                <div className="mt-3 space-y-2">
                    <SummaryRow label="Subtotal" value={formatCurrency(summary.subtotal)} />
                    <SummaryRow label="Ongkir" value={formatCurrency(summary.delivery_fee)} />
                    {paymentFee > 0 && <SummaryRow label="Biaya Pembayaran" value={formatCurrency(paymentFee)} />}
                    <div className="border-t border-emerald-400/30 pt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">Total</span>
                            <span className="text-2xl font-bold tabular-nums text-white">{formatCurrency(total)}</span>
                        </div>
                    </div>
                </div>
                {deliveryBlocked && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/20 px-3 py-2 text-xs leading-relaxed text-white">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                        <span>Lokasi Anda berada di luar area layanan Kurir Dombi. Silakan kembali dan ubah lokasi.</span>
                    </div>
                )}
            </section>

            {/* Customer Info (compact) */}
            <section className="mt-4 rounded-xl border border-border bg-white p-4">
                <div className="text-[13px] text-text-subtle">Pemesan</div>
                <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-text">{draft?.customer?.customer_name ?? '-'}</span>
                    <span className="text-text-muted">{draft?.customer?.phone_number ?? '-'}</span>
                </div>
            </section>

            {/* Spacer for sticky footer */}
            <div className="h-24" />
        </CustomerMobileLayout>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-emerald-100">{label}</span>
            <span className="font-semibold tabular-nums text-white">{value}</span>
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

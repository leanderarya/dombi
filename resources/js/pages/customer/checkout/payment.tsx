import { Head, router } from '@inertiajs/react';
import { ChevronDown, ChevronUp, MapPin, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import NoticeBanner from '@/components/customer/checkout/notice-banner';
import StepButton from '@/components/customer/step-button';
import StepHeader from '@/components/customer/step-header';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { useCustomerLocation } from '@/lib/customer-location';
import { formatCurrency, formatDistance } from '@/lib/format';
import { isDifferentRecipient } from '@/lib/recipient';
import { useCart } from '@/lib/use-cart';

export default function CheckoutPayment({ draft, summary }: any) {
    const cart = useCart();
    const { markUsedForOrder } = useCustomerLocation();
    const fulfillmentType = draft?.fulfillment?.fulfillment_type ?? 'pickup';
    const isDelivery = fulfillmentType === 'delivery_dombi';
    const [itemsExpanded, setItemsExpanded] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [paymentExpanded, setPaymentExpanded] = useState(false);
    const paymentOptions = summary.payment_options ?? [];
    const [paymentMethod, setPaymentMethod] = useState(paymentOptions[0]?.value ?? 'qris');
    const selectedOption = paymentOptions.find((option: any) => option.value === paymentMethod) ?? paymentOptions[0];
    const paymentFee = Math.round((summary.subtotal ?? 0) * (selectedOption?.fee_rate ?? 0) * 100) / 100;
    const total = (summary.subtotal ?? 0) + (summary.delivery_fee ?? 0) + paymentFee;
    const deliveryBlocked = isDelivery && !!summary.delivery_quote && summary.delivery_quote.is_serviceable === false;
    const ctaLabel = `Bayar ${formatCurrency(total)}`;

    // Guard: redirect to cart if no items
    useEffect(() => {
        if (!draft?.items || draft.items.length === 0) {
            router.visit('/customer/checkout');
        }
    }, [draft?.items]);

    const hasDifferentRecipient = isDifferentRecipient({
        customer_name: draft?.customer?.customer_name,
        customer_phone: draft?.customer?.phone_number,
        recipient_name: draft?.customer?.recipient_name,
        recipient_phone: draft?.customer?.recipient_phone,
    });

    const submit = async () => {
        setSubmitError(null);
        setProcessing(true);

        try {
            const response = await fetch('/customer/checkout/payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({ payment_method: paymentMethod }),
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMsg = data.message || data.errors
                    ? Object.values(data.errors ?? {}).flat()[0]
                    : 'Terjadi kesalahan. Silakan coba lagi.';
                setSubmitError(typeof errorMsg === 'string' ? errorMsg : 'Terjadi kesalahan. Silakan coba lagi.');
                setProcessing(false);

                return;
            }

            if (data.payment_url) {
                cart.clear();
                markUsedForOrder();
                // replace() removes DOKU from browser history — back button goes to orders, not DOKU
                window.location.replace(data.payment_url);
            } else {
                setSubmitError('Tidak ada URL pembayaran. Silakan coba lagi.');
                setProcessing(false);
            }
        } catch {
            setSubmitError('Terjadi kesalahan jaringan. Silakan coba lagi.');
            setProcessing(false);
        }
    };

    return (
        <CustomerMobileLayout
            hideTopBar
            hideCartBar
            hideBottomNav
            footerSlot={
                <StepButton
                    label={ctaLabel}
                    disabled={processing || deliveryBlocked}
                    processing={processing}
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
            {submitError && (
                <div className="mt-4">
                    <NoticeBanner
                        variant="error"
                        title="Pesanan gagal dibuat"
                        message={submitError}
                        onDismiss={() => setSubmitError(null)}
                    />
                </div>
            )}

            {/* Pesanan — collapsible */}
            <section className="mt-4 rounded-xl border border-border bg-white p-4">
                <button
                    type="button"
                    onClick={() => setItemsExpanded((value) => !value)}
                    className="flex min-h-11 w-full items-center justify-between text-left active:opacity-80"
                >
                    <div>
                        <div className="text-[13px] text-text-subtle">Pesanan</div>
                        <div className="mt-0.5 text-sm font-semibold text-text">
                            {draft?.items?.length ?? 0} Produk · {formatCurrency(summary.subtotal)}
                        </div>
                    </div>
                    {itemsExpanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                </button>

                {itemsExpanded && (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                        {(draft?.items ?? []).map((item: any) => (
                            <div key={item.product_variant_id} className="flex items-start justify-between gap-3 text-sm">
                                <div className="min-w-0">
                                    <span className="font-medium text-text">{item.name}</span>
                                    {item.variant_name && (
                                        <span className="ml-1 text-xs text-text-subtle">{item.variant_name}</span>
                                    )}
                                    <span className="ml-1 text-xs text-text-muted">x{item.quantity}</span>
                                </div>
                                <span className="shrink-0 font-medium tabular-nums text-text">{formatCurrency(item.subtotal)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Pengiriman */}
            <section className="mt-4 rounded-xl border border-border bg-white p-4">
                <div className="text-[13px] text-text-subtle">Pengiriman</div>

                {isDelivery && summary.delivery_quote?.outlet && (
                    <div className="mt-2 flex items-center justify-between text-sm">
                        <div>
                            <div className="font-semibold text-text">{summary.delivery_quote.outlet.name}</div>
                            <div className="text-xs text-text-muted">{formatDistance(Number(summary.delivery_quote.distance_km ?? 0))} · Kurir Dombi</div>
                        </div>
                        <span className="font-bold tabular-nums text-text">{formatCurrency(summary.delivery_fee)}</span>
                    </div>
                )}

                {isDelivery && draft?.location && (
                    <div className="mt-2 text-xs text-text-muted">
                        <MapPin className="mr-1 inline h-3 w-3 align-text-bottom" />
                        {[draft.location.village, draft.location.district, draft.location.city].filter(Boolean).join(', ') || draft.location.address_line}
                    </div>
                )}

                {fulfillmentType === 'pickup' && draft?.pickup_outlet && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                        <Store className="h-4 w-4 shrink-0 text-text-subtle" />
                        <div>
                            <div className="font-semibold text-text">{draft.pickup_outlet.name}</div>
                            <div className="text-xs text-text-muted">{draft.pickup_outlet.address}</div>
                        </div>
                    </div>
                )}
            </section>

            {/* Pembayaran */}
            <section className="mt-4 rounded-xl border border-border bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-text-subtle">Metode Pembayaran</span>
                    <button
                        type="button"
                        onClick={() => setPaymentExpanded(!paymentExpanded)}
                        className="min-h-11 px-2 text-xs font-semibold text-primary active:opacity-80"
                    >
                        {paymentExpanded ? 'Tutup' : 'Ganti'}
                    </button>
                </div>

                {/* Selected payment */}
                <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
                    <div>
                        <div className="text-sm font-semibold text-text">{selectedOption?.label ?? 'QRIS'}</div>
                        <div className="mt-0.5 text-xs text-text-muted">
                            {selectedOption?.description ?? 'Scan QR untuk membayar'}
                        </div>
                    </div>
                    {paymentFee > 0 && (
                        <div className="text-sm font-bold tabular-nums text-text-muted">
                            + {formatCurrency(paymentFee)}
                        </div>
                    )}
                </div>

                {/* Other options — expandable */}
                {paymentExpanded && (
                    <div className="mt-2 space-y-2">
                        {paymentOptions
                            .filter((option: any) => option.value !== paymentMethod)
                            .map((option: any) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        setPaymentMethod(option.value);
                                        setPaymentExpanded(false);
                                    }}
                                    className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left transition-all active:opacity-80"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-text">{option.label}</div>
                                        <div className="mt-0.5 text-[11px] text-text-subtle">{option.description}</div>
                                    </div>
                                    {option.fee_rate > 0 && (
                                        <div className="text-xs font-bold tabular-nums text-text-muted">
                                            + {formatCurrency(Math.round((summary.subtotal ?? 0) * option.fee_rate * 100) / 100)}
                                        </div>
                                    )}
                                </button>
                            ))}
                    </div>
                )}
            </section>

            {/* Total Card */}
            <section className="mt-4 rounded-xl bg-primary px-4 py-3 text-white">
                <div className="space-y-1">
                    <SummaryRow label="Subtotal" value={formatCurrency(summary.subtotal)} />
                    {summary.delivery_fee > 0 && <SummaryRow label="Ongkir" value={formatCurrency(summary.delivery_fee)} />}
                    {paymentFee > 0 && <SummaryRow label="Biaya Layanan" value={formatCurrency(paymentFee)} />}
                </div>
                <div className="mt-2 border-t border-white/20 pt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Total</span>
                    <span className="text-lg font-bold tabular-nums text-white">{formatCurrency(total)}</span>
                </div>
                {deliveryBlocked && (
                    <div className="mt-2">
                        <NoticeBanner
                            variant="warning"
                            title="Lokasi di luar jangkauan"
                            message="Kembali dan ubah lokasi pengiriman Anda."
                        />
                    </div>
                )}
            </section>

            {/* Recipient — only when different */}
            {hasDifferentRecipient && (
                <section className="mt-4 rounded-xl border border-border bg-white p-4">
                    <div className="text-[13px] text-text-subtle">Pemesan</div>
                    <div className="mt-1 text-sm font-semibold text-text">
                        {draft?.customer?.customer_name} · {draft?.customer?.phone_number}
                    </div>
                    <div className="mt-2 border-t border-border pt-2">
                        <div className="text-[13px] text-text-subtle">Penerima</div>
                        <div className="mt-1 text-sm font-semibold text-text">
                            {draft.customer.recipient_name} · {draft.customer.recipient_phone ?? '-'}
                        </div>
                    </div>
                </section>
            )}

            {/* Spacer for sticky footer */}
            <div className="h-24" />
        </CustomerMobileLayout>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">{label}</span>
            <span className="font-medium tabular-nums text-white/90">{value}</span>
        </div>
    );
}

import { Head, Link, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import CheckoutHeader from '@/components/customer/checkout-header';
import CheckoutItemCard from '@/components/customer/checkout-item-card';
import DeliveryAddressCard from '@/components/customer/delivery-address-card';
import PaymentMethodCard from '@/components/customer/payment-method-card';
import StickyPlaceOrderBar from '@/components/customer/sticky-place-order-bar';
import OfflineBanner from '@/components/offline-banner';
import { useCart } from '@/lib/use-cart';
import { formatCurrency } from '@/lib/format';

export default function Checkout({ products, addresses, selectedProductId }: any) {
    const cart = useCart();
    const seeded = useRef(false);
    const [paymentMethod, setPaymentMethod] = useState('cod');

    // Seed cart from URL param ONCE
    useEffect(() => {
        if (selectedProductId && !seeded.current) {
            seeded.current = true;
            if (cart.getQuantity(Number(selectedProductId)) === 0) {
                cart.addItem(Number(selectedProductId));
            }
        }
    }, []);

    const form = useForm({
        address_id: addresses.find((a: any) => a.is_default)?.id ?? addresses[0]?.id ?? '',
        items: cart.items.map((i) => ({ product_id: String(i.product_id), quantity: i.quantity })),
        notes: '',
    });

    // Sync form items when cart changes
    useEffect(() => {
        form.setData('items', cart.items.map((i) => ({ product_id: String(i.product_id), quantity: i.quantity })) as any);
    }, [cart.items]);

    const productById = new Map(products.map((p: any) => [Number(p.id), p]));
    const selectedAddress = addresses.find((a: any) => Number(a.id) === Number(form.data.address_id));
    const total = form.data.items.reduce((sum: number, item: any) => {
        const product: any = productById.get(Number(item.product_id));
        return sum + (product ? Number(product.price) * Number(item.quantity || 0) : 0);
    }, 0);

    const hasItems = form.data.items.length > 0;
    const itemCount = form.data.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

    const submit = () => {
        if (!hasItems) return;
        form.post('/customer/orders', {
            onSuccess: () => cart.clear(),
        });
    };

    return (
        <div className="min-h-dvh bg-[#fbf9f7] text-slate-950">
            <OfflineBanner />
            <CheckoutHeader />

            <main className={`mx-auto max-w-lg px-4 pt-5 ${hasItems ? 'pb-[calc(6rem+env(safe-area-inset-bottom))]' : 'pb-8'}`}>
                <Head title="Checkout" />

                {/* Empty State */}
                {!hasItems && (
                    <section className="mt-8 flex flex-col items-center rounded-xl border border-zinc-100 bg-white py-12 text-center">
                        <span className="text-4xl">🛒</span>
                        <p className="mt-3 text-sm font-semibold text-slate-700">Belum ada produk dipilih</p>
                        <p className="mt-1 text-xs text-slate-400">Pilih produk terlebih dahulu untuk checkout.</p>
                        <Link href="/customer/products" className="mt-4 flex min-h-11 items-center rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white active:bg-emerald-800">
                            Lihat Produk
                        </Link>
                    </section>
                )}

                {hasItems && (
                    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>

                        {/* Delivery Address */}
                        <section>
                            <SectionLabel>Delivery Address</SectionLabel>
                            <div className="mt-2">
                                <DeliveryAddressCard address={selectedAddress} hasAddresses={addresses.length > 0} />
                            </div>
                            {form.errors.address_id && <p className="mt-2 text-xs text-red-600">{form.errors.address_id}</p>}
                        </section>

                        {/* Order Items */}
                        <section className="mt-6">
                            <div className="flex items-center justify-between">
                                <SectionLabel>Order Items</SectionLabel>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{itemCount} Items</span>
                            </div>
                            <div className="mt-2 rounded-xl border border-zinc-200 bg-white px-4">
                                {form.data.items.map((item: any, index: number) => {
                                    const product: any = productById.get(Number(item.product_id));
                                    return (
                                        <CheckoutItemCard
                                            key={`${item.product_id}-${index}`}
                                            name={product?.name ?? 'Produk'}
                                            price={product?.price ?? 0}
                                            quantity={Number(item.quantity)}
                                            image={product?.image}
                                            onQuantityChange={(qty) => cart.setQuantity(Number(item.product_id), qty)}
                                            onRemove={() => cart.removeItem(Number(item.product_id))}
                                        />
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const inCart = new Set(cart.items.map((i) => i.product_id));
                                    const available = products.find((p: any) => !inCart.has(Number(p.id)));
                                    if (available) cart.addItem(Number(available.id));
                                }}
                                className="mt-2 flex min-h-10 w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xs font-semibold text-slate-500 active:bg-zinc-50"
                            >
                                + Tambah Produk Lain
                            </button>
                            {form.errors.items && <p className="mt-2 text-xs text-red-600">{form.errors.items}</p>}
                        </section>

                        {/* Payment Method */}
                        <section className="mt-6">
                            <SectionLabel>Payment Method</SectionLabel>
                            <div className="mt-2">
                                <PaymentMethodCard selected={paymentMethod} onChange={setPaymentMethod} />
                            </div>
                        </section>

                        {/* Order Summary */}
                        <section className="mt-6">
                            <SectionLabel>Order Summary</SectionLabel>
                            <div className="mt-2 space-y-2.5">
                                <SummaryRow label="Subtotal" value={formatCurrency(total)} />
                                <SummaryRow label="Delivery Fee" value="Rp 0" muted />
                                <SummaryRow label="Promotion" value="-Rp 0" accent />
                                <div className="border-t border-zinc-100 pt-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-900">Total Bill</span>
                                        <span className="text-xl font-bold tabular-nums text-slate-900">{formatCurrency(total)}</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Notes */}
                        <section className="mt-6">
                            <SectionLabel>Catatan</SectionLabel>
                            <textarea
                                value={form.data.notes}
                                onChange={(e) => form.setData('notes', e.target.value)}
                                className="mt-2 min-h-16 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                                placeholder="Catatan untuk outlet (opsional)"
                            />
                        </section>
                    </form>
                )}
            </main>

            {/* Sticky Place Order Bar */}
            {hasItems && (
                <StickyPlaceOrderBar
                    total={total}
                    disabled={addresses.length === 0}
                    processing={form.processing}
                    onSubmit={submit}
                />
            )}
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{children}</h2>;
}

function SummaryRow({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: boolean }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className={accent ? 'text-emerald-700' : 'text-slate-500'}>{label}</span>
            <span className={`tabular-nums ${accent ? 'text-emerald-700' : muted ? 'text-slate-400' : 'text-slate-700'}`}>{value}</span>
        </div>
    );
}

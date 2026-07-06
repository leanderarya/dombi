import { Head, router, usePage } from '@inertiajs/react';
import { ShoppingCart, Store, Truck } from 'lucide-react';
import { useCallback, useState } from 'react';
import CheckoutItemCard from '@/components/customer/checkout-item-card';
import DeliveryLoginSheet from '@/components/customer/delivery-login-sheet';
import StepButton from '@/components/customer/step-button';
import StepHeader from '@/components/customer/step-header';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { formatCurrency } from '@/lib/format';
import { useCart } from '@/lib/use-cart';

type DraftItem = {
    product_variant_id: number;
    quantity: number;
    name: string;
    variant_name: string;
    price: number;
    subtotal: number;
};

export default function CheckoutIndex({ draft, summary, nearestOutlet, deliveryPreview, deliveryTiers }: any) {
    const { auth } = usePage().props as any;
    const isLoggedIn = !!auth?.user;
    const cart = useCart();
    const [deliverySheetOpen, setDeliverySheetOpen] = useState(false);
    const [items, setItems] = useState<DraftItem[]>(draft?.items ?? []);
    const [fulfillmentType, setFulfillmentType] = useState<string>(
        draft?.fulfillment?.fulfillment_type ?? ''
    );
    const [processing, setProcessing] = useState(false);

    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const itemCount = items.reduce((sum, item) => sum + Number(item.quantity), 0);

    const updateQuantity = useCallback((variantId: number, newQty: number) => {
        if (newQty <= 0) {
            setItems((prev) => prev.filter((i) => i.product_variant_id !== variantId));
            cart.removeItem(variantId);
            fetch('/customer/cart/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '' },
                body: JSON.stringify({ product_variant_id: variantId }),
            });

            return;
        }

        setItems((prev) =>
            prev.map((i) => {
                if (i.product_variant_id === variantId) {
                    return { ...i, quantity: newQty, subtotal: i.price * newQty };
                }

                return i;
            }),
        );
        cart.setQuantity(variantId, newQty);
        fetch('/customer/cart/quantity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '' },
            body: JSON.stringify({ product_variant_id: variantId, quantity: newQty }),
        });
    }, [cart]);

    const removeItem = useCallback((variantId: number) => {
        setItems((prev) => prev.filter((i) => i.product_variant_id !== variantId));
        cart.removeItem(variantId);
        fetch('/customer/cart/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '' },
            body: JSON.stringify({ product_variant_id: variantId }),
        });
    }, [cart]);

    const submit = () => {
        setProcessing(true);
        router.post(
            '/customer/checkout',
            {
                items: items.map((i) => ({
                    product_variant_id: i.product_variant_id,
                    quantity: i.quantity,
                })),
                fulfillment_type: fulfillmentType,
            },
            {
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <CustomerMobileLayout
            hideTopBar
            hideCartBar
            hideBottomNav
            footerSlot={
                <StepButton
                    label="Lanjutkan"
                    disabled={items.length === 0 || !fulfillmentType || processing}
                    processing={processing}
                    onClick={submit}
                />
            }
        >
            <Head title="Checkout" />
            <StepHeader
                title="Checkout"
                currentStep={0}
                steps={[
                    { label: 'Keranjang' },
                    { label: 'Info' },
                    { label: 'Bayar' },
                ]}
                backHref="/customer/products"
            />

            {items.length === 0 ? (
                <div className="mt-4 rounded-xl border border-border bg-white p-5 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface">
                        <ShoppingCart className="h-5 w-5 text-text-subtle" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-text">Keranjang masih kosong</p>
                    <p className="mt-1 text-xs text-text-muted">Pilih produk untuk mulai belanja.</p>
                    <button onClick={() => router.visit('/customer/products')} className="mt-4 min-h-11 rounded-lg bg-primary px-5 text-sm font-bold text-white active:opacity-80">
                        Mulai Belanja
                    </button>
                </div>
            ) : (
                <div className="mt-4 rounded-xl border border-border bg-white p-4">
                    <h2 className="text-[13px] font-semibold text-text-subtle mb-3">Pesanan</h2>
                    {items.map((item) => (
                        <CheckoutItemCard
                            key={item.product_variant_id}
                            name={item.variant_name ? `${item.name} - ${item.variant_name}` : item.name}
                            price={item.price}
                            quantity={item.quantity}
                            onQuantityChange={(qty) => updateQuantity(item.product_variant_id, qty)}
                            onRemove={() => removeItem(item.product_variant_id)}
                        />
                    ))}
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                        <span className="text-sm text-text-muted">{itemCount} item</span>
                        <span className="text-2xl font-bold tabular-nums text-text">{formatCurrency(subtotal || summary?.subtotal || 0)}</span>
                    </div>
                </div>
            )}

            <section className="mt-4">
                <div className="rounded-xl border border-border bg-white p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {fulfillmentType === 'pickup' ? (
                                <Store className="h-5 w-5 text-emerald-600" />
                            ) : (
                                <Truck className="h-5 w-5 text-emerald-600" />
                            )}
                            <div>
                                <div className="text-sm font-semibold text-text">
                                    {fulfillmentType === 'pickup' ? 'Ambil di Outlet' : 'Kurir Dombi'}
                                </div>
                                {fulfillmentType === 'pickup' && nearestOutlet && (
                                    <div className="text-[11px] text-text-muted">
                                        {nearestOutlet.name} · {nearestOutlet.distance_km?.toFixed(1)} km
                                    </div>
                                )}
                                {fulfillmentType === 'delivery_dombi' && deliveryPreview?.delivery_fee !== undefined && (
                                    <div className="text-[11px] text-text-muted">
                                        Ongkir: Rp {deliveryPreview.delivery_fee.toLocaleString('id-ID')}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFulfillmentType(fulfillmentType === 'pickup' ? 'delivery_dombi' : 'pickup')}
                            className="text-[11px] font-semibold text-primary active:opacity-80"
                        >
                            Ubah
                        </button>
                    </div>
                </div>
                <DeliveryLoginSheet open={deliverySheetOpen} onClose={() => setDeliverySheetOpen(false)} />
            </section>
            {/* Spacer for sticky footer */}
            <div className="h-24" />
        </CustomerMobileLayout>
    );
}


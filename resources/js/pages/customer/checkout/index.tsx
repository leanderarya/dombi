import { Head, router, usePage } from '@inertiajs/react';
import { ShoppingCart, Store, Truck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
    const [overlayState, setOverlayState] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');
    const [overlayTarget, setOverlayTarget] = useState<string>('');
    const overlayTimeout = useRef<ReturnType<typeof setTimeout>>();

    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const itemCount = items.reduce((sum, item) => sum + Number(item.quantity), 0);

    // Inject keyframes into document head
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInFromLeft {
                from { transform: translateX(-100%); }
                to { transform: translateX(0); }
            }
        `;
        document.head.appendChild(style);
        return () => { style.remove(); };
    }, []);

    const switchFulfillment = (target: string) => {
        if (target === fulfillmentType) return;

        // Start overlay off-screen left, then animate in
        setOverlayTarget(target);
        setOverlayState('entering');

        // After enter animation (400ms), show briefly then exit
        overlayTimeout.current = setTimeout(() => {
            setFulfillmentType(target);
            setOverlayState('visible');

            // After visible (300ms), start exit animation to right
            overlayTimeout.current = setTimeout(() => {
                setOverlayState('exiting');

                // After exit animation (400ms), hide
                overlayTimeout.current = setTimeout(() => {
                    setOverlayState('hidden');
                }, 400);
            }, 300);
        }, 400);
    };

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
                {/* Segmented Toggle */}
                <div className="relative flex rounded-xl bg-surface-muted p-1">
                    <div
                        className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-all duration-300 ease-in-out"
                        style={{
                            left: fulfillmentType === 'pickup' ? '4px' : '50%',
                            width: 'calc(50% - 4px)',
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => switchFulfillment('pickup')}
                        className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-colors duration-300 ${
                            fulfillmentType === 'pickup' ? 'text-text' : 'text-text-muted'
                        }`}
                    >
                        <Store className="h-4 w-4" />
                        Pickup
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!isLoggedIn) {
                                setDeliverySheetOpen(true);
                                return;
                            }
                            switchFulfillment('delivery_dombi');
                        }}
                        className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-colors duration-300 ${
                            fulfillmentType === 'delivery_dombi' ? 'text-text' : 'text-text-muted'
                        }`}
                    >
                        <Truck className="h-4 w-4" />
                        Delivery
                    </button>
                </div>

                {/* Detail Card */}
                <div className="mt-3 overflow-hidden rounded-xl border border-border bg-white">
                    <div
                        className="flex transition-transform duration-300 ease-in-out"
                        style={{
                            transform: fulfillmentType === 'pickup' ? 'translateX(0)' : 'translateX(-100%)',
                            width: '200%',
                        }}
                    >
                        {/* Pickup Detail */}
                        <div className="w-1/2 shrink-0 p-4">
                            <div className="flex items-center gap-2">
                                <Store className="h-4 w-4 text-emerald-600" />
                                <span className="text-sm font-semibold text-text">Ambil di Outlet</span>
                            </div>
                            {nearestOutlet && (
                                <div className="mt-1.5 text-[11px] text-text-muted">
                                    {nearestOutlet.name} · {nearestOutlet.distance_km?.toFixed(1)} km
                                </div>
                            )}
                            <div className="mt-1 text-[11px] text-emerald-700 font-medium">Siap dalam 15-30 menit</div>
                        </div>
                        {/* Delivery Detail */}
                        <div className="w-1/2 shrink-0 p-4">
                            <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-emerald-600" />
                                <span className="text-sm font-semibold text-text">Kurir Dombi</span>
                            </div>
                            {deliveryPreview?.delivery_fee !== undefined && (
                                <div className="mt-1.5 text-[11px] text-text-muted">
                                    Ongkir: <span className="font-bold text-text">Rp {deliveryPreview.delivery_fee.toLocaleString('id-ID')}</span>
                                </div>
                            )}
                            <div className="mt-1 text-[11px] text-emerald-700 font-medium">Diantar dalam 30-60 menit</div>
                        </div>
                    </div>
                </div>

                <DeliveryLoginSheet open={deliverySheetOpen} onClose={() => setDeliverySheetOpen(false)} />
            </section>

            {/* Full-page overlay transition */}
            {overlayState !== 'hidden' && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-primary"
                    style={{
                        transform: overlayState === 'exiting'
                            ? 'translateX(100%)'
                            : 'translateX(0)',
                        ...(overlayState === 'entering' && {
                            animation: 'slideInFromLeft 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
                        }),
                        ...(overlayState === 'exiting' && {
                            transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                        }),
                    }}
                >
                    <div className="flex flex-col items-center gap-3 text-white">
                        {overlayTarget === 'pickup' ? (
                            <Store className="h-12 w-12" />
                        ) : (
                            <Truck className="h-12 w-12" />
                        )}
                        <div className="text-xl font-bold">
                            {overlayTarget === 'pickup' ? 'Ambil di Outlet' : 'Kurir Dombi'}
                        </div>
                        <div className="text-sm text-white/70">
                            {overlayTarget === 'pickup' ? 'Siap dalam 15-30 menit' : 'Diantar dalam 30-60 menit'}
                        </div>
                    </div>
                </div>
            )}
            {/* Spacer for sticky footer */}
            <div className="h-24" />
        </CustomerMobileLayout>
    );
}


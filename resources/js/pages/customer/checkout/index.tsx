import { Head, router, usePage } from '@inertiajs/react';
import { ShoppingCart, Store, Truck } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
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
                <h2 className="text-[13px] font-semibold text-text-subtle">Metode Pengiriman</h2>
                <div className="mt-3 space-y-3">
                    <FulfillmentCard
                        active={fulfillmentType === 'pickup'}
                        title="Ambil di Outlet"
                        icon={<Store className="h-5 w-5 text-text-muted" />}
                        description="Ambil langsung di outlet terdekat."
                        estimate="Siap dalam 15-30 menit"
                        onClick={() => setFulfillmentType('pickup')}
                        detail={nearestOutlet ? {
                            outletName: nearestOutlet.name,
                            distanceKm: nearestOutlet.distance_km,
                            stockAvailable: nearestOutlet.stock_available,
                        } : undefined}
                    />
                    <FulfillmentCard
                        active={fulfillmentType === 'delivery_dombi'}
                        title="Kurir Dombi"
                        icon={<Truck className="h-5 w-5 text-text-muted" />}
                        description="Diantar oleh kurir Dombi."
                        estimate="Diantar dalam 30-60 menit"
                        onClick={() => {
                            if (!isLoggedIn) {
                                setDeliverySheetOpen(true);

                                return;
                            }

                            setFulfillmentType('delivery_dombi');
                        }}
                        detail={deliveryPreview?.is_serviceable ? {
                            deliveryFee: deliveryPreview.delivery_fee,
                        } : undefined}
                    />
                    <DeliveryLoginSheet open={deliverySheetOpen} onClose={() => setDeliverySheetOpen(false)} />
                </div>
            </section>
            {/* Spacer for sticky footer */}
            <div className="h-24" />
        </CustomerMobileLayout>
    );
}

type FulfillmentDetail = {
    outletName?: string;
    distanceKm?: number;
    stockAvailable?: boolean;
    deliveryFee?: number;
};

function FulfillmentCard({ active, title, icon, description, estimate, onClick, detail }: { active: boolean; title: string; icon: ReactNode; description: string; estimate?: string; onClick: () => void; detail?: FulfillmentDetail }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`min-h-[88px] w-full rounded-xl p-4 text-left transition-all active:opacity-80 ${
                active
                    ? 'bg-emerald-50 ring-2 ring-emerald-500'
                    : 'bg-white border border-border'
            }`}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-text">{title}</div>
                    <div className="mt-1 text-xs leading-relaxed text-text-muted">{description}</div>
                    {estimate && (
                        <div className="mt-1.5 text-xs font-medium text-emerald-700">⏱ {estimate}</div>
                    )}
                    {detail?.outletName && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                            <span className="font-semibold text-text">{detail.outletName}</span>
                            {detail.distanceKm !== undefined && (
                                <>
                                    <span className="text-text-subtle">·</span>
                                    <span className="text-text-muted">{detail.distanceKm.toFixed(1)} km</span>
                                </>
                            )}
                            {detail.stockAvailable && (
                                <>
                                    <span className="text-text-subtle">·</span>
                                    <span className="font-semibold text-emerald-700">Stok tersedia</span>
                                </>
                            )}
                        </div>
                    )}
                    {detail?.deliveryFee !== undefined && (
                        <div className="mt-2 text-xs">
                            <span className="text-text-muted">Ongkir: </span>
                            <span className="font-bold text-text">Rp {detail.deliveryFee.toLocaleString('id-ID')}</span>
                        </div>
                    )}
                </div>
            </div>
        </button>
    );
}



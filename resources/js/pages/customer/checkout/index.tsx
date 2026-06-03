import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Store, Truck } from 'lucide-react';
import CheckoutItemCard from '@/components/customer/checkout-item-card';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { formatCurrency } from '@/lib/format';
import { useCart } from '@/lib/use-cart';

type CheckoutItem = {
    product_id: number;
    quantity: number;
    name: string;
    price: number;
    subtotal: number;
    image?: string | null;
};

export default function CheckoutIndex({ products, selectedProductId, draft, summary, nearestOutlet, deliveryPreview }: any) {
    const cart = useCart();
    const seeded = useRef(false);

    useEffect(() => {
        if (selectedProductId && !seeded.current) {
            seeded.current = true;

            if (cart.getQuantity(Number(selectedProductId)) === 0) {
                cart.addItem(Number(selectedProductId));
            }
        }
    }, [cart, selectedProductId]);

    const productMap = useMemo(
        () => new Map<number, any>(products.map((product: any) => [Number(product.id), product])),
        [products],
    );

    const items: CheckoutItem[] = cart.items.length > 0
        ? cart.items.map((item) => {
            const product = productMap.get(Number(item.product_id));
            const price = Number(product?.price ?? 0);

            return {
                product_id: Number(item.product_id),
                quantity: item.quantity,
                name: product?.name ?? 'Produk',
                price,
                subtotal: price * item.quantity,
                image: product?.image,
            };
        })
        : draft?.items ?? [];

    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const itemCount = items.reduce((sum, item) => sum + Number(item.quantity), 0);

    const initialFulfillmentType = draft?.fulfillment?.fulfillment_type;
    const form = useForm({
        items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        fulfillment_type: initialFulfillmentType === 'pickup' || initialFulfillmentType === 'delivery_dombi' ? initialFulfillmentType : '',
    });

    useEffect(() => {
        form.setData('items', cart.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })));
    }, [cart.items]);

    const submit = () => {
        form.post('/customer/checkout');
    };

    return (
        <CustomerMobileLayout
            hideTopBar
            hideCartBar
            hideBottomNav
            footerSlot={
                <StepButton
                    label="Lanjutkan"
                    disabled={items.length === 0 || !form.data.fulfillment_type || form.processing}
                    processing={form.processing}
                    onClick={submit}
                />
            }
        >
            <Head title="Checkout" />
            <StepHeader title="Checkout" step="1 dari 3" backHref="/customer/products" />

            <section className="mt-5">
                <h1 className="text-xl font-semibold text-slate-900">Pesanan Anda</h1>
                <p className="mt-1 text-sm text-slate-500">Periksa item dan pilih metode pengambilan sebelum melanjutkan.</p>
            </section>

            {items.length === 0 ? (
                <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-center">
                    <p className="text-sm font-semibold text-slate-900">Keranjang masih kosong</p>
                    <p className="mt-1 text-xs text-slate-500">Pilih produk terlebih dahulu untuk melanjutkan checkout.</p>
                    <button onClick={() => router.visit('/customer/products')} className="mt-4 min-h-11 rounded-lg bg-emerald-600 px-5 text-sm font-bold text-white">
                        Lihat Produk
                    </button>
                </section>
            ) : (
                <>
                    <section className="mt-5 rounded-xl border border-slate-200 bg-white px-4">
                        {items.map((item) => (
                            <CheckoutItemCard
                                key={item.product_id}
                                name={item.name}
                                price={item.price}
                                quantity={item.quantity}
                                image={item.image}
                                onQuantityChange={(quantity) => cart.setQuantity(item.product_id, quantity)}
                                onRemove={() => cart.removeItem(item.product_id)}
                            />
                        ))}
                    </section>

                    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            <span>Subtotal</span>
                            <span>{itemCount} item</span>
                        </div>
                        <div className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{formatCurrency(subtotal || summary?.subtotal || 0)}</div>
                    </section>
                </>
            )}

            <section className="mt-4">
                <h2 className="text-base font-semibold text-slate-900">Bagaimana Anda ingin menerima pesanan?</h2>
                <div className="mt-3 space-y-3">
                    <FulfillmentCard
                        active={form.data.fulfillment_type === 'pickup'}
                        title="Ambil di Outlet"
                        icon={<Store className="h-5 w-5 text-slate-600" />}
                        description="Ambil langsung di outlet yang melayani pesanan Anda."
                        onClick={() => form.setData('fulfillment_type', 'pickup')}
                        detail={nearestOutlet ? {
                            outletName: nearestOutlet.name,
                            distanceKm: nearestOutlet.distance_km,
                            stockAvailable: nearestOutlet.stock_available,
                        } : undefined}
                    />
                    <FulfillmentCard
                        active={form.data.fulfillment_type === 'delivery_dombi'}
                        title="Kurir Dombi"
                        icon={<Truck className="h-5 w-5 text-slate-600" />}
                        description="Diantar oleh kurir internal Dombi."
                        onClick={() => form.setData('fulfillment_type', 'delivery_dombi')}
                        detail={deliveryPreview?.is_serviceable ? {
                            deliveryFee: deliveryPreview.delivery_fee,
                        } : undefined}
                    />
                </div>

                {form.errors.fulfillment_type && <p className="mt-3 text-xs text-red-600">{form.errors.fulfillment_type}</p>}
                {form.errors.items && <p className="mt-2 text-xs text-red-600">{form.errors.items}</p>}
            </section>
        </CustomerMobileLayout>
    );
}

type FulfillmentDetail = {
    outletName?: string;
    distanceKm?: number;
    stockAvailable?: boolean;
    deliveryFee?: number;
};

function FulfillmentCard({ active, title, icon, description, onClick, detail }: { active: boolean; title: string; icon: ReactNode; description: string; onClick: () => void; detail?: FulfillmentDetail }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`min-h-[88px] w-full rounded-xl border p-4 text-left transition-all active:scale-[0.98] ${
                active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'
            }`}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{title}</div>
                    <div className="mt-1 text-xs leading-relaxed text-slate-500">{description}</div>
                    {detail?.outletName && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                            <span className="font-semibold text-slate-700">{detail.outletName}</span>
                            {detail.distanceKm !== undefined && (
                                <>
                                    <span className="text-slate-400">·</span>
                                    <span className="text-slate-600">{detail.distanceKm.toFixed(1)} km</span>
                                </>
                            )}
                            {detail.stockAvailable && (
                                <>
                                    <span className="text-slate-400">·</span>
                                    <span className="font-semibold text-emerald-700">✓ Stok tersedia</span>
                                </>
                            )}
                        </div>
                    )}
                    {detail?.deliveryFee !== undefined && (
                        <div className="mt-2 text-xs">
                            <span className="text-slate-500">Estimasi Ongkir: </span>
                            <span className="font-bold text-slate-900">Rp {detail.deliveryFee.toLocaleString('id-ID')}</span>
                        </div>
                    )}
                </div>
            </div>
        </button>
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

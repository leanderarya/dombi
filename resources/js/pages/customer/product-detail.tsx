import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { formatCurrency } from '@/lib/format';
import { useCart } from '@/lib/use-cart';

interface Variant {
    id: number;
    name: string;
    flavor: string | null;
    size: string | null;
    selling_price: number;
    is_active: boolean;
}

interface Family {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    variants: Variant[];
}

interface Props {
    family: Family;
}

export default function ProductDetail({ family }: Props) {
    const [selectedFlavor, setSelectedFlavor] = useState<string | null>(null);
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [toast, setToast] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);

    const cart = useCart();

    const flavors = [...new Set(family.variants.map(v => v.flavor).filter(Boolean))] as string[];
    const sizes = [...new Set(family.variants.map(v => v.size).filter(Boolean))] as string[];

    const effectiveFlavor = selectedFlavor ?? (flavors.length === 1 ? flavors[0] : null);
    const effectiveSize = selectedSize ?? (sizes.length === 1 ? sizes[0] : null);

    const selectedVariant = family.variants.find(v =>
        (flavors.length === 0 || v.flavor === effectiveFlavor) &&
        (sizes.length === 0 || v.size === effectiveSize)
    );

    const basePrice = selectedVariant?.selling_price ?? family.variants[0]?.selling_price ?? 0;

    const handleAddToCart = async () => {
        if (!selectedVariant || adding) return;

        setAdding(true);

        // Update frontend cart immediately (badge, floating bar)
        cart.addItem(selectedVariant.id, quantity);

        // Sync to backend session cart
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const response = await fetch('/customer/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify({
                    product_variant_id: selectedVariant.id,
                    quantity: quantity,
                }),
                credentials: 'same-origin',
            });

            if (response.ok) {
                const data = await response.json();
                const variantLabel = data.item?.variant_name
                    ? `${data.item.name} ${data.item.variant_name}`
                    : data.item?.name ?? 'Produk';
                setToast(`${variantLabel} ditambahkan ke keranjang.`);
            } else {
                setToast('Produk ditambahkan ke keranjang.');
            }
        } catch {
            // Frontend cart already updated, session sync can retry
            setToast('Produk ditambahkan ke keranjang.');
        }

        setAdding(false);
        setQuantity(1);

        // Auto-hide toast
        setTimeout(() => setToast(null), 3000);
    };

    return (
        <>
            <Head title={family.name} />

            <div className="min-h-dvh bg-[#fbf9f7]">
                {/* Header */}
                <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/95 backdrop-blur">
                    <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
                        <Link
                            href="/customer/products"
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100"
                        >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900 truncate">{family.name}</div>
                            {family.brand && <div className="text-xs text-zinc-500">{family.brand}</div>}
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-lg px-4 pt-4 pb-40">
                    {/* Toast */}
                    {toast && (
                        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                            {toast}
                        </div>
                    )}

                    {/* Product Image */}
                    <div className="mb-4 flex h-48 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-zinc-50">
                        <span className="text-6xl">&#129371;</span>
                    </div>

                    {/* Description */}
                    {family.description && (
                        <p className="mb-5 text-sm text-zinc-600 leading-relaxed">{family.description}</p>
                    )}

                    {/* Flavor Selection */}
                    {flavors.length > 0 && (
                        <section>
                            <div className="flex items-baseline justify-between">
                                <h3 className="text-sm font-semibold text-slate-900">Pilih Rasa</h3>
                                <span className="text-[11px] font-medium text-slate-400">Wajib, Pilih 1</span>
                            </div>
                            <div className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-100 bg-white">
                                {flavors.map((flavor) => {
                                    const isSelected = effectiveFlavor === flavor;
                                    const hasVariant = family.variants.some(v =>
                                        v.flavor === flavor &&
                                        (sizes.length === 0 || v.size === effectiveSize)
                                    );

                                    return (
                                        <button
                                            key={flavor}
                                            onClick={() => setSelectedFlavor(flavor)}
                                            disabled={!hasVariant}
                                            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-zinc-50 disabled:opacity-40"
                                        >
                                            <RadioDot checked={isSelected} disabled={!hasVariant} />
                                            <span className={`flex-1 text-sm ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                                                {flavor}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Size Selection */}
                    {sizes.length > 0 && (
                        <section className="mt-5">
                            <div className="flex items-baseline justify-between">
                                <h3 className="text-sm font-semibold text-slate-900">Pilih Ukuran</h3>
                                <span className="text-[11px] font-medium text-slate-400">Wajib, Pilih 1</span>
                            </div>
                            <div className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-100 bg-white">
                                {sizes.map((size) => {
                                    const isSelected = effectiveSize === size;
                                    const hasVariant = family.variants.some(v =>
                                        v.size === size &&
                                        (flavors.length === 0 || v.flavor === effectiveFlavor)
                                    );
                                    const sizeVariant = family.variants.find(v =>
                                        v.size === size &&
                                        (flavors.length === 0 || v.flavor === effectiveFlavor)
                                    );
                                    const priceDiff = sizeVariant
                                        ? (sizeVariant.selling_price - basePrice)
                                        : 0;

                                    return (
                                        <button
                                            key={size}
                                            onClick={() => setSelectedSize(size)}
                                            disabled={!hasVariant}
                                            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-zinc-50 disabled:opacity-40"
                                        >
                                            <RadioDot checked={isSelected} disabled={!hasVariant} />
                                            <span className={`flex-1 text-sm ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                                                {size}
                                            </span>
                                            {sizeVariant && (
                                                <PriceDiff diff={priceDiff} selected={isSelected} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Single variant (no flavor/size) */}
                    {flavors.length === 0 && sizes.length === 0 && family.variants.length > 0 && (
                        <section>
                            <div className="flex items-baseline justify-between">
                                <h3 className="text-sm font-semibold text-slate-900">Varian</h3>
                            </div>
                            <div className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-100 bg-white">
                                {family.variants.map((variant) => (
                                    <button
                                        key={variant.id}
                                        onClick={() => {
                                            setSelectedFlavor(null);
                                            setSelectedSize(null);
                                        }}
                                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-zinc-50"
                                    >
                                        <RadioDot checked={selectedVariant?.id === variant.id} />
                                        <span className={`flex-1 text-sm ${selectedVariant?.id === variant.id ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                                            {variant.name}
                                        </span>
                                        <span className="text-sm tabular-nums text-slate-500">{formatCurrency(variant.selling_price)}</span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Variant Summary */}
                    {selectedVariant && (
                        <section className="mt-5">
                            <div className="rounded-xl border border-zinc-100 bg-white p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        {effectiveFlavor && (
                                            <div className="text-sm font-semibold text-slate-900">{effectiveFlavor}</div>
                                        )}
                                        {effectiveSize && (
                                            <div className="mt-0.5 text-xs text-slate-500">{effectiveSize}</div>
                                        )}
                                        {!effectiveFlavor && !effectiveSize && (
                                            <div className="text-sm font-semibold text-slate-900">{selectedVariant.name}</div>
                                        )}
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-sm font-bold tabular-nums text-slate-900">
                                            {formatCurrency(selectedVariant.selling_price)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                </main>

                {/* Sticky CTA */}
                {selectedVariant && (
                    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
                        <div className="mx-auto flex max-w-lg items-center gap-3 px-4">
                            {/* Quantity Stepper */}
                            <div className="flex items-center rounded-xl border border-zinc-200 bg-white">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="flex h-11 w-11 items-center justify-center text-zinc-600 active:bg-zinc-50 rounded-l-xl"
                                >
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" d="M5 12h14" />
                                    </svg>
                                </button>
                                <span className="w-10 text-center text-sm font-bold text-slate-900">{quantity}</span>
                                <button
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="flex h-11 w-11 items-center justify-center text-zinc-600 active:bg-zinc-50 rounded-r-xl"
                                >
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                                    </svg>
                                </button>
                            </div>

                            {/* Add Button */}
                            <button
                                onClick={handleAddToCart}
                                disabled={adding}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white active:bg-emerald-700 shadow-sm disabled:opacity-60"
                            >
                                <span>{adding ? 'Menambahkan...' : 'Tambah'}</span>
                                <span className="text-white/80">&middot;</span>
                                <span>{formatCurrency(selectedVariant.selling_price * quantity)}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function RadioDot({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
    if (checked) {
        return (
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-emerald-600">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            </div>
        );
    }

    return (
        <div className={`h-5 w-5 shrink-0 rounded-full border-2 ${disabled ? 'border-zinc-200' : 'border-zinc-300'}`} />
    );
}

function PriceDiff({ diff, selected }: { diff: number; selected: boolean }) {
    if (diff === 0) return null;

    const prefix = diff > 0 ? '+' : '';
    return (
        <span className={`text-xs tabular-nums ${selected ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
            {prefix}{formatCurrency(diff)}
        </span>
    );
}

import { Head, Link } from '@inertiajs/react';
import { ShoppingCart } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/format';
import { sizeToMl } from '@/lib/size';
import { useCart } from '@/lib/use-cart';

interface Variant {
    id: number;
    name: string;
    flavor: string | null;
    size: string | null;
    selling_price: number;
    is_active: boolean;
    available_stock?: number;
    stock_status?: string;
}

interface Family {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    variants: Variant[];
}

interface OtherFamily {
    id: number;
    name: string;
    brand: string | null;
    variants: { selling_price: number }[];
}

interface Props {
    family: Family;
    otherFamilies?: OtherFamily[];
}

function findSmallestSize(variants: Variant[]): string | null {
    const sizes = variants.map((v) => v.size).filter(Boolean) as string[];

    if (sizes.length === 0) {
return null;
}

    return sizes.reduce((smallest, current) =>
        sizeToMl(current) < sizeToMl(smallest) ? current : smallest,
    );
}

function findSoleFlavor(variants: Variant[]): string | null {
    const flavors = [...new Set(variants.map((v) => v.flavor).filter(Boolean))] as string[];

    return flavors.length === 1 ? flavors[0] : null;
}

export default function ProductDetail({ family, otherFamilies = [] }: Props) {
    return <ProductDetailInner key={family.id} family={family} otherFamilies={otherFamilies} />;
}

function ProductDetailInner({ family, otherFamilies = [] }: Props) {
    const cart = useCart();

    const flavors = useMemo(
        () => [...new Set(family.variants.map((v) => v.flavor).filter(Boolean))] as string[],
        [family.variants],
    );

    const sortedSizes = useMemo(
        () =>
            ([...new Set(family.variants.map((v) => v.size).filter(Boolean))] as string[]).sort(
                (a, b) => sizeToMl(a) - sizeToMl(b),
            ),
        [family.variants],
    );

    const defaultFlavor = useMemo(() => findSoleFlavor(family.variants), [family.variants]);
    const defaultSize = useMemo(() => findSmallestSize(family.variants), [family.variants]);

    const familyIdRef = useRef(family.id);
    const [overriddenFlavor, setOverriddenFlavor] = useState<string | null>(null);
    const [overriddenSize, setOverriddenSize] = useState<string | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [toast, setToast] = useState<{ message: string; variantName: string } | null>(null);
    const [adding, setAdding] = useState(false);

    if (familyIdRef.current !== family.id) {
        familyIdRef.current = family.id;
        setOverriddenFlavor(null);
        setOverriddenSize(null);
    }

    const effectiveFlavor = overriddenFlavor ?? defaultFlavor;
    const effectiveSize = overriddenSize ?? defaultSize;

    const selectedVariant = family.variants.find(
        (v) =>
            (flavors.length === 0 || v.flavor === effectiveFlavor) &&
            (sortedSizes.length === 0 || v.size === effectiveSize),
    );

    const startingPrice = useMemo(
        () => Math.min(...family.variants.filter((v) => v.is_active).map((v) => v.selling_price)),
        [family.variants],
    );

    const stockStatus = selectedVariant?.stock_status ?? 'available';
    const isOutOfStock = stockStatus === 'out_of_stock';

    const showFlavorSelector = flavors.length > 1;
    const showSizeSelector = sortedSizes.length > 1;

    const variantSummary = useMemo(() => {
        const parts: string[] = [];

        if (effectiveFlavor) {
parts.push(effectiveFlavor);
}

        if (effectiveSize) {
parts.push(effectiveSize);
}

        return parts.join(' \u2022 ');
    }, [effectiveFlavor, effectiveSize]);

    const handleAddToCart = async () => {
        if (!selectedVariant || adding || isOutOfStock) {
return;
}

        setAdding(true);

        cart.addItem(selectedVariant.id, quantity);

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
                const label = data.item?.variant_name
                    ? `${data.item.name} ${data.item.variant_name}`
                    : data.item?.name ?? 'Produk';
                setToast({ message: `${label} ditambahkan ke keranjang.`, variantName: label });
            } else {
                setToast({ message: 'Produk ditambahkan ke keranjang.', variantName: '' });
            }
        } catch {
            setToast({ message: 'Produk ditambahkan ke keranjang.', variantName: '' });
        }

        setAdding(false);
        setQuantity(1);
        setTimeout(() => setToast(null), 4000);
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
                        <Link href="/customer/checkout" className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100">
                            <ShoppingCart className="h-5 w-5" />
                            {cart.totalItems > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                                    {cart.totalItems > 9 ? '9+' : cart.totalItems}
                                </span>
                            )}
                        </Link>
                    </div>
                </header>

                <main className="mx-auto max-w-lg px-4 pt-4 pb-32">
                    {/* Toast */}
                    {toast && (
                        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-sm font-medium text-emerald-800">{toast.message}</span>
                                </div>
                                <Link
                                    href="/customer/checkout"
                                    className="shrink-0 text-xs font-bold text-emerald-700 active:text-emerald-900"
                                >
                                    Lihat Keranjang
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Product Image */}
                    <div className="mb-5 flex h-72 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-zinc-50">
                        <span className="text-8xl">&#129371;</span>
                    </div>

                    {/* Product Name */}
                    <div className="mb-1">
                        <h1 className="text-xl font-bold text-slate-900">{family.name}</h1>
                    </div>

                    {/* Variant Summary (compact: "Original • 250ml") */}
                    {variantSummary && (
                        <div className="mt-0.5">
                            <span className="text-sm text-zinc-500">{variantSummary}</span>
                        </div>
                    )}

                    {/* Price */}
                    {selectedVariant ? (
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl font-bold tabular-nums text-emerald-700">
                                {formatCurrency(selectedVariant.selling_price)}
                            </span>
                            <StockBadge status={stockStatus} />
                        </div>
                    ) : startingPrice > 0 ? (
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl font-bold tabular-nums text-emerald-700">
                                Mulai {formatCurrency(startingPrice)}
                            </span>
                        </div>
                    ) : null}

                    {/* Description */}
                    {family.description && (
                        <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{family.description}</p>
                    )}

                    {/* Flavor Selection (hidden when only one flavor) */}
                    {showFlavorSelector && (
                        <section className="mt-6">
                            <div className="flex items-baseline justify-between">
                                <h3 className="text-sm font-semibold text-slate-900">Pilih Rasa</h3>
                                <span className="text-[11px] font-medium text-slate-400">Wajib, Pilih 1</span>
                            </div>
                            <div className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-100 bg-white">
                                {flavors.map((flavor) => {
                                    const isSelected = effectiveFlavor === flavor;
                                    const hasVariant = family.variants.some(
                                        (v) => v.flavor === flavor && (sortedSizes.length === 0 || v.size === effectiveSize),
                                    );

                                    return (
                                        <button
                                            key={flavor}
                                            onClick={() => setOverriddenFlavor(flavor)}
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

                    {/* Size Selection (hidden when only one size) */}
                    {showSizeSelector && (
                        <section className="mt-5">
                            <div className="flex items-baseline justify-between">
                                <h3 className="text-sm font-semibold text-slate-900">Pilih Ukuran</h3>
                                <span className="text-[11px] font-medium text-slate-400">Wajib, Pilih 1</span>
                            </div>
                            <div className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-100 bg-white">
                                {sortedSizes.map((size) => {
                                    const isSelected = effectiveSize === size;
                                    const hasVariant = family.variants.some(
                                        (v) => v.size === size && (flavors.length === 0 || v.flavor === effectiveFlavor),
                                    );
                                    const sizeVariant = family.variants.find(
                                        (v) => v.size === size && (flavors.length === 0 || v.flavor === effectiveFlavor),
                                    );
                                    const basePrice = selectedVariant?.selling_price ?? family.variants[0]?.selling_price ?? 0;
                                    const priceDiff = sizeVariant ? sizeVariant.selling_price - basePrice : 0;

                                    return (
                                        <button
                                            key={size}
                                            onClick={() => setOverriddenSize(size)}
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

                    {/* Single variant (no flavor/size dimensions) */}
                    {flavors.length === 0 && sortedSizes.length === 0 && family.variants.length > 0 && (
                        <section className="mt-5">
                            <div className="flex items-baseline justify-between">
                                <h3 className="text-sm font-semibold text-slate-900">Varian</h3>
                            </div>
                            <div className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-100 bg-white">
                                {family.variants.map((variant) => (
                                    <button
                                        key={variant.id}
                                        onClick={() => {
                                            setOverriddenFlavor(null);
                                            setOverriddenSize(null);
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

                    {/* Quantity */}
                    {selectedVariant && (
                        <section className="mt-6">
                            <h3 className="text-sm font-semibold text-slate-900">Jumlah</h3>
                            <div className="mt-3 flex items-center gap-4">
                                <div className="flex items-center rounded-xl border border-zinc-200 bg-white">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="flex h-11 w-11 items-center justify-center text-zinc-600 active:bg-zinc-50 rounded-l-xl"
                                    >
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" d="M5 12h14" />
                                        </svg>
                                    </button>
                                    <span className="w-12 text-center text-sm font-bold text-slate-900">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(quantity + 1)}
                                        className="flex h-11 w-11 items-center justify-center text-zinc-600 active:bg-zinc-50 rounded-r-xl"
                                    >
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                                        </svg>
                                    </button>
                                </div>
                                <span className="text-sm text-zinc-500">
                                    Total <span className="font-bold text-slate-900">{formatCurrency(selectedVariant.selling_price * quantity)}</span>
                                </span>
                            </div>
                        </section>
                    )}

                    {/* Other Products */}
                    {otherFamilies.length > 0 && (
                        <section className="mt-8">
                            <h3 className="text-sm font-semibold text-slate-900">Produk Lainnya</h3>
                            <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
                                {otherFamilies.map((other) => {
                                    const minPrice = Math.min(...(other.variants?.map((v) => v.selling_price) ?? [0]));

                                    return (
                                        <Link
                                            key={other.id}
                                            href={`/customer/products/${other.id}`}
                                            className="flex w-36 shrink-0 flex-col rounded-xl border border-zinc-100 bg-white overflow-hidden active:bg-zinc-50"
                                        >
                                            <div className="flex h-20 items-center justify-center bg-gradient-to-br from-emerald-50 to-zinc-50">
                                                <span className="text-3xl">&#129371;</span>
                                            </div>
                                            <div className="p-2">
                                                <div className="text-xs font-semibold text-slate-900 leading-tight truncate">{other.name}</div>
                                                <div className="mt-1 text-[11px] font-bold text-emerald-700">
                                                    {minPrice > 0 ? `Mulai ${formatCurrency(minPrice)}` : ''}
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </main>

                {/* Sticky CTA */}
                {selectedVariant && (
                    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
                        <div className="mx-auto max-w-lg px-4">
                            <button
                                onClick={handleAddToCart}
                                disabled={adding || isOutOfStock}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white active:bg-emerald-700 shadow-sm disabled:opacity-60"
                            >
                                {isOutOfStock ? (
                                    <span>Habis</span>
                                ) : (
                                    <>
                                        <span>{adding ? 'Menambahkan...' : 'Tambah ke Keranjang'}</span>
                                        <span className="text-white/80">&middot;</span>
                                        <span>{formatCurrency(selectedVariant.selling_price * quantity)}</span>
                                    </>
                                )}
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
    if (diff === 0) {
return null;
}

    const prefix = diff > 0 ? '+' : '';

    return (
        <span className={`text-xs tabular-nums ${selected ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
            {prefix}{formatCurrency(diff)}
        </span>
    );
}

function StockBadge({ status }: { status: string }) {
    if (status === 'out_of_stock') {
        return (
            <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                Habis
            </span>
        );
    }

    if (status === 'low') {
        return (
            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Stok Terbatas
            </span>
        );
    }

    return (
        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            Tersedia
        </span>
    );
}

import { Head, Link } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForeGreenHeader from '@/components/customer/fore-green-header';
import { formatCurrency } from '@/lib/format';
import { sizeToMl } from '@/lib/size';
import { useCart } from '@/lib/use-cart';
import { getCsrfToken } from '@/lib/csrf';

/* ─── Types ────────────────────────────────────────────────── */

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

/* ─── Helpers ──────────────────────────────────────────────── */

function findSmallestSize(variants: Variant[]): string | null {
    const sizes = variants.map((v) => v.size).filter(Boolean) as string[];
    return sizes.length === 0 ? null : sizes.reduce((a, b) => sizeToMl(a) < sizeToMl(b) ? a : b);
}

function findSoleFlavor(variants: Variant[]): string | null {
    const flavors = [...new Set(variants.map((v) => v.flavor).filter(Boolean))] as string[];
    return flavors.length === 1 ? flavors[0] : null;
}

/* ─── Hook: useAddToCart ───────────────────────────────────── */

function useAddToCart() {
    const cart = useCart();
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);
    const [toast, setToast] = useState<{ name: string; qty: number } | null>(null);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    const addToCart = useCallback(async (variant: Variant, qty: number, familyName: string) => {
        if (adding || added) return;
        setAdding(true);
        cart.addItem(variant.id, qty, variant.selling_price);

        try {
            const res = await fetch('/customer/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': getCsrfToken() },
                body: JSON.stringify({ product_variant_id: variant.id, quantity: qty }),
                credentials: 'same-origin',
            });
            await res.json();
        } catch { /* frontend cart already updated */ }

        setAdding(false);
        setAdded(true);
        setToast({ name: variant.name ?? familyName, qty });

        timers.current.push(setTimeout(() => setAdded(false), 1500));
        timers.current.push(setTimeout(() => setToast(null), 2500));
    }, [cart, adding, added]);

    return { addToCart, adding, added, toast };
}

/* ─── Main ─────────────────────────────────────────────────── */

export default function ProductDetail({ family, otherFamilies = [], outletId }: { family: Family; otherFamilies?: OtherFamily[]; outletId?: number | null }) {
    return <ProductDetailInner key={family.id} family={family} otherFamilies={otherFamilies} outletId={outletId} />;
}

function ProductDetailInner({ family, otherFamilies = [], outletId }: { family: Family; otherFamilies?: OtherFamily[]; outletId?: number | null }) {
    const { addToCart, adding, added, toast } = useAddToCart();

    const flavors = useMemo(() => [...new Set(family.variants.map((v) => v.flavor).filter(Boolean))] as string[], [family.variants]);
    const sortedSizes = useMemo(() => ([...new Set(family.variants.map((v) => v.size).filter(Boolean))] as string[]).sort((a, b) => sizeToMl(a) - sizeToMl(b)), [family.variants]);
    const defaultFlavor = useMemo(() => findSoleFlavor(family.variants), [family.variants]);
    const defaultSize = useMemo(() => findSmallestSize(family.variants), [family.variants]);
    const startingPrice = useMemo(() => Math.min(...family.variants.filter((v) => v.is_active).map((v) => v.selling_price)), [family.variants]);

    const [overriddenFlavor, setOverriddenFlavor] = useState<string | null>(null);
    const [overriddenSize, setOverriddenSize] = useState<string | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [maxQuantity, setMaxQuantity] = useState(999);

    // Reset on family change (key-based, render-phase safe)
    const familyIdRef = useRef(family.id);
    if (familyIdRef.current !== family.id) {
        familyIdRef.current = family.id;
        setOverriddenFlavor(null);
        setOverriddenSize(null);
    }

    const effectiveFlavor = overriddenFlavor ?? defaultFlavor;
    const effectiveSize = overriddenSize ?? defaultSize;
    const selectedVariant = family.variants.find((v) =>
        (flavors.length === 0 || v.flavor === effectiveFlavor) &&
        (sortedSizes.length === 0 || v.size === effectiveSize),
    );
    const stockStatus = selectedVariant?.stock_status ?? 'available';
    const isOutOfStock = stockStatus === 'out_of_stock';
    const variantSummary = [effectiveFlavor, effectiveSize].filter(Boolean).join(' • ');
    const showFlavorSelector = flavors.length > 1;
    const showSizeSelector = sortedSizes.length > 1;
    const effectiveMax = Math.min(maxQuantity, selectedVariant?.available_stock ?? 999);

    const handleAdd = () => {
        if (!selectedVariant || isOutOfStock) return;
        addToCart(selectedVariant, quantity, family.name);
        setQuantity(1);
    };

    return (
        <>
            <Head title={family.name} />
            <div className="min-h-dvh bg-background">
                <div className="bg-primary">
                    <div className="px-4 pb-4 pt-safe">
                        <div className="pt-3">
                            <ForeGreenHeader title={family.name} backHref="/customer/products">
                                {family.brand && <p className="mt-1 text-center text-[11px] text-white/60">{family.brand}</p>}
                            </ForeGreenHeader>
                        </div>
                    </div>
                </div>

                {toast && <AddToCartToast name={toast.name} />}

                <main className="mx-auto max-w-lg px-4 pt-4 pb-32">
                    <div className="mb-5 flex h-72 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-zinc-50">
                        <span className="text-8xl">&#129371;</span>
                    </div>

                    <h1 className="text-xl font-bold text-text">{family.name}</h1>
                    {variantSummary && <span className="mt-0.5 text-sm text-text-muted">{variantSummary}</span>}

                    {selectedVariant ? (
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl font-bold tabular-nums text-emerald-700">{formatCurrency(selectedVariant.selling_price)}</span>
                            <StockBadge status={stockStatus} />
                        </div>
                    ) : startingPrice > 0 ? (
                        <div className="mt-1">
                            <div className="text-sm text-text-muted">Mulai</div>
                            <div className="text-2xl font-bold tabular-nums text-emerald-700">{formatCurrency(startingPrice)}</div>
                        </div>
                    ) : null}

                    {family.description && <p className="mt-3 text-sm text-text-muted leading-relaxed">{family.description}</p>}

                    {showFlavorSelector && (
                        <VariantSelector title="Pilih Rasa" subtitle="Wajib, Pilih 1" options={flavors.map((f) => ({
                            key: f, label: f, selected: effectiveFlavor === f,
                            hasVariant: family.variants.some((v) => v.flavor === f && (sortedSizes.length === 0 || v.size === effectiveSize)),
                            onSelect: () => setOverriddenFlavor(f),
                        }))} />
                    )}

                    {showSizeSelector && (
                        <VariantSelector title="Pilih Ukuran" subtitle="Wajib, Pilih 1" options={sortedSizes.map((s) => {
                            const v = family.variants.find((v) => v.size === s && (flavors.length === 0 || v.flavor === effectiveFlavor));
                            const basePrice = selectedVariant?.selling_price ?? family.variants[0]?.selling_price ?? 0;
                            return {
                                key: s, label: s, selected: effectiveSize === s,
                                hasVariant: family.variants.some((v) => v.size === s && (flavors.length === 0 || v.flavor === effectiveFlavor)),
                                onSelect: () => setOverriddenSize(s),
                                right: v ? <PriceDiff diff={v.selling_price - basePrice} selected={effectiveSize === s} /> : undefined,
                            };
                        })} />
                    )}

                    {flavors.length === 0 && sortedSizes.length === 0 && family.variants.length > 0 && (
                        <VariantSelector title="Varian" options={family.variants.map((v) => ({
                            key: v.id, label: v.name, selected: selectedVariant?.id === v.id,
                            hasVariant: true, onSelect: () => { setOverriddenFlavor(null); setOverriddenSize(null); },
                            right: <span className="text-sm tabular-nums text-text-muted">{formatCurrency(v.selling_price)}</span>,
                        }))} />
                    )}

                    {selectedVariant && (
                        <QuantitySelector
                            quantity={quantity}
                            max={effectiveMax}
                            lowStock={selectedVariant.stock_status === 'low' ? selectedVariant.available_stock : undefined}
                            onChange={setQuantity}
                            total={formatCurrency(selectedVariant.selling_price * quantity)}
                        />
                    )}

                    {otherFamilies.length > 0 && <OtherProducts families={otherFamilies} outletId={outletId} />}
                </main>

                {selectedVariant && (
                    <StickyCTA
                        isOutOfStock={isOutOfStock}
                        adding={adding}
                        added={added}
                        price={formatCurrency(selectedVariant.selling_price * quantity)}
                        onAdd={handleAdd}
                    />
                )}
            </div>
        </>
    );
}

/* ─── Sub-components ───────────────────────────────────────── */

function AddToCartToast({ name }: { name: string }) {
    return (
        <div className="fixed right-4 z-50 max-w-xs" style={{ top: 'calc(env(safe-area-inset-top,0) + 60px)', animation: 'toastSlideIn 0.3s ease-out' }}>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-lg">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-text truncate">{name}</div>
                    <div className="text-xs text-text-muted">Ditambahkan ke keranjang</div>
                </div>
            </div>
        </div>
    );
}

interface VariantOption {
    key: string | number;
    label: string;
    selected: boolean;
    hasVariant: boolean;
    onSelect: () => void;
    right?: React.ReactNode;
}

function VariantSelector({ title, subtitle, options }: { title: string; subtitle?: string; options: VariantOption[] }) {
    return (
        <section className="mt-5">
            <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-text">{title}</h3>
                {subtitle && <span className="text-xs text-text-subtle">{subtitle}</span>}
            </div>
            <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-white">
                {options.map((opt) => (
                    <button key={opt.key} onClick={opt.onSelect} disabled={!opt.hasVariant} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:opacity-80 disabled:opacity-40">
                        <RadioDot checked={opt.selected} disabled={!opt.hasVariant} />
                        <span className={`flex-1 text-sm ${opt.selected ? 'font-semibold text-text' : 'text-text'}`}>{opt.label}</span>
                        {opt.right}
                    </button>
                ))}
            </div>
        </section>
    );
}

function QuantitySelector({ quantity, max, lowStock, onChange, total }: { quantity: number; max: number; lowStock?: number; onChange: (q: number) => void; total: string }) {
    return (
        <section className="mt-6">
            <h3 className="text-sm font-semibold text-text">Jumlah</h3>
            {lowStock !== undefined && <p className="mt-1 text-[11px] text-amber-600">Stok tersisa {lowStock}</p>}
            <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center rounded-xl border border-border bg-white">
                    <button onClick={() => onChange(Math.max(1, quantity - 1))} className="flex h-11 w-11 items-center justify-center text-text-muted active:opacity-80 rounded-l-xl">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" d="M5 12h14" /></svg>
                    </button>
                    <span className="w-12 text-center text-sm font-bold text-text">{quantity}</span>
                    <button onClick={() => onChange(Math.min(max, quantity + 1))} disabled={quantity >= max} className="flex h-11 w-11 items-center justify-center text-text-muted active:opacity-80 rounded-r-xl disabled:opacity-30">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
                    </button>
                </div>
                {max < 999 && <span className="text-xs text-text-muted">Maks: {max}</span>}
                <span className="text-sm text-text-muted">Total <span className="font-bold text-text">{total}</span></span>
            </div>
        </section>
    );
}

function OtherProducts({ families, outletId }: { families: OtherFamily[]; outletId?: number | null }) {
    return (
        <section className="mt-8">
            <h3 className="text-sm font-semibold text-text">Produk Lainnya</h3>
            <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
                {families.map((other) => {
                    const minPrice = Math.min(...(other.variants?.map((v) => v.selling_price) ?? [0]));
                    const href = outletId ? `/customer/products/${other.id}?outlet_id=${outletId}` : `/customer/products/${other.id}`;

                    return (
                        <Link key={other.id} href={href} className="flex w-36 shrink-0 flex-col rounded-xl border border-border bg-white overflow-hidden active:opacity-80">
                            <div className="flex h-20 items-center justify-center bg-gradient-to-br from-emerald-50 to-zinc-50"><span className="text-3xl">&#129371;</span></div>
                            <div className="p-2">
                                <div className="text-xs font-semibold text-text leading-tight truncate">{other.name}</div>
                                {minPrice > 0 && (
                                    <div className="mt-1">
                                        <div className="text-[10px] text-text-muted leading-tight">Mulai</div>
                                        <div className="text-xs font-bold tabular-nums text-emerald-700">{formatCurrency(minPrice)}</div>
                                    </div>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}

function StickyCTA({ isOutOfStock, adding, added, price, onAdd }: { isOutOfStock: boolean; adding: boolean; added: boolean; price: string; onAdd: () => void }) {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white/95 backdrop-blur pb-[calc(0.75rem+env(safe-area-inset-bottom,0))] pt-3">
            <div className="mx-auto max-w-lg px-4">
                <button onClick={onAdd} disabled={adding || isOutOfStock || added} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-200 active:opacity-80 disabled:opacity-60 ${added ? 'bg-emerald-500' : 'bg-emerald-600'}`}>
                    {isOutOfStock ? <span>Habis</span> : added ? (
                        <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            Ditambahkan!
                        </span>
                    ) : (
                        <>
                            <span>{adding ? 'Menambahkan...' : 'Tambah ke Keranjang'}</span>
                            <span className="text-white/80">&middot;</span>
                            <span>{price}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

function RadioDot({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
    if (checked) return <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-emerald-600"><div className="h-2.5 w-2.5 rounded-full bg-emerald-600" /></div>;
    return <div className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />;
}

function PriceDiff({ diff, selected }: { diff: number; selected: boolean }) {
    if (diff === 0) return null;
    return <span className={`text-xs tabular-nums ${selected ? 'font-semibold text-emerald-700' : 'text-text-subtle'}`}>{diff > 0 ? '+' : ''}{formatCurrency(diff)}</span>;
}

function StockBadge({ status }: { status: string }) {
    if (status === 'out_of_stock') return <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Habis</span>;
    if (status === 'low') return <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Stok Terbatas</span>;
    return <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Tersedia</span>;
}

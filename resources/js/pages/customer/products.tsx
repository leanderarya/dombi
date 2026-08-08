import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    Heart,
    Plus,
    Store,
    ThumbsUp,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import CustomerBottomNav from '@/components/customer/bottom-nav';
import CollapsedOutletBar from '@/components/customer/collapsed-outlet-bar';
import CustomerLocationBootstrap from '@/components/customer/customer-location-bootstrap';
import DeliveryLoginSheet from '@/components/customer/delivery-login-sheet';
import FloatingCartBar from '@/components/customer/floating-cart-bar';
import OutletSheet from '@/components/customer/outlet-sheet';
import ProductImage from '@/components/customer/product-image';
import SizeSelectorSheet from '@/components/customer/size-selector-sheet';
import OutletProvider, { useOutlet } from '@/contexts/outlet-context';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { useFulfillmentOverlay } from '@/hooks/use-fulfillment-overlay';
import { useProducts } from '@/hooks/use-products';
import type { Family } from '@/hooks/use-products';
import { mutationFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { sizeToMl } from '@/lib/size';
import { useCart } from '@/lib/use-cart';
import { useFavorites } from '@/lib/use-favorites';
import FavoritesProvider from '@/providers/favorites-provider';

/* ─── Derived types ────────────────────────────────────────── */

interface FlavorGroup {
    flavor: string | null;
    familyId: number;
    familyName: string;
    familyDescription: string | null;
    variants: Family['variants'];
    lowestPrice: number;
    displayLabel: string;
    representativeVariant: Family['variants'][number];
}

interface FamilySection {
    familyId: number;
    familyName: string;
    flavorGroups: FlavorGroup[];
    totalVariants: number;
}

/* ─── Main ─────────────────────────────────────────────────── */

function ProductsInner() {
    const { auth } = usePage().props as any;
    const isLoggedIn = !!auth?.user;
    const { selectedOutlet, loading: outletLoading } = useOutlet();
    const { families, loading, error } = useProducts(
        selectedOutlet?.id ?? null,
        outletLoading,
    );
    const { fulfillmentType, switchTo } = useFulfillmentOverlay();
    const { totalItems } = useCart();
    useFlashToast();

    const [activeFilter, setActiveFilter] = useState('all');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [outletSheetOpen, setOutletSheetOpen] = useState(false);
    const [deliveryLoginOpen, setDeliveryLoginOpen] = useState(false);
    const [sheetData, setSheetData] = useState<{
        variants: Family['variants'];
        flavor: string;
        family: string;
    }>({ variants: [], flavor: '', family: '' });

    const sentinelRef = useRef<HTMLDivElement>(null);
    const [showBar, setShowBar] = useState(false);
    const [barSheetOpen, setBarSheetOpen] = useState(false);

    useEffect(() => {
        if (!sentinelRef.current) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => setShowBar(!entry.isIntersecting),
            { threshold: 0, rootMargin: '-8px 0px 0px 0px' },
        );

        observer.observe(sentinelRef.current);

        return () => observer.disconnect();
    }, []);

    /* ── Filter options from families ── */
    const filterOptions = useMemo(() => {
        return families.map((f) => ({ key: String(f.id), label: f.name }));
    }, [families]);

    /* ── Sections ── */
    const familySections = useMemo(
        () => buildSections(families, activeFilter),
        [families, activeFilter],
    );

    /* ── Recommendations (flatten active variants) ── */
    const recommendations = useMemo(
        () => buildRecommendations(families),
        [families],
    );

    /* ── Quick-add: single variant → cart, multiple → size sheet ── */
    const openSizeSelector = (group: FlavorGroup) => {
        const sorted = [...group.variants].sort(
            (a, b) => sizeToMl(a.size) - sizeToMl(b.size),
        );
        setSheetData({
            variants: sorted,
            flavor: group.flavor ?? '',
            family: group.familyName,
        });
        setSheetOpen(true);
    };

    const outletName = selectedOutlet?.name ?? 'Pilih Outlet';
    const outletAddress = selectedOutlet?.address ?? '';
    const outletDistance =
        selectedOutlet?.distance_km != null
            ? `${selectedOutlet.distance_km.toFixed(1)} km`
            : '';

    const handleBack = () => {
        router.visit('/customer/home');
    };

    return (
        <>
            <Head title="Dombi Center" />
            <div className="relative mx-auto min-h-screen w-full max-w-md bg-[#FAFAFA] pb-24 font-sans text-gray-900 shadow-xl">
                {/* ── 1. HEADER ── */}
                <header className="relative rounded-b-3xl bg-primary px-4 pt-safe pb-10 text-white">
                    <div className="mb-4 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-white active:bg-white/20"
                            aria-label="Kembali"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <h1 className="text-base font-bold tracking-wide">
                            Dombi Center
                        </h1>
                        <div className="w-9" />
                    </div>

                    {/* Pick Up / Delivery toggle */}
                    <div className="relative mx-auto mb-2 flex w-[260px] items-center rounded-full bg-black/20 p-1">
                        <button
                            type="button"
                            onClick={() => !isLoggedIn || switchTo('pickup')}
                            className={`flex-1 rounded-full px-3 py-1.5 text-center text-xs font-bold transition-all ${
                                fulfillmentType === 'pickup'
                                    ? 'bg-white text-emerald-700 shadow-xs'
                                    : 'text-white/70'
                            }`}
                        >
                            Pick Up
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (!isLoggedIn) {
                                    setDeliveryLoginOpen(true);
                                } else {
                                    switchTo('delivery');
                                }
                            }}
                            className={`relative flex-1 rounded-full px-3 py-1.5 text-center text-xs font-medium transition-all ${
                                fulfillmentType === 'delivery'
                                    ? 'bg-white text-emerald-700 shadow-xs'
                                    : 'text-white/70'
                            }`}
                        >
                            Delivery
                        </button>
                    </div>

                    <p className="text-center text-[11px] font-medium text-emerald-100">
                        {fulfillmentType === 'pickup'
                            ? 'Ambil di store tanpa antre • Grind the Essentials'
                            : 'Diantar langsung ke lokasimu • Tepat waktu'}
                    </p>
                </header>

                <div ref={sentinelRef} className="h-px" />

                {/* ── 2. FLOATING STORE SELECTOR ── */}
                <div className="relative z-20 mx-4 -mt-5">
                    <button
                        type="button"
                        onClick={() => setOutletSheetOpen(true)}
                        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white p-3.5 text-left shadow-md"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <Store className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1 px-1">
                            <div className="flex items-center gap-1.5">
                                <h3 className="truncate text-sm font-bold text-gray-900">
                                    {outletName}
                                </h3>
                                {selectedOutlet && (
                                    <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                        Terdekat
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-gray-500">
                                {outletDistance
                                    ? `${outletDistance}${outletAddress ? ' • ' : ''}`
                                    : ''}
                                {outletAddress}
                            </p>
                        </div>

                        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                    </button>
                </div>

                {/* ── 3. CATEGORY CHIPS ── */}
                <div className="mx-4 mt-4 mb-3 flex items-center gap-2 overflow-hidden py-1">
                    <button
                        type="button"
                        onClick={() => setActiveFilter('all')}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all ${
                            activeFilter === 'all'
                                ? 'border-emerald-700 bg-emerald-50 text-emerald-700'
                                : 'border-gray-200 bg-white text-gray-400'
                        }`}
                    >
                        <ThumbsUp className="h-4 w-4" />
                    </button>
                    {filterOptions.map((opt) => (
                        <button
                            key={opt.key}
                            type="button"
                            onClick={() => setActiveFilter(opt.key)}
                            className={`shrink-0 rounded-full px-4 py-2 text-xs transition-all ${
                                activeFilter === opt.key
                                    ? 'bg-emerald-600 font-bold text-white shadow-xs'
                                    : 'border border-gray-200 bg-white font-medium text-gray-600'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* ── 4. PROMO STRIP BANNER ── */}
                <div className="mx-4 mb-5 flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50 p-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                            <Store className="h-4 w-4" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-gray-900">
                                New Merchandise
                            </h4>
                            <p className="text-[11px] text-gray-500">
                                Jangan ketinggalan minum dengan gaya baru!
                            </p>
                        </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-sky-500" />
                </div>

                {/* ── 5. REKOMENDASI (horizontal scroll) ── */}
                {recommendations.length > 0 && (
                    <div className="mb-6">
                        <div className="mb-2.5 flex items-center justify-between px-4">
                            <h2 className="text-sm font-bold text-gray-900">
                                Rekomendasi
                            </h2>
                            <span className="text-xs font-medium text-gray-400">
                                Pilihan Menarik
                            </span>
                        </div>

                        <div className="scrollbar-none flex gap-3 overflow-x-auto px-4 pr-6 pb-1">
                            {recommendations.map((group) => (
                                <ProductCard
                                    key={group.representativeVariant.id}
                                    group={group}
                                    onQuickAdd={
                                        group.variants.length > 1
                                            ? () => openSizeSelector(group)
                                            : undefined
                                    }
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ── 6. SECTIONS ── */}
                <div className="mb-6 space-y-6 px-4">
                    {loading ? (
                        <SectionSkeleton />
                    ) : familySections.length > 0 ? (
                        familySections.map((section) => (
                            <section key={section.familyId}>
                                <div className="mb-3 flex items-center justify-between">
                                    <h2 className="text-sm font-bold text-gray-900">
                                        {section.familyName}
                                    </h2>
                                    <span className="text-xs text-gray-400">
                                        {section.totalVariants} varian
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {section.flavorGroups.map((group) => (
                                        <VariantRow
                                            key={`${group.familyId}-${group.flavor ?? 'default'}`}
                                            group={group}
                                            onQuickAdd={
                                                group.variants.length > 1
                                                    ? () =>
                                                          openSizeSelector(
                                                              group,
                                                          )
                                                    : undefined
                                            }
                                        />
                                    ))}
                                </div>
                            </section>
                        ))
                    ) : error ? (
                        <ErrorState message={error} />
                    ) : (
                        <EmptyState />
                    )}
                </div>

                {/* ── 7. BOTTOM NAV ── */}
                <CustomerBottomNav />
            </div>

            <SizeSelectorSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                familyName={sheetData.family}
                flavorName={sheetData.flavor}
                variants={sheetData.variants}
            />
            <OutletSheet
                open={outletSheetOpen}
                onClose={() => setOutletSheetOpen(false)}
                fulfillmentType={fulfillmentType}
                onFulfillmentChange={switchTo}
                deliveryDisabled={!isLoggedIn}
            />
            <DeliveryLoginSheet
                open={deliveryLoginOpen}
                onClose={() => setDeliveryLoginOpen(false)}
            />
            <CollapsedOutletBar
                show={showBar}
                outlet={selectedOutlet}
                fulfillmentType={fulfillmentType}
                onOpenSheet={() => setBarSheetOpen(true)}
            />
            <OutletSheet
                open={barSheetOpen}
                onClose={() => setBarSheetOpen(false)}
                fulfillmentType={fulfillmentType}
                onFulfillmentChange={switchTo}
                deliveryDisabled={!isLoggedIn}
            />
            {totalItems > 0 && <FloatingCartBar />}
        </>
    );
}

/* ─── Horizontal Recommendation Card ───────────────────────── */

function ProductCard({
    group,
    onQuickAdd,
}: {
    group: FlavorGroup;
    onQuickAdd?: () => void;
}) {
    const v = group.representativeVariant;
    const cart = useCart();
    const { syncOutletId } = useOutlet();

    const handleAdd = async () => {
        if (onQuickAdd) {
            onQuickAdd();

            return;
        }

        cart.addItem(v.id, 1, group.lowestPrice);

        try {
            const token = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content');
            const res = await mutationFetch('/customer/cart/add', {
                method: 'POST',
                headers: {
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify({
                    product_id: v.id,
                    quantity: 1,
                }),
            });

            if (!res.ok) {
                throw new Error('Failed to add item');
            }

            const data = (await res.json().catch(() => null)) as {
                switched_outlet?: boolean;
                outlet?: {
                    to_outlet_id?: number;
                    from_outlet_name?: string;
                    to_outlet_name?: string;
                };
            } | null;

            if (data?.switched_outlet && data?.outlet?.to_outlet_id) {
                syncOutletId(data.outlet.to_outlet_id);
                toast.warning(
                    `Stok tidak tersedia di ${data.outlet.from_outlet_name}. Outlet belanja Anda otomatis dialihkan ke ${data.outlet.to_outlet_name}.`,
                    { duration: 4000 },
                );
            }
        } catch {
            cart.removeItem(v.id);
        }
    };

    return (
        <Link
            href={`/customer/products/${group.familyId}`}
            className="flex max-w-[200px] min-w-[200px] shrink-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-xs active:bg-gray-50"
        >
            <ProductImage
                name={v.name}
                src={v.image}
                size="sm"
                className="shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
                <h3 className="truncate text-xs font-bold text-gray-900">
                    {v.name}
                </h3>
                <div className="mt-1 flex items-center justify-between">
                    <span className="truncate text-xs font-extrabold text-gray-900 tabular-nums">
                        {formatCurrency(group.lowestPrice)}
                    </span>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAdd();
                        }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs"
                        aria-label={`Tambah ${v.name}`}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </Link>
    );
}

/* ─── Vertical Row (family section) ────────────────────────── */

function VariantRow({
    group,
    onQuickAdd,
}: {
    group: FlavorGroup;
    onQuickAdd?: () => void;
}) {
    const v = group.representativeVariant;
    const { isFavorite, toggle } = useFavorites();
    const cart = useCart();
    const { syncOutletId } = useOutlet();
    const isFav = isFavorite(v.id);

    const productHref = `/customer/products/${group.familyId}`;

    const handleAdd = async () => {
        if (onQuickAdd) {
            onQuickAdd();

            return;
        }

        cart.addItem(v.id, 1, group.lowestPrice);

        try {
            const token = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content');
            const res = await mutationFetch('/customer/cart/add', {
                method: 'POST',
                headers: {
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify({
                    product_id: v.id,
                    quantity: 1,
                }),
            });

            if (!res.ok) {
                throw new Error('Failed to add item');
            }

            const data = (await res.json().catch(() => null)) as {
                switched_outlet?: boolean;
                outlet?: {
                    to_outlet_id?: number;
                    from_outlet_name?: string;
                    to_outlet_name?: string;
                };
            } | null;

            if (data?.switched_outlet && data?.outlet?.to_outlet_id) {
                syncOutletId(data.outlet.to_outlet_id);
                toast.warning(
                    `Stok tidak tersedia di ${data.outlet.from_outlet_name}. Outlet belanja Anda otomatis dialihkan ke ${data.outlet.to_outlet_name}.`,
                    { duration: 4000 },
                );
            }
        } catch {
            cart.removeItem(v.id);
        }
    };

    return (
        <Link
            href={productHref}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-xs active:bg-gray-50"
        >
            <div className="relative shrink-0">
                <ProductImage
                    name={v.name}
                    src={v.image}
                    size="md"
                    className="rounded-xl"
                />
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggle(v.id);
                    }}
                    className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-xs"
                    aria-label="Favorit"
                >
                    <Heart
                        className={`h-3 w-3 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-gray-400'}`}
                    />
                </button>
            </div>

            <div className="min-w-0 flex-1">
                <h3 className="truncate text-xs font-bold text-gray-900">
                    {group.displayLabel}
                </h3>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-400">
                    {group.familyDescription}
                </p>
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 tabular-nums">
                        {formatCurrency(group.lowestPrice)}
                    </span>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAdd();
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs"
                        aria-label={`Tambah ${group.displayLabel}`}
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </Link>
    );
}

/* ─── Loading / Empty ──────────────────────────────────────── */

function SectionSkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2].map((i) => (
                <div
                    key={i}
                    className="flex animate-pulse items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3"
                >
                    <div className="h-20 w-20 shrink-0 rounded-xl bg-gray-100" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 rounded bg-gray-100" />
                        <div className="h-3 w-2/3 rounded bg-gray-100" />
                        <div className="h-3 w-1/4 rounded bg-gray-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-muted">
                <span className="text-3xl">&#129371;</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-900">
                {message}
            </p>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-muted">
                <span className="text-3xl">&#129371;</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-900">
                Belum ada produk
            </p>
            <p className="mt-1 text-xs text-gray-500">
                Produk akan segera tersedia.
            </p>
        </div>
    );
}

/* ─── Helpers ──────────────────────────────────────────────── */

function buildRecommendations(families: Family[]): FlavorGroup[] {
    const list: FlavorGroup[] = [];

    for (const family of families) {
        const active = family.variants.filter(
            (v) => v.is_active && v.is_recommended,
        );

        for (const v of active) {
            list.push({
                flavor: v.flavor,
                familyId: family.id,
                familyName: family.name,
                familyDescription: family.description,
                variants: [v],
                lowestPrice: v.price,
                displayLabel: v.name,
                representativeVariant: v,
            });
        }
    }

    return list.slice(0, 6);
}

function buildSections(
    families: Family[],
    activeFilter: string,
): FamilySection[] {
    const sections: FamilySection[] = [];

    for (const family of families) {
        if (activeFilter !== 'all' && String(family.id) !== activeFilter) {
            continue;
        }

        const active = family.variants.filter((v) => v.is_active);

        if (active.length === 0) {
            continue;
        }

        const flavorMap = new Map<string, Family['variants']>();

        for (const v of active) {
            const key = v.flavor ?? '__none__';
            const arr = flavorMap.get(key);

            if (arr) {
                arr.push(v);
            } else {
                flavorMap.set(key, [v]);
            }
        }

        const flavorGroups: FlavorGroup[] = [];

        for (const [key, variants] of flavorMap) {
            const flavor = key === '__none__' ? null : key;
            const sorted = [...variants].sort((a, b) => a.price - b.price);
            flavorGroups.push({
                flavor,
                familyId: family.id,
                familyName: family.name,
                familyDescription: family.description,
                variants,
                lowestPrice: sorted[0]?.price ?? 0,
                displayLabel: flavor ? `${family.name} ${flavor}` : family.name,
                representativeVariant: sorted[0],
            });
        }

        sections.push({
            familyId: family.id,
            familyName: family.name,
            flavorGroups,
            totalVariants: active.length,
        });
    }

    return sections;
}

/* ─── Page wrapper ─────────────────────────────────────────── */

export default function Products() {
    return (
        <FavoritesProvider>
            <OutletProvider>
                <Head title="Dombi Center" />
                <CustomerLocationBootstrap />
                <ProductsInner />
            </OutletProvider>
        </FavoritesProvider>
    );
}

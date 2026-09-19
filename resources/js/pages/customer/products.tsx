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
import ActiveOrderBar from '@/components/customer/active-order-bar';
import CustomerBottomNav from '@/components/customer/bottom-nav';
import CollapsedOutletBar from '@/components/customer/collapsed-outlet-bar';
import CustomerLocationBootstrap from '@/components/customer/customer-location-bootstrap';
import DeliveryLoginSheet from '@/components/customer/delivery-login-sheet';
import FloatingCartBar from '@/components/customer/floating-cart-bar';
import OutletSheet from '@/components/customer/outlet-sheet';
import ProductImage from '@/components/customer/product-image';
import {
    gridCols,
    railAndMain,
} from '@/components/customer/responsive-layout-helpers';
import SizeSelectorSheet from '@/components/customer/size-selector-sheet';
import { Button } from '@/components/ui/button';
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
    const { auth, activeOrders = [] } = usePage().props as any;
    const activeOrder = activeOrders[0] ?? null;
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
            <div className="relative mx-auto min-h-screen w-full max-w-md bg-canvas pb-24 font-sans text-text shadow-xl lg:max-w-7xl">
                {/* ── 1. HEADER ── */}
                <header className="relative rounded-b-3xl bg-primary px-4 pt-safe pb-10 text-white">
                    <div className="mb-4 flex items-center justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleBack}
                            className="h-11 w-11 rounded-chip! text-white hover:bg-white/20 hover:text-white"
                            aria-label="Kembali"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-base font-bold tracking-wide">
                            Dombi Center
                        </h1>
                        <div className="w-9" />
                    </div>

                    {/* Pick Up / Delivery toggle */}
                    <div className="relative mx-auto mb-2 flex w-[260px] items-center rounded-full bg-black/20 p-1">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => !isLoggedIn || switchTo('pickup')}
                            className={`h-auto flex-1 rounded-full px-3 py-1.5 text-center text-xs font-bold transition-all ${
                                fulfillmentType === 'pickup'
                                    ? 'bg-white text-primary shadow-xs hover:bg-white hover:text-primary'
                                    : 'text-white/70 hover:bg-transparent hover:text-white/70'
                            }`}
                        >
                            Pick Up
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                if (!isLoggedIn) {
                                    setDeliveryLoginOpen(true);
                                } else {
                                    switchTo('delivery');
                                }
                            }}
                            className={`relative h-auto flex-1 rounded-full px-3 py-1.5 text-center text-xs font-medium transition-all ${
                                fulfillmentType === 'delivery'
                                    ? 'bg-white text-primary shadow-xs hover:bg-white hover:text-primary'
                                    : 'text-white/70 hover:bg-transparent hover:text-white/70'
                            }`}
                        >
                            Delivery
                        </Button>
                    </div>

                    <p className="text-center text-[11px] font-medium text-primary-light">
                        {fulfillmentType === 'pickup'
                            ? 'Ambil di store tanpa antre • Grind the Essentials'
                            : 'Diantar langsung ke lokasimu • Tepat waktu'}
                    </p>
                </header>

                <div ref={sentinelRef} className="h-px" />

                {/* ── 2. FLOATING STORE SELECTOR ── */}
                <div className="relative z-20 mx-4 -mt-5">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setOutletSheetOpen(true)}
                        className="h-auto w-full justify-between gap-2 rounded-card! border border-border bg-surface p-3.5 text-left shadow-md hover:bg-surface"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-thumb bg-primary-light text-primary">
                            <Store className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1 px-1">
                            <div className="flex items-center gap-1.5">
                                <h3 className="truncate text-sm font-bold text-text">
                                    {outletName}
                                </h3>
                                {selectedOutlet && (
                                    <span className="shrink-0 rounded bg-primary-light px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                        Terdekat
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-text-muted">
                                {outletDistance
                                    ? `${outletDistance}${outletAddress ? ' • ' : ''}`
                                    : ''}
                                {outletAddress}
                            </p>
                        </div>

                        <ChevronRight className="h-5 w-5 shrink-0 text-text-subtle" />
                    </Button>
                </div>

                {/* ── MOBILE VIEW (<lg) ── */}
                <div className="lg:hidden">
                    {/* ── 3. CATEGORY CHIPS ── */}
                    <div className="mx-4 mt-4 mb-3 flex items-center gap-2 overflow-hidden py-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setActiveFilter('all')}
                            className={`h-9 w-9 shrink-0 rounded-full border transition-all ${
                                activeFilter === 'all'
                                    ? 'border-primary bg-primary-light text-primary hover:bg-primary-light hover:text-primary'
                                    : 'border-border bg-surface text-text-subtle hover:bg-surface hover:text-text-subtle'
                            }`}
                        >
                            <ThumbsUp className="h-4 w-4" />
                        </Button>
                        {filterOptions.map((opt) => (
                            <Button
                                key={opt.key}
                                type="button"
                                variant="ghost"
                                onClick={() => setActiveFilter(opt.key)}
                                className={`h-auto shrink-0 rounded-full px-4 py-2 text-xs transition-all ${
                                    activeFilter === opt.key
                                        ? 'bg-primary font-bold text-white shadow-xs hover:bg-primary'
                                        : 'border border-border bg-surface font-medium text-text-muted hover:bg-surface hover:text-text-muted'
                                }`}
                            >
                                {opt.label}
                            </Button>
                        ))}
                    </div>

                    {/* ── 4. PROMO STRIP BANNER ── */}
                    <Link
                        href="/customer/coming-soon/merch"
                        className="mx-4 mb-5 flex items-center justify-between rounded-card border border-sky-100 bg-sky-50 p-3"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-sky-100 text-sky-600">
                                <Store className="h-4 w-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-text">
                                    New Merchandise
                                </h4>
                                <p className="text-[11px] text-text-muted">
                                    Jangan ketinggalan minum dengan gaya baru!
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-sky-500" />
                    </Link>

                    {/* ── 5. REKOMENDASI (horizontal scroll) ── */}
                    {recommendations.length > 0 && (
                        <div className="mb-6">
                            <div className="mb-2.5 flex items-center justify-between px-4">
                                <h2 className="text-sm font-bold text-text">
                                    Rekomendasi
                                </h2>
                                <span className="text-xs font-medium text-text-subtle">
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
                                        <h2 className="text-sm font-bold text-text">
                                            {section.familyName}
                                        </h2>
                                        <span className="text-xs text-text-subtle">
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
                </div>

                {/* ── DESKTOP VIEW (>=lg) ── */}
                <div
                    className={`hidden lg:grid ${railAndMain()} px-4 pt-6 lg:px-8`}
                >
                    {/* LEFT RAIL */}
                    <aside className="hidden space-y-4 lg:block">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOutletSheetOpen(true)}
                            className="h-auto w-full justify-start gap-2 rounded-card! border border-border bg-surface p-3 text-left shadow-xs hover:bg-surface"
                        >
                            <Store className="h-5 w-5 text-primary" />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold text-text">
                                    {outletName}
                                </div>
                                <div className="truncate text-xs text-text-muted">
                                    {outletAddress}
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-text-subtle" />
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                const next =
                                    fulfillmentType === 'pickup'
                                        ? 'delivery'
                                        : 'pickup';

                                if (next === 'delivery' && !isLoggedIn) {
                                    setDeliveryLoginOpen(true);

                                    return;
                                }

                                switchTo(next);
                            }}
                            className="h-auto w-full justify-between rounded-card! border border-border bg-surface p-3 text-left shadow-xs hover:bg-surface"
                        >
                            <span className="text-sm font-semibold text-text">
                                {fulfillmentType === 'pickup'
                                    ? 'Pick Up'
                                    : 'Delivery'}
                            </span>
                            <ChevronRight className="h-4 w-4 text-text-subtle" />
                        </Button>

                        <div className="space-y-1">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setActiveFilter('all')}
                                className={`h-auto w-full justify-between rounded-chip! px-3 py-2 text-sm ${
                                    activeFilter === 'all'
                                        ? 'bg-primary-light font-bold text-primary hover:bg-primary-light hover:text-primary'
                                        : 'text-text-muted hover:bg-surface-muted'
                                }`}
                            >
                                Semua
                            </Button>
                            {filterOptions.map((opt) => (
                                <Button
                                    key={opt.key}
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setActiveFilter(opt.key)}
                                    className={`h-auto w-full justify-between rounded-chip! px-3 py-2 text-sm ${
                                        activeFilter === opt.key
                                            ? 'bg-primary-light font-bold text-primary hover:bg-primary-light hover:text-primary'
                                            : 'text-text-muted hover:bg-surface-muted'
                                    }`}
                                >
                                    {opt.label}
                                </Button>
                            ))}
                        </div>
                    </aside>

                    {/* MAIN AREA */}
                    <div className="min-w-0">
                        {loading ? (
                            <SectionSkeleton />
                        ) : recommendations.length > 0 ||
                          familySections.length > 0 ? (
                            <>
                                {recommendations.length > 0 && (
                                    <div>
                                        <div className="mb-2.5 flex items-center justify-between">
                                            <h2 className="text-sm font-bold text-text">
                                                Rekomendasi
                                            </h2>
                                            <span className="text-xs font-medium text-text-subtle">
                                                Pilihan Menarik
                                            </span>
                                        </div>
                                        <div
                                            className={`grid ${gridCols(3)} gap-3`}
                                        >
                                            {recommendations.map((group) => (
                                                <ProductCard
                                                    key={
                                                        group
                                                            .representativeVariant
                                                            .id
                                                    }
                                                    group={group}
                                                    onQuickAdd={
                                                        group.variants.length >
                                                        1
                                                            ? () =>
                                                                  openSizeSelector(
                                                                      group,
                                                                  )
                                                            : undefined
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {familySections.map((section) => (
                                    <section
                                        key={section.familyId}
                                        className="mt-6"
                                    >
                                        <div className="mb-3 flex items-center justify-between">
                                            <h2 className="text-lg font-bold text-text">
                                                {section.familyName}
                                            </h2>
                                            <span className="text-xs text-text-subtle">
                                                {section.totalVariants} varian
                                            </span>
                                        </div>
                                        <div
                                            className={`grid ${gridCols(3)} gap-3`}
                                        >
                                            {section.flavorGroups.map(
                                                (group) => (
                                                    <VariantRow
                                                        key={`${group.familyId}-${group.flavor ?? 'default'}`}
                                                        group={group}
                                                        onQuickAdd={
                                                            group.variants
                                                                .length > 1
                                                                ? () =>
                                                                      openSizeSelector(
                                                                          group,
                                                                      )
                                                                : undefined
                                                        }
                                                    />
                                                ),
                                            )}
                                        </div>
                                    </section>
                                ))}
                            </>
                        ) : error ? (
                            <ErrorState message={error} />
                        ) : (
                            <EmptyState />
                        )}
                    </div>
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
                deliveryBadge={isLoggedIn ? undefined : 'Login'}
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
                deliveryBadge={isLoggedIn ? undefined : 'Login'}
            />
            {totalItems > 0 ? (
                <FloatingCartBar />
            ) : activeOrder ? (
                <ActiveOrderBar order={activeOrder} />
            ) : null}
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
            prefetch="hover"
            className="flex max-w-[200px] min-w-[200px] shrink-0 items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-xs active:bg-surface-muted"
        >
            <ProductImage
                name={v.name}
                src={v.image}
                size="sm"
                className="shrink-0 rounded-thumb"
            />
            <div className="min-w-0 flex-1">
                <h3 className="truncate text-xs font-bold text-text">
                    {v.name}
                </h3>
                <div className="mt-1 flex items-center justify-between">
                    <span className="truncate text-xs font-extrabold text-text tabular-nums">
                        {formatCurrency(group.lowestPrice)}
                    </span>
                    <Button
                        type="button"
                        variant="primary"
                        size="icon"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAdd();
                        }}
                        className="h-7 w-7 shrink-0 rounded-full shadow-xs"
                        aria-label={`Tambah ${v.name}`}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
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
            prefetch="hover"
            className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-xs active:bg-surface-muted"
        >
            <div className="relative shrink-0">
                <ProductImage
                    name={v.name}
                    src={v.image}
                    size="md"
                    className="rounded-thumb"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggle(v.id);
                    }}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/90 shadow-xs hover:bg-white/90"
                    aria-label="Favorit"
                >
                    <Heart
                        className={`h-3 w-3 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-text-subtle'}`}
                    />
                </Button>
            </div>

            <div className="min-w-0 flex-1">
                <h3 className="truncate text-xs font-bold text-text">
                    {group.displayLabel}
                </h3>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-text-subtle">
                    {group.familyDescription}
                </p>
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-primary tabular-nums">
                        {formatCurrency(group.lowestPrice)}
                    </span>
                    <Button
                        type="button"
                        variant="primary"
                        size="icon"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAdd();
                        }}
                        className="h-7 w-7 rounded-full shadow-xs"
                        aria-label={`Tambah ${group.displayLabel}`}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
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
                    className="flex animate-pulse items-center gap-3 rounded-card border border-border bg-surface p-3"
                >
                    <div className="h-20 w-20 shrink-0 rounded-thumb bg-surface-muted" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 rounded bg-surface-muted" />
                        <div className="h-3 w-2/3 rounded bg-surface-muted" />
                        <div className="h-3 w-1/4 rounded bg-surface-muted" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-card bg-surface-muted">
                <span className="text-3xl">&#x1F95B;</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-text">{message}</p>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-card bg-surface-muted">
                <span className="text-3xl">&#x1F95B;</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-text">
                Belum ada produk
            </p>
            <p className="mt-1 text-xs text-text-muted">
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

export function buildSections(
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
            // Produk tanpa flavor = produk standalone: satu baris per produk,
            // bukan digabung jadi satu baris kategori.
            const key = v.flavor ? v.flavor : `__product__${v.id}`;
            const arr = flavorMap.get(key);

            if (arr) {
                arr.push(v);
            } else {
                flavorMap.set(key, [v]);
            }
        }

        const flavorGroups: FlavorGroup[] = [];

        for (const [key, variants] of flavorMap) {
            const isStandalone = key.startsWith('__product__');
            const flavor = isStandalone ? null : key;
            const sorted = [...variants].sort((a, b) => a.price - b.price);
            flavorGroups.push({
                flavor,
                familyId: family.id,
                familyName: family.name,
                familyDescription: family.description,
                variants,
                lowestPrice: sorted[0]?.price ?? 0,
                displayLabel: isStandalone
                    ? (sorted[0]?.name ?? family.name)
                    : flavor
                      ? `${family.name} ${flavor}`
                      : family.name,
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

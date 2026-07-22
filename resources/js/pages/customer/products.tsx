import { Head, usePage } from '@inertiajs/react';
import { Search, Store, ThumbsUp, Truck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import CollapsedOutletBar from '@/components/customer/collapsed-outlet-bar';
import CustomerBottomNav from '@/components/customer/bottom-nav';
import CustomerLocationBootstrap from '@/components/customer/customer-location-bootstrap';
import FloatingCartBar from '@/components/customer/floating-cart-bar';
import ForeGreenHeader from '@/components/customer/fore-green-header';
import FulfillmentToggle from '@/components/customer/fulfillment-toggle';
import OutletSheet from '@/components/customer/outlet-sheet';
import SizeSelectorSheet from '@/components/customer/size-selector-sheet';
import StoreLocationCard from '@/components/customer/store-location-card';
import VariantListItem from '@/components/customer/variant-list-item';
import FilterChips from '@/components/ui/filter-chips';
import { Skeleton } from '@/components/ui/skeleton';
import OutletProvider, { useOutlet } from '@/contexts/outlet-context';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { useFulfillmentOverlay } from '@/hooks/use-fulfillment-overlay';
import { useHideOnScroll } from '@/hooks/use-hide-on-scroll';
import { useProducts } from '@/hooks/use-products';
import type { Family } from '@/hooks/use-products';
import { useSectionReveal } from '@/hooks/use-section-reveal';
import { sizeToMl } from '@/lib/size';
import { useCart } from '@/lib/use-cart';
import FavoritesProvider from '@/providers/favorites-provider';

/* ─── Derived types ────────────────────────────────────────── */

interface FlavorGroup {
    flavor: string | null;
    familyId: number;
    familyName: string;
    familyDescription: string | null;
    familyBrand: string | null;
    variants: Family['variants'];
    lowestPrice: number;
    displayLabel: string;
    representativeVariant: Family['variants'][number];
}

interface FamilySection {
    familyId: number;
    familyName: string;
    familyBrand: string | null;
    flavorGroups: FlavorGroup[];
    totalVariants: number;
}

/* ─── Main ─────────────────────────────────────────────────── */

function ProductsInner() {
    const { auth } = usePage().props as any;
    const isLoggedIn = !!auth?.user;
    const { selectedOutlet, loading: outletLoading } = useOutlet();
    const { families, loading, error, retry } = useProducts(
        selectedOutlet?.id ?? null,
        outletLoading,
    );
    const { fulfillmentType, overlayState, overlayTarget, switchTo } =
        useFulfillmentOverlay();

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetData, setSheetData] = useState<{
        variants: Family['variants'];
        flavor: string;
        family: string;
    }>({ variants: [], flavor: '', family: '' });

    const sentinelRef = useRef<HTMLDivElement>(null);
    const [showBar, setShowBar] = useState(false);
    const [barSheetOpen, setBarSheetOpen] = useState(false);

    useEffect(() => {
        if (!sentinelRef.current) return;
        const observer = new IntersectionObserver(
            ([entry]) => setShowBar(!entry.isIntersecting),
            { threshold: 0 },
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, []);

    useFlashToast();
    const { visible } = useHideOnScroll();
    const { totalItems } = useCart();
    const scrollRef = useRef<HTMLDivElement>(null);

    /* ── Filter options ── */
    const filterOptions = useMemo(() => {
        const opts: { key: string; label: string; icon?: React.ReactNode }[] = [
            {
                key: 'all',
                label: 'Semua',
                icon: <ThumbsUp className="h-3.5 w-3.5" />,
            },
        ];

        for (const f of families) {
            opts.push({ key: String(f.id), label: f.name });
        }

        return opts;
    }, [families]);

    /* ── Search → filter → group into sections ── */
    const familySections = useMemo(() => {
        const q = search.toLowerCase();
        const list = q
            ? families.filter(
                  (f) =>
                      f.name.toLowerCase().includes(q) ||
                      f.variants.some((v) => v.name.toLowerCase().includes(q)),
              )
            : families;

        return buildSections(list, activeFilter);
    }, [families, search, activeFilter]);

    const productCount = familySections.reduce(
        (s, sec) => s + sec.totalVariants,
        0,
    );
    const setSectionRef = useSectionReveal([loading, familySections]);

    /* ── Quick-add handler ── */
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

    /* ── Render ── */
    return (
        <>
            <div className="min-h-dvh bg-background" ref={scrollRef}>
                {/* ── Green header ── */}
                <div className="bg-primary">
                    <div className="px-4 pt-safe pb-10">
                        <ForeGreenHeader
                            title="Produk"
                            backHref="/customer/home"
                        />
                        <FulfillmentToggle
                            value={fulfillmentType}
                            onChange={switchTo}
                            deliveryDisabled={!isLoggedIn}
                        />
                        <p className="mt-2 text-center text-[11px] text-white/60">
                            {fulfillmentType === 'pickup'
                                ? 'Ambil di outlet tanpa antre'
                                : 'Diantar ke alamat Anda'}
                        </p>
                        <div ref={sentinelRef} className="h-px" />
                    </div>
                </div>

                {/* ── White section ── */}
                <div className="relative z-10 -mt-8 rounded-t-[1.5rem] bg-white">
                    <div className="px-4 pt-6 pb-[calc(10rem+env(safe-area-inset-bottom,0))]">
                        <div className="mb-3">
                            <StoreLocationCard />
                        </div>

                        <SearchBar search={search} onSearchChange={setSearch} />

                        <div className="mb-3">
                            <FilterChips
                                options={filterOptions}
                                active={activeFilter}
                                onChange={setActiveFilter}
                            />
                        </div>

                        {!loading && error && (
                            <ErrorState message={error} onRetry={retry} />
                        )}

                        <p className="mb-2 text-xs text-text-muted">
                            {loading ? '...' : `${productCount} Produk`}
                        </p>

                        {loading ? (
                            <ProductSkeletons />
                        ) : familySections.length > 0 ? (
                            <div className="space-y-3">
                                {familySections.map((section) => (
                                    <div
                                        key={section.familyId}
                                        ref={(el) =>
                                            setSectionRef(section.familyId, el)
                                        }
                                        className="product-section-reveal overflow-hidden rounded-2xl border border-border/60 bg-white"
                                    >
                                        <div className="flex items-baseline justify-between px-4 pt-4 pb-3">
                                            <h2 className="text-base font-semibold text-text">
                                                {section.familyName}
                                            </h2>
                                            <span className="text-xs text-text-muted">
                                                {section.totalVariants} varian
                                            </span>
                                        </div>
                                        <div>
                                            {section.flavorGroups.map(
                                                (group, i) => (
                                                    <div
                                                        key={`${group.familyId}-${group.flavor ?? 'default'}`}
                                                        className={
                                                            i <
                                                            section.flavorGroups
                                                                .length -
                                                                1
                                                                ? 'border-b border-border/30'
                                                                : ''
                                                        }
                                                    >
                                                        <VariantListItem
                                                            variant={
                                                                group.representativeVariant
                                                            }
                                                            familyId={
                                                                group.familyId
                                                            }
                                                            familyDescription={
                                                                group.familyDescription
                                                            }
                                                            familyImage={
                                                                families.find(
                                                                    (f) =>
                                                                        f.id ===
                                                                        group.familyId,
                                                                )?.image ?? null
                                                            }
                                                            displayPrice={
                                                                group.lowestPrice
                                                            }
                                                            displayLabel={
                                                                group.displayLabel
                                                            }
                                                            variantCount={
                                                                group.variants
                                                                    .length
                                                            }
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
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyProducts />
                        )}
                    </div>
                </div>
            </div>

            <SizeSelectorSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                familyName={sheetData.family}
                flavorName={sheetData.flavor}
                variants={sheetData.variants}
            />
            {totalItems > 0 && <FloatingCartBar bottomNavVisible={visible} />}
            <CustomerBottomNav visible={visible} />
            <FulfillmentOverlay state={overlayState} target={overlayTarget} />
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
        </>
    );
}

/* ─── Sub-components ───────────────────────────────────────── */

function SearchBar({
    search,
    onSearchChange,
}: {
    search: string;
    onSearchChange: (v: string) => void;
}) {
    return (
        <div className="top-safe sticky z-20 -mx-4 bg-white/80 px-4 pt-2 pb-3 backdrop-blur-lg">
            <div className="rounded-2xl bg-white shadow-sm">
                <div className="flex items-center gap-2.5 px-3.5">
                    <Search className="h-4 w-4 shrink-0 text-text-subtle" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Cari produk..."
                        className="search-input w-full bg-transparent py-2.5 text-sm text-text placeholder:text-text-subtle"
                    />
                </div>
            </div>
        </div>
    );
}

function ErrorState({
    message,
    onRetry,
}: {
    message: string;
    onRetry: () => void;
}) {
    return (
        <div className="rounded-2xl border border-border/60 bg-white p-4 text-center">
            <p className="mb-3 text-sm text-text-muted">{message}</p>
            <button
                type="button"
                onClick={onRetry}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white active:opacity-80"
            >
                Coba Lagi
            </button>
        </div>
    );
}

function ProductSkeletons() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
                <div
                    key={i}
                    className="rounded-2xl border border-border/60 bg-white p-4"
                >
                    <Skeleton className="mb-3 h-5 w-1/3" />
                    <div className="space-y-3">
                        {[1, 2].map((j) => (
                            <div
                                key={j}
                                className="flex items-center gap-3.5 py-2"
                            >
                                <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-2/3" />
                                    <Skeleton className="h-5 w-1/3" />
                                </div>
                                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyProducts() {
    return (
        <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-muted">
                <span className="text-3xl">&#129371;</span>
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

function FulfillmentOverlay({
    state,
    target,
}: {
    state: string;
    target: 'pickup' | 'delivery';
}) {
    if (state === 'hidden') {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-primary"
            style={{
                transform:
                    state === 'exiting' ? 'translateX(100%)' : 'translateX(0)',
                ...(state === 'entering' && {
                    animation:
                        'overlaySlideIn 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
                }),
                ...(state === 'exiting' && {
                    transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                }),
            }}
        >
            <div className="flex flex-col items-center gap-3 text-white">
                {target === 'pickup' ? (
                    <Store className="h-12 w-12" />
                ) : (
                    <Truck className="h-12 w-12" />
                )}
                <div className="text-xl font-bold">
                    {target === 'pickup' ? 'Ambil di Outlet' : 'Kurir Dombi'}
                </div>
                <div className="text-sm text-white/70">
                    {target === 'pickup'
                        ? 'Siap dalam 15-30 menit'
                        : 'Diantar dalam 30-60 menit'}
                </div>
            </div>
        </div>
    );
}

/* ─── Helpers ──────────────────────────────────────────────── */

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
                familyBrand: family.brand,
                variants,
                lowestPrice: sorted[0]?.price ?? 0,
                displayLabel: flavor ? `${family.name} ${flavor}` : family.name,
                representativeVariant: sorted[0],
            });
        }

        sections.push({
            familyId: family.id,
            familyName: family.name,
            familyBrand: family.brand,
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
                <Head title="Produk" />
                <CustomerLocationBootstrap />
                <ProductsInner />
            </OutletProvider>
        </FavoritesProvider>
    );
}

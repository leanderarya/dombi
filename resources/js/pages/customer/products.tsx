import { Head } from '@inertiajs/react';
import { Search, ThumbsUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CustomerBottomNav from '@/components/customer/bottom-nav';
import CustomerLocationBootstrap from '@/components/customer/customer-location-bootstrap';
import FloatingCartBar from '@/components/customer/floating-cart-bar';
import ForeGreenHeader from '@/components/customer/fore-green-header';
import FulfillmentToggle from '@/components/customer/fulfillment-toggle';
import SizeSelectorSheet from '@/components/customer/size-selector-sheet';
import StoreLocationCard from '@/components/customer/store-location-card';
import VariantListItem from '@/components/customer/variant-list-item';
import FilterChips from '@/components/ui/filter-chips';
import { Skeleton } from '@/components/ui/skeleton';
import OutletProvider, { useOutlet } from '@/contexts/outlet-context';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { sizeToMl } from '@/lib/size';
import { useCart } from '@/lib/use-cart';
import FavoritesProvider from '@/providers/favorites-provider';

interface Variant {
    id: number;
    name: string;
    flavor: string | null;
    size: string | null;
    price: number;
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

interface FlavorGroup {
    flavor: string | null;
    familyId: number;
    familyName: string;
    familyDescription: string | null;
    familyBrand: string | null;
    variants: Variant[];
    lowestPrice: number;
    displayLabel: string;
    representativeVariant: Variant;
}

interface FamilySection {
    familyId: number;
    familyName: string;
    familyBrand: string | null;
    flavorGroups: FlavorGroup[];
    totalVariants: number;
}

function ProductsInner() {
    const { selectedOutlet, loading: outletLoading } = useOutlet();
    const [families, setFamilies] = useState<Family[]>([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [productsError, setProductsError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetVariants, setSheetVariants] = useState<Variant[]>([]);
    const [sheetFlavorName, setSheetFlavorName] = useState('');
    const [sheetFamilyName, setSheetFamilyName] = useState('');
    const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery'>('pickup');
    const abortRef = useRef<AbortController | null>(null);
    const cacheRef = useRef<Map<number, Family[]>>(new Map());

    useFlashToast();
    const { totalItems } = useCart();
    const scrollRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    // Fetch products when selected outlet changes
    const fetchProducts = useCallback((outletId: number | null) => {
        const cacheKey = outletId ?? 0;

        if (cacheRef.current.has(cacheKey)) {
            setFamilies(cacheRef.current.get(cacheKey)!);
            setProductsError(null);
            setProductsLoading(false);

            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setProductsLoading(true);

        const params = new URLSearchParams();

        if (outletId) {
            params.set('outlet_id', String(outletId));
        }

        fetch(`/customer/products/api?${params.toString()}`, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
            signal: controller.signal,
        })
            .then(async (res) => {
                if (!res.ok) {
throw new Error('Failed to load products');
}

                return res.json();
            })
            .then((data) => {
                if (!controller.signal.aborted) {
                    const fetched = data.families ?? [];
                    cacheRef.current.set(cacheKey, fetched);
                    setFamilies(fetched);
                    setProductsError(null);
                    setProductsLoading(false);
                }
            })
            .catch((err) => {
                if (err.name !== 'AbortError') {
                    setProductsError('Gagal memuat produk');
                    setProductsLoading(false);
                }
            });
    }, []);

    useEffect(() => {
        if (!outletLoading && selectedOutlet) {
            fetchProducts(selectedOutlet.id);
        }
    }, [selectedOutlet, outletLoading, fetchProducts]);

    const loading = outletLoading || productsLoading;

    const filterOptions = useMemo(() => {
        const options: { key: string; label: string; icon?: React.ReactNode }[] = [{ key: 'all', label: 'Semua', icon: <ThumbsUp className="h-3.5 w-3.5" /> }];

        for (const family of families) {
            options.push({ key: String(family.id), label: family.name });
        }

        return options;
    }, [families]);

    const filteredFamilies = useMemo(() => {
        if (!search) {
            return families;
        }

        const q = search.toLowerCase();

        return families.filter(f =>
            f.name.toLowerCase().includes(q) ||
            f.variants.some(v => v.name.toLowerCase().includes(q))
        );
    }, [families, search]);

    const familySections = useMemo(() => {
        const sections: FamilySection[] = [];

        for (const family of filteredFamilies) {
            if (activeFilter !== 'all' && String(family.id) !== activeFilter) {
                continue;
            }

            const activeVariants = (family.variants ?? []).filter(v => v.is_active);

            if (activeVariants.length === 0) {
                continue;
            }

            const flavorMap = new Map<string | null, Variant[]>();

            for (const variant of activeVariants) {
                const key = variant.flavor ?? '__no_flavor__';

                if (!flavorMap.has(key)) {
                    flavorMap.set(key, []);
                }

                flavorMap.get(key)!.push(variant);
            }

            const flavorGroups: FlavorGroup[] = [];

            for (const [key, variants] of flavorMap) {
                const flavor = key === '__no_flavor__' ? null : key;
                const sortedByPrice = [...variants].sort((a, b) => a.price - b.price);
                const lowestPrice = sortedByPrice[0]?.price ?? 0;
                const displayLabel = flavor ? `${family.name} ${flavor}` : family.name;
                flavorGroups.push({
                    flavor, familyId: family.id, familyName: family.name,
                    familyDescription: family.description, familyBrand: family.brand,
                    variants, lowestPrice, displayLabel, representativeVariant: sortedByPrice[0],
                });
            }

            sections.push({
                familyId: family.id, familyName: family.name, familyBrand: family.brand,
                flavorGroups, totalVariants: activeVariants.length,
            });
        }

        return sections;
    }, [filteredFamilies, activeFilter]);

    const productCount = useMemo(() => {
        return familySections.reduce((sum, s) => sum + s.totalVariants, 0);
    }, [familySections]);

    const handleQuickAdd = (group: FlavorGroup) => {
        if (group.variants.length > 1) {
            const sorted = [...group.variants].sort((a, b) => sizeToMl(a.size) - sizeToMl(b.size));
            setSheetVariants(sorted);
            setSheetFlavorName(group.flavor ?? '');
            setSheetFamilyName(group.familyName);
            setSheetOpen(true);
        }
    };

    const setSectionRef = (id: number, el: HTMLDivElement | null) => {
        if (el) {
sectionRefs.current.set(id, el);
}
    };

    // IntersectionObserver for slide-in
    useEffect(() => {
        if (loading) {
return;
}

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { root: scrollRef.current, threshold: 0.1 }
        );
        sectionRefs.current.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, [loading, familySections]);

    return (
        <>
            <div className="min-h-dvh bg-background" ref={scrollRef}>
                {/* ── GREEN HEADER — bg extends into safe area ── */}
                <div className="bg-primary">
                    <div className="px-4 pb-10 pt-safe">
                        <ForeGreenHeader title="Produk" backHref="/customer/home" />
                        <FulfillmentToggle
                            value={fulfillmentType}
                            onChange={setFulfillmentType}
                        />
                        <p className="mt-2 text-center text-[11px] text-white/60">
                            {fulfillmentType === 'pickup'
                                ? 'Ambil di outlet tanpa antre'
                                : 'Diantar ke alamat Anda'}
                        </p>
                    </div>
                </div>

                {/* ── WHITE SECTION — rounded top, overlaps green ── */}
                <div className="relative -mt-8 z-10 rounded-t-[1.5rem] bg-white">
                    <div className="px-4 pt-6 pb-24 space-y-4">
                        {/* Outlet Card */}
                        <StoreLocationCard />

                        {/* Sticky search + chips */}
                        <div className="sticky top-safe z-20 -mx-4 bg-white/80 px-4 pb-3 pt-2 backdrop-blur-lg">
                            <div className="rounded-2xl border border-border/60 bg-white shadow-sm">
                                <div className="flex items-center gap-2.5 px-3.5">
                                    <Search className="h-4 w-4 shrink-0 text-text-subtle" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Cari produk..."
                                        className="search-input w-full bg-transparent py-2.5 text-sm text-text placeholder:text-text-subtle"
                                    />
                                </div>
                            </div>
                            <div className="mt-2">
                                <FilterChips
                                    options={filterOptions}
                                    active={activeFilter}
                                    onChange={setActiveFilter}
                                />
                            </div>
                        </div>

                        {/* Error State */}
                        {!productsLoading && productsError && (
                            <div className="rounded-2xl border border-border/60 bg-white p-6 text-center">
                                <p className="text-sm text-text-muted mb-3">{productsError}</p>
                                <button
                                    type="button"
                                    onClick={() => selectedOutlet && fetchProducts(selectedOutlet.id)}
                                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white active:opacity-80"
                                >
                                    Coba Lagi
                                </button>
                            </div>
                        )}

                        {/* Product Count */}
                        <p className="text-xs text-text-muted">{loading ? '...' : `${productCount} Produk`}</p>

                        {/* Family Sections */}
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="rounded-2xl border border-border/60 bg-white p-4">
                                        <Skeleton className="h-5 w-1/3 mb-3" />
                                        <div className="space-y-3">
                                            {[1, 2].map((j) => (
                                                <div key={j} className="flex items-center gap-3.5 py-2">
                                                    <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
                                                    <div className="flex-1 space-y-2">
                                                        <Skeleton className="h-4 w-2/3" />
                                                        <Skeleton className="h-5 w-1/3" />
                                                    </div>
                                                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : familySections.length > 0 ? (
                            <div className="space-y-3">
                                {familySections.map((section) => (
                                    <div
                                        key={section.familyId}
                                        ref={(el) => setSectionRef(section.familyId, el)}
                                        className="product-section-reveal overflow-hidden rounded-2xl border border-border/60 bg-white"
                                    >
                                        <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
                                            <h2 className="fore-section-header">{section.familyName}</h2>
                                            <span className="text-xs text-text-muted">{section.totalVariants} varian</span>
                                        </div>
                                        <div>
                                            {section.flavorGroups.map((group, index) => (
                                                <div key={`${group.familyId}-${group.flavor ?? 'default'}`} className={index < section.flavorGroups.length - 1 ? 'border-b border-border/30' : ''}>
                                                    <VariantListItem
                                                        variant={group.representativeVariant}
                                                        familyId={group.familyId}
                                                        familyDescription={group.familyDescription}
                                                        displayPrice={group.lowestPrice}
                                                        displayLabel={group.displayLabel}
                                                        variantCount={group.variants.length}
                                                        onQuickAdd={group.variants.length > 1 ? () => handleQuickAdd(group) : undefined}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {/* Empty State */}
                        {!loading && familySections.length === 0 && (
                            <div className="mt-12 flex flex-col items-center text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-muted">
                                    <span className="text-3xl">&#129371;</span>
                                </div>
                                <p className="mt-3 text-sm font-semibold text-text">Belum ada produk</p>
                                <p className="mt-1 text-xs text-text-muted">Produk akan segera tersedia.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <SizeSelectorSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                familyName={sheetFamilyName}
                flavorName={sheetFlavorName}
                variants={sheetVariants}
            />
            {totalItems > 0 && <FloatingCartBar />}
            <CustomerBottomNav />
        </>
    );
}

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

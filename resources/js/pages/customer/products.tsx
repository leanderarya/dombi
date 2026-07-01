import { Head } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import SizeSelectorSheet from '@/components/customer/size-selector-sheet';
import VariantListItem from '@/components/customer/variant-list-item';
import FilterChips from '@/components/ui/filter-chips';
import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { sizeToMl } from '@/lib/size';

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

interface Props {
    families: Family[];
}

export default function Products({ families }: Props) {
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetVariants, setSheetVariants] = useState<Variant[]>([]);
    const [sheetFlavorName, setSheetFlavorName] = useState('');
    const [sheetFamilyName, setSheetFamilyName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 300);

        return () => clearTimeout(timer);
    }, []);

    // Build category chips from families
    const filterOptions = useMemo(() => {
        const options = [{ key: 'all', label: 'Semua' }];

        for (const family of families) {
            options.push({ key: String(family.id), label: family.name });
        }

        return options;
    }, [families]);

    // Filter families by search query (matches family name or variant name)
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

    // Group variants by flavor within each family, then group families into sections
    const familySections = useMemo(() => {
        const sections: FamilySection[] = [];

        for (const family of filteredFamilies) {
            if (activeFilter !== 'all' && String(family.id) !== activeFilter) {
                continue;
            }

            const activeVariants = (family.variants ?? []).filter(
                (v) => v.is_active,
            );

            if (activeVariants.length === 0) {
continue;
}

            // Group by flavor within this family
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
                const sortedByPrice = [...variants].sort(
                    (a, b) => a.selling_price - b.selling_price,
                );
                const lowestPrice = sortedByPrice[0]?.selling_price ?? 0;
                const displayLabel = flavor
                    ? `${family.name} ${flavor}`
                    : family.name;
                const representativeVariant = sortedByPrice[0];

                flavorGroups.push({
                    flavor,
                    familyId: family.id,
                    familyName: family.name,
                    familyDescription: family.description,
                    familyBrand: family.brand,
                    variants,
                    lowestPrice,
                    displayLabel,
                    representativeVariant,
                });
            }

            sections.push({
                familyId: family.id,
                familyName: family.name,
                familyBrand: family.brand,
                flavorGroups,
                totalVariants: activeVariants.length,
            });
        }

        return sections;
    }, [filteredFamilies, activeFilter]);

    // Count total products in active filter
    const productCount = useMemo(() => {
        return familySections.reduce(
            (sum, section) => sum + section.totalVariants,
            0,
        );
    }, [familySections]);

    const handleQuickAdd = (group: FlavorGroup) => {
        if (group.variants.length > 1) {
            const sortedVariants = [...group.variants].sort(
                (a, b) => sizeToMl(a.size) - sizeToMl(b.size),
            );
            setSheetVariants(sortedVariants);
            setSheetFlavorName(group.flavor ?? '');
            setSheetFamilyName(group.familyName);
            setSheetOpen(true);
        }
    };

    return (
        <CustomerMobileLayout>
            <Head title="Produk" />

            <div className="px-4 pt-4">
                <h1 className="text-xl font-semibold tracking-tight text-text">
                    Produk
                </h1>
            </div>

            {/* Search Input */}
            <div className="sticky top-0 z-10 bg-[#fbf9f7] px-4 py-3">
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-white px-3.5">
                    <Search className="h-4 w-4 shrink-0 text-text-subtle" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari produk..."
                        className="w-full bg-transparent py-2.5 text-sm text-text placeholder:text-text-subtle focus:outline-none"
                    />
                </div>
            </div>

            {/* Category Chips */}
            <div className="mt-3 px-4">
                <FilterChips
                    options={filterOptions}
                    active={activeFilter}
                    onChange={setActiveFilter}
                />
            </div>

            {/* Product Count */}
            <div className="mt-3 px-4">
                <p className="text-xs text-text-muted">{loading ? '...' : `${productCount} Produk`}</p>
            </div>

            {/* Family Sections or Skeleton */}
            <div className="mt-2 px-4">
                {loading ? (
                    <div className="space-y-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i}>
                                <Skeleton className="h-5 w-1/3 mb-2" />
                                <div className="h-px bg-zinc-200" />
                                <div className="space-y-3 mt-3">
                                    {[1, 2].map((j) => (
                                        <div key={j} className="flex items-center gap-3.5 py-4">
                                            <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-2/3" />
                                                <Skeleton className="h-5 w-1/3" />
                                            </div>
                                            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {familySections.map((section, sectionIndex) => (
                    <div
                        key={section.familyId}
                        className={sectionIndex > 0 ? 'mt-8' : ''}
                    >
                        {/* Family Section Header */}
                        <div className="flex items-baseline justify-between pb-2">
                            <h2 className="text-sm font-bold text-text">
                                {section.familyName}
                            </h2>
                            <span className="text-xs text-text-subtle">
                                {section.totalVariants} Produk
                            </span>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-border" />

                        {/* Variant Rows */}
                        <div className="mt-2 overflow-hidden rounded-xl bg-white">
                            {section.flavorGroups.map((group, index) => (
                                <div key={`${group.familyId}-${group.flavor ?? 'default'}`} className={index < section.flavorGroups.length - 1 ? 'border-b border-border' : ''}>
                                    <VariantListItem
                                        variant={group.representativeVariant}
                                        familyId={group.familyId}
                                        familyName={group.familyName}
                                        familyDescription={group.familyDescription}
                                        familyBrand={group.familyBrand}
                                        displayPrice={group.lowestPrice}
                                        displayLabel={group.displayLabel}
                                        onQuickAdd={
                                            group.variants.length > 1
                                                ? () => handleQuickAdd(group)
                                                : undefined
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                    </>
                )}
            </div>

            {/* Empty State */}
            {!loading && familySections.length === 0 && (
                <div className="mt-12 flex flex-col items-center px-4 text-center">
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
            )}

            {/* Bottom padding for floating cart bar */}
            <div className="h-24" />

            {/* Size Selector Sheet */}
            <SizeSelectorSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                familyName={sheetFamilyName}
                flavorName={sheetFlavorName}
                variants={sheetVariants}
            />
        </CustomerMobileLayout>
    );
}

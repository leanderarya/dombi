import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import SizeSelectorSheet from '@/components/customer/size-selector-sheet';
import VariantListItem from '@/components/customer/variant-list-item';
import FilterChips from '@/components/ui/filter-chips';
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
    const [activeFilter, setActiveFilter] = useState('all');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetVariants, setSheetVariants] = useState<Variant[]>([]);
    const [sheetFlavorName, setSheetFlavorName] = useState('');
    const [sheetFamilyName, setSheetFamilyName] = useState('');

    // Build category chips from families
    const filterOptions = useMemo(() => {
        const options = [{ key: 'all', label: 'Semua' }];

        for (const family of families) {
            options.push({ key: String(family.id), label: family.name });
        }

        return options;
    }, [families]);

    // Group variants by flavor within each family, then group families into sections
    const familySections = useMemo(() => {
        const sections: FamilySection[] = [];

        for (const family of families) {
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
    }, [families, activeFilter]);

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
                <h1 className="text-[22px] leading-7 font-bold text-slate-950">
                    Produk
                </h1>
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
                <p className="text-xs text-zinc-500">{productCount} Produk</p>
            </div>

            {/* Family Sections */}
            <div className="mt-2 px-4">
                {familySections.map((section, sectionIndex) => (
                    <div
                        key={section.familyId}
                        className={sectionIndex > 0 ? 'mt-8' : ''}
                    >
                        {/* Family Section Header */}
                        <div className="flex items-baseline justify-between pb-2">
                            <h2 className="text-[15px] font-bold text-slate-900">
                                {section.familyName}
                            </h2>
                            <span className="text-xs text-zinc-400">
                                {section.totalVariants} Produk
                            </span>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-zinc-200" />

                        {/* Variant Rows */}
                        <div className="divide-y divide-zinc-100">
                            {section.flavorGroups.map((group) => (
                                <VariantListItem
                                    key={`${group.familyId}-${group.flavor ?? 'default'}`}
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
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {familySections.length === 0 && (
                <div className="mt-12 flex flex-col items-center px-4 text-center">
                    <span className="text-4xl">&#129371;</span>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                        Belum ada produk
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
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

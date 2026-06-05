import { Head, Link } from '@inertiajs/react';
import { formatCurrency } from '@/lib/format';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';

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
    families: Family[];
}

export default function Products({ families }: Props) {
    return (
        <CustomerMobileLayout>
            <Head title="Produk" />
            <div className="px-4 pt-4">
                <p className="text-sm text-slate-500">Katalog Produk</p>
                <h1 className="mt-1 text-[24px] font-bold leading-8 text-slate-950">Pilih produk</h1>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 px-4">
                {families.map((family) => {
                    const minPrice = Math.min(...(family.variants?.map(v => v.selling_price) ?? [0]));
                    const variantCount = family.variants?.length ?? 0;
                    const flavors = [...new Set(family.variants?.map(v => v.flavor).filter(Boolean) ?? [])];

                    return (
                        <Link
                            key={family.id}
                            href={`/customer/products/${family.id}`}
                            className="block rounded-xl border border-zinc-100 bg-white overflow-hidden active:bg-zinc-50"
                        >
                            {/* Image placeholder */}
                            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-emerald-50 to-zinc-50">
                                <span className="text-4xl">🥛</span>
                            </div>

                            <div className="p-3">
                                <div className="text-sm font-semibold text-slate-900 leading-tight">{family.name}</div>

                                {flavors.length > 0 && (
                                    <div className="mt-1 text-[10px] text-zinc-500">
                                        {flavors.slice(0, 2).join(' · ')}
                                        {flavors.length > 2 && ` +${flavors.length - 2}`}
                                    </div>
                                )}

                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-xs font-bold text-emerald-700">
                                        {minPrice > 0 ? formatCurrency(minPrice) : ''}
                                    </span>
                                    <span className="text-[10px] text-zinc-400">
                                        {variantCount} varian
                                    </span>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </CustomerMobileLayout>
    );
}

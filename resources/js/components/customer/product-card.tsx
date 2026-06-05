import { memo } from 'react';
import { Link } from '@inertiajs/react';
import { formatCurrency } from '@/lib/format';

interface Product {
    id: number;
    name: string;
    size?: string | null;
    unit?: string;
    price: number | string;
    image?: string | null;
    is_active?: boolean;
}

interface Props {
    product: Product;
    compact?: boolean;
}

const ProductCard = memo(function ProductCard({ product, compact = false }: Props) {
    const outOfStock = product.is_active === false;

    return (
        <Link
            href={`/customer/products/${product.id}`}
            className="block overflow-hidden rounded-lg border border-zinc-100 bg-white active:bg-zinc-50"
        >
            {/* Image area */}
            <div className="relative aspect-square bg-zinc-50">
                {product.image ? (
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <span className="text-3xl opacity-30">&#129371;</span>
                    </div>
                )}

                {outOfStock && (
                    <div className="absolute bottom-2 right-2">
                        <span className="rounded-md bg-zinc-200 px-2 py-1 text-[10px] font-bold text-zinc-500">Habis</span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-3">
                <div className="line-clamp-2 min-h-9 text-sm font-semibold leading-[1.15rem] text-slate-900">
                    {product.name}
                </div>
                <div className="mt-1.5 text-sm font-semibold text-emerald-700">
                    {formatCurrency(product.price)}
                </div>
            </div>
        </Link>
    );
});

export default ProductCard;


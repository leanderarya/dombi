import { Head, Link } from '@inertiajs/react';
import { Heart } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import ProductImage from '@/components/customer/product-image';
import { Skeleton } from '@/components/ui/skeleton';
import OutletProvider, { useOutlet } from '@/contexts/outlet-context';
import { useProducts } from '@/hooks/use-products';
import type { Variant } from '@/hooks/use-products';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { mutationFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useCart } from '@/lib/use-cart';
import { useFavorites } from '@/lib/use-favorites';

interface FavoriteRowData {
    variant: Variant;
    familyId: number;
    familyName: string;
}

function FavoritesInner() {
    const { selectedOutlet, loading: outletLoading } = useOutlet();
    const { families, loading, error, retry } = useProducts(
        selectedOutlet?.id ?? null,
        outletLoading,
    );
    const { favorites, toggle } = useFavorites();
    const cart = useCart();
    const [addingId, setAddingId] = useState<number | null>(null);
    const [toastId, setToastId] = useState<number | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isOutletClosed = selectedOutlet?.is_open === false;

    const favoriteVariants = useMemo(() => {
        const list: FavoriteRowData[] = [];

        for (const family of families) {
            for (const v of family.variants) {
                if (favorites.has(v.id) && v.is_active) {
                    list.push({
                        variant: v,
                        familyId: family.id,
                        familyName: family.name,
                    });
                }
            }
        }

        return list.sort((a, b) =>
            a.variant.name.localeCompare(b.variant.name),
        );
    }, [families, favorites]);

    const handleQuickAdd = async (variant: Variant) => {
        if (
            addingId !== null ||
            variant.stock_status === 'out_of_stock' ||
            isOutletClosed
        ) {
            return;
        }

        setAddingId(variant.id);
        cart.addItem(variant.id, 1, variant.price);

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
                    product_id: variant.id,
                    quantity: 1,
                }),
            });

            if (!res.ok) {
                throw new Error('Failed');
            }

            if (toastTimer.current) {
                clearTimeout(toastTimer.current);
            }

            setToastId(variant.id);
            toastTimer.current = setTimeout(() => setToastId(null), 2000);
        } catch {
            cart.removeItem(variant.id);
        } finally {
            setAddingId(null);
        }
    };

    const handleFavorite = (variant: Variant) => {
        toggle(variant.id);
    };

    const productHref = (variant: Variant, familyId: number) => {
        const params = new URLSearchParams();

        if (selectedOutlet) {
            params.set('outlet_id', String(selectedOutlet.id));
        }

        if (variant.flavor) {
            params.set('flavor', variant.flavor);
        }

        if (variant.size) {
            params.set('size', variant.size);
        }

        const qs = params.toString();

        return qs
            ? `/customer/products/${familyId}?${qs}`
            : `/customer/products/${familyId}`;
    };

    return (
        <CustomerMobileLayout>
            <Head title="Favorit" />

            <div className="pt-safe">
                <h1 className="text-xl font-semibold text-text">Favorit</h1>
                <p className="mt-1 text-xs text-text-muted">
                    {loading
                        ? '...'
                        : `${favoriteVariants.length} produk favorit`}
                </p>
            </div>

            {loading ? (
                <FavoritesSkeleton />
            ) : error ? (
                <FavoritesError message={error} onRetry={retry} />
            ) : favoriteVariants.length === 0 ? (
                <FavoritesEmpty />
            ) : (
                <div className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-white">
                    {favoriteVariants.map((row, i) => (
                        <div
                            key={row.variant.id}
                            className={
                                i < favoriteVariants.length - 1
                                    ? 'border-b border-border/30'
                                    : ''
                            }
                        >
                            <FavoriteRow
                                row={row}
                                href={productHref(row.variant, row.familyId)}
                                adding={addingId === row.variant.id}
                                toasting={toastId === row.variant.id}
                                isOutletClosed={isOutletClosed}
                                onQuickAdd={() => handleQuickAdd(row.variant)}
                                onFavorite={() => handleFavorite(row.variant)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </CustomerMobileLayout>
    );
}

function FavoriteRow({
    row,
    href,
    adding,
    toasting,
    isOutletClosed,
    onQuickAdd,
    onFavorite,
}: {
    row: FavoriteRowData;
    href: string;
    adding: boolean;
    toasting: boolean;
    isOutletClosed: boolean;
    onQuickAdd: () => void;
    onFavorite: () => void;
}) {
    const { variant, familyName } = row;
    const isOutOfStock = variant.stock_status === 'out_of_stock';

    return (
        <Link
            href={href}
            className={`flex items-center gap-3.5 p-3 transition-colors active:bg-surface-muted ${isOutOfStock || isOutletClosed ? 'opacity-50' : ''}`}
        >
            <div className="relative shrink-0">
                <ProductImage
                    name={variant.name}
                    src={variant.image}
                    size="md"
                />
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onFavorite();
                    }}
                    className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm"
                    aria-label="Hapus dari favorit"
                >
                    <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                </button>
            </div>

            <div className="min-w-0 flex-1">
                <div className="text-xs text-text-muted">{familyName}</div>
                <div className="text-sm font-semibold text-text">
                    {variant.name}
                </div>
                <div className="mt-1 text-sm font-bold text-text tabular-nums">
                    {formatCurrency(variant.price)}
                </div>
            </div>

            <div className="shrink-0">
                {toasting ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
                        <svg
                            className="h-4 w-4 text-emerald-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onQuickAdd();
                        }}
                        disabled={adding || isOutOfStock || isOutletClosed}
                        className={`flex h-10 w-10 items-center justify-center rounded-full transition-all active:opacity-80 disabled:opacity-40 ${
                            isOutOfStock || isOutletClosed
                                ? 'bg-surface-muted text-text-muted'
                                : 'bg-primary text-white active:bg-primary-hover'
                        }`}
                        aria-label={
                            isOutOfStock
                                ? 'Habis'
                                : isOutletClosed
                                  ? 'Outlet Tutup'
                                  : 'Tambah ke keranjang'
                        }
                    >
                        {isOutOfStock ? (
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path strokeLinecap="round" d="M18 12H6" />
                            </svg>
                        ) : isOutletClosed ? (
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        ) : (
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2.5"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 5v14M5 12h14"
                                />
                            </svg>
                        )}
                    </button>
                )}
            </div>
        </Link>
    );
}

function FavoritesError({
    message,
    onRetry,
}: {
    message: string;
    onRetry: () => void;
}) {
    return (
        <div className="mt-3 rounded-2xl border border-border/60 bg-white p-4 text-center">
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

function FavoritesSkeleton() {
    return (
        <div className="mt-3 rounded-2xl border border-border/60 bg-white p-4">
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3.5 py-2">
                        <Skeleton className="h-20 w-20 shrink-0 rounded-xl" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-3 w-1/3" />
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-5 w-1/3" />
                        </div>
                        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}

function FavoritesEmpty() {
    return (
        <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-muted">
                <Heart className="h-7 w-7 text-text-muted" />
            </div>
            <p className="mt-3 text-sm font-semibold text-text">
                Belum ada produk favorit
            </p>
            <p className="mt-1 text-xs text-text-muted">
                Belanja produk dan tekan hati untuk menyimpan.
            </p>
            <Link
                href="/customer/products"
                className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white active:opacity-80"
            >
                Lihat Produk
            </Link>
        </div>
    );
}

export default function Favorites() {
    return (
        <OutletProvider>
            <FavoritesInner />
        </OutletProvider>
    );
}

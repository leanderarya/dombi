import { Head, Link, router } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { HeaderIconButton, SearchIcon } from '@/components/owner/owner-mobile-header';
import Pagination from '@/components/pagination';
import { formatCurrency } from '@/lib/format';

export default function ProductsIndex({ products }: any) {
    return (
        <OwnerPageShell
            title="Produk"
            headerRight={
                <>
                    <HeaderIconButton label="Search"><SearchIcon /></HeaderIconButton>
                    <Link href="/owner/products/create" className="flex h-10 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700 transition-all duration-150 active:scale-[0.98]">
                        + Tambah
                    </Link>
                </>
            }
        >
            {products.data.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                    <span className="text-3xl">📦</span>
                    <p className="mt-2 text-sm font-semibold text-slate-600">Belum ada produk</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {products.data.map((product: any) => (
                        <div key={product.id} className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{product.name}</div>
                                    <div className="mt-0.5 text-[11px] text-slate-500">
                                        {[product.size, product.unit].filter(Boolean).join(' ')}
                                        {product.category && ` · ${product.category.name}`}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold tabular-nums text-slate-900">{formatCurrency(product.price)}</div>
                                    <span className={`mt-0.5 inline-block rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${product.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                        {product.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-2 flex gap-2 border-t border-slate-50 pt-2">
                                <Link href={`/owner/products/${product.id}/edit`} className="flex min-h-[36px] flex-1 items-center justify-center rounded-md border border-slate-200 text-[11px] font-semibold text-slate-700 transition-all duration-150 active:scale-[0.98] active:bg-slate-50">
                                    Edit
                                </Link>
                                <button onClick={() => confirm('Hapus produk ini?') && router.delete(`/owner/products/${product.id}`)} className="flex min-h-[36px] items-center justify-center rounded-md px-3 text-[11px] font-semibold text-red-600 transition-all duration-150 active:scale-[0.98] active:text-red-800">
                                    Hapus
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <Pagination links={products.links} />
        </OwnerPageShell>
    );
}

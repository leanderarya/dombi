import { router } from '@inertiajs/react';
import { Package } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import DataTable from '@/components/ui/data-table';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import Pagination from '@/components/pagination';
import { formatCurrency } from '@/lib/format';

export default function ProductsIndex({ products }: any) {
    return (
        <OwnerPageShell
            title="Produk"
            headerRight={
                <button
                    onClick={() => router.visit('/owner/products/create')}
                    className="flex h-9 items-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
                >
                    + Tambah Produk
                </button>
            }
        >
            {/* Mobile: cards */}
            <div className="lg:hidden">
                {products.data.length === 0 ? (
                    <EmptyState icon={<Package className="h-8 w-8 text-slate-400" />} title="Belum ada produk" description="Tambah produk pertama untuk mulai berjualan." action={{ label: 'Tambah Produk', href: '/owner/products/create' }} />
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
                                        <StatusBadge variant={product.is_active ? 'success' : 'neutral'} size="sm">
                                            {product.is_active ? 'Aktif' : 'Nonaktif'}
                                        </StatusBadge>
                                    </div>
                                </div>
                                <div className="mt-2 flex gap-2 border-t border-slate-50 pt-2">
                                    <button onClick={() => router.visit(`/owner/products/${product.id}/edit`)} className="flex min-h-[36px] flex-1 items-center justify-center rounded-md border border-slate-200 text-xs font-semibold text-slate-700 transition-all active:bg-slate-50">
                                        Edit
                                    </button>
                                    <button onClick={() => confirm('Hapus produk ini?') && router.delete(`/owner/products/${product.id}`)} className="flex min-h-[36px] items-center justify-center rounded-md px-3 text-xs font-semibold text-red-600 transition-all active:text-red-800">
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <Pagination links={products.links} />
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block">
                <DataTable
                    rowKey="id"
                    data={products.data}
                    columns={[
                        {
                            key: 'name',
                            label: 'Produk',
                            className: 'font-bold text-slate-900',
                            render: (row: any) => (
                                <div>
                                    <div>{row.name}</div>
                                    <div className="text-[11px] text-slate-500">{[row.size, row.unit].filter(Boolean).join(' ')}{row.category ? ` · ${row.category.name}` : ''}</div>
                                </div>
                            ),
                        },
                        {
                            key: 'price',
                            label: 'Harga',
                            className: 'tabular-nums font-semibold',
                            render: (row: any) => formatCurrency(row.price),
                        },
                        {
                            key: 'is_active',
                            label: 'Status',
                            render: (row: any) => (
                                <StatusBadge variant={row.is_active ? 'success' : 'neutral'} size="sm">
                                    {row.is_active ? 'Aktif' : 'Nonaktif'}
                                </StatusBadge>
                            ),
                        },
                    ]}
                    actions={[
                        { label: 'Edit', variant: 'secondary', onClick: (row) => router.visit(`/owner/products/${row.id}/edit`) },
                        {
                            label: 'Hapus',
                            variant: 'danger',
                            onClick: (row) => { if (confirm('Hapus produk ini?')) router.delete(`/owner/products/${row.id}`); },
                        },
                    ]}
                    emptyMessage="Belum ada produk"
                    emptyAction={{ label: 'Tambah Produk', href: '/owner/products/create' }}
                />
                <Pagination links={products.links} />
            </div>
        </OwnerPageShell>
    );
}

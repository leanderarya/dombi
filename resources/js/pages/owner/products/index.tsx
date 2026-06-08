import { router } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import DataTable from '@/components/ui/data-table';
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
        </OwnerPageShell>
    );
}

import OwnerLayout from '@/layouts/owner-layout';
import { formatDate } from '@/lib/format';
import { router } from '@inertiajs/react';
import Pagination from '@/components/pagination';

interface StockMovement {
    id: number;
    outlet_id: number;
    product_id: number;
    type: string;
    quantity: number;
    before_stock: number | null;
    after_stock: number | null;
    before_reserved: number | null;
    after_reserved: number | null;
    reference_type: string | null;
    reference_id: number | null;
    notes: string | null;
    created_at: string;
    outlet?: { id: number; name: string };
    product?: { id: number; name: string };
    creator?: { id: number; name: string } | null;
}

interface Props {
    movements: {
        data: StockMovement[];
        links: any[];
        current_page: number;
        last_page: number;
    };
    outlets: { id: number; name: string }[];
    products: { id: number; name: string }[];
    filters: {
        outlet_id?: string;
        product_id?: string;
        type?: string;
        date_from?: string;
        date_to?: string;
    };
}

const typeLabels: Record<string, string> = {
    initial_stock: 'Initial Stock',
    stock_adjustment: 'Adjustment',
    order_reserved: 'Order Reserved',
    order_completed: 'Order Completed',
    order_cancelled: 'Order Cancelled',
    restock_in: 'Restock In',
    delivery_returned: 'Delivery Returned',
};

const typeStyles: Record<string, string> = {
    initial_stock: 'bg-zinc-100 text-zinc-700',
    stock_adjustment: 'bg-amber-100 text-amber-800',
    order_reserved: 'bg-blue-100 text-blue-800',
    order_completed: 'bg-green-100 text-green-800',
    order_cancelled: 'bg-red-100 text-red-800',
    restock_in: 'bg-emerald-100 text-emerald-800',
    delivery_returned: 'bg-purple-100 text-purple-800',
};

export default function StockMovementsIndex({ movements, outlets, products, filters }: Props) {
    function handleFilter(key: string, value: string) {
        router.get('/owner/stock-movements', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    }

    return (
        <OwnerLayout>
            <h1 className="text-xl font-semibold text-slate-900">Inventory Audit Trail</h1>
            <p className="mt-1 text-sm text-slate-500">Riwayat seluruh perubahan stok di semua outlet.</p>

            <div className="mt-4 flex flex-wrap gap-3">
                <select
                    className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    value={filters.outlet_id ?? ''}
                    onChange={(e) => handleFilter('outlet_id', e.target.value)}
                >
                    <option value="">Semua Outlet</option>
                    {outlets.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                </select>

                <select
                    className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    value={filters.product_id ?? ''}
                    onChange={(e) => handleFilter('product_id', e.target.value)}
                >
                    <option value="">Semua Produk</option>
                    {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>

                <select
                    className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    value={filters.type ?? ''}
                    onChange={(e) => handleFilter('type', e.target.value)}
                >
                    <option value="">Semua Tipe</option>
                    {Object.entries(typeLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>

                <input
                    type="date"
                    className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    value={filters.date_from ?? ''}
                    onChange={(e) => handleFilter('date_from', e.target.value)}
                    placeholder="Dari"
                />
                <input
                    type="date"
                    className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    value={filters.date_to ?? ''}
                    onChange={(e) => handleFilter('date_to', e.target.value)}
                    placeholder="Sampai"
                />
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                {movements.data.length === 0 ? (
                    <EmptyState />
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-zinc-100 bg-zinc-50">
                            <tr>
                                <th className="px-4 py-3 font-medium text-slate-600">Waktu</th>
                                <th className="px-4 py-3 font-medium text-slate-600">Outlet</th>
                                <th className="px-4 py-3 font-medium text-slate-600">Produk</th>
                                <th className="px-4 py-3 font-medium text-slate-600">Tipe</th>
                                <th className="px-4 py-3 font-medium text-slate-600 text-right">Qty</th>
                                <th className="px-4 py-3 font-medium text-slate-600 text-right">Stok</th>
                                <th className="px-4 py-3 font-medium text-slate-600 text-right">Reserved</th>
                                <th className="px-4 py-3 font-medium text-slate-600">Aktor</th>
                                <th className="px-4 py-3 font-medium text-slate-600">Catatan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {movements.data.map((m) => (
                                <tr key={m.id} className="hover:bg-zinc-50/50">
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{formatDate(m.created_at)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{m.outlet?.name ?? '-'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{m.product?.name ?? '-'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${typeStyles[m.type] ?? 'bg-zinc-100 text-zinc-700'}`}>
                                            {typeLabels[m.type] ?? m.type}
                                        </span>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-mono text-xs ${m.quantity >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {m.quantity >= 0 ? '+' : ''}{m.quantity}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                                        {m.before_stock ?? '?'} → {m.after_stock ?? '?'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                                        {m.before_reserved ?? '-'} → {m.after_reserved ?? '-'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{m.creator?.name ?? '-'}</td>
                                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{m.notes ?? '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Pagination links={movements.links} />
        </OwnerLayout>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl">📋</div>
            <p className="mt-2 text-sm font-medium text-slate-600">Belum ada stock movement</p>
            <p className="text-xs text-slate-400">Perubahan stok akan tercatat di sini.</p>
        </div>
    );
}

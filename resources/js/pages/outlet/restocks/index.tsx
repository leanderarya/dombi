import { Head, Link, router } from '@inertiajs/react';
import EmptyState from '@/components/empty-state';
import Pagination from '@/components/pagination';
import RestockStatusBadge from '@/components/restock-status-badge';
import OutletLayout from '@/layouts/outlet-layout';

const statuses = ['requested', 'approved', 'rejected', 'preparing', 'shipped', 'received', 'completed'];

export default function OutletRestocksIndex({ restocks, filters }: any) {
    return (
        <OutletLayout>
            <Head title="Restocks" />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold">Restock Requests</h1>
                <Link href="/outlet/restocks/create" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white">Create Request</Link>
            </div>
            <select value={filters.status ?? ''} onChange={(e) => router.get('/outlet/restocks', { status: e.target.value || undefined }, { preserveState: true, replace: true })} className="mt-5 rounded-md border px-3 py-2 text-sm">
                <option value="">Semua status</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            {restocks.data.length === 0 ? (
                <div className="mt-5 rounded-lg border bg-white">
                    <EmptyState icon="📋" title="Belum ada restock request" description="Buat request baru untuk meminta stok tambahan." />
                </div>
            ) : (
                <div className="mt-5 space-y-3">
                    {restocks.data.map((restock: any) => (
                        <Link key={restock.id} href={`/outlet/restocks/${restock.id}`} className="block rounded-lg border bg-white p-4 transition-colors hover:border-emerald-200">
                            <div className="flex items-center justify-between">
                                <div className="font-medium">Request #{restock.id}</div>
                                <RestockStatusBadge status={restock.status} />
                            </div>
                            <div className="mt-2 text-sm text-zinc-500">Distribution: {restock.distribution?.status ?? '-'}</div>
                        </Link>
                    ))}
                </div>
            )}
            <Pagination links={restocks.links} />
        </OutletLayout>
    );
}

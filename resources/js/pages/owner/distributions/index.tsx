import { Head, Link, router } from '@inertiajs/react';
import DistributionStatusBadge from '@/components/distribution-status-badge';
import EmptyState from '@/components/empty-state';
import Pagination from '@/components/pagination';
import OwnerLayout from '@/layouts/owner-layout';
import { formatDate } from '@/lib/format';

const statuses = ['preparing', 'shipped', 'received', 'completed'];

export default function OwnerDistributionsIndex({ distributions, outlets, filters }: any) {
    const setFilter = (key: string, value: string) => router.get('/owner/distributions', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });

    return (
        <OwnerLayout>
            <Head title="Stock Distributions" />
            <h1 className="text-2xl font-semibold">Stock Distributions</h1>
            <div className="mt-5 flex flex-wrap gap-3 rounded-lg border bg-white p-4">
                <select value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua status</option>
                    {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <select value={filters.outlet_id ?? ''} onChange={(e) => setFilter('outlet_id', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua outlet</option>
                    {outlets.map((outlet: any) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
                </select>
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border bg-white">
                {distributions.data.length === 0 ? (
                    <EmptyState icon="📦" title="Belum ada distribution" description="Distribution dibuat setelah restock request disetujui." />
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50">
                            <tr><th className="p-3">Distribution</th><th className="p-3">Outlet</th><th className="p-3">Status</th><th className="p-3">Sent</th></tr>
                        </thead>
                        <tbody>
                            {distributions.data.map((distribution: any) => (
                                <tr key={distribution.id} className="border-t hover:bg-zinc-50/50">
                                    <td className="p-3 font-medium"><Link href={`/owner/distributions/${distribution.id}`} className="text-emerald-700">#{distribution.id}</Link></td>
                                    <td className="p-3">{distribution.outlet.name}</td>
                                    <td className="p-3"><DistributionStatusBadge status={distribution.status} /></td>
                                    <td className="p-3 text-xs text-slate-500">{formatDate(distribution.sent_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <Pagination links={distributions.links} />
        </OwnerLayout>
    );
}

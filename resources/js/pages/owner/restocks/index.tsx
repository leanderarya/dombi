import { Head, Link, router } from '@inertiajs/react';
import RestockStatusBadge from '../../../components/restock-status-badge';
import OwnerLayout from '../../../layouts/owner-layout';

const statuses = ['requested', 'approved', 'rejected', 'preparing', 'shipped', 'completed'];

export default function OwnerRestocksIndex({ restocks, outlets, filters }: any) {
    const setFilter = (key: string, value: string) => router.get('/owner/restocks', { ...filters, [key]: value }, { preserveState: true });

    return (
        <OwnerLayout>
            <Head title="Restocks" />
            <h1 className="text-2xl font-semibold">Restock Requests</h1>
            <div className="mt-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3">
                <input defaultValue={filters.search ?? ''} onBlur={(e) => setFilter('search', e.target.value)} placeholder="Search outlet/request id" className="rounded-md border px-3 py-2 text-sm" />
                <select defaultValue={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)} className="rounded-md border px-3 py-2 text-sm"><option value="">Semua status</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                <select defaultValue={filters.outlet_id ?? ''} onChange={(e) => setFilter('outlet_id', e.target.value)} className="rounded-md border px-3 py-2 text-sm"><option value="">Semua outlet</option>{outlets.map((outlet: any) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select>
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="bg-zinc-50"><tr><th className="p-3">Request</th><th>Outlet</th><th>Items</th><th>Status</th><th>Created</th></tr></thead><tbody>{restocks.data.map((restock: any) => <tr key={restock.id} className="border-t"><td className="p-3 font-medium"><Link href={`/owner/restocks/${restock.id}`} className="text-emerald-700">#{restock.id}</Link></td><td>{restock.outlet.name}</td><td>{restock.items.length}</td><td><RestockStatusBadge status={restock.status} /></td><td>{new Date(restock.created_at).toLocaleString('id-ID')}</td></tr>)}</tbody></table></div>
        </OwnerLayout>
    );
}

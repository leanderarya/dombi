import { Head, Link, router } from '@inertiajs/react';
import DistributionStatusBadge from '../../../components/distribution-status-badge';
import OwnerLayout from '../../../layouts/owner-layout';

const statuses = ['preparing', 'shipped', 'received', 'completed'];

export default function OwnerDistributionsIndex({ distributions, outlets, filters }: any) {
    const setFilter = (key: string, value: string) => router.get('/owner/distributions', { ...filters, [key]: value }, { preserveState: true });

    return <OwnerLayout><Head title="Stock Distributions" /><h1 className="text-2xl font-semibold">Stock Distributions</h1><div className="mt-5 flex flex-wrap gap-3 rounded-lg border bg-white p-4"><select defaultValue={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)} className="rounded-md border px-3 py-2"><option value="">Semua status</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><select defaultValue={filters.outlet_id ?? ''} onChange={(e) => setFilter('outlet_id', e.target.value)} className="rounded-md border px-3 py-2"><option value="">Semua outlet</option>{outlets.map((outlet: any) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></div><div className="mt-5 overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="bg-zinc-50"><tr><th className="p-3">Distribution</th><th>Outlet</th><th>Status</th><th>Sent</th></tr></thead><tbody>{distributions.data.map((distribution: any) => <tr key={distribution.id} className="border-t"><td className="p-3 font-medium"><Link href={`/owner/distributions/${distribution.id}`} className="text-emerald-700">#{distribution.id}</Link></td><td>{distribution.outlet.name}</td><td><DistributionStatusBadge status={distribution.status} /></td><td>{distribution.sent_at ? new Date(distribution.sent_at).toLocaleString('id-ID') : '-'}</td></tr>)}</tbody></table></div></OwnerLayout>;
}

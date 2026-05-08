import { Head, router } from '@inertiajs/react';
import DistributionStatusBadge from '../../../components/distribution-status-badge';
import RestockStatusBadge from '../../../components/restock-status-badge';
import OutletLayout from '../../../layouts/outlet-layout';

export default function OutletRestockShow({ restock }: any) {
    return (
        <OutletLayout>
            <Head title={`Restock #${restock.id}`} />
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Restock #{restock.id}</h1>
                <RestockStatusBadge status={restock.status} />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
                <section className="rounded-lg border bg-white p-5">
                    <h2 className="font-semibold">Items</h2>
                    <div className="mt-3 space-y-3">{restock.items.map((item: any) => <div key={item.id} className="flex justify-between border-t pt-3 text-sm"><span>{item.product.name}</span><span>Request {item.requested_quantity} / Approved {item.approved_quantity ?? '-'}</span></div>)}</div>
                </section>
                <aside className="space-y-5">
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Notes</h2>
                        <div className="mt-2 text-zinc-600">{restock.notes ?? '-'}</div>
                        <div className="mt-3 font-medium">Owner notes</div>
                        <div className="text-zinc-600">{restock.owner_notes ?? '-'}</div>
                        {restock.rejected_reason && <div className="mt-3 rounded-md bg-red-50 p-3 text-red-700">{restock.rejected_reason}</div>}
                    </section>
                    {restock.distribution && <section className="rounded-lg border bg-white p-5 text-sm"><h2 className="font-semibold">Distribution</h2><div className="mt-3"><DistributionStatusBadge status={restock.distribution.status} /></div>{restock.distribution.status === 'shipped' && <button onClick={() => router.post(`/outlet/distributions/${restock.distribution.id}/confirm-received`)} className="mt-4 w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white">Confirm Received</button>}</section>}
                </aside>
            </div>
        </OutletLayout>
    );
}

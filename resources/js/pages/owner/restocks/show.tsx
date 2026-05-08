import { Head, useForm } from '@inertiajs/react';
import StockLevelBadge from '../../../components/stock-level-badge';
import RestockStatusBadge from '../../../components/restock-status-badge';
import OwnerLayout from '../../../layouts/owner-layout';

export default function OwnerRestockShow({ restock, inventories }: any) {
    const inventoryByProduct = new Map(inventories.map((item: any) => [item.product_id, item]));
    const approveForm = useForm({ owner_notes: restock.owner_notes ?? '', items: restock.items.map((item: any) => ({ restock_request_item_id: item.id, approved_quantity: item.approved_quantity ?? item.requested_quantity })) });
    const rejectForm = useForm({ rejected_reason: '' });
    const setApproved = (index: number, value: number) => {
        const items = [...approveForm.data.items] as any[];
        items[index] = { ...items[index], approved_quantity: value };
        approveForm.setData('items', items as any);
    };

    return (
        <OwnerLayout>
            <Head title={`Restock #${restock.id}`} />
            <div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold">Restock #{restock.id}</h1><p className="text-sm text-zinc-500">{restock.outlet.name}</p></div><RestockStatusBadge status={restock.status} /></div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
                <section className="rounded-lg border bg-white p-5">
                    <h2 className="font-semibold">Requested Items</h2>
                    <div className="mt-3 space-y-3">
                        {restock.items.map((item: any, index: number) => {
                            const inventory: any = inventoryByProduct.get(item.product_id);
                            return <div key={item.id} className="grid gap-3 border-t pt-3 text-sm md:grid-cols-[1fr_120px_160px]"><div><div className="font-medium">{item.product.name}</div><div className="text-zinc-500">Requested {item.requested_quantity}</div></div><input type="number" min="0" value={(approveForm.data.items[index] as any).approved_quantity} disabled={restock.status !== 'requested'} onChange={(e) => setApproved(index, Number(e.target.value))} className="rounded-md border px-3 py-2" /><div>{inventory ? <StockLevelBadge currentStock={inventory.current_stock} reservedStock={inventory.reserved_stock} minimumStock={inventory.minimum_stock} /> : 'No inventory'}</div></div>;
                        })}
                    </div>
                </section>
                <aside className="space-y-5">
                    {restock.status === 'requested' && <section className="rounded-lg border bg-white p-5 text-sm"><h2 className="font-semibold">Approve</h2><form onSubmit={(e) => { e.preventDefault(); approveForm.post(`/owner/restocks/${restock.id}/approve`); }} className="mt-3 space-y-3"><textarea value={approveForm.data.owner_notes} onChange={(e) => approveForm.setData('owner_notes', e.target.value)} placeholder="Owner notes" className="w-full rounded-md border px-3 py-2" />{approveForm.errors.items && <div className="text-red-600">{approveForm.errors.items}</div>}<button className="w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white">Approve & Create Distribution</button></form></section>}
                    {restock.status === 'requested' && <section className="rounded-lg border bg-white p-5 text-sm"><h2 className="font-semibold">Reject</h2><form onSubmit={(e) => { e.preventDefault(); rejectForm.post(`/owner/restocks/${restock.id}/reject`); }} className="mt-3 space-y-3"><textarea value={rejectForm.data.rejected_reason} onChange={(e) => rejectForm.setData('rejected_reason', e.target.value)} className="w-full rounded-md border px-3 py-2" />{rejectForm.errors.rejected_reason && <div className="text-red-600">{rejectForm.errors.rejected_reason}</div>}<button className="w-full rounded-md border border-red-200 px-4 py-2 font-medium text-red-700">Reject</button></form></section>}
                    <section className="rounded-lg border bg-white p-5 text-sm"><h2 className="font-semibold">Notes</h2><div className="mt-2">{restock.notes ?? '-'}</div><div className="mt-3 font-medium">Owner notes</div><div>{restock.owner_notes ?? '-'}</div>{restock.rejected_reason && <div className="mt-3 rounded-md bg-red-50 p-3 text-red-700">{restock.rejected_reason}</div>}</section>
                </aside>
            </div>
        </OwnerLayout>
    );
}

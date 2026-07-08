import { router, useForm } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import RestockStatusBadge from '@/components/ui/restock-status-badge';
import { formatDate } from '@/lib/format';
import ApprovePanel from './approve-panel';
import DistributionCard from './distribution-card';
import RejectPanel from './reject-panel';
import RestockTimeline, { buildTimeline } from './restock-timeline';

export default function OwnerRestockShow({ restock, inventories }: any) {
    const inventoryByProduct = new Map(inventories.map((item: any) => [item.product_id, item]));
    const distribution = restock.distribution;
    const totalRequested = restock.items.reduce((sum: number, item: any) => sum + Number(item.requested_quantity), 0);
    const totalApproved = restock.items.reduce((sum: number, item: any) => sum + Number(item.approved_quantity ?? 0), 0);
    const totalDistributed = distribution?.items?.reduce((sum: number, item: any) => sum + Number(item.quantity), 0) ?? 0;

    const approveForm = useForm({
        owner_notes: restock.owner_notes ?? '',
        items: restock.items.map((item: any) => ({
            restock_request_item_id: item.id,
            approved_quantity: item.approved_quantity ?? item.requested_quantity,
        })),
    });
    const rejectForm = useForm({ rejected_reason: '' });

    const setApproved = (index: number, value: number) => {
        const items = [...approveForm.data.items] as any[];
        items[index] = { ...items[index], approved_quantity: value };
        approveForm.setData('items', items as any);
    };

    const timeline = buildTimeline(restock);

    return (
        <OwnerPageShell title={`Restock #${restock.id}`} subtitle={restock.outlet.name} backHref="/owner/restocks">
            <div className="grid gap-3 lg:grid-cols-2">
                {/* Header */}
                <div className="rounded-lg border border-border p-4 lg:col-span-2">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-text-subtle">Permintaan Restock</p>
                            <h1 className="mt-1 text-lg font-bold text-text">#{restock.id} · {restock.outlet.name}</h1>
                            <p className="mt-0.5 text-xs text-text-muted">{totalRequested} Diminta · {totalApproved || '-'} Disetujui</p>
                        </div>
                        <RestockStatusBadge status={restock.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <Metric label="Diminta oleh" value={restock.requester?.name ?? '-'} />
                        <Metric label="Tanggal permintaan" value={formatDate(restock.created_at)} />
                        <Metric label="Penanggung jawab" value={distribution?.sender?.name ?? restock.approver?.name ?? '-'} />
                        <Metric label="Stok gudang" value="Belum aktif" muted />
                    </div>
                </div>

                {/* Distribution */}
                <div className="lg:col-span-2">
                    <DistributionCard distribution={distribution} restock={restock} totalDistributed={totalDistributed} />
                </div>

                {/* Approve / Reject panels */}
                {restock.status === 'requested' && (
                    <>
                        <ApprovePanel
                            restock={restock}
                            inventories={inventoryByProduct}
                            form={approveForm}
                            onQuantityChange={setApproved}
                        />
                        <RejectPanel restock={restock} form={rejectForm} />
                    </>
                )}

                {/* Items summary */}
                {restock.status !== 'requested' && (
                    <div className="lg:col-span-2">
                        <ItemsSummary restock={restock} inventories={inventoryByProduct} />
                    </div>
                )}

                {/* Timeline */}
                <div className="rounded-lg border border-border p-4 lg:col-span-2">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Linimasa Operasional</div>
                    <RestockTimeline events={timeline} />
                </div>

                {/* Notes */}
                <div className="rounded-lg border border-border p-4 lg:col-span-2">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Catatan</div>
                    <div className="space-y-1 text-sm">
                        <NoteRow label="Catatan outlet" value={restock.notes} />
                        <NoteRow label="Catatan owner" value={restock.owner_notes} />
                        {restock.rejected_reason && <NoteRow label="Alasan penolakan" value={restock.rejected_reason} danger />}
                        <NoteRow label="Catatan penerimaan" value={distribution?.received_notes} />
                        <NoteRow label="Catatan kerusakan" value={distribution?.damage_notes} />
                    </div>
                </div>
            </div>
        </OwnerPageShell>
    );
}

function Metric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
    return (
        <div className={`rounded-lg border p-2 ${muted ? 'border-amber-200 bg-amber-50' : 'border-border bg-slate-50'}`}>
            <div className={`text-xs font-semibold uppercase tracking-wide ${muted ? 'text-amber-600' : 'text-text-subtle'}`}>{label}</div>
            <div className={`mt-0.5 truncate text-xs font-bold ${muted ? 'text-amber-800' : 'text-text'}`}>{value}</div>
        </div>
    );
}

function NoteRow({ label, value, danger = false }: { label: string; value?: string | null; danger?: boolean }) {
    return (
        <div className={`flex justify-between border-b border-[#f5f5f5] py-1 last:border-b-0 ${danger ? 'text-red-700' : ''}`}>
            <span className="text-text-muted">{label}</span>
            <span className={danger ? 'text-red-700' : 'text-text'}>{value || '-'}</span>
        </div>
    );
}

function ItemsSummary({ restock, inventories }: any) {
    return (
        <div className="rounded-lg border border-border p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Item Permintaan</div>
            {restock.items.map((item: any) => {
                const inventory: any = inventories.get(item.product_id);

                return (
                    <div key={item.id} className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">{item.product?.name ?? item.variant?.name ?? '-'}</span>
                        <span className="text-text">Diminta {item.requested_quantity} · Disetujui {item.approved_quantity ?? 0}</span>
                    </div>
                );
            })}
        </div>
    );
}

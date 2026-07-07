import { Link, router, useForm } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import DistributionStatusBadge from '@/components/ui/distribution-status-badge';
import RestockStatusBadge from '@/components/ui/restock-status-badge';
import StockLevelBadge from '@/components/ui/stock-level-badge';
import { formatDate } from '@/lib/format';
import { calculateStockStatus } from '@/lib/stock';

type TimelineEvent = {
    label: string;
    at?: string | null;
    actor?: string | null;
    note?: string | null;
    active?: boolean;
};

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
                    <Timeline events={timeline} />
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

function DistributionCard({ distribution, restock, totalDistributed }: any) {
    if (!distribution) {
        return (
            <div className="rounded-lg border border-dashed border-border p-4">
                <div className="text-sm font-bold text-text">Status Distribusi</div>
                <p className="mt-1 text-xs text-text-muted">Belum ada distribution. Approve request untuk membuat shipment.</p>
            </div>
        );
    }

    const actionLabels: Record<string, string> = {
        preparing: 'Siap dikirim ke outlet.',
        shipped: 'Menunggu Konfirmasi Outlet',
        completed: 'Distribusi Selesai',
    };
    const actionLabel = actionLabels[distribution.status] ?? 'Monitoring distribution.';

    return (
        <div className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-text-subtle">Status Distribusi</p>
                    <h2 className="mt-1 text-sm font-bold text-text">Pengiriman #{distribution.id}</h2>
                    <p className="mt-0.5 text-xs text-text-muted">{actionLabel}</p>
                </div>
                <DistributionStatusBadge status={distribution.status} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Metric label="Outlet" value={restock.outlet.name} />
                <Metric label="Total item" value={`${distribution.items?.length ?? 0} SKU`} />
                <Metric label="Jumlah kirim" value={`${totalDistributed} unit`} />
                <Metric label="Penanggung jawab" value={distribution.sender?.name ?? restock.approver?.name ?? '-'} />
                <Metric label="Tanggal kirim" value={formatDate(distribution.sent_at)} />
                <Metric label="Tanggal terima" value={formatDate(distribution.received_at)} />
            </div>

            <div className="mt-3 rounded-lg border border-border bg-slate-50 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-subtle">Ringkasan pengiriman</div>
                {distribution.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">{item.product?.name ?? item.variant?.name ?? '-'}</span>
                        <span className="font-bold text-text">{item.quantity}</span>
                    </div>
                ))}
            </div>

            {distribution.status === 'preparing' && (
                <button
                    type="button"
                    onClick={() => router.post(`/owner/distributions/${distribution.id}/mark-shipped`)}
                    className="mt-3 flex h-9 w-full items-center justify-center rounded-lg bg-primary px-3 text-xs font-bold text-white transition-all duration-150 active:opacity-80"
                >
                    Tandai Dikirim
                </button>
            )}

            {distribution.status === 'shipped' && (
                <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-xs font-semibold text-indigo-700">
                    Menunggu Konfirmasi Outlet
                </div>
            )}

            {distribution.status === 'completed' && (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">
                    Distribusi Selesai
                </div>
            )}

            <Link href={`/owner/distributions/${distribution.id}`} className="mt-2 block text-center text-xs font-bold text-primary">
                Lihat detail distribution
            </Link>
        </div>
    );
}

function ApprovePanel({ restock, inventories, form, onQuantityChange }: any) {
    return (
        <div className="rounded-lg border border-border p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Setujui & Siapkan</div>
            <p className="text-xs text-text-muted">Set approved quantity. Distribution akan dibuat status preparing.</p>

            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-800">
                Warehouse stock management belum aktif. Quantity approved belum mengurangi stok pusat.
            </div>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(`/owner/restocks/${restock.id}/approve`);
                }}
                className="mt-3 space-y-2"
            >
                {restock.items.map((item: any, index: number) => {
                    const inventory: any = inventories.get(item.product_id);

                    return (
                        <div key={item.id} className="rounded-lg border border-border p-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-text">{item.product?.name ?? item.variant?.name ?? '-'}</div>
                                    <div className="text-xs text-text-muted">Diminta {item.requested_quantity}</div>
                                </div>
                                {inventory ? <StockLevelBadge {...calculateStockStatus(inventory.current_stock, inventory.reserved_stock, inventory.minimum_stock)} showQuantity /> : <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-text-muted">Stok Kosong</span>}
                            </div>
                            <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-text-subtle">Jumlah disetujui</label>
                            <input
                                type="number"
                                min="0"
                                value={(form.data.items[index] as any).approved_quantity}
                                onChange={(event) => onQuantityChange(index, Number(event.target.value))}
                                className="mt-1 h-8 w-full rounded-lg border border-border px-2 text-xs font-semibold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                            />
                        </div>
                    );
                })}

                <textarea
                    value={form.data.owner_notes}
                    onChange={(event) => form.setData('owner_notes', event.target.value)}
                    placeholder="Catatan owner"
                    className="min-h-16 w-full rounded-lg border border-border px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                {form.errors.items && <div className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{form.errors.items}</div>}
                <button disabled={form.processing} className="h-9 w-full rounded-lg bg-primary px-3 text-xs font-bold text-white transition-all duration-150 active:opacity-80 disabled:opacity-60">
                    Setujui & Buat Distribusi
                </button>
            </form>
        </div>
    );
}

function RejectPanel({ restock, form }: any) {
    return (
        <div className="rounded-lg border border-border p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Tolak Permintaan</div>
            <p className="text-xs text-text-muted">Gunakan hanya jika request tidak bisa dipenuhi.</p>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(`/owner/restocks/${restock.id}/reject`);
                }}
                className="mt-3 space-y-2"
            >
                <textarea
                    value={form.data.rejected_reason}
                    onChange={(event) => form.setData('rejected_reason', event.target.value)}
                    placeholder="Alasan penolakan"
                    className="min-h-16 w-full rounded-lg border border-border px-2 py-1.5 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
                {form.errors.rejected_reason && <div className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{form.errors.rejected_reason}</div>}
                <button disabled={form.processing} className="h-9 w-full rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 transition-all duration-150 active:opacity-80 disabled:opacity-60">
                    Tolak
                </button>
            </form>
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

function Timeline({ events }: { events: TimelineEvent[] }) {
    return (
        <div className="space-y-0">
            {events.map((event, index) => (
                <div key={`${event.label}-${index}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                        <div className={`h-2.5 w-2.5 rounded-full border-2 ${event.active ? 'border-emerald-600 bg-emerald-600' : 'border-border bg-white'}`} />
                        {index < events.length - 1 && <div className="h-full min-h-8 w-px bg-slate-200" />}
                    </div>
                    <div className="pb-3">
                        <div className="text-sm font-bold text-text">{event.label}</div>
                        <div className="text-xs text-text-muted">{formatDate(event.at)}{event.actor ? ` · ${event.actor}` : ''}</div>
                        {event.note && <div className="mt-0.5 text-xs leading-4 text-text-muted">{event.note}</div>}
                    </div>
                </div>
            ))}
        </div>
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

function buildTimeline(restock: any): TimelineEvent[] {
    const distribution = restock.distribution;
    const events: TimelineEvent[] = [
        {
            label: 'Permintaan Dibuat',
            at: restock.created_at,
            actor: restock.requester?.name,
            note: restock.notes,
            active: true,
        },
    ];

    if (restock.rejected_at) {
        events.push({
            label: 'Ditolak',
            at: restock.rejected_at,
            actor: restock.rejecter?.name,
            note: restock.rejected_reason,
            active: true,
        });

        return events;
    }

    if (restock.approved_at) {
        events.push({
            label: 'Disetujui / Disiapkan',
            at: restock.approved_at,
            actor: restock.approver?.name,
            note: restock.owner_notes,
            active: true,
        });
    }

    if (distribution) {
        events.push({
            label: 'Distribusi Dibuat',
            at: distribution.created_at,
            actor: restock.approver?.name,
            note: `${distribution.items?.length ?? 0} SKU disiapkan`,
            active: true,
        });
    }

    if (distribution?.sent_at) {
        events.push({
            label: 'Dikirim',
            at: distribution.sent_at,
            actor: distribution.sender?.name,
            note: 'Stok dikirim ke outlet.',
            active: true,
        });
    }

    if (distribution?.received_at) {
        events.push({
            label: 'Diterima / Selesai',
            at: distribution.received_at,
            actor: distribution.receiver?.name,
            note: distribution.received_notes || 'Outlet mengonfirmasi stok diterima.',
            active: true,
        });
    }

    return events;
}

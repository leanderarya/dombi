import { Link, router, useForm } from '@inertiajs/react';
import DistributionStatusBadge from '@/components/distribution-status-badge';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import RestockStatusBadge from '@/components/restock-status-badge';
import StockLevelBadge from '@/components/stock-level-badge';
import { formatDate } from '@/lib/format';

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
            <div className="mx-auto max-w-5xl space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Permintaan Restock</p>
                            <h1 className="mt-1 text-xl font-bold text-slate-950">#{restock.id} · {restock.outlet.name}</h1>
                            <p className="mt-1 text-xs text-slate-500">{totalRequested} Diminta · {totalApproved || '-'} Disetujui</p>
                        </div>
                        <RestockStatusBadge status={restock.status} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <Metric label="Diminta oleh" value={restock.requester?.name ?? '-'} />
                        <Metric label="Tanggal permintaan" value={formatDate(restock.created_at)} />
                        <Metric label="Penanggung jawab" value={distribution?.sender?.name ?? restock.approver?.name ?? '-'} />
                        <Metric label="Stok gudang" value="Belum aktif" muted />
                    </div>
                </section>

                <DistributionCard distribution={distribution} restock={restock} totalDistributed={totalDistributed} />

                {restock.status === 'requested' && (
                    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                        <ApprovePanel
                            restock={restock}
                            inventories={inventoryByProduct}
                            form={approveForm}
                            onQuantityChange={setApproved}
                        />
                        <RejectPanel restock={restock} form={rejectForm} />
                    </div>
                )}

                {restock.status !== 'requested' && (
                    <ItemsSummary restock={restock} inventories={inventoryByProduct} />
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-slate-950">Linimasa Operasional</h2>
                            <p className="mt-0.5 text-xs text-slate-500">Ringkasan status, aktor, dan waktu proses.</p>
                        </div>
                    </div>
                    <Timeline events={timeline} />
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
                    <h2 className="text-sm font-bold text-slate-950">Catatan</h2>
                    <div className="mt-3 space-y-3 text-xs text-slate-600">
                        <NoteRow label="Catatan outlet" value={restock.notes} />
                        <NoteRow label="Catatan owner" value={restock.owner_notes} />
                        {restock.rejected_reason && <NoteRow label="Alasan penolakan" value={restock.rejected_reason} danger />}
                        <NoteRow label="Catatan penerimaan" value={distribution?.received_notes} />
                        <NoteRow label="Catatan kerusakan" value={distribution?.damage_notes} />
                    </div>
                </section>
            </div>
        </OwnerPageShell>
    );
}

function DistributionCard({ distribution, restock, totalDistributed }: any) {
    if (!distribution) {
        return (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-slate-950">Status Distribusi</h2>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Belum ada distribution. Approve request untuk membuat shipment.</p>
                    </div>
                </div>
            </section>
        );
    }

    const actionLabels: Record<string, string> = {
        preparing: 'Siap dikirim ke outlet.',
        shipped: 'Menunggu Konfirmasi Outlet',
        completed: 'Distribusi Selesai',
    };
    const actionLabel = actionLabels[distribution.status] ?? 'Monitoring distribution.';

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Status Distribusi</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-950">Pengiriman #{distribution.id}</h2>
                    <p className="mt-1 text-xs text-slate-500">{actionLabel}</p>
                </div>
                <DistributionStatusBadge status={distribution.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Metric label="Outlet" value={restock.outlet.name} />
                <Metric label="Total item" value={`${distribution.items?.length ?? 0} SKU`} />
                <Metric label="Jumlah kirim" value={`${totalDistributed} unit`} />
                <Metric label="Penanggung jawab" value={distribution.sender?.name ?? restock.approver?.name ?? '-'} />
                <Metric label="Tanggal kirim" value={formatDate(distribution.sent_at)} />
                <Metric label="Tanggal terima" value={formatDate(distribution.received_at)} />
            </div>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-bold text-slate-700">Ringkasan pengiriman</div>
                <div className="space-y-2">
                    {distribution.items.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                            <span className="min-w-0 truncate text-slate-600">{item.product.name}</span>
                            <span className="font-bold text-slate-900">{item.quantity}</span>
                        </div>
                    ))}
                </div>
            </div>

            {distribution.status === 'preparing' && (
                <button
                    type="button"
                    onClick={() => router.post(`/owner/distributions/${distribution.id}/mark-shipped`)}
                    className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white transition-all duration-150 active:scale-[0.98]"
                >
                    Tandai Dikirim
                </button>
            )}

            {distribution.status === 'shipped' && (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs font-semibold text-indigo-700">
                    Menunggu Konfirmasi Outlet
                </div>
            )}

            {distribution.status === 'completed' && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                    Distribusi Selesai
                </div>
            )}

            <Link href={`/owner/distributions/${distribution.id}`} className="mt-3 block text-center text-xs font-bold text-emerald-700">
                Lihat detail distribution
            </Link>
        </section>
    );
}

function ApprovePanel({ restock, inventories, form, onQuantityChange }: any) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-sm font-bold text-slate-950">Setujui & Siapkan</h2>
                    <p className="mt-1 text-xs text-slate-500">Set approved quantity. Distribution akan dibuat status preparing.</p>
                </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                Warehouse stock management belum aktif. Quantity approved belum mengurangi stok pusat.
            </div>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(`/owner/restocks/${restock.id}/approve`);
                }}
                className="mt-4 space-y-3"
            >
                {restock.items.map((item: any, index: number) => {
                    const inventory: any = inventories.get(item.product_id);

                    return (
                        <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-slate-950">{item.product.name}</div>
                                    <div className="mt-0.5 text-xs text-slate-500">Diminta {item.requested_quantity}</div>
                                </div>
                                {inventory ? <StockLevelBadge currentStock={inventory.current_stock} reservedStock={inventory.reserved_stock} minimumStock={inventory.minimum_stock} /> : <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">Stok Kosong</span>}
                            </div>
                            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Jumlah disetujui</label>
                            <input
                                type="number"
                                min="0"
                                value={(form.data.items[index] as any).approved_quantity}
                                onChange={(event) => onQuantityChange(index, Number(event.target.value))}
                                className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>
                    );
                })}

                <textarea
                    value={form.data.owner_notes}
                    onChange={(event) => form.setData('owner_notes', event.target.value)}
                    placeholder="Catatan owner"
                    className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                {form.errors.items && <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{form.errors.items}</div>}
                <button disabled={form.processing} className="min-h-[48px] w-full rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-60">
                    Setujui & Buat Distribusi
                </button>
            </form>
        </section>
    );
}

function RejectPanel({ restock, form }: any) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-950">Tolak Permintaan</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Gunakan hanya jika request tidak bisa dipenuhi.</p>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(`/owner/restocks/${restock.id}/reject`);
                }}
                className="mt-4 space-y-3"
            >
                <textarea
                    value={form.data.rejected_reason}
                    onChange={(event) => form.setData('rejected_reason', event.target.value)}
                    placeholder="Alasan penolakan"
                    className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
                {form.errors.rejected_reason && <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{form.errors.rejected_reason}</div>}
                <button disabled={form.processing} className="min-h-[48px] w-full rounded-lg border border-red-200 px-4 text-sm font-bold text-red-700 transition-all duration-150 active:scale-[0.98] disabled:opacity-60">
                    Tolak
                </button>
            </form>
        </section>
    );
}

function ItemsSummary({ restock, inventories }: any) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-950">Item Permintaan</h2>
            <div className="mt-3 space-y-2">
                {restock.items.map((item: any) => {
                    const inventory: any = inventories.get(item.product_id);

                    return (
                        <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-slate-950">{item.product.name}</div>
                                    <div className="mt-1 text-xs text-slate-500">Diminta {item.requested_quantity} · Disetujui {item.approved_quantity ?? 0}</div>
                                </div>
                                {inventory && <StockLevelBadge currentStock={inventory.current_stock} reservedStock={inventory.reserved_stock} minimumStock={inventory.minimum_stock} />}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
    return (
        <div className="mt-4 space-y-0">
            {events.map((event, index) => (
                <div key={`${event.label}-${index}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                        <div className={`h-3 w-3 rounded-full border-2 ${event.active ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`} />
                        {index < events.length - 1 && <div className="h-full min-h-10 w-px bg-slate-200" />}
                    </div>
                    <div className="pb-4">
                        <div className="text-sm font-bold text-slate-950">{event.label}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{formatDate(event.at)}{event.actor ? ` · ${event.actor}` : ''}</div>
                        {event.note && <div className="mt-1 text-xs leading-5 text-slate-600">{event.note}</div>}
                    </div>
                </div>
            ))}
        </div>
    );
}

function Metric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
    return (
        <div className={`rounded-xl border p-3 ${muted ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
            <div className={`text-[10px] font-semibold uppercase tracking-wide ${muted ? 'text-amber-600' : 'text-slate-400'}`}>{label}</div>
            <div className={`mt-1 truncate text-xs font-bold ${muted ? 'text-amber-800' : 'text-slate-900'}`}>{value}</div>
        </div>
    );
}

function NoteRow({ label, value, danger = false }: { label: string; value?: string | null; danger?: boolean }) {
    return (
        <div className={`rounded-xl border p-3 ${danger ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-100 bg-slate-50'}`}>
            <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
            <div className="mt-1 leading-5">{value || '-'}</div>
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

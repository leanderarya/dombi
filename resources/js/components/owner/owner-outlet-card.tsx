import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import OutletStatusBadge from './outlet-status-badge';

export default function OwnerOutletCard({ outlet }: { outlet: any }) {
    const status = getOperationalStatus(outlet);
    const hasLocation = outlet.latitude && outlet.longitude;

    return (
        <article className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex gap-3">
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {hasLocation ? (
                        <div className="flex h-full flex-col items-center justify-center bg-slate-900 text-center text-[10px] font-bold text-white">
                            <MapPinIcon />
                            <span className="mt-1">Map Ready</span>
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-bold text-slate-400">No Location</div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h2 className="truncate text-base font-semibold text-slate-900">{outlet.name}</h2>
                            <p className="mt-0.5 text-xs text-slate-500">{outlet.kelurahan} · {outlet.kecamatan}</p>
                        </div>
                        <OutletStatusBadge status={status} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-4 text-slate-500">{outlet.address}</p>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px]">
                        <Metric value={outlet.active_orders_count ?? 0} label="Active" />
                        <Metric value={outlet.low_stock_count ?? 0} label="Low" warn={Number(outlet.low_stock_count) > 0} />
                        <Metric value={outlet.pending_restocks_count ?? 0} label="Restock" />
                    </div>
                </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 border-t border-slate-200 pt-3">
                <Action href={`/owner/outlets/${outlet.id}`}>Detail</Action>
                <Action href={`/owner/outlets/${outlet.id}/edit`}>Edit</Action>
                <Action href={`/owner/inventories?outlet_id=${outlet.id}`}>Inventory</Action>
                <Action href={`/owner/restocks?outlet_id=${outlet.id}`}>Restock</Action>
            </div>
            <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Last activity: <span className="tabular-nums">{outlet.updated_at ? new Date(outlet.updated_at).toLocaleString('id-ID') : '-'}</span></div>
        </article>
    );
}

function getOperationalStatus(outlet: any): string {
    if (outlet.status !== 'active') return 'inactive';
    if (Number(outlet.low_stock_count) > 0) return 'low_stock';
    if (Number(outlet.active_orders_count) >= 3) return 'busy';
    return 'active';
}

function Metric({ value, label, warn = false }: { value: number; label: string; warn?: boolean }) {
    return (
        <div className={`rounded-lg border px-2 py-1 ${warn ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-[#F8FAFC] text-slate-600'}`}>
            <div className="font-semibold tabular-nums">{value}</div>
            <div>{label}</div>
        </div>
    );
}

function Action({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link href={href} className="flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-1 text-[10px] font-semibold text-slate-700 transition-colors duration-150 active:bg-[#F8FAFC]">
            {children}
        </Link>
    );
}

function MapPinIcon() {
    return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5h.01" /></svg>;
}

const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10',
    inactive: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/10',
    temporarily_closed:
        'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10',
    maintenance:
        'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/10',
    archived: 'bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-400/10',
    low_stock: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10',
    busy: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/10',
};

const labels: Record<string, string> = {
    active: 'Aktif',
    inactive: 'Nonaktif',
    temporarily_closed: 'Tutup Sementara',
    maintenance: 'Maintenance',
    archived: 'Diarsipkan',
    low_stock: 'Stok Rendah',
    busy: 'Sibuk',
};

export default function OutletStatusBadge({ status }: { status: string }) {
    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status] ?? styles.active}`}
        >
            {labels[status] ?? status}
        </span>
    );
}

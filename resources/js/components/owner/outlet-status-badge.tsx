const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    inactive: 'bg-slate-100 text-slate-600',
    temporarily_closed: 'bg-amber-50 text-amber-700',
    maintenance: 'bg-orange-50 text-orange-700',
    archived: 'bg-slate-100 text-slate-400',
    low_stock: 'bg-amber-50 text-amber-700',
    busy: 'bg-indigo-50 text-indigo-700',
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
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${styles[status] ?? styles.active}`}>
            {labels[status] ?? status}
        </span>
    );
}

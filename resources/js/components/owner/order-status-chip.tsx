import { getOrderStatus } from '@/lib/status-labels';

const chipStyles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    confirmed: 'bg-blue-50 text-blue-800 border-blue-200',
    preparing: 'bg-orange-50 text-orange-800 border-orange-200',
    ready_for_pickup: 'bg-purple-50 text-purple-800 border-purple-200',
    picked_up: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    delivering: 'bg-sky-50 text-sky-800 border-sky-200',
    completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
    failed: 'bg-red-50 text-red-800 border-red-200',
};

export default function OrderStatusChip({ status }: { status: string }) {
    const style = chipStyles[status] ?? chipStyles.pending;
    const { label } = getOrderStatus(status);

    return (
        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style}`}>
            {label}
        </span>
    );
}

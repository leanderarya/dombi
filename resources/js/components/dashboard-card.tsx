export default function DashboardCard({ label, value, helper }: { label: string; value: number | string; helper?: string }) {
    return (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-zinc-500">{label}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
            {helper && <div className="mt-2 text-xs text-zinc-500">{helper}</div>}
        </div>
    );
}

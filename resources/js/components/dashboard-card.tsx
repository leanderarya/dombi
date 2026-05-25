import { Link } from '@inertiajs/react';

interface Props {
    label: string;
    value: number | string;
    helper?: string;
    href?: string;
    color?: string;
    urgent?: boolean;
}

const colorClasses: Record<string, string> = {
    red: 'border-red-100 bg-red-50',
    amber: 'border-amber-100 bg-amber-50',
    yellow: 'border-yellow-100 bg-yellow-50',
    orange: 'border-orange-100 bg-orange-50',
    blue: 'border-blue-100 bg-blue-50',
    purple: 'border-purple-100 bg-purple-50',
    green: 'border-green-100 bg-green-50',
};

export default function DashboardCard({ label, value, helper, href, color, urgent }: Props) {
    const base = colorClasses[color ?? ''] ?? 'border-zinc-100 bg-white';
    const content = (
        <>
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
            {helper && <div className="mt-1 text-xs text-zinc-500">{helper}</div>}
        </>
    );

    const className = `rounded-xl border p-3 shadow-sm ${base} ${urgent ? 'ring-2 ring-amber-300' : ''} active:scale-[0.97] transition-transform`;

    if (href) {
        return <Link href={href} className={className}>{content}</Link>;
    }

    return <div className={className}>{content}</div>;
}

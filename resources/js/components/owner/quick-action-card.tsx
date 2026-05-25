import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

interface Props {
    href: string;
    icon: ReactNode;
    label: string;
}

export default function QuickActionCard({ href, icon, label }: Props) {
    return (
        <Link href={href} className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 transition-transform active:scale-[0.95]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                {icon}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</span>
        </Link>
    );
}

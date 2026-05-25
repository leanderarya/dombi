import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

interface Props {
    href: string;
    icon: ReactNode;
    title: string;
}

export default function AccountMenuItem({ href, icon, title }: Props) {
    return (
        <Link
            href={href}
            className="flex min-h-14 items-center gap-3 rounded-xl border border-zinc-100 bg-white px-4 transition-transform active:scale-[0.98] active:bg-zinc-50"
        >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-slate-600">
                {icon}
            </div>
            <span className="flex-1 text-sm font-medium text-slate-900">{title}</span>
            <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
        </Link>
    );
}

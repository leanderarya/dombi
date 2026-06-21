import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
    title?: string;
    subtitle?: string;
    backHref?: string;
    /** Rendered on the right side of the header */
    right?: ReactNode;
    /** Rendered below the title row (e.g. filter chips) */
    below?: ReactNode;
    /** Make header transparent (no background/border) */
    transparent?: boolean;
}

export default function PageHeader({ title, subtitle, backHref, right, below, transparent }: Props) {
    return (
        <header className={`sticky top-0 z-30 ${transparent ? '' : 'border-b border-zinc-100 bg-surface/95 backdrop-blur'}`}>
            <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                {backHref ? (
                    <Link href={backHref} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                ) : (
                    <div className="w-10" />
                )}

                {title ? (
                    <div className="text-center">
                        <div className="text-sm font-semibold text-text">{title}</div>
                        {subtitle && <div className="text-[11px] text-text-muted">{subtitle}</div>}
                    </div>
                ) : (
                    <div />
                )}

                {right ?? <div className="w-10" />}
            </div>
            {below && (
                <div className="mx-auto max-w-lg px-4 pb-3">
                    {below}
                </div>
            )}
        </header>
    );
}

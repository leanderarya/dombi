import { Link } from '@inertiajs/react';

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface Props {
    links: PaginationLink[];
}

export default function Pagination({ links }: Props) {
    if (!links || links.length <= 3) {
        return null;
    }

    return (
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-1" aria-label="Pagination">
            {links.map((link, i) => {
                if (!link.url) {
                    return (
                        <span
                            key={i}
                            className="inline-flex items-center rounded-md px-2 py-1 text-xs text-slate-400"
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    );
                }

                return (
                    <Link
                        key={i}
                        href={link.url}
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                            link.active
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-slate-600 border border-zinc-200 hover:bg-zinc-50'
                        }`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                        preserveState
                    />
                );
            })}
        </nav>
    );
}

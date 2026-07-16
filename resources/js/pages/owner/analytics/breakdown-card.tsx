import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import EmptyState from '@/components/ui/empty-state';

interface Props {
    title: string;
    data: Record<string, number>;
    statusLabels?: Record<string, string>;
}

export default function BreakdownCard({
    title,
    data,
    statusLabels = {},
}: Props) {
    const [open, setOpen] = useState(false);
    const entries = Object.entries(data);

    return (
        <div
            className="rounded-lg border border-border bg-white"
            aria-label={title}
        >
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between p-3"
                aria-expanded={open}
            >
                <div className="text-xs font-medium text-text-subtle">
                    {title}
                </div>
                <ChevronDown
                    className={`h-3.5 w-3.5 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>
            {open && (
                <div className="border-t border-border px-3 pt-2 pb-3">
                    {entries.length === 0 ? (
                        <EmptyState title="Tidak ada data" />
                    ) : (
                        <div className="space-y-1.5">
                            {entries.map(([status, count]) => (
                                <div
                                    key={status}
                                    className="flex items-center justify-between text-xs"
                                >
                                    <span className="text-text-muted">
                                        {statusLabels[status] ?? status}
                                    </span>
                                    <span className="font-bold text-text tabular-nums">
                                        {count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

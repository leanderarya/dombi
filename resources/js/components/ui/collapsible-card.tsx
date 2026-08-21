import type { ReactNode } from 'react';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
    label: string;
    children: ReactNode;
    defaultOpen?: boolean;
    badge?: string;
    action?: ReactNode;
}

export default function CollapsibleCard({ label, children, defaultOpen = false, badge, action }: Props) {
    const [open, setOpen] = useState(defaultOpen);
    const Icon = open ? ChevronUp : ChevronDown;

    return (
        <div className="rounded-xl border border-border bg-surface">
            <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold tracking-wider text-text-subtle uppercase active:opacity-70"
            >
                <div className="flex items-center gap-2">
                    <span>{label}</span>
                    {badge && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            {badge}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {action}
                    <Icon className="h-3.5 w-3.5 text-text-muted" />
                </div>
            </button>
            {open && <div className="border-t border-border px-4 py-3">{children}</div>}
        </div>
    );
}

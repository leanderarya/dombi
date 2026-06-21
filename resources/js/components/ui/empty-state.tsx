import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface Action {
    label: string;
    href?: string;
    onClick?: () => void;
    variant?: 'primary' | 'secondary';
}

interface Props {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: Action;
    secondaryAction?: Action;
}

export default function EmptyState({ icon, title, description, action, secondaryAction }: Props) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-text-subtle">{icon ?? <Inbox className="h-8 w-8" />}</div>
            <p className="mt-2 text-sm font-medium text-slate-600">{title}</p>
            {description && <p className="mt-1 text-xs text-text-subtle">{description}</p>}
            {(action || secondaryAction) && (
                <div className="mt-4 flex flex-col items-center gap-2">
                    {action && <ActionButton item={action} />}
                    {secondaryAction && <ActionButton item={secondaryAction} />}
                </div>
            )}
        </div>
    );
}

function ActionButton({ item }: { item: Action }) {
    const base = item.variant === 'secondary'
        ? 'inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-slate-700 active:bg-zinc-50'
        : 'inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white active:bg-emerald-800';

    if (item.href) {
        return <a href={item.href} className={base}>{item.label}</a>;
    }

    return (
        <button onClick={item.onClick} className={base}>
            {item.label}
        </button>
    );
}

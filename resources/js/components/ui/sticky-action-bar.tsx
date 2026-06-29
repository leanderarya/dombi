import type { ReactNode } from 'react';

interface Action {
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    type?: 'submit' | 'button';
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
    loading?: boolean;
}

interface Props {
    actions: Action[];
    /** Extra content rendered above actions (e.g. price summary) */
    leading?: ReactNode;
}

const variantStyles = {
    primary: 'bg-emerald-700 text-white active:bg-emerald-800 disabled:bg-zinc-300',
    secondary: 'border border-zinc-200 bg-white text-slate-700 active:bg-zinc-50',
    danger: 'bg-red-600 text-white active:bg-red-700 disabled:bg-zinc-300',
};

export default function StickyActionBar({ actions, leading }: Props) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-100 bg-white/95 backdrop-blur-sm px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto max-w-lg space-y-2">
                {leading}
                {actions.map((action, i) => (
                    <button
                        key={i}
                        type={action.type ?? 'button'}
                        onClick={action.onClick}
                        disabled={action.disabled ?? action.loading}
                        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all active:opacity-80  ${variantStyles[action.variant ?? 'primary']}`}
                    >
                        {action.loading ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : action.icon}
                        {action.loading ? 'Memproses...' : action.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export type { Action };

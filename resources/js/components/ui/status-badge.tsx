type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface Props {
    variant: BadgeVariant;
    children: React.ReactNode;
    size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    danger: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    neutral: 'bg-surface-muted text-slate-600 ring-1 ring-border',
};

const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-[11px]',
};

export default function StatusBadge({ variant, children, size = 'md' }: Props) {
    return (
        <span className={`inline-flex items-center rounded-full font-bold ${variantStyles[variant]} ${sizeStyles[size]}`}>
            {children}
        </span>
    );
}

export type { BadgeVariant };

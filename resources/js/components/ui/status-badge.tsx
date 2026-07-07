import { ALL_STATUSES } from '@/lib/status-labels';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface VariantProps {
    variant: BadgeVariant;
    children: React.ReactNode;
    size?: 'sm' | 'md';
    status?: never;
}

interface StatusProps {
    status: string;
    size?: 'sm' | 'md';
    variant?: never;
    children?: never;
}

type Props = VariantProps | StatusProps;

const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    danger: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    neutral: 'bg-surface-muted text-text-muted ring-1 ring-border',
};

const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-0.5 text-[10px]',
};

function resolveStatus(status: string): { variant: BadgeVariant; label: string } {
    return ALL_STATUSES[status] ?? { variant: 'neutral', label: status.replaceAll('_', ' ') };
}

export default function StatusBadge(props: Props) {
    const { size = 'md' } = props;

    let variant: BadgeVariant;
    let label: React.ReactNode;

    if (props.status) {
        const resolved = resolveStatus(props.status);
        variant = resolved.variant;
        label = resolved.label;
    } else {
        variant = props.variant;
        label = props.children;
    }

    return (
        <span className={`inline-flex items-center rounded-lg font-bold ${variantStyles[variant]} ${sizeStyles[size]}`}>
            {label}
        </span>
    );
}

export type { BadgeVariant };

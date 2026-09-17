import { ALL_STATUSES } from '@/lib/status-labels';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface VariantProps {
    variant: BadgeVariant;
    children: React.ReactNode;
    size?: 'sm' | 'md';
    className?: string;
    status?: never;
}

interface StatusProps {
    status: string;
    size?: 'sm' | 'md';
    className?: string;
    variant?: never;
    children?: never;
}

type Props = VariantProps | StatusProps;

/**
 * The one canonical pill in the app. Both modes — resolve from a status
 * string, or pass a variant directly — share these classes so a badge can
 * never drift from the token set.
 */
export const BADGE_BASE = 'inline-flex items-center rounded-full font-bold';

export const BADGE_VARIANT_CLASSES: Record<BadgeVariant, string> = {
    success: 'bg-success-bg text-success-text',
    warning: 'bg-warning-bg text-warning-text',
    danger: 'bg-danger-bg text-danger-text',
    info: 'bg-info-bg text-info-text',
    neutral: 'bg-surface-muted text-text-muted',
};

const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-caption',
    md: 'px-2.5 py-1 text-caption',
};

function resolveStatus(status: string): { variant: BadgeVariant; label: string } {
    return (
        ALL_STATUSES[status] ?? {
            variant: 'neutral',
            label: status.replaceAll('_', ' '),
        }
    );
}

export default function StatusBadge(props: Props) {
    const { size = 'md', className } = props;

    let variant: BadgeVariant;
    let label: React.ReactNode;

    if (typeof props.status === 'string') {
        const resolved = resolveStatus(props.status);
        variant = resolved.variant;
        label = resolved.label;
    } else {
        variant = props.variant ?? 'neutral';
        label = props.children;
    }

    return (
        <span
            className={`${BADGE_BASE} ${BADGE_VARIANT_CLASSES[variant]} ${sizeStyles[size]} ${className ?? ''}`}
        >
            {label}
        </span>
    );
}

export type { BadgeVariant };

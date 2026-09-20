import { Link } from '@inertiajs/react';

interface Props {
    label: string;
    value: number;
    href?: string;
    color: 'blue' | 'purple' | 'amber' | 'red' | 'green' | 'slate';
}

const colorClasses: Record<string, { bg: string; text: string; ring: string }> =
    {
        blue: {
            bg: 'bg-info-bg',
            text: 'text-info-text',
            ring: 'ring-info-border',
        },
        purple: {
            bg: 'bg-status-active-bg',
            text: 'text-status-active',
            ring: 'ring-status-active-border',
        },
        amber: {
            bg: 'bg-warning-bg',
            text: 'text-warning-text',
            ring: 'ring-warning-border',
        },
        red: {
            bg: 'bg-danger-bg',
            text: 'text-danger-text',
            ring: 'ring-danger-border',
        },
        green: {
            bg: 'bg-success-bg',
            text: 'text-success-text',
            ring: 'ring-success-border',
        },
        slate: {
            bg: 'bg-surface-muted',
            text: 'text-text',
            ring: 'ring-border',
        },
    };

export default function DeliveryPerformanceCard({
    label,
    value,
    href,
    color,
}: Props) {
    const c = colorClasses[color] ?? colorClasses.slate;
    const Wrapper = href ? Link : 'div';

    return (
        <Wrapper
            {...(href ? { href } : {})}
            className={`rounded-lg border border-border ${c.bg} p-3 transition-all duration-150 active:opacity-80 ${value > 0 && color === 'red' ? 'ring-2 ' + c.ring : ''}`}
        >
            <div
                className={`text-xs font-bold tracking-wider uppercase ${c.text}`}
            >
                {label}
            </div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${c.text}`}>
                {value}
            </div>
        </Wrapper>
    );
}

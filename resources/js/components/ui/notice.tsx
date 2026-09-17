import type { LucideIcon } from 'lucide-react';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success' | 'neutral';

/**
 * Two shapes, both from the approved kanvas:
 *
 * - `variant="strip"` — one line, no border, neutral by default. For quiet
 *   asides such as "Butuh bantuan? Hubungi outlet".
 * - `variant="block"` — tinted panel with 1px border, a title and body, plus
 *   an optional action. For states the customer must read.
 *
 * Tones resolve to the semantic tint tokens declared in @theme. The `neutral`
 * tone has no border because surface-muted has no matching tint pair.
 */
interface BaseProps {
    tone?: NoticeTone;
    title?: string;
    icon?: LucideIcon;
    children: React.ReactNode;
    className?: string;
}

interface StripProps extends BaseProps {
    variant?: 'strip';
    action?: never;
}

interface BlockProps extends BaseProps {
    variant: 'block';
    /** Rendered full-width at the bottom of the block. */
    action?: React.ReactNode;
}

type Props = StripProps | BlockProps;

const stripToneStyles: Record<NoticeTone, string> = {
    info: 'bg-info-bg text-info-text',
    warning: 'bg-warning-bg text-warning-text',
    danger: 'bg-danger-bg text-danger-text',
    success: 'bg-success-bg text-success-text',
    neutral: 'bg-surface-muted text-text-muted',
};

const blockToneStyles: Record<NoticeTone, string> = {
    info: 'bg-info-bg text-info-text border-info-border',
    warning: 'bg-warning-bg text-warning-text border-warning-border',
    danger: 'bg-danger-bg text-danger-text border-danger-border',
    success: 'bg-success-bg text-success-text border-success-border',
    neutral: 'bg-surface-muted text-text-muted border-transparent',
};

export default function Notice(props: Props) {
    const { tone = 'neutral', icon: Icon, children, className } = props;

    if (props.variant !== 'block') {
        return (
            <div
                className={`flex items-center justify-between gap-2.5 rounded-control px-3 py-2.5 text-caption ${stripToneStyles[tone]} ${className ?? ''}`}
            >
                <span className="min-w-0">{children}</span>
                {Icon && <Icon className="size-3 shrink-0" />}
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col gap-2 rounded-card border p-4 ${blockToneStyles[tone]} ${className ?? ''}`}
        >
            {(props.title || Icon) && (
                <div className="flex items-center gap-2.5">
                    {Icon && <Icon className="size-[18px] shrink-0" />}
                    {props.title && (
                        <p className="text-control font-bold">{props.title}</p>
                    )}
                </div>
            )}
            <div className="text-caption leading-relaxed">{children}</div>
            {props.action}
        </div>
    );
}

export type { NoticeTone };

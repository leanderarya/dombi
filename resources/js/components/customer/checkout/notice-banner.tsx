import { AlertTriangle, Info, X, XCircle } from 'lucide-react';

type Variant = 'error' | 'warning' | 'info';

interface Props {
    variant: Variant;
    title: string;
    message?: string;
    onDismiss?: () => void;
    action?: { label: string; onClick: () => void };
}

const STYLES: Record<
    Variant,
    { container: string; icon: string; title: string; message: string }
> = {
    error: {
        container: 'border-red-200 bg-red-50',
        icon: 'text-red-600',
        title: 'text-red-800',
        message: 'text-red-600',
    },
    warning: {
        container: 'border-amber-200 bg-amber-50',
        icon: 'text-amber-600',
        title: 'text-amber-800',
        message: 'text-amber-600',
    },
    info: {
        container: 'border-blue-200 bg-blue-50',
        icon: 'text-blue-600',
        title: 'text-blue-800',
        message: 'text-blue-600',
    },
};

const ICONS: Record<Variant, typeof XCircle> = {
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

export default function NoticeBanner({
    variant,
    title,
    message,
    onDismiss,
    action,
}: Props) {
    const style = STYLES[variant];
    const Icon = ICONS[variant];

    return (
        <div
            className={`flex items-start gap-3 rounded-xl border ${style.container} p-4`}
        >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} />
            <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${style.title}`}>
                    {title}
                </p>
                {message && (
                    <p className={`mt-1 text-xs ${style.message}`}>{message}</p>
                )}
                {action && (
                    <button
                        type="button"
                        onClick={action.onClick}
                        className={`mt-2 min-h-[44px] text-xs font-semibold ${style.title} active:opacity-80`}
                    >
                        {action.label}
                    </button>
                )}
            </div>
            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center ${style.icon} active:opacity-80`}
                    aria-label="Tutup"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}

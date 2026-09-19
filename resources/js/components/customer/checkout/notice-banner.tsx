import { AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Notice from '@/components/ui/notice';

type Variant = 'error' | 'warning' | 'info';

interface Props {
    variant: Variant;
    title: string;
    message?: string;
    onDismiss?: () => void;
    action?: { label: string; onClick: () => void };
}

const TONE: Record<Variant, 'danger' | 'warning' | 'info'> = {
    error: 'danger',
    warning: 'warning',
    info: 'info',
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
    const controls =
        action || onDismiss ? (
            <div className="flex items-center gap-2">
                {action && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={action.onClick}
                        className="min-h-11 text-current"
                    >
                        {action.label}
                    </Button>
                )}
                {onDismiss && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onDismiss}
                        aria-label="Tutup"
                        className="ml-auto h-11 w-11 shrink-0 text-current"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        ) : undefined;

    return (
        <Notice
            variant="block"
            tone={TONE[variant]}
            icon={ICONS[variant]}
            title={title}
            action={controls}
        >
            {message}
        </Notice>
    );
}

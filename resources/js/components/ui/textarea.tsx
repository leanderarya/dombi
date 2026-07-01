import { type TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, label, error, id: propId, ...props }, ref) => {
        const generatedId = useId();
        const id = propId || generatedId;
        const errorId = `${id}-error`;

        return (
            <div className="space-y-1">
                {label && (
                    <label htmlFor={id} className="text-sm font-medium text-text">
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    id={id}
                    className={cn(
                        'w-full rounded-[--radius-control] border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle transition-colors',
                        'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                        error && 'border-danger focus:border-danger focus:ring-danger',
                        className
                    )}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? errorId : undefined}
                    {...props}
                />
                {error && (
                    <p id={errorId} className="text-xs text-danger" role="alert">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Textarea.displayName = 'Textarea';

export { Textarea };
export type { TextareaProps };

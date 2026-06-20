import { type InputHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ComponentType<{ className?: string }>;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, icon: Icon, id: propId, ...props }, ref) => {
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
                <div className="relative">
                    {Icon && (
                        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
                    )}
                    <input
                        ref={ref}
                        id={id}
                        className={cn(
                            'w-full rounded-[--radius-control] border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle transition-colors',
                            'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                            error && 'border-danger focus:border-danger focus:ring-danger',
                            Icon && 'pl-10',
                            className
                        )}
                        aria-invalid={error ? 'true' : undefined}
                        aria-describedby={error ? errorId : undefined}
                        {...props}
                    />
                </div>
                {error && (
                    <p id={errorId} className="text-xs text-danger" role="alert">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input };
export type { InputProps };

import { ChevronDown } from 'lucide-react';
import { type SelectHTMLAttributes, forwardRef, useId } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: SelectOption[];
    placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, label, error, options, placeholder, id: propId, ...props }, ref) => {
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
                    <select
                        ref={ref}
                        id={id}
                        className={cn(
                            'w-full min-h-11 appearance-none rounded-control border border-border bg-surface px-3 py-2 pr-9 text-sm text-text transition-colors',
                            'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                            error && 'border-danger focus:border-danger focus:ring-danger',
                            className
                        )}
                        aria-invalid={error ? 'true' : undefined}
                        aria-describedby={error ? errorId : undefined}
                        {...props}
                    >
                        {placeholder && (
                            <option value="" disabled>
                                {placeholder}
                            </option>
                        )}
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    {/*
                     * Drawn as an element rather than the background-image this
                     * used to carry. That chevron never painted on the select,
                     * and since the control also sets appearance-none it left
                     * the field with no dropdown affordance at all. Input
                     * renders its icon the same way.
                     */}
                    <ChevronDown
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-text-muted"
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

Select.displayName = 'Select';

export { Select };
export type { SelectProps, SelectOption };

import { type SelectHTMLAttributes, forwardRef, useId } from 'react';
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
                <select
                    ref={ref}
                    id={id}
                    className={cn(
                        'w-full appearance-none rounded-[--radius-control] border border-border bg-surface px-3 py-2 pr-8 text-sm text-text transition-colors',
                        'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23717171%27 stroke-width=%272.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpolyline points=%276 9 12 15 18 9%27/%3E%3C/svg%3E")] bg-[length:10px] bg-[right_8px_center] bg-no-repeat',
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

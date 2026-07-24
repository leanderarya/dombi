import { InputHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, label, id: propId, ...props }, ref) => {
        const generatedId = useId();
        const id = propId || generatedId;

        return (
            <div className="flex items-center gap-2">
                <input
                    ref={ref}
                    type="checkbox"
                    id={id}
                    className={cn(
                        'h-4 w-4 rounded border-border accent-primary',
                        className,
                    )}
                    {...props}
                />
                {label && (
                    <label htmlFor={id} className="text-sm text-text">
                        {label}
                    </label>
                )}
            </div>
        );
    },
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };

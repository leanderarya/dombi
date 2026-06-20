import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
    {
        variants: {
            variant: {
                primary: 'bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary',
                secondary: 'border border-border text-text hover:bg-surface-muted focus-visible:ring-border',
                danger: 'border border-red-200 text-red-700 hover:bg-red-50 focus-visible:ring-red-500',
                ghost: 'text-text hover:bg-surface-muted focus-visible:ring-border',
            },
            size: {
                sm: 'h-8 px-3 text-xs rounded-[--radius-chip]',
                md: 'h-9 px-4 text-sm rounded-[--radius-control]',
                lg: 'h-11 px-6 text-sm rounded-[--radius-control]',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    }
);

interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    loading?: boolean;
    icon?: React.ComponentType<{ className?: string }>;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, loading, icon: Icon, children, disabled, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(buttonVariants({ variant, size, className }))}
                disabled={disabled || loading}
                aria-busy={loading}
                {...props}
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : Icon ? (
                    <Icon className="h-4 w-4" />
                ) : null}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
export type { ButtonProps };

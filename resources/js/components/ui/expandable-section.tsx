import { type ReactNode, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandableSectionProps {
    title: string;
    count: number;
    countColor?: 'blue' | 'red' | 'amber';
    children: ReactNode;
    defaultExpanded?: boolean;
    action?: {
        label: string;
        href: string;
    };
    className?: string;
}

const countColorStyles = {
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
};

export function ExpandableSection({
    title,
    count,
    countColor = 'blue',
    children,
    defaultExpanded = false,
    action,
    className,
}: ExpandableSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const toggle = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    return (
        <div className={cn('overflow-hidden rounded-xl border border-border bg-surface', className)}>
            <button
                type="button"
                onClick={toggle}
                className="flex w-full items-center justify-between bg-surface-muted px-4 py-3 transition-colors hover:bg-surface-muted/80"
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">{title}</span>
                    {count > 0 && (
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold text-white', countColorStyles[countColor])}>
                            {count}
                        </span>
                    )}
                </div>
                <ChevronDown
                    className={cn('h-4 w-4 text-text-subtle transition-transform duration-200', isExpanded && 'rotate-180')}
                />
            </button>
            {isExpanded && (
                <div className="border-t border-border px-4 py-3">
                    {children}
                    {action && count > 0 && (
                        <a
                            href={action.href}
                            className="mt-3 inline-block text-xs font-semibold text-primary hover:text-primary-hover"
                        >
                            {action.label} →
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

interface ExpandableItemProps {
    icon?: ReactNode;
    children: ReactNode;
    action?: {
        label: string;
        href: string;
    };
}

export function ExpandableItem({ icon, children, action }: ExpandableItemProps) {
    return (
        <div className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
            <div className="flex items-center gap-3">
                {icon && <span className="text-sm">{icon}</span>}
                <span className="text-sm text-text">{children}</span>
            </div>
            {action && (
                <a
                    href={action.href}
                    className="text-xs font-semibold text-primary hover:text-primary-hover"
                >
                    {action.label}
                </a>
            )}
        </div>
    );
}

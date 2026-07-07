import { type ReactNode, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandableSectionProps {
    title: string;
    icon?: ReactNode;
    count: number;
    countColor?: 'blue' | 'red' | 'amber';
    children: ReactNode;
    defaultExpanded?: boolean;
    className?: string;
}

const countColorStyles = {
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
};

export function ExpandableSection({
    title,
    icon,
    count,
    countColor = 'blue',
    children,
    defaultExpanded = false,
    className,
}: ExpandableSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const toggle = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    return (
        <div className={cn('overflow-hidden rounded-lg border border-border bg-surface', className)}>
            <button
                type="button"
                onClick={toggle}
                className="flex w-full items-center justify-between px-3 py-2.5 transition-colors hover:bg-surface-muted"
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-muted text-text-muted">
                            {icon}
                        </div>
                    )}
                    <span className="text-sm font-semibold text-text">{title}</span>
                    {count > 0 && (
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', countColorStyles[countColor])}>
                            {count}
                        </span>
                    )}
                </div>
                <ChevronDown
                    className={cn('h-4 w-4 text-text-subtle transition-transform duration-200', isExpanded && 'rotate-180')}
                />
            </button>
            <div className={cn(
                'grid transition-all duration-200 ease-in-out',
                isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            )}>
                <div className="overflow-hidden">
                    <div className="border-t border-border px-3 py-2">
                        {children}
                    </div>
                </div>
            </div>
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

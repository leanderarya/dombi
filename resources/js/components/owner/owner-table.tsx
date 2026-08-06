import type { ReactNode } from 'react';

interface Props {
    children: ReactNode;
    /** Minimum width for horizontal scroll (default 600px) */
    minWidth?: string;
    /** Remove the outer background/ring wrapper */
    noWrapper?: boolean;
}

export default function OwnerTable({
    children,
    minWidth = '600px',
    noWrapper = false,
}: Props) {
    const content = (
        <div className="w-full caption-bottom text-sm" style={{ minWidth }}>
            {children}
        </div>
    );

    if (noWrapper) {
        return content;
    }

    return (
        <div className="overflow-x-auto rounded-xl bg-surface shadow-card ring-1 ring-foreground/10">
            {content}
        </div>
    );
}

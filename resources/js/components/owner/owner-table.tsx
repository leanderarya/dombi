import type { ReactNode } from 'react';

interface Props {
    children: ReactNode;
    /** Minimum width for horizontal scroll (default 600px) */
    minWidth?: string;
    /** Remove the outer background/ring wrapper */
    noWrapper?: boolean;
    /** Accessible name for the table's scroll region. */
    'aria-label'?: string;
}

export default function OwnerTable({
    children,
    minWidth = '600px',
    noWrapper = false,
    'aria-label': ariaLabel,
}: Props) {
    const content = (
        <div className="w-full caption-bottom text-sm" style={{ minWidth }}>
            {children}
        </div>
    );

    // The scroll container is needed whatever the styling: `minWidth` forces
    // the table wider than a phone viewport, and without an overflow container
    // that width spills out of the card (or gets clipped by a parent) instead
    // of scrolling. `noWrapper` therefore drops only the visual chrome — the
    // background, shadow and ring that callers already draw themselves.
    return (
        <div
            className={
                noWrapper
                    ? 'overflow-x-auto'
                    : 'overflow-x-auto rounded-xl bg-surface shadow-card ring-1 ring-foreground/10'
            }
            // A scrollable region needs a name and a tab stop to be reachable
            // without a mouse; aria-label alone on a plain div is not exposed.
            role={ariaLabel ? 'region' : undefined}
            aria-label={ariaLabel}
            tabIndex={ariaLabel ? 0 : undefined}
        >
            {content}
        </div>
    );
}

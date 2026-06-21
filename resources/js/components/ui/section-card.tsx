import type { ReactNode } from 'react';

interface Props {
    children: ReactNode;
    /** Section label rendered above the card */
    label?: string;
    /** Right-side content in the label row (e.g. "View All" link) */
    labelRight?: ReactNode;
    /** Additional className for the card wrapper */
    className?: string;
    /** Remove the default padding */
    noPadding?: boolean;
}

export default function SectionCard({ children, label, labelRight, className = '', noPadding }: Props) {
    return (
        <div>
            {(label || labelRight) && (
                <div className="mb-2 flex items-center justify-between">
                    {label && <h2 className="text-xs font-semibold uppercase tracking-wider text-text-subtle">{label}</h2>}
                    {labelRight}
                </div>
            )}
            <div className={`rounded-2xl border border-border bg-surface ${noPadding ? '' : 'p-5'} ${className}`}>
                {children}
            </div>
        </div>
    );
}

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
        <div className="mb-6">
            {(label || labelRight) && (
                <div className="mb-2 flex items-center justify-between px-1">
                    {label && <h2 className="text-[13px] font-normal text-text-subtle">{label}</h2>}
                    {labelRight}
                </div>
            )}
            <div className={`overflow-hidden rounded-xl bg-white ${noPadding ? '' : 'p-4'} ${className}`}>
                {children}
            </div>
        </div>
    );
}

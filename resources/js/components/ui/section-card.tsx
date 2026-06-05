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
                    {label && <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</h2>}
                    {labelRight}
                </div>
            )}
            <div className={`rounded-xl border border-zinc-200 bg-white ${noPadding ? '' : 'p-4'} ${className}`}>
                {children}
            </div>
        </div>
    );
}

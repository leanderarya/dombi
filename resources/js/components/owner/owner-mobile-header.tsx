import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

interface Props {
    title: string;
    subtitle?: string;
    /** Show back button — provide href for navigation */
    backHref?: string;
    /** Right-side action buttons */
    actions?: ReactNode;
}

/**
 * Unified operational mobile header for all Owner pages.
 * Compact 56px height, sticky, safe-area aware.
 */
export default function OwnerMobileHeader({ title, subtitle, backHref, actions }: Props) {
    return (
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
            <div className="flex min-h-14 items-center gap-2 px-4">
                {/* Left: back button or spacer */}
                {backHref ? (
                    <Link href={backHref} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all duration-150 active:scale-[0.98] active:bg-slate-50">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                ) : null}

                {/* Center: title + subtitle */}
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-bold text-slate-900">{title}</h1>
                    {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
                </div>

                {/* Right: action buttons */}
                {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
            </div>
        </header>
    );
}

/**
 * Standard header icon button.
 * 40x40, rounded-xl, border, consistent interaction.
 */
export function HeaderIconButton({ onClick, children, label }: { onClick?: () => void; children: ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all duration-150 active:scale-[0.98] active:bg-slate-50"
        >
            {children}
        </button>
    );
}

// Common header icons
export function SearchIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
}

export function FilterIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>;
}

export function NotificationIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
}

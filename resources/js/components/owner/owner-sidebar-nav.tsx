import { Link, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface NavItem {
    href: string;
    label: string;
    badgeKey?: 'pendingReturns' | 'pendingExchanges';
    isActive?: (url: string) => boolean;
}

interface NavGroup {
    label: string;
    icon: ReactNode;
    items: NavItem[];
}

interface Props {
    navGroups: NavGroup[];
    pendingCounts: Record<string, number>;
}

export default function OwnerSidebarNav({ navGroups, pendingCounts }: Props) {
    const { url } = usePage();
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    useEffect(() => {
        const activeGroup = navGroups.find((g) =>
            g.items.some((item) => isItemActive(item, url))
        );

        if (activeGroup) {
            setExpandedGroups((prev) => {
                const next = new Set(prev);
                next.add(activeGroup.label);

                return next;
            });
        }
    }, [url, navGroups]);

    const isItemActive = (item: NavItem, currentUrl: string): boolean => {
        if (!currentUrl) {
return false;
}

        if (item.isActive) {
return item.isActive(currentUrl);
}

        const pathname = currentUrl.split('?')[0];

        return pathname === item.href || pathname.startsWith(item.href + '/');
    };

    const toggleGroup = (label: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);

            if (next.has(label)) {
                next.delete(label);
            } else {
                next.add(label);
            }

            return next;
        });
    };

    return (
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
            {navGroups.map((group, groupIndex) => {
                const isExpanded = expandedGroups.has(group.label);
                const hasActive = group.items.some((item) => isItemActive(item, url));

                return (
                    <div key={group.label} className={groupIndex > 0 ? 'mt-0.5' : ''}>
                        {group.items.length === 1 ? (
                            <Link
                                href={group.items[0].href}
                                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-150 ${
                                    isItemActive(group.items[0], url)
                                        ? 'bg-white font-semibold text-emerald-700 shadow-sm'
                                        : 'font-medium text-slate-500 hover:bg-white/60 hover:text-slate-700'
                                }`}
                            >
                                <span className="h-4 w-4 shrink-0 opacity-70">{group.icon}</span>
                                {group.label}
                            </Link>
                        ) : (
                            <>
                                <button
                                    onClick={() => toggleGroup(group.label)}
                                    aria-expanded={isExpanded}
                                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[11px] transition-all duration-150 ${
                                        hasActive
                                            ? 'font-semibold text-slate-900'
                                            : 'font-medium text-slate-500 hover:bg-white/60 hover:text-slate-700'
                                    }`}
                                >
                                    <span className="h-4 w-4 shrink-0 opacity-70">{group.icon}</span>
                                    <span className="flex-1 text-left">{group.label}</span>
                                    <ChevronIcon expanded={isExpanded} />
                                </button>
                                {isExpanded && (
                                    <div className="ml-4 mt-0.5 space-y-px">
                                        {group.items.map((item) => {
                                            const active = isItemActive(item, url);
                                            const badgeCount = item.badgeKey ? (pendingCounts[item.badgeKey] ?? 0) : 0;

                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={`flex items-center justify-between rounded-lg px-2.5 py-1 text-xs transition-all duration-150 ${
                                                        active
                                                            ? 'bg-white font-semibold text-emerald-700 shadow-sm'
                                                            : 'font-medium text-slate-500 hover:bg-white/60 hover:text-slate-700'
                                                    }`}
                                                >
                                                    <span>{item.label}</span>
                                                    {badgeCount > 0 && (
                                                        <span className="min-w-4.5 rounded-full bg-amber-400 px-1.5 py-px text-center text-[10px] font-bold text-white">
                                                            {badgeCount}
                                                        </span>
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
    return (
        <svg
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
    );
}

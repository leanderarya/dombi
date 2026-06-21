import { Link, usePage } from '@inertiajs/react';
import { useEffect, useState  } from 'react';
import type {ReactNode} from 'react';

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

    // Auto-expand group containing active item when URL changes
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

        return currentUrl === item.href || currentUrl.startsWith(item.href + '/');
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
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
            {navGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.label);
                const hasActive = group.items.some((item) => isItemActive(item, url));

                return (
                    <div key={group.label} className="mb-1">
                        {group.items.length === 1 ? (
                            /* Single-item groups render as direct link */
                            <Link
                                href={group.items[0].href}
                                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                    isItemActive(group.items[0], url)
                                        ? 'bg-zinc-100 text-text'
                                        : 'text-slate-600 hover:bg-surface-muted'
                                }`}
                            >
                                <span className="h-4 w-4 shrink-0">{group.icon}</span>
                                {group.label}
                            </Link>
                        ) : (
                            <>
                                <button
                                    onClick={() => toggleGroup(group.label)}
                                    aria-expanded={isExpanded}
                                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                        hasActive
                                            ? 'text-text'
                                            : 'text-slate-600 hover:bg-surface-muted'
                                    }`}
                                >
                                    <span className="h-4 w-4 shrink-0">{group.icon}</span>
                                    <span className="flex-1 text-left">{group.label}</span>
                                    <ChevronIcon expanded={isExpanded} />
                                </button>
                                {isExpanded && (
                                    <div className="ml-6 mt-0.5 space-y-0.5">
                                        {group.items.map((item) => (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`block rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                                    isItemActive(item, url)
                                                        ? 'bg-zinc-100 text-text'
                                                        : 'text-text-muted hover:bg-surface-muted'
                                                }`}
                                            >
                                                <span className="flex items-center justify-between gap-2">
                                                    <span>{item.label}</span>
                                                    {item.badgeKey && (pendingCounts[item.badgeKey] ?? 0) > 0 && (
                                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                                            {pendingCounts[item.badgeKey]}
                                                        </span>
                                                    )}
                                                </span>
                                            </Link>
                                        ))}
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
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
    );
}

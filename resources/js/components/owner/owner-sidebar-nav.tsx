import { Link, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
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
    collapsed?: boolean;
}

export default function OwnerSidebarNav({
    navGroups,
    pendingCounts,
    collapsed = false,
}: Props) {
    const { url } = usePage();
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        new Set(),
    );
    const [flyoutGroup, setFlyoutGroup] = useState<string | null>(null);
    const [flyoutPosition, setFlyoutPosition] = useState(0);
    const flyoutRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        const activeGroup = navGroups.find((g) =>
            g.items.some((item) => isItemActive(item, url)),
        );

        if (activeGroup && !expandedGroups.has(activeGroup.label)) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- sync expanded state with URL changes
            setExpandedGroups((prev) => {
                const next = new Set(prev);
                next.add(activeGroup.label);

                return next;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- expandedGroups checked for early exit, not a trigger
    }, [url, navGroups]);

    useEffect(() => {
        if (!flyoutGroup) {
            return;
        }

        const handleClick = (e: MouseEvent) => {
            if (
                flyoutRef.current &&
                !flyoutRef.current.contains(e.target as Node)
            ) {
                setFlyoutGroup(null);
            }
        };
        document.addEventListener('mousedown', handleClick);

        return () => document.removeEventListener('mousedown', handleClick);
    }, [flyoutGroup]);

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

    if (collapsed) {
        const activeFlyoutGroup = flyoutGroup
            ? navGroups.find((g) => g.label === flyoutGroup)
            : null;

        return (
            <>
                <nav className="flex-1 overflow-y-auto px-2 pb-4">
                    {navGroups.map((group) => {
                        const hasActive = group.items.some((item) =>
                            isItemActive(item, url),
                        );
                        const isSingle = group.items.length === 1;
                        const isFlyoutOpen = flyoutGroup === group.label;

                        if (isSingle) {
                            return (
                                <Link
                                    key={group.label}
                                    href={group.items[0].href}
                                    title={group.label}
                                    className={`mt-0.5 flex h-9 w-full items-center justify-center rounded-lg transition-colors duration-150 ${
                                        isItemActive(group.items[0], url)
                                            ? 'bg-mint-wash text-primary'
                                            : 'hover:bg-mint-wash/60 text-text-muted hover:text-text'
                                    }`}
                                >
                                    <span className="h-4 w-4 shrink-0">
                                        {group.icon}
                                    </span>
                                </Link>
                            );
                        }

                        return (
                            <div key={group.label} className="relative mt-0.5">
                                <button
                                    onClick={(e) => {
                                        const rect =
                                            e.currentTarget.getBoundingClientRect();
                                        setFlyoutPosition(rect.top);
                                        setFlyoutGroup(
                                            isFlyoutOpen ? null : group.label,
                                        );
                                    }}
                                    title={group.label}
                                    className={`flex h-9 w-full items-center justify-center rounded-lg transition-colors duration-150 ${
                                        hasActive
                                            ? 'bg-mint-wash text-primary'
                                            : 'hover:bg-mint-wash/60 text-text-muted hover:text-text'
                                    }`}
                                >
                                    <span className="h-4 w-4 shrink-0">
                                        {group.icon}
                                    </span>
                                </button>
                            </div>
                        );
                    })}
                </nav>

                {/* Flyout — rendered outside nav to avoid overflow clip */}
                {activeFlyoutGroup && (
                    <div
                        ref={flyoutRef}
                        className="fixed z-[60] w-48 rounded-xl bg-surface py-1.5 shadow-card"
                        style={{
                            left: '4rem',
                            top: `${flyoutPosition}px`,
                        }}
                    >
                        <div className="px-3 py-1.5 text-[10px] font-semibold tracking-widest text-text-subtle uppercase">
                            {activeFlyoutGroup.label}
                        </div>
                        {activeFlyoutGroup.items.map((item) => {
                            const active = isItemActive(item, url);
                            const badgeCount = item.badgeKey
                                ? (pendingCounts[item.badgeKey] ?? 0)
                                : 0;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setFlyoutGroup(null)}
                                    className={`flex items-center justify-between px-3 py-2 text-sm transition-colors duration-150 ${
                                        active
                                            ? 'bg-mint-wash font-semibold text-primary'
                                            : 'hover:bg-mint-wash/60 text-text-muted hover:text-text'
                                    }`}
                                >
                                    <span>{item.label}</span>
                                    {badgeCount > 0 && (
                                        <span className="min-w-[18px] rounded-full bg-amber-100 px-1.5 py-px text-center text-[10px] font-bold text-amber-700">
                                            {badgeCount}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </>
        );
    }

    return (
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
            {navGroups.map((group, groupIndex) => {
                const isExpanded = expandedGroups.has(group.label);
                const hasActive = group.items.some((item) =>
                    isItemActive(item, url),
                );

                return (
                    <div
                        key={group.label}
                        className={groupIndex > 0 ? 'mt-1' : ''}
                    >
                        {group.items.length === 1 ? (
                            <Link
                                href={group.items[0].href}
                                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                                    isItemActive(group.items[0], url)
                                        ? 'bg-mint-wash font-semibold text-primary'
                                        : 'hover:bg-mint-wash/60 font-medium text-text-muted hover:text-text'
                                }`}
                            >
                                <span className="h-4 w-4 shrink-0">
                                    {group.icon}
                                </span>
                                {group.label}
                            </Link>
                        ) : (
                            <>
                                <button
                                    onClick={() => toggleGroup(group.label)}
                                    aria-expanded={isExpanded}
                                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors duration-150 ${
                                        hasActive
                                            ? 'font-semibold text-text'
                                            : 'hover:bg-mint-wash/60 font-medium text-text-muted hover:text-text'
                                    }`}
                                >
                                    <span className="h-4 w-4 shrink-0">
                                        {group.icon}
                                    </span>
                                    <span className="flex-1 text-left">
                                        {group.label}
                                    </span>
                                    <ChevronIcon expanded={isExpanded} />
                                </button>
                                {isExpanded && (
                                    <div className="mt-0.5 ml-5 space-y-0.5">
                                        {group.items.map((item) => {
                                            const active = isItemActive(
                                                item,
                                                url,
                                            );
                                            const badgeCount = item.badgeKey
                                                ? (pendingCounts[
                                                      item.badgeKey
                                                  ] ?? 0)
                                                : 0;

                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 ${
                                                        active
                                                            ? 'bg-mint-wash font-semibold text-primary'
                                                            : 'hover:bg-mint-wash/60 font-medium text-text-muted hover:text-text'
                                                    }`}
                                                >
                                                    <span>{item.label}</span>
                                                    {badgeCount > 0 && (
                                                        <span className="min-w-[18px] rounded-full bg-amber-100 px-1.5 py-px text-center text-[10px] font-bold text-amber-700">
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
            className={`h-3.5 w-3.5 shrink-0 text-text-subtle transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
            />
        </svg>
    );
}

import { router } from '@inertiajs/react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { SkeletonPage } from '@/components/ui/skeleton';
import { getInitialOwnerTab } from '../tab-state';
import { AuditTrailTab } from './audit-tab';
import { DashboardTab } from './dashboard-tab';
import { LaporanTab } from './laporan-tab';
import { MasalahTab } from './masalah-tab';

const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'audit', label: 'Audit Trail' },
    { key: 'laporan', label: 'Laporan' },
    { key: 'masalah', label: 'Masalah' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface Props {
    kpis?: any;
    outletRevenue?: any[];
    topProducts?: any[];
    period?: string;
    insight?: string;
    movements?: any;
    outlets?: any[];
    products?: any[];
    filters?: Record<string, any>;
    summary?: any;
    ordersByStatus?: Record<string, number>;
    deliveriesByStatus?: Record<string, number>;
    reports?: any;
}

export default function AnalyticsIndex(props: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>(() =>
        getInitialOwnerTab(
            TABS.map((tab) => tab.key),
            'dashboard',
        ),
    );

    const handleTabChange = (tab: TabKey) => {
        setActiveTab(tab);
        router.get(
            '/owner/analytics',
            { tab },
            { preserveState: true, replace: true },
        );
    };

    if (!props.kpis && !props.movements && !props.summary && !props.reports) {
        return (
            <OwnerPageShell
                title="Analitik"
                subtitle="Analitik performa bisnis"
            >
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    return (
        <OwnerPageShell title="Analitik" subtitle="Analitik performa bisnis">
            <div
                // Same 320px overflow as OwnerSegmentedTabs, but this tablist
                // is an inline copy that carries its own text size (text-sm,
                // not the shared 12px), so it is fixed here rather than folded
                // into the component.
                className="mb-5 inline-flex max-w-full overflow-x-auto rounded-lg bg-surface-muted p-1"
                role="tablist"
                aria-label="Tab navigasi analitik"
            >
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        // pointer-coarse:min-h-11 matches the shared
                        // OwnerSegmentedTabs — 36px on padding alone, under
                        // DESIGN.md line 83 on touch only (spec D6).
                        className={`relative shrink-0 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 sm:px-5 pointer-coarse:min-h-11 ${
                            activeTab === tab.key
                                ? 'bg-white text-text shadow-sm'
                                : 'text-text-muted hover:text-text'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'dashboard' && <DashboardTab {...props} />}
            {activeTab === 'audit' && <AuditTrailTab {...props} />}
            {activeTab === 'laporan' && <LaporanTab {...props} />}
            {activeTab === 'masalah' && <MasalahTab {...props} />}
        </OwnerPageShell>
    );
}

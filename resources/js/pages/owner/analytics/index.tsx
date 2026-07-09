import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { SkeletonPage } from '@/components/ui/skeleton';
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
    const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && TABS.some((t) => t.key === tab)) {
            setActiveTab(tab as TabKey);
        }
    }, []);

    const handleTabChange = (tab: TabKey) => {
        setActiveTab(tab);
        router.get('/owner/analytics', { tab }, { preserveState: true, replace: true });
    };

    if (!props.kpis && !props.movements && !props.summary && !props.reports) {
        return (
            <OwnerPageShell title="Analitik" subtitle="Analitik performa bisnis">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    return (
        <OwnerPageShell title="Analitik" subtitle="Analitik performa bisnis">
            <div className="mb-5 inline-flex rounded-lg bg-surface-muted p-1">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => handleTabChange(tab.key)}
                        className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
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

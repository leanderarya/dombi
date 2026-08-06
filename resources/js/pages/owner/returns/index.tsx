import { router } from '@inertiajs/react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerSegmentedTabs from '@/components/owner/owner-segmented-tabs';
import { SkeletonPage } from '@/components/ui/skeleton';
import { getInitialOwnerTab } from '../tab-state';
import PengembalianTab from './pengembalian-tab';
import PenukaranTab from './penukaran-tab';

const TABS = [
    { key: 'pengembalian', label: 'Pengembalian' },
    { key: 'penukaran', label: 'Penukaran' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function OwnerReturnsIndex(props: any) {
    const { tab: initialTab } = props;
    const [activeTab, setActiveTab] = useState<TabKey>(() =>
        getInitialOwnerTab(
            TABS.map((tab) => tab.key),
            'pengembalian',
            initialTab,
        ),
    );

    const handleTabChange = (t: TabKey) => {
        setActiveTab(t);
        router.get(
            '/owner/returns',
            { tab: t },
            { preserveState: true, replace: true },
        );
    };

    if (!props.returns && !props.exchanges) {
        return (
            <OwnerPageShell
                title="Return & Tukar"
                subtitle="Kelola pengembalian dan penukaran barang"
            >
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    return (
        <OwnerPageShell
            title="Return & Tukar"
            subtitle="Kelola pengembalian dan penukaran barang"
        >
            <OwnerSegmentedTabs
                tabs={TABS.map((t) => ({ key: t.key, label: t.label }))}
                activeTab={activeTab}
                onChange={(key) => handleTabChange(key as TabKey)}
                className="mb-5"
            />

            {activeTab === 'pengembalian' && (
                <PengembalianTab
                    returns={props.returns}
                    filters={props.filters}
                    dashboard={props.dashboard}
                    outlets={props.outlets}
                    reasons={props.reasons}
                />
            )}
            {activeTab === 'penukaran' && (
                <PenukaranTab
                    exchanges={props.exchanges}
                    filters={props.filters}
                    dashboard={props.exchangeDashboard}
                    outlets={props.outlets}
                />
            )}
        </OwnerPageShell>
    );
}

import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { SkeletonPage } from '@/components/ui/skeleton';
import PengembalianTab from './pengembalian-tab';
import PenukaranTab from './penukaran-tab';

const TABS = [
    { key: 'pengembalian', label: 'Pengembalian' },
    { key: 'penukaran', label: 'Penukaran' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function OwnerReturnsIndex(props: any) {
    const { tab: initialTab } = props;
    const [activeTab, setActiveTab] = useState<TabKey>((initialTab as TabKey) ?? 'pengembalian');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');

        if (t && TABS.some((tab) => tab.key === t)) {
            setActiveTab(t as TabKey);
        }
    }, []);

    const handleTabChange = (t: TabKey) => {
        setActiveTab(t);
        router.get('/owner/returns', { tab: t }, { preserveState: true, replace: true });
    };

    if (!props.returns && !props.exchanges) {
        return (
            <OwnerPageShell title="Return & Tukar" subtitle="Kelola pengembalian dan penukaran barang">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    return (
        <OwnerPageShell title="Return & Tukar" subtitle="Kelola pengembalian dan penukaran barang">
            {/* Segmented Control */}
            <div className="mb-5 inline-flex rounded-lg bg-surface-muted p-1" role="tablist" aria-label="Jenis Return">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        role="tab"
                        aria-selected={activeTab === t.key}
                        onClick={() => handleTabChange(t.key)}
                        className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                            activeTab === t.key ? 'bg-white text-text shadow-sm' : 'text-text-muted hover:text-text'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

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

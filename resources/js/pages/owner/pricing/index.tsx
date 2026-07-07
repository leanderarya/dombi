import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { OutletTab } from './outlet-tab';
import { PusatTab } from './pusat-tab';
import { RiwayatTab } from './riwayat-tab';
import type { OtherOutlet, OutletData, OutletPriceRow, PaginatedLogs, PusatKpis, PusatVariant } from './types';

/* ------------------------------------------------------------------ */
/*  Tab configuration                                                  */
/* ------------------------------------------------------------------ */

const TABS = [
    { key: 'pusat', label: 'Pusat' },
    { key: 'outlet', label: 'Outlet' },
    { key: 'riwayat', label: 'Riwayat' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface Props {
    tab?: string;
    pusatVariants?: PusatVariant[];
    pusatKpis?: PusatKpis;
    outlets?: OutletData[];
    selectedOutlet?: { id: number; name: string };
    outletPrices?: OutletPriceRow[];
    otherOutlets?: OtherOutlet[];
    logs?: PaginatedLogs;
    actionFilter?: string;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PricingIndex(props: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>((props.tab as TabKey) ?? 'pusat');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');

        if (tab && TABS.some((t) => t.key === tab)) {
            setActiveTab(tab as TabKey);
        }
    }, []);

    const handleTabChange = (tab: TabKey) => {
        setActiveTab(tab);
        const params: Record<string, string> = { tab };

        if (tab === 'outlet' && props.selectedOutlet) {
            params.outlet_id = String(props.selectedOutlet.id);
        }

        router.get('/owner/pricing', params, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell title="Harga" subtitle="Kelola harga jual produk">
            <div className="mb-5 inline-flex rounded-lg bg-surface-muted p-1">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                            activeTab === tab.key ? 'bg-white text-text' : 'text-text-muted hover:text-text'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'pusat' && <PusatTab variants={props.pusatVariants} kpis={props.pusatKpis} />}
            {activeTab === 'outlet' && (
                <OutletTab
                    outlets={props.outlets}
                    selectedOutlet={props.selectedOutlet}
                    outletPrices={props.outletPrices}
                    otherOutlets={props.otherOutlets}
                />
            )}
            {activeTab === 'riwayat' && <RiwayatTab logs={props.logs} actionFilter={props.actionFilter} />}
        </OwnerPageShell>
    );
}

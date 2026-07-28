import { router } from '@inertiajs/react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { getInitialOwnerTab } from '../tab-state';
import { OutletTab } from './outlet-tab';
import { PusatTab } from './pusat-tab';
import { RiwayatTab } from './riwayat-tab';
import type {
    OtherOutlet,
    OutletData,
    OutletPriceRow,
    PaginatedLogs,
    PusatKpis,
    PusatVariant,
} from './types';

const TABS = [
    { key: 'pusat', label: 'Pusat' },
    { key: 'outlet', label: 'Outlet' },
    { key: 'riwayat', label: 'Riwayat' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface Props {
    tab?: string;
    pusatVariants?: PusatVariant[]; // backward compat
    pusatProducts?: PusatVariant[];
    pusatKpis?: PusatKpis;
    outlets?: OutletData[];
    selectedOutlet?: { id: number; name: string };
    outletPrices?: OutletPriceRow[];
    otherOutlets?: OtherOutlet[];
    logs?: PaginatedLogs;
    actionFilter?: string;
}

export default function PricingIndex(props: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>(() =>
        getInitialOwnerTab(
            TABS.map((tab) => tab.key),
            'pusat',
            props.tab,
        ),
    );

    const handleTabChange = (tab: TabKey) => {
        setActiveTab(tab);
        const params: Record<string, string> = { tab };

        if (tab === 'outlet' && props.selectedOutlet) {
            params.outlet_id = String(props.selectedOutlet.id);
        }

        router.get('/owner/pricing', params, {
            preserveState: true,
            replace: true,
        });
    };

    return (
        <OwnerPageShell title="Harga" subtitle="Kelola harga jual produk">
            <div
                className="mb-5 inline-flex rounded-lg bg-surface-muted p-1"
                role="tablist"
                aria-label="Tab navigasi harga"
            >
                {TABS.map((tab) => (
                    <Button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        variant={activeTab === tab.key ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => handleTabChange(tab.key)}
                    >
                        {tab.label}
                    </Button>
                ))}
            </div>

            {activeTab === 'pusat' && (
                <PusatTab
                    variants={props.pusatVariants}
                    products={props.pusatProducts ?? props.pusatVariants}
                    kpis={props.pusatKpis}
                />
            )}
            {activeTab === 'outlet' && (
                <OutletTab
                    outlets={props.outlets}
                    selectedOutlet={props.selectedOutlet}
                    outletPrices={props.outletPrices}
                    otherOutlets={props.otherOutlets}
                />
            )}
            {activeTab === 'riwayat' && (
                <RiwayatTab
                    logs={props.logs}
                    actionFilter={props.actionFilter}
                    outlets={props.outlets}
                />
            )}
        </OwnerPageShell>
    );
}

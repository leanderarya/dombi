import { router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerSegmentedTabs from '@/components/owner/owner-segmented-tabs';
import { SkeletonPage } from '@/components/ui/skeleton';
import { getInitialOwnerTab } from '../tab-state';
import PembayaranTab from './pembayaran-tab';
import RefundTab from './refund-tab';
import RekeningTab from './rekening-tab';
import TagihanTab from './tagihan-tab';

const TABS = [
    {
        key: 'tagihan',
        label: 'Tagihan',
        description: 'Tagihan outlet per periode',
    },
    {
        key: 'pembayaran',
        label: 'Pembayaran',
        description: 'Verifikasi pembayaran masuk',
    },
    {
        key: 'rekening',
        label: 'Rekening',
        description: 'Rekening tujuan pembayaran',
    },
    {
        key: 'refund',
        label: 'Refund',
        description: 'Proses refund customer dan guest',
    },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function FinanceIndex(props: any) {
    const [requestedTab, setRequestedTab] = useState<TabKey | null>(null);
    const visitSequence = useRef(0);
    const pageTab = getInitialOwnerTab(
        TABS.map((tab) => tab.key),
        'tagihan',
        props.tab,
    );
    const activeTab = requestedTab ?? pageTab;

    const handleTabChange = (tab: TabKey) => {
        if (tab === activeTab) {
            return;
        }

        const visit = ++visitSequence.current;
        setRequestedTab(tab);
        router.get(
            '/owner/finance',
            { tab },
            {
                preserveState: true,
                replace: true,
                onFinish: () => {
                    if (visit === visitSequence.current) {
                        setRequestedTab(null);
                    }
                },
            },
        );
    };

    const hasActiveTabData =
        (activeTab === 'tagihan' && props.kpis && props.outlets) ||
        (activeTab === 'pembayaran' &&
            props.payments &&
            props.paymentKpis &&
            props.statusFilter !== undefined) ||
        (activeTab === 'rekening' && props.accounts !== undefined) ||
        (activeTab === 'refund' &&
            props.refunds &&
            props.refundCounts &&
            props.refundFilter !== undefined);

    if (requestedTab !== null || !hasActiveTabData) {
        return (
            <OwnerPageShell
                title="Keuangan"
                subtitle="Pantau kewajiban seluruh outlet"
            >
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    return (
        <OwnerPageShell
            title="Keuangan"
            subtitle="Pantau kewajiban seluruh outlet"
        >
            <OwnerSegmentedTabs
                tabs={TABS.map((t) => ({ key: t.key, label: t.label }))}
                activeTab={activeTab}
                onChange={(key) => handleTabChange(key as TabKey)}
                revealActiveTab
                className="mb-5"
            />
            <p
                id={`${TABS.find((t) => t.key === activeTab)?.key}-desc`}
                className="mb-4 text-xs text-text-muted"
            >
                {TABS.find((t) => t.key === activeTab)?.description}
            </p>

            <div
                role="tabpanel"
                aria-label={`Tab ${TABS.find((t) => t.key === activeTab)?.label}`}
            >
                {activeTab === 'tagihan' && <TagihanTab {...props} />}
                {activeTab === 'pembayaran' && <PembayaranTab {...props} />}
                {activeTab === 'rekening' && <RekeningTab {...props} />}
                {activeTab === 'refund' && <RefundTab {...props} />}
            </div>
        </OwnerPageShell>
    );
}

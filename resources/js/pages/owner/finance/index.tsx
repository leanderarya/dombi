import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { SkeletonPage } from '@/components/ui/skeleton';
import PembayaranTab from './pembayaran-tab';
import RekeningTab from './rekening-tab';
import TagihanTab from './tagihan-tab';

const TABS = [
    { key: 'tagihan', label: 'Tagihan', description: 'Tagihan outlet per periode' },
    { key: 'pembayaran', label: 'Pembayaran', description: 'Verifikasi pembayaran masuk' },
    { key: 'rekening', label: 'Rekening', description: 'Rekening tujuan pembayaran' },
];

export default function FinanceIndex(props: any) {
    const [activeTab, setActiveTab] = useState('tagihan');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');

        if (tab && TABS.some((t) => t.key === tab)) {
            setActiveTab(tab);
        }
    }, []);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        router.get('/owner/finance', { tab }, { preserveState: true, replace: true });
    };

    if (!props.kpis && !props.payments && !props.accounts) {
        return (
            <OwnerPageShell title="Keuangan" subtitle="Pantau kewajiban seluruh outlet">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    return (
        <OwnerPageShell title="Keuangan" subtitle="Pantau kewajiban seluruh outlet">
            <div className="mb-5 inline-flex rounded-lg bg-surface-muted p-1" role="tablist" aria-label="Navigasi tab keuangan">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        aria-describedby={`${tab.key}-desc`}
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
            <p id={`${TABS.find((t) => t.key === activeTab)?.key}-desc`} className="mb-4 text-xs text-text-muted">
                {TABS.find((t) => t.key === activeTab)?.description}
            </p>

            <div role="tabpanel" aria-label={`Tab ${TABS.find((t) => t.key === activeTab)?.label}`}>
                {activeTab === 'tagihan' && <TagihanTab {...props} />}
                {activeTab === 'pembayaran' && <PembayaranTab {...props} />}
                {activeTab === 'rekening' && <RekeningTab {...props} />}
            </div>
        </OwnerPageShell>
    );
}

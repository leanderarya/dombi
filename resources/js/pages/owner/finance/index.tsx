import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import PembayaranTab from './pembayaran-tab';
import RekeningTab from './rekening-tab';
import TagihanTab from './tagihan-tab';

const TABS = [
    { key: 'tagihan', label: 'Tagihan' },
    { key: 'pembayaran', label: 'Pembayaran' },
    { key: 'rekening', label: 'Rekening' },
];

export default function FinanceIndex(props: any) {
    const [activeTab, setActiveTab] = useState('tagihan');

    // Sync tab with URL on mount
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

    return (
        <OwnerPageShell title="Keuangan" subtitle="Pantau kewajiban seluruh outlet">
            {/* Segmented Control — primary tab navigation */}
            <div className="mb-5 inline-flex rounded-lg bg-surface-muted p-1">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => handleTabChange(tab.key)}
                        className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                            activeTab === tab.key
                                ? 'bg-white text-text'
                                : 'text-text-muted hover:text-text'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'tagihan' && <TagihanTab {...props} />}
            {activeTab === 'pembayaran' && <PembayaranTab {...props} />}
            {activeTab === 'rekening' && <RekeningTab {...props} />}
        </OwnerPageShell>
    );
}

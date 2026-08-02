import { useForm } from '@inertiajs/react';
import { Plus, UserRound } from 'lucide-react';
import { useState } from 'react';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import BottomSheet from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';

interface ActiveCourier {
    id: number;
    name: string;
    source: string;
    total_deliveries: number;
}

interface Nominee {
    id: number;
    nominee_name: string;
    nominee_phone: string;
    created_at: string;
}

type Tab = 'aktif' | 'menunggu' | 'ditolak';

interface MyCouriersProps {
    active: ActiveCourier[];
    pending: Nominee[];
    rejected: Nominee[];
}

const TABS: { key: Tab; label: string }[] = [
    { key: 'aktif', label: 'Aktif' },
    { key: 'menunggu', label: 'Menunggu' },
    { key: 'ditolak', label: 'Ditolak' },
];

export default function MyCouriers({
    active,
    pending,
    rejected,
}: MyCouriersProps) {
    const [tab, setTab] = useState<Tab>('aktif');
    const [showNominate, setShowNominate] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        phone: '',
    });

    const countFor = (key: Tab): number =>
        key === 'aktif'
            ? active.length
            : key === 'menunggu'
              ? pending.length
              : rejected.length;

    const handleNominate = () => {
        post('/outlet/my-couriers/nominate', {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setShowNominate(false);
            },
        });
    };

    return (
        <OutletLayout
            title="Kurir Saya"
            subtitle="Kelola kurir outlet dan kandidat"
            headerRight={
                <Button
                    size="md"
                    variant="primary"
                    onClick={() => setShowNominate(true)}
                >
                    <Plus className="h-4 w-4" />
                    Calonkan
                </Button>
            }
        >
            <OutletPageShell>
                <FilterChips
                    options={TABS.map((t) => ({
                        key: t.key,
                        label: `${t.label} (${countFor(t.key)})`,
                    }))}
                    active={tab}
                    onChange={(key) => setTab(key as Tab)}
                />

                {tab === 'aktif' && (
                    <SectionCard label="Kurir Aktif">
                        {active.length === 0 ? (
                            <EmptyState
                                icon={<UserRound className="h-8 w-8" />}
                                title="Tidak ada kurir aktif"
                                description="Calonkan kurir baru atau hubungi Owner untuk plotting kurir pusat."
                            />
                        ) : (
                            <div className="space-y-3">
                                {active.map((c) => (
                                    <div
                                        key={c.id}
                                        className="flex items-center justify-between border-b border-border pb-3 last:border-b-0 last:pb-0"
                                    >
                                        <div>
                                            <div className="font-semibold text-text">
                                                {c.name}
                                            </div>
                                            <div className="mt-0.5 text-sm text-text-muted">
                                                {c.total_deliveries} delivery
                                            </div>
                                        </div>
                                        <StatusBadge
                                            variant={
                                                c.source === 'pusat'
                                                    ? 'info'
                                                    : 'success'
                                            }
                                        >
                                            {c.source === 'pusat'
                                                ? 'Kurir Pusat'
                                                : 'Kurir Outlet'}
                                        </StatusBadge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                )}

                {tab === 'menunggu' && (
                    <SectionCard label="Menunggu Persetujuan">
                        {pending.length === 0 ? (
                            <EmptyState
                                icon={<UserRound className="h-8 w-8" />}
                                title="Tidak ada kandidat menunggu"
                                description="Kandidat yang diajukan akan muncul di sini sampai disetujui Owner."
                            />
                        ) : (
                            <div className="space-y-3">
                                {pending.map((c) => (
                                    <div
                                        key={c.id}
                                        className="flex items-center justify-between border-b border-border pb-3 last:border-b-0 last:pb-0"
                                    >
                                        <div>
                                            <div className="font-semibold text-text">
                                                {c.nominee_name}
                                            </div>
                                            <div className="mt-0.5 text-sm text-text-muted">
                                                {c.nominee_phone}
                                            </div>
                                        </div>
                                        <StatusBadge variant="warning">
                                            Menunggu
                                        </StatusBadge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                )}

                {tab === 'ditolak' && (
                    <SectionCard label="Ditolak">
                        {rejected.length === 0 ? (
                            <EmptyState
                                icon={<UserRound className="h-8 w-8" />}
                                title="Tidak ada kandidat ditolak"
                            />
                        ) : (
                            <div className="space-y-3">
                                {rejected.map((c) => (
                                    <div
                                        key={c.id}
                                        className="flex items-center justify-between border-b border-border pb-3 last:border-b-0 last:pb-0"
                                    >
                                        <div>
                                            <div className="font-semibold text-text">
                                                {c.nominee_name}
                                            </div>
                                            <div className="mt-0.5 text-sm text-text-muted">
                                                {c.nominee_phone}
                                            </div>
                                        </div>
                                        <StatusBadge variant="danger">
                                            Ditolak
                                        </StatusBadge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                )}
            </OutletPageShell>

            <BottomSheet
                open={showNominate}
                onClose={() => setShowNominate(false)}
                title="Calonkan Kurir Baru"
            >
                <div className="space-y-4">
                    <p className="text-xs text-text-muted">
                        Owner akan menyetujui sebelum kurir aktif.
                    </p>
                    <label className="block space-y-1">
                        <span className="text-sm font-medium text-text">
                            Nama
                        </span>
                        <input
                            type="text"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="Nama kurir"
                            className="w-full rounded-[--radius-control] border border-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                        {errors.name && (
                            <span className="text-xs text-red-600">
                                {errors.name}
                            </span>
                        )}
                    </label>
                    <label className="block space-y-1">
                        <span className="text-sm font-medium text-text">
                            No. HP
                        </span>
                        <input
                            type="tel"
                            value={data.phone}
                            onChange={(e) => setData('phone', e.target.value)}
                            placeholder="08xxxxxxxxxx"
                            className="w-full rounded-[--radius-control] border border-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                        {errors.phone && (
                            <span className="text-xs text-red-600">
                                {errors.phone}
                            </span>
                        )}
                    </label>
                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            disabled={processing}
                            onClick={() => {
                                reset();
                                setShowNominate(false);
                            }}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="primary"
                            className="flex-1"
                            disabled={!data.name || !data.phone || processing}
                            onClick={handleNominate}
                        >
                            {processing ? 'Mengirim...' : 'Ajukan'}
                        </Button>
                    </div>
                </div>
            </BottomSheet>
        </OutletLayout>
    );
}

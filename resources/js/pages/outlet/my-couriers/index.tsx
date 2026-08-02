import { useForm } from '@inertiajs/react';
import { MessageCircle, Plus, UserRound } from 'lucide-react';
import { useState } from 'react';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import ImageUploadField from '@/components/owner/image-upload-field';
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
    nominee_vehicle_plate: string;
    nominee_face_photo: string | null;
    nominee_vehicle_photo: string | null;
    rejection_reason: string | null;
    created_at: string | null;
    approved_at: string | null;
    invite_url: string | null;
}

type Tab = 'aktif' | 'submitted' | 'awaiting' | 'rejected';

interface MyCouriersProps {
    active: ActiveCourier[];
    submitted: Nominee[];
    awaiting: Nominee[];
    rejected: Nominee[];
}

const TABS: { key: Tab; label: string }[] = [
    { key: 'aktif', label: 'Aktif' },
    { key: 'submitted', label: 'Menunggu Review' },
    { key: 'awaiting', label: 'Diterima' },
    { key: 'rejected', label: 'Ditolak' },
];

const photoUrl = (path: string | null) => (path ? `/storage/${path}` : null);

export default function MyCouriers({
    active,
    submitted,
    awaiting,
    rejected,
}: MyCouriersProps) {
    const [tab, setTab] = useState<Tab>('aktif');
    const [showNominate, setShowNominate] = useState(false);
    const [resubmitting, setResubmitting] = useState<Nominee | null>(null);
    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        phone: '',
        vehicle_plate: '',
        face_photo: null as File | null,
        vehicle_photo: null as File | null,
    });

    const countFor = (key: Tab): number =>
        key === 'aktif'
            ? active.length
            : key === 'submitted'
              ? submitted.length
              : key === 'awaiting'
                ? awaiting.length
                : rejected.length;

    const openNominate = () => {
        reset();
        setResubmitting(null);
        setShowNominate(true);
    };

    const openResubmit = (c: Nominee) => {
        reset();
        setResubmitting(c);
        setData({
            name: c.nominee_name,
            phone: c.nominee_phone,
            vehicle_plate: c.nominee_vehicle_plate,
            face_photo: null,
            vehicle_photo: null,
        });
        setShowNominate(true);
    };

    const handleSubmit = () => {
        const submit = resubmitting
            ? () =>
                  put(`/outlet/my-couriers/${resubmitting.id}/resubmit`, {
                      preserveScroll: true,
                      onSuccess: () => {
                          reset();
                          setResubmitting(null);
                          setShowNominate(false);
                      },
                  })
            : () =>
                  post('/outlet/my-couriers/nominate', {
                      preserveScroll: true,
                      onSuccess: () => {
                          reset();
                          setShowNominate(false);
                      },
                  });
        submit();
    };

    const waLink = (phone: string, url: string) =>
        `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(
            `Kandidat kurir Anda telah disetujui Owner. Silakan aktivasi akun melalui link: ${url}`,
        )}`;

    const renderNomineeCard = (
        c: Nominee,
        badge: React.ReactNode,
        extra?: React.ReactNode,
    ) => (
        <div
            key={c.id}
            className="border-b border-border pb-3 last:border-b-0 last:pb-0"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="font-semibold text-text">
                        {c.nominee_name}
                    </div>
                    <div className="mt-0.5 text-sm text-text-muted tabular-nums">
                        {c.nominee_phone} · {c.nominee_vehicle_plate}
                    </div>
                    {c.rejection_reason && (
                        <div className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                            Alasan: {c.rejection_reason}
                        </div>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">{badge}</div>
            </div>
            <div className="mt-2 flex gap-2">
                {c.nominee_face_photo && (
                    <img
                        src={photoUrl(c.nominee_face_photo) ?? ''}
                        alt="Wajah"
                        className="h-12 w-12 rounded object-cover"
                    />
                )}
                {c.nominee_vehicle_photo && (
                    <img
                        src={photoUrl(c.nominee_vehicle_photo) ?? ''}
                        alt="Kendaraan"
                        className="h-12 w-12 rounded object-cover"
                    />
                )}
            </div>
            {extra}
        </div>
    );

    return (
        <OutletLayout
            title="Kurir Saya"
            subtitle="Kelola kurir outlet dan kandidat"
            headerRight={
                <Button size="md" variant="primary" onClick={openNominate}>
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

                {tab === 'submitted' && (
                    <SectionCard label="Menunggu Review Owner">
                        {submitted.length === 0 ? (
                            <EmptyState
                                icon={<UserRound className="h-8 w-8" />}
                                title="Tidak ada kandidat menunggu"
                                description="Kandidat yang diajukan akan muncul di sini sampai direview Owner."
                            />
                        ) : (
                            <div className="space-y-3">
                                {submitted.map((c) =>
                                    renderNomineeCard(
                                        c,
                                        <StatusBadge variant="warning">
                                            Menunggu Review
                                        </StatusBadge>,
                                    ),
                                )}
                            </div>
                        )}
                    </SectionCard>
                )}

                {tab === 'awaiting' && (
                    <SectionCard label="Diterima — Menunggu Aktivasi">
                        {awaiting.length === 0 ? (
                            <EmptyState
                                icon={<UserRound className="h-8 w-8" />}
                                title="Tidak ada kandidat diterima"
                                description="Kandidat yang disetujui Owner akan muncul di sini."
                            />
                        ) : (
                            <div className="space-y-3">
                                {awaiting.map((c) =>
                                    renderNomineeCard(
                                        c,
                                        <StatusBadge variant="info">
                                            Diterima
                                        </StatusBadge>,
                                        <div className="mt-3">
                                            {c.invite_url ? (
                                                <a
                                                    href={waLink(
                                                        c.nominee_phone,
                                                        c.invite_url,
                                                    )}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 rounded-[--radius-control] bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                                                >
                                                    <MessageCircle className="h-3.5 w-3.5" />
                                                    Kirim Link Aktivasi via
                                                    WhatsApp
                                                </a>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        post(
                                                            `/outlet/my-couriers/${c.id}/invitation/regenerate`,
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        )
                                                    }
                                                >
                                                    Buat Ulang & Kirim WhatsApp
                                                </Button>
                                            )}
                                        </div>,
                                    ),
                                )}
                            </div>
                        )}
                    </SectionCard>
                )}

                {tab === 'rejected' && (
                    <SectionCard label="Ditolak">
                        {rejected.length === 0 ? (
                            <EmptyState
                                icon={<UserRound className="h-8 w-8" />}
                                title="Tidak ada kandidat ditolak"
                            />
                        ) : (
                            <div className="space-y-3">
                                {rejected.map((c) =>
                                    renderNomineeCard(
                                        c,
                                        <StatusBadge variant="danger">
                                            Ditolak
                                        </StatusBadge>,
                                        <div className="mt-3">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openResubmit(c)}
                                            >
                                                Perbaiki & Ajukan Ulang
                                            </Button>
                                        </div>,
                                    ),
                                )}
                            </div>
                        )}
                    </SectionCard>
                )}
            </OutletPageShell>

            <BottomSheet
                open={showNominate}
                onClose={() => setShowNominate(false)}
                title={
                    resubmitting
                        ? 'Perbaiki & Ajukan Ulang'
                        : 'Calonkan Kurir Baru'
                }
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
                    <label className="block space-y-1">
                        <span className="text-sm font-medium text-text">
                            Plat Nomor Kendaraan
                        </span>
                        <input
                            type="text"
                            value={data.vehicle_plate}
                            onChange={(e) =>
                                setData('vehicle_plate', e.target.value)
                            }
                            placeholder="AB 1234 CD"
                            className="w-full rounded-[--radius-control] border border-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                        {errors.vehicle_plate && (
                            <span className="text-xs text-red-600">
                                {errors.vehicle_plate}
                            </span>
                        )}
                    </label>
                    <div>
                        <ImageUploadField
                            value={
                                data.face_photo ??
                                resubmitting?.nominee_face_photo ??
                                ''
                            }
                            onChange={(f) => setData('face_photo', f)}
                            label="Foto Wajah"
                            info="wajib, maks 5 MB"
                        />
                        {errors.face_photo && (
                            <span className="text-xs text-red-600">
                                {errors.face_photo}
                            </span>
                        )}
                    </div>
                    <div>
                        <ImageUploadField
                            value={
                                data.vehicle_photo ??
                                resubmitting?.nominee_vehicle_photo ??
                                ''
                            }
                            onChange={(f) => setData('vehicle_photo', f)}
                            label="Foto Kendaraan"
                            info="wajib, maks 5 MB"
                        />
                        {errors.vehicle_photo && (
                            <span className="text-xs text-red-600">
                                {errors.vehicle_photo}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            disabled={processing}
                            onClick={() => {
                                reset();
                                setResubmitting(null);
                                setShowNominate(false);
                            }}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="primary"
                            className="flex-1"
                            disabled={
                                !data.name ||
                                !data.phone ||
                                !data.vehicle_plate ||
                                processing
                            }
                            onClick={handleSubmit}
                        >
                            {processing
                                ? 'Mengirim...'
                                : resubmitting
                                  ? 'Ajukan Ulang'
                                  : 'Ajukan'}
                        </Button>
                    </div>
                </div>
            </BottomSheet>
        </OutletLayout>
    );
}

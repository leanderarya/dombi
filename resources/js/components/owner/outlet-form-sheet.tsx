import { Link } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PhoneInput from '@/components/ui/phone-input';
import { Select } from '@/components/ui/select';
import { reverseGeocode } from '@/lib/geocoding';
import { cn } from '@/lib/utils';

const OutletLocationMap = lazy(() => import('./outlet-location-map'));

type ExistingOutlet = {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    address?: string;
};

type Props = {
    mode: 'create' | 'edit';
    form: any;
    submit: (event: FormEvent<HTMLFormElement>) => void;
    outlet?: any;
    existingOutlets?: ExistingOutlet[];
};

export default function OutletFormSheet({ mode, form, submit, outlet, existingOutlets = [] }: Props) {
    const [geocodingState, setGeocodingState] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
    const [notesExpanded, setNotesExpanded] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const location = useMemo(() => {
        const lat = Number(form.data.latitude);
        const lng = Number(form.data.longitude);

        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }, [form.data.latitude, form.data.longitude]);

    const setLocation = (point: { lat: number; lng: number }) => {
        form.setData({
            ...form.data,
            latitude: point.lat.toFixed(7),
            longitude: point.lng.toFixed(7),
        });
    };

    // Reverse geocode when marker moves — updates administrative address fields only
    useEffect(() => {
        if (!location) {
return;
}

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const timeout = window.setTimeout(async () => {
            setGeocodingState('loading');

            try {
                const result = await reverseGeocode(location.lat, location.lng, controller.signal);
                form.setData({
                    ...form.data,
                    kelurahan: result.kelurahan || '',
                    kecamatan: result.kecamatan || '',
                    city: result.city || '',
                    province: result.province || '',
                    postal_code: result.postal_code || '',
                });
                setGeocodingState('success');
            } catch (error) {
                if (!controller.signal.aborted) {
setGeocodingState('failed');
}
            }
        }, 650);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [location?.lat, location?.lng]);

    const isEdit = mode === 'edit';
    const title = isEdit ? `Edit ${outlet?.name ?? 'Outlet'}` : 'Tambah Outlet';
    const hasLocation = !!location;

    return (
        <div className="w-full max-w-5xl">
            {/* Header */}
            <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
                    <p className="mt-1 text-xs text-slate-500">
                        {isEdit ? 'Perbarui informasi outlet.' : 'Pilih lokasi pada peta, lalu isi informasi outlet.'}
                    </p>
                </div>
            </div>

            <form onSubmit={submit}>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                    {/* Left Column: Form Fields */}
                    <div className="space-y-4 lg:col-span-3">
                        {/* Section 1: Informasi Outlet */}
                        <Section title="Informasi Outlet" subtitle="Identitas singkat untuk operasional cabang.">
                            <Field label="Nama Outlet" value={form.data.name} onChange={(value) => form.setData('name', value)} error={form.errors.name} required />
                            <PhoneInput label="Nomor Telepon" value={form.data.phone ?? ''} onChange={(value) => form.setData('phone', value)} error={form.errors.phone} />
                        </Section>

                        {/* Section 2: Lokasi Terpilih (readonly from map) */}
                        <Section title="Lokasi Terpilih" subtitle="Data wilayah terdeteksi otomatis dari peta. Geser marker untuk memperbarui.">
                            {hasLocation ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <InfoBadge label="Kelurahan" value={form.data.kelurahan} loading={geocodingState === 'loading'} />
                                        <InfoBadge label="Kecamatan" value={form.data.kecamatan} loading={geocodingState === 'loading'} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <InfoBadge label="Kota/Kabupaten" value={form.data.city} loading={geocodingState === 'loading'} />
                                        <InfoBadge label="Provinsi" value={form.data.province} loading={geocodingState === 'loading'} />
                                    </div>
                                    <InfoBadge label="Kode Pos" value={form.data.postal_code} loading={geocodingState === 'loading'} />
                                    {(form.errors.kelurahan || form.errors.kecamatan) && (
                                        <p className="text-xs font-semibold text-red-600">Data lokasi belum terdeteksi. Geser marker pada peta.</p>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                    <div className="text-sm text-slate-500">Pilih lokasi pada peta terlebih dahulu.</div>
                                    <div className="mt-1 text-xs text-slate-400">Klik pada peta atau cari alamat di kolom pencarian.</div>
                                </div>
                            )}
                        </Section>

                        {/* Section 3: Detail Alamat (optional, manual) */}
                        <Section title="Detail Alamat" subtitle="Informasi tambahan untuk memudahkan kurir menemukan lokasi.">
                            <TextArea label="Detail" value={form.data.address ?? ''} onChange={(value) => form.setData('address', value)} error={form.errors.address} placeholder="Ruko nomor 12 sebelah Indomaret..." />
                        </Section>

                        {/* Section 4: Catatan Internal (collapsible) */}
                        <div className="rounded-xl border border-slate-200 bg-white">
                            <button
                                type="button"
                                onClick={() => setNotesExpanded(!notesExpanded)}
                                aria-expanded={notesExpanded}
                                className="flex w-full items-center justify-between px-4 py-3 text-left"
                            >
                                <div>
                                    <div className="text-base font-semibold text-slate-900">Catatan Internal</div>
                                    <div className="text-xs text-slate-500">Opsional. Catatan akses, jam ramai, atau patokan lokasi.</div>
                                </div>
                                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${notesExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {notesExpanded && (
                                <div className="border-t border-slate-100 px-4 py-3">
                                    <TextArea label="Catatan" value={form.data.operational_notes ?? ''} onChange={(value) => form.setData('operational_notes', value)} error={form.errors.operational_notes} placeholder="Catatan akses, jam ramai, atau patokan lokasi" />
                                    {isEdit && (
                                        <div className="mt-3 space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field label="Radius Pengiriman (km)" value={form.data.delivery_radius_km ?? ''} onChange={(value) => form.setData('delivery_radius_km', value)} error={form.errors.delivery_radius_km} type="number" />
                                                <Field label="Estimasi Persiapan (menit)" value={form.data.prep_estimate_minutes ?? ''} onChange={(value) => form.setData('prep_estimate_minutes', value)} error={form.errors.prep_estimate_minutes} type="number" />
                                            </div>
                                            <Select
                                                label="Status"
                                                value={form.data.status}
                                                onChange={(event) => form.setData('status', event.target.value)}
                                                options={[
                                                    { value: 'active', label: 'Aktif' },
                                                    { value: 'inactive', label: 'Nonaktif' },
                                                ]}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Action Bar */}
                        <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white px-4 py-3 lg:-mx-6 lg:px-6">
                            <div className="flex items-center gap-3">
                                <Link
                                    href="/owner/outlets"
                                    className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'flex-1')}
                                >
                                    Batal
                                </Link>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    disabled={form.processing}
                                    className="flex-[2]"
                                >
                                    {form.processing ? 'Menyimpan...' : 'Simpan Outlet'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Map */}
                    <div className="lg:col-span-2">
                        <Section title="Lokasi Outlet" subtitle="Cari alamat atau klik pada peta untuk menentukan lokasi outlet.">
                            <Suspense fallback={<div className="flex h-[300px] items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500 lg:h-[400px]">Loading peta...</div>}>
                                <OutletLocationMap value={location} onChange={setLocation} existingOutlets={existingOutlets} />
                            </Suspense>
                            {(form.errors.latitude || form.errors.longitude) && <p className="text-xs font-semibold text-red-600">Pilih lokasi outlet dari peta terlebih dahulu.</p>}
                        </Section>
                    </div>
                </div>
            </form>
        </div>
    );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>}
            <div className="mt-4 space-y-3">{children}</div>
        </section>
    );
}

function InfoBadge({ label, value, loading }: { label: string; value?: string; loading?: boolean }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className={`mt-0.5 text-sm font-medium ${loading ? 'text-slate-400' : 'text-slate-900'}`}>
                {loading ? 'Mendeteksi...' : (value || '-')}
            </div>
        </div>
    );
}

function Field({ label, value, onChange, error, type = 'text', required }: { label: string; value: any; onChange: (value: string) => void; error?: string; type?: string; required?: boolean }) {
    return (
        <Input
            label={`${label}${required ? ' *' : ''}`}
            type={type}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            error={error}
            required={required}
        />
    );
}

function TextArea({ label, value, onChange, error, required, placeholder }: { label: string; value: any; onChange: (value: string) => void; error?: string; required?: boolean; placeholder?: string }) {
    return (
        <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label} {required && <span className="text-red-500">*</span>}</span>
            <textarea value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={2} className="mt-1.5 min-h-16 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" required={required} />
            {error && <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span>}
        </label>
    );
}

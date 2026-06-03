import { Link } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import OutletAddressPreview from './outlet-address-preview';
import { reverseGeocode } from '@/lib/geocoding';

const OutletLocationMap = lazy(() => import('./outlet-location-map'));

type Props = {
    mode: 'create' | 'edit';
    form: any;
    submit: (event: FormEvent<HTMLFormElement>) => void;
    outlet?: any;
};

export default function OutletFormSheet({ mode, form, submit, outlet }: Props) {
    const [geocodingState, setGeocodingState] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
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

    useEffect(() => {
        if (!location) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const timeout = window.setTimeout(async () => {
            setGeocodingState('loading');
            try {
                const result = await reverseGeocode(location.lat, location.lng, controller.signal);
                form.setData({
                    ...form.data,
                    kelurahan: result.kelurahan || form.data.kelurahan,
                    kecamatan: result.kecamatan || form.data.kecamatan,
                    city: result.city || form.data.city,
                    province: result.province || form.data.province,
                    postal_code: result.postal_code || form.data.postal_code,
                    address: result.formatted_address || form.data.address,
                });
                setGeocodingState('success');
            } catch (error) {
                if (!controller.signal.aborted) setGeocodingState('failed');
            }
        }, 650);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [location?.lat, location?.lng]);

    const title = mode === 'create' ? 'Tambah Outlet' : `Edit ${outlet?.name ?? 'Outlet'}`;

    return (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/40 lg:static lg:block lg:bg-transparent">
            <div className="flex h-[calc(100dvh-0.5rem)] w-full max-w-3xl flex-col rounded-t-xl border border-slate-300 bg-[#F8FAFC] lg:h-auto lg:rounded-xl">
                <div className="sticky top-0 z-20 rounded-t-xl border-b border-slate-200 bg-white px-4 pt-3 pb-4">
                    <div className="mx-auto h-1 w-12 rounded-full bg-slate-300 lg:hidden" />
                    <div className="mt-4 flex items-start justify-between gap-3 lg:mt-0">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Operational Outlet Setup</p>
                            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Pilih lokasi peta, cek alamat otomatis, lalu simpan outlet.</p>
                        </div>
                        <Link href="/owner/outlets" className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors duration-150 active:bg-[#F8FAFC]" aria-label="Close outlet setup">
                            <CloseIcon />
                        </Link>
                    </div>
                </div>

                <form onSubmit={submit} className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-4">
                    <div className="space-y-4">
                        <Section title="Outlet Info" subtitle="Identitas singkat untuk operasional cabang.">
                            <Field label="Outlet name" value={form.data.name} onChange={(value) => form.setData('name', value)} error={form.errors.name} required />
                            <Field label="Phone" value={form.data.phone ?? ''} onChange={(value) => form.setData('phone', value)} error={form.errors.phone} type="tel" />
                            <TextArea label="Operational notes" value={form.data.operational_notes ?? ''} onChange={(value) => form.setData('operational_notes', value)} error={form.errors.operational_notes} placeholder="Catatan akses, jam ramai, atau patokan lokasi" />
                        </Section>

                        <Section title="Map Location" subtitle="Tap pada peta atau drag marker untuk menentukan titik outlet.">
                            <Suspense fallback={<div className="flex h-[280px] items-center justify-center rounded-xl border border-slate-300 bg-[#F8FAFC] text-xs font-semibold text-slate-500">Loading operational map...</div>}>
                                <OutletLocationMap value={location} onChange={setLocation} />
                            </Suspense>
                            {(form.errors.latitude || form.errors.longitude) && <p className="text-xs font-semibold text-red-600">Pilih lokasi outlet dari peta terlebih dahulu.</p>}
                        </Section>

                        <OutletAddressPreview data={form.data} geocodingState={geocodingState} />

                        <Section title="Auto Detected Address" subtitle="Data wilayah boleh dikoreksi jika hasil deteksi kurang tepat.">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Kelurahan" value={form.data.kelurahan} onChange={(value) => form.setData('kelurahan', value)} error={form.errors.kelurahan} required />
                                <Field label="Kecamatan" value={form.data.kecamatan} onChange={(value) => form.setData('kecamatan', value)} error={form.errors.kecamatan} required />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Kota/Kabupaten" value={form.data.city ?? ''} onChange={(value) => form.setData('city', value)} error={form.errors.city} />
                                <Field label="Provinsi" value={form.data.province ?? ''} onChange={(value) => form.setData('province', value)} error={form.errors.province} />
                            </div>
                            <Field label="Postal code" value={form.data.postal_code ?? ''} onChange={(value) => form.setData('postal_code', value)} error={form.errors.postal_code} />
                            <TextArea label="Street detail / building" value={form.data.address} onChange={(value) => form.setData('address', value)} error={form.errors.address} required />
                        </Section>

                        <Section title="Operational Settings" subtitle="Pengaturan ringan untuk kesiapan cabang.">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Coverage radius (km)" value={form.data.delivery_radius_km ?? ''} onChange={(value) => form.setData('delivery_radius_km', value)} error={form.errors.delivery_radius_km} type="number" />
                                <Field label="Prep estimate (min)" value={form.data.prep_estimate_minutes ?? ''} onChange={(value) => form.setData('prep_estimate_minutes', value)} error={form.errors.prep_estimate_minutes} type="number" />
                            </div>
                            <label className="block">
                                <span className="text-xs font-semibold text-slate-700">Status</span>
                                <select value={form.data.status} onChange={(event) => form.setData('status', event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </label>
                        </Section>
                    </div>
                </form>

                <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:rounded-b-xl">
                    <button
                        type="button"
                        onClick={() => {
                            const formElement = document.querySelector<HTMLFormElement>('form');
                            formElement?.requestSubmit();
                        }}
                        disabled={form.processing}
                        className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white transition-colors duration-150 active:bg-emerald-600 disabled:bg-slate-300"
                    >
                        {form.processing ? 'Menyimpan...' : 'Simpan Outlet'}
                    </button>
                </div>
            </div>
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

function Field({ label, value, onChange, error, type = 'text', required }: { label: string; value: any; onChange: (value: string) => void; error?: string; type?: string; required?: boolean }) {
    return (
        <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label} {required && <span className="text-red-500">*</span>}</span>
            <input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" required={required} />
            {error && <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span>}
        </label>
    );
}

function TextArea({ label, value, onChange, error, required, placeholder }: { label: string; value: any; onChange: (value: string) => void; error?: string; required?: boolean; placeholder?: string }) {
    return (
        <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label} {required && <span className="text-red-500">*</span>}</span>
            <textarea value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" required={required} />
            {error && <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span>}
        </label>
    );
}

function CloseIcon() {
    return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}

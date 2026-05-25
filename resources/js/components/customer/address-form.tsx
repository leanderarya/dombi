import { Link } from '@inertiajs/react';
import { lazy, Suspense } from 'react';
import CurrentLocationButton from './current-location-button';

const LeafletPicker = lazy(() => import('./leaflet-picker'));

interface FormData {
    label: string;
    recipient_name: string;
    phone: string;
    address: string;
    kelurahan: string;
    kecamatan: string;
    latitude: string;
    longitude: string;
    is_default: boolean;
}

interface Props {
    data: FormData;
    errors: Partial<Record<keyof FormData, string>>;
    processing: boolean;
    setData: (key: keyof FormData, value: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    submitLabel?: string;
}

export default function AddressForm({ data, errors, processing, setData, onSubmit, submitLabel = 'Simpan Alamat' }: Props) {
    function handleLocationChange(lat: number, lng: number) {
        setData('latitude', String(lat));
        setData('longitude', String(lng));
    }

    return (
        <form onSubmit={onSubmit} className="space-y-5">
            {/* Map */}
            <section>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pilih Lokasi di Peta</label>
                <div className="mt-2">
                    <Suspense fallback={<div className="flex h-48 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-slate-400">Memuat peta...</div>}>
                        <LeafletPicker
                            latitude={data.latitude}
                            longitude={data.longitude}
                            onChange={handleLocationChange}
                        />
                    </Suspense>
                </div>
                <div className="mt-2">
                    <CurrentLocationButton onLocation={handleLocationChange} />
                </div>
                {(errors.latitude || errors.longitude) && (
                    <p className="mt-1.5 text-xs text-red-600">{errors.latitude || errors.longitude}</p>
                )}
                {data.latitude && data.longitude && (
                    <p className="mt-1.5 text-[11px] tabular-nums text-slate-400">
                        {Number(data.latitude).toFixed(6)}, {Number(data.longitude).toFixed(6)}
                    </p>
                )}
            </section>

            {/* Label */}
            <Field label="Label Alamat" placeholder="Rumah, Kantor, dll" value={data.label} error={errors.label} onChange={(v) => setData('label', v)} />

            {/* Recipient */}
            <Field label="Nama Penerima" placeholder="Nama lengkap penerima" value={data.recipient_name} error={errors.recipient_name} onChange={(v) => setData('recipient_name', v)} required />

            {/* Phone */}
            <Field label="Nomor Telepon" placeholder="08xxxxxxxxxx" value={data.phone} error={errors.phone} onChange={(v) => setData('phone', v)} type="tel" required />

            {/* Address */}
            <div>
                <label className="text-xs font-semibold text-slate-700">Alamat Lengkap <span className="text-red-500">*</span></label>
                <textarea
                    value={data.address}
                    onChange={(e) => setData('address', e.target.value)}
                    className="mt-1.5 min-h-20 w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                    placeholder="Jalan, nomor, RT/RW, detail"
                    required
                />
                {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address}</p>}
            </div>

            {/* Kelurahan / Kecamatan */}
            <div className="grid grid-cols-2 gap-3">
                <Field label="Kelurahan" placeholder="Kelurahan" value={data.kelurahan} error={errors.kelurahan} onChange={(v) => setData('kelurahan', v)} />
                <Field label="Kecamatan" placeholder="Kecamatan" value={data.kecamatan} error={errors.kecamatan} onChange={(v) => setData('kecamatan', v)} />
            </div>

            {/* Default toggle */}
            <label className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3">
                <input
                    type="checkbox"
                    checked={data.is_default}
                    onChange={(e) => setData('is_default', e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">Jadikan alamat default</span>
            </label>

            {/* Submit */}
            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={processing}
                    className="flex min-h-12 flex-1 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white transition-transform active:scale-[0.97] active:bg-emerald-800 disabled:bg-zinc-300"
                >
                    {processing ? 'Menyimpan...' : submitLabel}
                </button>
                <Link
                    href="/customer/addresses"
                    className="flex min-h-12 items-center justify-center rounded-lg border border-zinc-200 px-5 text-sm font-semibold text-slate-600 active:bg-zinc-50"
                >
                    Batal
                </Link>
            </div>
        </form>
    );
}

function Field({ label, value, error, onChange, placeholder, type = 'text', required }: {
    label: string; value: string; error?: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
    return (
        <div>
            <label className="text-xs font-semibold text-slate-700">{label} {required && <span className="text-red-500">*</span>}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                placeholder={placeholder}
                required={required}
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}

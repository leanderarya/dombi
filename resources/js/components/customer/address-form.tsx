import { Link } from '@inertiajs/react';
import { MapPin } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import PhoneInput from '@/components/ui/phone-input';
import CurrentLocationButton from './current-location-button';

const LeafletPicker = lazy(() => import('./leaflet-picker'));

interface FormData {
    label: string;
    recipient_name: string;
    phone: string;
    address: string;
    address_detail: string;
    kelurahan: string;
    kecamatan: string;
    city: string;
    province: string;
    postal_code: string;
    latitude: string;
    longitude: string;
    landmark: string;
    delivery_notes: string;
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

export default function AddressForm({
    data,
    errors,
    processing,
    setData,
    onSubmit,
    submitLabel = 'Simpan Alamat',
}: Props) {
    function handleLocationChange(lat: number, lng: number) {
        setData('latitude', String(lat));
        setData('longitude', String(lng));
    }

    return (
        <form onSubmit={onSubmit} className="space-y-5">
            {/* Map */}
            <section>
                <label className="text-[11px] font-bold tracking-wider text-text-subtle uppercase">
                    Pilih Lokasi di Peta
                </label>
                <div className="mt-2">
                    <Suspense
                        fallback={
                            <div className="flex h-48 items-center justify-center rounded-chip border border-border bg-surface-muted text-xs text-text-subtle">
                                Memuat peta...
                            </div>
                        }
                    >
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
                    <p className="mt-1.5 text-xs text-danger">
                        {errors.latitude || errors.longitude}
                    </p>
                )}
                {data.latitude && data.longitude && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-subtle tabular-nums">
                        <MapPin className="h-3 w-3" />
                        {Number(data.latitude).toFixed(6)},{' '}
                        {Number(data.longitude).toFixed(6)}
                    </p>
                )}
            </section>

            {/* Label */}
            <Field
                label="Label Alamat"
                placeholder="Rumah, Kantor, dll"
                value={data.label}
                error={errors.label}
                onChange={(v) => setData('label', v)}
            />

            {/* Recipient */}
            <Field
                label="Nama Penerima"
                placeholder="Nama lengkap penerima"
                value={data.recipient_name}
                error={errors.recipient_name}
                onChange={(v) => setData('recipient_name', v)}
                required
            />

            {/* Phone */}
            <PhoneInput
                label="Nomor Telepon"
                value={data.phone}
                error={errors.phone}
                onChange={(v) => setData('phone', v)}
                required
            />

            {/* Address */}
            <div>
                <label className="text-xs font-semibold text-text">
                    Alamat Lengkap <span className="text-danger">*</span>
                </label>
                <textarea
                    value={data.address}
                    onChange={(e) => setData('address', e.target.value)}
                    className="mt-1.5 min-h-20 w-full rounded-chip border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-subtle focus:border-primary/20 focus:ring-1 focus:ring-primary/20"
                    placeholder="Jalan, nomor, RT/RW, detail"
                    required
                />
                {errors.address && (
                    <p className="mt-1 text-xs text-danger">{errors.address}</p>
                )}
            </div>

            {/* Address Detail */}
            <Field
                label="Detail Alamat"
                placeholder="Blok B3 No 27, Lantai 2, dll"
                value={data.address_detail}
                error={errors.address_detail}
                onChange={(v) => setData('address_detail', v)}
            />

            {/* Kelurahan / Kecamatan */}
            <div className="grid grid-cols-2 gap-3">
                <Field
                    label="Kelurahan"
                    placeholder="Kelurahan"
                    value={data.kelurahan}
                    error={errors.kelurahan}
                    onChange={(v) => setData('kelurahan', v)}
                />
                <Field
                    label="Kecamatan"
                    placeholder="Kecamatan"
                    value={data.kecamatan}
                    error={errors.kecamatan}
                    onChange={(v) => setData('kecamatan', v)}
                />
            </div>

            {/* City / Province */}
            <div className="grid grid-cols-2 gap-3">
                <Field
                    label="Kota"
                    placeholder="Kota"
                    value={data.city}
                    error={errors.city}
                    onChange={(v) => setData('city', v)}
                />
                <Field
                    label="Provinsi"
                    placeholder="Provinsi"
                    value={data.province}
                    error={errors.province}
                    onChange={(v) => setData('province', v)}
                />
            </div>

            {/* Postal Code */}
            <Field
                label="Kode Pos"
                placeholder="Kode Pos"
                value={data.postal_code}
                error={errors.postal_code}
                onChange={(v) => setData('postal_code', v)}
                inputMode="numeric"
            />

            {/* Landmark */}
            <div>
                <label className="text-xs font-semibold text-text">
                    Patokan / Ciri Rumah
                </label>
                <input
                    value={data.landmark}
                    onChange={(e) => setData('landmark', e.target.value)}
                    className="mt-1.5 min-h-11 w-full rounded-chip border border-border px-3 text-sm text-text placeholder:text-text-subtle focus:border-primary/20 focus:ring-1 focus:ring-primary/20"
                    placeholder="Rumah cat hijau dekat mushola"
                />
                {errors.landmark && (
                    <p className="mt-1 text-xs text-danger">
                        {errors.landmark}
                    </p>
                )}
                <p className="mt-1 text-[11px] text-text-subtle">
                    Membantu kurir menemukan lokasi dengan lebih cepat.
                </p>
            </div>

            {/* Delivery Notes */}
            <div>
                <label className="text-xs font-semibold text-text">
                    Catatan Kurir
                </label>
                <textarea
                    value={data.delivery_notes}
                    onChange={(e) => setData('delivery_notes', e.target.value)}
                    className="mt-1.5 min-h-16 w-full rounded-chip border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-subtle focus:border-primary/20 focus:ring-1 focus:ring-primary/20"
                    placeholder="Instruksi tambahan untuk kurir"
                />
                {errors.delivery_notes && (
                    <p className="mt-1 text-xs text-danger">
                        {errors.delivery_notes}
                    </p>
                )}
            </div>

            {/* Default toggle */}
            <label className="flex items-center gap-3 rounded-chip border border-border bg-surface p-3">
                <input
                    type="checkbox"
                    checked={data.is_default}
                    onChange={(e) => setData('is_default', e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-text">
                    Jadikan alamat default
                </span>
            </label>

            {/* Submit */}
            <div className="flex gap-3">
                <Button
                    type="submit"
                    variant="primary"
                    disabled={processing}
                    className="min-h-12 flex-1 rounded-chip text-sm font-bold active:bg-primary-hover active:opacity-80 disabled:bg-border disabled:opacity-100"
                >
                    {processing ? 'Menyimpan...' : submitLabel}
                </Button>
                <Link
                    href="/customer/addresses"
                    className="flex min-h-12 items-center justify-center rounded-chip border border-border px-5 text-sm font-semibold text-text-muted active:bg-surface-muted"
                >
                    Batal
                </Link>
            </div>
        </form>
    );
}

function Field({
    label,
    value,
    error,
    onChange,
    placeholder,
    type = 'text',
    required,
    inputMode,
}: {
    label: string;
    value: string;
    error?: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    required?: boolean;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
    return (
        <div>
            <label className="text-xs font-semibold text-text">
                {label} {required && <span className="text-danger">*</span>}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                inputMode={inputMode}
                className={`mt-1.5 min-h-11 w-full rounded-chip border px-3 text-sm text-text placeholder:text-text-subtle focus:border-primary/20 focus:ring-1 focus:ring-primary/20 ${error ? 'border-danger' : 'border-border'}`}
                placeholder={placeholder}
                required={required}
            />
            {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
    );
}

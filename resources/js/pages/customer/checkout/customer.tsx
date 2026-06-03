import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import LocationSearchPanel from '@/components/customer/location-search-panel';
import LocationSheet from '@/components/customer/location-sheet';
import PickupOutletSelector from '@/components/customer/pickup-outlet-selector';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { useCustomerLocation } from '@/lib/customer-location';

type CustomerForm = {
    customer_name: string;
    phone_number: string;
    address_line: string;
    province: string;
    city: string;
    district: string;
    village: string;
    postal_code: string;
    latitude: number | null;
    longitude: number | null;
    landmark: string;
    delivery_notes: string;
    selected_outlet_id: number | null;
};

export default function CheckoutCustomer({ draft, previewOutlet, pickupRecommendations, deliveryQuote }: any) {
    const fulfillmentType = draft?.fulfillment?.fulfillment_type ?? '';
    const isDelivery = fulfillmentType === 'delivery_dombi' || fulfillmentType === 'delivery_ojol';
    const { location: savedLocation } = useCustomerLocation();
    const [lookupState, setLookupState] = useState<'idle' | 'checking' | 'found' | 'empty'>('idle');
    const [locationSheetOpen, setLocationSheetOpen] = useState(false);

    const form = useForm<CustomerForm>({
        customer_name: draft?.customer?.customer_name ?? '',
        phone_number: draft?.customer?.phone_number ?? '',
        address_line: draft?.location?.address_line ?? '',
        province: draft?.location?.province ?? '',
        city: draft?.location?.city ?? '',
        district: draft?.location?.district ?? '',
        village: draft?.location?.village ?? '',
        postal_code: draft?.location?.postal_code ?? '',
        latitude: draft?.location?.latitude ?? null,
        longitude: draft?.location?.longitude ?? null,
        landmark: draft?.location?.landmark ?? '',
        delivery_notes: draft?.location?.delivery_notes ?? '',
        selected_outlet_id: draft?.fulfillment?.selected_outlet_id ?? pickupRecommendations?.recommended?.id ?? previewOutlet?.id ?? null,
    });

    useEffect(() => {
        if (!isDelivery || draft?.location || !savedLocation || form.data.latitude !== null || form.data.address_line.trim() !== '') {
            return;
        }

        form.setData({
            ...form.data,
            address_line: form.data.address_line || savedLocation.address_line || '',
            province: form.data.province || savedLocation.province || '',
            city: form.data.city || savedLocation.city || '',
            district: form.data.district || savedLocation.district || '',
            village: form.data.village || savedLocation.village || '',
            postal_code: form.data.postal_code || savedLocation.postal_code || '',
            latitude: form.data.latitude ?? savedLocation.latitude,
            longitude: form.data.longitude ?? savedLocation.longitude,
            landmark: form.data.landmark || savedLocation.landmark || '',
            delivery_notes: form.data.delivery_notes || savedLocation.delivery_notes || '',
        });

    }, [draft?.location, form.data.address_line, form.data.latitude, isDelivery, savedLocation]);

    useEffect(() => {
        const phone = form.data.phone_number.trim();

        if (phone.length < 9) {
            setLookupState('idle');
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            setLookupState('checking');
            const response = await fetch(`/customer/checkout/customer-lookup?phone_number=${encodeURIComponent(phone)}`, {
                signal: controller.signal,
            }).catch(() => null);

            if (!response?.ok) {
                setLookupState('empty');
                return;
            }

            const payload = await response.json();

            if (payload.found) {
                setLookupState('found');

                if (!form.data.customer_name.trim()) {
                    form.setData('customer_name', payload.customer.name);
                }
            } else {
                setLookupState('empty');
            }
        }, 500);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [form.data.phone_number]);

    const hasKnownLocation = isDelivery && !!form.data.latitude && !!form.data.longitude;
    const canContinue = isDelivery
        ? form.data.customer_name.trim().length >= 3
            && form.data.phone_number.trim().length >= 9
            && !!form.data.latitude
            && !!form.data.longitude
            && (!!deliveryQuote?.is_serviceable || !hasKnownLocation)
        : form.data.customer_name.trim().length >= 3 && form.data.phone_number.trim().length >= 9 && !!form.data.selected_outlet_id;
    const knownLocationTimestamp = savedLocation?.timestamp ? new Date(savedLocation.timestamp).toLocaleString('id-ID') : null;

    const submit = () => {
        form.post('/customer/checkout/customer');
    };

    return (
        <CustomerMobileLayout
            hideTopBar
            hideCartBar
            hideBottomNav
            footerSlot={<StepButton label="Lanjutkan ke Pembayaran" disabled={!canContinue || form.processing} processing={form.processing} onClick={submit} />}
        >
            <Head title="Informasi Pemesan" />
            <StepHeader title="Customer & Delivery" step="2 dari 3" backHref="/customer/checkout" />

            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                <h1 className="text-lg font-semibold text-slate-900">Informasi Pemesan</h1>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">Data ini digunakan untuk konfirmasi dan pengiriman pesanan.</p>

                <div className="mt-4 space-y-3">
                    <Field
                        label="Nama Lengkap"
                        value={form.data.customer_name}
                        onChange={(value) => form.setData('customer_name', value)}
                        error={form.errors.customer_name}
                        placeholder="Nama penerima"
                    />
                    <Field
                        label="Nomor WhatsApp"
                        value={form.data.phone_number}
                        onChange={(value) => form.setData('phone_number', value)}
                        error={form.errors.phone_number}
                        placeholder="081234567890"
                        inputMode="tel"
                    />
                </div>
            </section>

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status Customer</div>
                <div className="mt-2 text-sm font-semibold text-slate-800">
                    {lookupState === 'checking' && 'Mengecek nomor WhatsApp...'}
                    {lookupState === 'found' && 'Customer ditemukan'}
                    {lookupState === 'empty' && 'Customer baru, order tetap bisa dibuat'}
                    {lookupState === 'idle' && 'Masukkan nomor WhatsApp untuk identitas order.'}
                </div>
            </section>

            {!isDelivery && (
                <PickupOutletSelector
                    items={draft?.items ?? []}
                    initialRecommendations={pickupRecommendations}
                    selectedOutletId={form.data.selected_outlet_id}
                    onSelect={(outletId) => form.setData('selected_outlet_id', outletId)}
                    error={form.errors.selected_outlet_id}
                />
            )}

            {isDelivery && (
                <>
                    {hasKnownLocation ? (
                        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Lokasi Pengiriman</div>
                                    <div className="mt-2 text-sm font-semibold text-slate-900">
                                        {[form.data.village, form.data.district, form.data.city].filter(Boolean).join(', ') || 'Lokasi tersimpan'}
                                    </div>
                                    <div className="mt-1 text-xs leading-relaxed text-slate-500">
                                        {form.data.address_line || 'Lokasi ini akan digunakan untuk pengiriman pesanan.'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setLocationSheetOpen(true)}
                                    className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
                                >
                                    Ubah Lokasi
                                </button>
                            </div>

                            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <div className="text-slate-500">Lat</div>
                                        <div className="mt-1 font-semibold tabular-nums text-slate-900">{form.data.latitude?.toFixed(6)}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500">Lng</div>
                                        <div className="mt-1 font-semibold tabular-nums text-slate-900">{form.data.longitude?.toFixed(6)}</div>
                                    </div>
                                </div>
                                {knownLocationTimestamp && <div className="mt-3 text-xs text-slate-500">Last Updated: {knownLocationTimestamp}</div>}
                                <div className="mt-1 text-xs text-slate-500">Lokasi ini akan digunakan untuk pengiriman pesanan.</div>
                            </div>

                            {deliveryQuote?.outlet && (
                                <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Kurir Dombi</div>
                                    <div className="mt-2 text-sm font-semibold text-emerald-900">{deliveryQuote.outlet.name}</div>
                                    <div className="mt-1 text-xs text-emerald-700">
                                        {Number(deliveryQuote.distance_km ?? 0).toFixed(2)} km · Ongkir Rp {Number(deliveryQuote.delivery_fee ?? 0).toLocaleString('id-ID')}
                                    </div>
                                </div>
                            )}

                            {deliveryQuote && !deliveryQuote.is_serviceable && (
                                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                                    Maaf, lokasi Anda berada di luar area layanan Kurir Dombi.
                                </div>
                            )}
                        </section>
                    ) : (
                        <section className="mt-4">
                            <LocationSearchPanel
                                value={{
                                    address_line: form.data.address_line,
                                    province: form.data.province,
                                    city: form.data.city,
                                    district: form.data.district,
                                    village: form.data.village,
                                    postal_code: form.data.postal_code,
                                    latitude: form.data.latitude,
                                    longitude: form.data.longitude,
                                    landmark: form.data.landmark,
                                    delivery_notes: form.data.delivery_notes,
                                    timestamp: Date.now(),
                                }}
                                savedLocation={savedLocation}
                                onUseSavedLocation={() => {
                                    if (!savedLocation) {
                                        return;
                                    }

                                    form.setData({
                                        ...form.data,
                                        address_line: savedLocation.address_line ?? '',
                                        province: savedLocation.province ?? '',
                                        city: savedLocation.city ?? '',
                                        district: savedLocation.district ?? '',
                                        village: savedLocation.village ?? '',
                                        postal_code: savedLocation.postal_code ?? '',
                                        latitude: savedLocation.latitude,
                                        longitude: savedLocation.longitude,
                                        landmark: savedLocation.landmark ?? '',
                                        delivery_notes: savedLocation.delivery_notes ?? '',
                                    });
                                }}
                                onChange={(next) => {
                                    form.setData({
                                        ...form.data,
                                        address_line: next.address_line ?? form.data.address_line,
                                        province: next.province ?? form.data.province,
                                        city: next.city ?? form.data.city,
                                        district: next.district ?? form.data.district,
                                        village: next.village ?? form.data.village,
                                        postal_code: next.postal_code ?? form.data.postal_code,
                                        latitude: next.latitude ?? form.data.latitude,
                                        longitude: next.longitude ?? form.data.longitude,
                                        landmark: next.landmark ?? form.data.landmark,
                                        delivery_notes: next.delivery_notes ?? form.data.delivery_notes,
                                    });
                                }}
                            />
                            {(form.errors.latitude || form.errors.longitude) && <p className="mt-2 text-xs text-red-600">Lokasi pengiriman wajib dipilih pada peta.</p>}
                        </section>
                    )}

                    {!hasKnownLocation && (
                        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                            <textarea
                                value={form.data.address_line}
                                onChange={(event) => form.setData('address_line', event.target.value)}
                                className="min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                                placeholder="Alamat lengkap"
                            />
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <Field label="Kelurahan" value={form.data.village} onChange={(value) => form.setData('village', value)} />
                                <Field label="Kecamatan" value={form.data.district} onChange={(value) => form.setData('district', value)} />
                                <Field label="Kota" value={form.data.city} onChange={(value) => form.setData('city', value)} />
                                <Field label="Provinsi" value={form.data.province} onChange={(value) => form.setData('province', value)} />
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3">
                                <Field label="Kode Pos" value={form.data.postal_code} onChange={(value) => form.setData('postal_code', value)} inputMode="numeric" />
                                <Field label="Patokan rumah" value={form.data.landmark} onChange={(value) => form.setData('landmark', value)} placeholder="Pagar hijau, dekat minimarket..." />
                                <label className="block">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Catatan kurir</span>
                                    <textarea
                                        value={form.data.delivery_notes}
                                        onChange={(event) => form.setData('delivery_notes', event.target.value)}
                                        className="mt-1 min-h-16 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                                        placeholder="Instruksi tambahan untuk kurir atau admin"
                                    />
                                </label>
                            </div>
                        </section>
                    )}
                </>
            )}
            <LocationSheet
                open={locationSheetOpen}
                onClose={() => setLocationSheetOpen(false)}
                onLocationSaved={(location) => {
                    form.setData({
                        ...form.data,
                        address_line: location.address_line ?? '',
                        province: location.province ?? '',
                        city: location.city ?? '',
                        district: location.district ?? '',
                        village: location.village ?? '',
                        postal_code: location.postal_code ?? '',
                        latitude: location.latitude,
                        longitude: location.longitude,
                        landmark: location.landmark ?? '',
                        delivery_notes: location.delivery_notes ?? '',
                    });
                }}
            />
        </CustomerMobileLayout>
    );
}

function StepHeader({ title, step, backHref }: { title: string; step: string; backHref: string }) {
    return (
        <header className="-mx-4 -mt-5 border-b border-slate-200 bg-white px-4 py-3">
            <div className="mx-auto flex max-w-lg items-center justify-between">
                <button onClick={() => router.visit(backHref)} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 active:bg-slate-100">
                    <span className="text-xl">‹</span>
                </button>
                <div className="text-center">
                    <h1 className="text-base font-semibold text-slate-900">{title}</h1>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{step}</p>
                </div>
                <div className="h-10 w-10" />
            </div>
        </header>
    );
}

function StepButton({ label, disabled, processing, onClick }: { label: string; disabled: boolean; processing: boolean; onClick: () => void }) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
            <div className="mx-auto max-w-lg">
                <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    className="flex min-h-14 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-emerald-700 disabled:bg-slate-300 disabled:active:scale-100"
                >
                    {processing ? 'Memproses...' : label}
                </button>
            </div>
        </div>
    );
}

function Field({ label, value, onChange, placeholder, error, inputMode }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    error?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
    return (
        <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                inputMode={inputMode}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                placeholder={placeholder}
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </label>
    );
}

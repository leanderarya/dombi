import { Head, useForm } from '@inertiajs/react';
import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import DeliveryQuoteCard from '@/components/customer/delivery-quote-card';
import LocationSearchPanel from '@/components/customer/location-search-panel';
import LocationSheet from '@/components/customer/location-sheet';
import PickupOutletSelector from '@/components/customer/pickup-outlet-selector';
import StepButton from '@/components/customer/step-button';
import StepHeader from '@/components/customer/step-header';
import SectionCard from '@/components/ui/section-card';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { useCustomerLocation } from '@/lib/customer-location';

type CustomerForm = {
    customer_name: string;
    phone_number: string;
    address_line: string;
    address_detail: string;
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
    const [locationSheetOpen, setLocationSheetOpen] = useState(false);

    const form = useForm<CustomerForm>({
        customer_name: draft?.customer?.customer_name ?? '',
        phone_number: draft?.customer?.phone_number ?? '',
        address_line: draft?.location?.address_line ?? '',
        address_detail: draft?.location?.address_detail ?? '',
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
            address_detail: form.data.address_detail || savedLocation.address_detail || '',
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
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            const response = await fetch(`/customer/checkout/customer-lookup?phone_number=${encodeURIComponent(phone)}`, {
                signal: controller.signal,
            }).catch(() => null);

            if (!response?.ok) {
                return;
            }

            const payload = await response.json();

            if (payload.found && !form.data.customer_name.trim()) {
                form.setData('customer_name', payload.customer.name);
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

    const submit = () => {
        form.post('/customer/checkout/customer');
    };

    const notServiceable = isDelivery && hasKnownLocation && deliveryQuote && !deliveryQuote.is_serviceable;
    const buttonLabel = notServiceable ? 'Lokasi Luar Jangkauan' : 'Lanjutkan ke Pembayaran';

    return (
        <CustomerMobileLayout
            hideTopBar
            hideCartBar
            hideBottomNav
            footerSlot={<StepButton label={buttonLabel} disabled={!canContinue || form.processing} processing={form.processing} onClick={submit} />}
        >
            <Head title="Informasi Pemesan" />
            <StepHeader title="Customer & Delivery" step="2 dari 3" backHref="/customer/checkout" />

            <SectionCard label="Customer">
                <div className="space-y-3">
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
            </SectionCard>

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
                        <section className="mt-4 space-y-4">
                            <div className="rounded-xl bg-white p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 shrink-0 text-text-subtle" />
                                            <span className="text-[13px] text-text-subtle">Lokasi Pengiriman</span>
                                        </div>
                                        <div className="mt-2 text-sm font-semibold text-text">
                                            {[form.data.village, form.data.district, form.data.city].filter(Boolean).join(', ') || 'Lokasi tersimpan'}
                                        </div>
                                        {form.data.address_detail && (
                                            <div className="mt-1 text-xs text-text-muted">
                                                <span className="font-semibold text-text-muted">Detail: </span>{form.data.address_detail}
                                            </div>
                                        )}
                                        {form.data.landmark && (
                                            <div className="mt-1 text-xs text-text-muted">
                                                <span className="font-semibold text-text-muted">Patokan: </span>{form.data.landmark}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setLocationSheetOpen(true)}
                                        className="min-h-[44px] shrink-0 rounded-lg border border-border px-3 text-xs font-semibold text-text active:opacity-80"
                                    >
                                        Ubah Lokasi
                                    </button>
                                </div>
                            </div>

                            {deliveryQuote && (
                                <DeliveryQuoteCard
                                    outlet={deliveryQuote.outlet}
                                    distance_km={Number(deliveryQuote.distance_km ?? 0)}
                                    delivery_fee={Number(deliveryQuote.delivery_fee ?? 0)}
                                    is_serviceable={deliveryQuote.is_serviceable ?? false}
                                />
                            )}
                        </section>
                    ) : (
                        <section className="mt-4">
                            <LocationSearchPanel
                                value={{
                                    address_line: form.data.address_line,
                                    address_detail: form.data.address_detail,
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
                                        address_detail: savedLocation.address_detail ?? '',
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
                                        address_detail: next.address_detail ?? form.data.address_detail,
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
                        <SectionCard label="Alamat">
                            <textarea
                                value={form.data.address_line}
                                onChange={(event) => form.setData('address_line', event.target.value)}
                                className="min-h-20 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                                placeholder="Alamat lengkap"
                            />
                            <div className="mt-3 grid grid-cols-1 gap-3">
                                <Field label="Kelurahan" value={form.data.village} onChange={(value) => form.setData('village', value)} />
                                <Field label="Kecamatan" value={form.data.district} onChange={(value) => form.setData('district', value)} />
                                <Field label="Kota" value={form.data.city} onChange={(value) => form.setData('city', value)} />
                                <Field label="Provinsi" value={form.data.province} onChange={(value) => form.setData('province', value)} />
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3">
                                <Field label="Kode Pos" value={form.data.postal_code} onChange={(value) => form.setData('postal_code', value)} inputMode="numeric" />
                                <Field label="Patokan rumah" value={form.data.landmark} onChange={(value) => form.setData('landmark', value)} placeholder="Pagar hijau, dekat minimarket..." />
                                <label className="block">
                                    <span className="text-[13px] text-text-subtle">Catatan kurir</span>
                                    <textarea
                                        value={form.data.delivery_notes}
                                        onChange={(event) => form.setData('delivery_notes', event.target.value)}
                                        className="mt-1 min-h-16 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                                        placeholder="Instruksi tambahan untuk kurir atau admin"
                                    />
                                </label>
                            </div>
                        </SectionCard>
                    )}
                </>
            )}
            {/* Spacer for sticky footer */}
            <div className="h-24" />
            <LocationSheet
                open={locationSheetOpen}
                onClose={() => setLocationSheetOpen(false)}
                onLocationSaved={(location) => {
                    form.setData({
                        ...form.data,
                        address_line: location.address_line ?? '',
                        address_detail: location.address_detail ?? '',
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
            <span className="text-[13px] text-text-subtle">{label}</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                inputMode={inputMode}
                className="mt-1 min-h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text placeholder:text-text-subtle focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                placeholder={placeholder}
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </label>
    );
}

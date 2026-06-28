import NoticeBanner from '@/components/customer/checkout/notice-banner';
import DeliveryQuoteCard from '@/components/customer/delivery-quote-card';
import LocationSearchPanel from '@/components/customer/location-search-panel';
import LocationSheet from '@/components/customer/location-sheet';
import PickupOutletSelector from '@/components/customer/pickup-outlet-selector';
import StepButton from '@/components/customer/step-button';
import StepHeader from '@/components/customer/step-header';
import SectionCard from '@/components/ui/section-card';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { useCustomerLocation } from '@/lib/customer-location';
import { Head, useForm } from '@inertiajs/react';
import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';

type CustomerForm = {
    customer_name: string;
    phone_number: string;
    recipient_name: string;
    recipient_phone: string;
    save_recipient: boolean;
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

export default function CheckoutCustomer({
    draft,
    authUser,
    recipientDefaults,
    savedRecipients = [],
    previewOutlet,
    pickupRecommendations,
    deliveryQuote,
}: any) {
    const fulfillmentType = draft?.fulfillment?.fulfillment_type ?? '';
    const isDelivery =
        fulfillmentType === 'delivery_dombi' ||
        fulfillmentType === 'delivery_ojol';
    const isLoggedIn = !!authUser;
    const { location: savedLocation } = useCustomerLocation();
    const [locationSheetOpen, setLocationSheetOpen] = useState(false);
    const [saveRecipient, setSaveRecipient] = useState(false);
    const [showRecipient, setShowRecipient] = useState(
        !!(
            draft?.customer?.recipient_name &&
            draft?.customer?.recipient_name !==
                (draft?.customer?.customer_name ?? authUser?.name ?? '')
        ),
    );

    const form = useForm<CustomerForm>({
        customer_name: draft?.customer?.customer_name ?? authUser?.name ?? '',
        phone_number: draft?.customer?.phone_number ?? authUser?.phone ?? '',
        recipient_name: draft?.customer?.recipient_name ?? '',
        recipient_phone: draft?.customer?.recipient_phone ?? '',
        save_recipient: false,
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
        selected_outlet_id:
            draft?.fulfillment?.selected_outlet_id ??
            pickupRecommendations?.recommended?.id ??
            previewOutlet?.id ??
            null,
    });

    useEffect(() => {
        if (
            !isDelivery ||
            draft?.location ||
            !savedLocation ||
            form.data.latitude !== null ||
            form.data.address_line.trim() !== ''
        ) {
            return;
        }

        form.setData({
            ...form.data,
            address_line:
                form.data.address_line || savedLocation.address_line || '',
            address_detail:
                form.data.address_detail || savedLocation.address_detail || '',
            province: form.data.province || savedLocation.province || '',
            city: form.data.city || savedLocation.city || '',
            district: form.data.district || savedLocation.district || '',
            village: form.data.village || savedLocation.village || '',
            postal_code:
                form.data.postal_code || savedLocation.postal_code || '',
            latitude: form.data.latitude ?? savedLocation.latitude,
            longitude: form.data.longitude ?? savedLocation.longitude,
            landmark: form.data.landmark || savedLocation.landmark || '',
            delivery_notes:
                form.data.delivery_notes || savedLocation.delivery_notes || '',
        });
    }, [
        draft?.location,
        form.data.address_line,
        form.data.latitude,
        isDelivery,
        savedLocation,
    ]);

    useEffect(() => {
        const phone = form.data.phone_number.trim();

        if (phone.length < 9) {
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            const response = await fetch(
                `/customer/checkout/customer-lookup?phone_number=${encodeURIComponent(phone)}`,
                {
                    signal: controller.signal,
                },
            ).catch(() => null);

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

    const hasKnownLocation =
        isDelivery && !!form.data.latitude && !!form.data.longitude;
    const canContinue = isDelivery
        ? form.data.customer_name.trim().length >= 3 &&
          form.data.phone_number.trim().length >= 9 &&
          !!form.data.latitude &&
          !!form.data.longitude &&
          (!!deliveryQuote?.is_serviceable || !hasKnownLocation)
        : form.data.customer_name.trim().length >= 3 &&
          form.data.phone_number.trim().length >= 9 &&
          !!form.data.selected_outlet_id;

    const hasRecipient =
        showRecipient && form.data.recipient_name.trim().length >= 3;

    const submit = () => {
        if (!showRecipient) {
            form.setData('recipient_name', '');
            form.setData('recipient_phone', '');
            form.setData('save_recipient', false);
        } else {
            form.setData('save_recipient', saveRecipient);
        }
        form.post('/customer/checkout/customer');
    };

    const notServiceable =
        isDelivery &&
        hasKnownLocation &&
        deliveryQuote &&
        !deliveryQuote.is_serviceable;
    const buttonLabel = notServiceable ? 'Lokasi Luar Jangkauan' : 'Lanjutkan';

    return (
        <CustomerMobileLayout
            hideTopBar
            hideCartBar
            hideBottomNav
            footerSlot={
                <StepButton
                    label={buttonLabel}
                    disabled={!canContinue || form.processing}
                    processing={form.processing}
                    onClick={submit}
                />
            }
        >
            <Head title="Informasi Pemesan" />
            <StepHeader
                title="Informasi"
                currentStep={1}
                steps={[
                    { label: 'Keranjang' },
                    { label: 'Info' },
                    { label: 'Bayar' },
                ]}
                backHref="/customer/checkout"
            />

            <SectionCard className="mt-4">
                <div className="space-y-3">
                    <Field
                        label="Nama Lengkap"
                        value={form.data.customer_name}
                        onChange={(value) =>
                            form.setData('customer_name', value)
                        }
                        error={form.errors.customer_name}
                        placeholder="Nama kamu"
                    />
                    <Field
                        label="Nomor WhatsApp"
                        value={form.data.phone_number}
                        onChange={(value) =>
                            form.setData('phone_number', value)
                        }
                        error={form.errors.phone_number}
                        placeholder="081234567890"
                        inputMode="tel"
                        hint={
                            isLoggedIn && authUser?.phone
                                ? 'Dari akun kamu'
                                : undefined
                        }
                    />
                </div>

                {/* Link to add recipient */}
                {isDelivery && !showRecipient && (
                    <button
                        type="button"
                        onClick={() => setShowRecipient(true)}
                        className="mt-3 flex min-h-11 w-full items-center gap-1.5 text-xs font-semibold text-primary active:opacity-80"
                    >
                        → Kirim ke orang lain?
                    </button>
                )}
            </SectionCard>

            {/* Penerima — only when user clicked "Kirim ke orang lain" */}
            {isDelivery && showRecipient && (
                <SectionCard
                    label="Penerima"
                    labelRight={
                        <button
                            type="button"
                            onClick={() => {
                                setShowRecipient(false);
                                form.setData('recipient_name', '');
                                form.setData('recipient_phone', '');
                                setSaveRecipient(false);
                            }}
                            className="text-[11px] font-semibold text-text-subtle active:opacity-80"
                        >
                            Hapus
                        </button>
                    }
                >
                    <div className="space-y-3">
                        <Field
                            label="Nama Penerima"
                            value={form.data.recipient_name}
                            onChange={(value) =>
                                form.setData('recipient_name', value)
                            }
                            error={form.errors.recipient_name}
                            placeholder="Nama penerima"
                        />
                        <Field
                            label="Nomor WhatsApp Penerima"
                            value={form.data.recipient_phone}
                            onChange={(value) =>
                                form.setData('recipient_phone', value)
                            }
                            error={form.errors.recipient_phone}
                            placeholder="081234567890"
                            inputMode="tel"
                        />
                    </div>

                    {/* Save recipient option */}
                    {hasRecipient && (
                        <label className="mt-3 flex min-h-11 items-center gap-2 text-xs text-text-muted active:opacity-80">
                            <input
                                type="checkbox"
                                checked={saveRecipient}
                                onChange={(e) =>
                                    setSaveRecipient(e.target.checked)
                                }
                                className="h-4 w-4 rounded border-border"
                            />
                            Simpan penerima ini untuk pesanan berikutnya
                        </label>
                    )}
                </SectionCard>
            )}

            {/* Pickup outlet selector */}
            {!isDelivery && (
                <PickupOutletSelector
                    items={draft?.items ?? []}
                    initialRecommendations={pickupRecommendations}
                    selectedOutletId={form.data.selected_outlet_id}
                    onSelect={(outletId) =>
                        form.setData('selected_outlet_id', outletId)
                    }
                    error={form.errors.selected_outlet_id}
                />
            )}

            {/* Delivery location */}
            {isDelivery && (
                <>
                    {hasKnownLocation ? (
                        <section className="mt-4 space-y-4">
                            <div className="rounded-xl bg-white p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start gap-2">
                                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-subtle" />
                                            <div className="min-w-0">
                                                {form.data.address_line || [form.data.village, form.data.district, form.data.city].filter(Boolean).join(', ') ? (
                                                    <div className="line-clamp-2 text-sm font-semibold text-text">
                                                        {form.data.address_line || [form.data.village, form.data.district, form.data.city].filter(Boolean).join(', ')}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm font-semibold text-amber-600">Pilih lokasi di peta</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setLocationSheetOpen(true)
                                        }
                                        className="min-h-11 shrink-0 rounded-lg border border-border px-3 text-xs font-semibold text-text active:opacity-80"
                                    >
                                        Ubah Lokasi
                                    </button>
                                </div>
                            </div>

                            {deliveryQuote && (
                                <DeliveryQuoteCard
                                    outlet={deliveryQuote.outlet}
                                    distance_km={Number(
                                        deliveryQuote.distance_km ?? 0,
                                    )}
                                    delivery_fee={Number(
                                        deliveryQuote.delivery_fee ?? 0,
                                    )}
                                    is_serviceable={
                                        deliveryQuote.is_serviceable ?? false
                                    }
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
                                        address_line:
                                            savedLocation.address_line ?? '',
                                        address_detail:
                                            savedLocation.address_detail ?? '',
                                        province: savedLocation.province ?? '',
                                        city: savedLocation.city ?? '',
                                        district: savedLocation.district ?? '',
                                        village: savedLocation.village ?? '',
                                        postal_code:
                                            savedLocation.postal_code ?? '',
                                        latitude: savedLocation.latitude,
                                        longitude: savedLocation.longitude,
                                        landmark: savedLocation.landmark ?? '',
                                        delivery_notes:
                                            savedLocation.delivery_notes ?? '',
                                    });
                                }}
                                onChange={(next) => {
                                    form.setData({
                                        ...form.data,
                                        address_line:
                                            next.address_line ??
                                            form.data.address_line,
                                        address_detail:
                                            next.address_detail ??
                                            form.data.address_detail,
                                        province:
                                            next.province ?? form.data.province,
                                        city: next.city ?? form.data.city,
                                        district:
                                            next.district ?? form.data.district,
                                        village:
                                            next.village ?? form.data.village,
                                        postal_code:
                                            next.postal_code ??
                                            form.data.postal_code,
                                        latitude:
                                            next.latitude ?? form.data.latitude,
                                        longitude:
                                            next.longitude ??
                                            form.data.longitude,
                                        landmark:
                                            next.landmark ?? form.data.landmark,
                                        delivery_notes:
                                            next.delivery_notes ??
                                            form.data.delivery_notes,
                                    });
                                }}
                            />
                            {(form.errors.latitude ||
                                form.errors.longitude) && (
                                <div className="mt-3">
                                    <NoticeBanner
                                        variant="error"
                                        title="Lokasi wajib dipilih"
                                        message="Pilih lokasi pengiriman pada peta."
                                    />
                                </div>
                            )}
                        </section>
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

function Field({
    label,
    value,
    onChange,
    placeholder,
    error,
    inputMode,
    readOnly,
    hint,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    error?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    readOnly?: boolean;
    hint?: string;
}) {
    return (
        <label className="block">
            <span className="text-[13px] text-text-subtle">{label}</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                inputMode={inputMode}
                readOnly={readOnly}
                className={`mt-1 min-h-11 w-full rounded-lg border border-border px-3 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                    readOnly ? 'bg-surface text-text-muted' : 'bg-white'
                }`}
                placeholder={placeholder}
            />
            {hint && !error && (
                <p className="mt-1 text-[11px] text-text-subtle">{hint}</p>
            )}
            {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </label>
    );
}

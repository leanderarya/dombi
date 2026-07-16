import { Head, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    ChevronRight,
    LogIn,
    MapPin,
    Navigation,
    Phone,
    Truck,
    User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import LocationSheet from '@/components/customer/location-sheet';
import PickupOutletSelector from '@/components/customer/pickup-outlet-selector';
import StepButton from '@/components/customer/step-button';
import StepHeader from '@/components/customer/step-header';
import PhoneInput from '@/components/ui/phone-input';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { applyLocationToForm } from '@/lib/checkout-utils';
import { useCustomerLocation } from '@/lib/customer-location';
import { formatCurrency, formatDistance } from '@/lib/format';
import { haversineDistance } from '@/lib/geo';

type SavedAddress = {
    id: number;
    label: string;
    recipient_name: string;
    phone: string;
    address_line: string;
    address_detail: string;
    village: string;
    district: string;
    city: string;
    province: string;
    postal_code: string;
    latitude: number;
    longitude: number;
    landmark: string;
    delivery_notes: string;
    is_default: boolean;
};

type CustomerForm = {
    customer_name: string;
    phone_number: string;
    recipient_name: string;
    recipient_phone: string;
    save_recipient: boolean;
    address_id: number | null;
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

function findNearest(
    loc: { latitude: number; longitude: number },
    addrs: SavedAddress[],
): SavedAddress | null {
    let best: SavedAddress | null = null;
    let bestDist = Infinity;

    for (const a of addrs) {
        if (!a.latitude || !a.longitude) {
            continue;
        }

        const d = haversineDistance(
            loc.latitude,
            loc.longitude,
            a.latitude,
            a.longitude,
        );

        if (d < bestDist) {
            bestDist = d;
            best = a;
        }
    }

    return best;
}

export default function CheckoutCustomer({
    draft,
    authUser,
    recipientDefaults,
    savedRecipients = [],
    previewOutlet,
    pickupRecommendations,
    deliveryQuote,
    savedAddresses = [],
    suggestedAddressId,
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
    const autoApplied = useRef(false);

    const form = useForm<CustomerForm>({
        customer_name: draft?.customer?.customer_name ?? authUser?.name ?? '',
        phone_number: draft?.customer?.phone_number ?? authUser?.phone ?? '',
        recipient_name: draft?.customer?.recipient_name ?? '',
        recipient_phone: draft?.customer?.recipient_phone ?? '',
        save_recipient: false,
        address_id: draft?.location?.address_id ?? null,
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

    // Single auto-select effect with priority chain
    useEffect(() => {
        if (!isDelivery || autoApplied.current) {
            return;
        }

        if (draft?.location?.address_id) {
            return;
        } // already has a saved address selected

        // Priority 1: backend suggested (nearest GPS or default)
        if (suggestedAddressId && savedAddresses.length) {
            const addr = savedAddresses.find(
                (a: SavedAddress) => a.id === suggestedAddressId,
            );

            if (addr) {
                autoApplied.current = true;
                applySavedAddress(addr);

                return;
            }
        }

        // Priority 2: localStorage GPS → find nearest saved address
        if (
            savedLocation?.latitude &&
            savedLocation?.longitude &&
            savedAddresses.length
        ) {
            const nearest = findNearest(savedLocation, savedAddresses);

            if (nearest) {
                autoApplied.current = true;
                applySavedAddress(nearest);

                return;
            }
        }

        // Priority 3: default address (no GPS available)
        if (savedAddresses.length) {
            const def = savedAddresses.find((a: SavedAddress) => a.is_default);

            if (def) {
                autoApplied.current = true;
                applySavedAddress(def);

                return;
            }
        }

        // Priority 4: fallback to localStorage location fields (no address_id)
        if (savedLocation?.latitude && savedLocation?.longitude) {
            autoApplied.current = true;
            applyLocation(savedLocation);
        }
    }, [
        isDelivery,
        draft?.location,
        suggestedAddressId,
        savedAddresses,
        savedLocation,
    ]);

    // Debounced phone lookup
    useEffect(() => {
        const phone = form.data.phone_number.trim();

        if (phone.length < 9) {
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            const res = await fetch(
                `/customer/checkout/customer-lookup?phone_number=${encodeURIComponent(phone)}`,
                { signal: controller.signal },
            ).catch(() => null);

            if (!res?.ok) {
                return;
            }

            const data = await res.json();

            if (
                data.found &&
                data.customer?.name &&
                !form.data.customer_name?.trim()
            ) {
                form.setData('customer_name', data.customer.name);
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
    const notServiceable =
        isDelivery &&
        hasKnownLocation &&
        deliveryQuote &&
        !deliveryQuote.is_serviceable;
    const buttonLabel = notServiceable ? 'Lokasi Luar Jangkauan' : 'Lanjutkan';

    const selectedAddressLabel = form.data.address_id
        ? (savedAddresses.find(
              (a: SavedAddress) => a.id === form.data.address_id,
          )?.label ?? null)
        : null;

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

    const applyLocation = (loc: Record<string, any>) => {
        form.setData(applyLocationToForm(form.data, loc) as any);

        if (loc.address_id) {
            form.setData('address_id', loc.address_id);
        } else {
            form.setData('address_id', null);
        }
    };

    const applySavedAddress = (addr: SavedAddress) => {
        form.setData({
            ...form.data,
            address_id: addr.id,
            address_line: addr.address_line ?? '',
            address_detail: addr.address_detail ?? '',
            province: addr.province ?? '',
            city: addr.city ?? '',
            district: addr.district ?? '',
            village: addr.village ?? '',
            postal_code: addr.postal_code ?? '',
            latitude: addr.latitude,
            longitude: addr.longitude,
            landmark: addr.landmark ?? '',
            delivery_notes: addr.delivery_notes ?? '',
        });
    };

    const displayAddress =
        form.data.address_line ||
        [form.data.village, form.data.district, form.data.city]
            .filter(Boolean)
            .join(', ');

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

            {/* Customer Info + Recipient — single card */}
            <div className="mt-4 divide-y divide-border/50 rounded-xl border border-border bg-white">
                <div className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-text-subtle" />
                        <span className="text-[11px] font-bold tracking-wider text-text-subtle uppercase">
                            Pemesan
                        </span>
                    </div>
                    <div className="space-y-3">
                        <CompactField
                            label="Nama Lengkap"
                            value={form.data.customer_name}
                            onChange={(v) => form.setData('customer_name', v)}
                            error={form.errors.customer_name}
                            placeholder="Nama kamu"
                        />
                        <PhoneInput
                            label="Nomor WhatsApp"
                            value={form.data.phone_number}
                            onChange={(v) => form.setData('phone_number', v)}
                            error={form.errors.phone_number}
                            hint={
                                isLoggedIn && authUser?.phone
                                    ? 'Dari akun kamu'
                                    : undefined
                            }
                            required
                        />
                        {!isLoggedIn &&
                            form.errors.phone_number?.includes(
                                'sudah terdaftar',
                            ) && <LoginPrompt />}
                    </div>
                    {isDelivery && !showRecipient && (
                        <button
                            type="button"
                            onClick={() => setShowRecipient(true)}
                            className="mt-3 flex min-h-9 w-full items-center gap-1.5 text-[11px] font-semibold text-primary active:opacity-80"
                        >
                            <ChevronRight className="h-3 w-3" />
                            Kirim ke orang lain?
                        </button>
                    )}
                </div>

                {/* Recipient inline */}
                {isDelivery && showRecipient && (
                    <div className="p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-text-subtle" />
                                <span className="text-[11px] font-bold tracking-wider text-text-subtle uppercase">
                                    Penerima
                                </span>
                            </div>
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
                        </div>
                        <div className="space-y-3">
                            <CompactField
                                label="Nama Penerima"
                                value={form.data.recipient_name}
                                onChange={(v) =>
                                    form.setData('recipient_name', v)
                                }
                                error={form.errors.recipient_name}
                                placeholder="Nama penerima"
                            />
                            <PhoneInput
                                label="Nomor WhatsApp Penerima"
                                value={form.data.recipient_phone}
                                onChange={(v) =>
                                    form.setData('recipient_phone', v)
                                }
                                error={form.errors.recipient_phone}
                            />
                        </div>
                        {hasRecipient && (
                            <label className="mt-3 flex items-center gap-2 text-[11px] text-text-muted active:opacity-80">
                                <input
                                    type="checkbox"
                                    checked={saveRecipient}
                                    onChange={(e) =>
                                        setSaveRecipient(e.target.checked)
                                    }
                                    className="h-3.5 w-3.5 rounded border-border"
                                />
                                Simpan penerima ini
                            </label>
                        )}
                    </div>
                )}
            </div>

            {/* Pickup outlet */}
            {!isDelivery && (
                <PickupOutletSelector
                    items={draft?.items ?? []}
                    initialRecommendations={pickupRecommendations}
                    selectedOutletId={form.data.selected_outlet_id}
                    onSelect={(id) => form.setData('selected_outlet_id', id)}
                    error={form.errors.selected_outlet_id}
                />
            )}

            {/* Delivery location — compact card */}
            {isDelivery && (
                <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white">
                    {/* Address row */}
                    <button
                        type="button"
                        onClick={() => setLocationSheetOpen(true)}
                        className="flex w-full items-center gap-3 p-4 text-left transition-colors active:bg-surface-muted"
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                            <MapPin className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            {hasKnownLocation ? (
                                <>
                                    <div className="flex items-center gap-1.5">
                                        {selectedAddressLabel && (
                                            <span className="text-[11px] font-bold text-emerald-700">
                                                {selectedAddressLabel}
                                            </span>
                                        )}
                                        <span className="line-clamp-1 text-xs text-text">
                                            {displayAddress}
                                        </span>
                                    </div>
                                    {form.data.address_detail && (
                                        <div className="mt-0.5 truncate text-[11px] text-text-subtle">
                                            {form.data.address_detail}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <span className="text-xs font-medium text-primary">
                                    Pilih Lokasi Pengiriman
                                </span>
                            )}
                        </div>
                        <Navigation className="h-4 w-4 shrink-0 text-text-subtle" />
                    </button>

                    {/* Delivery quote — inline */}
                    {hasKnownLocation && deliveryQuote && (
                        <div className="border-t border-border/50 px-4 py-3">
                            {deliveryQuote.is_serviceable ? (
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0">
                                        <div className="text-[11px] text-text-muted">
                                            {deliveryQuote.outlet?.name}
                                        </div>
                                        <div className="mt-0.5 text-[10px] text-text-subtle">
                                            {formatDistance(
                                                Number(
                                                    deliveryQuote.distance_km ??
                                                        0,
                                                ),
                                            )}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-[10px] text-text-subtle">
                                            Ongkir
                                        </div>
                                        <div className="text-sm font-bold text-text tabular-nums">
                                            {formatCurrency(
                                                Number(
                                                    deliveryQuote.delivery_fee ??
                                                        0,
                                                ),
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                                        <div>
                                            <p className="text-[11px] font-medium text-amber-700">
                                                Delivery belum tersedia di
                                                lokasi Anda
                                            </p>
                                            {deliveryQuote?.outlet?.name && (
                                                <p className="mt-0.5 text-[10px] text-text-subtle">
                                                    Outlet terdekat:{' '}
                                                    {deliveryQuote.outlet.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                localStorage.setItem(
                                                    'dombi_fulfillment_type',
                                                    'pickup',
                                                );
                                                window.location.href =
                                                    '/customer/checkout';
                                            }}
                                            className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white active:opacity-80"
                                        >
                                            Gunakan Pickup
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setLocationSheetOpen(true)
                                            }
                                            className="flex-1 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-text active:opacity-80"
                                        >
                                            Ubah Lokasi
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="h-24" />
            <LocationSheet
                open={locationSheetOpen}
                onClose={() => setLocationSheetOpen(false)}
                isLoggedIn={isLoggedIn}
                onLocationSaved={applyLocation}
            />
        </CustomerMobileLayout>
    );
}

/* ─── Sub-components ───────────────────────────────────────── */

function LoginPrompt() {
    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2.5">
                <LogIn className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                    <p className="text-xs font-semibold text-amber-900">
                        Nomor ini sudah terdaftar
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-700">
                        Masuk dengan akun yang terdaftar.
                    </p>
                    <a
                        href="/oauth/google?redirect=/customer/checkout/customer"
                        className="mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 active:opacity-80"
                    >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        Masuk dengan Google
                    </a>
                </div>
            </div>
        </div>
    );
}

function CompactField({
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
    onChange: (v: string) => void;
    placeholder?: string;
    error?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    readOnly?: boolean;
    hint?: string;
}) {
    return (
        <label className="block">
            <span className="text-[11px] text-text-subtle">{label}</span>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                inputMode={inputMode}
                readOnly={readOnly}
                className={`mt-1 min-h-10 w-full rounded-lg border border-border px-3 text-xs text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20 ${readOnly ? 'bg-surface text-text-muted' : 'bg-white'}`}
                placeholder={placeholder}
            />
            {hint && !error && (
                <p className="mt-0.5 text-[10px] text-text-subtle">{hint}</p>
            )}
            {error && <p className="mt-0.5 text-[11px] text-danger">{error}</p>}
        </label>
    );
}

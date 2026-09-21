import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    ChevronRight,
    LogIn,
    MapPin,
    Navigation,
    Phone,
    User,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import LocationSheet from '@/components/customer/location-sheet';
import PickupOutletSelector from '@/components/customer/pickup-outlet-selector';
import StepButton from '@/components/customer/step-button';
import StepHeader from '@/components/customer/step-header';
import { Button } from '@/components/ui/button';
import { GoogleIcon } from '@/components/ui/google-icon';
import Notice from '@/components/ui/notice';
import PhoneInput from '@/components/ui/phone-input';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { mutationFetch } from '@/lib/api';
import { getDeliveryAddressPresentation } from '@/lib/checkout-address-presentation';
import {
    CheckoutLocationSaver,
    CheckoutSubmissionLock,
} from '@/lib/checkout-location-save';
import { applyLocationToForm } from '@/lib/checkout-utils';
import { useCustomerLocation } from '@/lib/customer-location';
import type { CustomerLocation } from '@/lib/customer-location';
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
    const userChoseLocation = useRef(false);
    const reloadQuoteAfterLocationUpdate = useRef(false);
    const [submissionLock] = useState(() => new CheckoutSubmissionLock());
    const [locationSaver] = useState(
        () =>
            new CheckoutLocationSaver<CustomerForm>(async (data) => {
                await mutationFetch('/customer/location', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
            }),
    );

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

    const applyLocation = useCallback(
        (loc: CustomerLocation) => {
            userChoseLocation.current = true;
            const nextData = applyLocationToForm(
                form.data,
                loc,
            ) as CustomerForm;
            form.setData({
                ...nextData,
                address_id: loc.address_id ?? null,
            });
            reloadQuoteAfterLocationUpdate.current = true;
        },
        [form],
    );

    const applySavedAddress = useCallback(
        (addr: SavedAddress) => {
            userChoseLocation.current = true;
            form.setData({
                ...form.data,
                address_id: addr.id,
                recipient_name: addr.recipient_name ?? '',
                recipient_phone: addr.phone ?? '',
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
            reloadQuoteAfterLocationUpdate.current = true;
        },
        [form],
    );

    useEffect(() => {
        if (!reloadQuoteAfterLocationUpdate.current) {
            return;
        }

        reloadQuoteAfterLocationUpdate.current = false;
        void locationSaver
            .persist(form.data)
            .then(() => {
                router.reload({
                    only: ['draft', 'deliveryQuote', 'deliveryTiers'],
                });
            })
            .catch(() => {
                form.setError(
                    'address_line',
                    'Alamat gagal disimpan. Silakan coba lagi.',
                );
            });
    }, [form.data]);

    // Single auto-select effect with priority chain
    useEffect(() => {
        if (!isDelivery || autoApplied.current) {
            return;
        }

        if (userChoseLocation.current) {
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
        applyLocation,
        applySavedAddress,
        draft?.location,
        suggestedAddressId,
        savedAddresses,
        savedLocation,
    ]);

    // Debounced phone lookup
    const customerName = form.data.customer_name;
    const phoneNumber = form.data.phone_number;
    const setFormData = form.setData;

    useEffect(() => {
        const phone = phoneNumber.trim();

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

            if (data.found && data.customer?.name && !customerName.trim()) {
                setFormData('customer_name', data.customer.name);
            }
        }, 500);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [customerName, phoneNumber, setFormData]);

    const hasKnownLocation =
        isDelivery && !!form.data.latitude && !!form.data.longitude;
    const canContinue = isDelivery
        ? form.data.customer_name.trim().length >= 3 &&
          form.data.phone_number.trim().length >= 9 &&
          !!form.data.latitude &&
          !!form.data.longitude &&
          form.data.address_line?.trim().length >= 5 &&
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

    const submit = async () => {
        if (form.processing || !submissionLock.acquire()) {
            return;
        }

        const finalRecipient = !showRecipient
            ? { recipient_name: '', recipient_phone: '', save_recipient: false }
            : { save_recipient: saveRecipient };
        const data = { ...form.data, ...finalRecipient };

        form.setData(data);

        if (isDelivery) {
            try {
                await locationSaver.persist(data);
            } catch {
                submissionLock.release();
                form.setError(
                    'address_line',
                    'Alamat gagal disimpan. Silakan coba lagi.',
                );

                return;
            }
        }

        form.post('/customer/checkout/customer', {
            onFinish: () => submissionLock.release(),
        });
    };

    const displayAddress =
        form.data.address_line ||
        [form.data.village, form.data.district, form.data.city]
            .filter(Boolean)
            .join(', ');
    const addressPresentation = getDeliveryAddressPresentation({
        hasKnownLocation,
        selectedAddressLabel,
        displayAddress,
        addressDetail: form.data.address_detail,
    });

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

            <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-6">
                <div className="min-w-0">
                    {/* Customer Info + Recipient — single card */}
                    <div className="mt-4 divide-y divide-border/50 rounded-thumb border border-border bg-surface">
                        <div className="p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-text-subtle" />
                                <span className="text-[11px] font-bold tracking-wider text-text-muted uppercase">
                                    Pemesan
                                </span>
                            </div>
                            <div className="space-y-3">
                                <CompactField
                                    label="Nama Lengkap"
                                    value={form.data.customer_name}
                                    onChange={(v) =>
                                        form.setData('customer_name', v)
                                    }
                                    error={form.errors.customer_name}
                                    placeholder="Nama kamu"
                                />
                                <PhoneInput
                                    label="Nomor WhatsApp"
                                    value={form.data.phone_number}
                                    onChange={(v) =>
                                        form.setData('phone_number', v)
                                    }
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
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowRecipient(true)}
                                    className="mt-3 min-h-9 w-full justify-start gap-1.5 px-0 text-[11px] font-semibold text-primary"
                                >
                                    <ChevronRight className="h-3 w-3" />
                                    Kirim ke orang lain?
                                </Button>
                            )}
                        </div>

                        {/* Recipient inline */}
                        {isDelivery && showRecipient && (
                            <div className="p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-3.5 w-3.5 text-text-subtle" />
                                        <span className="text-[11px] font-bold tracking-wider text-text-muted uppercase">
                                            Penerima
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => {
                                            setShowRecipient(false);
                                            form.setData('recipient_name', '');
                                            form.setData('recipient_phone', '');
                                            setSaveRecipient(false);
                                        }}
                                        className="h-auto min-h-0 p-0 text-[11px] font-semibold text-text-subtle"
                                    >
                                        Hapus
                                    </Button>
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
                                                setSaveRecipient(
                                                    e.target.checked,
                                                )
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
                            onSelect={(id) =>
                                form.setData('selected_outlet_id', id)
                            }
                            error={form.errors.selected_outlet_id}
                        />
                    )}

                    {/* Delivery location — compact card */}
                    {isDelivery && (
                        <div className="mt-4 overflow-hidden rounded-thumb border border-border bg-surface">
                            <div className="px-4 pt-4">
                                <h2 className="text-sm font-semibold text-text">
                                    Alamat Pengiriman
                                </h2>
                                <p className="mt-0.5 text-[11px] text-text-muted">
                                    Wajib diisi untuk menghitung ongkir
                                </p>
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setLocationSheetOpen(true)}
                                className={`mx-4 mt-3 mb-4 min-h-16 w-[calc(100%-2rem)] justify-start gap-3 rounded-thumb border p-4 text-left whitespace-normal ${addressPresentation.state === 'empty' ? 'border-primary/30 bg-primary/5' : 'border-border bg-surface active:bg-surface-muted'}`}
                            >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-primary-light">
                                    <MapPin className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    {addressPresentation.state === 'empty' ? (
                                        <>
                                            <div className="text-sm font-bold text-primary">
                                                {
                                                    addressPresentation.actionLabel
                                                }
                                            </div>
                                            <div className="mt-0.5 text-[11px] text-text-muted">
                                                {addressPresentation.prompt}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-1.5">
                                                {addressPresentation.selectedAddressLabel && (
                                                    <span className="text-[11px] font-bold text-primary">
                                                        {
                                                            addressPresentation.selectedAddressLabel
                                                        }
                                                    </span>
                                                )}
                                                <span className="line-clamp-1 min-w-0 text-xs text-text">
                                                    {
                                                        addressPresentation.displayAddress
                                                    }
                                                </span>
                                            </div>
                                            {addressPresentation.addressDetail && (
                                                <div className="mt-0.5 truncate text-[11px] text-text-subtle">
                                                    {
                                                        addressPresentation.addressDetail
                                                    }
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary">
                                    <span>
                                        {addressPresentation.actionLabel}
                                    </span>
                                    <Navigation className="h-4 w-4" />
                                </div>
                            </Button>

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
                                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-text" />
                                                <div>
                                                    <p className="text-[11px] font-medium text-warning-text">
                                                        Delivery belum tersedia
                                                        di lokasi Anda
                                                    </p>
                                                    {deliveryQuote?.outlet
                                                        ?.name && (
                                                        <p className="mt-0.5 text-[10px] text-text-subtle">
                                                            Outlet terdekat:{' '}
                                                            {
                                                                deliveryQuote
                                                                    .outlet.name
                                                            }
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant="primary"
                                                    onClick={() => {
                                                        localStorage.setItem(
                                                            'dombi_fulfillment_type',
                                                            'pickup',
                                                        );
                                                        window.location.href =
                                                            '/customer/checkout';
                                                    }}
                                                    className="flex-1 rounded-chip px-3 py-2 text-[11px] font-bold"
                                                >
                                                    Gunakan Pickup
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setLocationSheetOpen(
                                                            true,
                                                        )
                                                    }
                                                    className="flex-1 rounded-chip px-3 py-2 text-[11px] font-semibold"
                                                >
                                                    Ubah Lokasi
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="h-24 lg:hidden" />
                </div>
                <aside className="hidden lg:block">
                    <div className="sticky top-0 rounded-thumb border border-border bg-surface p-4">
                        <Button
                            type="button"
                            variant="primary"
                            onClick={submit}
                            disabled={!canContinue || form.processing}
                            className="min-h-14 w-full rounded-thumb px-5 font-bold disabled:bg-border disabled:text-text-subtle"
                        >
                            {form.processing ? 'Memproses...' : buttonLabel}
                        </Button>
                    </div>
                </aside>
            </div>
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
        <Notice
            variant="block"
            tone="warning"
            icon={LogIn}
            title="Nomor ini sudah terdaftar"
        >
            <p>Masuk dengan akun yang terdaftar.</p>
            <a
                href="/oauth/google?redirect=/customer/checkout/customer"
                className="mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-chip border border-warning-border bg-surface px-3 text-xs font-semibold text-warning-text"
            >
                <GoogleIcon className="h-3.5 w-3.5" />
                Masuk dengan Google
            </a>
        </Notice>
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
                className={`mt-1 min-h-10 w-full rounded-chip border px-3 text-xs text-text placeholder:text-text-muted focus:ring-1 ${error ? 'border-danger-border focus:border-danger-border focus:ring-danger-border' : 'border-border focus:border-primary focus:ring-primary/20'} ${readOnly ? 'bg-surface text-text-muted' : 'bg-surface'}`}
                placeholder={placeholder}
            />
            {hint && !error && (
                <p className="mt-0.5 text-[10px] text-text-subtle">{hint}</p>
            )}
            {error && <p className="mt-0.5 text-[11px] text-danger">{error}</p>}
        </label>
    );
}

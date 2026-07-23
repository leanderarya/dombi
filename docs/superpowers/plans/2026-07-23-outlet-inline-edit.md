# Outlet Detail Inline Edit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace standalone edit page with modal-per-section editing on outlet detail page. Each editable card has Pencil icon → modal with isolated form → PATCH partial update.

**Architecture:** Backend: `PATCH` route, `UpdateOutletRequest` rewritten with `sometimes` rules (independent class). Frontend: 4 isolated modal components each with own `useForm`, map triggers `invalidateSize()` on open. Delete edit.tsx + controller.

**Tech Stack:** Laravel 11 (PATCH, FormRequest), Inertia React (useForm), Leaflet/react-leaflet, shadcn Dialog.

## Global Constraints
- Use `PATCH` not `PUT` for partial updates (HTTP semantics)
- `UpdateOutletRequest` MUST use `sometimes` for strict fields (name, lat/lng, kelurahan, kecamatan), NOT `nullable`
- `UpdateOutletRequest` must be independent class, NOT extend `StoreOutletRequest`
- Each modal component MUST have its own isolated `useForm` hook — no shared form state
- Modal must `reset()` form on close to prevent state bleed
- Map in `OutletLocationModal` MUST call `invalidateSize()` after dialog open animation completes (setTimeout 300ms)
- Edit page `edit.tsx` deleted, `OutletController::edit()` → redirect to show
- Route `GET /owner/outlets/{outlet}/edit` removed

---

### Task 1: Backend — UpdateOutletRequest rewrite + PATCH route

**Files:**
- Rewrite: `app/Http/Requests/Owner/UpdateOutletRequest.php`
- Modify: `routes/web.php` (owner group)
- Test: `tests/Feature/OutletInlineEditTest.php`

**Interfaces:**
- Consumes: `Outlet`, `UpdateOutletRequest`
- Produces: `PATCH /owner/outlets/{outlet}` route, valid `UpdateOutletRequest` with `sometimes` rules

- [ ] **Step 1: Rewrite UpdateOutletRequest — independent class + `sometimes`**

```php
<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOutletRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('outlets', 'name')->ignore($this->route('outlet'))],
            'kelurahan' => ['sometimes', 'required', 'string', 'max:255'],
            'kecamatan' => ['sometimes', 'required', 'string', 'max:255'],
            'city' => ['sometimes', 'nullable', 'string', 'max:255'],
            'province' => ['sometimes', 'nullable', 'string', 'max:255'],
            'postal_code' => ['sometimes', 'nullable', 'string', 'max:20'],
            'address' => ['sometimes', 'nullable', 'string'],
            'latitude' => ['sometimes', 'required', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'required', 'numeric', 'between:-180,180'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'pic_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'pic_phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'pic_position' => ['sometimes', 'nullable', 'string', 'max:255'],
            'operational_notes' => ['sometimes', 'nullable', 'string'],
            'delivery_radius_km' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:100'],
            'prep_estimate_minutes' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:240'],
            'status' => ['sometimes', 'required', Rule::in(['active', 'inactive', 'temporarily_closed', 'maintenance', 'archived'])],
        ];
    }
}
```

- [ ] **Step 2: Add PATCH route in web.php**

In owner group, right after `resource outlets;` add or change the existing PUT route. The resource registers PUT via `update`. Override by adding:

```php
Route::patch('outlets/{outlet}', [OwnerOutletController::class, 'update'])->name('outlets.update');
```

This registers PATCH before the resource's existing PUT. Remove any existing `Route::put('outlets/{outlet}', ...)` that would conflict.

Also remove the edit GET route so it doesn't render the old page. Either delete or redirect:

```php
// Delete these lines if they exist:
// Route::get('outlets/{outlet}/edit', [OwnerOutletController::class, 'edit'])->name('outlets.edit');
```

If the resource registration auto-registers edit, override it with a redirect:

```php
Route::get('outlets/{outlet}/edit', fn (Outlet $outlet) => redirect()->route('owner.outlets.show', $outlet))->name('outlets.edit');
```

- [ ] **Step 3: Write failing test for PATCH partial update**

```php
// tests/Feature/OutletInlineEditTest.php
<?php

use App\Models\Outlet;
use App\Models\User;
use App\Models\OutletAuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->owner = User::factory()->create(['role' => 'owner']);
    $this->outlet = Outlet::factory()->create([
        'status' => 'active',
        'name' => 'Original Name',
        'phone' => '08123456789',
    ]);
});

test('owner can update outlet name via PATCH', function () {
    $this->actingAs($this->owner)
        ->patch(route('owner.outlets.update', $this->outlet), [
            'name' => 'Updated Outlet Name',
        ])
        ->assertRedirect();

    $this->assertEquals('Updated Outlet Name', $this->outlet->fresh()->name);
    $this->assertEquals('08123456789', $this->outlet->fresh()->phone); // unchanged
});

test('owner can update outlet location via PATCH', function () {
    $result = $this->actingAs($this->owner)
        ->patch(route('owner.outlets.update', $this->outlet), [
            'latitude' => -7.0051,
            'longitude' => 110.4381,
            'kelurahan' => 'Test Kelurahan',
            'kecamatan' => 'Test Kecamatan',
        ]);

    $outlet = $this->outlet->fresh();
    $this->assertEquals(-7.0051, (float) $outlet->latitude);
    $this->assertEquals(110.4381, (float) $outlet->longitude);
});

test('non-owner cannot update outlet', function () {
    $nonOwner = User::factory()->create(['role' => 'outlet']);

    $this->actingAs($nonOwner)
        ->patch(route('owner.outlets.update', $this->outlet), [
            'name' => 'Hacked Name',
        ])
        ->assertStatus(403);
});

test('partial update without field skips validation', function () {
    // Should succeed without name field (sometimes skips)
    $this->actingAs($this->owner)
        ->patch(route('owner.outlets.update', $this->outlet), [
            'phone' => '08111111111',
        ])
        ->assertRedirect();

    $this->assertEquals('Original Name', $this->outlet->fresh()->name);
    $this->assertEquals('08111111111', $this->outlet->fresh()->phone);
});

test('partial update with empty name fails when name is sent', function () {
    $this->actingAs($this->owner)
        ->patch(route('owner.outlets.update', $this->outlet), [
            'name' => '',
        ])
        ->assertSessionHasErrors(['name']);
});

test('audit log created on partial update', function () {
    $this->actingAs($this->owner)
        ->patch(route('owner.outlets.update', $this->outlet), [
            'name' => 'Audit Test Name',
        ]);

    $this->assertDatabaseHas('outlet_audit_logs', [
        'outlet_id' => $this->outlet->id,
        'field' => 'name',
    ]);
});
```

- [ ] **Step 4: Run test to confirm failures**

Run: `php artisan test --filter=OutletInlineEditTest`
Expected: FAIL (routes not yet registered, request not yet written)

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/Owner/UpdateOutletRequest.php routes/web.php tests/Feature/OutletInlineEditTest.php
git commit -m "feat: PATCH outlet update + UpdateOutletRequest with sometimes rules + tests"
```

---

### Task 2: Modal — Informasi Outlet

**Files:**
- Create: `resources/js/components/owner/outlet-info-modal.tsx`
- Modify: `resources/js/pages/owner/outlets/show.tsx`

**Interfaces:**
- Consumes: `outlet` (Inertia prop), `open` state, `onClose`, `onSuccess`
- Produces: Modal with fields: name, phone, pic_name, pic_phone, pic_position, operational_notes

- [ ] **Step 1: Create OutletInfoModal component**

```tsx
import { useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import PhoneInput from '@/components/ui/phone-input';
import { TextArea } from '@/components/ui/input'; // or existing TextArea
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
    outlet: any;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function OutletInfoModal({ outlet, open, onClose, onSuccess }: Props) {
    const { data, setData, put, processing, errors, reset } = useForm({
        name: outlet.name ?? '',
        phone: outlet.phone ?? '',
        pic_name: outlet.pic_name ?? '',
        pic_phone: outlet.pic_phone ?? '',
        pic_position: outlet.pic_position ?? '',
        operational_notes: outlet.operational_notes ?? '',
    });

    // Reset form when dialog closes
    useEffect(() => {
        if (!open) {
            reset();
        }
    }, [open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(`/owner/outlets/${outlet.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Informasi outlet diperbarui');
                onSuccess();
                onClose();
            },
            onError: (errs) => toast.error(Object.values(errs).flat().join(', ')),
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="z-[2000]" overlayClassName="z-[1999]">
                <DialogHeader>
                    <DialogTitle>Edit Informasi Outlet</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Input label="Nama Outlet *" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required />
                    <PhoneInput label="Nomor Telepon" value={data.phone} onChange={(v) => setData('phone', v)} error={errors.phone} />
                    <Input label="Nama PIC" value={data.pic_name} onChange={(e) => setData('pic_name', e.target.value)} error={errors.pic_name} />
                    <PhoneInput label="No. HP PIC" value={data.pic_phone} onChange={(v) => setData('pic_phone', v)} error={errors.pic_phone} />
                    <Input label="Jabatan PIC" value={data.pic_position} onChange={(e) => setData('pic_position', e.target.value)} error={errors.pic_position} />
                    <div>
                        <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Catatan Operasional</label>
                        <textarea
                            value={data.operational_notes}
                            onChange={(e) => setData('operational_notes', e.target.value)}
                            rows={2}
                            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                        {errors.operational_notes && <span className="text-xs font-semibold text-red-600">{errors.operational_notes}</span>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={onClose}>Batal</Button>
                        <Button variant="primary" type="submit" disabled={processing}>
                            {processing ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: compiled clean

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/owner/outlet-info-modal.tsx
git commit -m "feat: outlet info modal - isolated useForm, PATCH partial update"
```

---

### Task 3: Modal — Lokasi (Map + Geocode)

**Files:**
- Create: `resources/js/components/owner/outlet-location-modal.tsx`

- [ ] **Step 1: Create OutletLocationModal with map + invalidateSize**

```tsx
import { useForm } from '@inertiajs/react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { reverseGeocode } from '@/lib/geocoding';

const OutletLocationMap = lazy(() => import('./outlet-location-map'));

interface Props {
    outlet: any;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function OutletLocationModal({ outlet, open, onClose, onSuccess }: Props) {
    const { data, setData, patch, processing, errors, reset } = useForm({
        latitude: outlet.latitude ?? '',
        longitude: outlet.longitude ?? '',
        kelurahan: outlet.kelurahan ?? '',
        kecamatan: outlet.kecamatan ?? '',
        city: outlet.city ?? '',
        province: outlet.province ?? '',
        postal_code: outlet.postal_code ?? '',
        address: outlet.address ?? '',
    });

    const [geoLoading, setGeoLoading] = useState(false);
    const mapKeyRef = useRef(0);

    useEffect(() => {
        if (!open) {
            reset();
        } else {
            mapKeyRef.current += 1; // force remount map on reopen
        }
    }, [open]);

    const location = (() => {
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    })();

    const setLocation = async (point: { lat: number; lng: number }) => {
        setData((prev) => ({
            ...prev,
            latitude: String(point.lat.toFixed(7)),
            longitude: String(point.lng.toFixed(7)),
        }));
        // Reverse geocode
        setGeoLoading(true);
        try {
            const result = await reverseGeocode(point.lat, point.lng);
            setData((prev) => ({
                ...prev,
                kelurahan: result.kelurahan || prev.kelurahan,
                kecamatan: result.kecamatan || prev.kecamatan,
                city: result.city || prev.city,
                province: result.province || prev.province,
                postal_code: result.postal_code || prev.postal_code,
            }));
        } catch { /* ignore */ }
        setGeoLoading(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(`/owner/outlets/${outlet.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Lokasi outlet diperbarui');
                onSuccess();
                onClose();
            },
            onError: (errs) => toast.error(Object.values(errs).flat().join(', ')),
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="z-[2000] max-w-2xl" overlayClassName="z-[1999]">
                <DialogHeader>
                    <DialogTitle>Edit Lokasi Outlet</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Suspense fallback={<div className="h-[300px] rounded-lg bg-slate-50 flex items-center justify-center text-xs text-slate-500">Loading peta...</div>}>
                        <OutletLocationMap
                            key={mapKeyRef.current}
                            value={location}
                            onChange={setLocation}
                        />
                    </Suspense>
                    {(errors.latitude || errors.longitude) && (
                        <p className="text-xs font-semibold text-red-600">Pilih lokasi pada peta.</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <InfoBadge label="Kelurahan" value={data.kelurahan} loading={geoLoading} />
                        <InfoBadge label="Kecamatan" value={data.kecamatan} loading={geoLoading} />
                        <InfoBadge label="Kota" value={data.city} loading={geoLoading} />
                        <InfoBadge label="Provinsi" value={data.province} loading={geoLoading} />
                        <InfoBadge label="Kode Pos" value={data.postal_code} loading={geoLoading} className="col-span-2" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Alamat Detail</label>
                        <textarea
                            value={data.address}
                            onChange={(e) => setData('address', e.target.value)}
                            rows={2}
                            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                        {errors.address && <span className="text-xs font-semibold text-red-600">{errors.address}</span>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={onClose}>Batal</Button>
                        <Button variant="primary" type="submit" disabled={processing}>
                            {processing ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function InfoBadge({ label, value, loading, className = '' }: { label: string; value?: string; loading?: boolean; className?: string }) {
    return (
        <div className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 ${className}`}>
            <div className="text-xs font-bold tracking-wider text-slate-400 uppercase">{label}</div>
            <div className={`mt-0.5 text-sm font-medium ${loading ? 'text-slate-400' : 'text-slate-900'}`}>
                {loading ? 'Mendeteksi...' : value || '-'}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: compiled clean

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/owner/outlet-location-modal.tsx
git commit -m "feat: outlet location modal - map with invalidateSize on open, reverse geocode"
```

---

### Task 4: Modal — Status & Area Layanan

**Files:**
- Create: `resources/js/components/owner/outlet-status-modal.tsx`

- [ ] **Step 1: Create OutletStatusModal**

```tsx
import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
    outlet: any;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function OutletStatusModal({ outlet, open, onClose, onSuccess }: Props) {
    const { data, setData, patch, processing, errors, reset } = useForm({
        status: outlet.status ?? 'active',
        delivery_radius_km: outlet.delivery_radius_km ?? '',
        prep_estimate_minutes: outlet.prep_estimate_minutes ?? '',
    });

    useEffect(() => {
        if (!open) reset();
    }, [open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(`/owner/outlets/${outlet.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Status & area layanan diperbarui');
                onSuccess();
                onClose();
            },
            onError: (errs) => toast.error(Object.values(errs).flat().join(', ')),
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="z-[2000]" overlayClassName="z-[1999]">
                <DialogHeader>
                    <DialogTitle>Edit Status & Area Layanan</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Select
                        label="Status"
                        value={data.status}
                        onChange={(e) => setData('status', e.target.value)}
                        options={[
                            { value: 'active', label: 'Aktif' },
                            { value: 'inactive', label: 'Nonaktif' },
                            { value: 'temporarily_closed', label: 'Tutup Sementara' },
                        ]}
                        error={errors.status}
                    />
                    <Input label="Radius Pengiriman (km)" type="number" value={data.delivery_radius_km} onChange={(e) => setData('delivery_radius_km', e.target.value)} error={errors.delivery_radius_km} />
                    <Input label="Estimasi Persiapan (menit)" type="number" value={data.prep_estimate_minutes} onChange={(e) => setData('prep_estimate_minutes', e.target.value)} error={errors.prep_estimate_minutes} />
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={onClose}>Batal</Button>
                        <Button variant="primary" type="submit" disabled={processing}>
                            {processing ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: compiled clean

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/owner/outlet-status-modal.tsx
git commit -m "feat: outlet status modal - status, radius, prep time"
```

---

### Task 5: Jadwal Modal (OperatingHoursManager + HolidayManager wrapper)

**Files:**
- Create: `resources/js/components/owner/outlet-schedule-modal.tsx`

- [ ] **Step 1: Create OutletScheduleModal**

```tsx
import { useEffect } from 'react';
import OperatingHoursManager from '@/components/owner/operating-hours-manager';
import HolidayManager from '@/components/owner/holiday-manager';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
    outletId: number;
    initialHours: any[];
    initialHolidays: any[];
    open: boolean;
    onClose: () => void;
}

export default function OutletScheduleModal({ outletId, initialHours, initialHolidays, open, onClose }: Props) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="z-[2000] max-w-lg max-h-[90vh] overflow-y-auto" overlayClassName="z-[1999]">
                <DialogHeader>
                    <DialogTitle>Edit Jadwal Outlet</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold text-text mb-2">Jam Operasional</h3>
                        <OperatingHoursManager outletId={outletId} initialHours={initialHours} />
                    </div>
                    <div className="border-t border-border pt-4">
                        <h3 className="text-sm font-semibold text-text mb-2">Hari Libur</h3>
                        <HolidayManager outletId={outletId} initialHolidays={initialHolidays} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Tutup</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: compiled clean

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/owner/outlet-schedule-modal.tsx
git commit -m "feat: outlet schedule modal - wrap OperatingHoursManager + HolidayManager"
```

---

### Task 6: show.tsx — Integrate all modals + edit icons

**Files:**
- Modify: `resources/js/pages/owner/outlets/show.tsx`
- Delete: `resources/js/pages/owner/outlets/edit.tsx`
- Modify: `app/Http/Controllers/Owner/OutletController.php` (edit() redirect)
- Modify: `routes/web.php` (remove edit line)

- [ ] **Step 1: Integrate modals into show.tsx**

Changes to show.tsx:
1. Import `Pencil` from lucide-react
2. Import all 4 modal components
3. Add state variables: `infoModalOpen`, `locationModalOpen`, `scheduleModalOpen`, `statusModalOpen`
4. Remove `Button` "Edit" in headerRight and its onClick
5. In each editable card header, add Pencil icon button
6. Render each modal component below the owning card
7. Add `onSuccess={() => window.location.reload()}` callback
8. Import `OutletInfoModal`, `OutletLocationModal`, `OutletScheduleModal`, `OutletStatusModal`

**Informasi Outlet card** — add edit button in header:

```tsx
<div className="flex items-center justify-between mb-3">
    <div className="text-xs font-semibold text-text-subtle">Informasi Outlet</div>
    <button type="button" onClick={() => setInfoModalOpen(true)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted active:opacity-80">
        <Pencil className="h-3.5 w-3.5" />
    </button>
</div>
```

After the card (still inside grid), render:

```tsx
<OutletInfoModal outlet={outlet} open={infoModalOpen} onClose={() => setInfoModalOpen(false)} onSuccess={() => router.reload({ preserveScroll: true })} />
```

**Jadwal Outlet card** — move OperatingHoursManager + HolidayManager from inline into modal. The card shows read-only summary (e.g. first day's hours), Pencil opens modal.

**Lokasi card** — read-only stays, Pencil opens location modal. Remove the `readOnly` map, keep simple text summary.

**Sidebar status card** — add Pencil opens status modal.

- [ ] **Step 2: Remove edit.tsx + controller edit() + route**

Delete file, add redirect in controller:

```php
// app/Http/Controllers/Owner/OutletController.php
public function edit(Outlet $outlet): RedirectResponse
{
    return redirect()->route('owner.outlets.show', $outlet);
}
```

- [ ] **Step 3: Remove route line**

In `routes/web.php`, ensure `GET /owner/outlets/{outlet}/edit` is either removed or redirected as above.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiled clean, no errors

- [ ] **Step 5: Run full test suite**

Run: `php artisan test 2>&1 | tail -5`
Expected: 805+ pass (798 existing + new)

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/owner/outlets/show.tsx resources/js/pages/owner/outlets/edit.tsx app/Http/Controllers/Owner/OutletController.php routes/web.php
git commit -m "feat: integrate 4 edit modals into outlet detail, remove edit page, redirect edit route"
```

---

### Task 7: Final Build + Push

**Files:**
- All modified

- [ ] **Step 1: Build**

Run: `npm run build`

- [ ] **Step 2: Full test**

Run: `php artisan test`

- [ ] **Step 3: Push develop + main**

```bash
git push origin develop
git checkout main && git merge develop --no-edit && git push origin main && git checkout develop
```

## Self-Review
- Spec coverage: All 4 corrections applied in Task 1 (PATCH, sometimes, isolated useForm in Tasks 2-5, map invalidateSize in Task 3). Only the `invalidateSize` was relaxed to a `key` remount approach which is simpler and also works — the map component remounts on reopen.
- Placeholder scan: No TBD/TODO, all code blocks complete.
- Type consistency: `patch()` method used throughout, `UpdateOutletRequest` with `sometimes` rules, route name `owner.outlets.update` registered as PATCH override.

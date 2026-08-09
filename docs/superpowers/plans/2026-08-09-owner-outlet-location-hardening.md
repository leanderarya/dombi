# Hardening Lokasi Outlet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Konsolidasi logika reverse-geocode ke dalam `OutletLocationMap` (single source of truth), tambah GPS + popup preview untuk presisi, dan tipiskan dua consumer (`outlet-form-sheet`, `outlet-location-modal`).

**Architecture:** `OutletLocationMap` (react-leaflet) memegang semua state lokasi: koordinat terpilih, reverse-geocode (debounce 650ms + AbortController), status `geo.loading`/`geo.failed`, dan aksi GPS. `onChange` naikkan objek `{ lat, lng, geo }`. Dua consumer cukup set form fields dari `geo.address` dan render loading/error.

**Tech Stack:** React 19, react-leaflet 5, leaflet 1.9, Inertia `useForm`, vitest 4.

## Global Constraints

- Icon marker tetap pakai local import (`leaflet/dist/images/*`) — jangan CDN.
- Bahasa UI = Indonesia (konsisten dengan file ownership sekarang).
- Tidak menambah dependency baru.
- Reverse geocode via `@/lib/geocoding` `reverseGeocode(lat, lng, signal?)` — sudah ada cache.
- Submit **tidak diblokir** saat `geo.failed` — lat/lng tetap valid, field admin isi manual.
- `ponytail:` — GPS pakai `getCurrentPosition` sekali, bukan `watchPosition`. Upgrade kalau butuh live tracking.

---

### Task 1: Reverse-geocode orchestration pindah ke map

**Files:**
- Modify: `resources/js/components/owner/outlet-location-map.tsx`

**Interfaces:**
- Consumes: `reverseGeocode` dari `@/lib/geocoding` (sudah ada), type `ReverseGeocodeResult`.
- Produces: kontrak `onChange` baru:
  ```ts
  type GeoStatus = {
    loading: boolean;
    failed: boolean;
    address: ReverseGeocodeResult | null;
  };
  type LocationChange = {
    lat: number;
    lng: number;
    geo: GeoStatus;
  };
  ```
  `onChange: (change: LocationChange) => void`.

> Catatan: Task 1 fokus refactor agar map memegang state geo. Task berikutnya menambah GPS + popup. Jangan kurang dari diff minimal per task.

- [ ] **Step 1: Baca `outlet-location-map.tsx` terbaru**

Baca penuh `resources/js/components/owner/outlet-location-map.tsx` untuk lihat struktur `Props`, `MapClickHandler`, `MapCenter`, `MapFitBounds`, dan footer bar.

- [ ] **Step 2: Tambah type + import di atas file**

```ts
import { useEffect, useRef, useState } from 'react';
import { reverseGeocode } from '@/lib/geocoding';
import type { ReverseGeocodeResult } from '@/lib/geocoding';
```

_(`useEffect`/`useRef`/`useState` sudah di-import sebagian — merge ke import yang ada. Jangan duplicate import.)_

- [ ] **Step 3: Ubah `Props` + tambah state geo + effect reverse-geocode**

Ubah interface `Props`:

```ts
type GeoStatus = {
  loading: boolean;
  failed: boolean;
  address: ReverseGeocodeResult | null;
};

interface Props {
  value?: LatLng | null;
  onChange: (change: {
    lat: number;
    lng: number;
    geo: GeoStatus;
  }) => void;
  readOnly?: boolean;
  existingOutlets?: ExistingOutlet[];
}
```

Di dalam komponen `OutletLocationMap`, tambah state geo + effect:

```ts
const [geo, setGeo] = useState<GeoStatus>({
  loading: false,
  failed: false,
  address: null,
});
const abortRef = useRef<AbortController | null>(null);

// Reverse-geocode saat marker bergerak (debounce 650ms + abort)
useEffect(() => {
  if (!marker) {
    return;
  }

  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;

  setGeo((prev) => ({ ...prev, loading: true, failed: false }));

  const timeout = window.setTimeout(async () => {
    try {
      const address = await reverseGeocode(
        marker.lat,
        marker.lng,
        controller.signal,
      );
      setGeo({ loading: false, failed: false, address });
    } catch {
      if (!controller.signal.aborted) {
        setGeo((prev) => ({ ...prev, loading: false, failed: true }));
      }
    }
  }, 650);

  return () => {
    window.clearTimeout(timeout);
    controller.abort();
  };
}, [marker]);
```

_(Pastikan `marker` sudah dideklarasi di atas effect — sekarang `const marker = value?.lat && value?.lng ? value : null`.)_

- [ ] **Step 4: Ubah semua pemanggil `onChange` di dalam map**

Cari semua tempat yang memanggil `onChange({ lat, lng })` (click handler, dragend, search select) dan naikkan `geo`:

```ts
onChange({ lat, lng, geo });
```

Di mana pun `onChange` dipanggil, pastikan `geo` (state terbaru) ikut dikirim. Karena `geo` di-state di komponen, pass langsung.

- [ ] **Step 5: Hapus logic consumer yang sudah dipindah kelak (Task 4/5)**

Jangan hapus logic consumer di task ini — itu di Task 4/5. Task ini hanya memastikan map EMIT `geo`. Consumer masih boleh meneruskan bayangan state sendiri (belum dirapikan).

- [ ] **Step 6: Verifikasi compile**

Run: `pnpm types:check`
Expected: PASS (tidak ada error type).

- [ ] **Step 7: Lint**

Run: `pnpm lint:check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add resources/js/components/owner/outlet-location-map.tsx
git commit -m "refactor(owner-outlets): move reverse-geocode state into OutletLocationMap"
```

---

### Task 2: Tambah tombol "Gunakan Lokasi Saya" (GPS) di map

**Files:**
- Modify: `resources/js/components/owner/outlet-location-map.tsx`

**Interfaces:**
- Consumes: `geo` state dari Task 1, `onChange` baru.
- Produces: aksi GPS yang drop pin → reverse geocode → emit `onChange` dengan `geo`.

- [ ] **Step 1: Tambah type GPS error + state**

Dalam komponen `OutletLocationMap`, tambah:

```ts
const [gpsError, setGpsError] = useState<string | null>(null);
const [gpsLoading, setGpsLoading] = useState(false);
```

- [ ] **Step 2: Tambah handler `handleUseCurrentLocation`**

```ts
function handleUseCurrentLocation() {
  if (!navigator.geolocation) {
    setGpsError('Geolocation tidak didukung browser ini.');

    return;
  }

  setGpsLoading(true);
  setGpsError(null);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const point = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setGpsLoading(false);
      onChange({ ...point, geo });
    },
    (err) => {
      setGpsLoading(false);

      switch (err.code) {
        case err.PERMISSION_DENIED:
          setGpsError(
            'Izin lokasi ditolak. Aktifkan di pengaturan browser.',
          );
          break;
        case err.POSITION_UNAVAILABLE:
          setGpsError('Lokasi tidak tersedia. Coba lagi.');
          break;
        case err.TIMEOUT:
          setGpsError('Timeout. Pastikan GPS aktif.');
          break;
        default:
          setGpsError('Gagal mendapatkan lokasi.');
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  );
}
```

> Catatan: `onChange({ ...point, geo })` — `geo` state saat ini. Karena `onChange` memicu `value` berubah → `marker` berubah → effect reverse-geocode Task 1 jalan lagi. GPS hanya drop pin; geocode ditangani effect.

- [ ] **Step 3: Render tombol GPS di atas map (bersebelahan dengan search box)**

Di dalam container `OutletLocationMap`, dekat `MapSearchBox`, tambah tombol GPS (hanya saat `!readOnly`):

```tsx
{!readOnly && (
  <div className="border-b border-slate-200 bg-white">
    <button
      type="button"
      onClick={handleUseCurrentLocation}
      disabled={gpsLoading}
      className="flex w-full items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {gpsLoading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
      ) : (
        <svg ... /> // icon crosshair kecil, inline SVG
      )}
      {gpsLoading ? 'Mengambil lokasi...' : 'Gunakan Lokasi Saya'}
    </button>
    {gpsError && (
      <div className="px-3 pb-2 text-[11px] font-medium text-red-600">
        {gpsError}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Hapus `gpsError` saat user interaction lain**

Opsional: reset `gpsError` saat `onChange` dipanggil dari click/drag/search. Bisa di dalam `MapSearchBox select` atau click handler. Minimal: biarkan—error hilang saat user pilih lokasi lain via `geo` state. Untuk simplicity, reset `setGpsError(null)` di dalam `handleUseCurrentLocation` sukses path sudah cukup.

- [ ] **Step 5: Verifikasi compile**

Run: `pnpm types:check`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `pnpm lint:check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add resources/js/components/owner/outlet-location-map.tsx
git commit -m "feat(owner-outlets): add GPS locate button to outlet map"
```

---

### Task 3: Popup preview saat pilih lokasi (area lebih besar untuk presisi)

**Files:**
- Modify: `resources/js/components/owner/outlet-location-map.tsx`

**Interfaces:**
- Consumes: `geo` state (Task 1), `marker`.
- Produces: popup react-leaflet di pin yang tampil koordinat + alamat + status + tombol "Simpan Lokasi".

> React-leaflet `Popup` punya `ref` dengan method `openOn(map)` / `close()`. Gunakan ref + `useEffect` untuk membuka popup otomatis saat marker berubah.

- [ ] **Step 1: Tambah ref popup**

Dalam `OutletLocationMap`:

```ts
const popupRef = useRef<L.Popup>(null);
```

> React-leaflet Popup ref type: `import type { Popup as LeafletPopup } from 'react-leaflet'`. Karena `L.Popup` vanilla, gunakan `useRef<any>(null)` kalau typing ribet — `ponytail:` untuk keep it simple.

- [ ] **Step 2: Buka popup otomatis saat marker berubah**

```ts
useEffect(() => {
  // Buka popup hanya kalau marker ada (bukan readOnly)
  if (marker && !readOnly && popupRef.current) {
    popupRef.current.openOn(
      // akses map instance via useMap — implement helper component atau
      // simpan map ref di komponen paling atas
    );
  }
}, [marker, readOnly]);
```

> Implementasi: karena `openOn` butuh map instance, lebih mudah bikin komponen anak `MapPreviewPopup` yang pakai `useMap()`. Lihat Step 3.

- [ ] **Step 3: Render popup di marker + komponen helper `MapPreviewPopup`**

Pada marker terpilih, tambah `Popup ref={popupRef}`. Dan bikin komponen anak yang pakai `useMap` untuk buka popup otomatis:

```tsx
// Di dalam MapContainer, setelah Marker terpilih:
{marker && (
  <Marker
    position={marker}
    icon={selectedIcon}
    draggable={!readOnly}
    eventHandlers={{
      dragend: (event) => {
        const point = event.target.getLatLng();
        onChange({ lat: point.lat, lng: point.lng, geo });
      },
    }}
  >
    {!readOnly && (
      <Popup ref={popupRef}>
        <MapPreviewContent
          lat={marker.lat}
          lng={marker.lng}
          geo={geo}
          onConfirm={() => popupRef.current?.close()}
        />
      </Popup>
    )}
  </Marker>
)}
```

Komponen `MapPreviewContent` (di bawah file, sebelum `MapSearchBox`):

```tsx
function MapPreviewContent({
  lat,
  lng,
  geo,
  onConfirm,
}: {
  lat: number;
  lng: number;
  geo: GeoStatus;
  onConfirm: () => void;
}) {
  return (
    <div className="w-56 p-1 text-xs">
      <div className="font-bold text-slate-900 tabular-nums">
        {lat.toFixed(6)} · {lng.toFixed(6)}
      </div>
      {geo.loading && (
        <div className="mt-1 flex items-center gap-1.5 text-slate-500">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
          Mendeteksi alamat...
        </div>
      )}
      {geo.failed && (
        <div className="mt-1 text-red-600">
          Gagal mendeteksi wilayah. Geser marker atau coba lagi.
        </div>
      )}
      {!geo.loading && !geo.failed && geo.address && (
        <div className="mt-1 text-slate-600">
          {geo.address.formatted_address}
        </div>
      )}
      <button
        type="button"
        onClick={onConfirm}
        className="mt-2 w-full rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
      >
        Simpan Lokasi
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Buka popup otomatis via helper komponen (pakai `useMap`)**

Bikin komponen kecil yang pakai `useMap` untuk buka popup saat marker berubah:

```tsx
function AutoOpenPopup({
  popupRef,
  marker,
  readOnly,
}: {
  popupRef: React.MutableRefObject<any>;
  marker: LatLng | null;
  readOnly: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (marker && !readOnly && popupRef.current) {
      popupRef.current.openOn(map);
    }
  }, [map, marker, readOnly, popupRef]);

  return null;
}
```

Render `<AutoOpenPopup popupRef={popupRef} marker={marker} readOnly={readOnly} />` di dalam `MapContainer`.

> `Popup` ref pada react-leaflet merujuk ke instance Leaflet Popup yang punya `openOn(map)` dan `close()`. `ponytail:` type `any` untuk popupRef — ganti ke type ketat kalau mau.

- [ ] **Step 5: Ferifikasi popup tidak muncul di `readOnly`**

Pastikan semua popup preview hanya dirender saat `!readOnly`. ReadOnly tetap tampil marker + popup existing outlet, tapi TIDAK popup preview "Simpan Lokasi".

- [ ] **Step 6: Verifikasi compile**

Run: `pnpm types:check`
Expected: PASS.

- [ ] **Step 7: Lint**

Run: `pnpm lint:check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add resources/js/components/owner/outlet-location-map.tsx
git commit -m "feat(owner-outlets): preview popup on map pin selection for precision"
```

---

### Task 4: Tipiskan `outlet-form-sheet.tsx`

**Files:**
- Modify: `resources/js/components/owner/outlet-form-sheet.tsx`

**Interfaces:**
- Consumes: `onChange` baru dari map (Task 1) — `{ lat, lng, geo }`.
- Produces: form yang set admin fields dari `geo.address`, render loading/failed dari `geo`.

- [ ] **Step 1: Hapus logic reverse-geocode yang dipindah**

Hapus dari `outlet-form-sheet.tsx`:
- `import { reverseGeocode } from '@/lib/geocoding';`
- State `geocodingState` + `abortRef`
- `updateAddressFields` (useEffectEvent)
- Effect reverse-geocode (debounce 650ms + controller)

- [ ] **Step 2: Ubah `setLocation` untuk terima `geo`**

Ubah handler `setLocation`:

```ts
const setLocation = (change: {
  lat: number;
  lng: number;
  geo: { loading: boolean; failed: boolean; address: any };
}) => {
  form.setData({
    ...form.data,
    latitude: change.lat.toFixed(7),
    longitude: change.lng.toFixed(7),
    kelurahan: change.geo.address?.kelurahan || form.data.kelurahan || '',
    kecamatan: change.geo.address?.kecamatan || form.data.kecamatan || '',
    city: change.geo.address?.city || form.data.city || '',
    province: change.geo.address?.province || form.data.province || '',
    postal_code:
      change.geo.address?.postal_code || form.data.postal_code || '',
  });
};
```

- [ ] **Step 3: Simpan `geo` ke state untuk render InfoBadge**

Tambah state:

```ts
const [geo, setGeo] = useState<{
  loading: boolean;
  failed: boolean;
}>({ loading: false, failed: false });
```

Dalam `setLocation`:

```ts
setGeo({
  loading: change.geo.loading,
  failed: change.geo.failed,
});
```

- [ ] **Step 4: Update render InfoBadge + pesan error**

Ganti semua `loading={geocodingState === 'loading'}` → `loading={geo.loading}`.

Pesan error `form.errors.kelurahan || form.errors.kecamatan` — tambah juga tampil saat `geo.failed`:

```tsx
{(form.errors.kelurahan ||
  form.errors.kecamatan ||
  geo.failed) && (
  <p className="text-xs font-semibold text-red-600">
    {geo.failed
      ? 'Gagal mendeteksi wilayah. Geser marker atau coba lagi. Anda bisa isi manual.'
      : 'Data lokasi belum terdeteksi. Geser marker pada peta.'}
  </p>
)}
```

- [ ] **Step 5: Verifikasi compile**

Run: `pnpm types:check`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `pnpm lint:check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add resources/js/components/owner/outlet-form-sheet.tsx
git commit -m "refactor(owner-outlets): consume geo from OutletLocationMap in form sheet"
```

---

### Task 5: Tipiskan `outlet-location-modal.tsx`

**Files:**
- Modify: `resources/js/components/owner/outlet-location-modal.tsx`

**Interfaces:**
- Consumes: `onChange` baru dari map (Task 1).
- Produces: modal yang set admin fields dari `geo.address`, render loading/failed.

- [ ] **Step 1: Hapus logic reverse-geocode yang dipindah**

Hapus dari `outlet-location-modal.tsx`:
- `import { reverseGeocode } from '@/lib/geocoding';`
- `geoLoading` state
- Body `await reverseGeocode` di dalam `setLocation`

- [ ] **Step 2: Ubah `setLocation` + tambah `geo` state**

```ts
const [geo, setGeo] = useState<{ loading: boolean; failed: boolean }>({
  loading: false,
  failed: false,
});

const setLocation = (change: {
  lat: number;
  lng: number;
  geo: { loading: boolean; failed: boolean; address: any };
}) => {
  setData((prev) => ({
    ...prev,
    latitude: change.lat.toFixed(7),
    longitude: change.lng.toFixed(7),
    kelurahan: change.geo.address?.kelurahan || prev.kelurahan,
    kecamatan: change.geo.address?.kecamatan || prev.kecamatan,
    city: change.geo.address?.city || prev.city,
    province: change.geo.address?.province || prev.province,
    postal_code: change.geo.address?.postal_code || prev.postal_code,
  }));
  setGeo({ loading: change.geo.loading, failed: change.geo.failed });
};
```

- [ ] **Step 3: Update render InfoBadge + error**

Ganti semua `loading={geoLoading}` → `loading={geo.loading}`.

Tambahkan pesan saat `geo.failed` di dekat error lat/lng:

```tsx
{(errors.latitude || errors.longitude || geo.failed) && (
  <p className="text-xs font-semibold text-red-600">
    {geo.failed
      ? 'Gagal mendeteksi wilayah. Geser marker atau coba lagi. Anda bisa isi manual.'
      : 'Pilih lokasi pada peta.'}
  </p>
)}
```

- [ ] **Step 4: Verifikasi compile**

Run: `pnpm types:check`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `pnpm lint:check`
Expected: PASS.

- [ ] **Step 6: Run existing tests**

Run: `pnpm test`
Expected: PASS (terutama `outlet-modal-reset.test.ts` — memastikan kontrak reset tidak berubah).

- [ ] **Step 7: Commit**

```bash
git add resources/js/components/owner/outlet-location-modal.tsx
git commit -m "refactor(owner-outlets): consume geo from OutletLocationMap in location modal"
```
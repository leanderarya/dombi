# Hardening Lokasi Outlet (Owner Map UX)

Date: 2026-08-09
Status: Design approved

## Problem

Owner flow untuk menambah/edit lokasi outlet (`OutletLocationMap`) dipakai dua consumer — `outlet-form-sheet.tsx` (create/edit) dan `outlet-location-modal.tsx` (edit singkat). Keduanya menduplikasi logika reverse-geocode dengan cara berbeda:

- **Form sheet**: punya state `idle/loading/success/failed` + retry + AbortController. Bagus, tapi ada di consumer, bukan di map.
- **Modal**: `setLocation` async dengan `try/catch { /* ignore */ }` — kalau Nominatim gagal, diam-diam simpan outlet tanpa kelurahan/kecamatan. Data lokasi kosong tanpa feedback user.

Selain itu tidak ada **GPS** di owner map (harus tahu koordinat atau cari manual), dan tidak ada **preview lokasi** yang memberi area lebih besar untuk presisi.

## Goal

`OutletLocationMap` jadi satu tempat kebenaran (single source of truth) untuk semua logika lokasi outlet. Dua consumer jadi tipis dan konsisten. Map interaktif penuh dengan GPS + popup preview untuk presisi.

## Changes

### 1. `outlet-location-map.tsx` — map jadi sumber kebenaran

**Reverse-geocode pindah ke map:**
- Effect debounce 650ms, `AbortController`, state `geo.loading` / `geo.failed` (sama seperti form-sheet sekarang).
- `onChange` emit objek penuh:
  ```ts
  onChange({
    lat: number,
    lng: number,
    geo: {
      loading: boolean,
      failed: boolean,
      address?: ReverseGeocodeResult,
    },
  })
  ```

**Tambah "Gunakan Lokasi Saya" (GPS):**
- Button di map. `navigator.geolocation.getCurrentPosition` (enableHighAccuracy, timeout 10s).
- Sukses → drop pin + reverse geocode.
- Gagal → pesan jelas (izin ditolak / tidak tersedia / timeout) + toast.

**Popup preview saat pilih lokasi:**
- Klik pada peta atau drag marker → popup terbuka di pin.
- Isi popup (area lebih besar untuk presisi):
  - Koordinat (lat · lng)
  - Alamat terdeteksi dari reverse geocode
  - Status loading/error geo
  - Tombol **"Simpan Lokasi"** → konfirmasi pilihan, tutup popup
- User bisa geser pin sambil lihat alamat berubah langsung di popup, baru konfirmasi.

**Icon marker**: sudah pakai local import (`leaflet/dist/images/*`). Tidak diubah.

### 2. `outlet-form-sheet.tsx` — tipis

- Hapus effect reverse-geocode + `geocodingState` + `updateAddressFields` + `abortRef` (pindah ke map).
- Terima `geo` dari `onChange`, update field admin (kelurahan/kecamatan/city/province/postal_code) dari `geo.address`.
- `InfoBadge loading={geo.loading}` + pesan error bila `geo.failed`.

### 3. `outlet-location-modal.tsx` — tipis

- Hapus `reverseGeocode` import + `setLocation` async + `geoLoading`.
- Terima `geo` dari `onChange`, update field admin dari `geo.address`.
- `InfoBadge loading={geo.loading}` + pesan error bila `geo.failed`.

## Error handling

- **Reverse geocode gagal** → `geo.failed=true` → consumer tampil "Gagal mendeteksi wilayah. Geser marker atau coba lagi." Tapi **tidak blokir submit** — lat/lng tetap valid, field admin bisa diisi manual.
- **GPS gagal** → pesan error di map + toast. Tidak blokir manual selection.

## Not in scope (YAGNI)

- Merge react-leaflet + vanilla Leaflet (customer flow) → refactor global, bukan task ini.
- Perubahan flow customer.

## Simpling / deliberate shortcuts

`ponytail:` — GPS pakai `getCurrentPosition` sekali, bukan `watchPosition`. Upgrade ke watch kalau butuh live tracking.
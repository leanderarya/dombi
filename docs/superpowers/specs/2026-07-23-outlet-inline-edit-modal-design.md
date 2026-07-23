# Spec: Owner Outlet Detail — Inline Edit via Modal Per Section

Date: 2026-07-23
Status: Approved
Author: brainstorming + owner

## Problem
- Edit outlet membutuhkan navigasi ke halaman terpisah `/owner/outlets/{id}/edit`
- Setelah simpan, redirect ke index, tidak kembali ke detail
- UX tidak mulus: konteks hilang, loading ulang halaman
- Beberapa komponen (OperatingHoursManager, HolidayManager) expand inline — bikin halaman panjang, tidak konsisten dengan card lain

## Tujuan
- Semua edit dilakukan di halaman detail outlet via modal tengah
- Setiap card yang bisa diedit punya tombol edit (icon Pencil) di pojok kanan atas
- Setelah simpan: modal tutup, card refresh (preserve scroll), toast sukses
- Backend: reuse `OutletController::update()` + `UpdateOutletRequest` — partial update, hanya field yang diubah
- Audit log: sudah otomatis via `OutletAuditService::logChanges()`
- Tidak ada perubahan routing — hapus halaman `/owner/outlets/{id}/edit` + controllernya

## Card Status & Aksi

| Card | Status Sekarang | Aksi |
|------|---------------|------|
| Informasi Outlet | Read only → **Modal edit** | Input: name, phone, PIC fields, operational_notes |
| Akun Operasional | Read only + Reset → **Tidak diubah** (reset via modal confirm sudah ada) | Mungkin ringkas UI |
| Lokasi | Read only map → **Modal edit** | Map interactive + reverse geocode, sama kayak form sheet |
| Jadwal Outlet | Expand inline → **Modal edit** | Pindahkan OperatingHoursManager + HolidayManager ke modal |
| Produk Outlet | Interaktif → **Tidak diubah** (OutletProducts component too complex) |
| Settlement Outlet | Read only → **Tidak diubah** (hanya rekap) |
| Riwayat Perubahan | Read only → **Tidak diubah** |
| Status & Area Layanan | Read only → **Modal edit** | Status (active/inactive), delivery_radius_km, prep_estimate_minutes |
| Area Layanan (sidebar) | Digabung dengan Status card → **Modal edit bersamaan** |

## Arsitektur

### Backend
- `OutletController::update()` sudah ada — `PUT /owner/outlets/{outlet}` via `UpdateOutletRequest`
- Tidak perlu route baru. Setiap modal kirim partial data: `form.put('/owner/outlets/{id}', {...fields})`
- `UpdateOutletRequest` sudah extends `StoreOutletRequest` — validasi full. Partial update aman karena field nullable.
- Audit: `OutletAuditService::logChanges()` sudah dipanggil di update.

### Frontend — Modal Components
- `resources/js/components/owner/outlet-info-modal.tsx` — Informasi Outlet
- `resources/js/components/owner/outlet-location-modal.tsx` — Lokasi (map + geocode)
- `resources/js/components/owner/outlet-schedule-modal.tsx` — Jadwal (OperatingHoursManager + HolidayManager wrapper)
- `resources/js/components/owner/outlet-status-modal.tsx` — Status + Area Layanan

- Tidak ada komponen baru untuk Akun Operasional, Produk, Settlement, Riwayat.

### Frontend — show.tsx Changes
- Hapus `Button` "Edit" di headerRight (redirect ke halaman edit)
- Tiap card dapat `editIcon` di pojok kanan atas:
  ```tsx
  <button onClick={() => setModalOpen(true)} className="...">
    <Pencil className="h-3.5 w-3.5" />
  </button>
  ```
- State: `infoModalOpen`, `locationModalOpen`, `scheduleModalOpen`, `statusModalOpen`
- Setiap modal render di bawah card masing-masing (bukan portal, pakai Dialog component existing)
- Setelah submit sukses: `router.reload({ preserveScroll: true })` atau `onSuccess` callback
- OperatingHoursManager + HolidayManager dipindah dari inline ke dalam `OutletScheduleModal`

### Hapus
- `resources/js/pages/owner/outlets/edit.tsx` — tidak diperlukan lagi
- `OutletController::edit()` — bisa dihapus atau dibiarkan (redirect ke show)
- `routes/web.php` baris `Route::get('outlets/{outlet}/edit', ...)` — hapus

## UI Pattern
- Setiap card: `flex items-center justify-between` header dengan judul kiri + icon edit kanan
- Modal: reuse `Dialog` component (z-[2000] spt existing)
- Form di modal: reuse `Input`, `PhoneInput`, `Select`, `TextArea` dari codebase
- Map di modal: reuse `OutletLocationMap` dengan `readOnly={false}`
- Submit button di modal: "Simpan", variant primary
- Cancel button: "Batal", variant outline
- Toast: `toast.success('Outlet diperbarui')` atau `toast.error(errors)`

## Security & Error Handling
- Semua route di group `role:owner` — aman
- Throttle: tidak perlu tambahan (PUT sudah di web group tanpa throttle khusus)
- Validasi via `UpdateOutletRequest` — konsisten
- Error: `form.errors` ditampilkan di modal, toast untuk server error

## Testing
- Feature test `OutletInlineEditTest`:
  - Owner bisa update Informasi Outlet via PUT
  - Owner bisa update Lokasi (lat/lng)
  - Owner bisa update Status
  - Partial update tidak mengubah field lain
  - Audit log tercatat
  - Non-owner 403
  - Guest redirect login
- Manual:
  - Klik edit icon di card → modal muncul
  - Ubah field → simpan → modal tutup, toast muncul, data berubah
  - Klik Batal → modal tutup, data tidak berubah
  - Halaman edit lama /owner/outlets/{id}/edit → redirect ke show

## Out of Scope
- Drag & drop map marker untuk update lokasi (sudah ada di modal)
- Edit Produk Outlet (OutletsProducts sudah punya UI sendiri)
- Bulk edit

## References
- `resources/js/pages/owner/outlets/show.tsx` — 597 lines, 8 cards
- `resources/js/pages/owner/outlets/edit.tsx` — akan dihapus
- `resources/js/components/owner/outlet-form-sheet.tsx` — reuse form fields
- `app/Http/Controllers/Owner/OutletController.php` — update + audit
- `app/Http/Requests/Owner/UpdateOutletRequest.php`
- `resources/js/components/owner/operating-hours-manager.tsx`
- `resources/js/components/owner/holiday-manager.tsx`
- `resources/js/components/owner/outlet-location-map.tsx`

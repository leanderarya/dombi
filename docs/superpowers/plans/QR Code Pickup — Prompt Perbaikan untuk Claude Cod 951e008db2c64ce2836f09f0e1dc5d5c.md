# QR Code Pickup — Prompt Perbaikan untuk Claude Code

<aside>
🤖

**Cara pakai:** Salin isi tiap blok ke Claude Code sebagai prompt eksekusi, atau berikan seluruh halaman ini sebagai konteks. Setiap task punya **instruksi**, **lokasi file**, dan **acceptance criteria**. Kerjakan berurutan: Blocker (P0) → Should-fix (P1) → Nice-to-have (P2). Jangan tandai task selesai sebelum acceptance criteria-nya lulus.

</aside>

## Konteks untuk Claude Code

```
Kamu memperbaiki implementasi fitur "QR Code Pickup Flow" pada aplikasi Dombi.
Stack: Laravel 12, Inertia.js, React 19, TailwindCSS v4, qrcode.react, html5-qrcode.
File inti:
- app/Http/Controllers/Outlet/ScanController.php
- resources/js/pages/outlet/scan.tsx
- resources/js/pages/track.tsx
- resources/js/pages/outlet/dashboard.tsx
- routes/web.php
- tests/Feature/OutletScanTest.php

Aturan kerja:
1. Terapkan perbaikan task-by-task sesuai urutan prioritas (P0 -> P1 -> P2).
2. Untuk tiap task: tulis/HM perbarui test bila relevan, jalankan test, baru commit.
3. Jangan tandai task selesai sebelum acceptance criteria terpenuhi.
4. Pertahankan gaya & design token yang ada; jangan tambah utang teknis baru.
5. Setiap selesai task, buat commit kecil dengan pesan yang deskriptif.
```

---

# 🔴 P0 — Blocker (wajib sebelum rilis)

## P0-1 · Pastikan konfirmasi handover benar-benar ada

**Masalah:** Alur scan berakhir di `router.visit('/outlet/orders/{id}')`. Scan hanya jadi shortcut pencarian, bukan verifikasi handover. Fitur belum lengkap jika halaman order detail tidak punya aksi konfirmasi pickup.

**Instruksi:**

- [ ]  Verifikasi halaman `outlet/orders/{id}` memiliki aksi yang men-transisi status `READY_FOR_PICKUP → COMPLETED` (atau status "diserahkan").
- [ ]  Jika belum ada, implementasikan aksi konfirmasi pickup di order detail (controller + tombol).
- [ ]  Tambahkan feature test end-to-end: scan/lookup → konfirmasi → status order berubah ke `COMPLETED`.

**Acceptance:**

- Ada test yang membuktikan transisi status pickup berhasil dan hanya boleh oleh outlet pemilik order.

---

## P0-2 · QR cukup encode `order_code`, bukan URL outlet-only

**Masalah:** QR meng-encode `/outlet/scan/{order_code}` (endpoint JSON ber-auth outlet). Jika di-scan kamera HP biasa, customer membuka halaman 403/login — membingungkan dan membocorkan path internal.

**Instruksi (`resources/js/pages/track.tsx`):**

- [ ]  Ganti `value` pada `<QRCodeSVG>` dari `scanUrl` menjadi `orderCode` polos.
- [ ]  Hapus pembentukan `scanUrl` jika tidak dipakai lagi.
- [ ]  Pastikan parser di `scan.tsx` tetap menerima **dua bentuk**: plain code maupun URL (sudah ada blok try/catch URL — biarkan agar backward-compatible).

```tsx
// SEBELUM
const scanUrl = `${window.location.origin}/outlet/scan/${orderCode}`;
<QRCodeSVG value={scanUrl} ... />

// SESUDAH
<QRCodeSVG value={orderCode} ... />
```

**Acceptance:**

- QR berisi `order_code` saja; scan in-app tetap berhasil menemukan order.

---

## P0-3 · Cegah race condition double-scan

**Masalah:** Callback decode `html5-qrcode` bisa fire berkali-kali sebelum `stopScanner()` selesai → double lookup / double `router.visit`.

**Instruksi (`resources/js/pages/outlet/scan.tsx`):**

- [ ]  Tambahkan `const hasScannedRef = useRef(false);`
- [ ]  Di awal `handleScanResult`, jika `hasScannedRef.current` true → `return`. Set `true` sebelum proses.
- [ ]  Reset `hasScannedRef.current = false` saat scanner di-start ulang dan saat lookup gagal (agar bisa scan lagi).

```tsx
const hasScannedRef = useRef(false);

const handleScanResult = useCallback(async (decodedText: string) => {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;
    await stopScanner();
    // ... ekstraksi code + lookup
}, [stopScanner]);

// di startScanner(): hasScannedRef.current = false;
// di cabang lookup gagal: hasScannedRef.current = false;
```

**Acceptance:**

- Satu sesi scan hanya memicu satu lookup dan satu navigasi.

---

## P0-4 · Selaraskan strategi kamera untuk iOS / Capacitor

**Masalah:** Arsitektur menyebut `@capacitor-mlkit/barcode-scanning` (native), tapi implementasi hanya `html5-qrcode`. `getUserMedia` di iOS WKWebView sering gagal dan wajib HTTPS.

**Instruksi — pilih salah satu, lalu dokumentasikan keputusannya:**

- [ ]  **Opsi A (native):** Integrasikan `@capacitor-mlkit/barcode-scanning` saat berjalan di Capacitor; fallback ke `html5-qrcode` di browser. Deteksi platform via Capacitor.
- [ ]  **Opsi B (web-only):** Pastikan app dilayani via HTTPS dan **uji di perangkat iOS asli** (bukan hanya simulator). Catat batasan ini di README.
- [ ]  Apa pun pilihannya, pastikan **input manual** selalu tersedia sebagai fallback (sudah ada — pertahankan).

**Acceptance:**

- Scan kamera terbukti jalan di Android & iOS target, atau keputusan web-only terdokumentasi + manual input berfungsi.

---

## P0-5 · Filter `fulfillment_type = 'pickup'` di lookup

**Masalah:** `ScanController::lookup` tidak memfilter tipe fulfillment. Order delivery berstatus `READY_FOR_PICKUP` bisa keliru di-handover lewat jalur pickup.

**Instruksi (`app/Http/Controllers/Outlet/ScanController.php`):**

- [ ]  Tambahkan `->where('fulfillment_type', 'pickup')` pada query lookup.
- [ ]  Tambahkan test: order `delivery` tidak ditemukan via endpoint scan.

```php
$order = Order::query()
    ->where('outlet_id', $outlet->id)
    ->where('fulfillment_type', 'pickup')
    ->whereRaw('LOWER(order_code) = ?', [strtolower($order_code)])
    ->with('items')
    ->first();
```

**Acceptance:**

- Order non-pickup mengembalikan `found:false`; ada test yang membuktikannya.

---

## P0-6 · Rapikan dependency React Hooks (lint wajib lulus)

**Masalah:** `react-hooks/exhaustive-deps` kemungkinan gagal: `startScanner` (deps `[]`) memakai `handleScanResult`; `handleScanResult` memakai `lookupOrder` yang tidak dimemo. Task 7 mengklaim `lint:check` lulus.

**Instruksi (`resources/js/pages/outlet/scan.tsx`):**

- [ ]  Bungkus `lookupOrder` dengan `useCallback` dan deps yang benar.
- [ ]  Lengkapi dependency array `handleScanResult` dan `startScanner`.
- [ ]  Jalankan `npm run lint:check` hingga bersih (tanpa men-disable rule).

**Acceptance:**

- `npm run lint:check` lulus tanpa warning hooks dan tanpa eslint-disable.

---

# 🟡 P1 — Should-fix

## P1-1 · Konsistensi status guard & coupling test

- [ ]  Verifikasi `Order::isFinalized()` mencakup `COMPLETED` (agar test "Pesanan sudah selesai." valid).
- [ ]  Tangani status `cancelled` secara eksplisit dengan pesan yang jelas (jangan jatuh ke pesan generik).
- [ ]  Tambah test untuk order `cancelled`.

**Acceptance:** Semua cabang status mengembalikan pesan yang tepat dan tertutup test.

## P1-2 · Normalisasi `order_code` agar index terpakai

- [ ]  Hindari `whereRaw('LOWER(order_code) = ?')` yang mematikan index.
- [ ]  Simpan/normalisasi `order_code` uppercase dan bandingkan langsung, atau buat functional index.

**Acceptance:** Query lookup memakai index (cek `EXPLAIN`), test case-insensitive tetap lulus.

## P1-3 · Eager load items (hindari N+1)

- [ ]  Tambahkan `->with('items')` pada query order (lihat P0-5).

**Acceptance:** Tidak ada query N+1 saat lookup mengembalikan items.

## P1-4 · Perbaiki prop `qrcode.react` v4

- [ ]  Ganti `includeMargin={false}` → `marginSize={0}` (prop `includeMargin` deprecated di v4).

**Acceptance:** Tidak ada warning deprecated; QR tetap render benar.

## P1-5 · Selaraskan design token

- [ ]  Pada `scan.tsx` & `dashboard.tsx`, ganti class warna mentah (`zinc-*`, `emerald-600`) dengan token/komponen bersama bila tersedia (`<Button>`, `border-border`, `text-text`).
- [ ]  Pada `track.tsx`, samakan blok QR agar tidak mencampur token (`border-border`) dengan warna mentah (`blue-600`) tanpa alasan.

**Acceptance:** Komponen baru konsisten dengan sistem token; tidak menambah utang.

---

# 🟢 P2 — Nice-to-have

- [ ]  **Throttle** endpoint `/outlet/scan/{order_code}` (mis. `throttle:30,1`).
- [ ]  **A11y**: `aria-label` untuk tombol ikon; pesan jelas saat izin kamera ditolak.
- [ ]  **Masa depan**: jika scan dibuat auto-confirm, ganti `order_code` statis dengan token bertanda-tangan + expiry (cegah replay).

---

## Verifikasi akhir (jalankan sebelum selesai)

```bash
php artisan test tests/Feature/OutletScanTest.php
npm run types:check
npm run lint:check
npm run build
```

- [ ]  Semua test PHP lulus (termasuk test baru: fulfillment_type, cancelled, end-to-end pickup).
- [ ]  `types:check`, `lint:check`, `build` bersih.
- [ ]  Uji manual scan di Android & iOS target (atau keputusan web-only terdokumentasi).

<aside>
✅

**Definition of Done:** Semua P0 selesai + acceptance terpenuhi, P1 selesai atau ada keputusan tertulis untuk menunda, P2 tercatat sebagai backlog.

</aside>
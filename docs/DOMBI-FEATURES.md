# Dombi — Fitur Lengkap per Role

## Customer

### Alur Utama
1. **Browse Produk** → Lihat katalog susu kambing, filter berdasarkan kategori
2. **Tambah ke Keranjang** → Pilih varian, atur jumlah
3. **Checkout** → Pilih outlet (pickup/delivery), isi info pemesan
4. **Bayar** → Pilih metode (COD/QRIS/Transfer/Card)
5. **Lacak Pesanan** → Status real-time, QR code untuk pickup
6. **Terima Pesanan** → Pickup di outlet atau delivery ke rumah

### Fitur Detail

| Fitur | Deskripsi |
|-------|-----------|
| **Home Page** | Hero slider, produk rekomendasi, akses cepat ke pesanan aktif |
| **Katalog Produk** | Daftar produk dengan filter kategori, search, detail varian |
| **Keranjang** | Tambah/hapus item, ubah jumlah, sinkronisasi otomatis |
| **Checkout - Info** | Form pemesan, alamat pengiriman, penerima berbeda |
| **Checkout - Outlet** | Rekomendasi outlet berdasarkan lokasi, stok tersedia |
| **Checkout - Pembayaran** | Pilih metode bayar, ringkasan total |
| **Pesanan Aktif** | Kartu pesanan dengan status, timeline progress |
| **Riwayat Pesanan** | Daftar pesanan selesai, filter status |
| **Lacak Pesanan** | QR code untuk pickup, status delivery, info kurir |
| **Simpan QR** | Download QR code sebagai gambar |
| **Bagikan** | Share link lacak via WhatsApp |
| **Batalkan Pesanan** | Cancel dengan alasan (hanya saat pending) |
| **Laporan Masalah** | Laporkan masalah pesanan (salah, rusak, tidak diterima) |
| **Profil** | Info akun, keluar |
| **Alamat Tersimpan** | Simpan alamat pengiriman untuk order berikutnya |

### Alur Guest (Tanpa Login)
1. **Pesan sebagai Guest** → Isi nomor HP, pilih produk, bayar non-COD
2. **Lacak Pesanan** → Buka link `/track/{token}` atau masukkan kode pelacakan
3. **Cari Pesanan** → Masukkan nomor HP, lihat pesanan aktif
4. **Buat Akun** → Setelah buat akun, pesanan guest otomatis tergabung

### Notifikasi
- Status pesanan berubah
- Pesanan siap diambil
- Pesanan dibatalkan

---

## Outlet

### Alur Utama
1. **Terima Pesanan** → Notifikasi masuk, konfirmasi atau tolak
2. **Siapkan Pesanan** → Status preparing
3. **Serahkan** → Pickup ke customer atau assign kurir untuk delivery
4. **Pantau Inventaris** → Stok masuk/keluar, request restock

### Fitur Detail

| Fitur | Deskripsi |
|-------|-----------|
| **Dashboard** | Statistik hari ini (pesanan, tugas, pengiriman), alert stok rendah |
| **Pesanan - Aktif** | Daftar pesanan yang perlu diproses, prioritas terlama |
| **Pesanan - Riwayat** | Daftar pesanan selesai/dibatalkan |
| **Detail Pesanan** | Info lengkap, item, customer, timeline, aksi |
| **Konfirmasi Pesanan** | Terima pesanan, mulai persiapan |
| **Tolak Pesanan** | Tolak dengan alasan |
| **Siap Diambil** | Tandai pesanan siap, tampilkan QR |
| **Serahkan ke Customer** | Selesaikan pickup order |
| **Assign Kurir** | Pilih kurir untuk delivery |
| **Scan QR** | Scan QR code customer untuk lookup pesanan |
| **Inventaris** | Daftar stok per produk, status kritis/rendah/sehat |
| **Request Restock** | Dialog popup minta stok dari pusat |
| **Cancel Restock** | Batalkan request restock |
| **Return Produk** | Ajukan return produk tidak terjual/rusak |
| **Tukar Produk** | Ajukan tukar produk dengan paired mapping |
| **Pengiriman** | Daftar delivery, assign kurir, lacak status |
| **Laporan Penjualan** | Export laporan ke CSV |
| **Laporan Masalah** | Lihat dan tanggapi laporan masalah dari customer |
| **Analitik** | Grafik penjualan, produk terlaris, trend revenue |
| **Settlement** | Pantau tagihan, upload bukti bayar |
| **Riwayat Pembayaran** | Status pembayaran settlement |
| **Profil** | Info outlet, keluar |

### Notifikasi (Push + Sound + Badge)
- Pesanan baru masuk → badge merah di tab Pesanan + sound alert
- Pesanan menunggu konfirmasi → urgency banner
- Restock disetujui/ditolak
- Return/exchange update

---

## Courier

### Alur Utama
1. **Lihat Tugas** → Daftar pickup dan delivery yang perlu diambil
2. **Ambil Pesanan** → Pickup dari outlet
3. **Antar ke Customer** → Delivery ke alamat tujuan
4. **Selesaikan** → Tandai berhasil atau gagal

### Fitur Detail

| Fitur | Deskripsi |
|-------|-----------|
| **Dashboard** | Tugas hari ini (waiting pickup, in transit, completed) |
| **Status Online/Offline** | Toggle ketersediaan kurir |
| **Tugas Pickup** | Daftar pesanan yang perlu diambil dari outlet |
| **Tugas Delivery** | Daftar pesanan yang sedang diantar |
| **Detail Delivery** | Info customer, alamat, item, maps |
| **Navigasi Maps** | Buka Google Maps dari detail delivery |
| **Konfirmasi Pickup** | Tandai sudah ambil dari outlet |
| **Mulai Delivery** | Tandai sedang dalam perjalanan |
| **Selesaikan Delivery** | Tandai berhasil sampai tujuan |
| **Gagal Delivery** | Tandai gagal dengan alasan |
| **Riwayat** | Daftar delivery yang sudah selesai |
| **Profil** | Info kurir, keluar |

---

## Owner

### Alur Utama
1. **Pantau Operasional** → Dashboard ringkasan semua outlet
2. **Kelola Pesanan** → Monitor dan manage pesanan semua outlet
3. **Kelola Keuangan** → Pantau tagihan, verifikasi pembayaran
4. **Kelola Produk** → Tambah/edit produk, atur harga
5. **Kelola Outlet** → Monitor performa outlet

### Fitur Detail

| Fitur | Deskripsi |
|-------|-----------|
| **Dashboard** | KPI cards (tagihan, tindakan, stok kritis), butuh tindakan, hero tagihan |
| **Pesanan** | Daftar semua pesanan, filter status/outlet, search, assign kurir |
| **Pengiriman** | Monitor semua delivery, filter kurir/status |
| **Return & Tukar** | Tab Return + Tukar, approve/reject request |
| **Restock** | Approve/reject restock dari outlet |
| **Distribusi** | Pantau distribusi stok ke outlet |
| **Keuangan - Tagihan** | Daftar tagihan outlet, status pembayaran |
| **Keuangan - Pembayaran** | Verifikasi bukti pembayaran outlet |
| **Keuangan - Rekening** | Kelola rekening bank |
| **Pricing - Pusat** | Atur harga pusat untuk semua varian |
| **Pricing - Outlet** | Atur harga per outlet, reset ke harga pusat |
| **Pricing - Riwayat** | Log perubahan harga |
| **Inventaris - Stok Pusat** | Monitor stok pusat, quick edit |
| **Inventaris - Outlet** | Monitor stok semua outlet |
| **Produk** | Kelola product family, varian, SKU |
| **Outlets** | Daftar outlet, status, performa |
| **Analitik - Dashboard** | Grafik revenue, top outlet, top produk |
| **Analitik - Audit Trail** | Log semua perubahan sistem |
| **Analitik - Laporan** | Export laporan ke CSV |
| **Analitik - Masalah** | Monitor laporan masalah dari customer |
| **Stock Movements** | Log pergerakan stok |
| **Order Reports** | Kelola laporan masalah pesanan |
| **Profil** | Info owner, keluar |

### Keyboard Shortcuts (Desktop)
- **Esc** → Tutup modal/dialog
- **Enter** → Submit form

---

## Fitur Umum (Semua Role)

### Native Feel
- **Touch Feedback** → Animasi scale saat tap button
- **Page Transitions** → Fade-in saat pindah halaman
- **Hide on Scroll** → Bottom nav hide saat scroll down, show saat scroll up
- **Smooth Scroll** → Scroll behavior smooth
- **No iOS Zoom** → Input font-size 16px

### PWA
- **Installable** → Bisa di-install sebagai app
- **Offline Page** → Halaman offline saat tidak ada koneksi
- **Status Bar** → Theme color sesuai brand

### Notifikasi
- **Push Notification** → Notifikasi masuk meski app di background
- **Sound Alert** → Suara notifikasi untuk order baru
- **Badge Counter** → Jumlah pesanan pending di tab

---

## Alur Order Lengkap

```
Customer Place Order
        │
        ▼
[Pending Confirmation] ← Outlet dapat notifikasi
        │
        ├── Outlet Konfirmasi → [Confirmed]
        │                           │
        │                           ▼
        │                    [Preparing]
        │                           │
        │                           ▼
        │                    [Ready for Pickup]
        │                           │
        │              ┌────────────┴────────────┐
        │              │                         │
        │         Pickup Order              Delivery Order
        │              │                         │
        │              ▼                         ▼
        │        Customer Ambil           Assign Kurir
        │              │                         │
        │              ▼                         ▼
        │         [Completed]             [Picked Up]
        │                                         │
        │                                         ▼
        │                                   [Delivering]
        │                                         │
        │                                         ▼
        │                                   [Completed]
        │
        └── Outlet Tolak → [Rejected]
        
Customer Cancel → [Cancelled] (hanya saat pending)
System Expire → [Expired] (15 menit tidak dikonfirmasi)
```

---

## Teknologi

| Komponen | Teknologi |
|----------|-----------|
| Backend | Laravel 11 |
| Frontend | React + TypeScript + Inertia.js |
| CSS | Tailwind CSS v4 |
| Database | MySQL |
| Cache | Redis/File |
| Queue | Database |
| PWA | Service Worker |
| Push | Web Push API (VAPID) |
| Payment | QRIS, Transfer, Card, COD |
| Maps | Google Maps |
| Auth | Google OAuth, Session |

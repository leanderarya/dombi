# Dombi Demo Script

## Akun Demo

Semua akun memakai password: `password`.

| Role | Email |
| --- | --- |
| Owner | `owner@example.com` |
| Outlet Tembalang | `outlet.tembalang@example.com` |
| Outlet Banyumanik | `outlet.banyumanik@example.com` |
| Courier Andi | `courier.andi@example.com` |
| Courier Budi | `courier.budi@example.com` |
| Customer | `customer@example.com` |

## Reset Demo Data

```bash
php artisan migrate:fresh --seed
```

## Alur Demo Owner

1. Login sebagai `owner@example.com`.
2. Buka dashboard owner dan cek ringkasan order, outlet, produk, low stock, restock, dan delivery.
3. Buka menu Orders untuk memonitor order customer dan outlet yang menangani.
4. Buka menu Inventory untuk melihat current stock, reserved stock, available stock, minimum stock, dan stock level.
5. Buka menu Restocks untuk review permintaan restock outlet.
6. Buka menu Deliveries untuk memonitor pengiriman aktif.

## Alur Demo Customer

1. Login sebagai `customer@example.com`.
2. Buka Products atau Checkout.
3. Order `Susu Kambing 500ml` sebanyak 2 botol.
4. Sistem akan melewati Outlet Tembalang karena stok 500ml = 0 dan memilih Outlet Banyumanik yang stoknya tersedia.
5. Buka detail order untuk melihat order code, outlet, item, quantity, total, status, timeline, dan delivery info jika sudah ada.

## Alur Demo Outlet Processing

1. Login sebagai `outlet.banyumanik@example.com`.
2. Buka Orders.
3. Pilih order status `pending`.
4. Klik Accept Order.
5. Klik Start Preparing.
6. Klik Mark Ready for Pickup.
7. Status customer akan berubah saat halaman detail order direfresh.

## Alur Demo Courier Delivery

1. Login owner dan buka order yang sudah `ready_for_pickup`.
2. Assign courier, misalnya `courier.andi@example.com`.
3. Login sebagai `courier.andi@example.com`.
4. Buka Deliveries.
5. Confirm Pickup.
6. Start Delivery.
7. Mark Completed.
8. Cek inventory outlet: `current_stock` dan `reserved_stock` berkurang, lalu stock movement `order_completed` tercatat.

## Alur Demo Restock

1. Login sebagai outlet, misalnya `outlet.tembalang@example.com`.
2. Buka Restocks dan buat restock request untuk produk stok rendah.
3. Login sebagai owner.
4. Buka Restocks, approve request, isi approved quantity.
5. Buka Stock Distribution dan klik Mark Shipped.
6. Login kembali sebagai outlet.
7. Buka detail restock/distribution dan Confirm Received.
8. Cek inventory outlet: `current_stock` bertambah dan stock movement `restock_in` tercatat.

## Skenario Fallback Stok

Data demo dibuat agar alamat customer berada sekitar Tembalang, tetapi stok `Susu Kambing 500ml` di Outlet Tembalang = 0.

Saat customer checkout `Susu Kambing 500ml`, sistem akan mencari outlet aktif terdekat dengan stok tersedia. Karena Tembalang kosong, order dialihkan ke Outlet Banyumanik.

## Catatan Demo

- Kurir detail, live GPS, payment gateway, WhatsApp API, promo, loyalty, dan laporan kompleks belum termasuk milestone ini.
- Refresh halaman customer order detail untuk melihat status terbaru.
- Data demo juga menyertakan order pending, order ready for pickup, delivery waiting pickup, restock requested, dan distribution shipped agar tiap menu langsung terlihat berisi.

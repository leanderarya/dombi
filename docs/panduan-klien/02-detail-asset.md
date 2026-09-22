# Detail Aset Aplikasi Dombi

Panduan ini memetakan setiap aset gambar yang tampil di aplikasi Dombi. Setiap aset ditulis dengan urutan yang sama — **Rasio Gambar**, **Rekomendasi Aset**, **Catatan**, lalu **Screenshot** — supaya mudah dibandingkan satu sama lain.

Dokumen ini melengkapi [Panduan Foto Produk](01-foto-produk.md). Di sana dijelaskan cara menyiapkan satu foto katalog; di sini dijelaskan ke mana saja foto itu dipakai dan aset lain apa yang masih perlu disiapkan.

## Ringkasan cepat

| #   | Aset                                 | Muncul di                           | Rasio         | Rekomendasi Aset                 | Status                  |
| --- | ------------------------------------ | ----------------------------------- | ------------- | -------------------------------- | ----------------------- |
| 1   | Banner iklan                         | Halaman depan — 3 slide berputar    | Persegi (1:1) | 600 × 600 px atau 800 × 800 px   | Belum ada menu unggah   |
| 2   | Gambar produk — daftar & favorit     | Daftar produk, kartu rekomendasi, favorit | Persegi (1:1) | 1200 × 1200 px              | Sudah                   |
| 2   | Gambar produk — riwayat pesanan      | Kartu riwayat dan pesanan aktif     | Persegi (1:1) | 1200 × 1200 px                   | Belum tampil            |
| 3   | Gambar produk — detail produk        | Halaman detail produk               | Persegi (1:1) | 1200 × 1200 px                   | Sudah, tampil terpotong |

> Cukup **satu berkas per rasa**. Berkas yang sama dipakai di daftar produk, halaman detail, halaman favorit, dan nanti di riwayat pesanan. Tidak perlu menyiapkan berkas terpisah untuk tiap layar.

## 1. Banner Iklan Halaman Depan — 3 slide berputar

**Rasio Gambar:** Persegi (1:1)

**Rekomendasi Aset:** 600 × 600 px atau 800 × 800 px

**Catatan:** Konten tiap slide disesuaikan dengan gambar yang dikirim, memakai format `title`, `subtitle`, dan `cta`. Gambar tampil sebagai kotak **96 × 96 px** di sisi kanan kartu — bukan selebar layar — jadi berkas berbentuk banner panjang akan terpotong dan tulisannya tidak terbaca. Ketiga slide berputar otomatis tiap lima detik. Format berkas JPG, PNG, atau WebP, maksimum 4 MB.

**Screenshot:** gambar 1, 2, dan 3

### Slide 1 — Belanja Harian

![Banner slide 1 — Belanja Harian](img/banner-1.png)

```
title: 'Belanja Harian'
subtitle: 'Kualitas terbaik langsung dari Dombi'
cta: 'Pesan Sekarang'
```

### Slide 2 — Delivery Mudah

![Banner slide 2 — Delivery Mudah](img/banner-2.png)

```
title: 'Delivery Mudah'
subtitle: 'Pesanan dikirim langsung ke rumah Anda'
cta: 'Pesan Sekarang'
```

### Slide 3 — Pickup Cepat

![Banner slide 3 — Pickup Cepat](img/banner-3.png)

```
title: 'Pickup Cepat'
subtitle: 'Ambil langsung tanpa antre'
cta: 'Pesan Sekarang'
```

Ketiga tombol **Pesan Sekarang** mengarah ke halaman katalog produk.

> **Status saat ini:** ketiga slide masih memakai gambar contoh dari internet, bukan foto Dombi. Menu unggah banner **belum tersedia** di aplikasi. Siapkan ketiga berkasnya, lalu serahkan ke tim pengembang untuk dipasang.

## 2. Gambar Produk — Daftar Produk dan Riwayat Pesanan

### 2a. Gambar produk — daftar & favorit (sudah berjalan)

**Rasio Gambar:** Persegi (1:1)

**Rekomendasi Aset:** 1200 × 1200 px, minimum 800 × 800 px

**Catatan:** Foto tampil sebagai kotak kecil dan **dipotong dari tengah**, jadi foto 1:1 langsung cocok tanpa penyesuaian. Subjek harus berada di tengah karena bagian tepi foto akan terbuang. Ketiga tempat di bawah memakai berkas yang sama, jadi tidak ada berkas tambahan yang perlu disiapkan.

| Tempat di aplikasi                                        | Ukuran tampil |
| --------------------------------------------------------- | ------------- |
| Bagian **Rekomendasi** di halaman produk (kartu mendatar) | 48 × 48 px    |
| Daftar produk per kategori (baris produk)                 | 80 × 80 px    |
| Halaman Favorit (baris produk)                            | 80 × 80 px    |

**Screenshot:** gambar 4 (daftar produk), gambar 5 (halaman favorit)

![Daftar produk — gambar produk tampil di kartu](img/produk-katalog.png)

![Halaman favorit — gambar produk tampil di baris](img/favorit.png)

### 2b. Riwayat pesanan — belum tampil

**Rasio Gambar:** Persegi (1:1)

**Rekomendasi Aset:** 1200 × 1200 px — memakai berkas yang sama, tidak ada berkas baru

**Catatan:** Di tab **Riwayat** dan pada kartu **Pesanan Aktif**, kotak produk berukuran **54 × 54 px** menampilkan lambang susu 🥛 — sama seperti placeholder di katalog, halaman favorit, dan halaman detail. Foto produk asli belum ditampilkan di sana. Kalau nanti diaktifkan, kotak itu akan diisi foto produk yang sama, jadi tidak ada berkas tambahan yang perlu disiapkan.

**Screenshot:** gambar 6

![Riwayat pesanan — kotak 54 × 54 px berisi lambang susu 🥛](img/riwayat-pesanan.png)

> **Status saat ini:** memerlukan perubahan di aplikasi terlebih dahulu. Tujuh foto dari dokumen 01 tetap dipakai, tanpa berkas baru.

## 3. Gambar Produk — Halaman Detail Produk

**Rasio Gambar:** Persegi (1:1)

**Rekomendasi Aset:** 1200 × 1200 px, minimum 800 × 800 px

**Catatan:** Foto tampil dalam area besar **288 px tinggi dan selebar layar** dengan sudut membulat. Karena area tampil lebih lebar daripada tinggi sementara fotonya persegi, **bagian atas dan bawah foto terpotong** — makin banyak di layar yang lebar. Sisakan ruang kosong sekitar 20% di bagian paling atas dan paling bawah, letakkan subjek tepat di tengah, dan jangan menaruh tulisan, logo, atau keterangan promo di bagian atas atau bawah gambar karena bagian itu yang hilang lebih dulu. Kalau rasa tersebut belum punya foto, aplikasi menampilkan emoji 🥛 di atas latar gradien.

**Screenshot:** gambar 7

![Halaman detail produk — area foto 288 px, terpotong atas dan bawah](img/produk-detail.png)

## 4. Aset lain — supaya tidak terlewat

Daftar berikut memastikan tidak ada aset yang tertinggal di luar tiga bagian di atas.

### a. Unggahan bukti dari dalam aplikasi

Aset ini diunggah langsung dari dalam aplikasi oleh peran Outlet, Kurir, atau Owner — bukan bagian dari berkas yang disiapkan di muka. Dicantumkan agar tidak dikira terlewat.

| Aset                                     | Diunggah oleh  | Rasio             | Rekomendasi Aset | Batas berkas                   |
| ---------------------------------------- | -------------- | ----------------- | ---------------- | ------------------------------ |
| Foto wajah kurir                         | Owner / Outlet | Persegi (1:1)     | 800 × 800 px     | 5 MB — JPG, PNG, WebP          |
| Foto kendaraan kurir                     | Owner / Outlet | Persegi (1:1)     | 800 × 800 px     | 5 MB — JPG, PNG, WebP          |
| Bukti pengiriman (pesanan diterima)      | Kurir          | Bebas             | —                | 5 MB — gambar                  |
| Bukti pembayaran setoran outlet          | Outlet / Owner | Bebas             | —                | 2 MB — gambar                  |
| Bukti transfer refund ke pelanggan       | Owner          | Bebas             | —                | 2 MB — gambar                  |
| Foto bukti retur atau penukaran          | Outlet         | Bebas             | —                | 5 MB per foto, maksimal 5 foto |

Foto wajah dan kendaraan kurir otomatis dipotong persegi dan dikecilkan oleh aplikasi. Bukti retur sebaiknya diambil dari jarak dekat, jelas, dan memperlihatkan kondisi kemasan.

### b. Belum ada gambarnya — perlu keputusan

Tempat-tempat berikut saat ini **tidak menampilkan gambar sama sekali**, hanya ikon atau tulisan. Belum ada berkas yang dibutuhkan sampai ada keputusan.

| Tempat                              | Keadaan sekarang                                    |
| ----------------------------------- | --------------------------------------------------- |
| Kartu riwayat dan pesanan aktif     | Lambang susu 🥛 di kotak abu-abu — lihat bagian 2b  |
| Keranjang dan halaman checkout      | Ikon paket; foto produk belum ditampilkan           |
| Kartu "Produk Lainnya" di detail    | Hanya emoji 🥛                                      |
| Ikon kategori produk                | Hanya tulisan dan ikon bawaan                       |
| Logo outlet atau toko               | Belum ada kolomnya — brand tampil sebagai huruf "D" |
| Logo metode pembayaran              | Hanya tulisan nama metode                           |
| Gambar saat daftar kosong           | Hanya ikon bawaan                                   |
| Foto profil pelanggan               | Mengikuti akun Google, tidak bisa diunggah manual   |

### c. Aset bawaan aplikasi — diurus pengembang

Aset ini menempel di berkas aplikasi, bukan diunggah lewat menu, jadi tidak perlu disiapkan tim. Dicantumkan untuk kelengkapan.

| Aset                                   | Berkas di aplikasi                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Ikon aplikasi Android dan iOS          | `public/icons/icon-192.png`, `public/icons/icon-512.png`                        |
| Ikon saat dibuka dari layar utama      | `public/apple-touch-icon.png`                                                   |
| Ikon kecil di tab peramban             | `public/favicon.ico`, `public/favicon.png`                                      |
| Ikon notifikasi dan lencana            | `public/badge.png`                                                              |
| Layar pembuka saat aplikasi dijalankan | `android/app/src/main/res/drawable*/splash.png`, `public/splash/iphone-startup.png` |
| Peta lokasi outlet dan alamat kirim    | Peta daring, bukan berkas aplikasi                                              |

## Cara memeriksa hasilnya

| Yang diperiksa                  | Caranya                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Foto produk sudah terpasang     | Buka **Produk → Kategori Produk**, pakai filter **No Image** — daftarnya harus kosong |
| Foto tampil di ketiga tempat    | Buka daftar produk, halaman favorit, lalu halaman detail rasa yang sama         |
| Banner sudah sesuai             | Buka halaman depan dan tunggu ketiga slide berputar                             |

## Kalau ada masalah

| Yang terlihat                                        | Sebab dan solusinya                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Gambar banner terpotong jadi kotak kecil             | Berkasnya bukan persegi — siapkan ulang dengan bentuk 1:1, subjek di tengah             |
| Tulisan di gambar banner tidak terbaca               | Judul dan kalimat ajakan sudah ditampilkan aplikasi; jangan menaruh tulisan di gambar   |
| Bagian atas atau bawah foto hilang di halaman detail | Area detail memang lebih lebar daripada tinggi — sisakan ruang kosong ±20% atas dan bawah |
| Muncul emoji 🥛 di aplikasi                          | Rasa tersebut belum punya foto — unggah mengikuti dokumen 01                            |
| Foto tampak kabur di kartu produk                    | Sumbernya lebih kecil dari 800 × 800 lalu diperbesar — pakai minimal 1200 × 1200        |
| Riwayat pesanan tetap tidak menampilkan foto         | Memang belum tersedia — lihat bagian 2b                                                 |
| Banner tidak berubah setelah diserahkan              | Menu unggah banner belum ada; perubahan hanya bisa dipasang oleh pengembang             |

## Daftar periksa

- [ ] Tiga gambar banner tersedia, semuanya persegi (1:1) dan 600 × 600 px atau 800 × 800 px
- [ ] Konten tiap banner sudah dicocokkan dengan `title`, `subtitle`, dan `cta` di atas
- [ ] Tidak ada tulisan yang menempel di dalam gambar banner
- [ ] Tujuh foto rasa dari dokumen 01 sudah lengkap
- [ ] Semua foto produk persegi (1:1) dan minimal 800 × 800 px
- [ ] Subjek tiap foto berada di tengah, dengan ruang kosong di bagian atas dan bawah
- [ ] Semua berkas di bawah 4 MB
- [ ] Keputusan sudah diambil untuk daftar "belum ada gambarnya"

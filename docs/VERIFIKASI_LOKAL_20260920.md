# Verifikasi lokal per fitur — 2026-09-20

Cara pakai: buka `https://dombi.test` (Vite jalan di `localhost:5173`, HMR aktif),
lalu jalankan daftar ini per role. Setiap fitur menyebut berkas yang berubah dan
apa yang perlu dipastikan.

Cakupan: 31 commit, 145 berkas (`git diff origin/develop..HEAD`). Termasuk
pekerjaan Customer dari sesi sebelumnya, bukan hanya Outlet/Courier/Owner.

Legenda tiap item: **[berkas]** yang berubah → yang perlu dipastikan.

---

## CUSTOMER

Perubahan Customer di rentang ini kecil (2–26 baris per berkas): header/title-bar,
palette → token, dan shade badge dari lapisan bersama.

**1. Alamat — daftar, form, peta**
`addresses/index.tsx`, `components/customer/address-form.tsx`,
`location-sheet.tsx`, `location-search-panel.tsx` (26 baris, terbesar di role ini)
→ Pastikan: judul halaman tetap di tengah 16/700 dan tidak ikut scroll; sheet
peta/pencarian lokasi tetap punya tinggi & spacing yang sama; hasil pencarian
lokasi masih terbaca (placeholder kini lebih gelap, itu disengaja); tombol
simpan/hapus alamat masih 44px.

**2. Checkout — data customer**
`checkout/customer.tsx` → header dan field yang sama; ukuran teks input tidak
berubah (aturan `input { font-size: 16px !important }` masih berlaku).

**3. Pesanan — detail & timeline**
`orders/show.tsx`, `components/customer/order-timeline.tsx` → badge status
pesanan (shade teks satu langkah lebih gelap), garis waktu, tombol aksi.

**4. Lacak pesanan**
`track.tsx` → header (judul order-header sekarang 16/700), kartu status, tombol
bagikan.

**5. Bantuan & Tentang**
`help.tsx`, `about.tsx` → title-bar dan isi.

---

## OUTLET

**6. Dashboard**
`dashboard.tsx`, `outlet-dashboard-skeleton.tsx`, `revenue-trend-chart.tsx`,
`top-products-chart.tsx` → Pastikan: skeleton loading tidak lagi hijau pekat
(kini shimmer primitif, jauh lebih pudar — ini perubahan yang paling terlihat
di sini); warna seri chart sekarang dari token (`var(--color-*)`); dot status
kolom.

**7. Pesanan**
`orders/index.tsx`, `orders/show.tsx` → tab segmented "aktif/riwayat" (kini punya
`aria-pressed`, ukuran tidak berubah); kartu peringatan kuning di daftar; di
detail: tombol assign, baris alasan tolak/batal (kini `aria-pressed`), tombol
submit 44px dan tombol destruktif 48px.

**8. Pengiriman**
`deliveries/index.tsx`, `deliveries/show.tsx`, `assign-courier-sheet.tsx` →
tab segmented; sheet assign kurir: dua tombol aksi kini `<Button>` (radius dan
bobot label berubah, tinggi tetap 48px), tombol ikon 40 → 44px, kartu kurir
terpilih memakai border tint brand; **umpan balik tekan** pada tombol aksi kini
hover-based, bukan `active:`.

**9. Inventaris & Stock Opname**
`inventory.tsx` → ikon opname 44px (`aria-label` baru), pasangan konfirmasi
48px, dot level stok, stepper tetap native.

**10. Scan**
`scan.tsx` → backdrop nyaris hitam (nilai hampir identik dengan sebelumnya).

**11. Tukar barang (exchanges)**
`exchanges/index.tsx`, `exchanges/create.tsx`, `exchanges/show.tsx`,
`exchange-create-dialog.tsx` → dialog: tombol tutup dan submit kini `<Button>`;
tombol hapus pasangan 44px dengan hover merah; input dengan fokus ring token
(sebelumnya emerald muda yang gagal kontras); stepper jumlah tetap native.

**12. Return**
`returns/index.tsx`, `returns/create.tsx`, `returns/show.tsx`,
`return-create-dialog.tsx` → dropzone unggah 80px dan overlay hapus-gambar 28px
tetap native (ukurannya disengaja); tombol submit 44px.

**13. Restock**
`restocks/index.tsx`, `restocks/create.tsx`, `restocks/show.tsx`,
`restock-create-dialog.tsx` → tombol "Tambah Item" kini outline **dengan border
putus-putus tetap**; ikon hapus item 44px; tombol "Batalkan" kini outline dengan
warna danger dipertahankan; badge status restock.

**14. Penjualan offline**
`offline-sales/index.tsx`, `offline-sales/show.tsx`, `offline-sale-dialog.tsx` →
dua ikon baris (edit/hapus, sudah ber-`aria-label`) kini 44px; pasangan
batal/hapus 48px.

**15. Kurir outlet**
`my-couriers/index.tsx` → tombol "Calonkan Kurir Baru" kini `size="sm"` (ikonnya
14 → 16px, paling terlihat di sini).

**16. Settlement**
`settlement.tsx`, `settlement-show.tsx`, `settlement-payments.tsx` → baris
pilihan pembayaran (kini `aria-pressed`); tabel dan angka; badge pembayaran.

**17. Laporan & Analitik**
`reports/index.tsx`, `analytics/index.tsx`, `order-reports/index.tsx`,
`order-reports/show.tsx` → tombol "Terapkan" pada rentang tanggal; input tanggal;
tabel laporan.

**18. Navigasi**
`navigation-sheet.tsx` → baris keluar kini baris ghost penuh (ikon + label,
warna danger), hover merah tetap.

---

## COURIER

**19. Dashboard — toggle ketersediaan**
`dashboard.tsx` → tombol toggle online/offline kini `<Button>`, dua keadaannya
tetap (outline saat online, primary saat offline); tinggi 44px.

**20. Pengiriman — daftar & rute**
`deliveries/index.tsx` → tombol "Optimalkan Rute" kini 44px dengan spinner.

**21. Pengiriman — detail (paling banyak berubah)**
`deliveries/show.tsx` → Pastikan: WhatsApp (primary) dan Telepon (outline) tetap
berdampingan 44px; "Buka di Google Maps"; tombol status aksi (className
kondisional, hanya elemennya yang berubah); sheet "Kembalikan ke outlet" dengan
pasangan batal/destruktif (`variant="destructive"` — **umpan balik tekannya
hilang**, ini konsekuensi memakai primitif); tiga form konfirmasi
(selesai/gagal/tolak) dengan tombol submit 48px.

**22. Profil**
`profile.tsx` → baris "Keluar" kini baris ghost penuh dengan teks danger.

**23. Navigasi bawah**
`components/courier/bottom-nav.tsx` → border dan latar token.

---

## OWNER

Role ini 79 berkas — jalankan per fitur, tidak perlu sekaligus.

**24. Kerangka & sidebar (global)**
`owner-page-shell.tsx`, `owner-sidebar-nav.tsx`, `owner-command-sheet.tsx`,
`owner-segmented-tabs.tsx`, `header-icon-utils.tsx` → **paling terlihat**:
sidebar gelap — label nav dari mint hampir putih → `brand-bright` (lebih hijau),
dropdown dari hex `#005D42` → `brand-deep` (#185338, lebih gelap), border
`brand-deep-soft/30`. Cek: label masih terbaca, dropdown masih menyatu.

**25. Dashboard**
`dashboard.tsx`, `owner-kpi-card.tsx`, `owner-kpi-strip.tsx`, `owner-metric.tsx`,
`owner-detail-row.tsx`, `owner-filter-card.tsx` → KPI, kartu, filter.

**26. Produk**
`outlet-products.tsx`, `tambah-produk-modal.tsx`, `image-upload-field.tsx`,
`product-image.tsx`, `product-search-filters.tsx` → placeholder gambar kini
gradien `primary-light → surface` (sebelumnya emerald → teal, sedikit berbeda);
ikon hapus gambar `ring-border`; tabel produk.

**27. Kategori & keluarga produk**
`product-categories/{index,product-form,show}.tsx`,
`product-families/{index,show,variant-form}.tsx` → form terberat di role ini;
input/select mentah masih ada (belum dimigrasi ke primitif) — ukuran tidak
berubah; tombol submit/batal 44–48px.

**28. Harga**
`pricing/{index,pusat-tab,outlet-detail,compare-view,riwayat-tab,pricing-modals}.tsx`
(list 6 berkas; `outlet-tab` dan `outlet-list` tidak berubah)
→ **lavender `#7C3AED` → `status-active`** (#7e22ce, hampir sama); modal harga;
tabel perbandingan.

**29. Outlet & provisioning**
`outlets/{index,show}.tsx`, `outlet-form-sheet.tsx`, `outlet-location-map.tsx`,
`outlet-location-modal.tsx`, `outlet-provisioning-summary.tsx`,
`operating-hours-manager.tsx`, `holiday-manager.tsx`, `setup-center-stock-modal.tsx`
→ panel ink (kredensial) kini `bg-foreground text-surface`; peta & marker; jam
operasional; pengelola hari libur (tombol hapus hover merah).

**30. Inventaris**
`inventories/{index,central-stock-tab}.tsx` → tabel stok pusat, modal setup.

**31. Restock**
`restocks/{index,show}.tsx`, `restock-modal.tsx` → badge restock, modal.

**32. Return & tukar (owner)**
`returns/{show,pengembalian-tab,penukaran-tab}.tsx`,
`exchanges/{index,show}.tsx` → tab, modal penukaran, detail.

**33. Pengiriman**
`deliveries/{index,show}.tsx`, `delivery-board-column.tsx`, `delivery-card.tsx`,
`delivery-performance-card.tsx`, `resolve-delivery-sheet.tsx`,
`delivery-tiers/index.tsx` → **kartu pengiriman**: rel status kiri kini
`border-l-<family>` (warna per status, hue dipertahankan); papan kolom; kartu
performa (ring kini token).

**34. Kurir**
`couriers/{create,index,show}.tsx`, `courier-management/index.tsx`,
`courier-availability-card.tsx`, `courier-stats.tsx`,
`components/owner/assign-courier-sheet.tsx` → daftar & detail kurir, ketersediaan,
statistik, sheet assign (salinan ketiga — lihat catatan duplikasi).

**35. Finance**
`finance/{outlet-detail,pembayaran-tab,rekening-tab,tagihan-tab,refund-tab}.tsx`,
`finance/{finance-outlet-card,finance-status-badge,payment-history-card,payment-proof-modal,refund-completion-modal,settlement-payment-modal}.tsx`,
`refund-operations-dialogs.tsx`, `invoice-modal.tsx`, `margin-bar.tsx`
→ Pastikan: **teal → `success`** (dua elemen, satu-satunya perpindahan hue yang
saya putuskan); badge status finance; baris riwayat pembayaran (hover danger);
modal bukti bayar & invoice; margin bar.

**36. Analitik & laporan**
`analytics/{dashboard-tab,laporan-tab,masalah-tab,audit-tab}.tsx` → chart (warna seri kini `var(--color-*)`), tab masalah/audit,
panel ekspor (tombol 44px).

**37. Pelanggan & pesanan**
`customers/{index,show}.tsx`, `orders/index.tsx` → daftar & detail pelanggan,
daftar pesanan owner (4 kelas), modal.

**38. Profil**
`profile.tsx` → pengaturan akun; baris aksi.

---

## LINTAS ROLE — `components/ui` + token

Berkas ini dipakai **semua role**, jadi perubahannya muncul di mana-mana:

- `order-status-badge.tsx`, `delivery-status-badge.tsx`,
  `restock-status-badge.tsx`, `stock-level-badge.tsx` → shade teks badge kini
  dari token (`*-800` → `*-700`), dan badge neutral (Kadaluarsa, Menunggu
  Assignment, restock Dibatalkan) memakai teks gelap di surface muted.
- `pagination.tsx` → halaman aktif satu langkah lebih gelap; teks "sebelumnya"
  memakai token subtle.
- `empty-state.tsx` → tombol utama tetap persis; deskripsi memakai muted.
- `sticky-action-bar.tsx` → varian danger kini `bg-destructive` (nilai sama),
  hover 90%.
- `phone-input.tsx` → border error lebih kuat, tanda wajib danger.
- `input.tsx`, `section-card.tsx`, `collapsible-card.tsx` → penyesuaian token.
- `app.css` → token baru `status-progress/active/transit` + `text-muted` lebih
  gelap (#6b6b74) → **menyentuh hampir semua layar sekunder**.

---

## Yang sudah pasti berbeda (jangan dikira bug)

1. Placeholder dan label uppercase **lebih gelap** (dari 2.3:1 ke 4.79:1).
2. Teks sekunder di mana-mana sedikit lebih gelap (token muted).
3. Teks di atas tint status satu shade lebih gelap.
4. Sidebar Owner: label lebih hijau, dropdown lebih gelap.
5. Dua elemen teal di finance kini hijau.
6. Skeleton dashboard Outlet jauh lebih pudar.
7. **21 elemen yang sebelumnya tanpa latar** (kelas `bg-*-bg0` yang tidak valid)
   kini berwarna — kalau kamu ingat ada elemen "telanjang", versi berwarna benar.
8. Tombol hasil konversi: radius, bobot label, dan tinggi (36/44/48px) menyesuaikan
   primitif; umpan balik tekan pada sebagian tombol kini hover-based.

## Yang masih terbuka (bukan bagian verifikasi ini)

- 105 tombol native (Outlet 26, Owner 79) — memang tidak punya varian yang cocok.
- 142 input mentah — belum dimigrasi; aturan `font-size: 16px !important` masih ada.
- Dua duplikasi: tiga salinan sheet assign kurir; `order-status-chip`.
- **Koreksi saya:** primitif segmented control ternyata **sudah ada** di
  `components/owner/owner-segmented-tabs.tsx` — hanya belum dibagi ke `components/ui`.
  Jadi tab segmented Outlet/Courier bisa memakainya kalau dipromosikan.
- Dialog belum punya Escape untuk menutup.
- 5 hex brand Customer memang sengaja dipertahankan.

## Cara melapor balik

Sebutkan **role + fitur + elemen + apa yang terlihat salah**. Setiap perubahan ada
di commit terpisah, jadi saya bisa `git revert` satu commit (mis. `80854a12`
perbaikan kelas rusak, `94f65271` tombol Courier, atau per-slice Outlet/Owner)
tanpa mengganggu sisanya. 31 commit masih lokal — staging belum tersentuh.

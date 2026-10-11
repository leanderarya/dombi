# Rilis Aplikasi Android — Dombi App

Dokumen ini adalah ritual rilis aplikasi Android (`com.dombi.customer`), dari menyiapkan
kunci sampai APK ada di tangan pengguna.

Cakupan saat ini: **APK bertanda tangan yang dibagikan langsung** (sideload), bukan Play
Store. Tidak ada AAB, tidak ada Play Console, tidak ada listing. Kalau nanti pindah ke Play
Store, lihat [Pindah ke Play Store](#pindah-ke-play-store) di bagian akhir.

Dokumen ini melengkapi `DEPLOYMENT.md`. Yang ada di sana adalah rilis **web** (`app.dombicenter.com`).
Yang ada di sini adalah rilis **APK**. Keduanya tidak saling menggantikan.

---

## Kenapa APK ini perlu kunci sama sekali

APK yang dibagikan langsung tidak melewati Play Store, tapi Android tetap memaksa setiap
aplikasi ditandatangani. Konsekuensinya keras, dan semuanya bertumpu pada satu berkas:

- **Satu kunci untuk selamanya.** Update hanya bisa dipasang di atas aplikasi lama kalau
  ditandatangani dengan kunci yang **sama persis**. Kunci berbeda = Android menolak dengan
  `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.
- **Hilang berarti mati.** Kalau keystore hilang, aplikasi yang sudah terpasang tidak bisa
  di-update lagi. Satu-satunya jalan adalah merilis aplikasi **baru** dengan
  `applicationId` baru — dan seluruh pengguna lama harus memasang ulang dari nol.
- **Bocor berarti diambil alih.** Siapa pun yang memegang keystore bisa membuat APK "update"
  yang ditandatangani sah, dan HP pengguna akan menerimanya tanpa protes.

Karena itu keystore **tidak pernah** masuk repo, dan **tidak pernah** ada di dokumen ini.
Yang boleh dicatat hanya sidik jarinya.

## Prasyarat

| Kebutuhan | Versi terpasang saat dokumen ini ditulis |
|---|---|
| JDK | 21 (`keytool` ikut di dalamnya) |
| Android SDK | `~/Library/Android/sdk`, build-tools & platform 36 |
| Gradle | 8.14.3 (via wrapper di `android/`) |
| Android Gradle Plugin | 8.13.0 |
| Node | 22+ |

`ANDROID_HOME` tidak perlu di-set; `android/local.properties` sudah menunjuk SDK.

## 1. Membuat keystore — sekali seumur aplikasi

```bash
./scripts/create-keystore.sh
```

Skrip ini membuat:

- `~/keystores/dombi-release.jks` — RSA 2048, berlaku 10.000 hari, alias `dombi`;
- `android/keystore.properties` — kredensial yang dibaca Gradle, mode `600`, **gitignored**.

Password dibuat acak (hex 32 karakter) dan diteruskan ke `keytool` lewat environment,
bukan argumen, supaya tidak terlihat di `ps`. Skrip menolak berjalan kalau keystore atau
`keystore.properties` sudah ada — menimpa berarti memproduksi aplikasi yang tidak bisa
di-update di atas yang sudah terpasang.

Skrip mencetak **SHA-256 fingerprint**. Itu identitas permanen aplikasi. Catat di tempat
yang bukan repo (password manager, catatan operator).

### Setelah skrip selesai: cadangkan, sekarang

Pindahkan keystore **dan** password ke dua tempat yang bukan mesin ini — misalnya
password manager dan media offline. Tidak ada yang bisa meregenerasinya: bukan repo ini,
bukan Google, bukan siapa pun. Menunda pencadangan berarti mempertaruhkan seluruh basis
pengguna pada satu berkas di satu laptop.

### Kalau `android/keystore.properties` tidak ada saat build release

Gradle sengaja dibiarkan **tidak gagal** di level konfigurasi: blok `signingConfigs`
hanya terisi kalau file itu ada. Efeknya:

- `assembleDebug` tetap jalan di mesin siapa pun — ini yang menjaga kontributor yang
  cuma mau build debug tidak ikut tersandera;
- `assembleRelease` **berhasil** menghasilkan APK, tapi **tidak bertanda tangan**.

APK tidak bertanda tangan tidak bisa dipasang siapa pun. Kegagalannya baru ketahuan saat
diserahkan ke pengguna — karena itu `scripts/build-apk.sh` menolak lebih awal, sebelum
memanggil Gradle, kalau mode `release` dijalankan tanpa file kredensial. Cek tetap wajib
di langkah 4.

## 2. Membangun APK

```bash
# Production — URL dibake ke dalam APK
CAP_SERVER_URL=https://app.dombicenter.com ./scripts/build-apk.sh customer release
```

Argumen pertama `customer|internal`, argumen kedua `debug|release` (default `debug`).
Tanpa `CAP_SERVER_URL`, build memakai **staging** — sengaja, supaya build produksi tidak
pernah terjadi karena lupa.

Hasilnya di `~/Desktop/Dombi-customer-v<versi>-release.apk`.

Skrip juga menyinkronkan `applicationId`, `namespace`, dan `strings.xml` dari satu sumber,
lalu menjalankan `npx cap sync android` dengan `CAP_APP_ID`/`CAP_APP_NAME`/`CAP_SERVER_URL`/
`CAP_START_PATH`.

> **Perubahan in-place.** Skrip menulis ulang `MainActivity.java`, `applicationId`,
> `namespace`, dan `strings.xml` di working tree. Setelah build, `git status` akan kotor
> walaupun Anda tidak mengubah apa pun secara sadar. Periksa diff-nya sebelum commit;
> jangan `git add -A`.

## 3. Versi

`versionCode` dan `versionName` ada di `android/app/build.gradle` — satu tempat, tidak
diduplikasi di skrip (skrip membacanya kembali untuk nama berkas).

Aturannya, untuk distribusi sideload:

- **`versionCode` harus naik setiap kali APK dibagikan.** Kalau angkanya sama atau lebih
  kecil, Android menolak memasang di atas yang sudah ada.
- **`versionName` bebas**, hanya dibaca manusia. Naikkan supaya bisa dibedakan saat
  pengguna melaporkan masalah.

| Rilis | versionCode | versionName |
|---|---|---|
| Perdana (dokumen ini) | 2 | 1.1 |

> Kenapa mulai dari 2: `versionCode 1` / `versionName "1.0"` adalah build debug yang sudah
> beredar. Memakai angka yang sama akan bentrok saat dipasang di perangkat yang sama.

Yang **tidak boleh** berubah: `applicationId`. Mengubahnya membuat APK baru terpasang
sebagai aplikasi **kedua**, bukan update — dua ikon, dua data, dua login.

## 4. Verifikasi sebelum diserahkan

Jangan pernah menyerahkan APK yang belum melewati keempat pemeriksaan ini.

**a. Pastikan ditandatangani kunci release, bukan debug.**

```bash
# Glob, not `ls` — an `ls` alias (eza/lsd) would put its decorated listing into the
# command substitution and the binary path would come out mangled.
BT=$(printf '%s\n' "$HOME"/Library/Android/sdk/build-tools/*/ | sort -V | tail -1)
"$BT/apksigner" verify --print-certs "$HOME/Desktop/Dombi-customer-v1.1-release.apk"
```

Bandingkan `SHA-256 digest` sertifikatnya dengan yang dicetak `create-keystore.sh`.
Harus sama. Kalau berbeda, atau kalau `apksigner` mengeluh "not signed", APK itu tidak
akan bisa dipasang.

**b. Pastikan identitas dan label benar.**

```bash
BT=$(printf '%s\n' "$HOME"/Library/Android/sdk/build-tools/*/ | sort -V | tail -1)
"$BT/aapt2" dump badging "$HOME/Desktop/Dombi-customer-v1.1-release.apk" | head -5
```

Yang harus terlihat: `package: name='com.dombi.customer'`, `versionCode='2'`,
`versionName='1.1'`, dan `application-label:'Dombi App'`.

**c. Pasang di perangkat sungguhan dan login.**

```bash
~/Library/Android/sdk/platform-tools/adb install -r ~/Desktop/Dombi-customer-v1.1-release.apk
```

Buka aplikasi, login dengan akun sungguhan, dan pastikan halaman depan termuat dari
`app.dombicenter.com` (bukan staging). APK adalah cangkang Capacitor yang memuat situs
langsung — kalau URL-nya salah, yang terlihat tetap "jalan", hanya menunjuk ke tempat
yang salah.

**d. Uji jalur yang paling mudah rusak di perangkat:** kamera (foto produk), pemindai
barcode, lokasi (kurir), dan splash screen saat aplikasi pertama dibuka.

## 5. Menyerahkan

APK dikirim langsung ke pengguna. Sertakan dalam pesan penyerahan:

- nama berkas dan `versionName`;
- commit SHA tempat APK dibangun;
- tanggal build;
- catatan apa yang berubah sejak versi terpasang.

Pengguna memasangnya dengan mengizinkan "install from unknown sources" untuk aplikasi
pengirim (WhatsApp, Drive, berkas). Android akan memperingatkan; itu memang begitu untuk
APK di luar Play Store.

## 6. Evidence

Simpan bukti rilis sebagai laporan HTML mandiri di
`docs/evidence/android-release-<YYYYMMDD>/report.html` (gitignored), mengikuti bentuk
laporan lain di folder itu. Isinya:

- commit SHA, `versionCode`, `versionName`, tanggal, operator;
- perintah build persis yang dijalankan;
- keluaran `apksigner verify --print-certs` (fingerprint saja);
- keluaran `aapt2 dump badging`;
- ukuran berkas, dan **sha256 berkas APK** — ini yang membuktikan APK yang diserahkan
  identik dengan yang diverifikasi;
- screenshot aplikasi berjalan (lihat di bawah).

Jangan pernah menyalin isi `keystore.properties`, password, atau API key ke evidence.

## Screenshot

Screenshot dibutuhkan untuk dokumentasi dan, kalau nanti pindah ke Play Store, sebagai
syarat listing (minimal 2).

**Layar yang layak diambil** — yang bisa dicapai tanpa menulis data:

| Layar | Perlu login? | Catatan |
|---|---|---|
| Halaman depan / katalog produk | tidak | aman, tidak menyentuh data |
| Detail produk | tidak | aman |
| Keranjang (kosong) | tidak | aman |
| Login / daftar | tidak | aman |
| Beranda setelah login | ya | butuh kredensial sungguhan |
| Riwayat pesanan | ya | **berisi data pesanan nyata** — sensor sebelum dipublikasikan |

Aturan yang berlaku: **jangan menulis data uji ke production.** Semua pengambilan
screenshot dilakukan terhadap staging atau terhadap akun sungguhan tanpa membuat pesanan
baru. Halaman yang butuh pesanan contoh diambil di staging, bukan production.

**Dari emulator** (tidak ada perangkat fisik terpasang saat dokumen ini ditulis):

```bash
# 1. Nyalakan emulator
~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_35 &

# 2. Tunggu sampai benar-benar siap, bukan sekadar proses hidup
~/Library/Android/sdk/platform-tools/adb wait-for-device
until [ "$(~/Library/Android/sdk/platform-tools/adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done

# 3. Pasang APK
~/Library/Android/sdk/platform-tools/adb install -r ~/Desktop/Dombi-customer-v1.1-release.apk

# 4. Buka, navigasi ke layar yang dituju, lalu ambil gambar
~/Library/Android/sdk/platform-tools/adb exec-out screencap -p > ~/Desktop/dombi-01-home.png
```

`exec-out` (bukan `shell`) supaya PNG tidak rusak oleh konversi akhir baris.

Ukuran `Medium_Phone_API_35` adalah 1080×2400 — sesuai rasio yang diminta Play Store
(minimal 320 px, maksimal 3840 px, rasio sisi terpanjang:terpendek tidak lebih dari 2:1).

**Kalau emulator bermasalah**, jalur cadangannya: pasang di perangkat fisik lalu
`screencap`, atau ambil screenshot dari browser pada viewport ponsel — tapi yang terakhir
**tidak boleh** diklaim sebagai screenshot aplikasi, karena tidak memperlihatkan
chrome-nya Android. Untuk dokumentasi internal itu cukup; untuk listing Play Store tidak.

Simpan ke `docs/evidence/android-release-<YYYYMMDD>/screenshots/`.

## Rilis berikutnya

1. Naikkan `versionCode` (wajib) dan `versionName` di `android/app/build.gradle`.
2. `CAP_SERVER_URL=https://app.dombicenter.com ./scripts/build-apk.sh customer release`
3. Jalankan keempat pemeriksaan di langkah 4.
4. Catat evidence.
5. Serahkan.

Tidak ada langkah yang berubah selama masih sideload. Kalau web di-deploy, **APK lama
tidak ikut berubah** — APK memuat situs langsung, jadi perubahan web sudah terlihat tanpa
merilis APK baru. APK baru hanya perlu kalau ada perubahan native: plugin, izin, ikon,
splash, nama aplikasi, atau URL server.

## Pindah ke Play Store

Belum dilakukan. Yang akan berubah kalau nanti diambil:

- **AAB, bukan APK.** Play Store mewajibkan Android App Bundle
  (`./gradlew bundleRelease`). `capacitor.config.ts` saat ini ber-`releaseType: 'APK'`.
- **Play App Signing.** Google memegang kunci penandatanganan; keystore lokal menjadi
  *upload key*. Keystore yang ada sekarang tetap berguna, tapi perannya berubah.
- **Akun Play Console**, biaya sekali $25, dan review 1–7 hari untuk rilis pertama.
- **Listing**: ikon 512×512, feature graphic 1024×500, minimal 2 screenshot, deskripsi
  pendek dan panjang, **kebijakan privasi** (wajib, karena aplikasi memakai kamera dan
  lokasi), dan formulir Data Safety.
- **`minifyEnabled false`** perlu ditinjau ulang: untuk cangkang Capacitor dampaknya kecil,
  tapi ukuran dan obfuscation berbeda.

Ikon sudah tersedia dan bisa dipakai untuk listing: `public/icons/icon-512.png`.

## Gap yang diketahui

Dicatat apa adanya, bukan sebagai blocker rilis ini:

- **Push notification Android tidak berfungsi.** `android/app/google-services.json` menunjuk
  proyek Firebase **uji** (`project_id: test-5d6cc532`), bukan proyek produksi. Sampai
  diganti, push ke perangkat Android tidak akan sampai. Push ke web/iOS tidak terpengaruh.
- **`google-services.json` ter-commit di git** (commit `877db9ad`), termasuk API key-nya.
  Firebase API key Android memang tidak dirancang rahasia (ia dibatasi oleh package name
  dan SHA-1 sertifikat), tapi file itu idealnya tidak berada di repo. Perlu ditinjau ulang
  sebagai keputusan tersendiri.
- **Hanya aplikasi customer yang dirilis.** Aplikasi internal (`com.dombi.internal`) sudah
  dikonfigurasi di `build-apk.sh` tapi belum pernah dibangun — paket Java-nya belum ada dan
  akan dibuat otomatis oleh skrip saat pertama dijalankan.
- **Belum ada CI untuk APK.** Build masih manual di mesin operator. Ini disengaja untuk
  rilis pertama; mengotomatiskannya berarti menaruh keystore di CI, yang membuka
  pertanyaan tersendiri.

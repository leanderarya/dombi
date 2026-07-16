# Product Image Reference

Panduan mengubah gambar product family & variant di Dombi. Simpan di otak: gambar disimpan LOKAL, bukan URL eksternal.

## Storage

- Disk: `public` (symlink `public/storage` → `storage/app/public`)
- Path file: `storage/app/public/products/{nama}.{ext}`
- URL hasil: `https://{domain}/storage/products/{nama}.{ext}`

## Cara ganti gambar (hardcode — tanpa upload UI)

1. Letakkan file di `storage/app/public/products/` (mis. `biogoat.webp`)
2. Update DB:
   ```php
   // product_families.image  (family)
   // product_variants.image  (variant, fallback ke family)
   DB::table('product_families')->where('id', $id)->update(['image' => 'products/biogoat.webp']);
   ```
3. Selesai. `resolveImage()` di controller otomatis generate full URL + cache-busting `?v={updated_at}`.

## Format & ukuran yang sesuai

| Parameter | Rekomendasi |
|---|---|
| Aspect | **1:1 (square)** — crop modal paksa square |
| Ukuran | **400×400px** (min 200×200, max 800×800) |
| Format terbaik | **WebP** (quality 80%, ~30–80KB) |
| Alternatif | JPG quality 85%, atau PNG kalau perlu transparansi |
| Max file | 4MB (validation), ideal < 200KB biar PWA cepat |
| Placeholder | SVG (vektor, tak pernah pecah) — lihat `storage/app/public/products/*.svg` |

## Fallback chain (frontend)

```
variant.image  →  family.image  →  emoji 🥛
```

- Variant tanpa image → pakai family image
- Family tanpa image → emoji placeholder
- URL eksternal (http/https) di DB → langsung dipakai apa adanya (legacy Unsplash)

## File terkait

| File | Fungsi |
|---|---|
| `app/Http/Controllers/Customer/CustomerProductApiController.php` | `resolveImage()` — API list (variant + family) |
| `app/Http/Controllers/Customer/ProductController.php` | `resolveImage()` — halaman detail (Inertia) |
| `app/Http/Controllers/Owner/ProductFamilyController.php` | upload family (store/update/destroy) |
| `app/Http/Controllers/Owner/ProductVariantController.php` | upload variant (store/update/destroy + remove_image) |
| `resources/js/components/owner/image-crop-modal.tsx` | crop square client-side (react-easy-crop) |
| `resources/js/components/ui/image-upload-field.tsx` | field upload + tombol hapus |
| `resources/js/hooks/use-products.ts` | tipe `Variant.image` |
| `resources/js/components/customer/variant-list-item.tsx` | `variant.image ?? familyImage` |
| `resources/js/pages/customer/product-detail.tsx` | hero `selectedVariant.image ?? family.image` |

## Gotcha

- **JANGAN** simpan URL Unsplash/eksternal di kolom `image` kalau mau pakai storage lokal — `resolveImage()` detect `http://`/`https://` dan return apa adanya tanpa prefix `storage/`.
- Service worker (`public/sw.js`) pakai **network-first** untuk `.js/.css`. Kalau ganti JS, version `CACHE_NAME` sudah `dombi-v2` — otomatis invalidate. Kalau gambar tetap stale: DevTools → Application → Clear site data.
- Storage symlink: kalau `public/storage` hilang, jalankan `php artisan storage:link`.

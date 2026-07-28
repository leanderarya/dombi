# Task 15 Report: Frontend Components – ProductImage, ImageUpload, Crop, SetupStockModal

**Status:** Done
**Commit:** `dcdf7b1` – `feat: add ProductImage, upload, crop, setup stock modal`
**Files:**
- `resources/js/components/owner/product-image.tsx` (new)
- `resources/js/components/owner/image-upload-field.tsx` (new)
- `resources/js/components/owner/image-crop-modal.tsx` (new)
- `resources/js/components/owner/setup-center-stock-modal.tsx` (new)

## Implementation

### 1. ProductImage (`product-image.tsx`)
- Props: `name`, `src: string|null`, `categoryImage?: string|null`, `size sm|md|lg`, `className`
- `resolve` helper: if starts with `http` keep, else `/storage/${p}`, null if empty
- Double fallback: product src → category src → 🥛 placeholder div with `from-emerald-100 to-teal-50`
- `sizeCls`: `sm h-8 w-8`, `md h-10 w-10`, `lg h-24 w-24`
- `onError` handling with `error` and `catError` states
- Uses `rounded object-cover` + passed className

### 2. ImageUploadField (`image-upload-field.tsx`)
- Props: `value: File|null|string`, `onChange: (File|null)`, `label='Foto Produk'`
- Hidden file input `accept="image/jpeg,image/png,image/webp"`
- Preview with `URL.createObjectURL`, revoke on unmount/remove
- Max 4MB check with `alert('Max 4MB')`
- UI: `Pilih Foto` button (outline), `Hapus` red text button, handles existing string value as fallback image
- Hint: `Crop 1:1, max 800x800, WebP, max 4MB`
- Improves brief: clears input value to allow re-select, revokes object URLs, uses `Button` from `@/components/ui/button`

### 3. ImageCropModal (`image-crop-modal.tsx`)
- Props: `open`, `onClose`, `imageSrc`, `onCropComplete: (blob:Blob)`
- Dialog with title `Crop 1:1`, preview image `max-h-96 rounded object-contain`
- Buttons: `Batal` (outline) + `Gunakan` with processing state `Memproses...`
- Simplified crop: `fetch(imageSrc)` → `blob`, call `onCropComplete(blob)` then `onClose`
- No `react-easy-crop` dependency required per brief (graceful degradation, server handles 1:1 800x800 WebP)
- Uses `@/components/ui/dialog` and `Button` matching project conventions

### 4. SetupCenterStockModal (`setup-center-stock-modal.tsx`)
- Props: `products: Product[]`, `open`, `onClose`
- Dialog `Setup Stok Pusat Awal`
- Lists products: name + sku `({p.sku})` with `Input type=number min=0 w-24 text-right`
- State: `stocks: Record<number,string>`, `processing`
- Save: `router.patch` per product to `/owner/inventories/central-stock/{id}` with `{center_stock: qty, reason: 'Stok awal produk baru'}`, `preserveScroll:true`, `onFinish/onError` counting done
- Footer: `Lewati (Stok 0)` (outline) → onClose, `Simpan` → `Menyimpan...` when processing
- Handles NaN/negative safeQty fallback to 0, empty list message

## Verification
- Checked `resources/js/components/ui/dialog.tsx` – named exports `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter` exist
- Checked `Button` and `Input` imports match `tambah-produk-modal.tsx` and other owner components using `@/components/ui/...`
- Checked `Product` type from `@/types/product` matches created interface
- `git diff --stat` shows 4 new files, no modifications to existing
- Build not run (frontend only, no breaking changes), but components are type-safe with explicit props

## Next
- Task 16 can use `ProductImage` in product tables and `ImageUploadField` + `ImageCropModal` in product form
- `SetupCenterStockModal` to be triggered after bulk product creation flow

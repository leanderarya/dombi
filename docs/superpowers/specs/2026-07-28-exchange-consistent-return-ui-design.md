# Design: Exchange Modal Consistent with Return Modal (Multi-Pair)

## Context
- Return popup (`return-create-dialog.tsx`) sudah OK: card list toggle selection, search filter, `<input type=number>` qty + `-/+`, visual `rounded-xl border p-3` selected `border-primary bg-primary-light`.
- Exchange modal (`exchange-create-dialog.tsx`) saat ini: single pair, 2x `CustomSelect searchable` dropdown, qty input +/-, red/green sections. Tidak konsisten dengan Return.
- User request: copy UI/UX Return ke Tukar, dengan multi-pair (1 pair + 1 pair lagi jika 2 produk, baru simpan kirim).

## Goal
Buat `exchange-create-dialog.tsx` konsisten dengan Return: card list selection + search + manual qty, support multi-pair seperti `exchanges/create.tsx`.

## Approaches Considered
1. **Single pair, card list (minimal)** - konsisten visual, tapi tidak support >1 produk sekaligus. Ditolak user karena mau multi.
2. **Multi-pair, card list (chosen)** - sama seperti halaman create.tsx `Tambah Pasangan`, tapi tiap pair pakai card list Return pattern bukan dropdown. Risiko medium, value tinggi.
3. **Wizard 2-step** - step return lalu replacement. Overkill.

## Chosen: Approach 2 - Multi-Pair Card List

### State
```ts
interface PairedItem {
  return_variant_id: number
  return_quantity: number
  replacement_variant_id: number
  replacement_quantity: number
  return_search: string
  replacement_search: string
}
const [pairs, setPairs] = useState<PairedItem[]>([{ return_variant_id:0, return_quantity:1, replacement_variant_id:0, replacement_quantity:1, return_search:'', replacement_search:'' }])
```

### UI per Pair
- Header: `Pasangan {n}` + trash icon jika pairs.length>1
- **Return Section (red) `border-red-200 bg-red-50/50 p-3 rounded-xl`:**
  - Dot merah + label "Dikembalikan"
  - Search input: placeholder "Cari produk di inventaris..." value `pair.return_search` -> filter `outletInventory` by `variant.name`
  - Card list (max-h 36 overflow-y-auto): map `filteredReturn`. Each card: radio dot, `full_name ?? name`, `Stok: current_stock`, selling_price optional. Click toggle select (single per pair). Selected style like Return.
  - Qty row: `-/ [input type=number min1 max=available_stock] /+` + inline validation. Same as Return.
- **Arrow**: centered `ArrowRight` icon in circle `bg-primary-light`
- **Replacement Section (green) `border-emerald-200 bg-emerald-50/50`:**
  - Dot hijau + "Pengganti"
  - Search: "Cari produk pengganti..." filter `variants` by `full_name ?? name`
  - Card list same pattern, display harga
  - Qty row sama

### Actions
- Add Pair button: `Tambah Pasangan` dashed border, append new pair, similar to create.tsx
- Remove Pair: trash icon per pair header if >1
- Validation per pair: both return_variant_id && replacement_variant_id >0
- Sync to form: `form.setData('items', pairs.filter(...).map(...))`

### Submit
- `form.transform(() => ({ items: [...], notes: '' }))` (keep notes empty or optional textarea below all pairs)
- POST `/outlet/exchanges`, onSuccess toast + reset + onClose, onError toast as existing
- Footer: count valid pairs, sticky submit `Kirim Penukaran (n)`
- Optional: keep separate `return_notes`/`replacement_notes` per pair? Simpler: single `notes` field di bawah list pairs (opsional) untuk konsistensi Return yang punya satu notes.

### Visual Consistency Checklist
- `rounded-xl border p-3` cards, `border-primary bg-primary-light` selected
- `h-5 w-5 rounded-full border-2` radio
- Search input `rounded-xl border border-border p-3 text-sm` seperti Return
- Qty input `[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none` w-14 centered bold tabular-nums
- Section containers rounded-xl border red-200 / emerald-200 bg 50/50 p-2.5
- No CustomSelect, no native select dropdowns in modal

### Files
- `resources/js/components/outlet/exchange-create-dialog.tsx` - utama (rewrite)
- Optional phase 2: `resources/js/pages/outlet/exchanges/create.tsx` - bisa pakai pattern sama tapi scope modal dulu

### Testing
- Manual: outlet role, ajukan 1 pair, 2 pairs, search filter, qty manual type, hapus pair, submit
- Edge: stok habis disabled, qty clamp max stok, search kosong show empty state, submit disabled jika tidak ada pair valid
- Existing tests `ExchangeWorkflowHardeningTest` tetap green (backend unchanged)

### Success Criteria
- User bisa pilih produk via card list + search (tidak scroll panjang)
- Bisa ketik qty manual + +/- 
- Bisa tambah 1 pair lagi jika 2 produk, baru simpan kirim sekaligus
- UI/UX identik dengan Return modal

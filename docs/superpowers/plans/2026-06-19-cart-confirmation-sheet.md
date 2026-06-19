# Bottom Cart Sheet - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace toast notification with bottom cart sheet when adding products to cart

**Architecture:** Create a reusable `CartConfirmationSheet` component using existing `BottomSheet` primitive, with a global context provider for triggering from any add-to-cart location

**Tech Stack:** React 19, Inertia.js, existing BottomSheet component, Context API

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `resources/js/contexts/cart-confirmation-context.tsx` | Create | Global state context |
| `resources/js/providers/cart-confirmation-provider.tsx` | Create | Provider wrapper |
| `resources/js/components/customer/cart-confirmation-sheet.tsx` | Create | Bottom sheet component |
| `resources/js/customer-app.tsx` | Modify | Wrap with provider |
| `resources/js/app.tsx` | Modify | Wrap with provider |
| `resources/js/pages/customer/product-detail.tsx` | Modify | Use context instead of toast |
| `resources/js/components/customer/variant-list-item.tsx` | Modify | Use context |
| `resources/js/components/customer/size-selector-sheet.tsx` | Modify | Use context |

---

### Task 1: Create Cart Confirmation Context

**Files:**
- Create: `resources/js/contexts/cart-confirmation-context.tsx`

- [ ] **Step 1: Create context file**

```tsx
import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';

interface CartConfirmationData {
    productName: string;
    variantName?: string;
    quantity: number;
    price: number;
}

interface CartConfirmationContextType {
    isOpen: boolean;
    data: CartConfirmationData | null;
    showConfirmation: (data: CartConfirmationData) => void;
    hideConfirmation: () => void;
}

const CartConfirmationContext = createContext<CartConfirmationContextType | null>(null);

export function useCartConfirmation() {
    const context = useContext(CartConfirmationContext);
    if (!context) {
        throw new Error('useCartConfirmation must be used within CartConfirmationProvider');
    }
    return context;
}

export function useCartConfirmationState() {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState<CartConfirmationData | null>(null);

    const showConfirmation = useCallback((confirmationData: CartConfirmationData) => {
        setData(confirmationData);
        setIsOpen(true);
    }, []);

    const hideConfirmation = useCallback(() => {
        setIsOpen(false);
        setTimeout(() => setData(null), 300);
    }, []);

    return { isOpen, data, showConfirmation, hideConfirmation };
}

export { CartConfirmationContext };
export type { CartConfirmationData };
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/contexts/cart-confirmation-context.tsx
git commit -m "feat: create cart confirmation context for bottom sheet"
```

---

### Task 2: Create Cart Confirmation Provider

**Files:**
- Create: `resources/js/providers/cart-confirmation-provider.tsx`

- [ ] **Step 1: Create provider file**

```tsx
import { type ReactNode } from 'react';
import { CartConfirmationContext, useCartConfirmationState } from '@/contexts/cart-confirmation-context';
import CartConfirmationSheet from '@/components/customer/cart-confirmation-sheet';

interface Props {
    children: ReactNode;
}

export default function CartConfirmationProvider({ children }: Props) {
    const { isOpen, data, showConfirmation, hideConfirmation } = useCartConfirmationState();

    return (
        <CartConfirmationContext.Provider value={{ isOpen, data, showConfirmation, hideConfirmation }}>
            {children}
            <CartConfirmationSheet
                open={isOpen}
                onClose={hideConfirmation}
                data={data}
            />
        </CartConfirmationContext.Provider>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/providers/cart-confirmation-provider.tsx
git commit -m "feat: create cart confirmation provider"
```

---

### Task 3: Create Cart Confirmation Sheet Component

**Files:**
- Create: `resources/js/components/customer/cart-confirmation-sheet.tsx`

- [ ] **Step 1: Create component file**

```tsx
import { router } from '@inertiajs/react';
import { CheckCircle, ShoppingCart, ArrowRight } from 'lucide-react';
import BottomSheet from '@/components/ui/bottom-sheet';
import { formatCurrency } from '@/lib/format';
import type { CartConfirmationData } from '@/contexts/cart-confirmation-context';

interface Props {
    open: boolean;
    onClose: () => void;
    data: CartConfirmationData | null;
}

export default function CartConfirmationSheet({ open, onClose, data }: Props) {
    if (!data) return null;

    const handleCheckout = () => {
        onClose();
        router.get('/customer/checkout');
    };

    const handleContinueShopping = () => {
        onClose();
    };

    return (
        <BottomSheet open={open} onClose={onClose} title="Produk Ditambahkan">
            <div className="space-y-4">
                {/* Success Message */}
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4">
                    <CheckCircle className="h-8 w-8 shrink-0 text-emerald-600" />
                    <div>
                        <div className="text-sm font-semibold text-emerald-800">Berhasil ditambahkan!</div>
                        <div className="text-xs text-emerald-600">Produk sudah ada di keranjang Anda</div>
                    </div>
                </div>

                {/* Product Info */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">{data.productName}</div>
                    {data.variantName && (
                        <div className="mt-0.5 text-xs text-zinc-500">{data.variantName}</div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Jumlah: {data.quantity}</span>
                        <span className="text-sm font-semibold text-emerald-700">{formatCurrency(data.price * data.quantity)}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                    <button
                        onClick={handleCheckout}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white active:bg-emerald-700"
                    >
                        <ShoppingCart className="h-4 w-4" />
                        Cek Keranjang
                        <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handleContinueShopping}
                        className="w-full rounded-xl border border-zinc-200 py-3 text-sm font-semibold text-slate-700 active:bg-zinc-50"
                    >
                        Lanjut Belanja
                    </button>
                </div>
            </div>
        </BottomSheet>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/customer/cart-confirmation-sheet.tsx
git commit -m "feat: create cart confirmation bottom sheet component"
```

---

### Task 4: Wrap Apps with Provider

**Files:**
- Modify: `resources/js/customer-app.tsx`
- Modify: `resources/js/app.tsx`

- [ ] **Step 1: Update customer-app.tsx**

```tsx
import CartConfirmationProvider from '@/providers/cart-confirmation-provider';

// In render:
<CartConfirmationProvider>
    <App {...props} />
</CartConfirmationProvider>
```

- [ ] **Step 2: Update app.tsx**

Same pattern as customer-app.tsx.

- [ ] **Step 3: Commit**

```bash
git add resources/js/customer-app.tsx resources/js/app.tsx
git commit -m "feat: wrap apps with cart confirmation provider"
```

---

### Task 5: Update Product Detail Page

**Files:**
- Modify: `resources/js/pages/customer/product-detail.tsx`

- [ ] **Step 1: Import and use context**

```tsx
import { useCartConfirmation } from '@/contexts/cart-confirmation-context';

// In component:
const { showConfirmation } = useCartConfirmation();
```

- [ ] **Step 2: Replace toast with showConfirmation**

```tsx
// Replace toast.success(...) with:
showConfirmation({
    productName: data.item?.name ?? family.name,
    variantName: data.item?.variant_name,
    quantity: quantity,
    price: selectedVariant.selling_price,
});
```

- [ ] **Step 3: Remove toast import and styles**

Remove `import { toast } from 'sonner'` and any toast-related code.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/customer/product-detail.tsx
git commit -m "feat: use cart confirmation sheet instead of toast on product detail"
```

---

### Task 6: Update Variant List Item

**Files:**
- Modify: `resources/js/components/customer/variant-list-item.tsx`

- [ ] **Step 1: Import and use context**

```tsx
import { useCartConfirmation } from '@/contexts/cart-confirmation-context';

// In component:
const { showConfirmation } = useCartConfirmation();
```

- [ ] **Step 2: Replace inline toast with showConfirmation**

```tsx
// After successful add:
showConfirmation({
    productName: familyName,
    variantName: variant.name,
    quantity: 1,
    price: variant.selling_price,
});
```

- [ ] **Step 3: Remove local toast state**

Remove `const [toast, setToast] = useState(false)` and related code.

- [ ] **Step 4: Commit**

```bash
git add resources/js/components/customer/variant-list-item.tsx
git commit -m "feat: use cart confirmation sheet in variant list item"
```

---

### Task 7: Update Size Selector Sheet

**Files:**
- Modify: `resources/js/components/customer/size-selector-sheet.tsx`

- [ ] **Step 1: Import and use context**

```tsx
import { useCartConfirmation } from '@/contexts/cart-confirmation-context';

// In component:
const { showConfirmation } = useCartConfirmation();
```

- [ ] **Step 2: Add confirmation after add**

```tsx
// After successful add:
showConfirmation({
    productName: familyName,
    variantName: selectedVariant.size,
    quantity: quantity,
    price: selectedVariant.selling_price,
});
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/customer/size-selector-sheet.tsx
git commit -m "feat: use cart confirmation sheet in size selector"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Build frontend: `npm run build`
3. Test all add-to-cart flows:
   - Product detail page → Bottom sheet appears
   - Variant list item (quick add) → Bottom sheet appears
   - Size selector sheet → Bottom sheet appears
4. Verify sheet shows correct product info
5. Verify "Cek Keranjang" navigates to checkout
6. Verify "Lanjut Belanja" closes sheet

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Create Cart Confirmation Context | 0.5d |
| 2 | Create Cart Confirmation Provider | 0.5d |
| 3 | Create Cart Confirmation Sheet | 1d |
| 4 | Wrap Apps with Provider | 0.5d |
| 5 | Update Product Detail Page | 0.5d |
| 6 | Update Variant List Item | 0.5d |
| 7 | Update Size Selector Sheet | 0.5d |
| **Total** | | **4d** |

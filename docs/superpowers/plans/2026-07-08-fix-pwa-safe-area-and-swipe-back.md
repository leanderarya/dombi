# Fix PWA Safe Area & Swipe Back Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two iOS PWA issues — profile page safe area padding, and home page swipe-back behavior.

**Architecture:** Profile page needs `pt-safe` instead of hardcoded `pt-8`. Bottom nav needs `replace` visit for home link to prevent browser history stack.

**Tech Stack:** React, Inertia.js, Tailwind CSS, Laravel

---

## Files to Modify

- `resources/js/pages/customer/profile.tsx` — safe area fix
- `resources/js/components/customer/bottom-nav.tsx` — swipe back fix

---

### Task 1: Fix Profile Page Safe Area

**Files:**
- Modify: `resources/js/pages/customer/profile.tsx:22`

- [ ] **Step 1: Replace hardcoded `pt-8` with `pt-safe`**

Change line 22 from:
```tsx
<div className="pt-8" />
```
to:
```tsx
<div className="pt-safe" />
```

Also update the comment on line 21 to reflect the change:
```tsx
{/* PWA safe area spacer */}
```

- [ ] **Step 2: Verify**

Open profile page on iOS PWA — top content should respect safe area inset (not clipped under status bar).

---

### Task 2: Fix Home Page Swipe Back

**Files:**
- Modify: `resources/js/components/customer/bottom-nav.tsx:31-43`

**Problem:** `<Link href="/customer/home">` pushes to browser history. When user navigates from another page to home via bottom nav, swipe back returns to previous page — but home is the root page, should not have back navigation.

**Solution:** Replace default `<Link>` with `onClick` handler that uses `router.visit()` with `replace: true` for the home link. This replaces the current history entry instead of pushing a new one.

- [ ] **Step 1: Add `router` import**

Change line 1 from:
```tsx
import { Link, usePage } from '@inertiajs/react';
```
to:
```tsx
import { Link, router, usePage } from '@inertiajs/react';
```

- [ ] **Step 2: Replace Link with conditional replace logic**

Replace the `<Link>` inside the map (lines 31-43) with:

```tsx
{item.href === '/customer/home' ? (
    <button
        key={item.href}
        onClick={() => router.visit(item.href, { replace: true })}
        className={`flex flex-col items-center justify-center gap-0.5 text-xs ${
            active ? 'text-primary font-bold' : 'text-zinc-400 font-medium'
        }`}
    >
        <div className="p-1.5">
            <Icon active={active} />
        </div>
        <span>{item.label}</span>
    </button>
) : (
    <Link
        key={item.href}
        href={item.href}
        className={`flex flex-col items-center justify-center gap-0.5 text-xs ${
            active ? 'text-primary font-bold' : 'text-zinc-400 font-medium'
        }`}
    >
        <div className="p-1.5">
            <Icon active={active} />
        </div>
        <span>{item.label}</span>
    </Link>
)}
```

- [ ] **Step 3: Verify**

1. Go to Produk page
2. Click Beranda on bottom nav
3. Try swipe back — should NOT go back to Produk (history replaced)
4. Navigate to other tabs — those should still have normal back behavior

---

## Verification Checklist

- [ ] Profile page: top content not clipped under iOS status bar in PWA mode
- [ ] Home page: swipe back does NOT work after clicking Beranda from another tab
- [ ] Other tabs (Produk, Pesanan, Akun): normal navigation preserved
- [ ] Desktop: both changes work identically (no regression)

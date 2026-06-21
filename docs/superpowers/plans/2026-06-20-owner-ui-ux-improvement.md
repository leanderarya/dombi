# Owner Pages UI/UX Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize and improve the UI/UX of Owner pages for desktop, focusing on consistent typography, unified color tokens, improved copywriting, and cohesive component patterns

**Architecture:** Incremental improvements to existing components, establishing consistent design tokens and patterns across all Owner pages

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Inertia.js

---

## Current State Analysis

### Design System Audit

| Aspect | Current State | Issue |
|--------|---------------|-------|
| **Font** | Public Sans (400, 500, 600, 700) | Consistent, no issues |
| **Colors** | Mixed `zinc-*` and `slate-*` | **CRITICAL** - subtle but visible inconsistency |
| **Buttons** | Multiple variants, no shared component | Inconsistent heights, colors, radius |
| **Tables** | Mix of DataTable and custom tables | Inconsistent styling |
| **Inputs** | No shared component | Different borders, focus states, heights |
| **Empty States** | Mix of EmptyState and inline | Inconsistent usage |
| **Copywriting** | Mixed Indonesian/English | Some labels in English, should be Indonesian |
| **Page Subtitles** | Some pages missing | Inconsistent page context |

### Color Palette Issues

**Neutral colors mixed:**
- `zinc-200` borders (KPI cards, SectionCard, sidebar)
- `slate-200` borders (ActionCard, DataTable, modals, form inputs)
- `zinc-900` text (KPI card, sidebar)
- `slate-900` text (ActionCard, DataTable, page title)

**Recommendation:** Standardize on `zinc-*` for all neutral colors (better contrast, more neutral).

### Button Inconsistencies

| Location | Height | Color | Radius | Weight |
|----------|--------|-------|--------|--------|
| Page header "Tambah" | `h-9` | `emerald-700` | `rounded-lg` | `font-semibold` |
| Dashboard hero CTA | `min-h-11` | `zinc-900` | `rounded-lg` | `font-semibold` |
| Empty state CTA | `min-h-[36px]` | `emerald-700` | `rounded-lg` | `font-semibold` |
| Modal submit | `min-h-[48px]` | `emerald-600` | `rounded-xl` | `font-bold` |
| Table actions | `min-h-[32px]` | varies | `rounded-md` | `font-semibold` |

### Copywriting Issues

**English labels that should be Indonesian:**
- "Returns" → "Pengembalian"
- "Exchanges" → "Penukaran"
- "Dashboard" (nav group) → "Dasbor"
- "SKU" → keep as is (industry term)
- "KPI" → keep as is (industry term)

**Missing subtitles:**
- Orders page: no subtitle
- Inventories page: no subtitle
- Stock movements page: no subtitle

---

## Implementation Tasks

### Task 1: Establish Unified Color Tokens

**Goal:** Replace all `slate-*` with `zinc-*` for consistent neutral colors

**Files to modify:**
- `resources/js/components/owner/owner-action-card.tsx`
- `resources/js/components/owner/owner-page-shell.tsx`
- `resources/js/components/ui/data-table.tsx`
- `resources/js/components/ui/section-card.tsx`
- `resources/js/components/ui/empty-state.tsx`
- `resources/js/components/ui/status-badge.tsx`
- `resources/js/pages/owner/dashboard.tsx`
- `resources/js/pages/owner/orders/index.tsx`
- `resources/js/pages/owner/pricing/master.tsx`
- `resources/js/pages/owner/pricing/outlet.tsx`
- `resources/js/pages/owner/inventories/index.tsx`

**Changes:**

1. **Replace all `slate-*` with `zinc-*`:**
   - `border-slate-200` → `border-zinc-200`
   - `text-slate-900` → `text-zinc-900`
   - `text-slate-500` → `text-zinc-500`
   - `text-slate-400` → `text-zinc-400`
   - `text-slate-600` → `text-zinc-600`
   - `text-slate-700` → `text-zinc-700`
   - `bg-slate-50` → `bg-zinc-50`
   - `hover:bg-slate-50` → `hover:bg-zinc-50`

2. **Verify with grep:**
```bash
grep -r "slate-" resources/js/components/owner/ resources/js/pages/owner/ --include="*.tsx" | wc -l
# Should be 0 after changes
```

3. **Commit:**
```bash
git add -A
git commit -m "refactor: unify neutral colors from slate to zinc across owner pages"
```

---

### Task 2: Create Shared Button Component

**Goal:** Create a reusable Button component with consistent variants

**Files to create:**
- `resources/js/components/ui/button.tsx`

**Implementation:**

```tsx
import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    icon?: React.ComponentType<{ className?: string }>;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-emerald-700 text-white hover:bg-emerald-800 focus:ring-emerald-500',
    secondary: 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50 focus:ring-zinc-500',
    danger: 'border border-red-200 text-red-700 hover:bg-red-50 focus:ring-red-500',
    ghost: 'text-zinc-700 hover:bg-zinc-100 focus:ring-zinc-500',
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs rounded-md',
    md: 'h-9 px-4 text-sm rounded-lg',
    lg: 'min-h-11 px-6 text-sm rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'primary', size = 'md', loading, icon: Icon, children, className = '', disabled, ...props }, ref) => {
        return (
            <button
                ref={ref}
                disabled={disabled || loading}
                className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
                {...props}
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : Icon ? (
                    <Icon className="h-4 w-4" />
                ) : null}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
```

**Commit:**
```bash
git add resources/js/components/ui/button.tsx
git commit -m "feat: add shared Button component with consistent variants"
```

---

### Task 3: Create Shared Input Component

**Goal:** Create reusable Input component with consistent styling

**Files to create:**
- `resources/js/components/ui/input.tsx`

**Implementation:**

```tsx
import { type InputHTMLAttributes, forwardRef } from 'react';
import { Search } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ComponentType<{ className?: string }>;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, icon: Icon, className = '', ...props }, ref) => {
        return (
            <div className="space-y-1">
                {label && (
                    <label className="text-sm font-medium text-zinc-700">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {Icon && (
                        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    )}
                    <input
                        ref={ref}
                        className={`w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm transition-colors placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${Icon ? 'pl-10' : ''} ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''} ${className}`}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="text-xs text-red-600">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

interface SearchInputProps extends Omit<InputProps, 'icon'> {}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
    (props, ref) => {
        return <Input ref={ref} icon={Search} {...props} />;
    }
);

SearchInput.displayName = 'SearchInput';
```

**Commit:**
```bash
git add resources/js/components/ui/input.tsx
git commit -m "feat: add shared Input and SearchInput components"
```

---

### Task 4: Create Shared Select Component

**Goal:** Create reusable Select component

**Files to create:**
- `resources/js/components/ui/select.tsx`

**Implementation:**

```tsx
import { type SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, error, options, className = '', ...props }, ref) => {
        return (
            <div className="space-y-1">
                {label && (
                    <label className="text-sm font-medium text-zinc-700">
                        {label}
                    </label>
                )}
                <select
                    ref={ref}
                    className={`w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''} ${className}`}
                    {...props}
                >
                    {options.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {error && (
                    <p className="text-xs text-red-600">{error}</p>
                )}
            </div>
        );
    }
);

Select.displayName = 'Select';
```

**Commit:**
```bash
git add resources/js/components/ui/select.tsx
git commit -m "feat: add shared Select component"
```

---

### Task 5: Update OwnerPageShell with Consistent Typography

**Goal:** Improve page header with consistent typography and add subtitle support

**Files to modify:**
- `resources/js/components/owner/owner-page-shell.tsx`

**Changes:**

1. **Update title typography:**
```tsx
// Before:
<h1 className="text-lg font-semibold text-slate-900">{title}</h1>

// After:
<h1 className="text-xl font-semibold text-zinc-900 tracking-tight">{title}</h1>
```

2. **Update subtitle typography:**
```tsx
// Before:
<p className="text-xs text-slate-500">{subtitle}</p>

// After:
<p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>
```

3. **Commit:**
```bash
git add resources/js/components/owner/owner-page-shell.tsx
git commit -m "refactor: improve OwnerPageShell typography and spacing"
```

---

### Task 6: Update OwnerKpiCard with Consistent Styling

**Goal:** Ensure KPI cards use consistent zinc colors and improved typography

**Files to modify:**
- `resources/js/components/owner/owner-kpi-card.tsx`

**Changes:**

1. **Update border and text colors:**
```tsx
// Before:
<div className="rounded-xl border border-zinc-200 bg-white p-4">

// After (consistent):
<div className="rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300">
```

2. **Update label typography:**
```tsx
// Before:
<span className="text-xs font-medium text-zinc-500">{label}</span>

// After:
<span className="text-xs font-medium text-zinc-500 tracking-wide">{label}</span>
```

3. **Update value typography:**
```tsx
// Before:
<span className="text-2xl font-semibold tabular-nums text-zinc-900">

// After:
<span className="text-2xl font-bold tabular-nums text-zinc-900 tracking-tight">
```

4. **Commit:**
```bash
git add resources/js/components/owner/owner-kpi-card.tsx
git commit -m "refactor: improve OwnerKpiCard typography and hover states"
```

---

### Task 7: Update OwnerActionCard with Consistent Styling

**Goal:** Unify ActionCard styling with zinc colors

**Files to modify:**
- `resources/js/components/owner/owner-action-card.tsx`

**Changes:**

1. **Replace all slate with zinc:**
```tsx
// Before:
className="rounded-xl border border-slate-200 bg-white px-3 py-3"

// After:
className="rounded-xl border border-zinc-200 bg-white px-3 py-3"
```

2. **Update text colors:**
```tsx
// Before:
<span className="text-sm font-semibold text-slate-900">{title}</span>
<span className="text-[11px] text-slate-500">{subtitle}</span>

// After:
<span className="text-sm font-semibold text-zinc-900">{title}</span>
<span className="text-[11px] text-zinc-500">{subtitle}</span>
```

3. **Commit:**
```bash
git add resources/js/components/owner/owner-action-card.tsx
git commit -m "refactor: unify OwnerActionCard with zinc colors"
```

---

### Task 8: Update Dashboard with Improved Copywriting

**Goal:** Improve dashboard copywriting and add missing subtitles

**Files to modify:**
- `resources/js/pages/owner/dashboard.tsx`

**Changes:**

1. **Update hero section copy:**
```tsx
// Before:
<h2 className="text-xl font-bold text-white">Dasbor Keputusan</h2>
<p className="mt-1 text-sm text-zinc-400">Ringkasan operasional hari ini</p>

// After:
<h2 className="text-xl font-bold text-white tracking-tight">Dasbor Keputusan</h2>
<p className="mt-1 text-sm text-zinc-400">Ringkasan operasional dan keputusan yang perlu diambil</p>
```

2. **Update KPI labels for consistency:**
```tsx
// Before:
label: 'Belum Masuk',
label: 'Menunggu Persetujuan',
label: 'Outlet Perlu Perhatian',
label: 'Stok Pusat Kritis',

// After (more descriptive):
label: 'Tagihan Belum Masuk',
label: 'Menunggu Persetujuan',
label: 'Outlet Perlu Perhatian',
label: 'Stok Pusat Kritis',
```

3. **Commit:**
```bash
git add resources/js/pages/owner/dashboard.tsx
git commit -m "refactor: improve dashboard copywriting and descriptions"
```

---

### Task 9: Update Orders Page with Subtitle

**Goal:** Add missing subtitle to orders page

**Files to modify:**
- `resources/js/pages/owner/orders/index.tsx`

**Changes:**

1. **Add subtitle to OwnerPageShell:**
```tsx
// Before:
<OwnerPageShell title="Pesanan">

// After:
<OwnerPageShell title="Pesanan" subtitle="Kelola semua pesanan dari semua outlet">
```

2. **Commit:**
```bash
git add resources/js/pages/owner/orders/index.tsx
git commit -m "feat: add subtitle to orders page"
```

---

### Task 10: Update Inventories Page with Subtitle

**Goal:** Add missing subtitle to inventories page

**Files to modify:**
- `resources/js/pages/owner/inventories/index.tsx`

**Changes:**

1. **Add subtitle to OwnerPageShell:**
```tsx
// Before:
<OwnerPageShell title="Inventaris">

// After:
<OwnerPageShell title="Inventaris" subtitle="Pantau stok semua outlet dan pusat">
```

2. **Commit:**
```bash
git add resources/js/pages/owner/inventories/index.tsx
git commit -m "feat: add subtitle to inventories page"
```

---

### Task 11: Update Pricing Pages with Consistent Styling

**Goal:** Unify pricing page tables with consistent styling

**Files to modify:**
- `resources/js/pages/owner/pricing/master.tsx`
- `resources/js/pages/owner/pricing/outlet.tsx`

**Changes:**

1. **Update master.tsx table styling:**
```tsx
// Before:
<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">

// After:
<div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
```

2. **Update table headers:**
```tsx
// Before:
className="text-[11px] font-bold uppercase tracking-wider text-slate-400"

// After:
className="text-[11px] font-bold uppercase tracking-wider text-zinc-400"
```

3. **Commit:**
```bash
git add resources/js/pages/owner/pricing/master.tsx resources/js/pages/owner/pricing/outlet.tsx
git commit -m "refactor: unify pricing page styling with zinc colors"
```

---

### Task 12: Update Sidebar Navigation Labels

**Goal:** Translate English labels to Indonesian

**Files to modify:**
- `resources/js/components/owner/owner-sidebar-nav.tsx`

**Changes:**

1. **Update navigation labels:**
```tsx
// Before:
{ label: 'Returns', href: '/owner/returns' },
{ label: 'Exchanges', href: '/owner/exchanges' },

// After:
{ label: 'Pengembalian', href: '/owner/returns' },
{ label: 'Penukaran', href: '/owner/exchanges' },
```

2. **Update group labels if needed:**
```tsx
// Before:
{ group: 'Dashboard', items: [...] },

// After:
{ group: 'Dasbor', items: [...] },
```

3. **Commit:**
```bash
git add resources/js/components/owner/owner-sidebar-nav.tsx
git commit -m "refactor: translate sidebar labels to Indonesian"
```

---

### Task 13: Update DataTable Component

**Goal:** Ensure DataTable uses consistent zinc colors

**Files to modify:**
- `resources/js/components/ui/data-table.tsx`

**Changes:**

1. **Update header styling:**
```tsx
// Before:
className="text-[11px] font-bold uppercase tracking-wider text-slate-400"

// After:
className="text-[11px] font-bold uppercase tracking-wider text-zinc-400"
```

2. **Update empty state styling:**
```tsx
// Before:
<Inbox className="mx-auto h-12 w-12 text-slate-400" />
<p className="mt-2 text-sm font-medium text-slate-600">...</p>
<p className="mt-1 text-xs text-slate-400">...</p>

// After:
<Inbox className="mx-auto h-12 w-12 text-zinc-400" />
<p className="mt-2 text-sm font-medium text-zinc-600">...</p>
<p className="mt-1 text-xs text-zinc-400">...</p>
```

3. **Commit:**
```bash
git add resources/js/components/ui/data-table.tsx
git commit -m "refactor: update DataTable with consistent zinc colors"
```

---

### Task 14: Update EmptyState Component

**Goal:** Ensure EmptyState uses consistent zinc colors

**Files to modify:**
- `resources/js/components/ui/empty-state.tsx`

**Changes:**

1. **Update colors:**
```tsx
// Before:
<Inbox className="mx-auto h-12 w-12 text-slate-400" />
<p className="text-sm font-medium text-slate-600">...</p>
<p className="text-xs text-slate-400">...</p>

// After:
<Inbox className="mx-auto h-12 w-12 text-zinc-400" />
<p className="text-sm font-medium text-zinc-600">...</p>
<p className="text-xs text-zinc-400">...</p>
```

2. **Update button colors:**
```tsx
// Before:
className="min-h-11 rounded-lg bg-emerald-700 text-sm font-semibold text-white"

// After (consistent with Button component):
className="min-h-11 rounded-lg bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800"
```

3. **Commit:**
```bash
git add resources/js/components/ui/empty-state.tsx
git commit -m "refactor: update EmptyState with consistent zinc colors"
```

---

### Task 15: Update StatusBadge Component

**Goal:** Ensure StatusBadge uses consistent zinc colors for neutral variant

**Files to modify:**
- `resources/js/components/ui/status-badge.tsx`

**Changes:**

1. **Update neutral variant:**
```tsx
// Before:
neutral: 'bg-slate-50 text-slate-600 ring-slate-200',

// After:
neutral: 'bg-zinc-50 text-zinc-600 ring-zinc-200',
```

2. **Commit:**
```bash
git add resources/js/components/ui/status-badge.tsx
git commit -m "refactor: update StatusBadge neutral variant to zinc"
```

---

## Verification

After completing all tasks:

1. **Run full test suite:**
```bash
php artisan test
```

2. **Build frontend:**
```bash
npm run build
```

3. **Verify no slate colors remain:**
```bash
grep -r "slate-" resources/js/components/owner/ resources/js/pages/owner/ --include="*.tsx" | wc -l
# Should be 0
```

4. **Manual testing checklist:**
   - [ ] Dashboard loads with consistent colors
   - [ ] All KPI cards look consistent
   - [ ] Action cards have consistent styling
   - [ ] Tables use consistent styling
   - [ ] Buttons look consistent across pages
   - [ ] Forms have consistent input styling
   - [ ] Empty states look consistent
   - [ ] Sidebar labels are in Indonesian
   - [ ] Page subtitles are present on all pages
   - [ ] Typography is consistent (sizes, weights)

## Summary

| Task | Description | Files Changed | Est. |
|------|-------------|---------------|------|
| 1 | Unify color tokens (slate → zinc) | 11 | 1h |
| 2 | Create shared Button component | 1 | 0.5h |
| 3 | Create shared Input component | 1 | 0.5h |
| 4 | Create shared Select component | 1 | 0.5h |
| 5 | Update OwnerPageShell typography | 1 | 0.5h |
| 6 | Update OwnerKpiCard styling | 1 | 0.5h |
| 7 | Update OwnerActionCard styling | 1 | 0.5h |
| 8 | Update Dashboard copywriting | 1 | 0.5h |
| 9 | Add Orders page subtitle | 1 | 0.25h |
| 10 | Add Inventories page subtitle | 1 | 0.25h |
| 11 | Update Pricing pages styling | 2 | 0.5h |
| 12 | Update Sidebar labels | 1 | 0.5h |
| 13 | Update DataTable component | 1 | 0.5h |
| 14 | Update EmptyState component | 1 | 0.5h |
| 15 | Update StatusBadge component | 1 | 0.25h |
| **Total** | | **25 files** | **~7h** |

---

## Design Decisions for Review

### 1. Color System
**Decision:** Standardize on `zinc-*` for all neutral colors
**Rationale:** More neutral, better contrast, consistent with modern design systems
**Alternative:** Use `slate-*` (warmer, more friendly) or `gray-*` (most neutral)

### 2. Typography Scale
**Decision:** Keep current scale but improve consistency
- Page title: `text-xl font-semibold tracking-tight`
- Section title: `text-base font-semibold`
- Body: `text-sm`
- Caption: `text-xs`
- Tiny: `text-[11px]`

**Rationale:** Current scale works well, just needs consistent application

### 3. Button System
**Decision:** Create shared Button component with 4 variants
- Primary: `emerald-700` (main actions)
- Secondary: `zinc-200` border (secondary actions)
- Danger: `red-200` border (destructive actions)
- Ghost: no border (tertiary actions)

**Rationale:** Covers all use cases, consistent with current patterns

### 4. Copywriting Language
**Decision:** Full Indonesian with industry terms kept in English
- Keep: SKU, KPI, Dashboard (as title)
- Translate: Returns → Pengembalian, Exchanges → Penukaran

**Rationale:** Target audience is Indonesian, industry terms are universally understood

### 5. Spacing System
**Decision:** Keep current spacing scale
- Page padding: `px-6 py-5`
- Card padding: `p-4` (KPI), `p-5` (section)
- Grid gaps: `gap-3` (compact), `gap-4` (normal)

**Rationale:** Current spacing is consistent and works well

---

## Questions for Claude Review

1. **Color System:** Is `zinc-*` the best choice for neutral colors, or would `slate-*` or `gray-*` be better for a commerce platform?

2. **Typography:** Should we consider using different fonts for headings vs body, or keep Public Sans throughout?

3. **Button System:** Should the dashboard hero CTA use `emerald-700` (consistent) or `zinc-900` (visual hierarchy)?

4. **Copywriting:** Should we keep "Dashboard" as a nav group label or translate it to "Dasbor"?

5. **Border Radius:** Should we standardize on `rounded-xl` or `rounded-2xl` for cards?

6. **Component Strategy:** Should we create shared components (Button, Input, Select) or use utility classes with Tailwind?

7. **Spacing:** Is the current spacing scale optimal, or should we adjust for better visual hierarchy?

8. **Mobile vs Desktop:** Should we have different styling for mobile and desktop, or keep it responsive?

9. **Animation:** Should we add more micro-interactions (hover states, transitions) or keep it minimal?

10. **Accessibility:** Are there any accessibility improvements we should make while refactoring?

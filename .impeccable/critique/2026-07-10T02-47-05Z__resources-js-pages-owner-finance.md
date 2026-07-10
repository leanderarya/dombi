---
target: resources/js/pages/owner/finance
total_score: 26
p0_count: 0
p1_count: 2
timestamp: 2026-07-10T02-47-05Z
slug: resources-js-pages-owner-finance
---
Method: dual-agent (A: general · B: general)

# Design Critique: Owner Finance Pages

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons, processing states, toast feedback present |
| 2 | Match System / Real World | 3 | Indonesian terminology matches business domain |
| 3 | User Control and Freedom | 3 | Cancel buttons, back navigation, filter resets |
| 4 | Consistency and Standards | 3 | Uniform badge system, consistent button styles |
| 5 | Error Prevention | 3 | Confirmation dialogs for destructive actions |
| 6 | Recognition Rather Than Recall | 3 | Color-coded statuses, contextual empty states |
| 7 | Flexibility and Efficiency | 2 | Batch verify exists, but mobile table blocks efficiency |
| 8 | Aesthetic and Minimalist Design | 3 | Clean hierarchy, no decorative noise |
| 9 | Error Recovery | 2 | Rejection flow good; form validation feedback unclear |
| 10 | Help and Documentation | 2 | Empty states guide, no contextual help on financial terms |
| **Total** | | **26/40** | **Good — address weak areas** |

## Anti-Patterns Verdict

**LLM assessment:** Clean. No gradient text, glassmorphism, hero-metric template, numbered section markers, or identical card grids. The `text-xs uppercase tracking-wide` KPI labels are standard product UI.

**Deterministic scan:** Zero violations. `detect.mjs` returned empty array — no hits for side-stripe borders, contrast failures, overflow issues, nested cards, or any impeccable rule.

## Overall Impression

Solid product UI. The semantic color system is rigorous (red=overdue, amber=pending, emerald=paid), loading/empty states are production-grade, and interactive state coverage is comprehensive. Two structural issues hold it back: the mobile table and duplicated financial summary.

## What's Working

1. **Semantic color system** — Status badges, filter chips, and inline text use consistent color language. Users learn the system once and scan any page.
2. **Loading and empty states** — Skeleton placeholders match final layouts. Empty states vary by context (search vs filter vs no-data) with actionable copy.
3. **Interactive state coverage** — Buttons have default, hover, disabled, loading states. Cards have hover feedback. Focus rings visible.

## Priority Issues

### [P1] Table on mobile breaks primary use case
**What:** `rekening-tab.tsx:114` uses `min-w-[600px]` table — horizontal scroll on phones.
**Why it matters:** Owners manage finances on-the-go. 600px table unreadable on mobile.
**Fix:** Convert to card-based layout. Each account = stacked card with label-value pairs. Edit/delete become bottom actions or swipe.

### [P1] Duplicate financial summary on outlet detail
**What:** `outlet-detail.tsx:115-130` (Summary card) and `outlet-detail.tsx:191-209` (Status sidebar) show identical data: Omset, Sisa, Keterlambatan.
**Why it matters:** Same numbers twice = cognitive noise, uncertainty about source of truth.
**Fix:** Keep sidebar as single status reference. Replace summary card with settlement list only, or remove sidebar.

### [P2] Auto-redirect on pembayaran tab is disorienting
**What:** `pembayaran-tab.tsx:32-36` silently redirects to `?status=pending_verification`.
**Why it matters:** Users clicking "Pembayaran" expect all payments. Silent redirect hides full picture.
**Fix:** Remove auto-redirect. Default to showing all payments. Let users filter manually.

### [P2] Redundant CTA on FinanceOutletCard
**What:** Card shows "Lihat Detail" button, but entire card is already a `<Link>` with chevron.
**Why it matters:** Two affordances for one action = visual noise without added discoverability.
**Fix:** Remove "Lihat Detail" button. Keep chevron as navigation indicator.

### [P3] Rejection textarea lacks clear boundaries
**What:** `pembayaran-tab.tsx:155-161` — textarea inside red-bordered container, boundaries unclear.
**Why it matters:** Users can't see where to type, especially on mobile.
**Fix:** Add explicit `border border-red-300 bg-white` to textarea.

## Persona Red Flags

**Casey (mobile user):** Accounts table `min-w-[600px]` unusable on phones. Sticky action bar on outlet detail may occlude content on small viewports.

**Jordan (first-timer):** Financial terminology ("Verifikasi", "Tagihan", "Rekening") without tooltips. "Semua" filter redirects silently — confusing default behavior.

## Minor Observations

- KPI strip `uppercase tracking-wide` labels slightly heavy — consider `tracking-normal`
- `PartyPopper` icon in empty states adds personality but may feel inconsistent with utilitarian aesthetic

## Questions to Consider

1. How many payment accounts does a typical owner have? If 1-3, card layout simpler than table.
2. Is the sticky action bar necessary for long settlement lists, or could it be static at top?
3. Should pembayaran default to "Semua" instead of auto-filtering to "Pending"?

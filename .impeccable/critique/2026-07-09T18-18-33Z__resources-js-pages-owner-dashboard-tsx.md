---
target: page dasbor owner
total_score: 27
p0_count: 0
p1_count: 2
timestamp: 2026-07-09T18-18-33Z
slug: resources-js-pages-owner-dashboard-tsx
---
Method: dual-agent (A: design-review · B: detector-evidence)

## Design Health Score

| # | Heuristic | Score | Delta | Key Issue |
|---|-----------|-------|-------|-----------|
| 1 | Visibility of System Status | 3 | — | Polling, counts, badges solid |
| 2 | Match System / Real World | 3 | — | Indonesian terms clear, severity maps well |
| 3 | User Control and Freedom | 3 | +1 | Dismiss + pre-populated restock. Still no undo for dismiss |
| 4 | Consistency and Standards | 2 | — | Distinct colors help, identical row structure undermines |
| 5 | Error Prevention | 3 | +1 | Defensive `??`, proper aria-labels, empty states |
| 6 | Recognition Rather Than Recall | 3 | — | Color coding + severity gradients aid recognition |
| 7 | Flexibility and Efficiency of Use | 2 | +1 | Pre-populated restock saves a step. No bulk, no keyboard |
| 8 | Aesthetic and Minimalist Design | 2 | — | Colors help, but uppercase eyebrows + identical structure persist |
| 9 | Error Recovery | 3 | +1 | Good empty states, defensive coding |
| 10 | Help and Documentation | 3 | +1 | Inline labels (Kurang, Terlambat, menunggu) are helpful |
| **Total** | | **27/40** | **+5** | **Good — address weak areas** |

## Anti-Patterns Verdict

**Improved.** Distinct icon colors (amber/rose/violet/blue) and severity gradients (amber→red) eliminate the "identical card" tell. Settlement dismiss adds real user control.

**Remaining tell**: Uppercase eyebrows (`text-xs font-bold uppercase tracking-wide`) on all 3 section headers (lines 214, 248, 296). This is the single strongest AI slop signal left.

**Detector**: 0 TSX findings, 3 CSS warnings (products-header collapse, not dashboard). Manual scan: 1/8 anti-patterns (uppercase eyebrows).

## What Improved

1. **Color differentiation**: Each action type has a unique icon color. Stock severity uses a 3-tier gradient. This is genuine information encoding.
2. **Dismiss with persistence**: `useDismissedAlerts()` hook backed by localStorage. Filters active alerts. Proper `aria-label` on dismiss button.
3. **Pre-populated restock**: `?variant_id=` removes a real friction point.
4. **Accessibility**: `aria-label` on hero bar, `aria-hidden` on decorative icons, `<section>` landmarks, defensive `??` on nullable arrays.

## Remaining Priority Issues

### [P1] Uppercase eyebrows on every section
**What**: Lines 214, 248, 296 — identical `text-xs font-bold uppercase tracking-wide` pattern.
**Why it matters**: Strongest remaining AI tell. Adds visual noise without hierarchy — the section is already grouped.
**Fix**: Remove `uppercase tracking-wide`. Use `text-xs font-medium text-text-muted` or rely on visual grouping alone.
**Suggested command**: `/impeccable quieter`

### [P1] Identical action item row structure
**What**: All 4 action types use the same `icon | label + count | chevron` layout (lines 220-235).
**Why it matters**: Color differentiates, but shape/weight/emphasis don't. Each row tells the same story.
**Fix**: Vary the layout — restock could show a mini bar, returns could show oldest date, exchanges could show outlet name.
**Suggested command**: `/impeccable layout`

### [P2] No undo for dismiss
**What**: Dismiss is one-way (line 316-319). No recovery path.
**Why it matters**: Owner dismisses wrong outlet, must clear localStorage to recover.
**Fix**: Add a toast with "Undo" (5s timeout) or a "dismissed" restore option.
**Suggested command**: `/impeccable harden`

### [P2] Unbounded stock list
**What**: All critical SKUs render (lines 253-281). 20 items = 20 rows.
**Why it matters**: Dashboard becomes 80% stock alerts. No pagination or collapse.
**Fix**: Show top 5, add "Lihat semua N item" link.
**Suggested command**: `/impeccable layout`

### [P2] Touch targets below 44pt
**What**: Dismiss button `h-7 w-7` = 28px (line 320). Restock button `py-1.5 px-2.5` ≈ 32x24px (line 275). Icon containers `h-7 w-7` = 28px.
**Why it matters**: Below iOS 44pt minimum. Harder to tap on mobile.
**Fix**: Dismiss: `h-8 w-8` minimum with invisible hit area. Restock: `py-2 px-3`.
**Suggested command**: `/impeccable adapt`

### [P3] Hero bar gradient competes with data
**What**: `bg-linear-to-br from-primary to-primary-hover` on a dashboard (line 180).
**Why it matters**: Heavy visual weight competes with actual data below.
**Fix**: Consider solid primary or subtler treatment.
**Suggested command**: `/impeccable quieter`

## Persona Red Flags

**Alex (Power User)**:
- *Improved*: Pre-populated restock saves a step. Urgency sorting means top-to-bottom scanning.
- *Still broken*: No bulk actions (8 restocks = 8 clicks). No keyboard nav. No "mark all as handled."
- *New concern*: Dismiss is localStorage-only. Cross-device sync missing.

**Sam (Accessibility)**:
- *Improved*: aria-labels on hero, section landmarks, aria-hidden on icons, dismiss button labeled.
- *Still broken*: Touch targets 28px (below 44pt). Restock button ~32x24px. No text label for severity (color-only encoding: amber vs red).
- *New concern*: Severity gradients use color alone. No "Rendah"/"Sedang"/"Tinggi" text for colorblind users.

## Questions to Consider

1. Why are actions rows but stock items are cards? Visual weight is inverted — stock *looks* more important than actions.
2. KPI strip "Tagihan" duplicates the hero bar's number and link. Is it always visible? If so, it's redundant.
3. The urgency ranking is hardcoded (restock=1, return=2, exchange=3, payment=4). Should it be data-driven?
4. What happens when all actions are zero? Empty states fill two columns — that's a lot of "nothing to do."
5. Dismiss is one-way. What's the UX recovery path that doesn't involve clearing localStorage?

---
target: page dasbor owner
total_score: 22
p0_count: 0
p1_count: 3
timestamp: 2026-07-09T18-08-32Z
slug: resources-js-pages-owner-dashboard-tsx
---
Method: dual-agent (A: design-review · B: detector-evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | 30s polling + conditional rendering solid |
| 2 | Match System / Real World | 3 | Indonesian domain terms correct |
| 3 | User Control and Freedom | 2 | No dismiss/snooze on alerts, no "mark handled" |
| 4 | Consistency and Standards | 3 | Uniform patterns across sections |
| 5 | Error Prevention | 2 | Restock button doesn't pre-populate variant |
| 6 | Recognition Rather Than Recall | 3 | Counts and context visible |
| 7 | Flexibility and Efficiency of Use | 1 | Zero keyboard shortcuts, no bulk actions, no filtering |
| 8 | Aesthetic and Minimalist Design | 2 | Functional but visually monotonous |
| 9 | Error Recovery | 2 | No undo, no error states shown |
| 10 | Help and Documentation | 1 | No tooltips, no help text, no onboarding |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment**: Yes — AI tells are visible. Every action item uses identical icon containers (`h-6 w-6 rounded bg-amber-100 text-amber-600`). Four sections share the same `text-xs font-bold uppercase tracking-wide text-text-muted` eyebrow pattern. Both empty states duplicate the same CheckCircle2 centered layout. The hero bar follows the standard dashboard-metric template.

**Deterministic scan**: 0 findings on TSX files. 3 CSS warnings for `max-height`/`padding-bottom` transitions in the products-header collapse — acceptable trade-off for a single collapsible element. Manual scan found the repeated uppercase eyebrow pattern across 5+ locations (not flagged by detector since it's a style pattern, not a perf bug).

## Overall Impression

Functional dashboard that correctly identifies the data an Indonesian B2B distribution owner needs. The 30-second polling and conditional rendering show product thinking. But it suffers from flat visual hierarchy — everything has equal weight. The owner opens this and sees a wall of same-looking items with no guidance on what to handle first. The biggest gap: zero efficiency path for power users processing 100+ orders/day.

## What's Working

1. **Smart conditional rendering**: Hero bar only when debt > 0. Action items only when count > 0. Empty states show green checkmarks. Prevents clutter when things are going well.
2. **Effective 30-second polling**: `usePolling(30000)` keeps the dashboard fresh without manual refresh. Operationally critical for a distribution business.
3. **Localized terminology**: "Tukar Produk", "Tagihan Tertunggak", "Stok Kritis" — genuine Indonesian market understanding, not translation.

## Priority Issues

### [P1] No prioritization of action items
**What**: All 4 action types (Restock, Return, Tukar Produk, Pembayaran) have identical visual treatment.
**Why it matters**: In distribution, stockout is more urgent than a return. Owner wastes time deciding what to handle first.
**Fix**: Add urgency indicators. Color-code by severity (red for stockout, amber for returns, blue for payments). Sort by business impact.
**Suggested command**: `/impeccable layout`

### [P1] Restock button doesn't pre-populate variant
**What**: Inside Stok Kritis cards, "Restock" links to `/owner/restocks/create` without `?variant_id=`. User must re-find the item.
**Why it matters**: Extra friction for the most common dashboard action.
**Fix**: Pass `?variant_id={risk.variant.id}` to the restock create URL.
**Suggested command**: Direct code fix

### [P1] No dismissal mechanism for alerts
**What**: Settlement alerts and action items persist with no way to mark as acknowledged.
**Why it matters**: Dashboard becomes a nagging list. Owner can't clear items they've addressed.
**Fix**: Add dismiss/snooze per card. Store state in session/localStorage.
**Suggested command**: `/impeccable layout`

### [P2] Critical stock items don't differentiate severity
**What**: `shortage: 2` looks identical to `shortage: 50`. Both show same red treatment.
**Why it matters**: Owner can't prioritize restocking.
**Fix**: Use color intensity or badge to show severity. Sort by shortage descending.
**Suggested command**: `/impeccable colorize`

### [P2] Action items all look the same
**What**: Restock, Return, Tukar Produk, Pembayaran all use `bg-amber-100 text-amber-600` icon containers.
**Why it matters**: Visual monotony. Can't quickly scan and find a specific section.
**Fix**: Distinct icon colors per type.
**Suggested command**: `/impeccable colorize`

## Persona Red Flags

**Alex (Power User)**: No bulk actions — must click each "Restock" individually. No filtering by outlet/product/urgency. No keyboard shortcuts. Processing 50 restocks/day = 50 mouse clicks. Alex abandons this dashboard for the inventory list page within 2 days.

**Sam (Accessibility)**: Icons (AlertTriangle, Package, RotateCcw) lack aria-labels. Color-only urgency indicators (red = critical) with no text equivalent. No `role="region"` landmarks distinguishing sections. Action item rows at `py-2` likely under 44pt touch target. Tab order breaks logical flow (Restock button inside stock cards is separate tab stop).

## Minor Observations

- Skeleton shows 3 settlement alert cards even when `settlementAlerts.length === 0`
- Hero bar `group-hover:bg-white/4` overlay is imperceptible (4% white)
- Badge styling inconsistent: "Butuh Tindakan" uses `bg-surface-muted`, "Stok Kritis" uses `bg-red-100`, "Outlet Tertunggak" uses `bg-amber-100`
- No error boundary if `inventoryRisks` is undefined (`inventoryRisks.map()` will crash)
- 30s polling is aggressive for B2B; consider 60s or user-configurable

## Questions to Consider

1. Why does the owner see settlement alerts and critical stock on the same screen? Different workflows (financial vs operational) — should they be tabs?
2. What happens with 20 critical stock items? Dashboard becomes 80% stock alerts. No pagination or collapse.
3. Is the hero bar driving action, or do owners go to the finance page directly?
4. What's the owner's primary task here? "Process urgent items" needs urgency sorting. "Get status overview" needs trends. Currently tries both, does neither well.

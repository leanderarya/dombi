# Outlet token mapping — O.1 reference (2026-09-19)

Working reference for O.2–O.4 so the slices do not re-decide colours one file
at a time. Decided against the refresh boundary recorded in
`docs/OUTLET_BASELINE_20260919.md`: colour, typography and shared components may
move; flow, wording and navigation structure stay frozen.

## Two palette layers, and the second one is the bigger lever

**Layer 1 — Outlet's own classes.** 268 total, 64 distinct. Only 23 are already
backed by project tokens (`emerald-50/700/800/900` and `blue-50/700/800` are
defined in `app.css` as legacy palette-named tokens); **245 are stock Tailwind
palette**. The top ten classes are 146 of the 268 — 54%.

**Layer 2 — shared components.** `resources/js/components/ui/**` carries **104
more palette classes** (49 distinct) that every role inherits. Ninety of them
sit in four status components:

| File | Palette classes |
| --- | ---: |
| `order-status-badge.tsx` | 36 |
| `delivery-status-badge.tsx` | 27 |
| `restock-status-badge.tsx` | 21 |
| `stock-level-badge.tsx` | 6 |
| `empty-state.tsx` / `pagination.tsx` | 5 / 5 |
| `sticky-action-bar.tsx` / `phone-input.tsx` | 2 / 2 |

Consequence: Outlet keeps rendering palette colours through these badges no
matter how clean its pages get — and so will Courier and Owner. Fixing these
four files is the highest-leverage change in the role sweep: 90 classes fixed
once, inherited by three roles.

## Mapping table — the decision-free majority

| Intent | Classes observed | Token |
| --- | --- | --- |
| Danger text | `text-red-600` (45), `text-red-700` (15), `text-red-500` (3) | `text-danger` |
| Danger text, strong | `text-red-800` (3) | `text-danger-text` |
| Danger surface | `bg-red-50` (19), `bg-red-50/50`, `bg-red-50/80`, `bg-red-100` | `bg-danger-bg` |
| Danger border / ring | `border-red-200` (10), `ring-red-200`, `ring-red-300` | `border-danger-border`, `ring-danger-border` |
| Danger solid (dots, chips) | `bg-red-400` (9), `bg-red-500` (5), `bg-red-600` (4) | `bg-danger` |
| Muted text | `text-slate-500` (11), `text-slate-600` (4) | `text-text-muted` |
| Subtle text | `text-slate-400` (4) | `text-text-subtle` |
| Strong text | `text-slate-900` (4) | `text-text` |
| Neutral border | `border-slate-200` (9) | `border-border` |
| Neutral surface | `bg-slate-50`, `bg-slate-300`, `bg-zinc-50/100/200` | `bg-surface-muted`, `bg-border` |
| Warning solid | `bg-amber-400` (7), `bg-amber-100` (2) | `bg-warning` |
| Warning surface | `bg-amber-50` (5) | `bg-warning-bg` |
| Warning text | `text-amber-600` (4), `text-amber-700` (3), `text-amber-800` (2) | `text-warning-text` |
| Warning border / ring | `border-amber-200` (3), `ring-amber-200` | `border-warning-border` |
| Success surface / text / border | `bg-emerald-50` (6), `text-emerald-700` (10), `border-emerald-200` (4) | `bg-success-bg`, `text-success-text`, `border-success-border` |
| Primary solid action | `bg-emerald-600` (6), `bg-emerald-500` (3), `bg-emerald-700` (3) | `bg-primary` |
| Info | `bg-blue-400`, `bg-blue-500` | `bg-info` |
| Accent, operational | `bg-orange-400` (2) | `bg-accent-orange` |

Netral (slate + zinc = 44) dan danger (122) menyumbang 62% dari layer 1 dan
seluruhnya mekanis — itu sebabnya O.2 bisa mulai jalan tanpa penundaan.

## Three cases the table cannot settle alone

1. **Emerald carries two meanings.** Its 66 classes are both primary actions
   (`bg-emerald-600`, `bg-emerald-500`) and success status (`text-emerald-700`,
   `bg-emerald-50`). A blind swap to `bg-success` repaints Outlet's primary
   buttons; a blind swap to `bg-primary` repaints its status chips. The 36
   emerald sites need reading per site, not per class.
2. **The `*-400` dots are a set, not a colour.** `orders/index.tsx` (21 classes)
   and `dashboard.tsx` (21) draw status dots with seven hues — `bg-red-400`,
   `bg-amber-400`, `bg-zinc-400`, `bg-blue-400`, `bg-orange-400`,
   `bg-emerald-400`, `bg-indigo-400`. Seven token swaps here would re-draw the
   same set on the next screen; one shared status-dot component is the smaller
   change and matches the "shared components" half of the boundary.
3. **The status badges draw eight hues; the token set offers four.** See the
   decision below — it blocks the 90-class shared fix.

## Decision blocking layer 2

`order-status-badge.tsx` maps pending→amber, confirmed→blue, preparing→orange,
ready→purple, delivering→indigo, completed→emerald, cancelled→red,
expired→slate. The semantic tokens are danger / success / warning / info only,
and purple has no relative at all.

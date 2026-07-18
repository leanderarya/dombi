---
target: owner dashboard
total_score: 24
p0_count: 2
p1_count: 1
p2_count: 2
p3_count: 1
timestamp: 2026-07-11T07-53-40Z
slug: resources-js-pages-owner-dashboard-tsx
---
# Critique: Owner Dashboard — Dombi

## Design Health Score: 24/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Polling works, toast on dismiss. No "last updated" indicator. |
| 2 | Match System / Real World | 3 | Indonesian language, domain terms. Good. |
| 3 | User Control and Freedom | 3 | Dismissible alerts with undo. 5s toast is tight. |
| 4 | Consistency and Standards | 2 | 5 accent colors on one screen. DESIGN.md says max 1. |
| 5 | Error Prevention | 2 | No confirmation on dismiss. No guard on restock button. |
| 6 | Recognition Rather Than Recall | 3 | Severity encoding, count badges, contextual labels. |
| 7 | Flexibility and Efficiency of Use | 2 | Command sheet never wired to keyboard. No bulk actions. |
| 8 | Aesthetic and Minimalist Design | 1 | Over-decorated. Stagger, glass, 5 colors, eyebrows, stripes. |
| 9 | Help Users Recover from Errors | 2 | Empty states good. No error states for failed polling/network. |
| 10 | Help and Documentation | 3 | Skip-to-content, aria-labels, semantic HTML. |

## Anti-Patterns Verdict: AI Slop YES

12 violations across 5 banned categories. Detector returned 0 findings — manual review required.

| Rule | Count | Location |
|------|-------|----------|
| Side-stripe borders | 7 | dashboard.tsx:100-230, kpi-strip:41 |
| Glassmorphism | 2 | dashboard.tsx:272,277 |
| Eyebrow pattern | 5 | dashboard.tsx:262-442, kpi-strip:45 |
| Hero-metric template | 2 | dashboard.tsx:266, kpi-strip:46 |
| Identical card grids | 3 | dashboard.tsx:330-477 |

## Priority Issues

- **P0** Side-stripe borders everywhere — replace with icon color + subtle bg tint
- **P0** Stagger entrance animation — remove, content should render immediately
- **P1** Glassmorphism hero banner — remove entirely (user decision)
- **P2** Mixed accent vocabulary (5 colors) — collapse to emerald + red/amber semantic
- **P2** Eyebrow pattern on every section — remove uppercase tracking
- **P3** Hero-metric template repetition — differentiate KPI from hero

## Persona Red Flags

- Alex (Power User): No Cmd+K, no bulk actions, no data freshness indicator
- Sam (Accessibility): Color-only severity, text-[11px] too small, no ARIA hover states

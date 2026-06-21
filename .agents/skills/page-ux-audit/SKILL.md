---
name: page-ux-audit
description: Use when auditing a single page for usability, information hierarchy, mobile ergonomics, iOS HIG compliance, and Refactoring UI principles. Trigger when user says "audit this page", "this page looks off", "review the UX", "check HIG compliance", or "audit for accessibility".
---

# Page UX Hardening Audit

Systematic audit framework for evaluating a single page against iOS HIG and Refactoring UI principles. Produces actionable findings without redesigning.

## Overview

Every page audit follows 10 dimensions. Score each 0-10. Findings drive implementation priority.

## Required Context

Before auditing, read:
- `ios-hig-design` skill — iOS platform rules
- `refactoring-ui` skill — visual hierarchy rules

## Audit Dimensions

### 1. First Impression (3-Second Test)

Ask without reading content:
- Is the page purpose obvious?
- Does the user know what to do next?
- Is there visual noise competing for attention?

**Score 0-10.** If purpose isn't clear in 3 seconds, hierarchy fails.

### 2. Information Hierarchy

Map every piece of information on the page:

| Element | Current Priority | Correct Priority | Issue |
|---------|-----------------|-----------------|-------|
| ... | primary/secondary/tertiary | primary/secondary/tertiary | too prominent / too hidden / missing / duplicate |

**Check:**
- Labels competing with data?
- Primary info buried under secondary?
- Metadata more prominent than content?

### 3. Action Hierarchy

List every interactive element:

| Action | Type | Size | Position | Issue |
|--------|------|------|----------|-------|
| ... | primary/secondary/destructive | px | location | ... |

**Rules:**
- Primary action = largest, most prominent, thumb-reachable
- Secondary = smaller, less contrast
- Destructive = red, requires confirmation
- No more than 1-2 primary actions per screen

### 4. Mobile Ergonomics

| Check | Status | Issue |
|-------|--------|-------|
| Touch targets ≥ 44pt | pass/fail | ... |
| Primary actions in thumb zone | pass/fail | ... |
| No horizontal scroll | pass/fail | ... |
| Sticky actions respect safe area | pass/fail | ... |
| Content doesn't hide behind fixed elements | pass/fail | ... |

### 5. Navigation

| Check | Status | Issue |
|-------|--------|-------|
| User knows where they are | pass/fail | ... |
| User knows where they can go | pass/fail | ... |
| Back navigation is clear | pass/fail | ... |
| No orphan pages | pass/fail | ... |
| Max 2 taps from home | pass/fail | ... |

### 6. Card Audit

List every card/container on the page:

| Card | Content | Decision | Reason |
|------|---------|----------|--------|
| ... | ... | keep / merge / delete / convert-to-row / convert-to-grouped-section | ... |

**Decision rules:**
- **Keep** — if content is self-contained and needs visual separation
- **Merge** — if two cards share the same logical group
- **Delete** — if card adds no value (just a border around content)
- **Convert to row** — if card is a list item (should be flat row with separator)
- **Convert to grouped section** — if multiple cards are related (iOS Inset Grouped)

### 7. HIG Violations

| Violation | Location | Severity | Fix |
|-----------|----------|----------|-----|
| Non-native pattern | ... | high/medium/low | ... |
| Modal misuse | ... | ... | ... |
| Navigation misuse | ... | ... | ... |
| Visual hierarchy issue | ... | ... | ... |
| Accessibility issue | ... | ... | ... |

**Common violations:**
- `active:scale` transforms (iOS uses opacity)
- `<table>` on mobile (use card list)
- Sidebar/hamburger on mobile (use tab bar)
- `confirm()` dialogs (use bottom sheet)
- `text-[10px]` below readable minimum
- Touch targets under 44pt

### 8. Refactoring UI Audit

| Issue | Location | Type | Fix |
|-------|----------|------|-----|
| Visual noise | ... | unnecessary border/shadow/color | ... |
| Unnecessary border | ... | card/container | remove or soften |
| Unnecessary color | ... | badge/label/icon | use gray |
| Unnecessary shadow | ... | card/footer | use separator |
| Inconsistent spacing | ... | gap/margin | standardize to scale |

**Spacing scale:** 4, 8, 16, 24, 32, 48, 64px

### 9. Operational Flow

| Question | Answer | Issue |
|----------|--------|-------|
| Does the page support real user workflow? | yes/no | ... |
| Or does it just display data? | ... | ... |
| Can the user complete their task from here? | yes/no | ... |
| Are there unnecessary steps? | yes/no | ... |

**Test:** Walk through the primary user task step by step. Count taps/clicks.

### 10. Production Readiness

| State | Status | Issue |
|-------|--------|-------|
| Empty state | handled/missing | ... |
| Loading state | handled/missing | ... |
| Error state | handled/missing | ... |
| Edge cases | handled/missing | ... |
| Misleading information | present/absent | ... |

## Output Format

```markdown
## Page: [Page Name]
**URL:** [route]
**Score:** [overall 0-10]

### UX Problems
1. [Problem] — [Impact] — [Priority P0/P1/P2]

### HIG Violations
1. [Violation] — [Location] — [Fix]

### Refactoring UI Issues
1. [Issue] — [Location] — [Fix]

### Operational Problems
1. [Problem] — [Impact] — [Fix]

### Recommended Changes
| Priority | Change | Impact | Effort |
|----------|--------|--------|--------|
| P0 | ... | ... | ... |
| P1 | ... | ... | ... |
| P2 | ... | ... | ... |

### Expected UX Impact
[1-2 sentences describing the overall improvement]
```

## Process

1. Read the page file completely
2. Read related components (layout, shared UI)
3. Score each dimension 0-10
4. List all findings
5. Prioritize P0/P1/P2
6. Present audit — do NOT implement

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Jumping to implementation | Audit first, implement later |
| Fixing one issue, missing others | Complete all 10 dimensions |
| Ignoring mobile ergonomics | Check every touch target |
| Skipping empty/loading states | Always check all 5 states |
| Inconsistent priority | P0 = broken/unsafe, P1 = poor UX, P2 = polish |

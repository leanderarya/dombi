# Customer Frontend Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove mobile interaction artifacts, restore fulfillment slide behavior, prevent Floating Cart overlap, and improve customer navigation speed without changing business behavior.

**Architecture:** Keep interaction CSS global but accessibility-safe, keep fulfillment motion in its existing owner, and keep fixed-bar clearance in `CustomerMobileLayout`. Measure navigation before changing customer app loading; prefer native Inertia/Vite prefetch and dynamic imports over new dependencies.

**Tech Stack:** React 19, TypeScript, Inertia React, Vite, Tailwind CSS 4, Vitest, Laravel.

## Global Constraints

- Do not add dependencies.
- Preserve `:focus-visible` keyboard affordances; never add global `outline: none`.
- Respect `prefers-reduced-motion`.
- Do not change payment, DOKU, order lifecycle, or checkout business rules.
- Do not touch `.impeccable/`, `app/Models/ProductVariant.php`, `docs/ROADMAP.md`, or secret values.
- Keep scratch files under `.superpowers/sdd/` out of commits.
- Run `graphify update .` after code changes.

---

### Task 1: Mobile Tap Highlight Source and Fix

**Files:**
- Modify: `resources/css/app.css:96-126`
- Test: manual mobile browser inspection (CSS pseudo-state behavior is not meaningfully covered by current Vitest setup)

**Interfaces:**
- Consumes: native WebKit `-webkit-tap-highlight-color` and existing focus styles.
- Produces: touch controls without browser tap overlay while preserving keyboard focus rings.

- [ ] **Step 1: Reproduce and classify blue outer effect**

Use mobile emulation and a physical/staging browser if available. Inspect affected element while tapping. Record whether computed source is `-webkit-tap-highlight-color`, `outline`, `box-shadow`, or Tailwind `ring-*`. Do not edit CSS until source is confirmed.

Expected: affected selector and computed property identified.

- [ ] **Step 2: Add minimal selector coverage when tap highlight is source**

Extend existing rule only as required:

```css
button,
a,
input,
select,
textarea,
summary,
[role='button'] {
    -webkit-tap-highlight-color: transparent;
}
```

If source is a focus utility, scope suppression to coarse pointers while retaining `:focus-visible`:

```css
@media (pointer: coarse) {
    /* exact affected selector from Step 1 */
    :focus:not(:focus-visible) {
        outline: none;
        box-shadow: none;
    }
}
```

Do not add both variants unless evidence shows both sources.

- [ ] **Step 3: Verify accessibility manually**

Using keyboard on desktop, tab through same controls. Expected: visible focus indicator remains. Using touch, expected: blue outer/tap overlay absent.

- [ ] **Step 4: Run CSS/frontend gates**

Run:

```bash
npm run format:check
npm run lint:check
npm run types:check
```

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add resources/css/app.css
git commit -m "fix: remove customer mobile tap highlight"
```

---

### Task 2: Restore Fulfillment Slide at Original Owner

**Files:**
- Inspect history: `resources/js/pages/customer/product-detail.tsx`
- Inspect likely owner: `resources/js/pages/customer/checkout/index.tsx`
- Modify: exact owner identified from git history
- Create only if state logic needs isolation: `resources/js/lib/fulfillment-transition.ts`
- Test only if helper created: `resources/js/lib/fulfillment-transition.test.ts`

**Interfaces:**
- Consumes: current canonical fulfillment value and existing selection callback.
- Produces: deterministic direction (`left`, `right`, or `none`) and reduced-motion-safe visual transition.

- [ ] **Step 1: Trace removed implementation from all refs**

Run:

```bash
git log --all -p -G"delivery_dombi|fulfillment_type|translate-x|slide" -- resources/js/pages/customer resources/js/components/customer
git branch -a --contains HEAD
git grep -n "dombi_fulfillment_type" $(git rev-list --all) -- 2>/dev/null | head -100
```

Expected: original component/commit identified. If Product Detail never owned selector, record actual owner before implementation.

- [ ] **Step 2: Write failing helper test only if transition direction is non-trivial**

Create `resources/js/lib/fulfillment-transition.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fulfillmentTransitionDirection } from './fulfillment-transition';

describe('fulfillmentTransitionDirection', () => {
    it('slides forward from pickup to delivery', () => {
        expect(fulfillmentTransitionDirection('pickup', 'delivery_dombi')).toBe('left');
    });

    it('slides backward from delivery to pickup', () => {
        expect(fulfillmentTransitionDirection('delivery_dombi', 'pickup')).toBe('right');
    });

    it('does not animate unchanged selection', () => {
        expect(fulfillmentTransitionDirection('pickup', 'pickup')).toBe('none');
    });
});
```

Run:

```bash
npx vitest run resources/js/lib/fulfillment-transition.test.ts
```

Expected: FAIL because module is absent.

- [ ] **Step 3: Implement minimum direction helper if needed**

Create `resources/js/lib/fulfillment-transition.ts`:

```ts
export type FulfillmentType = 'pickup' | 'delivery_dombi';

export function fulfillmentTransitionDirection(
    previous: FulfillmentType,
    next: FulfillmentType,
): 'left' | 'right' | 'none' {
    if (previous === next) return 'none';

    return next === 'delivery_dombi' ? 'left' : 'right';
}
```

Skip helper entirely if recovered implementation is pure CSS indicator movement with no reusable logic.

- [ ] **Step 4: Restore animation in original owning component**

Use existing state and callback. Apply transform/opacity classes for 150–200ms and a reduced-motion override. Preserve product selection, quantity, outlet, and cart state. Example shape—not a mandate if history shows a better native implementation:

```tsx
<div className="transition-transform duration-200 ease-out motion-reduce:transition-none">
    {activeFulfillmentContent}
</div>
```

No timeout-driven business state and no animation package.

- [ ] **Step 5: Run focused and frontend tests**

Run helper test if created, then:

```bash
npm run format:check
npm run lint:check
npm run types:check
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/customer resources/js/components/customer resources/js/lib/fulfillment-transition.ts resources/js/lib/fulfillment-transition.test.ts
git commit -m "fix: restore fulfillment slide transition"
```

Stage only files actually changed.

---

### Task 3: Floating Cart Bottom Clearance

**Files:**
- Modify: `resources/js/layouts/customer-mobile-layout.tsx:23-65`
- Modify only if dimensions need one shared source: `resources/css/app.css`
- Test: `resources/js/layouts/customer-mobile-layout-state.test.ts`
- Create: `resources/js/layouts/customer-mobile-layout-state.ts`

**Interfaces:**
- Consumes: `{ footerSlot, activeOrder, showCartBar, hideBottomNav }`.
- Produces: `customerContentBottomPadding(input): string`, a Tailwind class for sufficient content clearance.

- [ ] **Step 1: Write failing clearance tests**

Create `resources/js/layouts/customer-mobile-layout-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { customerContentBottomPadding } from './customer-mobile-layout-state';

describe('customerContentBottomPadding', () => {
    it('reserves cart and bottom navigation clearance', () => {
        expect(customerContentBottomPadding({ hasFloatingBar: true, hideBottomNav: false })).toContain('10rem');
    });

    it('does not reserve hidden bottom navigation height', () => {
        expect(customerContentBottomPadding({ hasFloatingBar: true, hideBottomNav: true })).not.toContain('10rem');
    });

    it('keeps safe-area clearance without floating controls', () => {
        expect(customerContentBottomPadding({ hasFloatingBar: false, hideBottomNav: true })).toContain('safe-area-inset-bottom');
    });
});
```

Run:

```bash
npx vitest run resources/js/layouts/customer-mobile-layout-state.test.ts
```

Expected: FAIL because helper is absent.

- [ ] **Step 2: Implement explicit layout-state helper**

Create `resources/js/layouts/customer-mobile-layout-state.ts` with classes derived from measured cart bar and nav heights. Keep all class strings statically discoverable by Tailwind. Example structure:

```ts
export function customerContentBottomPadding({
    hasFloatingBar,
    hideBottomNav,
}: {
    hasFloatingBar: boolean;
    hideBottomNav: boolean;
}): string {
    if (hasFloatingBar && !hideBottomNav) return 'pb-[calc(10rem+env(safe-area-inset-bottom,0px))]';
    if (hasFloatingBar) return 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]';
    if (!hideBottomNav) return 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]';

    return 'pb-[env(safe-area-inset-bottom,0px)]';
}
```

Adjust measured values if browser inspection proves current `10rem` is insufficient. Add 1rem breathing room above fixed cart, not arbitrary large padding.

- [ ] **Step 3: Use helper in shared layout**

Replace inline bottom-padding ternary in `CustomerMobileLayout` with helper output. Do not add per-page padding.

- [ ] **Step 4: Verify focused test and mobile scenarios**

Run:

```bash
npx vitest run resources/js/layouts/customer-mobile-layout-state.test.ts
```

Manual expected: last product and CTA fully visible/tappable with cart, active order, custom footer, and hidden nav variants.

- [ ] **Step 5: Run frontend gates and commit**

```bash
npm run format:check
npm run lint:check
npm run types:check
npm test
git add resources/js/layouts/customer-mobile-layout.tsx resources/js/layouts/customer-mobile-layout-state.ts resources/js/layouts/customer-mobile-layout-state.test.ts
git commit -m "fix: keep customer content above floating bars"
```

---

### Task 4: Evidence-Based Customer Navigation Optimization

**Files:**
- Modify: `resources/js/customer-app.tsx:101-126`
- Modify only confirmed high-frequency links: `resources/js/pages/customer/home.tsx`, `resources/js/pages/customer/products.tsx`, `resources/js/pages/customer/product-detail.tsx`, `resources/js/components/customer/floating-cart-bar.tsx`
- Modify if page transition causes flicker: `resources/css/app.css:174-190`
- Test/build output: `public/build/manifest.json` (generated, do not commit unless repository already tracks it)

**Interfaces:**
- Consumes: Inertia `resolve` callback, Vite `import.meta.glob`, and link/router prefetch options supported by installed package types.
- Produces: async page resolution with smaller initial customer bundle and intent-based prefetch on primary navigation paths.

- [ ] **Step 1: Capture baseline build evidence**

Run:

```bash
rm -rf public/build
npm run build
node -e "const m=require('./public/build/manifest.json'); console.log(Object.entries(m).filter(([k])=>k.includes('customer')).map(([k,v])=>[k,v.file,(v.css||[]).length]))"
```

Also inspect browser Network for representative route chain and record request count, transferred JS, and duplicate visits/reloads. Save numbers in commit notes, not a permanent benchmark framework.

- [ ] **Step 2: Convert eager glob to lazy page resolution**

Replace `{ eager: true }` customer/auth/root globs with lazy import functions and return selected importer result:

```ts
const pages = import.meta.glob<{ default: ComponentType }>([
    './pages/customer/**/*.tsx',
    './pages/auth/**/*.tsx',
    './pages/*.tsx',
]);

resolve: (name) => {
    const page = pages[`./pages/${name}.tsx`];
    if (!page) throw new Error(`Page not found: ${name}`);

    return page();
},
```

Confirm installed Inertia typings/build accept promise-based resolution. If not, keep eager imports and skip this change rather than adding custom loaders.

- [ ] **Step 3: Build and compare chunks**

Run:

```bash
rm -rf public/build
npm run build
```

Expected: build passes and customer pages produce route-level chunks; initial entry chunk decreases. If total navigation worsens due excessive tiny chunks, revert and retain evidence.

- [ ] **Step 4: Add native prefetch only to primary route links**

Use Inertia `Link` prefetch props supported by installed version for Home → Products and Products → Product Detail. For imperative buttons, use router prefetch API only if current typings expose it. Do not prefetch checkout POST routes or personalized payment submission.

Expected: hover/touch intent warms next GET without duplicate navigation on click.

- [ ] **Step 5: Remove only measured duplicate visits**

From Network trace, remove duplicate `router.reload`/visit calls only where same navigation triggers twice. Keep checkout location autosave followed by quote reload because responses serve different responsibilities unless trace proves duplicate props fetch.

- [ ] **Step 6: Tune page transition only if measured flicker remains**

Keep current 120ms opacity transition or replace it with a reduced-motion-safe transition. Do not add longer animations to disguise backend latency:

```css
@media (prefers-reduced-motion: reduce) {
    [data-page] {
        animation: none;
    }
}
```

- [ ] **Step 7: Run complete frontend quality gate**

```bash
npm run format:check
npm run lint:check
npm run types:check
npm test
npm run build
```

Expected: all pass; Vitest reports no failures; Vite produces valid manifest and route chunks.

- [ ] **Step 8: Commit**

```bash
git add resources/js/customer-app.tsx resources/js/pages/customer resources/js/components/customer/floating-cart-bar.tsx resources/css/app.css
git commit -m "perf: speed up customer view navigation"
```

Stage only measured/implemented files.

---

### Task 5: Integration Verification and Staging

**Files:**
- No product source changes unless verification finds a reproducible regression.
- Update graph: `graphify-out/` generated files.

**Interfaces:**
- Consumes: outputs from Tasks 1–4.
- Produces: verified `develop` deployment and staging checklist evidence.

- [ ] **Step 1: Run complete local gate**

```bash
composer lint:check
npm run format:check
npm run lint:check
npm run types:check
npm test
npm run build
git diff --check -- resources app tests
```

Expected: all exit 0.

- [ ] **Step 2: Update knowledge graph**

```bash
graphify update .
```

Expected: incremental update completes. Keep expected graph output changes separate from source commits if repository convention requires.

- [ ] **Step 3: Push develop**

```bash
git push origin HEAD:develop
git ls-remote origin refs/heads/develop
```

Expected: remote SHA equals local HEAD.

- [ ] **Step 4: Watch Deploy Staging through completion**

```bash
gh run list --workflow deploy-staging.yml --limit 1 --json databaseId,headSha,status,conclusion
gh run watch <RUN_ID> --exit-status
```

Expected: quality and deploy jobs complete successfully. If failure occurs, inspect `gh run view <RUN_ID> --log-failed`, fix root cause, rerun complete relevant gate, push, and watch new run.

- [ ] **Step 5: Manual staging acceptance**

Verify:

- touch controls show no blue tap highlight;
- keyboard focus remains visible;
- Pickup ↔ Delivery slide works and respects reduced motion;
- final product stays above Floating Cart and remains tappable;
- Home → Products → Product Detail → Checkout navigation has no blank flash, duplicate request, stale state, or checkout regression.

## Self-review

- Spec coverage: all four requested issues map to Tasks 1–4; staging completion maps to Task 5.
- Scope: no backend/payment changes and no dependencies.
- Ambiguity control: fulfillment owner must be proven from history before edit; performance changes require baseline evidence.
- Type consistency: optional helper signatures are defined before use; layout helper input and output are explicit.

# CI final-review fix report

Date: 2026-07-27 (Asia/Jakarta)

## Status

**BLOCKED**

The two reported review defects are fixed:

1. Staging now fetches, resets to, and verifies the exact validated `${{ github.sha }}` before Composer/artisan deployment. The moving `git pull origin develop` deployment is gone.
2. The 88-file Prettier failure is fixed and TypeScript now reports zero errors without changing `tsconfig.json`, adding suppressions, or introducing a new `any`-based type workaround.

The mandatory quality gate is still red because the first runnable application-scoped lint revealed substantial pre-existing React/ESLint debt outside the review findings: **108 errors and 23 warnings** remain across unrelated product surfaces. The remaining errors include 29 `react-hooks/set-state-in-effect`, 15 `react-hooks/rules-of-hooks`, 14 `react-hooks/static-components`, 38 unused-symbol errors, plus purity/ref/immutability issues. Resolving those safely requires behavior-level refactors across checkout, outlet location, pricing, inventory, restocks, notifications, refunds, and other screens. Rule suppression, severity downgrades, and asynchronous setter wrappers were deliberately not used to manufacture a green result.

## Files changed

### CI and quality configuration

- `.github/workflows/deploy-staging.yml`
- `eslint.config.js`
- `package.json`

The lint command was narrowed from the entire repository to `resources/js`, which is the application JavaScript/TypeScript source. Generated Android build output and installed repository tooling under `.agents` previously made `eslint .` depend on local residue, caused a 4 GB Node heap crash, and then produced 54,031 findings in non-application tool bundles. Android generated output is also explicitly ignored.

### TypeScript correctness repairs

- `resources/js/components/customer/floating-cart-bar.tsx`
- `resources/js/components/customer/order/order-info-card.tsx`
- `resources/js/components/owner/holiday-manager.tsx`
- `resources/js/components/owner/outlet-location-map.tsx`
- `resources/js/components/ui/status-badge.tsx`
- `resources/js/customer-app.tsx`
- `resources/js/internal-app.tsx`
- `resources/js/hooks/use-flash-toast.ts`
- `resources/js/hooks/use-fulfillment-overlay.ts`
- `resources/js/hooks/use-inertia-loading.ts`
- `resources/js/hooks/use-pickup-flow.ts`
- `resources/js/pages/customer/home.tsx`
- `resources/js/pages/customer/orders/confirm.tsx`
- `resources/js/pages/customer/orders/show.tsx`
- `resources/js/pages/customer/product-detail.tsx`
- `resources/js/pages/guest/cancel.tsx`
- `resources/js/pages/owner/courier-management/index.tsx`
- `resources/js/pages/owner/delivery-tiers/index.tsx`
- `resources/js/pages/owner/outlets/show.tsx`

The fixes type Inertia payloads as serializable data, preserve nullable values at component boundaries, initialize React 19 refs, await Capacitor listener handles, type Vite page modules, narrow shared page props, correct Inertia v3 call signatures, and remove stale global-route typing.

### Mechanical formatting and lint autofixes

Prettier rewrote all 88 files named by the original `npm run format:check` failure under:

- `resources/css/app.css`
- `resources/js/app.tsx`
- `resources/js/components/customer/**`
- `resources/js/components/outlet/**`
- `resources/js/components/owner/**`
- `resources/js/components/shared/**`
- `resources/js/contexts/**`
- `resources/js/hooks/**`
- `resources/js/layouts/**`
- `resources/js/lib/**`
- `resources/js/pages/courier/**`
- `resources/js/pages/customer/**`
- `resources/js/pages/guest/**`
- `resources/js/pages/outlet/**`
- `resources/js/pages/owner/**`
- `resources/js/types/refund.ts`

ESLint's safe autofixes were then applied for import ordering, required braces, statement spacing, and 53 exact unused-symbol deletion suggestions. Prettier was rerun afterward. The final diff contains 137 files because the requested repository-wide formatting and safe lint autofixes touch already-unformatted source broadly.

## Commands and exact results

### Initial reproduction

- `npm run format:check` — **FAIL**, exit 1: 88 files reported.
- `npm run types:check` — **FAIL**, exit 2: dozens of strict TypeScript diagnostics.
- Initial `npm run lint:check` (`eslint .`) — **FAIL**: first crashed with Node out-of-memory while scanning generated Android bundles; after excluding those bundles it scanned `.agents` tooling and reported 54,031 problems.

### Final required commands

- `npm run format:check` — **PASS**, exit 0: `All matched files use Prettier code style!`
- `npm run lint:check` — **FAIL**, exit 1: `108 errors, 23 warnings` in application source.
- `npm run types:check` — **PASS**, exit 0: zero diagnostics.
- `npm test` — **PASS**, exit 0: 4 test files passed, 28 tests passed.
- `npm run build` — **PASS**, exit 0: 3,375 modules transformed; production assets built. Non-fatal Node `module.register()` deprecation and plugin timing warnings remain.

### Workflow and repository checks

- PyYAML parse of `.github/workflows/*.yml` — **PASS**: 3 workflow files parsed.
- Workflow relationship assertions — **PASS**:
  - staging `quality` uses `./.github/workflows/tests.yml`;
  - staging `deploy` needs `quality`;
  - production `quality` uses the same reusable gate;
  - production `build-and-deploy` needs `quality`.
- Staging SHA-integrity assertions — **PASS**:
  - exact `${{ github.sha }}` assignment present;
  - exact SHA fetch present;
  - hard reset to exact SHA present;
  - deployed `HEAD` equality assertion present;
  - `git pull origin develop` absent.
- `git diff --check` — **PASS**, exit 0, no output.

## Self-review

- Deployment behavior was not broadened: only staging's remote revision selection changed.
- Repeated deployments remain workable because each run fetches its event SHA and hard-resets the existing checkout before dependencies/cache clearing.
- The local build and uploaded assets originate from the same event SHA as the remote checkout.
- No `tsconfig.json` setting was weakened and no TypeScript or ESLint suppression was added.
- The remaining lint failures are explicitly not hidden; the reusable quality gate therefore remains blocked pending a dedicated behavior-safe React lint cleanup.

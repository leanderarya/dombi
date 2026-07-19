# Fix Courier APK Crash + Customer UI Smoothness — Design

Date: 2026-07-19
Status: Approved
Approach: 2 — Proper Build + Animation Audit (keep animations, optimize)

## Context

Two APKs built: `Dombi-Customer-v1.0.apk` (com.dombi.customer) and `Dombi-Kurir-v1.0.apk` (com.dombi.internal).

- Courier/Outlet APK crashes on launch — cannot be opened.
- Customer UI feels slightly choppy — not severe, but noticeable stutter.

## Problem Analysis

### Issue 1: Courier APK Crash

Root cause: `scripts/build-apk.sh` only `sed`-ed `applicationId` and `namespace` in `android/app/build.gradle`, but did NOT move the Java source.

- `MainActivity.java` lives at `android/app/src/main/java/com/dombi/customer/MainActivity.java` with `package com.dombi.customer;`
- When building internal, `build.gradle` says `applicationId "com.dombi.internal"` and `namespace = "com.dombi.internal"`
- Android runtime resolves `com.dombi.internal.MainActivity` → ClassNotFoundException → instant crash
- No clean between builds, so Gradle cache compounds the issue

### Issue 2: Customer Smoothness

Audit of `resources/css/app.css`: 61 animation/transition instances.

| Pattern | Count | Issue |
|---------|-------|-------|
| `transform: scale()` | ~6 | Repaint-heavy in WebView |
| `transition: all` with `!important` | 3 | Animates every property, expensive |
| `spring-transition` cubic-bezier | multiple usages | Jank on low-end WebView |
| `@keyframes` (sparklineUp, barGrow, chartDraw, slideUp, fadeIn, cartBounce, toastSlideIn) | 7+ | Concurrent triggers block main thread |
| Bottom sheet / modal without GPU layer | 2 | No compositor acceleration |

Android WebView has less GPU optimization than Chrome. `transform: all` and many concurrent keyframes cause dropped frames.

## Solution Design

### Part A: Courier APK Crash Fix

#### A1. `scripts/build-apk.sh` Rewrite

New flow for each `APP_TYPE`:

```bash
APP_TYPE=customer:
  JAVA_PKG=com.dombi.customer
APP_TYPE=internal:
  JAVA_PKG=com.dombi.internal

Steps:
1. Determine JAVA_PKG from APP_TYPE
2. Remove stale MainActivity from other package:
   rm -rf android/app/src/main/java/com/dombi/<other>/MainActivity.java
   rmdir empty parent dirs if needed
3. mkdir -p android/app/src/main/java/<JAVA_PKG path>/
4. Generate MainActivity.java via heredoc with correct package:
   package <JAVA_PKG>;
   import com.getcapacitor.BridgeActivity;
   public class MainActivity extends BridgeActivity {}
5. sed build.gradle: namespace + applicationId
6. sed strings.xml: app_name, title_activity_main, package_name, custom_url_scheme
7. export CAP_APP_ID=<JAVA_PKG> CAP_APP_NAME=<APP_NAME> CAP_SERVER_URL=<URL>
   npx cap sync android
8. cd android && ./gradlew clean assembleDebug (clean mandatory)
9. cp APK to ~/Desktop/
```

#### A2. `capacitor.config.ts`

- Keep env var fallback chain. Document that `CAP_APP_ID` must match `build.gradle` applicationId.
- Build script exports env vars before `cap sync`.

#### A3. `internal-app.tsx` Error Boundary

Add minimal error boundary so JS errors don't white-screen in WebView. Show retry button.

#### A4. Diagnostics

New `scripts/adb-logcat.sh`:
```bash
adb logcat | grep -i -E "dombi|capacitor|AndroidRuntime" --color=always
```
Helps future crash debugging without Android Studio.

### Part B: Customer UI Smoothness (Target A)

#### B1. Hardware Acceleration

Add `.gpu-accel` utility class:
```css
.gpu-accel {
  transform: translateZ(0);
  backface-visibility: hidden;
  contain: layout style paint;
}
```
Apply to: product cards, modals, bottom sheets, cart drawer containers.

#### B2. Fix `transition: all`

Replace:
```css
transition: all 150ms !important;
```
With:
```css
transition: transform 150ms ease, opacity 150ms ease !important;
```
Only composite properties (transform, opacity) run on compositor thread = 60fps.

#### B3. `spring-transition` Adaptive

```css
.spring-transition {
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease;
}
@media (pointer: coarse) {
  .spring-transition {
    transition: transform 150ms ease-out, opacity 150ms ease-out;
  }
}
```

#### B4. `will-change` Strategic Toggle

Don't use static `will-change` in CSS (creates too many GPU layers, memory heavy).

Create `useWillChange` hook:
- On `touchstart` / `mouseenter`: `el.style.willChange = 'transform'`
- On `transitionend`: `el.style.willChange = 'auto'`

#### B5. Content Visibility — Product Lists

```css
.product-grid > * {
  content-visibility: auto;
  contain-intrinsic-size: 0 220px;
}
```
Off-screen cards skip render. Intrinsically sized placeholder prevents layout shift.

#### B6. Vite Chunk Optimization

In `vite.config.ts`:
- `manualChunks`: split `recharts` (heavy, only used in owner dashboard, but bundled via eager glob)
- Verify customer-app.tsx doesn't pull recharts; if it does, dynamic import
- Keep `chunkSizeWarningLimit: 600` but optimize

Note: `customer-app.tsx` uses `import.meta.glob eager` for customer pages only — should not include recharts. But verify build output.

#### B7. Animation Concurrency — IntersectionObserver

For decorative animations (sparklineUp, barGrow, chartDraw):
- Wrap in IntersectionObserver so they only animate when visible
- Don't trigger all at mount

## Files Changed

| File | Change |
|------|--------|
| `scripts/build-apk.sh` | Full rewrite — package dir logic, MainActivity factory, clean build, env export |
| `capacitor.config.ts` | Minor — doc comment, ensure env chain clear |
| `resources/css/app.css` | Edit — fix `transition: all`, add `.gpu-accel`, adaptive spring, content-visibility |
| `vite.config.ts` | Edit — add `manualChunks` for recharts split |
| `resources/js/customer-app.tsx` | Minor — add useWillChange util or gpu-accel usage (optional) |
| `resources/js/internal-app.tsx` | Minor — error boundary |
| `scripts/adb-logcat.sh` | New — diagnostic helper |

No new npm dependencies.

## Out of Scope

- App icon / splash redesign
- Push notification logic (permissions already configured)
- Play Store signing / release build
- Framer-motion migration
- Virtual scrolling (product list <100 items)
- iOS build
- Refactor of product pages themselves

## Testing / Verification

### Courier APK

1. `./scripts/build-apk.sh customer` → install → open → works (regression check)
2. `./scripts/build-apk.sh internal` → install → open → must NOT crash
3. Build internal after customer, then customer again → no leftover (clean build)
4. `adb logcat` → no ClassNotFoundException
5. Navigate in internal APK: login outlet/courier → inventory/orders → camera/QR if available

### Customer Smoothness

1. Install customer APK
2. Scroll product list — should feel 60fps, no visible stutter
3. Open/close cart drawer, bottom sheet — smooth
4. Tap product → detail → back — smooth
5. On low-end device if available, more critical
6. `npm run build` — verify no chunk errors, manifest valid
7. Chrome DevTools (remote debug WebView): Performance tab — check no layout thrashing

## Risks

| Risk | Mitigation |
|------|------------|
| `./gradlew clean` adds ~30s to build | Acceptable — build infrequent |
| `content-visibility: auto` breaks sticky/overlap | Test grid, set proper `contain-intrinsic-size` |
| `contain: layout style paint` clips shadow/dropdown | Apply only to card root, not overflow containers |
| Moving MainActivity fails on Windows | Script uses bash/zsh with mkdir -p, macOS-first |
| manualChunks mis-split causes double-load | Keep simple — only recharts split, test build |
| `will-change` overuse causes memory bloat | JS toggle only during interaction, not static |

## Success Criteria

- [ ] `Dombi-Kurir-v1.0.apk` launches without crash
- [ ] `Dombi-Customer-v1.0.apk` still launches (regression)
- [ ] Switching build types (customer → internal → customer) works with clean
- [ ] Customer product list scroll feels smooth (no visible jank)
- [ ] `npm run build` passes
- [ ] No new npm dependencies added

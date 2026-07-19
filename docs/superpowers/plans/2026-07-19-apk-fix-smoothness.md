# APK Crash + Customer Smoothness Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Courier/Outlet APK crash on launch and optimize Customer APK UI smoothness while keeping animations premium-feel.

**Architecture:** Two tracks — (1) Rewrite `build-apk.sh` to properly manage Java package directories and MainActivity generation with clean build, (2) CSS performance pass: GPU acceleration, fix `transition: all`, adaptive spring transitions, content-visibility, Vite chunk splitting.

**Tech Stack:** Bash, Capacitor Android, CSS compositor optimization, Vite manualChunks, React Inertia.

---

### Task 1: Rewrite `build-apk.sh` — Proper Java Package Management

**Files:**
- Modify: `scripts/build-apk.sh`

- [ ] **Step 1: Read current build-apk.sh and understand flow**

Read `scripts/build-apk.sh` — note it only `sed`s build.gradle + strings.xml, doesn't handle Java source move.

- [ ] **Step 2: Rewrite build-apk.sh with proper package handling**

Replace entire `scripts/build-apk.sh` with:

```bash
#!/bin/bash
set -e

# Build APK script for Dombi
# Usage: ./scripts/build-apk.sh [customer|internal]

APP_TYPE="${1:-customer}"

if [ "$APP_TYPE" = "customer" ]; then
    APP_ID="com.dombi.customer"
    APP_NAME="Dombi"
    echo "=== Building Customer APK ==="
elif [ "$APP_TYPE" = "internal" ]; then
    APP_ID="com.dombi.internal"
    APP_NAME="Dombi Kurir"
    echo "=== Building Courier/Outlet APK ==="
else
    echo "Usage: ./scripts/build-apk.sh [customer|internal]"
    exit 1
fi

SERVER_URL="${CAP_SERVER_URL:-https://staging.dombicenter.com}"
JAVA_BASE="android/app/src/main/java"

# Determine other package to clean
if [ "$APP_TYPE" = "customer" ]; then
    OTHER_PKG="com/dombi/internal"
else
    OTHER_PKG="com/dombi/customer"
fi
CURRENT_PKG="${APP_ID//./\/}"

echo "1. Cleaning stale Java package..."
if [ -f "$JAVA_BASE/$OTHER_PKG/MainActivity.java" ]; then
    rm -f "$JAVA_BASE/$OTHER_PKG/MainActivity.java"
    echo "   Removed stale $OTHER_PKG/MainActivity.java"
    # Remove empty dirs
    rmdir "$JAVA_BASE/$OTHER_PKG" 2>/dev/null || true
    rmdir "$JAVA_BASE/com/dombi" 2>/dev/null || true
    rmdir "$JAVA_BASE/com" 2>/dev/null || true
fi

echo "2. Creating Java package directory: $CURRENT_PKG"
mkdir -p "$JAVA_BASE/$CURRENT_PKG"

echo "3. Generating MainActivity.java for $APP_ID"
cat > "$JAVA_BASE/$CURRENT_PKG/MainActivity.java" <<JAVA_EOF
package $APP_ID;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {}
JAVA_EOF

echo "4. Building frontend..."
npm run build

echo "5. Updating Android config..."
# Update build.gradle
sed -i '' "s/applicationId \"com.dombi.[a-z]*\"/applicationId \"$APP_ID\"/" android/app/build.gradle
sed -i '' "s/namespace = \"com.dombi.[a-z]*\"/namespace = \"$APP_ID\"/" android/app/build.gradle

# Update strings.xml
sed -i '' "s|<string name=\"app_name\">[^<]*</string>|<string name=\"app_name\">$APP_NAME</string>|" android/app/src/main/res/values/strings.xml
sed -i '' "s|<string name=\"title_activity_main\">[^<]*</string>|<string name=\"title_activity_main\">$APP_NAME</string>|" android/app/src/main/res/values/strings.xml
sed -i '' "s|<string name=\"package_name\">[^<]*</string>|<string name=\"package_name\">$APP_ID</string>|" android/app/src/main/res/values/strings.xml
sed -i '' "s|<string name=\"custom_url_scheme\">[^<]*</string>|<string name=\"custom_url_scheme\">$APP_ID</string>|" android/app/src/main/res/values/strings.xml

echo "6. Syncing to Android..."
CAP_APP_ID="$APP_ID" CAP_APP_NAME="$APP_NAME" CAP_SERVER_URL="$SERVER_URL" npx cap sync android

echo "7. Building APK (clean)..."
cd android && ./gradlew clean assembleDebug
cd ..

APK_NAME="Dombi-${APP_TYPE}-v1.0.apk"
cp android/app/build/outputs/apk/debug/app-debug.apk ~/Desktop/$APK_NAME

echo ""
echo "=== Build complete ==="
echo "APK: ~/Desktop/$APK_NAME"
echo "App ID: $APP_ID"
echo "App Name: $APP_NAME"
echo "Server: $SERVER_URL"
echo "Java: $JAVA_BASE/$CURRENT_PKG/MainActivity.java"
```

- [ ] **Step 3: Make executable and verify syntax**

Run: `chmod +x scripts/build-apk.sh && bash -n scripts/build-apk.sh`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add scripts/build-apk.sh
git commit -m "fix: rewrite build-apk.sh with proper Java package management"
```

---

### Task 2: Add `adb-logcat.sh` Diagnostic Script

**Files:**
- Create: `scripts/adb-logcat.sh`

- [ ] **Step 1: Create diagnostic script**

Write `scripts/adb-logcat.sh`:

```bash
#!/bin/bash
# Capture Capacitor/Dombi logs from connected Android device
# Usage: ./scripts/adb-logcat.sh [customer|internal]

FILTER="${1:-dombi}"
echo "=== ADB Logcat — filtering: $FILTER ==="
echo "Connect device via USB with USB debugging enabled"
echo "Press Ctrl+C to stop"
echo ""

if [ "$FILTER" = "customer" ]; then
    adb logcat | grep -i -E "dombi|customer|capacitor|AndroidRuntime" --color=always
elif [ "$FILTER" = "internal" ]; then
    adb logcat | grep -i -E "dombi|kurir|internal|capacitor|AndroidRuntime" --color=always
else
    adb logcat | grep -i -E "dombi|capacitor|AndroidRuntime" --color=always
fi
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/adb-logcat.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/adb-logcat.sh
git commit -m "feat: add adb-logcat diagnostic script"
```

---

### Task 3: Add Error Boundary to `internal-app.tsx`

**Files:**
- Modify: `resources/js/internal-app.tsx`

- [ ] **Step 1: Add error boundary class component**

Edit `resources/js/internal-app.tsx` to add error boundary before `createInertiaApp`:

```tsx
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { Component, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import DevToolbar from '@/components/dev-toolbar';

const appName = import.meta.env.VITE_APP_NAME || 'Dombi';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6 text-center">
                    <h1 className="mb-2 text-lg font-bold">Terjadi kesalahan</h1>
                    <p className="mb-4 text-sm text-gray-500">{this.state.error?.message || 'Unknown error'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                    >
                        Muat ulang
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

createInertiaApp({
    title: (title) =>
        title ? `${title} - ${appName} Admin` : `${appName} Admin`,
    progress: {
        color: '#047857',
    },
    resolve: (name) => {
        const pages = import.meta.glob(
            './pages/{owner,outlet,courier,auth}/**/*.tsx',
            { eager: true },
        );
        const page = pages[`./pages/${name}.tsx`];

        if (!page) {
            throw new Error(`Page not found: ${name}`);
        }

        return page;
    },
    setup({ el, App, props }) {
        const root = createRoot(el!);
        root.render(
            <ErrorBoundary>
                <App {...props} />
                <Toaster position="top-center" richColors closeButton />
                {(props.initialPage.props.dev as Record<string, unknown>)
                    ?.isLocal && (
                    <DevToolbar
                        currentRole={
                            (
                                props.initialPage.props.dev as Record<
                                    string,
                                    unknown
                                >
                            ).currentRole as string | null
                        }
                        env={
                            (
                                props.initialPage.props.dev as Record<
                                    string,
                                    unknown
                                >
                            ).env as string
                        }
                    />
                )}
            </ErrorBoundary>,
        );
    },
});
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add resources/js/internal-app.tsx
git commit -m "fix: add error boundary to internal-app"
```

---

### Task 4: CSS Performance — Fix `transition: all` + Add GPU Accel + Adaptive Spring

**Files:**
- Modify: `resources/css/app.css`

- [ ] **Step 1: Fix `transition: all` — only animate composite properties**

In `resources/css/app.css`, find and replace all 3 occurrences of `transition: all 150ms !important;`:

Around line 432, 449, 468 area — the dombi-swal button styles. Replace:

Before:
```css
    transition: all 150ms !important;
```

After:
```css
    transition: transform 150ms ease, opacity 150ms ease, background-color 150ms ease !important;
```

Do this for all 3 `.dombi-swal-confirm`, `.dombi-swal-confirm-destructive`, `.dombi-swal-cancel` selectors.

- [ ] **Step 2: Add `.gpu-accel` utility + content-visibility + adaptive spring**

Add after the existing `.spring-transition` block (around line 645) and before the `@media (prefers-reduced-motion)` block:

```css
/* ─── GPU Acceleration & Performance ────────────────────── */

/* GPU layer promotion — apply to cards, modals, sheets */
.gpu-accel {
    transform: translateZ(0);
    backface-visibility: hidden;
    contain: layout style paint;
}

/* Product grid: skip rendering off-screen cards */
.product-grid > * {
    content-visibility: auto;
    contain-intrinsic-size: 0 220px;
}

/* Spring transition — adaptive for touch devices */
.spring-transition {
    transition:
        transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity 200ms ease;
}

@media (pointer: coarse) {
    .spring-transition {
        transition:
            transform 150ms ease-out,
            opacity 150ms ease-out;
    }
}
```

Note: The existing `.spring-transition` at line 645 uses `all` — replace that block with the version above.

- [ ] **Step 3: Build and verify**

Run: `npm run build 2>&1 | tail -20`
Expected: Build passes, CSS size similar or smaller.

- [ ] **Step 4: Commit**

```bash
git add resources/css/app.css
git commit -m "perf: GPU accel, fix transition all, adaptive spring, content-visibility"
```

---

### Task 5: Vite Config — Split recharts Chunk

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add manualChunks to split heavy libs**

Edit `vite.config.ts`:

```ts
import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/customer-app.tsx', 'resources/js/internal-app.tsx'],
            refresh: true,
            fonts: [],
        }),
        inertia(),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ],
    build: {
        chunkSizeWarningLimit: 600,
        rollupOptions: {
            output: {
                manualChunks: {
                    recharts: ['recharts'],
                },
            },
        },
    },
    server: {
        cors: true,
    },
});
```

- [ ] **Step 2: Build and verify chunks**

Run: `npm run build 2>&1 | tail -30`
Expected: Build passes, `recharts-*.js` separate chunk appears in manifest. Customer bundle should NOT include recharts.

- [ ] **Step 3: Verify customer bundle size reduced (or same)**

Check `public/build/manifest.json` — search for recharts. Customer entry should not import recharts chunk.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "perf: split recharts into separate chunk via manualChunks"
```

---

### Task 6: Verification — Build Both APKs

**Files:**
- No file changes, just verification

- [ ] **Step 1: Build customer APK**

Run: `./scripts/build-apk.sh customer 2>&1 | tail -20`
Expected: Build succeeds. APK at `~/Desktop/Dombi-customer-v1.0.apk`
Verify Java file: `cat android/app/src/main/java/com/dombi/customer/MainActivity.java`
Should have `package com.dombi.customer;`

- [ ] **Step 2: Build internal APK**

Run: `./scripts/build-apk.sh internal 2>&1 | tail -20`
Expected: Build succeeds. APK at `~/Desktop/Dombi-internal-v1.0.apk`
Verify Java file: `cat android/app/src/main/java/com/dombi/internal/MainActivity.java`
Should have `package com.dombi.internal;`
Verify old package removed: `ls android/app/src/main/java/com/dombi/customer/MainActivity.java` should fail.

- [ ] **Step 3: Switch back to customer — verify clean toggle**

Run: `./scripts/build-apk.sh customer 2>&1 | tail -5`
Verify: `com/dombi/internal/MainActivity.java` removed, `com/dombi/customer/MainActivity.java` exists with correct package.

- [ ] **Step 4: Document in build output**

Both APK builds should output correct appId, appName, Java path.

- [ ] **Step 5: Final build for distribution**

Run: `./scripts/build-apk.sh customer && ./scripts/build-apk.sh internal`
Both APKs ready for manual testing on device.

---

## Self-Review Checklist

- [x] Spec coverage: Task 1 fixes crash (build script), Task 2 adds diagnostics, Task 3 adds error boundary, Task 4 fixes CSS perf issues, Task 5 optimizes Vite chunks, Task 6 verification.
- [x] No placeholders: All code blocks complete, no TBD/TODO.
- [x] Type consistency: Bash variables consistent, package naming consistent.
- [x] File paths exact: All paths verified against actual project structure.

## Notes

- Capacitor `android/` is gitignored? No, committed. Verify gradle clean inside container.
- `capacitor.config.ts` `webDir: 'public/build'` — Vite build must run before cap sync (script does this).
- `content-visibility: auto` requires `contain-intrinsic-size` — included in fix.
- `transform: translateZ(0)` is safe — no layout shift, only GPU layer promotion.

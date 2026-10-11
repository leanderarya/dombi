#!/bin/bash
set -e

# Build APK script for Dombi
# Usage: ./scripts/build-apk.sh [customer|internal] [debug|release]
#
# debug   (default) → assembleDebug, unsigned debug key, safe to sideload for testing
# release           → assembleRelease, signed with android/keystore.properties.
#                     Fails loudly if that file is missing, because an unsigned
#                     release APK is worse than no APK: it looks shippable and is not.

APP_TYPE="${1:-customer}"
BUILD_TYPE="${2:-debug}"

if [ "$BUILD_TYPE" != "debug" ] && [ "$BUILD_TYPE" != "release" ]; then
    echo "Usage: ./scripts/build-apk.sh [customer|internal] [debug|release]"
    exit 1
fi

if [ "$APP_TYPE" = "customer" ]; then
    APP_ID="com.dombi.customer"
    APP_NAME="Dombi App"
    echo "=== Building Customer APK ($BUILD_TYPE) ==="
elif [ "$APP_TYPE" = "internal" ]; then
    APP_ID="com.dombi.internal"
    APP_NAME="Dombi Kurir"
    echo "=== Building Courier/Outlet APK ($BUILD_TYPE) ==="
else
    echo "Usage: ./scripts/build-apk.sh [customer|internal] [debug|release]"
    exit 1
fi

if [ "$BUILD_TYPE" = "release" ] && [ ! -f android/keystore.properties ]; then
    echo "❌ android/keystore.properties not found."
    echo "   A release build without it produces an UNSIGNED apk, which cannot be installed."
    echo "   See docs/RELEASE_ANDROID.md for how to create and store the keystore."
    exit 1
fi

SERVER_URL="${CAP_SERVER_URL:-https://staging.dombicenter.com}"

# Start path: customer → home (/), internal → login (/login)
if [ "$APP_TYPE" = "customer" ]; then
    START_PATH=""
else
    START_PATH="/login"
fi
JAVA_BASE="android/app/src/main/java"

# Determine other package to clean
if [ "$APP_TYPE" = "customer" ]; then
    OTHER_PKG="com/dombi/internal"
else
    OTHER_PKG="com/dombi/customer"
fi
# tr, not ${APP_ID//./\/} — that substitution kept the backslashes, so the script
# created a literal directory named `com\dombi\customer` beside the real one. Two
# copies of the same package meant `duplicate class` on every build.
CURRENT_PKG="$(printf '%s' "$APP_ID" | tr '.' '/')"
BOGUS_PKG="$(printf '%s' "$APP_ID" | sed 's|\.|\\/|g')"

echo "1. Cleaning stale Java package..."
if [ -f "$JAVA_BASE/$OTHER_PKG/MainActivity.java" ]; then
    rm -f "$JAVA_BASE/$OTHER_PKG/MainActivity.java"
    echo "   Removed stale $OTHER_PKG/MainActivity.java"
    rmdir "$JAVA_BASE/$OTHER_PKG" 2>/dev/null || true
fi

# Remove the literal-backslash directories left by the old bug, for both packages.
for pkg in "$BOGUS_PKG" 'com\/dombi\/internal' 'com\/dombi\/customer'; do
    if [ -e "$JAVA_BASE/$pkg" ]; then
        rm -rf "$JAVA_BASE/$pkg"
        echo "   Removed malformed package dir: $pkg"
    fi
done
[ -e "$JAVA_BASE/com\\" ] && rm -rf "$JAVA_BASE/com\\"

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
sed -i '' "s/applicationId \"com.dombi.[a-z]*\"/applicationId \"$APP_ID\"/" android/app/build.gradle
sed -i '' "s/namespace = \"com.dombi.[a-z]*\"/namespace = \"$APP_ID\"/" android/app/build.gradle

sed -i '' "s|<string name=\"app_name\">[^<]*</string>|<string name=\"app_name\">$APP_NAME</string>|" android/app/src/main/res/values/strings.xml
sed -i '' "s|<string name=\"title_activity_main\">[^<]*</string>|<string name=\"title_activity_main\">$APP_NAME</string>|" android/app/src/main/res/values/strings.xml
sed -i '' "s|<string name=\"package_name\">[^<]*</string>|<string name=\"package_name\">$APP_ID</string>|" android/app/src/main/res/values/strings.xml
sed -i '' "s|<string name=\"custom_url_scheme\">[^<]*</string>|<string name=\"custom_url_scheme\">$APP_ID</string>|" android/app/src/main/res/values/strings.xml

echo "6. Syncing to Android..."
CAP_APP_ID="$APP_ID" CAP_APP_NAME="$APP_NAME" CAP_SERVER_URL="$SERVER_URL" CAP_START_PATH="$START_PATH" npx cap sync android

echo "7. Building APK (clean)..."

# ── Ensure Java 17+ (AGP requirement) ──────────────────
find_java17() {
    # 1. Already Java 17+ ?
    if java -version 2>&1 | grep -qE '"(1[7-9]|[2-9][0-9])\.'; then
        return 0
    fi
    # 2. Common Homebrew / system locations
    for p in \
        /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
        /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
        /opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home \
        /opt/homebrew/Cellar/openjdk@21/*/libexec/openjdk.jdk/Contents/Home \
        /opt/homebrew/Cellar/openjdk@17/*/libexec/openjdk.jdk/Contents/Home \
        /opt/homebrew/Cellar/openjdk/*/libexec/openjdk.jdk/Contents/Home \
        /Library/Java/JavaVirtualMachines/openjdk@21/Contents/Home \
        /Library/Java/JavaVirtualMachines/openjdk@17/Contents/Home \
        /Library/Java/JavaVirtualMachines/openjdk-21*.jdk/Contents/Home \
        /Library/Java/JavaVirtualMachines/openjdk-17*.jdk/Contents/Home \
        /Library/Java/JavaVirtualMachines/jdk-21*.jdk/Contents/Home \
        /Library/Java/JavaVirtualMachines/jdk-17*.jdk/Contents/Home; do
        # Expand glob
        for j in $p; do
            if [ -x "$j/bin/java" ] && "$j/bin/java" -version 2>&1 | grep -qE '"(1[7-9]|[2-9][0-9])\.'; then
                echo "   Found Java 17+ at $j"
                export JAVA_HOME="$j"
                export PATH="$JAVA_HOME/bin:$PATH"
                return 0
            fi
        done
    done
    # 3. Try /usr/libexec/java_home -v 17 on macOS
    if command -v /usr/libexec/java_home >/dev/null 2>&1; then
        JH17=$(/usr/libexec/java_home -v 17 2>/dev/null || true)
        if [ -n "$JH17" ] && [ -x "$JH17/bin/java" ]; then
            echo "   Found Java 17+ via java_home: $JH17"
            export JAVA_HOME="$JH17"
            export PATH="$JAVA_HOME/bin:$PATH"
            return 0
        fi
        JH21=$(/usr/libexec/java_home -v 21 2>/dev/null || true)
        if [ -n "$JH21" ] && [ -x "$JH21/bin/java" ]; then
            echo "   Found Java 21 via java_home: $JH21"
            export JAVA_HOME="$JH21"
            export PATH="$JAVA_HOME/bin:$PATH"
            return 0
        fi
    fi
    return 1
}

if ! find_java17; then
    echo "❌ Java 17+ required but not found."
    echo "   Current: $(java -version 2>&1 | head -1)"
    echo "   Install: brew install openjdk@17  OR  brew install openjdk@21"
    echo "   Then re-run this script."
    exit 1
fi

echo "   Using: $(java -version 2>&1 | head -1) | JAVA_HOME=$JAVA_HOME"
if [ "$BUILD_TYPE" = "release" ]; then
    cd android && ./gradlew clean assembleRelease
else
    cd android && ./gradlew clean assembleDebug
fi
cd ..

# Single source of truth for the version is android/app/build.gradle; read it back
# rather than hardcoding it here, or the filename will drift from the shipped app.
VERSION_NAME=$(grep -oE 'versionName "[^"]+"' android/app/build.gradle | head -1 | cut -d'"' -f2)
OUT_DIR="debug"
[ "$BUILD_TYPE" = "release" ] && OUT_DIR="release"

APK_NAME="Dombi-${APP_TYPE}-v${VERSION_NAME}-${BUILD_TYPE}.apk"
cp "android/app/build/outputs/apk/${OUT_DIR}/app-${OUT_DIR}.apk" ~/Desktop/$APK_NAME

echo ""
echo "=== Build complete ==="
echo "APK: ~/Desktop/$APK_NAME"
echo "App ID: $APP_ID"
echo "App Name: $APP_NAME"
echo "Server: $SERVER_URL"
echo "Java: $JAVA_BASE/$CURRENT_PKG/MainActivity.java"

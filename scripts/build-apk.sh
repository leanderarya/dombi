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
sed -i '' "s/applicationId \"com.dombi.[a-z]*\"/applicationId \"$APP_ID\"/" android/app/build.gradle
sed -i '' "s/namespace = \"com.dombi.[a-z]*\"/namespace = \"$APP_ID\"/" android/app/build.gradle

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

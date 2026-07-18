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

SERVER_URL="https://staging.dombicenter.com"

echo "1. Building frontend..."
npm run build

echo "2. Updating Android config..."
# Update build.gradle
sed -i '' "s/applicationId \"com.dombi.[a-z]*\"/applicationId \"$APP_ID\"/" android/app/build.gradle
sed -i '' "s/namespace = \"com.dombi.[a-z]*\"/namespace = \"$APP_ID\"/" android/app/build.gradle

# Update strings.xml
sed -i '' "s|<string name=\"app_name\">[^<]*</string>|<string name=\"app_name\">$APP_NAME</string>|" android/app/src/main/res/values/strings.xml
sed -i '' "s|<string name=\"title_activity_main\">[^<]*</string>|<string name=\"title_activity_main\">$APP_NAME</string>|" android/app/src/main/res/values/strings.xml
sed -i '' "s|<string name=\"package_name\">[^<]*</string>|<string name=\"package_name\">$APP_ID</string>|" android/app/src/main/res/values/strings.xml
sed -i '' "s|<string name=\"custom_url_scheme\">[^<]*</string>|<string name=\"custom_url_scheme\">$APP_ID</string>|" android/app/src/main/res/values/strings.xml

echo "3. Syncing to Android..."
npx cap sync android

echo "4. Building APK..."
cd android && ./gradlew assembleDebug
cd ..

APK_NAME="Dombi-${APP_TYPE}-v1.0.apk"
cp android/app/build/outputs/apk/debug/app-debug.apk ~/Desktop/$APK_NAME

echo ""
echo "=== Build complete ==="
echo "APK: ~/Desktop/$APK_NAME"
echo "App ID: $APP_ID"
echo "App Name: $APP_NAME"
echo "Server: $SERVER_URL"

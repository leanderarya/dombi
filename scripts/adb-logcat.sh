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

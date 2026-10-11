#!/bin/bash
set -euo pipefail

# Creates the Android release keystore for Dombi and the gitignored
# android/keystore.properties that Gradle reads.
#
# Run this ONCE, ever. The keystore it produces is the app's permanent identity:
#   - every future update MUST be signed with it, or Android refuses to install it;
#   - if it is lost the app can never be updated again, only replaced
#     (new package name, every existing install orphaned);
#   - if it leaks, anyone can sign an update that your users will install.
#
# Safe to re-run: refuses to overwrite an existing keystore.
#
# Usage: ./scripts/create-keystore.sh
#        KEYSTORE_PATH=~/keystores/dombi-release.jks ./scripts/create-keystore.sh

KEYSTORE_PATH="${KEYSTORE_PATH:-$HOME/keystores/dombi-release.jks}"
KEY_ALIAS="${KEY_ALIAS:-dombi}"
PROPS="android/keystore.properties"

if [ -f "$KEYSTORE_PATH" ]; then
    echo "❌ $KEYSTORE_PATH already exists. Refusing to overwrite."
    echo "   Overwriting would produce an app that cannot be updated over the installed one."
    echo "   Delete it deliberately if that is really what you want."
    exit 1
fi

if [ -f "$PROPS" ]; then
    echo "❌ $PROPS already exists. Refusing to overwrite an existing signing config."
    exit 1
fi

mkdir -p "$(dirname "$KEYSTORE_PATH")"

# Hex only: a "#", "=", ":", or leading space would break Java Properties parsing,
# and those characters turn up in human-chosen passwords.
STORE_PW="$(openssl rand -hex 16)"

# Passwords go through the environment, never argv — argv is world-readable in `ps`.
export DOMBI_KS_PW="$STORE_PW"

# 10000 days ≈ 27 years. Google Play requires validity past 2033; direct
# distribution has no such rule, but an expired key still cannot sign updates.
keytool -genkeypair \
    -keystore "$KEYSTORE_PATH" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Dombi, OU=Mobile, O=Dombi, L=Jakarta, ST=DKI Jakarta, C=ID" \
    -storepass:env DOMBI_KS_PW \
    -keypass:env DOMBI_KS_PW

cat > "$PROPS" <<EOF
# Release signing credentials for com.dombi.customer.
# GITIGNORED. Never commit this file, never paste its contents into a doc,
# an issue, a chat, or a report.
storeFile=$KEYSTORE_PATH
storePassword=$STORE_PW
keyAlias=$KEY_ALIAS
keyPassword=$STORE_PW
EOF

chmod 600 "$PROPS" "$KEYSTORE_PATH"

echo ""
echo "=== Keystore created ==="
echo "Keystore : $KEYSTORE_PATH"
echo "Config   : $PROPS (mode 600, gitignored)"
echo ""
echo "Certificate fingerprint — this is the app's permanent identity. Record it:"
keytool -list -v -keystore "$KEYSTORE_PATH" -alias "$KEY_ALIAS" \
    -storepass:env DOMBI_KS_PW 2>/dev/null \
    | grep -E "Alias|Valid from|SHA256:" || true
echo ""
echo "NOW BACK IT UP. Copy the keystore AND the password to two places that are"
echo "not this machine — a password manager and offline media. Nothing in this"
echo "repo can regenerate them, and no support channel can recover them."

#!/bin/sh
# Build Noor for Android TV, Google TV and Fire TV: dist/Noor-<version>.apk
#
#   sh scripts/build-android.sh            everything in this folder, your own photos included
#   sh scripts/build-android.sh --release  only what git tracks, for a GitHub release
#
# Needs a JDK (17 or newer) and the Android SDK with one platform and one build-tools version.
# No Gradle and no Android Studio: the SDK's own tools pack it (aapt2, javac, d8, zipalign,
# apksigner). It finds them through JAVA_HOME and ANDROID_HOME (or ANDROID_SDK_ROOT), and looks
# in the usual places when those are not set. docs/ANDROID-TV.md says how to get both without
# an administrator password.
#
# Signing. Android only installs a signed app, and only updates an app with a build signed by
# the same key.
#   - Your own key: NOOR_KEYSTORE=<file.jks> NOOR_KEYSTORE_PASS=<password> [NOOR_KEY_ALIAS=noor],
#     or the files ~/.config/noor-tv/release.jks and ~/.config/noor-tv/release.pass.
#   - Otherwise a throwaway key is made in build/android/ and reused on this computer. An app
#     signed with it cannot be updated by the published release (remove the app first).
set -e
cd "$(dirname "$0")/.."
ROOT="$PWD"
VERSION=$(sed -n 's/.*<widget[^>]* version="\([^"]*\)".*/\1/p' config.xml)
[ -n "$VERSION" ] || { echo "could not read the version from config.xml"; exit 1; }
# 1.9.0 -> 10900
CODE=$(echo "$VERSION" | awk -F. '{ printf "%d", $1 * 10000 + $2 * 100 + $3 }')

# ---- the tools ----
if [ -z "$JAVA_HOME" ] || [ ! -x "$JAVA_HOME/bin/javac" ]; then
  for j in "$ROOT/build/jdk/Contents/Home" "$ROOT/build/jdk" /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
           /opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
           /usr/lib/jvm/default-java /usr/lib/jvm/java-21-openjdk-amd64 /usr/lib/jvm/java-17-openjdk-amd64; do
    if [ -x "$j/bin/javac" ]; then JAVA_HOME="$j"; break; fi
  done
fi
[ -x "$JAVA_HOME/bin/javac" ] || { echo "no JDK found: set JAVA_HOME (docs/ANDROID-TV.md, \"Building it yourself\")"; exit 1; }
SDK="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
if [ -z "$SDK" ] || [ ! -d "$SDK/build-tools" ]; then
  for d in "$ROOT/build/android-sdk" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk" "$LOCALAPPDATA/Android/Sdk"; do
    if [ -d "$d/build-tools" ]; then SDK="$d"; break; fi
  done
fi
[ -d "$SDK/build-tools" ] || { echo "no Android SDK found: set ANDROID_HOME (docs/ANDROID-TV.md, \"Building it yourself\")"; exit 1; }
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)"
JAR="$SDK/platforms/$(ls "$SDK/platforms" | grep -E '^android-[0-9]+$' | sort -V | tail -1)/android.jar"
[ -f "$JAR" ] || { echo "no Android platform in $SDK/platforms (install one: sdkmanager \"platforms;android-34\")"; exit 1; }
TARGET=$(basename "$(dirname "$JAR")" | sed 's/android-//')
[ "$TARGET" -gt 35 ] && TARGET=35    # what this app has been written against

# ---- the web app goes in as the app's own files ----
W="$ROOT/build/android"
rm -rf "$W/assets" "$W/gen" "$W/classes" "$W/dex" "$W/res.zip" "$W"/*.apk
mkdir -p "$W/assets" "$W/gen" "$W/classes" "$W/dex" "$ROOT/dist"
FILES="index.html css js fonts img icon.png LICENSE NOTICE CREDITS.md"
if [ "$1" = "--release" ]; then git archive HEAD $FILES | tar -x -C "$W/assets"
else tar -c --exclude '.DS_Store' $FILES | tar -x -C "$W/assets"; fi
rm -f "$W/assets/js/mine.example.js"
# the page asks for js/mine.js (your own photos); a release has none, and an empty one keeps the log quiet
[ -f "$W/assets/js/mine.js" ] || echo "/* no own photos in this build */" > "$W/assets/js/mine.js"

# ---- resources, code, package ----
"$BT/aapt2" compile --dir android/res -o "$W/res.zip"
"$BT/aapt2" link -o "$W/unsigned.apk" -I "$JAR" --manifest android/AndroidManifest.xml -A "$W/assets" --java "$W/gen" \
  --min-sdk-version 21 --target-sdk-version "$TARGET" --version-code "$CODE" --version-name "$VERSION" "$W/res.zip"
"$JAVA_HOME/bin/javac" -nowarn -source 8 -target 8 -Xlint:-options -Xlint:-deprecation -cp "$JAR" -d "$W/classes" \
  $(find android/src "$W/gen" -name '*.java')
PATH="$JAVA_HOME/bin:$PATH" "$BT/d8" --min-api 21 --lib "$JAR" --output "$W/dex" $(find "$W/classes" -name '*.class')
(cd "$W/dex" && zip -q -j "$W/unsigned.apk" classes.dex)
"$BT/zipalign" -f 4 "$W/unsigned.apk" "$W/aligned.apk"

# ---- sign ----
KS="$NOOR_KEYSTORE"; PASS="$NOOR_KEYSTORE_PASS"; ALIAS="${NOOR_KEY_ALIAS:-noor}"; KIND="your key"
if [ -z "$KS" ] && [ -f "$HOME/.config/noor-tv/release.jks" ] && [ -f "$HOME/.config/noor-tv/release.pass" ]; then
  KS="$HOME/.config/noor-tv/release.jks"; PASS=$(cat "$HOME/.config/noor-tv/release.pass")
fi
if [ -z "$KS" ]; then
  KS="$W/throwaway.jks"; PASS="noor-throwaway"; KIND="a throwaway key (cannot be updated by the published release)"
  [ -f "$KS" ] || "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$KS" -storepass "$PASS" -keypass "$PASS" -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Noor local build" >/dev/null 2>&1
fi
OUT="$ROOT/dist/Noor-$VERSION.apk"
# (newer JDKs print a harmless "restricted method" warning for apksigner; verify below is the real check)
PATH="$JAVA_HOME/bin:$PATH" "$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$PASS" --ks-key-alias "$ALIAS" --out "$OUT" "$W/aligned.apk" 2>/dev/null
rm -f "$OUT.idsig"
PATH="$JAVA_HOME/bin:$PATH" "$BT/apksigner" verify "$OUT" 2>/dev/null || { echo "the signed package did not verify"; exit 1; }
echo "$OUT ($(du -h "$OUT" | cut -f1 | tr -d ' '), signed with $KIND)"

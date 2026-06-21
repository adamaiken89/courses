#!/bin/bash
set -euo pipefail

PRODUCT_NAME="CourseReader"
BINARY_PATH="${1:-.build/debug/$PRODUCT_NAME}"
APP_DIR="$PRODUCT_NAME.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

cp "$BINARY_PATH" "$MACOS_DIR/$PRODUCT_NAME"
cp support/Info.plist "$CONTENTS_DIR/"

# Generate app icon with all required sizes
echo "  Generating app icon..."
ICON_DIR="$(mktemp -d)"
swift scripts/make-icon.swift "$ICON_DIR" 2>/dev/null || true

ICON_SET="$ICON_DIR/AppIcon.iconset"
mkdir -p "$ICON_SET"

if [ -f "$ICON_DIR/icon_1024.png" ]; then
    sips -z 16 16 "$ICON_DIR/icon_1024.png" --out "$ICON_SET/icon_16x16.png" &>/dev/null
    sips -z 32 32 "$ICON_DIR/icon_1024.png" --out "$ICON_SET/icon_16x16@2x.png" &>/dev/null
    sips -z 32 32 "$ICON_DIR/icon_1024.png" --out "$ICON_SET/icon_32x32.png" &>/dev/null
    sips -z 64 64 "$ICON_DIR/icon_1024.png" --out "$ICON_SET/icon_32x32@2x.png" &>/dev/null
    sips -z 128 128 "$ICON_DIR/icon_1024.png" --out "$ICON_SET/icon_128x128.png" &>/dev/null
    sips -z 256 256 "$ICON_DIR/icon_1024.png" --out "$ICON_SET/icon_128x128@2x.png" &>/dev/null
    sips -z 256 256 "$ICON_DIR/icon_1024.png" --out "$ICON_SET/icon_256x256.png" &>/dev/null
    sips -z 512 512 "$ICON_DIR/icon_1024.png" --out "$ICON_SET/icon_256x256@2x.png" &>/dev/null
    sips -z 512 512 "$ICON_DIR/icon_1024.png" --out "$ICON_SET/icon_512x512.png" &>/dev/null
    cp "$ICON_DIR/icon_1024.png" "$ICON_SET/icon_512x512@2x.png"
    iconutil -c icns "$ICON_SET" -o "$RESOURCES_DIR/$PRODUCT_NAME.icns" 2>/dev/null || echo "  Warning: icon generation failed"
fi

rm -rf "$ICON_DIR"

echo "Created $APP_DIR"

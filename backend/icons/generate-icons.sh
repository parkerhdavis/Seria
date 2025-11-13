#!/bin/bash

# Icon generation script for Juniper/Seria Tauri app
# Takes seria_icon_fullres.png and generates all required icon sizes
# Requires ImageMagick (convert command)

set -e  # Exit on error

SOURCE="seria_icon_fullres.png"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

# Check if source file exists
if [ ! -f "$SOURCE" ]; then
    echo "Error: $SOURCE not found in $SCRIPT_DIR"
    exit 1
fi

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed. Please install it first:"
    echo "  Ubuntu/Debian: sudo apt install imagemagick"
    echo "  Fedora: sudo dnf install ImageMagick"
    echo "  Arch: sudo pacman -S imagemagick"
    exit 1
fi

echo "Generating icons from $SOURCE..."

# Generate standard icon sizes for Tauri
# 32x32 - Small icon (Windows taskbar, Linux panel)
convert "$SOURCE" -resize 32x32 32x32.png
echo "  ✓ Generated 32x32.png"

# 128x128 - Medium icon (Windows start menu, macOS)
convert "$SOURCE" -resize 128x128 128x128.png
echo "  ✓ Generated 128x128.png"

# 256x256 - Large icon (macOS, Linux)
convert "$SOURCE" -resize 256x256 icon.png
echo "  ✓ Generated icon.png (256x256)"

# 512x512 - HiDPI/Retina icon
convert "$SOURCE" -resize 512x512 icon@2x.png
echo "  ✓ Generated icon@2x.png (512x512)"

# Optional: Generate additional sizes for comprehensive coverage
# Uncomment these if needed for specific platform requirements

# convert "$SOURCE" -resize 16x16 16x16.png
# echo "  ✓ Generated 16x16.png"

# convert "$SOURCE" -resize 48x48 48x48.png
# echo "  ✓ Generated 48x48.png"

# convert "$SOURCE" -resize 64x64 64x64.png
# echo "  ✓ Generated 64x64.png"

# convert "$SOURCE" -resize 512x512 512x512.png
# echo "  ✓ Generated 512x512.png"

# convert "$SOURCE" -resize 1024x1024 1024x1024.png
# echo "  ✓ Generated 1024x1024.png"

echo ""
echo "Icon generation complete! Generated icons:"
ls -lh *.png | grep -v "$SOURCE"

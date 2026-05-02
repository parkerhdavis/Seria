#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-or-later

# Icon generation script for Seria (Electrobun app)
# Generates all icon sizes from seria-icon-fullres.png and stages them for
# the packaging scripts (Linux hicolor tree, Windows .ico, macOS .icns).
# Requires ImageMagick (v6 or v7) and optionally icnsutils (png2icns).

set -e  # Exit on error

# ─── Configuration ────────────────────────────────────────────────────
# ICON_SHAPE controls the app icon shape for platform bundles.
# Options: "square", "rounded", "circle"
ICON_SHAPE="rounded"

# Corner radius percentage for "rounded" mode (0-50, where 50 = circle)
ROUNDED_PERCENT=12

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source file
APP_ICON="seria-icon-fullres.png"

cd "$SCRIPT_DIR"

# Check source exists
if [ ! -f "$APP_ICON" ]; then
	echo "Error: $APP_ICON not found in $SCRIPT_DIR"
	exit 1
fi

# Detect ImageMagick version (v7 uses `magick`, v6 uses `convert`)
if command -v magick &> /dev/null; then
	IM="magick"
elif command -v convert &> /dev/null; then
	IM="convert"
else
	echo "Error: ImageMagick is not installed. Please install it first:"
	echo "  Ubuntu/Debian: sudo apt install imagemagick"
	echo "  Fedora: sudo dnf install ImageMagick"
	echo "  Arch: sudo pacman -S imagemagick"
	exit 1
fi

# ─── Shape masking ────────────────────────────────────────────────────
# apply_shape <input> <size> <output>
# Resizes to <size>x<size> and applies the configured ICON_SHAPE mask.
apply_shape() {
	local input="$1" size="$2" output="$3"

	case "$ICON_SHAPE" in
		square)
			$IM "$input" -resize "${size}x${size}" "PNG32:$output"
			;;
		rounded)
			local radius=$(( size * ROUNDED_PERCENT / 100 ))
			$IM "$input" -resize "${size}x${size}" -alpha set \
				\( -size "${size}x${size}" xc:none \
				   -fill white -draw "roundrectangle 0,0,$((size-1)),$((size-1)),${radius},${radius}" \) \
				-compose DstIn -composite "PNG32:$output"
			;;
		circle)
			local half=$(( size / 2 ))
			$IM "$input" -resize "${size}x${size}" -alpha set \
				\( -size "${size}x${size}" xc:none \
				   -fill white -draw "circle ${half},${half} ${half},0" \) \
				-compose DstIn -composite "PNG32:$output"
			;;
		*)
			echo "Error: Unknown ICON_SHAPE '$ICON_SHAPE' (use square, rounded, or circle)"
			exit 1
			;;
	esac
}

# ─── PNG sizes used by Linux hicolor tree, macOS, and Windows ──────────

echo "Generating icons from $APP_ICON (shape: $ICON_SHAPE)..."

for s in 16 32 48 64 128 256 512; do
	apply_shape "$APP_ICON" "$s" "${s}x${s}.png"
	echo "  Generated ${s}x${s}.png"
done

# Also emit the common Retina-style variant used by some bundlers
apply_shape "$APP_ICON" 256 "128x128@2x.png"
echo "  Generated 128x128@2x.png (256x256)"

# ─── .ico for Windows (multi-size) ─────────────────────────────────────

ICO_TMPDIR="$(mktemp -d)"
for s in 16 32 48 64 128 256; do
	apply_shape "$APP_ICON" "$s" "$ICO_TMPDIR/icon_${s}.png"
done
$IM "$ICO_TMPDIR"/icon_*.png icon.ico
rm -rf "$ICO_TMPDIR"
echo "  Generated icon.ico (multi-size)"

# ─── .icns for macOS ───────────────────────────────────────────────────

if command -v png2icns &> /dev/null; then
	ICNS_TMPDIR="$(mktemp -d)"
	for s in 16 32 128 256 512; do
		apply_shape "$APP_ICON" "$s" "$ICNS_TMPDIR/icon_${s}.png"
	done
	png2icns icon.icns \
		"$ICNS_TMPDIR/icon_16.png" \
		"$ICNS_TMPDIR/icon_32.png" \
		"$ICNS_TMPDIR/icon_128.png" \
		"$ICNS_TMPDIR/icon_256.png" \
		"$ICNS_TMPDIR/icon_512.png"
	rm -rf "$ICNS_TMPDIR"
	echo "  Generated icon.icns"
else
	echo "  Skipped icon.icns (install icnsutils: sudo apt install icnsutils)"
fi

# ─── Summary ───────────────────────────────────────────────────────────

echo ""
echo "Done. Generated files:"
ls -lh 16x16.png 32x32.png 48x48.png 64x64.png 128x128.png 128x128@2x.png 256x256.png 512x512.png icon.ico icon.icns 2>/dev/null

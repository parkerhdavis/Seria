#!/bin/bash
#
# Package Seria for Linux distribution.
#
# Consumes the Electrobun stable bundle at target/stable-linux-x64/seria/
# and produces:
#
#   target/seria_<version>_amd64.deb
#   target/seria-<version>-1.x86_64.rpm
#
# Requires: dpkg-deb (package: dpkg), rpmbuild (package: rpm), and a
# previously-generated icon set under resources/icons/. Run
# resources/icons/generate-icons.sh first if icons are missing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ICONS_DIR="$PROJECT_ROOT/resources/icons"
SRC_BUNDLE="$PROJECT_ROOT/target/stable-linux-x64/seria"
OUT_DIR="$PROJECT_ROOT/target"

# ─── Metadata ──────────────────────────────────────────────────────────

APP_NAME="seria"
APP_DISPLAY_NAME="Seria"
APP_DESCRIPTION="Multimodal serialized-data editor for game writers and narrative designers"
APP_LICENSE="GPL-3.0-or-later"
APP_MAINTAINER="Parker Davis <phd@parkerhdavis.com>"
APP_URL="https://github.com/parkerhdavis/Seria"

VERSION="$(grep '^\s*"version":' "$PROJECT_ROOT/package.json" | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')"

if [ -z "$VERSION" ]; then
	echo "Error: could not read version from package.json"
	exit 1
fi

# ─── Sanity checks ─────────────────────────────────────────────────────

if [ ! -d "$SRC_BUNDLE" ]; then
	echo "Error: Electrobun stable bundle not found at:"
	echo "  $SRC_BUNDLE"
	echo ""
	echo "Run 'bunx electrobun build --env=stable' first (the Makefile's"
	echo "build-linux target does this automatically)."
	exit 1
fi

if [ ! -f "$ICONS_DIR/512x512.png" ]; then
	echo "Error: generated icons not found in $ICONS_DIR"
	echo "Run 'bash resources/icons/generate-icons.sh' first."
	exit 1
fi

HAVE_DPKG=1
HAVE_RPMBUILD=1
command -v dpkg-deb >/dev/null 2>&1 || HAVE_DPKG=0
command -v rpmbuild >/dev/null 2>&1 || HAVE_RPMBUILD=0

if [ "$HAVE_DPKG" = "0" ] && [ "$HAVE_RPMBUILD" = "0" ]; then
	echo "Error: neither dpkg-deb nor rpmbuild is available — cannot build"
	echo "any Linux installer. Install at least one:"
	echo "  sudo apt install dpkg          # for .deb"
	echo "  sudo apt install rpm           # for .rpm"
	exit 1
fi

mkdir -p "$OUT_DIR"

echo "Packaging Seria $VERSION for Linux..."
echo "  Source bundle: $SRC_BUNDLE"
echo "  Output dir:    $OUT_DIR"
echo ""

# ─── Build shared staging tree ─────────────────────────────────────────
# Both .deb and .rpm install to the same FHS layout, so we stage once.
#
#   usr/bin/seria                               (wrapper script)
#   usr/lib/seria/                              (Electrobun app bundle)
#   usr/share/applications/seria.desktop
#   usr/share/icons/hicolor/<size>x<size>/apps/seria.png

STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

FHS_ROOT="$STAGING/fhs"
mkdir -p "$FHS_ROOT/usr/bin"
mkdir -p "$FHS_ROOT/usr/lib/seria"
mkdir -p "$FHS_ROOT/usr/share/applications"

# Copy the Electrobun bundle. `cp -a` preserves executable bits on
# launcher/bun so the installed app can actually run.
cp -a "$SRC_BUNDLE"/. "$FHS_ROOT/usr/lib/seria/"

# Wrapper script in /usr/bin. A symlink would preserve argv[0] and let
# launcher resolve its relative paths, but symlinks cross package/rpm
# boundaries awkwardly on some distros, so an exec wrapper is more
# portable and still fast.
cat > "$FHS_ROOT/usr/bin/seria" <<'WRAPPER'
#!/bin/sh
exec /usr/lib/seria/bin/launcher "$@"
WRAPPER
chmod 755 "$FHS_ROOT/usr/bin/seria"

# Desktop entry
cat > "$FHS_ROOT/usr/share/applications/seria.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=$APP_DISPLAY_NAME
Comment=$APP_DESCRIPTION
Exec=$APP_NAME %F
Icon=$APP_NAME
Terminal=false
Categories=TextEditor;Utility;
MimeType=text/csv;text/comma-separated-values;
Keywords=csv;editor;spreadsheet;data;

Actions=NewWindow;

[Desktop Action NewWindow]
Name=Open New Window
Exec=$APP_NAME
DESKTOP

# Hicolor icon theme
for size in 16 32 48 64 128 256 512; do
	dest="$FHS_ROOT/usr/share/icons/hicolor/${size}x${size}/apps"
	mkdir -p "$dest"
	cp "$ICONS_DIR/${size}x${size}.png" "$dest/seria.png"
done

# Compute install size (KB) for package metadata
INSTALLED_SIZE="$(du -sk "$FHS_ROOT" | cut -f1)"

# ─── .deb ──────────────────────────────────────────────────────────────

if [ "$HAVE_DPKG" = "0" ]; then
	echo "Skipping .deb — dpkg-deb not installed (sudo apt install dpkg)"
	DEB_OUT=""
else

echo "Building .deb package..."

DEB_ROOT="$STAGING/deb"
mkdir -p "$DEB_ROOT/DEBIAN"
cp -a "$FHS_ROOT"/. "$DEB_ROOT/"

cat > "$DEB_ROOT/DEBIAN/control" <<CONTROL
Package: $APP_NAME
Version: $VERSION
Section: editors
Priority: optional
Architecture: amd64
Installed-Size: $INSTALLED_SIZE
Depends: libgtk-3-0, libwebkit2gtk-4.1-0 | libwebkit2gtk-4.0-37
Maintainer: $APP_MAINTAINER
Homepage: $APP_URL
Description: $APP_DESCRIPTION
 Seria is a multimodal serialized-data editor designed for game writers
 and narrative designers. It provides CSV/TSV/screenplay editing with
 rich views (cell grid, corkboard, print) and export pipelines.
CONTROL

# Refresh desktop and icon caches after install/removal so the new
# .desktop entry shows up without a logout.
cat > "$DEB_ROOT/DEBIAN/postinst" <<'POSTINST'
#!/bin/sh
set -e
if command -v update-desktop-database >/dev/null 2>&1; then
	update-desktop-database -q /usr/share/applications || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
	gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi
POSTINST
chmod 755 "$DEB_ROOT/DEBIAN/postinst"
cp "$DEB_ROOT/DEBIAN/postinst" "$DEB_ROOT/DEBIAN/postrm"

DEB_OUT="$OUT_DIR/${APP_NAME}_${VERSION}_amd64.deb"
dpkg-deb --root-owner-group --build "$DEB_ROOT" "$DEB_OUT" > /dev/null
echo "  -> $DEB_OUT"

fi  # HAVE_DPKG

# ─── .rpm ──────────────────────────────────────────────────────────────

if [ "$HAVE_RPMBUILD" = "0" ]; then
	echo "Skipping .rpm — rpmbuild not installed (sudo apt install rpm)"
	RPM_OUT=""
else

echo "Building .rpm package..."

RPM_TOP="$STAGING/rpm"
mkdir -p "$RPM_TOP"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}

# Stage the FHS tree into BUILDROOT where rpmbuild expects installed files
RPM_BUILDROOT="$RPM_TOP/BUILDROOT/${APP_NAME}-${VERSION}-1.x86_64"
mkdir -p "$RPM_BUILDROOT"
cp -a "$FHS_ROOT"/. "$RPM_BUILDROOT/"

SPEC="$RPM_TOP/SPECS/seria.spec"
cat > "$SPEC" <<SPEC
Name:           $APP_NAME
Version:        $VERSION
Release:        1%{?dist}
Summary:        $APP_DESCRIPTION
License:        $APP_LICENSE
URL:            $APP_URL
BuildArch:      x86_64
Requires:       gtk3, webkit2gtk4.1

# Everything is pre-staged in BUILDROOT by the wrapper script.
AutoReqProv:    no

%description
Seria is a multimodal serialized-data editor designed for game writers
and narrative designers. It provides CSV/TSV/screenplay editing with
rich views (cell grid, corkboard, print) and export pipelines.

%files
/usr/bin/seria
/usr/lib/seria
/usr/share/applications/seria.desktop
/usr/share/icons/hicolor/*/apps/seria.png

%post
if command -v update-desktop-database >/dev/null 2>&1; then
	update-desktop-database -q /usr/share/applications || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
	gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi

%postun
if command -v update-desktop-database >/dev/null 2>&1; then
	update-desktop-database -q /usr/share/applications || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
	gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi
SPEC

rpmbuild \
	--define "_topdir $RPM_TOP" \
	--define "_binary_payload w9.zstdio" \
	--buildroot "$RPM_BUILDROOT" \
	-bb "$SPEC" > "$STAGING/rpmbuild.log" 2>&1 || {
	echo "rpmbuild failed. Log:"
	cat "$STAGING/rpmbuild.log"
	exit 1
}

# rpmbuild drops the artifact under RPMS/<arch>/
RPM_SRC="$RPM_TOP/RPMS/x86_64/${APP_NAME}-${VERSION}-1.x86_64.rpm"
RPM_OUT="$OUT_DIR/${APP_NAME}-${VERSION}-1.x86_64.rpm"
cp "$RPM_SRC" "$RPM_OUT"
echo "  -> $RPM_OUT"

fi  # HAVE_RPMBUILD

# ─── Summary ───────────────────────────────────────────────────────────

echo ""
echo "Linux packaging complete."
[ -n "$DEB_OUT" ] && ls -lh "$DEB_OUT" || true
[ -n "$RPM_OUT" ] && ls -lh "$RPM_OUT" || true

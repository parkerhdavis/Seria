#!/usr/bin/env bash

# Setup script for Seria Desktop App (Electrobun edition)
# Installs Bun and checks OS-level GTK / WebKit deps on Linux.
# No Rust toolchain required.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

echo "════════════════════════════════════════════════════════════════════════════════"
echo "  Seria Setup - Installing Dependencies"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

SETUP_COMPLETE=true
MISSING_DEPS_MESSAGE=""

# ────────────────────────────────────────────────────────────────────────────────
# Detect Operating System
# ────────────────────────────────────────────────────────────────────────────────
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    echo "Detected: Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    echo "Detected: macOS"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    OS="windows"
    echo "Detected: Windows (Git Bash/WSL)"
else
    echo "Unknown OS: $OSTYPE"
    echo "This script supports Linux, macOS, and Windows (via Git Bash/WSL)"
    echo "Continuing with limited checks..."
fi
echo ""

# ────────────────────────────────────────────────────────────────────────────────
# Check for Bun
# ────────────────────────────────────────────────────────────────────────────────
echo "Checking for Bun installation..."

if ! command -v bun &> /dev/null; then
    echo "Bun not found. Installing Bun..."
    echo ""
    curl -fsSL https://bun.sh/install | bash
    echo ""
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    if ! command -v bun &> /dev/null; then
        echo "Bun was installed but is not in PATH."
        echo "Please restart your terminal and run 'make setup' again."
        exit 0
    fi
    echo "Bun installed: $(bun --version)"
else
    echo "Bun is installed: $(bun --version)"
fi

# ────────────────────────────────────────────────────────────────────────────────
# Install dependencies via Bun
# ────────────────────────────────────────────────────────────────────────────────
echo ""
echo "Installing project dependencies..."
bun install

# ────────────────────────────────────────────────────────────────────────────────
# System Dependencies Check
# ────────────────────────────────────────────────────────────────────────────────

if [ "$OS" = "linux" ]; then
    echo ""
    echo "Checking Linux system dependencies for Electrobun (webkit2gtk)..."

    REQUIRED_PACKAGES=(
        "libwebkit2gtk-4.1-dev"
        "libgtk-3-dev"
        "libayatana-appindicator3-dev"
        "librsvg2-dev"
    )

    MISSING_PACKAGES=()
    for package in "${REQUIRED_PACKAGES[@]}"; do
        if ! dpkg-query -W -f='${Status}' "$package" 2>/dev/null | grep -q "install ok installed"; then
            MISSING_PACKAGES+=("$package")
        fi
    done

    if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
        SETUP_COMPLETE=false
        echo ""
        echo "Missing system dependencies:"
        for package in "${MISSING_PACKAGES[@]}"; do
            echo "    - $package"
        done
        echo ""
        echo "To install missing dependencies on Ubuntu/Debian, run:"
        echo ""
        echo "  sudo apt install ${MISSING_PACKAGES[*]}"
        echo ""
        MISSING_DEPS_MESSAGE="${MISSING_DEPS_MESSAGE}\n  - Install system dependencies (see above)"
    else
        echo "All required system dependencies are installed"
    fi

elif [ "$OS" = "macos" ]; then
    echo ""
    echo "Checking macOS dependencies..."
    if ! xcode-select -p &> /dev/null; then
        SETUP_COMPLETE=false
        echo "Xcode Command Line Tools not installed"
        echo ""
        echo "To install, run:  xcode-select --install"
        MISSING_DEPS_MESSAGE="${MISSING_DEPS_MESSAGE}\n  - Install Xcode Command Line Tools: xcode-select --install"
    else
        echo "Xcode Command Line Tools installed"
    fi

elif [ "$OS" = "windows" ]; then
    echo ""
    echo "On Windows, Electrobun uses the bundled WebView2 runtime."
    echo "No additional system deps should be needed beyond Bun."
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
if [ "$SETUP_COMPLETE" = true ]; then
    echo "  Setup Complete - Ready for Development"
    echo "════════════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "Next steps:"
    echo "  - Run 'make dev' to start the development server"
    echo "  - Run 'make build' to produce the release bundle"
    echo ""
else
    echo "  Setup Incomplete - Action Required"
    echo "════════════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "Dependencies have been installed, but some system packages are missing."
    echo ""
    echo "Please complete:"
    echo -e "$MISSING_DEPS_MESSAGE"
    echo ""
    echo "Then re-run ./setup.sh to verify."
    echo ""
fi

#!/usr/bin/env bash

# Setup script for Seria Desktop App
# Cross-platform setup for Linux, macOS, and Windows (via Git Bash/WSL)
# Installs Rust toolchain and Node.js dependencies

set -euo pipefail

# Move to the directory this script lives in
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

echo "════════════════════════════════════════════════════════════════════════════════"
echo "  Seria Setup - Installing Dependencies"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Track whether setup is fully complete
SETUP_COMPLETE=true
MISSING_DEPS_MESSAGE=""

# ────────────────────────────────────────────────────────────────────────────────
# Detect Operating System
# ────────────────────────────────────────────────────────────────────────────────
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    echo "🖥️  Detected: Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    echo "🍎 Detected: macOS"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    OS="windows"
    echo "🪟 Detected: Windows (Git Bash/WSL)"
else
    echo "⚠️  Unknown OS: $OSTYPE"
    echo "This script supports Linux, macOS, and Windows (via Git Bash/WSL)"
    echo "Continuing with limited checks..."
fi
echo ""

# ────────────────────────────────────────────────────────────────────────────────
# Check for Rust
# ────────────────────────────────────────────────────────────────────────────────
echo "🔍 Checking for Rust installation..."
if ! command -v rustc &> /dev/null; then
    echo "⚠️  Rust not found. Installing Rust..."
    echo ""
    echo "Please follow the prompts to install Rust via rustup."
    echo "After installation completes, run this setup script again."
    echo ""
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    echo ""
    echo "✅ Rust installed. Please restart your terminal and run 'make setup' again."
    exit 0
else
    echo "✅ Rust is installed: $(rustc --version)"
fi

# ────────────────────────────────────────────────────────────────────────────────
# Check for Node.js
# ────────────────────────────────────────────────────────────────────────────────
echo ""
echo "🔍 Checking for Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ and run this setup again."
    echo ""
    echo "Install from: https://nodejs.org/"
    exit 1
else
    echo "✅ Node.js is installed: $(node --version)"
fi

# ────────────────────────────────────────────────────────────────────────────────
# Install Node.js dependencies
# ────────────────────────────────────────────────────────────────────────────────
echo ""
echo "📦 Installing Node.js dependencies..."

# For development mode, we delete lock files and node_modules to ensure fresh installs
# This matches our pattern from other projects and ensures we get latest versions
if [ -d "frontend" ]; then
    pushd frontend > /dev/null
    echo "  → Installing frontend dependencies (includes Tauri CLI)..."
    rm -f package-lock.json
    rm -rf node_modules
    npm install
    popd > /dev/null
else
    echo "⚠️  frontend/ directory not found - skipping frontend dependencies"
fi

# ────────────────────────────────────────────────────────────────────────────────
# System Dependencies Check
# ────────────────────────────────────────────────────────────────────────────────

if [ "$OS" = "linux" ]; then
    # ═══════════════════════════════════════════════════════════════════════════
    # Linux System Dependencies
    # ═══════════════════════════════════════════════════════════════════════════
    echo ""
    echo "🔍 Checking Linux system dependencies for Tauri..."

    # List of required packages for Tauri 2.0
    # Note: Tauri 2.0 requires webkit2gtk-4.1 (not 4.0)
    REQUIRED_PACKAGES=(
        "libwebkit2gtk-4.1-dev"
        "build-essential"
        "curl"
        "wget"
        "file"
        "libssl-dev"
        "libgtk-3-dev"
        "libayatana-appindicator3-dev"
        "librsvg2-dev"
    )

    MISSING_PACKAGES=()

    for package in "${REQUIRED_PACKAGES[@]}"; do
        # Use dpkg-query for reliable package detection
        # It returns "install ok installed" for installed packages
        if ! dpkg-query -W -f='${Status}' "$package" 2>/dev/null | grep -q "install ok installed"; then
            MISSING_PACKAGES+=("$package")
        fi
    done

    if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
        SETUP_COMPLETE=false
        echo ""
        echo "⚠️  Missing system dependencies:"
        for package in "${MISSING_PACKAGES[@]}"; do
            echo "    - $package"
        done
        echo ""
        echo "To install missing dependencies on Ubuntu/Debian, run:"
        echo ""
        echo "  sudo apt install ${MISSING_PACKAGES[*]}"
        echo ""
        MISSING_DEPS_MESSAGE="${MISSING_DEPS_MESSAGE}\n  • Install system dependencies (see above)"
    else
        echo "✅ All required system dependencies are installed"
    fi

elif [ "$OS" = "macos" ]; then
    # ═══════════════════════════════════════════════════════════════════════════
    # macOS System Dependencies
    # ═══════════════════════════════════════════════════════════════════════════
    echo ""
    echo "🔍 Checking macOS system dependencies for Tauri..."

    # Check for Xcode Command Line Tools
    if ! xcode-select -p &> /dev/null; then
        SETUP_COMPLETE=false
        echo "⚠️  Xcode Command Line Tools not installed"
        echo ""
        echo "To install, run:"
        echo "  xcode-select --install"
        echo ""
        MISSING_DEPS_MESSAGE="${MISSING_DEPS_MESSAGE}\n  • Install Xcode Command Line Tools: xcode-select --install"
    else
        echo "✅ Xcode Command Line Tools installed"
    fi

    # Check for Homebrew
    if ! command -v brew &> /dev/null; then
        echo "⚠️  Homebrew not found (recommended but not required)"
        echo ""
        echo "Homebrew is recommended for managing dependencies on macOS."
        echo "Install from: https://brew.sh"
        echo ""
    else
        echo "✅ Homebrew installed"
    fi

elif [ "$OS" = "windows" ]; then
    # ═══════════════════════════════════════════════════════════════════════════
    # Windows System Dependencies
    # ═══════════════════════════════════════════════════════════════════════════
    echo ""
    echo "🔍 Checking Windows system dependencies for Tauri..."
    echo ""
    echo "On Windows, Tauri requires:"
    echo "  1. Microsoft Visual Studio C++ Build Tools"
    echo "  2. WebView2 Runtime (usually pre-installed on Windows 10+)"
    echo ""
    echo "For detailed instructions, see:"
    echo "  https://tauri.app/v2/guides/prerequisites/#windows"
    echo ""

    # Check for Visual Studio Build Tools (rough check)
    if command -v cl &> /dev/null; then
        echo "✅ Visual Studio C++ Build Tools appear to be installed"
    else
        SETUP_COMPLETE=false
        echo "⚠️  Visual Studio C++ Build Tools may not be installed"
        echo "   Install from: https://visualstudio.microsoft.com/downloads/"
        echo "   Select 'Desktop development with C++' workload"
        echo ""
        MISSING_DEPS_MESSAGE="${MISSING_DEPS_MESSAGE}\n  • Install Visual Studio C++ Build Tools (see above)"
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
if [ "$SETUP_COMPLETE" = true ]; then
    echo "  ✅ Setup Complete - Ready for Development"
    echo "════════════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "Next steps:"
    echo "  • Run 'make dev' to start the development server"
    echo "  • Run 'make build' to create production installers"
    echo ""
else
    echo "  ⚠️  Setup Incomplete - Action Required"
    echo "════════════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "Node.js dependencies have been installed, but system dependencies are missing."
    echo ""
    echo "Before you can start development, please complete these steps:"
    echo -e "$MISSING_DEPS_MESSAGE"
    echo ""
    echo "After installing the missing dependencies, you can:"
    echo "  • Run 'make dev' to start the development server"
    echo "  • Run 'make build' to create production installers"
    echo ""
    echo "Or run './setup.sh' again to verify your setup."
    echo ""
fi

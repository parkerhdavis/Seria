#!/usr/bin/env bash

# Setup script for Seria Desktop App
# Installs Rust toolchain and Node.js dependencies

set -euo pipefail

# Move to the directory this script lives in
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

echo "════════════════════════════════════════════════════════════════════════════════"
echo "  Seria Setup - Installing Dependencies"
echo "════════════════════════════════════════════════════════════════════════════════"
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
# System Dependencies Check (Linux only)
# ────────────────────────────────────────────────────────────────────────────────
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
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
        if ! dpkg -l | grep -q "^ii  $package"; then
            MISSING_PACKAGES+=("$package")
        fi
    done

    if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
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
        echo "After installing system dependencies, you can run 'make dev' to start development."
    else
        echo "✅ All required system dependencies are installed"
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "  ✅ Setup Complete"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Run 'make dev' to start the development server"
echo "  2. Run 'make build' to create a production installer"
echo ""

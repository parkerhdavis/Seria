.PHONY: help dev build build-linux build-windows upload upload-dry lint format test clean setup install dev-frontend check

help:
	@echo "════════════════════════════════════════════════════════════════════════════════"
	@echo "  Seria Project - Development Commands"
	@echo "════════════════════════════════════════════════════════════════════════════════"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Running (Development):"
	@echo "  dev                # Start Tauri dev server (frontend + Rust hot-reload)"
	@echo "  dev-frontend       # Start Vite dev server only (rapid UI iteration)"
	@echo ""
	@echo "Building:"
	@echo "  setup              # Install all dependencies (Rust + Node.js)"
	@echo "  install            # Install Node.js dependencies (runs setup.sh)"
	@echo "  build              # Build for ALL platforms (Linux + Windows)"
	@echo "  build-linux        # Build Linux installers only (.deb, .rpm, AppImage)"
	@echo "  build-windows      # Build Windows installers only (.exe, .msi)"
	@echo "  upload             # Upload release artifacts to GitLab Package Registry"
	@echo "  upload-dry         # Show what would be uploaded without uploading"
	@echo "  check              # Run Rust compiler checks without building"
	@echo ""
	@echo "Quality:"
	@echo "  lint               # Run ESLint and Rust clippy"
	@echo "  format             # Format code with Prettier and rustfmt"
	@echo "  test               # Run tests (Vitest + Rust tests)"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean              # Remove build artifacts and dependencies"
	@echo ""
	@echo "Quick workflows:"
	@echo "  make dev           # Start development with hot-reload"
	@echo "  make build         # Build all platform installers (Linux + Windows)"
	@echo "  make lint format   # Check and format all code"
	@echo ""
	@echo "════════════════════════════════════════════════════════════════════════════════"
	@echo ""

# ==================================================================
# SERVICE COMMANDS
# The most standard commands typically run by devs
# ==================================================================

# -------------
# Running
# -------------

dev:
	@echo "🚀 Starting Tauri development server (frontend + Rust)..."
	@echo "  → Starting Vite dev server in background..."
	@cd frontend && npm run dev > /dev/null 2>&1 & echo $$! > ../.vite.pid
	@sleep 2
	@echo "  → Starting Tauri..."
	@cd backend && ../frontend/node_modules/.bin/tauri dev || (kill `cat ../.vite.pid` 2>/dev/null; rm -f ../.vite.pid; exit 1)
	@kill `cat .vite.pid` 2>/dev/null || true
	@rm -f .vite.pid

dev-frontend:
	@echo "🚀 Starting Vite dev server only (rapid UI iteration)..."
	@cd frontend && npm run dev

# ==================================================================
# COMMAND MODULES
# Typically part of a Service Command; can also be run manually
# ==================================================================

# -------------
# Building
# -------------

setup:
	@echo "📦 Installing all dependencies (Rust + Node.js)..."
	@./setup.sh
	@echo "✅ Setup complete"

install: setup
	@echo "✅ Dependencies installed"

build: build-linux build-windows
	@echo ""
	@echo "════════════════════════════════════════════════════════════════════════════════"
	@echo "✅ All platform builds complete!"
	@echo "════════════════════════════════════════════════════════════════════════════════"
	@echo ""
	@echo "Linux installers: target/release/bundle/"
	@echo "Windows binary:   target/x86_64-pc-windows-msvc/release/seria.exe"
	@echo ""
	@echo "See target/README.md for detailed build output locations."
	@echo ""

build-linux:
	@echo "🔨 Building Linux installers (.deb, .rpm, AppImage)..."
	@echo "  → Syncing version from .env..."
	@./scripts/sync-version.sh
	@echo "  → Building frontend..."
	@cd frontend && npm run build
	@echo "  → Building Tauri app for Linux..."
	@cd backend && ../frontend/node_modules/.bin/tauri build
	@echo ""
	@echo "✅ Linux build complete!"
	@echo ""
	@echo "Build outputs in target/release/bundle/:"
	@echo "  • AppImage: target/release/bundle/appimage/"
	@echo "  • Debian:   target/release/bundle/deb/"
	@echo "  • RPM:      target/release/bundle/rpm/"
	@echo ""

build-windows:
	@echo "🔨 Cross-compiling Windows build from Linux..."
	@echo "  → Syncing version from .env..."
	@./scripts/sync-version.sh
	@echo "  → Building frontend..."
	@cd frontend && npm run build
	@echo "  → Building Rust backend for Windows (x86_64-pc-windows-msvc)..."
	@cd backend && cargo xwin build --release --target x86_64-pc-windows-msvc
	@echo ""
	@echo "✅ Windows build complete!"
	@echo ""
	@echo "Binary location:"
	@echo "  target/x86_64-pc-windows-msvc/release/seria.exe"
	@echo ""
	@echo "Note: Windows installers (.msi, .exe) can only be created on Windows."
	@echo "      The seria.exe binary is fully functional and can be distributed directly."
	@echo "      To create installers, run 'npm run tauri:build' on a Windows machine."
	@echo ""

check:
	@echo "🔍 Running Rust compiler checks..."
	@cd backend && cargo check
	@echo "✅ Rust checks passed"

upload:
	@echo "📦 Uploading release artifacts to GitLab Package Registry..."
	@if [ ! -f target/upload-to-gitlab.sh ]; then \
		echo "❌ Upload script not found at target/upload-to-gitlab.sh"; \
		exit 1; \
	fi
	@cd target && ./upload-to-gitlab.sh
	@echo ""

upload-dry:
	@echo "🔍 Dry run - checking what would be uploaded..."
	@if [ ! -f target/upload-to-gitlab.sh ]; then \
		echo "❌ Upload script not found at target/upload-to-gitlab.sh"; \
		exit 1; \
	fi
	@cd target && ./upload-to-gitlab.sh --dry-run
	@echo ""

# -------------
# Quality
# -------------

lint:
	@echo "🔍 Linting frontend code..."
	@cd frontend && npm run lint
	@echo "🔍 Linting Rust code..."
	@cd backend && cargo clippy -- -D warnings
	@echo "✅ Lint complete"

format:
	@echo "✨ Formatting frontend code..."
	@cd frontend && npx prettier --write src/
	@echo "✨ Formatting Rust code..."
	@cd backend && cargo fmt
	@echo "✅ Format complete"

test:
	@echo "🧪 Running frontend tests..."
	@cd frontend && npm run test
	@echo "🧪 Running Rust tests..."
	@cd backend && cargo test
	@echo "✅ Tests complete"

# -------------
# Maintenance
# -------------

clean:
	@echo "🗑️  Cleaning build artifacts..."
	@rm -rf frontend/node_modules
	@rm -rf frontend/dist
	@rm -rf node_modules
	@rm -rf target
	@echo "✅ Cleanup complete"

.DEFAULT_GOAL := help

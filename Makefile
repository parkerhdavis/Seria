.PHONY: help dev build build-linux build-windows build-macos upload upload-dry lint format test clean setup install dev-frontend check

# ==================================================================
# OS DETECTION
# ==================================================================
# Detect OS for platform-specific commands
# On Windows, uname doesn't exist, so we check for Windows-specific env vars first
ifdef OS
    # Windows sets OS=Windows_NT
    ifeq ($(OS),Windows_NT)
        UNAME_S := Windows
    else
        UNAME_S := $(shell uname -s 2>/dev/null || echo Windows)
    endif
else
    UNAME_S := $(shell uname -s 2>/dev/null || echo Windows)
endif
ifneq (,$(findstring MINGW,$(UNAME_S)))
    DETECTED_OS := windows
else ifneq (,$(findstring MSYS,$(UNAME_S)))
    DETECTED_OS := windows
else ifneq (,$(findstring CYGWIN,$(UNAME_S)))
    DETECTED_OS := windows
else ifneq (,$(findstring Windows,$(UNAME_S)))
    DETECTED_OS := windows
else ifeq ($(UNAME_S),Linux)
    DETECTED_OS := linux
else ifeq ($(UNAME_S),Darwin)
    DETECTED_OS := macos
else
    DETECTED_OS := windows
endif

# Windows-specific: use PowerShell 7 (pwsh) for complex commands
ifeq ($(DETECTED_OS),windows)
    SHELL := pwsh.exe
    .SHELLFLAGS := -NoProfile -Command
    SYNC_VERSION := pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/sync-version.ps1
    NPM := npm
    TAURI := npx tauri
    MKDIR := New-Item -ItemType Directory -Force -Path
    RM := Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    NULL := $$null
else
    SYNC_VERSION := ./scripts/sync-version.sh
    NPM := npm
    TAURI := ./node_modules/.bin/tauri
    MKDIR := mkdir -p
    RM := rm -rf
    NULL := /dev/null
    # Source nvm for non-interactive shells (fixes WSL where Windows npm is in PATH)
    SOURCE_NVM := export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" ||:
endif

help:
	@echo "================================================================================"
	@echo "  Seria Project - Development Commands"
	@echo "================================================================================"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Running (Development):"
	@echo "  dev                - Start Tauri dev server (frontend + Rust hot-reload)"
	@echo "  dev-frontend       - Start Vite dev server only (rapid UI iteration)"
	@echo ""
	@echo "Building:"
	@echo "  setup              - Install all dependencies (Rust + Node.js)"
	@echo "  install            - Install Node.js dependencies (runs setup.sh)"
	@echo "  build              - Build for current platform (detects OS)"
	@echo "  build-linux        - Build Linux installers (.deb, .rpm, AppImage)"
	@echo "  build-windows      - Build Windows installers (.msi, .exe)"
	@echo "  build-macos        - Build macOS installers (.dmg, .app)"
	@echo "  check              - Run Rust compiler checks without building"
	@echo ""
	@echo "Quality:"
	@echo "  lint               - Run ESLint and Rust clippy"
	@echo "  format             - Format code with Prettier and rustfmt"
	@echo "  test               - Run tests (Vitest + Rust tests)"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean              - Remove build artifacts and dependencies"
	@echo ""
	@echo "Detected OS: $(DETECTED_OS)"
	@echo "================================================================================"

# ==================================================================
# SERVICE COMMANDS
# The most standard commands typically run by devs
# ==================================================================

# -------------
# Running
# -------------

ifeq ($(DETECTED_OS),windows)
dev:
	@echo "Starting Tauri development server (frontend + Rust)..."
	cd frontend; npm run tauri:dev

dev-frontend:
	@echo "Starting Vite dev server only (rapid UI iteration)..."
	cd frontend; npm run dev
else
dev:
	@echo "Starting Tauri development server (frontend + Rust)..."
	@echo "  -> Starting Vite dev server in background..."
	@$(SOURCE_NVM) && cd frontend && npm run dev > /dev/null 2>&1 & echo $$! > ../.vite.pid
	@sleep 2
	@echo "  -> Starting Tauri..."
	@$(SOURCE_NVM) && cd backend && ../frontend/node_modules/.bin/tauri dev || (kill `cat ../.vite.pid` 2>/dev/null; rm -f ../.vite.pid; exit 1)
	@kill `cat .vite.pid` 2>/dev/null || true
	@rm -f .vite.pid

dev-frontend:
	@echo "Starting Vite dev server only (rapid UI iteration)..."
	@$(SOURCE_NVM) && cd frontend && npm run dev
endif

# ==================================================================
# COMMAND MODULES
# Typically part of a Service Command; can also be run manually
# ==================================================================

# -------------
# Building
# -------------

ifeq ($(DETECTED_OS),windows)
setup:
	@echo "Installing all dependencies (Rust + Node.js)..."
	@echo "Please ensure Rust and Node.js 18+ are installed."
	cd frontend; npm install
	@echo "Setup complete"

install: setup
	@echo "Dependencies installed"
else
setup:
	@echo "Installing all dependencies (Rust + Node.js)..."
	@./setup.sh
	@echo "Setup complete"

install: setup
	@echo "Dependencies installed"
endif

ifeq ($(DETECTED_OS),windows)
# On Windows, inline the build commands to avoid recursive make issues with PowerShell
build:
	@echo "Building Windows installers (.msi, .exe)..."
	@echo "  -> Syncing version from .env..."
	$(SYNC_VERSION)
	@echo "  -> Building frontend..."
	cd frontend; npm run build
	@echo "  -> Building Tauri app for Windows..."
	$$env:PATH = "$$env:USERPROFILE\.cargo\bin;$$env:PATH"; cd backend; ../frontend/node_modules/.bin/tauri build
	@echo ""
	@echo "Windows build complete!"
	@echo ""
	@echo "Build outputs in target/release/bundle/:"
	@echo "  - MSI Installer:  target/release/bundle/msi/"
	@echo "  - NSIS Installer: target/release/bundle/nsis/"
else
build:
ifeq ($(DETECTED_OS),linux)
	@$(MAKE) build-linux
else ifeq ($(DETECTED_OS),macos)
	@$(MAKE) build-macos
endif
endif

ifeq ($(DETECTED_OS),windows)
build-linux:
	@echo "ERROR: Linux builds must be run on Linux"
	@exit 1

build-windows:
	@echo "Building Windows installers (.msi, .exe)..."
	@echo "  -> Syncing version from .env..."
	$(SYNC_VERSION)
	@echo "  -> Building frontend..."
	cd frontend; npm run build
	@echo "  -> Building Tauri app for Windows..."
	$$env:PATH = "$$env:USERPROFILE\.cargo\bin;$$env:PATH"; cd backend; ../frontend/node_modules/.bin/tauri build
	@echo ""
	@echo "Windows build complete!"
	@echo ""
	@echo "Build outputs in target/release/bundle/:"
	@echo "  - MSI Installer:  target/release/bundle/msi/"
	@echo "  - NSIS Installer: target/release/bundle/nsis/"

build-macos:
	@echo "ERROR: macOS builds must be run on macOS"
	@exit 1
else
build-linux:
	@echo "Building Linux installers (.deb, .rpm, AppImage)..."
	@echo "  -> Syncing version from .env..."
	@$(SYNC_VERSION)
	@echo "  -> Building frontend..."
	@$(SOURCE_NVM) && cd frontend && npm run build
	@echo "  -> Building Tauri app for Linux..."
	@$(SOURCE_NVM) && cd backend && ../frontend/node_modules/.bin/tauri build
	@echo ""
	@echo "Linux build complete!"
	@echo ""
	@echo "Build outputs in target/release/bundle/:"
	@echo "  - AppImage: target/release/bundle/appimage/"
	@echo "  - Debian:   target/release/bundle/deb/"
	@echo "  - RPM:      target/release/bundle/rpm/"

build-windows:
	@echo "ERROR: Windows builds must be run on Windows"
	@exit 1

build-macos:
	@echo "Building macOS installers (.dmg, .app)..."
	@echo "  -> Syncing version from .env..."
	@$(SYNC_VERSION)
	@echo "  -> Building frontend..."
	@$(SOURCE_NVM) && cd frontend && npm run build
	@echo "  -> Building Tauri app for macOS..."
	@$(SOURCE_NVM) && cd backend && ../frontend/node_modules/.bin/tauri build
	@echo ""
	@echo "macOS build complete!"
	@echo ""
	@echo "Build outputs in target/release/bundle/:"
	@echo "  - DMG:  target/release/bundle/dmg/"
	@echo "  - App:  target/release/bundle/macos/"
endif

ifeq ($(DETECTED_OS),windows)
check:
	@echo "Running Rust compiler checks..."
	cd backend; cargo check
	@echo "Rust checks passed"
else
check:
	@echo "Running Rust compiler checks..."
	@cd backend && cargo check
	@echo "Rust checks passed"
endif

upload:
	@echo "Uploading release artifacts to GitLab Package Registry..."
ifeq ($(DETECTED_OS),windows)
	@echo "ERROR: Upload script requires bash. Please run from WSL or Git Bash."
	@exit 1
else
	@if [ ! -f target/upload-to-gitlab.sh ]; then \
		echo "ERROR: Upload script not found at target/upload-to-gitlab.sh"; \
		exit 1; \
	fi
	@cd target && ./upload-to-gitlab.sh
endif

upload-dry:
	@echo "Dry run - checking what would be uploaded..."
ifeq ($(DETECTED_OS),windows)
	@echo "ERROR: Upload script requires bash. Please run from WSL or Git Bash."
	@exit 1
else
	@if [ ! -f target/upload-to-gitlab.sh ]; then \
		echo "ERROR: Upload script not found at target/upload-to-gitlab.sh"; \
		exit 1; \
	fi
	@cd target && ./upload-to-gitlab.sh --dry-run
endif

# -------------
# Quality
# -------------

ifeq ($(DETECTED_OS),windows)
lint:
	@echo "Linting frontend code..."
	cd frontend; npm run lint
	@echo "Linting Rust code..."
	cd backend; cargo clippy -- -D warnings
	@echo "Lint complete"

format:
	@echo "Formatting frontend code..."
	cd frontend; npx prettier --write src/
	@echo "Formatting Rust code..."
	cd backend; cargo fmt
	@echo "Format complete"

test:
	@echo "Running frontend tests..."
	cd frontend; npm run test
	@echo "Running Rust tests..."
	cd backend; cargo test
	@echo "Tests complete"
else
lint:
	@echo "Linting frontend code..."
	@$(SOURCE_NVM) && cd frontend && npm run lint
	@echo "Linting Rust code..."
	@cd backend && cargo clippy -- -D warnings
	@echo "Lint complete"

format:
	@echo "Formatting frontend code..."
	@$(SOURCE_NVM) && cd frontend && npx prettier --write src/
	@echo "Formatting Rust code..."
	@cd backend && cargo fmt
	@echo "Format complete"

test:
	@echo "Running frontend tests..."
	@$(SOURCE_NVM) && cd frontend && npm run test
	@echo "Running Rust tests..."
	@cd backend && cargo test
	@echo "Tests complete"
endif

# -------------
# Maintenance
# -------------

ifeq ($(DETECTED_OS),windows)
clean:
	@echo "Cleaning build artifacts..."
	if (Test-Path frontend/node_modules) { Remove-Item -Recurse -Force frontend/node_modules }
	if (Test-Path frontend/dist) { Remove-Item -Recurse -Force frontend/dist }
	if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
	if (Test-Path target) { Get-ChildItem target -Exclude README.md,upload-to-gitlab.sh | Remove-Item -Recurse -Force }
	@echo "Cleanup complete"
else
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf frontend/node_modules
	@rm -rf frontend/dist
	@rm -rf node_modules
	@if [ -d target ]; then \
		echo "  -> Cleaning target/ (preserving README.md and upload-to-gitlab.sh)..."; \
		find target -mindepth 1 -maxdepth 1 ! -name 'README.md' ! -name 'upload-to-gitlab.sh' -exec rm -rf {} + ; \
	fi
	@echo "Cleanup complete"
endif

.DEFAULT_GOAL := help

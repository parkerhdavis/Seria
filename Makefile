.PHONY: help dev down build build-linux build-windows build-macos upload upload-dry lint format test clean setup install dev-frontend check

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
    BUN := bun
    # Run the tauri CLI JS entry point directly with bun to avoid needing node on PATH.
    TAURI := bun ..\frontend\node_modules\@tauri-apps\cli\tauri.js
    MKDIR := New-Item -ItemType Directory -Force -Path
    RM := Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    NULL := $$null
else
    SYNC_VERSION := ./scripts/sync-version.sh
    BUN := bun
    # Run the tauri CLI JS entry point directly with bun to avoid the #!/usr/bin/env node shim,
    # since node may not be on PATH (bun replaces it as our JS runtime).
    TAURI := bun ../frontend/node_modules/@tauri-apps/cli/tauri.js
    MKDIR := mkdir -p
    RM := rm -rf
    NULL := /dev/null
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
	@echo "  dev-frontend       - Start Bun dev server only (rapid UI iteration)"
	@echo "  down               - Stop any running dev server"
	@echo ""
	@echo "Building:"
	@echo "  setup              - Install all dependencies (Rust + Bun)"
	@echo "  install            - Install dependencies (runs setup.sh)"
	@echo "  build              - Build for current platform (detects OS)"
	@echo "  build-linux        - Build Linux installers (.deb, .rpm, AppImage)"
	@echo "  build-windows      - Build Windows installers (.msi, .exe)"
	@echo "  build-macos        - Build macOS installers (.dmg, .app)"
	@echo "  check              - Run Rust compiler checks without building"
	@echo ""
	@echo "Quality:"
	@echo "  lint               - Run ESLint and Rust clippy"
	@echo "  format             - Format code with Prettier and rustfmt"
	@echo "  test               - Run tests (Bun + Rust tests)"
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
	cd backend; $(TAURI) dev

dev-frontend:
	@echo "Starting Bun dev server only (rapid UI iteration)..."
	cd frontend; bun run dev

down:
	@echo "Stopping dev server..."
	@echo "On Windows, close the terminal running the dev server or use Task Manager."
else
dev:
	@echo "Starting Tauri development server (frontend + Rust)..."
	@# Kill any leftover dev server on port 5173 (prevents cross-project conflicts)
	@EXISTING_PID=$$(lsof -ti :5173 2>/dev/null); \
	if [ -n "$$EXISTING_PID" ]; then \
		echo "  -> Killing existing process on port 5173 (pid $$EXISTING_PID)..."; \
		kill $$EXISTING_PID 2>/dev/null || true; \
		sleep 1; \
	fi
	@echo "  -> Starting Bun dev server in background..."
	@cd frontend && setsid bun run dev > /dev/null 2>&1 & echo $$! > .dev.pid
	@sleep 2
	@echo "  -> Starting Tauri..."
	@cd backend && $(TAURI) dev; \
	DEV_PID=$$(cat ../.dev.pid 2>/dev/null); \
	if [ -n "$$DEV_PID" ]; then \
		kill -- -$$DEV_PID 2>/dev/null || kill $$DEV_PID 2>/dev/null || true; \
	fi; \
	rm -f ../.dev.pid
	@DEV_PID=$$(cat .dev.pid 2>/dev/null); \
	if [ -n "$$DEV_PID" ]; then \
		kill -- -$$DEV_PID 2>/dev/null || kill $$DEV_PID 2>/dev/null || true; \
	fi
	@rm -f .dev.pid

down:
	@echo "Stopping Seria dev server..."
	@DEV_PID=$$(cat .dev.pid 2>/dev/null); \
	if [ -n "$$DEV_PID" ]; then \
		kill -- -$$DEV_PID 2>/dev/null || kill $$DEV_PID 2>/dev/null || true; \
		rm -f .dev.pid; \
		echo "  -> Killed dev server process group (pid $$DEV_PID)"; \
	else \
		echo "  -> No .dev.pid found, checking port 5173..."; \
		PORT_PID=$$(lsof -ti :5173 2>/dev/null); \
		if [ -n "$$PORT_PID" ]; then \
			kill $$PORT_PID 2>/dev/null || true; \
			echo "  -> Killed process on port 5173 (pid $$PORT_PID)"; \
		else \
			echo "  -> No dev server running"; \
		fi; \
	fi

dev-frontend:
	@echo "Starting Bun dev server only (rapid UI iteration)..."
	@cd frontend && bun run dev
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
	@echo "Installing all dependencies (Rust + Bun)..."
	@echo "Please ensure Rust and Bun are installed."
	cd frontend; bun install
	@echo "Setup complete"

install: setup
	@echo "Dependencies installed"
else
setup:
	@echo "Installing all dependencies (Rust + Bun)..."
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
	cd frontend; bun run build
	@echo "  -> Building Tauri app for Windows..."
	$$env:PATH = "$$env:USERPROFILE\.cargo\bin;$$env:PATH"; cd backend; $(TAURI) build
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
	cd frontend; bun run build
	@echo "  -> Building Tauri app for Windows..."
	$$env:PATH = "$$env:USERPROFILE\.cargo\bin;$$env:PATH"; cd backend; $(TAURI) build
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
	@cd frontend && bun run build
	@echo "  -> Building Tauri app for Linux..."
	@cd backend && $(TAURI) build
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
	@cd frontend && bun run build
	@echo "  -> Building Tauri app for macOS..."
	@cd backend && $(TAURI) build
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
	cd frontend; bun run lint
	@echo "Linting Rust code..."
	cd backend; cargo clippy -- -D warnings
	@echo "Lint complete"

format:
	@echo "Formatting frontend code..."
	cd frontend; bunx prettier --write src/
	@echo "Formatting Rust code..."
	cd backend; cargo fmt
	@echo "Format complete"

test:
	@echo "Running frontend tests..."
	cd frontend; bun run test
	@echo "Running Rust tests..."
	cd backend; cargo test
	@echo "Tests complete"
else
lint:
	@echo "Linting frontend code..."
	@cd frontend && bun run lint
	@echo "Linting Rust code..."
	@cd backend && cargo clippy -- -D warnings
	@echo "Lint complete"

format:
	@echo "Formatting frontend code..."
	@cd frontend && bunx prettier --write src/
	@echo "Formatting Rust code..."
	@cd backend && cargo fmt
	@echo "Format complete"

test:
	@echo "Running frontend tests..."
	@cd frontend && bun run test
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

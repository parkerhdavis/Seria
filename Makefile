.PHONY: help setup install dev dev-frontend down build build-linux build-windows build-macos check icons test lint lint-fix format typecheck clean version

# ==================================================================
# OS DETECTION
# ==================================================================
ifdef OS
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

ifeq ($(DETECTED_OS),windows)
    SHELL := pwsh.exe
    .SHELLFLAGS := -NoProfile -Command
    BUN := bun
    TAURI := bunx tauri
    RM := Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    NULL := $$null
else
    BUN := bun
    TAURI := bunx tauri
    RM := rm -rf
    NULL := /dev/null
    ifeq ($(DETECTED_OS),macos)
        SED_INPLACE := sed -i ''
    else
        SED_INPLACE := sed -i
    endif
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
	@echo "  setup              - Check/install Rust + Bun + system deps, then bun install"
	@echo "  install            - Alias for setup"
	@echo "  build              - Build for current platform (auto-detects OS)"
	@echo "  build-linux        - Build Linux installers (.deb, .rpm, AppImage)"
	@echo "  build-windows      - Build Windows installers (.msi, .exe)"
	@echo "  build-macos        - Build macOS installers (.dmg, .app)"
	@echo "  check              - Run Rust compiler checks without building"
	@echo "  icons              - Regenerate app icons from resources/icons/seria-icon-fullres.png"
	@echo ""
	@echo "Quality:"
	@echo "  lint               - Run ESLint and Rust clippy"
	@echo "  lint-fix           - Run ESLint with --fix"
	@echo "  format             - Format code with Prettier and rustfmt"
	@echo "  test               - Run tests (Bun + Rust tests)"
	@echo "  typecheck          - Run TypeScript type checking"
	@echo ""
	@echo "Versioning:"
	@echo "  version            - Show current version"
	@echo "  version V=X.Y.Z    - Set version across package.json, tauri.conf.json, Cargo.toml"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean              - Remove build artifacts and dependencies"
	@echo ""
	@echo "Detected OS: $(DETECTED_OS)"
	@echo "================================================================================"

# ==================================================================
# SETUP
# ==================================================================
# Previously driven by setup.sh; folded into the Makefile so the monorepo
# has one entry point. Checks/installs Rust + Bun, probes system deps
# (webkit2gtk on Linux, Xcode CLT on macOS, VS Build Tools on Windows),
# then runs `bun install` at the workspace root.

ifeq ($(DETECTED_OS),windows)
setup:
	@echo "================================================================================"
	@echo "  Seria Setup - Installing Dependencies"
	@echo "================================================================================"
	@if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) { \
		Write-Host "Rust not found. Install from https://rustup.rs then re-run 'make setup'."; \
		exit 1; \
	} else { \
		Write-Host "Rust: $$(rustc --version)"; \
	}
	@if (-not (Get-Command bun -ErrorAction SilentlyContinue)) { \
		Write-Host "Bun not found. Install from https://bun.sh then re-run 'make setup'."; \
		exit 1; \
	} else { \
		Write-Host "Bun: $$(bun --version)"; \
	}
	@Write-Host ""
	@Write-Host "Windows system requirements for Tauri:"
	@Write-Host "  - Visual Studio C++ Build Tools"
	@Write-Host "  - WebView2 Runtime (pre-installed on Windows 10+)"
	@Write-Host "  See https://tauri.app/start/prerequisites/#windows"
	@Write-Host ""
	@Write-Host "Installing JS dependencies..."
	$(BUN) install
	@Write-Host "Setup complete"

install: setup
else
setup:
	@echo "================================================================================"
	@echo "  Seria Setup - Installing Dependencies"
	@echo "================================================================================"
	@if ! command -v rustc >/dev/null 2>&1; then \
		echo "Rust not found. Installing via rustup..."; \
		curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh; \
		echo "Rust installed. Please restart your shell and re-run 'make setup'."; \
		exit 0; \
	else \
		echo "Rust: $$(rustc --version)"; \
	fi
	@if ! command -v bun >/dev/null 2>&1; then \
		echo "Bun not found. Installing..."; \
		curl -fsSL https://bun.sh/install | bash; \
		echo "Bun installed. Please restart your shell and re-run 'make setup'."; \
		exit 0; \
	else \
		echo "Bun: $$(bun --version)"; \
	fi
ifeq ($(DETECTED_OS),linux)
	@echo ""
	@echo "Checking Linux system dependencies for Tauri..."
	@MISSING=""; \
	for p in libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev; do \
		if ! dpkg-query -W -f='$${Status}' "$$p" 2>/dev/null | grep -q "install ok installed"; then \
			MISSING="$$MISSING $$p"; \
		fi; \
	done; \
	if [ -n "$$MISSING" ]; then \
		echo "Missing system packages:$$MISSING"; \
		echo ""; \
		echo "Install with: sudo apt install$$MISSING"; \
		echo ""; \
		echo "Continuing with JS install anyway — Tauri build will fail until these land."; \
	else \
		echo "All required system packages present."; \
	fi
else ifeq ($(DETECTED_OS),macos)
	@echo ""
	@echo "Checking macOS system dependencies..."
	@if ! xcode-select -p >/dev/null 2>&1; then \
		echo "Xcode Command Line Tools not installed."; \
		echo "Install with: xcode-select --install"; \
	else \
		echo "Xcode Command Line Tools installed."; \
	fi
endif
	@echo ""
	@echo "Installing JS dependencies..."
	@$(BUN) install
	@echo "Setup complete"

install: setup
endif

# ==================================================================
# RUN
# ==================================================================

ifeq ($(DETECTED_OS),windows)
dev:
	@echo "Starting Tauri development server (frontend + Rust)..."
	cd apps/desktop/backend; $(TAURI) dev

dev-frontend:
	@echo "Starting Bun dev server only (rapid UI iteration)..."
	cd apps/desktop/frontend; $(BUN) run dev.ts

down:
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
	@cd apps/desktop/frontend && setsid $(BUN) run dev.ts > /dev/null 2>&1 & echo $$! > .dev.pid
	@sleep 2
	@echo "  -> Starting Tauri..."
	@cd apps/desktop/backend && $(TAURI) dev; \
	DEV_PID=$$(cat .dev.pid 2>/dev/null); \
	if [ -n "$$DEV_PID" ]; then \
		kill -- -$$DEV_PID 2>/dev/null || kill $$DEV_PID 2>/dev/null || true; \
	fi; \
	rm -f .dev.pid

down:
	@echo "Stopping Seria dev server..."
	@DEV_PID=$$(cat .dev.pid 2>/dev/null); \
	if [ -n "$$DEV_PID" ]; then \
		kill -- -$$DEV_PID 2>/dev/null || kill $$DEV_PID 2>/dev/null || true; \
		rm -f .dev.pid; \
		echo "  -> Killed dev server process group (pid $$DEV_PID)"; \
	else \
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
	@cd apps/desktop/frontend && $(BUN) run dev.ts
endif

# ==================================================================
# BUILD
# ==================================================================

ifeq ($(DETECTED_OS),windows)
build:
	@$(MAKE) build-windows
else ifeq ($(DETECTED_OS),linux)
build:
	@$(MAKE) build-linux
else ifeq ($(DETECTED_OS),macos)
build:
	@$(MAKE) build-macos
endif

ifeq ($(DETECTED_OS),windows)
build-linux:
	@echo "ERROR: Linux builds must be run on Linux"
	@exit 1

build-windows:
	@echo "Building Windows installers (.msi, .exe)..."
	@echo "  -> Building frontend..."
	cd apps/desktop/frontend; $(BUN) run build.ts
	@echo "  -> Building Tauri app for Windows..."
	$$env:PATH = "$$env:USERPROFILE\.cargo\bin;$$env:PATH"; cd apps/desktop/backend; $(TAURI) build
	@echo "Windows build complete. Output in target/release/bundle/"

build-macos:
	@echo "ERROR: macOS builds must be run on macOS"
	@exit 1
else ifeq ($(DETECTED_OS),linux)
build-linux: icons
	@echo "Building Linux installers (.deb, .rpm, AppImage)..."
	@echo "  -> Building frontend..."
	@cd apps/desktop/frontend && $(BUN) run build.ts
	@echo "  -> Building Tauri app for Linux..."
	@cd apps/desktop/backend && $(TAURI) build
	@echo "Linux build complete. Output in target/release/bundle/"

build-windows:
	@echo "ERROR: Windows builds must be run on Windows"
	@exit 1

build-macos:
	@echo "ERROR: macOS builds must be run on macOS"
	@exit 1
else ifeq ($(DETECTED_OS),macos)
build-linux:
	@echo "ERROR: Linux builds must be run on Linux"
	@exit 1

build-windows:
	@echo "ERROR: Windows builds must be run on Windows"
	@exit 1

build-macos: icons
	@echo "Building macOS installers (.dmg, .app)..."
	@echo "  -> Building frontend..."
	@cd apps/desktop/frontend && $(BUN) run build.ts
	@echo "  -> Building Tauri app for macOS..."
	@cd apps/desktop/backend && $(TAURI) build
	@echo "macOS build complete. Output in target/release/bundle/"
endif

ifeq ($(DETECTED_OS),windows)
check:
	cd apps/desktop/backend; cargo check
else
check:
	@cd apps/desktop/backend && cargo check
endif

# ==================================================================
# ICONS
# ==================================================================
# File-based dependency: only regenerate when the source PNG or the
# generator script changes. `make icons` forces it via the phony alias.

ICON_SOURCE := resources/icons/seria-icon-fullres.png
ICON_SCRIPT := resources/icons/generate-icons.sh
ICON_SENTINEL := resources/icons/512x512.png

$(ICON_SENTINEL): $(ICON_SOURCE) $(ICON_SCRIPT)
	@echo "Regenerating icons..."
	@bash $(ICON_SCRIPT)

icons: $(ICON_SENTINEL)

# ==================================================================
# QUALITY
# ==================================================================

ifeq ($(DETECTED_OS),windows)
lint:
	@echo "Linting JS..."
	$(BUN) run lint
	@echo "Linting Rust..."
	cd apps/desktop/backend; cargo clippy -- -D warnings

lint-fix:
	$(BUN)x eslint . --fix

format:
	@echo "Formatting JS..."
	$(BUN) run format
	@echo "Formatting Rust..."
	cd apps/desktop/backend; cargo fmt

test:
	@echo "Running JS tests..."
	$(BUN) test
	@echo "Running Rust tests..."
	cd apps/desktop/backend; cargo test

typecheck:
	@echo "Running TypeScript type check..."
	$(BUN)x tsc --noEmit -p apps/desktop
else
lint:
	@echo "Linting JS..."
	@$(BUN) run lint
	@echo "Linting Rust..."
	@cd apps/desktop/backend && cargo clippy -- -D warnings

lint-fix:
	@$(BUN)x eslint . --fix

format:
	@echo "Formatting JS..."
	@$(BUN) run format
	@echo "Formatting Rust..."
	@cd apps/desktop/backend && cargo fmt

test:
	@echo "Running JS tests..."
	@$(BUN) test
	@echo "Running Rust tests..."
	@cd apps/desktop/backend && cargo test

typecheck:
	@echo "Running TypeScript type check..."
	@$(BUN)x tsc --noEmit -p apps/desktop
endif

# ==================================================================
# VERSIONING
# ==================================================================
# Syncs version across package.json (root + app), tauri.conf.json, Cargo.toml.

ifeq ($(DETECTED_OS),windows)
version:
ifndef V
	@echo "Current version:"
	@(Select-String -Path package.json -Pattern '"version": "(.+)"').Matches.Groups[1].Value
else
	@echo "Updating version to $(V)..."
	@(Get-Content package.json -Raw) -replace '"version": "[^"]*"', '"version": "$(V)"' | Set-Content package.json -NoNewline
	@(Get-Content apps\desktop\package.json -Raw) -replace '"version": "[^"]*"', '"version": "$(V)"' | Set-Content apps\desktop\package.json -NoNewline
	@(Get-Content apps\desktop\backend\tauri.conf.json -Raw) -replace '"version": "[^"]*"', '"version": "$(V)"' | Set-Content apps\desktop\backend\tauri.conf.json -NoNewline
	@(Get-Content apps\desktop\backend\Cargo.toml -Raw) -replace 'version = "[^"]*"', 'version = "$(V)"' | Set-Content apps\desktop\backend\Cargo.toml -NoNewline
	@echo "Version updated to $(V) across package.json, tauri.conf.json, Cargo.toml"
endif
else
version:
ifndef V
	@echo "Current version: $$(grep '^\s*\"version\":' package.json | head -1 | sed 's/.*\"version\": \"\(.*\)\".*/\1/')"
else
	@echo "Updating version to $(V)..."
	@$(SED_INPLACE) 's/"version": "[^"]*"/"version": "$(V)"/' package.json
	@$(SED_INPLACE) 's/"version": "[^"]*"/"version": "$(V)"/' apps/desktop/package.json
	@$(SED_INPLACE) 's/"version": "[^"]*"/"version": "$(V)"/' apps/desktop/backend/tauri.conf.json
	@$(SED_INPLACE) 's/^version = "[^"]*"/version = "$(V)"/' apps/desktop/backend/Cargo.toml
	@echo "Version updated to $(V) across package.json, tauri.conf.json, Cargo.toml"
endif
endif

# ==================================================================
# MAINTENANCE
# ==================================================================

ifeq ($(DETECTED_OS),windows)
clean:
	if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
	if (Test-Path apps\desktop\frontend\dist) { Remove-Item -Recurse -Force apps\desktop\frontend\dist }
	if (Test-Path target) { Remove-Item -Recurse -Force target }
else
clean:
	@$(RM) node_modules apps/desktop/frontend/dist target
	@echo "Cleanup complete"
endif

.DEFAULT_GOAL := help

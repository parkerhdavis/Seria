# ─── Seria Makefile ───

.PHONY: help setup install \
        dev dev-frontend down \
        build build-linux build-windows build-macos check icons \
        lint lint-fix format test typecheck \
        version clean

# ─── OS detection ─────────────────────────────────────────────────────
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

# ─── Paths ────────────────────────────────────────────────────────────
BACKEND := apps/desktop/backend
FRONTEND := apps/desktop/frontend

# ─── Help ─────────────────────────────────────────────────────────────
# `## description` doc-comments live on the POSIX target lines below;
# both branches read the same source file, so duplicating them on the
# Windows branch would just produce duplicate rows in the help output.
ifeq ($(DETECTED_OS),windows)
help:
	@Select-String -Path Makefile -Pattern '^([a-zA-Z_-]+):.*?## (.*)' | ForEach-Object { '{0,-22} {1}' -f $$_.Matches[0].Groups[1].Value, $$_.Matches[0].Groups[2].Value } | Sort-Object
else
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-22s\033[0m %s\n", $$1, $$2}'
endif

# ─── Setup ────────────────────────────────────────────────────────────
# Probes Rust + Bun + per-platform system deps (webkit2gtk on Linux,
# Xcode CLT on macOS, VS Build Tools on Windows), then runs `bun install`
# at the workspace root.

ifeq ($(DETECTED_OS),windows)
setup:
	@Write-Host "Seria setup — checking dependencies..."
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
	@$(BUN) install
	@Write-Host "Setup complete"

install: setup
else
setup: ## Install Rust + Bun + system deps, then bun install
	@echo "Seria setup — checking dependencies..."
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

install: setup ## Alias for setup
endif

# ─── Run ──────────────────────────────────────────────────────────────
# Tauri spawns the frontend dev server itself via `beforeDevCommand` in
# tauri.conf.json — the recipe just pre-flights port :5173 and shells
# into `tauri dev`.

ifeq ($(DETECTED_OS),windows)
dev:
	@Write-Host "Starting Tauri development server (frontend + Rust)..."
	@cd $(BACKEND); $(TAURI) dev

dev-frontend:
	@Write-Host "Starting Bun dev server only (rapid UI iteration)..."
	@cd $(FRONTEND); $(BUN) run dev.ts

down:
	@Write-Host "On Windows, close the terminal running the dev server or use Task Manager."
else
dev: ## Start Tauri dev server (frontend + Rust hot-reload)
	@echo "Starting Tauri development server (frontend + Rust)..."
	@EXISTING_PID=$$(lsof -ti :5173 2>/dev/null); \
	if [ -n "$$EXISTING_PID" ]; then \
		echo "  -> WARNING: Port 5173 in use (pid $$EXISTING_PID) — killing to free port"; \
		kill $$EXISTING_PID 2>/dev/null || true; \
		sleep 1; \
	fi
	@cd $(BACKEND) && $(TAURI) dev

dev-frontend: ## Start Bun dev server only (rapid UI iteration, no Tauri)
	@echo "Starting Bun dev server only (rapid UI iteration)..."
	@cd $(FRONTEND) && $(BUN) run dev.ts

down: ## Stop dev server (kills anything on :5173)
	@PORT_PID=$$(lsof -ti :5173 2>/dev/null); \
	if [ -n "$$PORT_PID" ]; then \
		kill $$PORT_PID 2>/dev/null || true; \
		echo "  -> Killed process on port 5173 (pid $$PORT_PID)"; \
	else \
		echo "  -> No dev server running"; \
	fi
endif

# ─── Build ────────────────────────────────────────────────────────────

# `## description` lines below sit only on the branch where the target
# actually does work (build-linux on linux, etc.) — that branch is the
# one the help-grep needs to find, and other branches stay un-annotated
# to avoid duplicates in `make help` output.

ifeq ($(DETECTED_OS),windows)
build:
	@$(MAKE) build-windows
else ifeq ($(DETECTED_OS),linux)
build: ## Build installer for current platform (auto-detects OS)
	@$(MAKE) build-linux
else ifeq ($(DETECTED_OS),macos)
build:
	@$(MAKE) build-macos
endif

ifeq ($(DETECTED_OS),windows)
build-linux:
	@Write-Host "ERROR: Linux builds must be run on Linux"
	@exit 1

build-windows: ## Build Windows installers (.msi, .exe)
	@Write-Host "Building Windows installers (.msi, .exe)..."
	@Write-Host "  -> Building frontend..."
	@cd $(FRONTEND); $(BUN) run build.ts
	@Write-Host "  -> Building Tauri app for Windows..."
	$$env:PATH = "$$env:USERPROFILE\.cargo\bin;$$env:PATH"; cd $(BACKEND); $(TAURI) build
	@Write-Host "Windows build complete. Output in target/release/bundle/"

build-macos:
	@Write-Host "ERROR: macOS builds must be run on macOS"
	@exit 1
else ifeq ($(DETECTED_OS),linux)
build-linux: icons ## Build Linux installers (.deb, .rpm, AppImage)
	@echo "Building Linux installers (.deb, .rpm, AppImage)..."
	@echo "  -> Building frontend..."
	@cd $(FRONTEND) && $(BUN) run build.ts
	@echo "  -> Building Tauri app for Linux..."
	@cd $(BACKEND) && $(TAURI) build
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

build-macos: icons ## Build macOS installers (.dmg, .app)
	@echo "Building macOS installers (.dmg, .app)..."
	@echo "  -> Building frontend..."
	@cd $(FRONTEND) && $(BUN) run build.ts
	@echo "  -> Building Tauri app for macOS..."
	@cd $(BACKEND) && $(TAURI) build
	@echo "macOS build complete. Output in target/release/bundle/"
endif

ifeq ($(DETECTED_OS),windows)
check:
	@cd $(BACKEND); cargo check
else
check: ## Run Rust compiler checks without building
	@cd $(BACKEND) && cargo check
endif

# ─── Icons ────────────────────────────────────────────────────────────
# Sentinel-based dependency: regenerates only when the source PNG or
# the generator script changes. `make icons` forces it via the alias.

ICON_SOURCE := resources/icons/seria-icon-fullres.png
ICON_SCRIPT := resources/icons/generate-icons.sh
ICON_SENTINEL := resources/icons/512x512.png

$(ICON_SENTINEL): $(ICON_SOURCE) $(ICON_SCRIPT)
	@echo "Regenerating icons..."
	@bash $(ICON_SCRIPT)

icons: $(ICON_SENTINEL) ## Regenerate desktop app icon set from the master PNG

# ─── Quality ──────────────────────────────────────────────────────────

ifeq ($(DETECTED_OS),windows)
lint:
	@Write-Host "Linting JS..."
	@$(BUN) run lint
	@Write-Host "Linting Rust..."
	@cd $(BACKEND); cargo clippy -- -D warnings

lint-fix:
	@$(BUN)x eslint . --fix

format:
	@Write-Host "Formatting JS..."
	@$(BUN) run format
	@Write-Host "Formatting Rust..."
	@cd $(BACKEND); cargo fmt

test:
	@Write-Host "Running JS tests..."
	@$(BUN) test
	@Write-Host "Running Rust tests..."
	@cd $(BACKEND); cargo test

typecheck:
	@Write-Host "Running TypeScript type check..."
	@$(BUN)x tsc --noEmit -p apps/desktop
else
lint: ## Run ESLint and Rust clippy
	@echo "Linting JS..."
	@$(BUN) run lint
	@echo "Linting Rust..."
	@cd $(BACKEND) && cargo clippy -- -D warnings

lint-fix: ## Run ESLint with --fix
	@$(BUN)x eslint . --fix

format: ## Format code with Prettier and rustfmt
	@echo "Formatting JS..."
	@$(BUN) run format
	@echo "Formatting Rust..."
	@cd $(BACKEND) && cargo fmt

test: ## Run tests (Bun + Rust)
	@echo "Running JS tests..."
	@$(BUN) test
	@echo "Running Rust tests..."
	@cd $(BACKEND) && cargo test

typecheck: ## Run TypeScript type checking
	@echo "Running TypeScript type check..."
	@$(BUN)x tsc --noEmit -p apps/desktop
endif

# ─── Versioning ───────────────────────────────────────────────────────
# Syncs version across package.json (root + apps/desktop), tauri.conf.json,
# and Cargo.toml.

ifeq ($(DETECTED_OS),windows)
version:
ifndef V
	@Write-Host "Current version:"
	@(Select-String -Path package.json -Pattern '"version": "(.+)"').Matches.Groups[1].Value
else
	@Write-Host "Updating version to $(V)..."
	@(Get-Content package.json -Raw) -replace '"version": "[^"]*"', '"version": "$(V)"' | Set-Content package.json -NoNewline
	@(Get-Content $(BACKEND)\tauri.conf.json -Raw) -replace '"version": "[^"]*"', '"version": "$(V)"' | Set-Content $(BACKEND)\tauri.conf.json -NoNewline
	@(Get-Content apps\desktop\package.json -Raw) -replace '"version": "[^"]*"', '"version": "$(V)"' | Set-Content apps\desktop\package.json -NoNewline
	@(Get-Content $(BACKEND)\Cargo.toml -Raw) -replace 'version = "[^"]*"', 'version = "$(V)"' | Set-Content $(BACKEND)\Cargo.toml -NoNewline
	@Write-Host "Version updated to $(V) across package.json, tauri.conf.json, Cargo.toml"
endif
else
version: ## Show or set version (use V=X.Y.Z to set)
ifndef V
	@echo "Current version: $$(grep '^\s*\"version\":' package.json | head -1 | sed 's/.*\"version\": \"\(.*\)\".*/\1/')"
else
	@echo "Updating version to $(V)..."
	@$(SED_INPLACE) 's/"version": "[^"]*"/"version": "$(V)"/' package.json
	@$(SED_INPLACE) 's/"version": "[^"]*"/"version": "$(V)"/' apps/desktop/package.json
	@$(SED_INPLACE) 's/"version": "[^"]*"/"version": "$(V)"/' $(BACKEND)/tauri.conf.json
	@$(SED_INPLACE) 's/^version = "[^"]*"/version = "$(V)"/' $(BACKEND)/Cargo.toml
	@echo "Version updated to $(V) across package.json, tauri.conf.json, Cargo.toml"
endif
endif

# ─── Maintenance ──────────────────────────────────────────────────────

ifeq ($(DETECTED_OS),windows)
clean:
	@if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
	@if (Test-Path $(FRONTEND)\dist) { Remove-Item -Recurse -Force $(FRONTEND)\dist }
	@if (Test-Path target) { Remove-Item -Recurse -Force target }
else
clean: ## Remove build artifacts and dependencies
	@$(RM) node_modules $(FRONTEND)/dist target
	@echo "Cleanup complete"
endif

.DEFAULT_GOAL := help

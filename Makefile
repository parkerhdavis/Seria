.PHONY: help setup install dev start down build build-view build-linux build-windows build-macos icons test lint lint-fix format typecheck clean version

# ==================================================================
# Seria — Electrobun Makefile
# ==================================================================
# Under the hood, Electrobun + Bun replace Tauri + Rust. Build is
# pure-TypeScript; packaging is handled by `electrobun` via its config
# at electrobun.config.ts.

# ==================================================================
# OS DETECTION
# ==================================================================
# Detect OS for platform-specific commands. On Windows, uname doesn't
# exist, so we check for Windows-specific env vars first.
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
    RM := Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    NULL := $$null
else
    BUN := bun
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
	@echo "  Seria — Serialized-Data Editor for Game Writers"
	@echo "================================================================================"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Running (Development):"
	@echo "  dev                - Build view and launch Electrobun with --watch"
	@echo "  start              - Build view and launch Electrobun (no watcher)"
	@echo "  down               - Stop any running dev process"
	@echo ""
	@echo "Building:"
	@echo "  setup              - Install dependencies (bun install)"
	@echo "  install            - Alias for setup"
	@echo "  build              - Build installable package for current platform (detects OS)"
	@echo "  build-linux        - Build Linux installers (.deb, .rpm)"
	@echo "  build-windows      - Build Windows installer"
	@echo "  build-macos        - Build macOS installer (.dmg)"
	@echo "  build-view         - Build only the view bundle (fast; used by dev targets)"
	@echo "  icons              - Regenerate app icons from resources/icons/seria-icon-fullres.png"
	@echo ""
	@echo "Quality:"
	@echo "  test               - Run bun test (renderer + Bun handlers + converters)"
	@echo "  lint               - Run ESLint"
	@echo "  lint-fix           - Run ESLint with --fix"
	@echo "  format             - Run Prettier on src/"
	@echo "  typecheck          - Run TypeScript type checking"
	@echo ""
	@echo "Versioning:"
	@echo "  version            - Show current version"
	@echo "  version V=X.Y.Z    - Set version across root and apps/desktop/ package.json files"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean              - Remove target/ and frontend/dist/"
	@echo ""
	@echo "Detected OS: $(DETECTED_OS)"
	@echo "================================================================================"

# ==================================================================
# SERVICE COMMANDS
# ==================================================================

# -------------
# Running
# -------------

ifeq ($(DETECTED_OS),windows)
dev: build-view
	@echo "Starting Electrobun dev server with --watch..."
	$$env:ELECTROBUN_DEV = "1"; (cd apps/desktop && $(BUN)x electrobun dev --watch)

start: build-view
	@echo "Starting Electrobun (one-shot, no watcher)..."
	(cd apps/desktop && $(BUN)x electrobun dev)

down:
	@echo "Stopping dev processes..."
	@echo "On Windows, close the terminal running the dev server or use Task Manager."
else
dev: build-view
	@echo "Starting Electrobun dev server with --watch..."
	@(cd apps/desktop && ELECTROBUN_DEV=1 $(BUN)x electrobun dev --watch)

start: build-view
	@echo "Starting Electrobun (one-shot, no watcher)..."
	@(cd apps/desktop && $(BUN)x electrobun dev)

down:
	@echo "Stopping dev processes..."
	-@pkill -f "seria-dev" 2>/dev/null || true
	-@pkill -f "electrobun" 2>/dev/null || true
endif

# ==================================================================
# COMMAND MODULES
# ==================================================================

# -------------
# Building
# -------------

ifeq ($(DETECTED_OS),windows)
setup:
	@echo "Installing dependencies..."
	$(BUN) install
	@echo "Setup complete"

install: setup
else
setup:
	@echo "Installing dependencies..."
	@$(BUN) install
	@echo "Setup complete"

install: setup
endif

ifeq ($(DETECTED_OS),windows)
build-view:
	@echo "Building view bundle..."
	$(BUN) apps/desktop/frontend/build.ts
else
build-view:
	@echo "Building view bundle..."
	@$(BUN) apps/desktop/frontend/build.ts
endif

# `build` dispatches to the current-platform target. Cross-compilation
# isn't supported by Electrobun — each platform must be built on its
# own OS, mirroring the Tauri-era behavior.
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

build-windows: build-view
	@echo "  -> Running Electrobun stable build..."
	(cd apps/desktop && $(BUN)x electrobun build --env=stable)
	@echo ""
	@echo "Windows build complete!"
	@echo "Output: ./target/v<version>/stable-win-x64/"

build-macos:
	@echo "ERROR: macOS builds must be run on macOS"
	@exit 1
else ifeq ($(DETECTED_OS),linux)
build-linux: build-view icons
	@echo "  -> Running Electrobun stable build..."
	@(cd apps/desktop && $(BUN)x electrobun build --env=stable)
	@echo "  -> Packaging .deb and .rpm..."
	@bash scripts/package-linux.sh
	@echo ""
	@echo "Linux build complete!"

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

build-macos: build-view icons
	@echo "  -> Running Electrobun stable build..."
	@(cd apps/desktop && $(BUN)x electrobun build --env=stable)
	@echo ""
	@echo "macOS build complete!"
	@echo "Output: ./target/v<version>/stable-macos-*/ (includes .dmg)"
endif

# -------------
# Icons
# -------------
# Regenerate the full icon set from resources/icons/seria-icon-fullres.png.
# File-based dependency (not phony) — ImageMagick isn't byte-reproducible,
# so we only regenerate when the source PNG or the generator script
# actually changes. `make icons` forces regeneration via the phony alias.

ICON_SOURCE := resources/icons/seria-icon-fullres.png
ICON_SCRIPT := resources/icons/generate-icons.sh
ICON_SENTINEL := resources/icons/512x512.png

$(ICON_SENTINEL): $(ICON_SOURCE) $(ICON_SCRIPT)
	@echo "Regenerating icons..."
	@bash $(ICON_SCRIPT)

icons: $(ICON_SENTINEL)

# -------------
# Quality
# -------------

ifeq ($(DETECTED_OS),windows)
test:
	@echo "Running tests..."
	$(BUN) test
	@echo "Tests complete"

lint:
	@echo "Running ESLint..."
	$(BUN) run lint
	@echo "Lint complete"

lint-fix:
	@echo "Running ESLint with --fix..."
	$(BUN)x eslint . --fix
	@echo "Lint fix complete"

format:
	@echo "Running Prettier..."
	$(BUN) run format
	@echo "Format complete"

typecheck:
	@echo "Running TypeScript type checking..."
	$(BUN)x tsc --noEmit -p apps/desktop
	@echo "Type check passed"
else
test:
	@echo "Running tests..."
	@$(BUN) test
	@echo "Tests complete"

lint:
	@echo "Running ESLint..."
	@$(BUN) run lint
	@echo "Lint complete"

lint-fix:
	@echo "Running ESLint with --fix..."
	@$(BUN)x eslint . --fix
	@echo "Lint fix complete"

format:
	@echo "Running Prettier..."
	@$(BUN) run format
	@echo "Format complete"

typecheck:
	@echo "Running TypeScript type checking..."
	@$(BUN)x tsc --noEmit -p apps/desktop
	@echo "Type check passed"
endif

# -------------
# Versioning
# -------------

ifeq ($(DETECTED_OS),windows)
version:
ifndef V
	@echo "Current version:"
	@(Select-String -Path package.json -Pattern '"version": "(.+)"').Matches.Groups[1].Value
else
	@echo "Updating version to $(V)..."
	@(Get-Content package.json -Raw) -replace '"version": "[^"]*"', '"version": "$(V)"' | Set-Content package.json -NoNewline
	@(Get-Content apps\desktop\package.json -Raw) -replace '"version": "[^"]*"', '"version": "$(V)"' | Set-Content apps\desktop\package.json -NoNewline
	@echo "  -> package.json"
	@echo "  -> apps/desktop/package.json"
	@echo ""
	@echo "Version updated to $(V)"
endif
else
version:
ifndef V
	@echo "Current version: $$(grep '^\s*\"version\":' package.json | head -1 | sed 's/.*\"version\": \"\(.*\)\".*/\1/')"
else
	@echo "Updating version to $(V)..."
	@$(SED_INPLACE) 's/"version": "[^"]*"/"version": "$(V)"/' package.json
	@$(SED_INPLACE) 's/"version": "[^"]*"/"version": "$(V)"/' apps/desktop/package.json
	@echo "  -> package.json"
	@echo "  -> apps/desktop/package.json"
	@echo ""
	@echo "Version updated to $(V)"
endif
endif

# -------------
# Maintenance
# -------------

ifeq ($(DETECTED_OS),windows)
clean:
	@echo "Cleaning build artifacts..."
	if (Test-Path target) { Remove-Item -Recurse -Force target }
	if (Test-Path frontend\dist) { Remove-Item -Recurse -Force frontend\dist }
	@echo "Cleanup complete"
else
clean:
	@echo "Cleaning build artifacts..."
	@$(RM) target frontend/dist
	@echo "Cleanup complete"
endif

.DEFAULT_GOAL := help

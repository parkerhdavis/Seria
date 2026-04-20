.PHONY: help install build build-view start dev down test lint format clean

# ==================================================================
# Seria — Electrobun Makefile
# ==================================================================
# Under the hood, Electrobun + Bun replace Tauri + Rust. Build is
# pure-TypeScript, packaging is handled by `electrobun` via its config
# at electrobun.config.ts.

help:
	@echo "================================================================================"
	@echo "  Seria — Development Commands"
	@echo "================================================================================"
	@echo ""
	@echo "Running:"
	@echo "  start              - Build the view and launch the app (one-shot)"
	@echo "  dev                - Build the view and launch with --watch on the main/config"
	@echo "  down               - Kill any stray dev process"
	@echo ""
	@echo "Building:"
	@echo "  install            - Install dependencies (bun install)"
	@echo "  build              - Build the view bundle (Bun.build HTML mode)"
	@echo "  build-view         - Alias for build"
	@echo ""
	@echo "Quality:"
	@echo "  test               - Run bun test (renderer + Bun handlers + converters)"
	@echo "  lint               - ESLint on the mainview tree"
	@echo "  format             - Prettier on src/"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean              - Remove dist/ and build/"
	@echo "================================================================================"

# ------------------------------------------------------------------
# Running
# ------------------------------------------------------------------

start: build-view
	bunx electrobun dev

dev: build-view
	ELECTROBUN_DEV=1 bunx electrobun dev --watch

down:
	-pkill -f "seria-dev" 2>/dev/null || true
	-pkill -f "electrobun" 2>/dev/null || true

# ------------------------------------------------------------------
# Building
# ------------------------------------------------------------------

install:
	bun install

build: build-view

build-view:
	bun build.ts

# ------------------------------------------------------------------
# Quality
# ------------------------------------------------------------------

test:
	bun test

lint:
	bun run lint

format:
	bun run format

# ------------------------------------------------------------------
# Maintenance
# ------------------------------------------------------------------

clean:
	rm -rf dist build

.DEFAULT_GOAL := help

.PHONY: help dev build lint format test clean setup install dev-frontend check

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
	@echo "  build              # Build production app bundle (creates installer)"
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
	@echo "  make build         # Build production installer"
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

build:
	@echo "🔨 Building production app bundle..."
	@echo "  → Building frontend..."
	@cd frontend && npm run build
	@echo "  → Building Tauri app..."
	@cd backend && ../frontend/node_modules/.bin/tauri build
	@echo "✅ Build complete - installer created in backend/target/release/bundle/"

check:
	@echo "🔍 Running Rust compiler checks..."
	@cd backend && cargo check
	@echo "✅ Rust checks passed"

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
	@rm -rf backend/target
	@echo "✅ Cleanup complete"

.DEFAULT_GOAL := help

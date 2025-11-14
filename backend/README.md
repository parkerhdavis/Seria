# Seria Backend (Rust + Tauri)

This directory contains the Rust backend for Seria, which provides native file I/O and desktop integration via Tauri.

## Windows Cross-Compilation Requirements

To build Windows installers from Linux, you need:
- `llvm` - Provides llvm-rc for embedding icons/metadata
- `lld` - LLVM linker
- `clang` - C/C++ compiler (provides clang-cl for native dependencies)

Install on Ubuntu/Debian:
```bash
sudo apt install llvm lld clang
```

See `wiki/05_Development/05.04_CrossCompilation.md` for detailed cross-compilation documentation.

## Important Build Configuration

**Build Output Directory:**
- All Rust build artifacts are configured to output to the **top-level `target/` directory**
- This is configured in `.cargo/config.toml` with `target-dir = "../target"`
- **DO NOT** reference `backend/target/` in scripts, documentation, or build commands
- **ALWAYS** reference `target/` at the project root

**Why:**
- Keeps all build artifacts centralized at the project root
- Consistent with monorepo patterns
- Easier to clean and manage build outputs

## Build Commands

Always run build commands from the frontend directory or use the Makefile at the project root:

```bash
# From project root (recommended)
make build              # Build ALL platforms (Linux + Windows)
make build-linux        # Build Linux only (.deb, .rpm, AppImage)
make build-windows      # Build Windows only (.exe, .msi)

# From frontend directory (alternative)
npm run tauri:build              # Linux build only
npm run tauri:build:windows      # Windows build only
```

## Output Locations

Build outputs are placed in the top-level `target/` directory:

- **Linux:** `target/release/bundle/`
  - Contains subdirectories: `appimage/`, `deb/`, `rpm/`
- **Windows (from Linux):** `target/x86_64-pc-windows-msvc/release/seria.exe`
  - Cross-compiled binary only (installers require Windows)
- **Windows (from Windows):** `target/release/bundle/`
  - Contains subdirectories: `msi/`, `nsis/`

See `target/README.md` for complete build output locations.
See `wiki/05_Development/05.04_CrossCompilation.md` for detailed cross-compilation documentation.

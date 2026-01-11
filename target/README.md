# Seria Build Outputs

This directory contains all build artifacts from Rust compilation and Tauri bundling.

**Important:** This directory is git-ignored (except for this README file). Build artifacts should not be committed to version control, but this README is tracked to document the build output structure for all contributors.

---

## Directory Structure

Build outputs are placed in `target/release/bundle/` with platform-specific subdirectories.

### Linux Builds

When you run `make build` or `make build-linux` on Linux:

```
target/release/bundle/
├── appimage/
│   └── seria_0.0.1_amd64.AppImage
├── deb/
│   └── seria_0.0.1_amd64.deb
└── rpm/
    └── seria-0.0.1-1.x86_64.rpm
```

### Windows Builds

When you run `make build` or `make build-windows` on Windows:

```
target/release/bundle/
├── msi/
│   └── Seria_0.0.1_x64_en-US.msi
└── nsis/
    └── Seria_0.0.1_x64-setup.exe
```

### macOS Builds

When you run `make build` or `make build-macos` on macOS:

```
target/release/bundle/
├── dmg/
│   └── Seria_0.0.1_x64.dmg
└── macos/
    └── Seria.app
```

---

## Build Artifacts

### Compiled Binaries

- **Linux:** `target/release/seria`
- **Windows:** `target/release/seria.exe`
- **macOS:** `target/release/seria`

### Debug Builds

- **Debug binary:** `target/debug/seria` (or `seria.exe` on Windows)
- **Debug deps:** `target/debug/deps/`

---

## Cleaning Build Artifacts

Remove all build artifacts to free up disk space (typically 1.5-2 GB):

```bash
# From project root
cargo clean

# Or manually
rm -rf target/
```

Remove only specific build types:

```bash
# Remove debug builds only
rm -rf target/debug

# Remove release builds only
rm -rf target/release
```

---

## Why is the target directory at the project root?

Normally, Rust projects place `target/` inside the crate directory (e.g., `backend/target/`). Seria uses a custom configuration to place all build artifacts at the project root instead.

**Why:** This keeps all build artifacts in one centralized location, making it easier to clean and manage outputs across the monorepo.

**How:** This is configured in `backend/.cargo/config.toml`:

```toml
[build]
target-dir = "../target"
```

---

## More Information

For detailed build documentation, see:
- `wiki/05_Development/05.03_BuildingAndDistribution.md` - Building and distribution guide
- `wiki/05_Development/05.06_ProjectQuirks.md` - Non-standard project patterns
- `backend/README.md` - Backend build configuration

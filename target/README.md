# Seria Build Outputs

This directory contains all build artifacts from Rust compilation and Tauri bundling.

**Important:** This directory is git-ignored (except for this README file). Build artifacts should not be committed to version control, but this README is tracked to document the build output structure for all contributors.

---

## Directory Structure

### Linux Builds

When you run `make build-linux` or `make build`, Linux installers are created here:

```
target/release/bundle/
├── appimage/
│   └── seria_0.0.1_amd64.AppImage
├── deb/
│   └── seria_0.0.1_amd64.deb
└── rpm/
    └── seria-0.0.1-1.x86_64.rpm
```

**Location:** `target/release/bundle/`

### Windows Builds (from Linux)

When you run `make build-windows` from Linux, the Windows executable is created here:

```
target/x86_64-pc-windows-msvc/release/
└── seria.exe          # Fully functional Windows executable
```

**Location:** `target/x86_64-pc-windows-msvc/release/seria.exe`

**Note:** Windows installer formats (`.msi`, `.exe` installers) can only be created on Windows machines. The `seria.exe` binary is fully functional and can be distributed directly.

### Windows Builds (from Windows)

When you run `npm run tauri:build` on a Windows machine, installers are created here:

```
target/release/bundle/
├── msi/
│   └── Seria_0.0.1_x64_en-US.msi
└── nsis/
    └── Seria_0.0.1_x64-setup.exe
```

**Location:** `target/release/bundle/`

---

## Build Artifacts

### Compiled Binaries

- **Linux debug:** `target/debug/seria`
- **Linux release:** `target/release/seria`
- **Windows debug:** `target/x86_64-pc-windows-msvc/debug/seria.exe`
- **Windows release:** `target/x86_64-pc-windows-msvc/release/seria.exe`

### Dependencies

- **Linux deps:** `target/release/deps/` and `target/debug/deps/`
- **Windows deps:** `target/x86_64-pc-windows-msvc/release/deps/` and `target/x86_64-pc-windows-msvc/debug/deps/`

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

# Remove Windows builds only
rm -rf target/x86_64-pc-windows-msvc
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
- `wiki/05_Development/05.04_CrossCompilation.md` - Windows cross-compilation guide
- `wiki/05_Development/05.06_ProjectQuirks.md` - Non-standard project patterns
- `backend/README.md` - Backend build configuration

# Juniper - Quick Start

Get up and running with Juniper in under 5 minutes.

## Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Rust** - Will be installed automatically by setup script
- **Linux:** Additional system dependencies (setup script will check)

## Installation

```bash
cd ~/Juniper
make setup
```

This will:
1. Check for Rust (installs if missing)
2. Install Node.js dependencies
3. Verify system dependencies (Linux only)

**First time setup takes 2-3 minutes** while dependencies download.

## Running the App

```bash
make dev
```

The Tauri app window will open with the Juniper interface. Both frontend and Rust backend support hot-reload during development.

## First Test

1. **Open a file:**
   - Click the "Open" button in the header
   - Navigate to `testing/screenplay_example.csv`
   - Click "Open"

2. **Edit some data:**
   - Double-click any cell to edit
   - Type new content
   - Press Enter to save

3. **Save your changes:**
   - Click the "Save" button
   - The "Unsaved" badge should disappear

4. **Verify it worked:**
   - Click the menu (three dots) → "Close File"
   - Open the same file again
   - Your edits should still be there

**It works!** 🎉

## Available Commands

```bash
make dev          # Start development server
make build        # Build production installer
make lint         # Run code linting
make format       # Format code
make clean        # Clean build artifacts
make help         # Show all commands
```

## Test Files

Four test CSV files are provided in `testing/`:

| File | Best For |
|------|----------|
| `simple_test.csv` | Quick sanity checks (5 rows) |
| `screenplay_example.csv` | Screenplay format testing (20 rows) |
| `game_items.csv` | Game design data (15 rows) |
| `dialogue_large.csv` | Performance testing (200+ rows) |

## What Works Right Now (Phase 3)

✅ **File Operations:**
- Open CSV files via native dialog
- Save changes
- Save As to new location
- Close files

✅ **Editing:**
- Double-click to edit cells
- Keyboard navigation (Enter, Tab, Escape)
- Add new rows
- Dirty state tracking

✅ **Performance:**
- Smooth editing for small files (< 1000 rows)
- Automatic virtualization for large files (1000+ rows)

✅ **UI:**
- Responsive layout
- Light/dark theme toggle
- File info display (name, row/column count)
- Error alerts

## What's Coming Next

⏳ **Phase 4:** Filtering and sorting
⏳ **Phase 5:** Print preview system (screenplay format, etc.)
⏳ **Phase 6:** Settings persistence and polish

## Troubleshooting

**App won't start?**
```bash
make clean
make setup
make dev
```

**Changes not saving?**
- Check that the CSV file isn't read-only
- Check browser console (F12) for errors

**File won't open?**
- Verify Rust is installed: `rustc --version`
- Check that the file is valid CSV format

**Need more help?**
- See `testing/TESTING_GUIDE.md` for detailed testing instructions
- Check `CLAUDE.md` for development guidelines
- Review `KICKOFF_PLAN.md` for project roadmap

## Documentation

- **CLAUDE.md** - AI agent development guide
- **README.md** - Full project documentation
- **KICKOFF_PLAN.md** - Implementation roadmap with phases
- **testing/TESTING_GUIDE.md** - Detailed testing instructions
- **testing/README.md** - Test file descriptions

## Development Workflow

1. **Make changes** to frontend code in `frontend/src/`
2. **Hot-reload** happens automatically (Vite)
3. **Test in the app** window
4. **Rust changes** in `src-tauri/src/` also hot-reload

**Logs:** Check terminal where you ran `make dev` for both frontend and Rust logs.

---

**Ready to build something awesome?** 🚀

Start with `make dev` and open `testing/screenplay_example.csv` to see Juniper in action!

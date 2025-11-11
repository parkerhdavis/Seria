# Juniper

**Juniper** is a specialized desktop CSV editor designed for writers and designers who use CSV for creative work. Built with Tauri, it offers a lightweight, native desktop experience with powerful editing features and customizable "Prints" - rendered preview formats that display CSV data in professional page layouts.

## Overview

Juniper bridges the gap between spreadsheet-style data management and professional document formatting. It's perfect for:

- **Game Writers & Narrative Designers** - Manage dialogue, characters, and story beats in CSV while previewing in screenplay or dialogue format
- **Game System Designers** - Track game mechanics, items, and stats in spreadsheet format with custom Print layouts
- **Screenwriters** - Edit screenplay data in CSV format with live preview in industry-standard screenplay format
- **Technical Writers** - Manage structured content in CSV with custom rendering templates

### Key Features

**CSV Editor:**
- Robust spreadsheet-like editing with inline cell editing
- Multi-part filtering and advanced sorting
- Row/column grouping and bulk operations
- Color coding and visual organization
- Support for large files (virtualized rendering for 1000+ rows)
- Summaries and data analysis

**Print System:**
- Preview CSV data in professional page formats
- Bundled templates: Screenplay, Dialogue, Game Design formats
- User-customizable Print templates
- Visual Print editor with field mapping
- Font, indent, spacing, and color controls
- Export to PDF (future enhancement)

**Desktop-First:**
- Fast, native desktop application (via Tauri)
- Small installer size (~10-15MB vs Electron's 100MB+)
- Native file dialogs and OS integration
- Cross-platform: Windows, macOS, Linux

## Project Structure

```
juniper/
├── frontend/                    # Vite + React + TypeScript frontend
│   ├── src/
│   │   ├── main.tsx            # Application entry point
│   │   ├── App.tsx             # Root component
│   │   ├── components/         # React components
│   │   │   ├── CSVGrid.tsx    # Main spreadsheet editor
│   │   │   ├── FilterPanel.tsx # Filtering UI
│   │   │   ├── PrintPreview.tsx # Print rendering
│   │   │   └── PrintEditor.tsx # Custom Print designer
│   │   ├── stores/             # Zustand state management
│   │   │   ├── csvStore.ts    # CSV data state
│   │   │   ├── filterStore.ts # Filter/sort state
│   │   │   └── settingsStore.ts # User preferences
│   │   ├── types/              # TypeScript types
│   │   │   ├── csv.ts         # CSV data types
│   │   │   └── print.ts       # Print template types
│   │   └── utils/              # Helper functions
│   │       ├── csvParser.ts   # PapaParse wrapper
│   │       └── printRenderer.ts # Print formatting logic
│   └── public/                 # Static assets
│       └── prints/             # Bundled Print templates
│           ├── screenplay.json
│           ├── dialogue.json
│           └── game-design.json
│
├── backend/                     # Minimal Rust backend
│   ├── src/
│   │   ├── main.rs             # Tauri setup + commands
│   │   ├── file_ops.rs         # File I/O operations
│   │   └── storage.rs          # User preferences/prints
│   ├── tauri.conf.json         # Tauri configuration
│   └── Cargo.toml              # Rust dependencies
│
├── wiki/                        # Documentation
│   ├── internal/               # Technical docs for developers
│   └── external/               # User-facing documentation
│
├── .env                         # Environment configuration
├── .env.example                # Environment template
├── CLAUDE.md                   # AI agent development guide
├── Makefile                    # Build automation
├── setup.sh                    # Dependency installation script
└── README.md                   # This file
```

## Technology Stack

**Frontend:**
- [Vite](https://vitejs.dev/) - Fast build tool
- [React 18+](https://react.dev/) - UI framework
- [TypeScript 5.3+](https://www.typescriptlang.org/) - Type safety
- [TailwindCSS v4.1+](https://tailwindcss.com/) - Utility-first styling
- [daisyUI](https://daisyui.com/) - Component library

**State & Data:**
- [Zustand](https://github.com/pmndrs/zustand) - Lightweight state management
- [PapaParse](https://www.papaparse.com/) - Fast CSV parsing
- [TanStack Table](https://tanstack.com/table) - Powerful data grid
- [react-window](https://github.com/bvaughn/react-window) - Virtualization for large datasets

**Desktop Framework:**
- [Tauri 2.0](https://v2.tauri.app/) - Lightweight desktop framework (Rust-based)
- Minimal Rust backend (~100 lines) for file I/O and storage
- Plugin-based architecture for file system, dialogs, and shell access

## Getting Started

### Prerequisites

**Required:**
- [Node.js 18+](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install) (installed automatically by setup script)

**Linux Only:**
System dependencies for Tauri 2.0 (Ubuntu/Debian):
```bash
sudo apt install libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

### Installation

1. **Clone the repository:**
   ```bash
   cd ~/Juniper
   ```

2. **Run setup:**
   ```bash
   make setup
   ```

   This will:
   - Install Rust (if not already installed)
   - Install Node.js dependencies
   - Check for required system dependencies (Linux only)

### Development

**Start the development server:**
```bash
make dev
```

This starts both the Vite frontend and Tauri backend with hot-reload enabled. Changes to React components or Rust code will automatically rebuild and reload.

**Frontend-only development (rapid UI iteration):**
```bash
make dev-frontend
```

This starts only the Vite dev server, which is faster for rapid UI iteration when you don't need Tauri features.

**Other useful commands:**
```bash
make lint       # Run linting (ESLint + Rust clippy)
make format     # Format code (Prettier + rustfmt)
make test       # Run tests (Vitest + Rust tests)
make build      # Build production installer
make clean      # Remove build artifacts
```

See `make help` for all available commands.

## Building for Production

**Create production installer:**
```bash
make build
```

This creates a platform-specific installer in `backend/target/release/bundle/`:
- **Windows:** `.msi` and `.exe` installers
- **macOS:** `.dmg` and `.app` bundle
- **Linux:** `.deb`, `.AppImage`, and `.rpm` packages

## Architecture

### Data Flow

1. **User opens CSV** → Tauri file dialog → Rust reads file → React parses with PapaParse → Zustand stores data
2. **User edits** → React updates Zustand state → marks file as dirty
3. **User filters/sorts** → Pure React operations on state (no Rust needed)
4. **User saves** → React serializes state → Tauri writes file
5. **User views Print** → React renders Print component from template + CSV data
6. **User creates Print** → React saves template JSON via Tauri → stored in app data folder

### State Management

Three primary Zustand stores:

**csvStore** - CSV data and file operations:
- Current CSV data (2D array)
- File path and dirty state
- Load, save, edit operations

**filterStore** - Filtering, sorting, and grouping:
- Active filters and sort order
- Grouping configuration
- Filter persistence

**settingsStore** - User preferences:
- Theme and UI preferences
- Last opened files
- Window state
- Print template selections

### Print System

Prints are JSON templates that define how to render CSV data:

```typescript
interface PrintTemplate {
    id: string;
    name: string;
    fieldMappings: {
        [printField: string]: {
            csvColumn: string;        // Which CSV column
            style: {
                font: string;
                size: number;
                indent: number;
                lineSpacing: number;
                color?: string;
            };
            transform?: (value: string) => string;  // Optional formatting
        };
    };
}
```

Users can create custom Print templates via a visual editor, mapping CSV columns to Print fields and configuring styling for each field.

### Tauri Backend (Rust)

Minimal Rust backend with ~100 lines of code, exposing these Tauri commands:

**File Operations:**
- `open_csv_file(path: String)` - Read CSV file from disk
- `save_csv_file(path: String, content: String)` - Write CSV file to disk
- `open_file_dialog()` - Native file picker dialog
- `save_file_dialog(default_name: String)` - Native save dialog

**Storage:**
- `load_preferences()` - Load user preferences JSON
- `save_preferences(data: String)` - Save user preferences
- `load_custom_prints()` - Load all custom Print templates
- `save_custom_print(name: String, data: String)` - Save Print template
- `delete_custom_print(name: String)` - Delete Print template

Everything else is React/TypeScript in the frontend.

## Development Guidelines

### Coding Standards

- Use 4-space indents (not 2-space)
- Use double quotes for strings
- Add comprehensive comments to all files
- Follow TypeScript best practices
- Use DaisyUI components wherever possible

### Styling

- Primary UI library: **daisyUI** (built on TailwindCSS)
- Use semantic color utilities: `bg-base-100`, `text-primary`, etc.
- Never hard-code color values
- Support both light and dark themes

### Documentation

- **CLAUDE.md** - AI agent development guide (comprehensive project documentation)
- **wiki/internal/** - Technical architecture and implementation docs
- **wiki/external/** - User-facing documentation and guides
- Inline code comments for complex logic

See `CLAUDE.md` for complete development guidelines.

## Project Status

**Current Phase:** Initial Development

**MVP Goals:**
- ✅ Project boilerplate and structure
- ⏳ Tauri initialization with basic file I/O
- ⏳ CSV editor with inline editing
- ⏳ Basic filtering and sorting
- ⏳ Print system with bundled templates
- ⏳ Print preview rendering

**Future Enhancements:**
- Editable Prints (edit CSV data directly in Print preview)
- PDF export
- Plugin system for custom Print renderers
- Import/export templates
- Collaborative editing (if network sync is added)
- Integration with game engines (Unity, Unreal, Godot)
- CLI mode for batch processing

## Contributing

See `CLAUDE.md` for detailed development guidelines and architecture documentation.

**Key principles:**
- Follow the coding standards (4-space indents, double quotes, comprehensive comments)
- Use DaisyUI components for consistency
- Keep Rust code minimal - only for file I/O
- All business logic lives in React/TypeScript
- Document all changes in appropriate wiki sections

## License

[License information to be added]

## Support

For questions or issues:
1. Check the documentation in `wiki/`
2. Review `CLAUDE.md` for technical details
3. Contact the maintainers

---

**Built with:** Tauri + Vite + React + TypeScript + TailwindCSS + daisyUI

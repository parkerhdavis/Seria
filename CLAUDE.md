# Claude Code Instructions for Juniper Project

## General Principles

If you receive a command that explicitly conflicts with provisions in this document, confirm with the user before proceeding and/or add a warning in the commit notes that CLAUDE.md guidance has been circumvented as requested.

If a command includes the prefix `QUESTION:` or `ADVISE:`, treat it as a request for explanation or guidance and respond descriptively instead of taking actions.

## Project Structure

**Juniper** is a specialized desktop CSV editor built with Tauri, designed for writers and designers who use CSV for creative work (game writers, narrative designers, game system designers, etc.). It provides robust CSV editing capabilities alongside customizable "Prints" - rendered preview formats that display CSV data in professional page layouts (screenplay format, dialogue format, etc.).

* **`frontend/`** – Vite + React + TypeScript frontend with TailwindCSS and daisyUI. Contains the CSV editor UI, Print preview components, and all application logic.
  - `src/` – React application source code
    - `main.tsx` – Application entry point
    - `App.tsx` – Root component
    - `components/` – Reusable React components (CSVGrid, FilterPanel, PrintPreview, etc.)
    - `stores/` – Zustand state management (csvStore, filterStore, settingsStore)
    - `types/` – TypeScript type definitions (csv.ts, print.ts)
    - `utils/` – Helper functions and utilities (csvParser.ts, printRenderer.ts)
  - `public/` – Static assets and bundled Print templates
  - `styles/` – Global CSS and Tailwind configuration

* **`backend/`** – Minimal Rust backend for native file I/O and desktop integration. Handles file dialogs, CSV file reading/writing, and user preferences storage.
  - `src/` – Rust source code
    - `main.rs` – Tauri setup and command registration
    - `file_ops.rs` – File I/O operations (open, save, dialogs)
    - `storage.rs` – User preferences and custom Print templates
  - `tauri.conf.json` – Tauri application configuration
  - `Cargo.toml` – Rust dependencies

## Technology Stack

**Frontend:**
- **Vite** – Build tool (fast, lightweight, Tauri's default)
- **React 18+** – UI framework
- **TypeScript 5.3+** – Type safety
- **TailwindCSS v4.1+** – Utility-first styling
- **daisyUI** – Component library (built on Tailwind)

**State Management & Data:**
- **Zustand** – Lightweight state management (preferred over Redux for this project)
- **PapaParse** – Fast, robust CSV parsing
- **TanStack Table** – Flexible spreadsheet-like grid component
- **react-window** or **react-virtual** – Virtualization for large CSV files

**Desktop Framework:**
- **Tauri 2.0** – Lightweight desktop framework (Rust-based, smaller than Electron)
- **Rust** – Minimal backend (~100 lines) for file I/O only

**Key Libraries:**
- `@tauri-apps/api` – Core Tauri API
- `@tauri-apps/plugin-dialog` – Native file dialogs
- `@tauri-apps/plugin-fs` – File system access
- `@tauri-apps/plugin-shell` – Shell/OS integration
- `papaparse` – CSV parsing
- `@tanstack/react-table` – Data grid
- `zustand` – State management

## Environment Configuration

**Desktop-Focused Architecture:**
Unlike our web projects, Juniper is a desktop application and does not require Docker, PostgreSQL, or traditional web deployment infrastructure. However, we still follow the single-source-of-truth pattern for environment configuration.

**Environment Variables:**
- Top-level `.env` file for Vite configuration
- All `VITE_*` prefixed variables are exposed to the frontend
- Tauri configuration uses `tauri.conf.json` for app-specific settings

**Development Mode:**
```bash
# Frontend + Tauri hot-reload (from root directory)
npm run dev

# OR use Makefile
make dev
```

**Production Build:**
```bash
# Creates platform-specific installer/app bundle (from root directory)
npm run build

# OR use Makefile
make build
```

## External Resources

The project uses the Common repository for shared standards and conventions. See `${COMMON_REPO}/ExternalResources.md` for full details on accessing external resources and shared documentation.

**Note:** Juniper adapts Common patterns for desktop development. Not all web-focused patterns apply (no Docker, no PostgreSQL, no backend service), but we maintain consistency in:
- Documentation standards
- Coding style and conventions
- File organization principles
- Build automation patterns

## Packages and Coding Style

* Always comment new files and keep comments on existing files up to date with any new or revised functionality. Classes and methods should have docstrings, and you can also place end-of-line comments on any notable or complex lines.

* In all coding languages, use 4-space indents rather than 2-space indents.

* Where possible, prefer double-quotes over single-quotes for strings.

* Always keep the following packages installed in the project: Tailwind CSS v4.1 (or newer), React v18 (or newer), TypeScript v5.3+

### Frontend Styling Guidelines

* Our **primary UI library is DaisyUI** (built on top of TailwindCSS). Use DaisyUI components (`btn`, `card`, `alert`, `badge`, `tabs`, `navbar`, `menu`, `table`, `progress`, `stats`, etc.) wherever possible.

* Prefer DaisyUI semantic utilities (`bg-base-100/200/300`, `text-base-content`, `border-base-300`, `text-(primary|secondary|accent|info|success|warning|error)`) over raw Tailwind color scales.

* For any patterns not covered by DaisyUI, check existing component patterns in `frontend/src/components` directory, then create new components if needed.

* If no good preexisting DaisyUI component exists, implement a minimal placeholder with clear documentation in the component file.

* All components in `frontend/src/components` should be properly typed with TypeScript and include JSDoc comments.

* Never hard-code color values in components or pages. All colors must come from CSS variables or from DaisyUI theme tokens. If a needed color isn't present, create a new variable with both light and dark mode values and expose it via `tailwind.config.js`.

* Dynamic utilities injected by component logic are supported. Ensure patterns for those classes are covered by the Tailwind safelist (in `tailwind.config.js`) so they are compiled at build time. Prefer semantic DaisyUI classes for dynamic injection where possible.

### Rust Coding Guidelines

* Keep Rust code minimal and focused on file I/O and native OS integration
* Use Tauri's command system for all frontend-to-backend communication
* All Tauri commands should return `Result<T, String>` for consistent error handling
* Document all Tauri commands with doc comments explaining parameters and return values
* Follow Rust's standard formatting with `rustfmt`

## TypeScript Attribute Initialization & Access Patterns

* Always initialize properties in constructors or as class field defaults

* Every instance property a class relies on should be explicitly set, even if only to `undefined`. This ensures that:
  * Code can safely access properties without risking runtime errors
  * The intent of which properties belong to the instance is clear at class definition time
  * IDEs and static analyzers can infer property existence more reliably

* Prefer direct access over optional chaining when properties are guaranteed to exist after initialization

* Avoid redundant checks. Example: `const data = this.csvData` is preferred to `const data = this.csvData || null` when the property is guaranteed to exist

* Rule of thumb:
  * If the property is part of the class contract → define in class fields and access directly
  * If the property is truly optional → mark with `?` and use optional chaining or null checks

## CSV Editor Architecture

### State Management

The application uses Zustand for state management with three primary stores:

**csvStore.ts** - CSV data and file operations:
```typescript
interface CSVStore {
    data: string[][];
    headers: string[];
    currentFile: string | null;
    isDirty: boolean;

    loadCSV: (path: string) => Promise<void>;
    updateCell: (row: number, col: number, value: string) => void;
    addRow: () => void;
    deleteRows: (indices: number[]) => void;
    save: () => Promise<void>;
}
```

**filterStore.ts** - Filtering, sorting, and grouping state:
- Multi-part filtering logic
- Sort order management
- Grouping configuration
- Filter persistence

**settingsStore.ts** - User preferences and UI state:
- Theme preferences
- Print template selections
- Last opened files
- Window state

### Print System

Prints are rendered preview formats that display CSV data in professional page layouts. The system is designed to be extensible and user-customizable.

**Print Template Structure:**
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

**Bundled Prints:**
- Screenplay format (Scene, Action, Character, Dialogue, Parenthetical, Transition)
- Dialogue format (Character, Dialogue, Direction)
- Game design format (customizable based on common game design patterns)

**Custom Prints:**
- Users can create custom Print templates via a visual editor
- Templates are stored as JSON files in the app data folder
- Managed via Tauri storage commands

### CSV Grid Component

* Use **TanStack Table** for the primary CSV editing grid
* Implement virtualization with `@tanstack/react-virtual` or `react-window` for large files (1000+ rows)
* Support inline editing, sorting, filtering, multi-select, and bulk operations
* Color coding based on user-defined rules
* Row/column grouping and summaries

## Tauri Backend Commands

The Rust backend exposes the following Tauri commands (defined in `backend/src/`):

**File Operations (file_ops.rs):**
```rust
#[tauri::command]
fn open_csv_file(path: String) -> Result<String, String>

#[tauri::command]
fn save_csv_file(path: String, content: String) -> Result<(), String>

#[tauri::command]
fn open_file_dialog() -> Result<Option<String>, String>

#[tauri::command]
fn save_file_dialog(default_name: String) -> Result<Option<String>, String>
```

**Storage (storage.rs):**
```rust
#[tauri::command]
fn load_preferences() -> Result<String, String>  // Returns JSON

#[tauri::command]
fn save_preferences(data: String) -> Result<(), String>

#[tauri::command]
fn load_custom_prints() -> Result<Vec<String>, String>  // List of Print JSONs

#[tauri::command]
fn save_custom_print(name: String, data: String) -> Result<(), String>

#[tauri::command]
fn delete_custom_print(name: String) -> Result<(), String>
```

**Important:** All file I/O and native OS interactions must go through these Tauri commands. Never attempt to use browser-based File APIs or localStorage for production features.

## Build and Development Workflow

### Prerequisites

**System Dependencies:**
```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js 18+
# (installation method varies by platform)

# Linux: Additional system dependencies for Tauri 2.0
# Ubuntu/Debian:
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

### Development Commands

```bash
# Install dependencies (from frontend directory - includes Tauri CLI)
cd frontend && npm install
# OR: make setup

# Start development server with hot-reload (both React and Rust)
cd frontend && npm run tauri:dev
# OR: make dev

# Build production installer/app bundle
cd frontend && npm run tauri:build
# OR: make build

# Run frontend only (for rapid UI iteration)
cd frontend && npm run dev
# OR: make dev-frontend

# Run linting
cd frontend && npm run lint
# OR: make lint

# Format code
cd frontend && npm run format
# OR: make format
```

### Makefile Integration

While Tauri doesn't require Docker or complex orchestration, we maintain a Makefile for consistency with other projects:

```bash
make help      # Show available commands
make dev       # Start development server
make build     # Build production bundle
make lint      # Run linting
make format    # Format code
make clean     # Clean build artifacts
```

## Documentation

* **Primary documentation** lives in `/wiki/` directory, organized into internal and external sections (following our standard pattern from other projects).
* **Structure**:
  - `/wiki/README.md` - Top-level overview and navigation hub
  - `/wiki/ORGANIZATION.md` - Wiki organization guide
  - `/wiki/internal/` - Technical documentation for developers
  - `/wiki/external/` - User-facing documentation (for end users of Juniper)

* **Internal docs** (`/wiki/internal/`):
  - Technical architecture
  - Print system implementation
  - State management patterns
  - Tauri command documentation

* **External docs** (`/wiki/external/`):
  - User guide
  - Creating custom Prints
  - CSV editing features
  - Keyboard shortcuts and tips

## Testing Guidelines

* Only run tests when explicitly requested by the user
* Use Vitest (Vite's test framework) for unit tests
* Use React Testing Library for component tests
* Consider Playwright or Tauri's built-in testing for integration tests
* Test files should live alongside components: `Component.tsx` and `Component.test.tsx`

## Git and Version Control

* **Do not create git commits.** The user prefers to handle all git operations themselves. Stage files as needed for review, but let the user run `git commit` and `git push`.

* If you stage files, clearly indicate this in your response.

* **Important: Never create, write, or edit migration files** (this doesn't apply to Juniper since we don't use a database, but maintaining the principle for consistency).

## Key Differences from Other Projects

Juniper differs from our typical web projects in several important ways:

1. **No Docker** - Tauri apps run natively, no containerization needed
2. **No Database** - All data is file-based (CSV files, JSON for preferences)
3. **No Backend Service** - Tauri's Rust layer handles file I/O only
4. **Vite instead of Next.js** - Per user's request, testing Vite for future adoption
5. **Desktop-focused UX** - Native window controls, file menus, OS integration
6. **No Web Deployment** - Distribution via installers (.dmg, .exe, .deb, .AppImage)

However, we maintain consistency with other projects in:
- Coding standards (4-space indents, double quotes, comprehensive comments)
- TailwindCSS + daisyUI styling approach
- Documentation structure (/wiki with internal/external split)
- Build automation via Makefile
- Common repository integration for shared standards

## Error Handling & Logging

* Implement configurable verbosity levels for error handling and logging
* Use environment variables or configuration objects to allow developers to switch between different error verbosity levels without code changes
* Typical levels: DEBUG (verbose), INFO (standard), WARNING (quiet), ERROR (silent except critical)
* This allows developers to adjust logging behavior for their specific context

## Print Editor Workflow

When implementing the Print template editor:

1. **Template Selection** - Browse bundled and custom templates
2. **Field Mapping** - Visual interface to map CSV columns to Print fields
3. **Style Configuration** - Font, size, indent, spacing, color controls
4. **Preview** - Live preview of the Print output with sample CSV data
5. **Save/Export** - Save custom templates for reuse

The Print editor should be intuitive enough for non-technical users (writers, designers) while providing enough power for advanced customization.

## Performance Considerations

* **Large CSV Files** - Use virtualization for tables with 1000+ rows
* **Lazy Loading** - Load Print previews on-demand, not all at once
* **Debouncing** - Debounce filter and search inputs to avoid excessive re-renders
* **Memoization** - Use React.memo and useMemo for expensive calculations
* **Web Workers** - Consider web workers for CSV parsing if files are very large (10,000+ rows)

## Accessibility

* Ensure keyboard navigation works throughout the app (CSV grid, Print editor, dialogs)
* Use semantic HTML and ARIA attributes where appropriate
* Test with screen readers for critical workflows
* Maintain color contrast ratios per WCAG AA standards (daisyUI themes should handle this by default)

## Future Enhancements

Document potential future features in `/wiki/internal/` but do not implement unless requested:

* Editable Prints (edit CSV data directly in Print preview)
* Import/export templates
* Collaborative editing (if network sync is added later)
* Plugin system for custom Print renderers
* Integration with game engines (Unity, Unreal, Godot)
* CLI mode for batch processing

---

**Project Status:** Initial development - Building MVP with core CSV editing and Print preview functionality.

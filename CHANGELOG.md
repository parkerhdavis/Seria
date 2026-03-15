# Version 0.0.2 - (01/10/2026)

## Features

### Custom Title Bar

- **Native Desktop Experience**
    - Implemented custom window title bar with minimize, maximize, and close controls
    - Added File menu to title bar with standard operations (New, Open, Save, Save As, Reload, Import)
    - Dynamic title display showing current file name or "Seria - Data for Writers" when no file is open
    - Fully draggable title bar for window movement
    - Double-click title bar to toggle maximize/restore window state
    - Real-time saved/unsaved status badge displayed next to file name
    - Keyboard shortcuts displayed in File menu for discoverability

### Performance Improvements

- **Virtualization Architecture**
    - Cell view (CSV grid) reworked with virtualization, massively improving performance on files with tens of thousands of rows
    - Print view reworked with virtualization for smooth rendering of large datasets
    - Eliminated lag and stuttering when working with 10,000+ row files

### Font Support

- **Courier Prime Font Bundling**
    - Bundled Courier Prime font family (regular, bold, italic, bold-italic) with the application
    - Screenplay Print views now use Courier Prime instead of system Courier font
    - PDF exports embed Courier Prime font for consistent cross-platform typography
    - Searchable, selectable text in PDFs with professional monospace formatting
    - Added app-wide font selection in Settings (system default or Courier Prime)
    - Font preferences persist across sessions

### Format Conversion System

- **Import/Export Pipeline**
    - Set up format conversion infrastructure for importing/exporting various non-serialized data formats to/from CSV
    - Screenplay format import and export fully functional
        - Import plaintext screenplay files to CSV (File > Import > as Screenplay)
        - Export CSV data to plaintext screenplay format (File > Export > as Screenplay)
        - Preserves industry-standard formatting with proper indentation
        - Supports all screenplay elements: Scene, Action, Character, Dialogue, Parenthetical, Transition
    - Additional format conversions coming soon (Fountain, PDF screenplay, XML)

- **PDF Export from Print Views**
    - Export Screenplay Print views to PDF with comprehensive customization options
        - **Text-Based PDFs**: Generates proper PDFs with searchable, selectable text (not images)
            - Dramatically smaller file sizes compared to image-based PDFs
            - Text can be copied, pasted, and searched
            - Accessible to screen readers and assistive technologies
            - Perfect margins and spacing with precise control
        - **Save Location**: Browse button to choose exact save path (not limited to Downloads folder)
        - **Page Range**: Export all pages or custom range (only in paged mode)
        - **Colors**: Customize text and background colors with color pickers
        - **Watermarks**: Optional watermarks with custom text, position (diagonal/header/footer), opacity, and color
        - **Page Numbers**: Optional page numbers in screenplay-standard position (top-right)
        - **Headers/Footers**: Optional custom headers and footers
        - **Screenplay-Standard Formatting**: Uses screenplay recipe configuration directly for perfect consistency
            - All margins, indentation, spacing, and widths read from the screenplay recipe
            - PDF layout exactly matches the ScreenplayPrint view
            - If recipe is modified, PDF export automatically adapts
            - Scene numbers positioned 0.7" outside margins (left and right)
            - Parentheticals automatically wrapped in parentheses
            - Proper element ordering: Transition > Scene > Action > Character > Parenthetical > Dialogue
            - Bold text for scene headings and character names
            - Uppercase transformation for scene headings, characters, and transitions
            - Extra line spacing between consecutive Action elements
        - **Progress Tracking**: Real-time progress bar during export showing current stage and element count, especially helpful for large files
        - Export button integrated into Print Toolbar for easy access

### UI/UX Enhancements

- **Smart Autocomplete & Data Entry Assistance**
    - Intelligent autocomplete suggestions based on existing column values
    - Fuzzy matching algorithm prioritizes exact matches, prefixes, contains, and character sequence
    - Keyboard navigation with Arrow Up/Down, Enter/Tab to select, Escape to dismiss
    - Configurable in Settings:
        - Enable/disable autocomplete globally
        - Set minimum characters before showing suggestions (0-5)
        - Option to restrict to existing values only
    - Works seamlessly with all cell editing modes (inline, textarea, popout)
    - Real-time column value caching for instant suggestions
    - Visual dropdown with clear selection indicator

- **Workspace Layouts & Panel Presets**
    - Save and restore complete workspace configurations
    - Each layout stores:
        - Print drawer position (right/bottom) and size
        - Sidebar visibility state
        - Zoom level
        - Column widths
    - Visual workspace manager (Ctrl+Shift+W) with:
        - Save current layout with custom name
        - Load, rename, delete layouts
        - Set default layout
        - View layout details and last used timestamp
    - Quick-switch between layouts with Ctrl+1 through Ctrl+9
    - Persistent storage across sessions
    - Perfect for switching between writing, editing, and review modes

- **Multi-Cursor & Multi-Cell Editing**
    - Ctrl/Cmd+Click to add secondary cursors at any cell position
    - Visual distinction: primary cursor (solid outline), secondary cursors (dashed outline)
    - Synchronous editing across all cursor positions:
        - Type to update all cells simultaneously
        - Paste to all cursor positions
        - Delete/Backspace to clear all cursor cells
    - Escape to clear all multi-cursors
    - Automatic cleanup when incompatible with range selections
    - Power user feature for batch editing operations

---

## Bugfixes

### CSV Grid

- Fixed bug where multiline/longer cells did not show all text during edit
    - Cells with text wrapping now properly expand to show full content when opened for editing

### Print System

- **Screenplay Print Format**
    - Fixed continuous mode not rendering properly as one continuous page
    - Fixed paged mode not splitting pages consistently
    - Fixed font not displaying as Courier monospace (now properly applies fontFamily from recipe)
    - Fixed hardcoded element spacing - removed all hardcoded padding/margin classes:
        - Removed `mb-3` class (element bottom margin)
        - Removed `py-1` class (element vertical padding)
        - Removed `p-2` class (container padding)
        - Recipe's lineHeight, lineSpaceBefore, and lineSpaceAfter now have complete control over all spacing
    - Fixed page overlap in paged mode - page gaps now scale proportionally with page size (0.5" gap)
    - Fixed excess bottom margin in both Print view and PDF export:
        - Removed phantom spacing from removed `mb-3` class in pagination calculations
        - PDF export now correctly matches CSS line-height (leading-tight: 1.25)
        - Both Print view and PDF export now accurately respect recipe margin settings
    - Improved page break handling for dialogue:
        - Character elements always stay with their parenthetical/dialogue elements (never orphaned at page end)
        - Dialogue that would split across pages is intelligently split with proper formatting:
            - Splits conservatively (one line above natural break point)
            - Finds good break points (spaces, punctuation) when possible
            - Adds "(MORE)" parenthetical at bottom of first page
            - Adds character name with " (CONT'D)" at top of next page
            - Remaining dialogue continues seamlessly on next page
        - Maintains screenplay industry standards for continued dialogue
    - Improved page break handling for action:
        - Action elements never split across pages
        - If an action doesn't fit, it moves entirely to the next page
        - Removed hardcoded extra spacing between consecutive action elements in PDF export
    - Added comprehensive documentation of page break rules as inline comments in worker code
- **Print View General**
    - Fixed bugs with fullscreen/focus mode not working correctly for Print views

---

## Technical Changes

### Recipe System Improvements

- **Simplified Margin API**: Replaced `leftMargin` and `rightMargin` with a single `xMargin` property
    - `xMargin` is applied on top of page margin (measured from page margin edge)
    - Interpreted based on `textAlign`: left margin edge for "left", right margin edge for "right"
    - Provides clean separation between page layout (margins) and content positioning (xMargin)
    - Eliminates redundancy and ambiguity in element positioning
    - Makes recipes more intuitive to create and modify
    - All rendering code (ScreenplayPrint, PDF export) updated to use new margin system

- **Configurable Line Height**: Added `lineHeight` property to recipe ingredient styles
    - Controls spacing between lines within multi-line elements (action, dialogue)
    - Accepts multiplier values (e.g., 1.0 = single-spaced, 1.25 = tight, 1.5 = 1.5x, 2.0 = double-spaced)
    - Default value is 1.25 if not specified
    - Screenplay recipe now uses 1.0 (single-spaced) for tighter, more professional formatting
    - Consistently applied across Print view, pagination calculations, and PDF export

---

## Known Issues

_(No known issues at time of v0.0.2 release)_

---

---

# Version 0.0.1 - Initial Development Release (11/14/2025)

## Core Features

### CSV/TSV Editing

- **File Operations**
    - Open and save CSV/TSV files with native file dialogs
    - Auto-save functionality with unsaved changes tracking
    - Recent files list in File menu
- **Data Grid**
    - Spreadsheet-style interface with inline cell editing
    - Add and delete rows
    - Column resizing and reordering
    - Single and multi-row selection with visual drag handles
- **Keyboard Navigation**
    - Arrow keys for cell navigation
    - Enter to edit, Escape to cancel edits
    - Delete key to clear cell contents

### Print System

- **Live Preview:** Real-time rendering of CSV data in professional page layouts
- **Bundled Formats:**
    - _Screenplay_ - Industry-standard formatting (scene headings, action, character, dialogue, parentheticals, transitions)
    - _Card_ - Compact card-based layout for game design and dialogue trees
    - _Dialogue_ - Character-focused layout with dialogue and direction columns
- **Export:** PDF generation from Print previews
- **Extensibility:** Template architecture in place for custom Print formats (editor UI planned for future release)

### Filtering, Sorting & Grouping

- Multi-column text filtering with AND/OR logic operators
- Global search across all columns
- Single and multi-column sorting (ascending/descending)
- Group rows by column values with collapsible sections
- Persistent filter settings between sessions

#### UI & Themes

- Light and dark mode support (dark mode needs additional polish)
- Theme toggle in settings panel
- Toast notifications for file operations and error states

---

## Technical Highlights

### Cross-Platform Desktop App

- Built on Tauri 2.0 framework (lightweight Rust-based alternative to Electron)
- Native file system integration
- **Supported Platforms:**
    - Linux: .deb, .rpm, AppImage
    - Windows: .exe, .msi (cross-compiled from Linux)
    - macOS: Planned for future release

### Performance & Architecture

- PapaParse library for robust CSV/TSV parsing
- Zustand for state management (csvStore, filterStore, settingsStore)
- Persistent user preferences via Tauri backend storage

### Development Infrastructure

- Automated setup script supporting Linux, macOS, and Windows
- Makefile commands: `dev`, `build`, `build-linux`, `build-windows`, `lint`, `format`, `clean`
- Hot-reload for both React and Rust during development
- Centralized version management from `.env` to all build outputs

### Known Limitations (v0.0.1)

- **Large File Performance:** Files with 10,000+ rows experience lag. _(Resolved in v0.0.2)_
- **Wrap Text bug:** Sometimes, editing a cell with text wrapping doesn't show all the text in the cell at once. _(Resolved in v0.0.2)_

---

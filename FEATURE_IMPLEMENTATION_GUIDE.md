# Feature Implementation Guide

This document provides detailed implementation plans for the UI/UX improvements identified during the codebase review.

## ✅ Completed Features

### 1. Recent Files & Session Management
**Status:** ✅ Complete

**Implementation:**
- Updated `SettingsModal.tsx` to display recent files list with click-to-open functionality
- Added Recent Files dropdown in `Header.tsx` for quick access
- Backend already supported recent files tracking via `globalConfigStore.ts`
- Files are automatically added to recent list when opened
- Users can clear recent files from settings

**Files Modified:**
- `frontend/src/components/modals/SettingsModal.tsx`
- `frontend/src/components/layout/Header.tsx`

**Keyboard Shortcuts:** None (accessible via UI)

---

### 2. Quick Navigation & "Go To" Commands
**Status:** ✅ Complete

**Implementation:**
- Created `GoToModal.tsx` component with support for:
  - Row numbers (e.g., "42")
  - Column names (e.g., "Content")
  - Excel-style cell references (e.g., "B42", "A1")
  - Quick actions for first/last row
- Added Ctrl+G keyboard shortcut to open modal
- Integrated with cell selection store for navigation

**Files Created:**
- `frontend/src/components/modals/GoToModal.tsx`

**Files Modified:**
- `frontend/src/App.tsx`

**Keyboard Shortcuts:** `Ctrl+G` - Open Go To dialog

---

### 3. Column Manager & Batch Column Operations
**Status:** ✅ Complete

**Implementation:**
- Created `ColumnManagerModal.tsx` with comprehensive column management:
  - View all columns with statistics (unique values, empty cells)
  - Drag-and-drop column reordering
  - Rename columns inline
  - Delete columns (with confirmation)
  - Duplicate columns
  - Add new columns
- Added Ctrl+M keyboard shortcut to open modal

**Files Created:**
- `frontend/src/components/modals/ColumnManagerModal.tsx`

**Files Modified:**
- `frontend/src/App.tsx`

**Keyboard Shortcuts:** `Ctrl+M` - Open Column Manager

### 4. Smart Autocomplete & Data Entry Assistance
**Status:** ✅ Complete

**Implementation:**
- Created `autocomplete.ts` utility with fuzzy matching via `calculateSimilarity()` (exact=1000, starts-with=100, contains=50, fuzzy match)
- Created `useAutocomplete.ts` hook with suggestion state, keyboard navigation (ArrowUp/Down, Enter/Tab to accept, Escape to dismiss)
- Created `AutocompleteDropdown.tsx` component with fixed positioning, highlighted selection, scroll-into-view, click-to-select
- Column value caching in `cellColumnStore.ts` with `buildColumnCache()` and `updateColumnCache()` (capped at 1000 unique values per column)
- Integrated into `CellGridVirtualized.tsx` for cell editing
- Settings UI in `SettingsModal.tsx`: enable/disable toggle, minimum characters, restrict to existing values

**Files Created:**
- `frontend/src/utils/autocomplete.ts`
- `frontend/src/hooks/useAutocomplete.ts`
- `frontend/src/components/cell/AutocompleteDropdown.tsx`

**Files Modified:**
- `frontend/src/stores/cellColumnStore.ts`
- `frontend/src/stores/settingsStore.ts`
- `frontend/src/components/cell/CellGridVirtualized.tsx`
- `frontend/src/components/modals/SettingsModal.tsx`

**Keyboard Shortcuts:** Arrow Up/Down to navigate suggestions, Enter/Tab to accept, Escape to dismiss

---

### 6. Workspace Layouts & Panel Presets
**Status:** ✅ Complete

**Implementation:**
- Created `workspace.ts` types with `WorkspaceLayout` interface (id, name, printDrawerPosition, printDrawerSize, sidebarOpen, selectedPrintRecipe, zoomLevel, columnWidths, isDefault, createdAt, lastUsed)
- Created `workspaceStore.ts` Zustand store with full CRUD: `loadLayouts()`, `saveLayout()`, `loadLayout()`, `deleteLayout()`, `renameLayout()`, `setDefaultLayout()`, `updateLayoutUsage()`
- Created `WorkspaceManagerModal.tsx` with save-current-layout form, layout list sorted by last used, load/rename/set-default/delete actions, layout detail display
- Backend persistence via Tauri commands `load_workspace_layouts` and `save_workspace_layouts` in `storage.rs` with localStorage fallback
- Ctrl+Shift+W opens workspace manager, Ctrl+1 through Ctrl+9 for quick-switch

**Files Created:**
- `frontend/src/types/workspace.ts`
- `frontend/src/stores/workspaceStore.ts`
- `frontend/src/components/modals/WorkspaceManagerModal.tsx`

**Files Modified:**
- `backend/src/storage.rs`
- `backend/src/main.rs`
- `frontend/src/App.tsx`

**Keyboard Shortcuts:** `Ctrl+Shift+W` - Open Workspace Manager, `Ctrl+1`-`Ctrl+9` - Quick-switch layouts

---

### 9. Multi-Cursor & Multi-Cell Editing
**Status:** ✅ Complete

**Implementation:**
- Added `multiCursors` array to `cellSelectionStore.ts` with `addMultiCursor`, `removeMultiCursor`, `toggleMultiCursor`, `clearMultiCursors`, `hasMultiCursors`, `getAllCursorPositions`
- Ctrl/Cmd-click toggles multi-cursor in `useCellSelection.ts`
- Multi-cursor cells rendered with distinct visual styling in `CellGridVirtualized.tsx`
- Clipboard operations support multi-cursor positions via `useClipboard.ts`

**Files Modified:**
- `frontend/src/stores/cellSelectionStore.ts`
- `frontend/src/hooks/useCellSelection.ts`
- `frontend/src/hooks/useClipboard.ts`
- `frontend/src/components/cell/CellGridVirtualized.tsx`

**Keyboard Shortcuts:** `Ctrl+Click` / `Cmd+Click` - Toggle multi-cursor at cell

---

### 5. Print View Search & Editing Enhancements
**Status:** ✅ Complete

**Implementation:**
- Added `searchContext` field to `SearchOptions` in `findReplaceStore.ts` with values: "cell", "print", "all"
- Created `highlightSearchText()` function in `ScreenplayPrint.tsx` for text-level search highlighting with `<mark>` spans
- Created `highlightCardSearchText()` function in `CardPrint.tsx` for card content highlighting
- Both print components subscribe to `findReplaceStore` for search term, options, matches, and current match
- `ScreenplayElementView` receives search props and highlights matching text within element content (both continuous and paged modes)
- `Card` component highlights search matches in title, subtitle, and content fields
- Current active match uses brighter highlight (`bg-warning/80`), other matches use dimmer highlight (`bg-warning/40`)
- `CellGridVirtualized` respects `searchContext` — only shows cell highlights when context is "cell" or "all"
- `FindReplaceModal` updated with view context selector dropdown (Cell View / Print View / All Views)

**Files Modified:**
- `frontend/src/stores/findReplaceStore.ts`
- `frontend/src/components/modals/FindReplaceModal.tsx`
- `frontend/src/components/prints/ScreenplayPrint.tsx`
- `frontend/src/components/prints/CardPrint.tsx`
- `frontend/src/components/cell/CellGridVirtualized.tsx`

**Keyboard Shortcuts:** `Ctrl+F` (existing) with view context selector

---

### 7. Comparison & Diff View for CSV Files
**Status:** ✅ Complete

**Priority:** HIGH (Critical for Git Workflows)

**Implementation:**
- Created `backend/src/diff.rs` with full CSV diff engine:
  - LCS (Longest Common Subsequence) algorithm for row matching
  - Two-pass matching: exact row match first, then ID-column (first column) matching for modified rows
  - Hash-based matching fallback for large files (>5000 rows)
  - CSV parsing with proper quote/escape handling
  - Column change detection (added/deleted columns)
  - 5 unit tests (all passing)
- Created `DiffViewModal.tsx` with:
  - Side-by-side two-panel layout with synchronized scrolling
  - Color-coded diff: green (added), red (deleted), yellow (modified)
  - Change navigation with Ctrl+Up/Down
  - Summary badges showing counts of added/deleted/modified rows and columns
  - File picker to select comparison file
  - Modified cells show tooltip with previous value
- Registered `compare_csv_files` Tauri command in `main.rs`

**Files Created:**
- `backend/src/diff.rs`
- `frontend/src/components/modals/DiffViewModal.tsx`

**Files Modified:**
- `backend/src/main.rs`
- `frontend/src/App.tsx`

**Keyboard Shortcuts:** `Ctrl+Shift+D` - Open Compare Files

---

### 8. Export Templates & Custom Export Formats
**Status:** ✅ Complete

**Priority:** VERY HIGH (Core Value Proposition)

**Implementation:**
- Created `ExportTemplate` type definitions in `frontend/src/types/exportTemplate.ts` with:
  - `FieldMapping` for CSV-to-export field mapping with optional transforms
  - `TransformFunction` type (uppercase, lowercase, trim, parseNumber, parseBoolean, escapeHtml, escapeJson)
  - `ExportOptions` for format-specific settings
- Created `exportTemplateStore.ts` Zustand store with:
  - Template CRUD operations (load, save, delete custom templates)
  - `executeExport()` engine supporting JSON, YAML, XML, and custom output formats
  - Template placeholder processing ({columnName}, {N}, {row_json}, {row_fields_yaml}, {row_fields_xml}, etc.)
  - Custom templates persisted via Tauri preferences
- Created 8 built-in templates in `exportTemplates.ts`:
  - JSON Array, Unity ScriptableObject JSON, Unreal DataTable JSON
  - Godot Resource (.tres), Ink Dialogue, Yarn Spinner
  - XML, YAML
- Created `ExportModal.tsx` with:
  - Template list with category filtering (General, Game Engines, Dialogue)
  - Live preview with configurable row count
  - Template detail display
  - Export to file via save dialog
  - Copy to clipboard functionality
  - Template info badges (format, file extension, category)

**Files Created:**
- `frontend/src/types/exportTemplate.ts`
- `frontend/src/data/exportTemplates.ts`
- `frontend/src/stores/exportTemplateStore.ts`
- `frontend/src/components/modals/ExportModal.tsx`

**Files Modified:**
- `frontend/src/App.tsx`

**Keyboard Shortcuts:** `Ctrl+Shift+E` - Open Export dialog

---

### 10. Cell Edit History & Audit Trail
**Status:** ✅ Complete

**Priority:** MEDIUM-LOW

**Implementation:**
- Extended `cellHistoryStore.ts` with per-cell edit tracking:
  - `CellEdit` interface: timestamp, row, col, columnName, oldValue, newValue
  - `cellEdits` Map keyed by "row:col" for O(1) cell history lookup
  - `recordCellEdit()` - records an edit (capped at 100 per cell)
  - `getCellHistory()` - get history for a specific cell
  - `getAllCellEdits()` - get all edits sorted by timestamp
  - `clearCellEdits()` - clear on file load
- Integrated `recordCellEdit()` into `cellStore.updateCell()` to automatically track all cell mutations
- Created `CellHistoryModal.tsx` with:
  - Two view modes: "Selected Cell" (specific cell history) and "All Edits" (session-wide)
  - Column filter dropdown in "All Edits" mode
  - Timeline display with relative timestamps and old→new value changes
  - Color-coded value display (red for old, green for new)
  - "Restore" button to revert to any previous value
  - Edit count display

**Files Created:**
- `frontend/src/components/modals/CellHistoryModal.tsx`

**Files Modified:**
- `frontend/src/stores/cellHistoryStore.ts`
- `frontend/src/stores/cellStore.ts`
- `frontend/src/App.tsx`

**Keyboard Shortcuts:** `Ctrl+Shift+H` - Open Edit History

---

## Implementation Priority Recommendations

### Phase 1: High-Impact, Medium Complexity ✅ COMPLETE
1. ✅ Recent Files
2. ✅ Quick Navigation
3. ✅ Column Manager
4. ✅ Smart Autocomplete
6. ✅ Workspace Layouts
9. ✅ Multi-Cursor

### Phase 2: High-Impact, High Complexity ✅ COMPLETE
5. ✅ Print View Search
7. ✅ Diff View
8. ✅ Export Templates

### Phase 3: Power User Features ✅ COMPLETE
10. ✅ Cell Edit History

---

## Testing Requirements

### For Each Feature:
1. **Unit Tests:**
   - Test core logic in isolation
   - Mock dependencies

2. **Integration Tests:**
   - Test feature with real data
   - Test edge cases (empty files, large files, etc.)

3. **E2E Tests:**
   - Test complete user workflows
   - Test keyboard shortcuts
   - Test persistence

### Test Files to Create:
```
frontend/src/__tests__/
  ├── GoToModal.test.tsx
  ├── ColumnManager.test.tsx
  ├── Autocomplete.test.tsx
  ├── WorkspaceLayouts.test.tsx
  ├── ExportTemplates.test.tsx
  └── DiffView.test.tsx
```

---

## Documentation Requirements

### For Each Feature, Update:
1. **User Documentation:**
   - `wiki/02_Cell View/` - For cell-related features
   - `wiki/03_Print View/` - For print-related features
   - `wiki/04_Customization/03.02_Keyboard Shortcuts.md` - Add new shortcuts

2. **Developer Documentation:**
   - Architecture decisions
   - API documentation
   - Code examples

3. **Changelog:**
   - `CHANGELOG.md` - User-facing changes
   - `wiki/05_Development/05.08_PendingChangelog.md` - Development notes

---

## Performance Considerations

### For Large Files (10,000+ rows):
1. **Smart Autocomplete:**
   - Debounce suggestion calculation (300ms)
   - Limit unique value cache size (max 1000 per column)
   - Use Web Worker for fuzzy matching

2. **Diff View:**
   - Progressive diff calculation
   - Virtual scrolling for large diffs
   - Limit visible context (±10 rows from changes)

3. **Cell History:**
   - Cap history per cell (max 100 edits)
   - Periodic cleanup of old history
   - Optional feature (can be disabled)

---

## Breaking Changes

### None Expected
All features are additive and don't modify existing APIs or data formats.

### Migration Plan (If Needed):
- Workspace layouts: New feature, no migration
- Export templates: New feature, no migration
- Cell history: Optional feature, no migration

---

## Future Enhancements

### Smart Autocomplete:
- Machine learning for better suggestions
- Context-aware suggestions (based on other columns)
- Multi-language support

### Export Templates:
- Community template marketplace
- Template versioning
- Template inheritance

### Diff View:
- Three-way merge for conflict resolution
- Git blame integration
- Visual merge tool

### Workspace Layouts:
- Cloud sync (optional)
- Team-shared layouts
- Layout templates

---

## Questions & Decisions

### Smart Autocomplete:
- **Q:** Should autocomplete be enabled by default?
- **A:** Yes, but with opt-out in settings

### Export Templates:
- **Q:** Should templates be stored per-file or globally?
- **A:** Global templates, but can be overridden per-file

### Diff View:
- **Q:** Should we integrate with Git directly or just compare files?
- **A:** Start with file comparison, add Git integration in Phase 2

---

## Summary

**Completed:** 10 of 10 features - ALL FEATURES IMPLEMENTED

| # | Feature | Shortcut |
|---|---------|----------|
| 1 | Recent Files & Session Management | UI |
| 2 | Quick Navigation / GoTo | Ctrl+G |
| 3 | Column Manager | Ctrl+M |
| 4 | Smart Autocomplete | Automatic |
| 5 | Print View Search | Ctrl+F (view selector) |
| 6 | Workspace Layouts | Ctrl+Shift+W, Ctrl+1-9 |
| 7 | Comparison / Diff View | Ctrl+Shift+D |
| 8 | Export Templates | Ctrl+Shift+E |
| 9 | Multi-Cursor Editing | Ctrl+Click |
| 10 | Cell Edit History | Ctrl+Shift+H |

**All features align with Seria's vision:**
- Writer-friendly workflows ✅
- Game development pipeline integration ✅
- Local-first, privacy-focused ✅
- Power user features ✅
